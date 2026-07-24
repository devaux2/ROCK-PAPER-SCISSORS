export const ELO_K = 32;
export const ELO_START = 1000;

/** Probability that `rating` beats `opponent`. */
export function expectedScore(rating: number, opponent: number): number {
  return 1 / (1 + Math.pow(10, (opponent - rating) / 400));
}

export interface EloResult {
  winnerDelta: number;
  loserDelta: number;
  winnerNew: number;
  loserNew: number;
}

/** Symmetric Elo update for a decisive match (no draws at match level). */
export function eloUpdate(winnerRating: number, loserRating: number, k = ELO_K): EloResult {
  const delta = Math.round(k * (1 - expectedScore(winnerRating, loserRating)));
  return {
    winnerDelta: delta,
    loserDelta: -delta,
    winnerNew: winnerRating + delta,
    loserNew: loserRating - delta,
  };
}
