import { openDb } from './db/db';
import { createServer } from './server';
import { config } from './config';

// Last line of defense: a single bad socket frame or handler bug must never
// take the whole game down. Log and stay up rather than crash every match.
process.on('uncaughtException', (err) => {
  console.error('uncaughtException:', err);
});
process.on('unhandledRejection', (reason) => {
  console.error('unhandledRejection:', reason);
});

const db = openDb(config.dbPath);
const server = createServer(db, { webDist: config.webDist });

server.listen(config.port).then((port) => {
  console.log(`RPS server listening on http://0.0.0.0:${port}`);
  console.log(`Web app: run 'npm run build:web' once, then it's served right here.`);
});
