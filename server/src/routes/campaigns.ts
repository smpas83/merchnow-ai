import express from 'express';
const { Router, Request, Response, NextFunction, query } = express;
import jwt from 'jsonwebtoken';
import { v4 as uuid } from 'uuid';
import { execute } from '../db/index.js';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'merchnow-dev-secret-change-in-production';

interface AuthRequest extends Request {
  user?: { userId: string; role: string };
}

function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  const header = req.headers['authorization'];
  if (!header || !header.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const token = header.substring(7);
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string; role: string };
    req.user = decoded;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// POST /api/campaigns
router.post('/', authMiddleware, (req: AuthRequest, res: Response) => {
  const data = (req.body || {}) as any;
  const id = uuid();
  const now = new Date().toISOString();
  execute('INSERT INTO campaigns (id, organization_id, name, description, status, start_date, end_date, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    id, data.organizationId, data.name, data.description || null, data.status || 'draft',
    data.startDate || null, data.endDate || null, req.user!.userId, now, now);
  res.json({ id, name: data.name, status: data.status || 'draft' });
});

// GET /api/campaigns
router.get('/', authMiddleware, (req: AuthRequest, res: Response) => {
  const result = execute('SELECT * FROM campaigns ORDER BY created_at DESC');
  res.json(result.rows || []);
});

export default router;
