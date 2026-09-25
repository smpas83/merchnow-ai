import express from 'express';
const { Router, Request, Response, NextFunction } = express;
import jwt from 'jsonwebtoken';
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

// GET /api/notifications
router.get('/', authMiddleware, (req: AuthRequest, res: Response) => {
  const result = execute('SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50', req.user!.userId);
  res.json(result.rows || []);
});

// PATCH /api/notifications/:id/read
router.patch('/:id/read', authMiddleware, (req: AuthRequest, res: Response) => {
  execute('UPDATE notifications SET read = 1 WHERE id = ? AND user_id = ?', req.params.id, req.user!.userId);
  res.json({ read: true });
});

export default router;
