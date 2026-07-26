/** Street-rank title earned by total wins. */
export function rankTitle(wins: number): string {
  if (wins >= 100) return 'Legend';
  if (wins >= 50) return 'Shark';
  if (wins >= 25) return 'Hustler';
  if (wins >= 10) return 'Contender';
  return 'Rookie';
}
