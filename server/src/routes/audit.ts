import { Router, Request, Response, NextFunction } from 'express';
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

// GET /api/audit
router.get('/', authMiddleware, (req: AuthRequest, res: Response) => {
  if (req.user!.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
  const limit = parseInt((req.query.limit as string) || '100') || 100;
  const result = execute(`
    SELECT ae.*, u.first_name, u.last_name FROM audit_events ae
    LEFT JOIN users u ON ae.actor_id = u.id
    ORDER BY ae.created_at DESC LIMIT ?`, [limit]);
  res.json(result.rows || []);
});

export default router;
