import { Router, Request, Response, NextFunction } from 'express';
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

// POST /api/checkins/job/:jobId
router.post('/job/:jobId', authMiddleware, (req: AuthRequest, res: Response) => {
  try {
    const { latitude, longitude, accuracy, locationNote } = req.body || {};
    if (latitude === undefined || longitude === undefined) return res.status(400).json({ error: 'Latitude and longitude required' });
    const jobResult = execute('SELECT * FROM jobs WHERE id = ?', req.params.jobId);
    const job = jobResult.rows?.[0];
    if (!job) return res.status(404).json({ error: 'Job not found' });
    const assignment = execute('SELECT * FROM job_assignments WHERE job_id = ? AND worker_id = ? AND status = ?', req.params.jobId, req.user!.userId, 'accepted');
    if (!assignment.rows?.length) return res.status(403).json({ error: 'No accepted assignment for this job' });
    const id = uuid();
    const now = new Date().toISOString();
    execute('INSERT INTO check_ins (id, job_id, worker_id, latitude, longitude, accuracy, location_note, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      id, req.params.jobId, req.user!.userId, latitude, longitude, accuracy || null, locationNote || null, now);
    if (job.status === 'accepted') {
      execute('UPDATE jobs SET status = ?, updated_at = ? WHERE id = ?', 'checked_in', now, req.params.jobId);
      execute('INSERT INTO job_events (id, job_id, event_type, from_status, to_status, actor_id, actor_type, metadata, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        uuid(), req.params.jobId, 'job_checked_in', 'accepted', 'checked_in', req.user!.userId, 'worker', JSON.stringify({ latitude, longitude }), now);
    }
    res.status(201).json({ id, jobId: req.params.jobId, status: job.status === 'accepted' ? 'checked_in' : job.status });
  } catch (error: any) { res.status(400).json({ error: error.message }); }
});

// GET /api/checkins/job/:jobId
router.get('/job/:jobId', authMiddleware, (req: AuthRequest, res: Response) => {
  const result = execute('SELECT * FROM check_ins WHERE job_id = ? ORDER BY created_at DESC', req.params.jobId);
  res.json(result.rows || []);
});

export default router;
