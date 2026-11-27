import 'dotenv/config';
import pg from 'pg';
import { readFileSync } from 'node:fs';

// Return DATE columns as plain 'YYYY-MM-DD' strings (no timezone shifting)
pg.types.setTypeParser(1082, (v) => v);

const schema = readFileSync(new URL('../schema.sql', import.meta.url), 'utf8');

let impl;
if (process.env.DATABASE_URL) {
  // Real PostgreSQL
  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.PGSSL === 'true' ? { rejectUnauthorized: false } : undefined,
    max: 10,
  });
  impl = {
    label: 'PostgreSQL',
    embedded: false,
    query: (text, params) => pool.query(text, params),
    exec: (sql) => pool.query(sql),
    end: () => pool.end(),
  };
} else {
  // No DATABASE_URL: use PGlite, a real Postgres engine that runs inside Node.
  // Great for local testing, nothing to install. Data is saved in ./.pglite-data
  const { PGlite } = await import('@electric-sql/pglite');
  const db = new PGlite(process.env.PGLITE_DIR || './.pglite-data', { parsers: { 1082: (v) => v } });
  await db.waitReady;
  impl = {
    label: 'embedded Postgres (PGlite)',
    embedded: true,
    query: async (text, params) => {
      const r = await db.query(text, params);
      return { rows: r.rows, rowCount: r.affectedRows ?? r.rows.length };
    },
    exec: (sql) => db.exec(sql),
    end: () => db.close(),
  };
}

// Same name the routes already import
export const pool = impl;
export const migrate = () => impl.exec(schema);
