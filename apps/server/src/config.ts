export const config = {
  port: Number(process.env.PORT ?? 3001),
  jwtSecret: process.env.JWT_SECRET ?? 'dev-secret-change-in-production',
  jwtExpiry: '7d',
  dbPath: process.env.DB_PATH ?? new URL('../data/rps.db', import.meta.url).pathname,
  /** Matchmaking: starting Elo tolerance and its growth while waiting. */
  mmBaseTolerance: 100,
  mmToleranceStepPer3s: 50,
  mmTickMs: 1000,
};
