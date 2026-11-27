import { pool, migrate } from './db.js';

await migrate();
console.log(`Database ready (${pool.label}).`);
await pool.end();
