import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

// NOTE ON PRODUCTION SWAP:
// This module is the ONLY place that needs to change to move from the
// zero-setup SQLite demo to production Postgres. Replace `better-sqlite3`
// with `pg` (node-postgres), point DATABASE_URL at your Postgres instance,
// and run docs/DATABASE_SCHEMA.md against it. All routes/services call
// db.prepare(...).get/.all/.run — swap those for a thin query wrapper with
// the same method names to avoid touching business logic.

const dataDir = path.join(__dirname, '..', '..', 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const dbPath = process.env.SQLITE_PATH || path.join(dataDir, 'bi_dashboard.db');
export const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

export function initSchema(): void {
  const schemaPath = path.join(__dirname, 'schema.sql');
  const schema = fs.readFileSync(schemaPath, 'utf-8');
  db.exec(schema);
}

initSchema();
