import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { pool } from '../db.js';
import { setAuthCookie, clearAuthCookie, requireAuth } from '../middleware/auth.js';

const router = Router();
const COST = 12;
// Lets a login for an unknown email take as long as a real one (no timing leak)
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', COST);

const email = z.string().trim().toLowerCase().email('Enter a valid email.').max(254);
// bcrypt only uses the first 72 bytes, so cap there
const password = z.string().min(8, 'Use at least 8 characters.').max(72, 'Use 72 characters or fewer.');

const signupSchema = z.object({ name: z.string().trim().min(1, 'Enter your name.').max(80), email, password });
const loginSchema = z.object({ email, password: z.string().min(1).max(72) });

const publicUser = (u) => ({ id: u.id, name: u.name, email: u.email });
const firstError = (err) => err.issues?.[0]?.message || 'Check your details and try again.';

router.post('/signup', async (req, res) => {
  const parsed = signupSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: firstError(parsed.error) });
  const { name, email, password } = parsed.data;

  const hash = await bcrypt.hash(password, COST);
  try {
    const { rows } = await pool.query(
      'INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3) RETURNING id, name, email',
      [name, email, hash]
    );
    setAuthCookie(res, rows[0].id);
    res.status(201).json({ user: publicUser(rows[0]) });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'An account with this email already exists.' });
    throw err;
  }
});

router.post('/login', async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Enter your email and password.' });
  const { email, password } = parsed.data;

  const { rows } = await pool.query('SELECT id, name, email, password_hash FROM users WHERE email = $1', [email]);
  const user = rows[0];
  const ok = await bcrypt.compare(password, user ? user.password_hash : DUMMY_HASH);
  if (!user || !ok) return res.status(401).json({ error: 'Incorrect email or password.' });

  setAuthCookie(res, user.id);
  res.json({ user: publicUser(user) });
});

router.post('/logout', (req, res) => {
  clearAuthCookie(res);
  res.json({ ok: true });
});

router.get('/me', requireAuth, async (req, res) => {
  const { rows } = await pool.query('SELECT id, name, email FROM users WHERE id = $1', [req.userId]);
  if (!rows[0]) {
    clearAuthCookie(res);
    return res.status(401).json({ error: 'Please log in.' });
  }
  res.json({ user: publicUser(rows[0]) });
});

export default router;
