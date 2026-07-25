import {
  beats,
  randomMove,
  ROUNDS_TO_WIN,
  ROUND_TIME_MS,
  FIRST_ROUND_EXTRA_MS,
  REVEAL_TIME_MS,
  DISCONNECT_GRACE_MS,
  type Move,
  type MatchMode,
  type MatchEndReason,
  type ServerToClientEvents,
  type OpponentInfo,
  type MatchStatePayload,
} from '@rps/shared';

/**
 * Anything that can play in a match: a connected socket or the bot.
 * The engine only ever talks through this interface.
 */
export interface PlayerPort {
  userId: number;
  info: OpponentInfo;
  send<E extends keyof ServerToClientEvents>(
    event: E,
    payload: Parameters<ServerToClientEvents[E]>[0]
  ): void;
}

export type Seat = 'p1' | 'p2';

export interface RoundRecord {
  roundNo: number;
  seq: number;
  p1Move: Move;
  p2Move: Move;
  winner: Seat | 'draw';
}

export interface MatchResult {
  matchId: string;
  mode: MatchMode;
  wager: number;
  /** null on a double-AFK abort — no winner, wagers refunded. */
  winnerSeat: Seat | null;
  reason: MatchEndReason;
  scores: { p1: number; p2: number };
  rounds: RoundRecord[];
  players: { p1: PlayerPort; p2: PlayerPort };
}

export interface SeatSettlement {
  eloDelta: number;
  coinsDelta: number;
  newElo: number;
  newCoins: number;
}

export interface MatchEngineOpts {
  matchId: string;
  mode: MatchMode;
  wager: number;
  p1: PlayerPort;
  p2: PlayerPort;
  /** Persist + settle; returns per-seat deltas the engine relays in match:end. */
  onEnd: (result: MatchResult) => { p1: SeatSettlement; p2: SeatSettlement };
  rng?: () => number;
}

const AFK_TIMEOUT_LIMIT = 2;

type Phase = 'choosing' | 'reveal' | 'ended';

export class MatchEngine {
  readonly matchId: string;
  readonly mode: MatchMode;
  readonly wager: number;

  private p1: PlayerPort;
  private p2: PlayerPort;
  private onEnd: MatchEngineOpts['onEnd'];
  private rng: () => number;

  private phase: Phase = 'choosing';
  private roundNo = 1;
  private seq = 0;
  private scores = { p1: 0, p2: 0 };
  private moves: { p1?: Move; p2?: Move } = {};
  private consecutiveTimeouts = { p1: 0, p2: 0 };
  private rounds: RoundRecord[] = [];
  private deadline: number | null = null;

  private firstRoundPending = true;
  private roundTimer: ReturnType<typeof setTimeout> | null = null;
  private revealTimer: ReturnType<typeof setTimeout> | null = null;
  private graceTimers: { p1?: ReturnType<typeof setTimeout>; p2?: ReturnType<typeof setTimeout> } = {};
  private disconnected: { p1: boolean; p2: boolean } = { p1: false, p2: false };

  constructor(opts: MatchEngineOpts) {
    this.matchId = opts.matchId;
    this.mode = opts.mode;
    this.wager = opts.wager;
    this.p1 = opts.p1;
    this.p2 = opts.p2;
    this.onEnd = opts.onEnd;
    this.rng = opts.rng ?? Math.random;
  }

  get ended(): boolean {
    return this.phase === 'ended';
  }

  hasPlayer(userId: number): boolean {
    return this.p1.userId === userId || this.p2.userId === userId;
  }

  portFor(userId: number): PlayerPort | undefined {
    if (this.p1.userId === userId) return this.p1;
    if (this.p2.userId === userId) return this.p2;
    return undefined;
  }

  opponentOf(userId: number): PlayerPort | undefined {
    if (this.p1.userId === userId) return this.p2;
    if (this.p2.userId === userId) return this.p1;
    return undefined;
  }

  private seatOf(userId: number): Seat | undefined {
    if (this.p1.userId === userId) return 'p1';
    if (this.p2.userId === userId) return 'p2';
    return undefined;
  }

  start(): void {
    this.p1.send('match:start', {
      matchId: this.matchId,
      mode: this.mode,
      wager: this.wager,
      opponent: this.p2.info,
      seat: 'p1',
    });
    this.p2.send('match:start', {
      matchId: this.matchId,
      mode: this.mode,
      wager: this.wager,
      opponent: this.p1.info,
      seat: 'p2',
    });
    this.startRound();
  }

  private startRound(): void {
    if (this.phase === 'ended') return;
    this.phase = 'choosing';
    this.moves = {};
    // The opening round absorbs the match-found moment on clients.
    const roundTime = ROUND_TIME_MS + (this.firstRoundPending ? FIRST_ROUND_EXTRA_MS : 0);
    this.firstRoundPending = false;
    this.deadline = Date.now() + roundTime;
    const payload = {
      matchId: this.matchId,
      roundNo: this.roundNo,
      deadline: this.deadline,
      scores: { ...this.scores },
    };
    this.p1.send('round:start', payload);
    this.p2.send('round:start', payload);
    this.roundTimer = setTimeout(() => this.onRoundTimeout(), roundTime);
  }

  submitMove(userId: number, move: Move): { ok: boolean; error?: string } {
    const seat = this.seatOf(userId);
    if (!seat) return { ok: false, error: 'Not in this match' };
    if (this.phase !== 'choosing') return { ok: false, error: 'Round is not accepting moves' };
    if (this.moves[seat]) return { ok: false, error: 'Move already submitted' };
    this.moves[seat] = move;
    this.consecutiveTimeouts[seat] = 0;
    if (this.moves.p1 && this.moves.p2) {
      if (this.roundTimer) clearTimeout(this.roundTimer);
      this.roundTimer = null;
      this.reveal();
    }
    return { ok: true };
  }

