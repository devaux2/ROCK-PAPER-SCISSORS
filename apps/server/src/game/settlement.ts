import { eloUpdate } from '@rps/shared';
import type { AppContext } from '../context';
import type { MatchResult, SeatSettlement } from './MatchEngine';
import { BOT_USER_ID } from './bot';

/**
 * Persist a finished match and settle coins + Elo in one SQLite transaction.
 * Coin deltas are reported relative to the pre-escrow balance (winner +wager,
 * loser -wager, aborted 0 after refund).
 */
export function settleMatch(ctx: AppContext, result: MatchResult): { p1: SeatSettlement; p2: SeatSettlement } {
  const run = ctx.db.transaction(() => {
    const { p1, p2 } = result.players;
    const isBot = result.mode === 'bot';
    const winnerId =
      result.winnerSeat === null
        ? null
        : result.winnerSeat === 'p1'
          ? p1.userId
          : p2.userId;

    ctx.matches.complete(
      result.matchId,
      winnerId === BOT_USER_ID ? null : winnerId,
      result.reason,
      result.scores.p1,
      result.scores.p2,
      result.rounds.map((r) => ({
        roundNo: r.roundNo,
        seq: r.seq,
        p1Move: r.p1Move,
        p2Move: r.p2Move,
        winner: r.winner,
      }))
    );

    const settlement: { p1: SeatSettlement; p2: SeatSettlement } = {
      p1: blankFor(ctx, p1.userId),
      p2: blankFor(ctx, p2.userId),
    };

    if (result.winnerSeat !== null && !isBot) {
      const winner = result.winnerSeat === 'p1' ? p1 : p2;
      const loser = result.winnerSeat === 'p1' ? p2 : p1;
      ctx.matches.recordResult(winner.userId, loser.userId);

      if (result.mode === 'ranked') {
        // Both wagers were escrowed up front; winner takes the pot.
        ctx.transactions.apply(winner.userId, result.wager * 2, 'payout', result.matchId);

        const winnerRow = ctx.users.byId(winner.userId)!;
        const loserRow = ctx.users.byId(loser.userId)!;
        const elo = eloUpdate(winnerRow.elo, loserRow.elo);
        ctx.matches.updateElo(winner.userId, result.matchId, elo.winnerDelta, elo.winnerNew);
        ctx.matches.updateElo(loser.userId, result.matchId, elo.loserDelta, elo.loserNew);

        settlement[result.winnerSeat] = {
          eloDelta: elo.winnerDelta,
          coinsDelta: result.wager,
          newElo: elo.winnerNew,
          newCoins: ctx.users.byId(winner.userId)!.coins,
        };
        const loserSeat = result.winnerSeat === 'p1' ? 'p2' : 'p1';
        settlement[loserSeat] = {
          eloDelta: elo.loserDelta,
          coinsDelta: -result.wager,
          newElo: elo.loserNew,
          newCoins: loserRow.coins,
        };
      } else {
        settlement.p1 = blankFor(ctx, p1.userId);
        settlement.p2 = blankFor(ctx, p2.userId);
      }
    } else if (result.winnerSeat === null && result.mode === 'ranked') {
      // Double-AFK abort: return both escrowed wagers.
      ctx.transactions.apply(p1.userId, result.wager, 'wager_refund', result.matchId);
      ctx.transactions.apply(p2.userId, result.wager, 'wager_refund', result.matchId);
      settlement.p1 = blankFor(ctx, p1.userId);
      settlement.p2 = blankFor(ctx, p2.userId);
    }

    return settlement;
  });
  return run();
}

function blankFor(ctx: AppContext, userId: number): SeatSettlement {
  const row = userId === BOT_USER_ID ? undefined : ctx.users.byId(userId);
  return {
    eloDelta: 0,
    coinsDelta: 0,
    newElo: row?.elo ?? 0,
    newCoins: row?.coins ?? 0,
  };
}
