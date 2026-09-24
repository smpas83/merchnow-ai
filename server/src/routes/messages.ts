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

// POST /api/messages
router.post('/', authMiddleware, (req: AuthRequest, res: Response) => {
  const { jobId, recipientId, content } = req.body || {};
  if (!jobId || !content) return res.status(400).json({ error: 'Job ID and content required' });
  const senderId = req.user!.userId;
  const recipientIdFinal = recipientId || (req.user!.role === 'worker' ? 'admin' : 'worker');
  const result = execute(
    'INSERT INTO messages (id, job_id, sender_id, recipient_id, content, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    [uuid(), jobId, senderId, recipientIdFinal, content, new Date().toISOString()]);
  res.status(201).json(result.rows?.[0] || { success: true });
});

// GET /api/messages/job/:jobId
router.get('/job/:jobId', authMiddleware, (req: AuthRequest, res: Response) => {
  if (req.user!.role !== 'worker' && req.user!.role !== 'admin') return res.status(403).json({ error: 'Access denied' });
  const result = execute('SELECT * FROM messages WHERE job_id = ? ORDER BY created_at DESC', req.params.jobId);
  res.json(result.rows || []);
});

export default router;
