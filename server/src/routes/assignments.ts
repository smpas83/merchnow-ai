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

router.get('/:id/reject', authMiddleware, (req: AuthRequest, res: Response) => {
  try {
    const { reason } = req.body;
    const result = execute('SELECT * FROM job_assignments WHERE id = ? AND worker_id = ? AND status = ?', req.params.id, req.user!.userId, 'accepted');
    const assignment = result.rows?.[0] as any;
    if (!assignment) return res.status(404).json({ error: 'Assignment not found' });
    const now = new Date().toISOString();
    execute('UPDATE job_assignments SET status = ?, reject_reason = ?, updated_at = ? WHERE id = ?', 'rejected', reason || null, now, assignment.id);
    execute('INSERT INTO job_events (id, job_id, event_type, from_status, to_status, actor_id, actor_type, metadata, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      uuid(), assignment.job_id, 'job_rejected', 'accepted', 'rejected', req.user!.userId, 'worker', JSON.stringify({ reason }), now);
    res.json({ status: 'rejected' });
  } catch (error: any) { res.status(400).json({ error: error.message }); }
});

export default router;
