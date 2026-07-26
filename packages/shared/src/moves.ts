/**
 * The abstract game mechanic. Skins map A/B/C to themed names
 * (Rock/Paper/Scissors, Kick/Block/Punch, ...) — game logic, the server,
 * and the wire protocol only ever deal in A/B/C.
 *
 * Cycle: A beats C, C beats B, B beats A.
 */
export const MOVES = ['A', 'B', 'C'] as const;
export type Move = (typeof MOVES)[number];

export type RoundOutcome = 'win' | 'lose' | 'draw';

const BEATS: Record<Move, Move> = { A: 'C', C: 'B', B: 'A' };

/** Outcome of `mine` vs `theirs` from mine's perspective. */
export function beats(mine: Move, theirs: Move): RoundOutcome {
  if (mine === theirs) return 'draw';
  return BEATS[mine] === theirs ? 'win' : 'lose';
}

export function isMove(value: unknown): value is Move {
  return typeof value === 'string' && (MOVES as readonly string[]).includes(value);
}

export function randomMove(rng: () => number = Math.random): Move {
  const idx = Math.floor(rng() * MOVES.length) % MOVES.length;
  return MOVES[idx]!;
}

/**
 * Round wins needed to take a match. 1 = sudden death: one throw decides
 * it, and drawn throws replay until someone lands a hit.
 */
export const ROUNDS_TO_WIN = 1;
