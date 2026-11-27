import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../db.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

const SELECT = `
  SELECT a.id, a.title, a.description, a.status,
         a.due_date   AS "dueDate",
         a.owner_id   AS "ownerId",
         a.created_by AS "createdBy",
         u.name       AS "ownerName",
         a.created_at AS "createdAt",
         a.updated_at AS "updatedAt"
  FROM actionables a
  LEFT JOIN users u ON u.id = a.owner_id
`;

const idSchema = z.string().uuid();
const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a valid date.')
  .refine((d) => !Number.isNaN(Date.parse(d)), 'Use a valid date.');

const title = z.string().trim().min(1, 'Enter a title.').max(200);
const description = z.string().trim().max(2000, 'Description is too long.');
const ownerId = z.string().uuid().nullable();
const status = z.enum(['open', 'in_progress', 'done']);

const createSchema = z.object({
  title,
  description: description.optional(),
  ownerId: ownerId.optional(),
  dueDate: date.nullable().optional(),
});
const updateSchema = z
  .object({
    title: title.optional(),
    description: description.optional(),
    ownerId: ownerId.optional(),
    dueDate: date.nullable().optional(),
    status: status.optional(),
  })
  .strict();

// Column names come only from this allow-list; values are always parameterised
const COLUMNS = { title: 'title', description: 'description', ownerId: 'owner_id', dueDate: 'due_date', status: 'status' };

const badRequest = (res, err) => res.status(400).json({ error: err.issues?.[0]?.message || 'Invalid request.' });
const notFound = (res) => res.status(404).json({ error: 'Not found.' });

async function findOne(id) {
  const { rows } = await pool.query(`${SELECT} WHERE a.id = $1 AND a.deleted_at IS NULL`, [id]);
  return rows[0];
}

router.get('/', async (req, res) => {
  const { rows } = await pool.query(
    `${SELECT} WHERE a.deleted_at IS NULL
     ORDER BY (a.status = 'done'), a.due_date NULLS LAST, a.created_at DESC`
  );
  res.json({ actionables: rows });
});

router.post('/', async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return badRequest(res, parsed.error);
  const { title, description = '', ownerId = null, dueDate = null } = parsed.data;

  try {
    const { rows } = await pool.query(
      `INSERT INTO actionables (title, description, owner_id, due_date, created_by)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [title, description, ownerId, dueDate, req.userId]
    );
    res.status(201).json({ actionable: await findOne(rows[0].id) });
  } catch (err) {
    if (err.code === '23503') return res.status(400).json({ error: 'That owner does not exist.' });
    throw err;
  }
});

router.patch('/:id', async (req, res) => {
  if (!idSchema.safeParse(req.params.id).success) return notFound(res);
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) return badRequest(res, parsed.error);

  const sets = [];
  const values = [];
  for (const [key, value] of Object.entries(parsed.data)) {
    values.push(value);
    sets.push(`${COLUMNS[key]} = $${values.length}`);
  }
  if (!sets.length) return res.status(400).json({ error: 'Nothing to update.' });
  values.push(req.params.id, req.userId);

  // The creator can change anything. The owner (assignee) can change the status only,
  // because they are the one doing the task.
  const statusOnly = Object.keys(parsed.data).every((k) => k === 'status');
  const who = statusOnly ? '(created_by = $U OR owner_id = $U)' : 'created_by = $U';

  try {
    const { rowCount } = await pool.query(
      `UPDATE actionables SET ${sets.join(', ')}, updated_at = now()
       WHERE id = $${values.length - 1} AND ${who.replaceAll('$U', `$${values.length}`)} AND deleted_at IS NULL`,
      values
    );
    if (!rowCount) {
      if (!(await findOne(req.params.id))) return notFound(res);
      return res.status(403).json({ error: 'Only the creator can edit this actionable. Its owner can update the status.' });
    }
  } catch (err) {
    if (err.code === '23503') return res.status(400).json({ error: 'That owner does not exist.' });
    throw err;
  }
  res.json({ actionable: await findOne(req.params.id) });
});

// Soft delete so "Undo" can bring it back.
// Only the user who created an actionable may delete it.
router.delete('/:id', async (req, res) => {
  if (!idSchema.safeParse(req.params.id).success) return notFound(res);
  const { rowCount } = await pool.query(
    'UPDATE actionables SET deleted_at = now() WHERE id = $1 AND created_by = $2 AND deleted_at IS NULL',
    [req.params.id, req.userId]
  );
  if (rowCount) return res.json({ ok: true });

  // Nothing deleted: either it doesn't exist, or it belongs to someone else
  const exists = await findOne(req.params.id);
  if (!exists) return notFound(res);
  res.status(403).json({ error: 'Only the person who created this actionable can delete it.' });
});

router.post('/:id/restore', async (req, res) => {
  if (!idSchema.safeParse(req.params.id).success) return notFound(res);
  const { rowCount } = await pool.query(
    `UPDATE actionables SET deleted_at = NULL
     WHERE id = $1 AND created_by = $2 AND deleted_at > now() - interval '1 hour'`,
    [req.params.id, req.userId]
  );
  if (!rowCount) return notFound(res);
  res.json({ actionable: await findOne(req.params.id) });
});

export default router;
