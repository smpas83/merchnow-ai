import express from 'express';
const { Router, Request, Response, NextFunction } = express;
import jwt from 'jsonwebtoken';
import { v4 as uuid } from 'uuid';
import { execute } from '../db/index.js';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'merchnow-dev-secret-change-in-production';

interface AuthRequest extends Request {
  user?: { userId: string; role: string };
}

function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  const header = (req.headers as any)['authorization'];
  if (!header || !header.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const token = header.substring(7);
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    req.user = decoded;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// GET /api/tasks/job/:jobId
router.get('/job/:jobId', authMiddleware, (req: AuthRequest, res: Response) => {
  const result = execute('SELECT * FROM tasks WHERE job_id = ? ORDER BY order_index', req.params.jobId);
  res.json(result.rows || []);
});

// GET /api/tasks/:taskId
router.get('/:taskId', authMiddleware, (req: AuthRequest, res: Response) => {
  const result = execute('SELECT * FROM tasks WHERE id = ?', req.params.taskId);
  const task = result.rows?.[0];
  if (!task) return res.status(404).json({ error: 'Task not found' });
  const results = execute('SELECT * FROM task_results WHERE task_id = ? ORDER BY created_at DESC', task.id).rows;
  res.json({ ...task, results });
});

// POST /api/tasks/complete/:taskId
router.post('/complete/:taskId', authMiddleware, (req: AuthRequest, res: Response) => {
  const { notes } = req.body || {};
  const idempotencyKey = (req.headers as any)['x-idempotency-key'] as string | undefined;
  const taskResult = execute('SELECT * FROM tasks WHERE id = ?', req.params.taskId);
  const task = taskResult.rows?.[0];
  if (!task) return res.status(404).json({ error: 'Task not found' });

  // Idempotency: if we have a key, check for existing result
  if (idempotencyKey) {
    const existing = execute('SELECT * FROM task_results WHERE task_id = ? AND notes = ? LIMIT 1', task.id, idempotencyKey);
    if (existing.rows?.length) {
      return res.status(200).json({ id: existing.rows[0].id, taskId: task.id, status: 'completed', idempotencyReplay: true });
    }
  }

  const id = uuid();
  const now = new Date().toISOString();
  execute('INSERT INTO task_results (id, task_id, job_id, worker_id, status, completed_at, notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    id, task.id, task.job_id, req.user!.userId, 'completed', now, notes || null, now, now);
  res.status(201).json({ id, taskId: task.id, status: 'completed' });
});

// POST /api/tasks/:taskId/start
router.post('/:taskId/start', authMiddleware, (req: AuthRequest, res: Response) => {
  const taskResult = execute('SELECT * FROM tasks WHERE id = ?', req.params.taskId);
  const task = taskResult.rows?.[0];
  if (!task) return res.status(404).json({ error: 'Task not found' });
  const now = new Date().toISOString();
  execute('UPDATE tasks SET started_at = ? WHERE id = ?', now, task.id);
  execute('INSERT INTO task_results (id, task_id, job_id, worker_id, status, started_at, notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    uuid(), task.id, task.job_id, req.user!.userId, 'in_progress', now, null, now, now);
  res.json({ status: 'in_progress', taskId: task.id });
});

// POST /api/tasks/:taskId/results - submit task result with proof
router.post('/:taskId/results', authMiddleware, (req: AuthRequest, res: Response) => {
  const { status, notes, proofType, caption, latitude, longitude } = req.body || {};
  const taskResult = execute('SELECT * FROM tasks WHERE id = ?', req.params.taskId);
  const task = taskResult.rows?.[0];
  if (!task) return res.status(404).json({ error: 'Task not found' });
  const now = new Date().toISOString();
  const resultStatus = status || 'completed';
  const resultId = uuid();
  execute('INSERT INTO task_results (id, task_id, job_id, worker_id, status, completed_at, notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    resultId, task.id, task.job_id, req.user!.userId, resultStatus, now, notes || null, now, now);
  // Upload proof asset if proof type provided
  if (proofType) {
    execute('INSERT INTO proof_assets (id, job_id, task_id, worker_id, type, caption, latitude, longitude, file_url, uploaded_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      uuid(), task.job_id, task.id, req.user!.userId, proofType, caption || null, latitude || null, longitude || null, null, now);
  }
  res.status(201).json({ id: resultId, taskId: task.id, status: resultStatus });
});

export default router;
