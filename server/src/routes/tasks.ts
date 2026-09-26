import express from 'express';
import type { Request, Response, NextFunction } from 'express';
const { Router } = express;
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

// ---- Idempotency support ----

interface IdempotencyRow {
  id: string;
  key: string;
  user_id: string;
  operation: string;
  resource_id: string | null;
  request_hash: string | null;
  response_status: number | null;
  response_body: string | null;
  created_at: string;
  updated_at: string;
}

function computeHash(data: string): string {
  let h = 0;
  for (let i = 0; i < data.length; i++) {
    const c = data.charCodeAt(i);
    h = ((h << 5) - h) + c;
    h = h & h;
  }
  return Math.abs(h).toString(36);
}

function lookupIdempotencyKey(key: string): IdempotencyRow | null {
  const rows = execute('SELECT * FROM idempotency_keys WHERE key = ?', key).rows as IdempotencyRow[] | undefined;
  return rows?.[0] ?? null;
}

function insertIdempotencyKey(key: string, userId: string, operation: string, resourceId: string | null, requestHash: string): { claimed: boolean } {
  const now = new Date().toISOString();
  const result = execute(
    'INSERT OR IGNORE INTO idempotency_keys (id, key, user_id, operation, resource_id, request_hash, response_status, response_body, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, NULL, NULL, ?, ?)',
    uuid(), key, userId, operation, resourceId, requestHash, now, now
  );
  return { claimed: result.changes > 0 };
}

function updateIdempotencyResponse(key: string, status: number, body: object): void {
  const now = new Date().toISOString();
  execute(
    `UPDATE idempotency_keys SET response_status = ?, response_body = ?, updated_at = ? WHERE key = ? AND (response_status IS NULL OR response_status >= 400)`,
    status, JSON.stringify(body), now, key
  );
}

function handleIdempotency(
  key: string | undefined,
  userId: string,
  operation: string,
  resourceId: string | null,
  requestBody: string,
): { replay: boolean; existingResponse?: { status: number; body: object }; conflict?: boolean } {
  if (!key) return { replay: false };

  const requestHash = computeHash(requestBody);

  const claimed = insertIdempotencyKey(key, userId, operation, resourceId, requestHash);
  if (claimed.claimed) return { replay: false };

  const existing = lookupIdempotencyKey(key);
  if (!existing) return { replay: false };

  if (existing.user_id !== userId) {
    updateIdempotencyResponse(key, 409, { error: 'Idempotency key reused by different user' });
    return { replay: false, conflict: true };
  }

  if (existing.request_hash && existing.request_hash !== requestHash) {
    updateIdempotencyResponse(key, 409, { error: 'Idempotency key conflict: request payload differs' });
    return { replay: false, conflict: true };
  }

  if (existing.response_status != null && existing.response_body != null) {
    return { replay: true, existingResponse: { status: existing.response_status, body: JSON.parse(existing.response_body) } };
  }

  return { replay: false };
}

function recordIdempotencyResult(key: string | undefined, status: number, body: object): void {
  if (key) updateIdempotencyResponse(key, status, body);
}

// ---- Routes ----

router.get('/job/:jobId', authMiddleware, (req: AuthRequest, res: Response) => {
  const result = execute('SELECT * FROM tasks WHERE job_id = ? ORDER BY order_index', req.params.jobId);
  res.json(result.rows || []);
});

router.get('/:taskId', authMiddleware, (req: AuthRequest, res: Response) => {
  const result = execute('SELECT * FROM tasks WHERE id = ?', req.params.taskId);
  const task = result.rows?.[0];
  if (!task) return res.status(404).json({ error: 'Task not found' });
  const results = execute('SELECT * FROM task_results WHERE task_id = ? ORDER BY created_at DESC', task.id).rows;
  res.json({ ...task, results });
});

// POST /api/tasks/complete/:taskId — with idempotency
router.post('/complete/:taskId', authMiddleware, (req: AuthRequest, res: Response) => {
  const { notes } = req.body || {};
  const idempotencyKey = (req.headers as any)['x-idempotency-key'] as string | undefined;

  const taskResult = execute('SELECT * FROM tasks WHERE id = ?', req.params.taskId);
  const task = taskResult.rows?.[0];
  if (!task) return res.status(404).json({ error: 'Task not found' });

  const reqBody = JSON.stringify({ notes });
  const idem = handleIdempotency(idempotencyKey, req.user!.userId, 'task_complete', task.id, reqBody);

  if (idem.conflict) {
    return res.status(409).json({ error: 'Idempotency key conflict: request payload differs' });
  }

  if (idem.replay && idem.existingResponse) {
    const replayBody = { ...idem.existingResponse.body, idempotencyReplay: true };
    return res.status(idem.existingResponse.status).json(replayBody);
  }

  const resultId = uuid();
  const now = new Date().toISOString();
  execute('INSERT INTO task_results (id, task_id, job_id, worker_id, status, completed_at, notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    resultId, task.id, task.job_id, req.user!.userId, 'completed', now, notes || null, now, now);

  const responseBody = { id: resultId, taskId: task.id, status: 'completed' };
  recordIdempotencyResult(idempotencyKey, 201, responseBody);
  res.status(201).json(responseBody);
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
  const idempotencyKey = (req.headers as any)['x-idempotency-key'] as string | undefined;

  const taskResult = execute('SELECT * FROM tasks WHERE id = ?', req.params.taskId);
  const task = taskResult.rows?.[0];
  if (!task) return res.status(404).json({ error: 'Task not found' });

  const reqBody = JSON.stringify({ status, notes, proofType, caption, latitude, longitude });
  const idem = handleIdempotency(idempotencyKey, req.user!.userId, 'task_result', task.id, reqBody);

  if (idem.conflict) {
    return res.status(409).json({ error: 'Idempotency key conflict: request payload differs' });
  }

  if (idem.replay && idem.existingResponse) {
    const replayBody = { ...idem.existingResponse.body, idempotencyReplay: true };
    return res.status(idem.existingResponse.status).json(replayBody);
  }

  const now = new Date().toISOString();
  const resultStatus = status || 'completed';
  const resultId = uuid();
  execute('INSERT INTO task_results (id, task_id, job_id, worker_id, status, completed_at, notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    resultId, task.id, task.job_id, req.user!.userId, resultStatus, now, notes || null, now, now);

  if (proofType) {
    execute('INSERT INTO proof_assets (id, job_id, task_id, worker_id, type, caption, latitude, longitude, file_url, uploaded_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      uuid(), task.job_id, task.id, req.user!.userId, proofType, caption || null, latitude || null, longitude || null, null, now);
  }

  const responseBody = { id: resultId, taskId: task.id, status: resultStatus };
  recordIdempotencyResult(idempotencyKey, 201, responseBody);
  res.status(201).json(responseBody);
});

export default router;