  private onRoundTimeout(): void {
    if (this.phase !== 'choosing') return;
    this.roundTimer = null;
    const afk: Seat[] = [];
    for (const seat of ['p1', 'p2'] as const) {
      if (!this.moves[seat]) {
        this.moves[seat] = randomMove(this.rng);
        // Disconnected seats are the grace timer's problem, not AFK's.
        if (this.disconnected[seat]) continue;
        this.consecutiveTimeouts[seat] += 1;
        if (this.consecutiveTimeouts[seat] >= AFK_TIMEOUT_LIMIT) afk.push(seat);
      }
    }
    if (afk.length === 2) {
      this.end(null, 'forfeit');
      return;
    }
    if (afk.length === 1) {
      this.end(afk[0] === 'p1' ? 'p2' : 'p1', 'forfeit');
      return;
    }
    this.reveal();
  }

  private reveal(): void {
    this.phase = 'reveal';
    this.deadline = null;
    this.seq += 1;
    const p1Move = this.moves.p1!;
    const p2Move = this.moves.p2!;
    const p1Outcome = beats(p1Move, p2Move);
    const winner: Seat | 'draw' =
      p1Outcome === 'draw' ? 'draw' : p1Outcome === 'win' ? 'p1' : 'p2';
    if (winner !== 'draw') this.scores[winner] += 1;
    this.rounds.push({ roundNo: this.roundNo, seq: this.seq, p1Move, p2Move, winner });

    this.p1.send('round:result', {
      matchId: this.matchId,
      roundNo: this.roundNo,
      yourMove: p1Move,
      oppMove: p2Move,
      outcome: p1Outcome,
      scores: { ...this.scores },
    });
    this.p2.send('round:result', {
      matchId: this.matchId,
      roundNo: this.roundNo,
      yourMove: p2Move,
      oppMove: p1Move,
      outcome: beats(p2Move, p1Move),
      scores: { ...this.scores },
    });

    const matchOver = this.scores.p1 >= ROUNDS_TO_WIN || this.scores.p2 >= ROUNDS_TO_WIN;
    if (winner !== 'draw' && !matchOver) this.roundNo += 1;

    this.revealTimer = setTimeout(() => {
      this.revealTimer = null;
      if (matchOver) {
        this.end(this.scores.p1 >= ROUNDS_TO_WIN ? 'p1' : 'p2', 'score');
      } else {
        this.startRound();
      }
    }, REVEAL_TIME_MS);
  }

  forfeit(userId: number): void {
    const seat = this.seatOf(userId);
    if (!seat || this.phase === 'ended') return;
    this.end(seat === 'p1' ? 'p2' : 'p1', 'forfeit');
  }

  playerDisconnected(userId: number): void {
    const seat = this.seatOf(userId);
    if (!seat || this.phase === 'ended') return;
    this.disconnected[seat] = true;
    this.graceTimers[seat] = setTimeout(() => {
      this.end(seat === 'p1' ? 'p2' : 'p1', 'disconnect');
    }, DISCONNECT_GRACE_MS);
  }

  playerReconnected(userId: number, port: PlayerPort): void {
    const seat = this.seatOf(userId);
    if (!seat || this.phase === 'ended') return;
    const timer = this.graceTimers[seat];
    if (timer) clearTimeout(timer);
    this.graceTimers[seat] = undefined;
    this.disconnected[seat] = false;
    if (seat === 'p1') this.p1 = port;
    else this.p2 = port;
    port.send('match:state', this.snapshotFor(userId)!);
  }

  snapshotFor(userId: number): MatchStatePayload | null {
    const seat = this.seatOf(userId);
    if (!seat || this.phase === 'ended') return null;
    const opponent = seat === 'p1' ? this.p2 : this.p1;
    return {
      matchId: this.matchId,
      mode: this.mode,
      wager: this.wager,
      opponent: opponent.info,
      seat,
      roundNo: this.roundNo,
      deadline: this.phase === 'choosing' ? this.deadline : null,
      scores: { ...this.scores },
      youMoved: this.moves[seat] !== undefined,
    };
  }

  private clearAllTimers(): void {
    for (const t of [this.roundTimer, this.revealTimer, this.graceTimers.p1, this.graceTimers.p2]) {
      if (t) clearTimeout(t);
    }
    this.roundTimer = null;
    this.revealTimer = null;
    this.graceTimers = {};
  }

  private end(winnerSeat: Seat | null, reason: MatchEndReason): void {
    if (this.phase === 'ended') return;
    this.phase = 'ended';
    this.clearAllTimers();

    const result: MatchResult = {
      matchId: this.matchId,
      mode: this.mode,
      wager: this.wager,
      winnerSeat,
      reason,
      scores: { ...this.scores },
      rounds: this.rounds,
      players: { p1: this.p1, p2: this.p2 },
    };
    const settlement = this.onEnd(result);

    for (const seat of ['p1', 'p2'] as const) {
      const port = seat === 'p1' ? this.p1 : this.p2;
      const s = settlement[seat];
      port.send('match:end', {
        matchId: this.matchId,
        youWon: winnerSeat === seat,
        reason,
        scores: { ...this.scores },
        eloDelta: s.eloDelta,
        coinsDelta: s.coinsDelta,
        newElo: s.newElo,
        newCoins: s.newCoins,
      });
    }
  }
}
