import { Router } from 'express';
import { pool } from '../db.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// Teammates for the "Owner" dropdown. Never returns emails or hashes.
router.get('/', requireAuth, async (req, res) => {
  const { rows } = await pool.query('SELECT id, name FROM users ORDER BY name');
  res.json({ users: rows });
});

export default router;
