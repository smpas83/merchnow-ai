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

// GET /api/stores
router.get('/', authMiddleware, (req: AuthRequest, res: Response) => {
  const { orgId } = req.query;
  let query = 'SELECT s.*, o.name as organization_name FROM stores s';
  const params: string[] = [];
  if (orgId) {
    query += ' JOIN organizations o ON s.organization_id = o.id WHERE s.organization_id = ?';
    params.push(orgId as string);
  } else {
    query += ' LEFT JOIN organizations o ON s.organization_id = o.id';
  }
  query += ' ORDER BY s.name';
  const result = execute(query, params);
  res.json(result.rows || []);
});

// GET /api/stores/:id
router.get('/:id', authMiddleware, (req: AuthRequest, res: Response) => {
  const result = execute('SELECT s.*, o.name as organization_name FROM stores s LEFT JOIN organizations o ON s.organization_id = o.id WHERE s.id = ?', req.params.id);
  if (!result.rows?.length) return res.status(404).json({ error: 'Store not found' });
  res.json(result.rows[0]);
});

// POST /api/stores
router.post('/', authMiddleware, (req: AuthRequest, res: Response) => {
  try {
    const { organization_id, name, address, city, state, zip, latitude, longitude, manager_name, manager_phone, description, instructions } = req.body || {};
    if (!name) return res.status(400).json({ error: 'Store name is required' });
    const id = uuid();
    const now = new Date().toISOString();
    execute('INSERT INTO stores (id, organization_id, name, address, city, state, zip, latitude, longitude, manager_name, manager_phone, description, instructions, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      id, organization_id || null, name, address || null, city || null, state || null, zip || null,
      latitude || null, longitude || null, manager_name || null, manager_phone || null,
      description || null, instructions || null, 'active', now, now);
    const store = execute('SELECT s.*, o.name as organization_name FROM stores s LEFT JOIN organizations o ON s.organization_id = o.id WHERE s.id = ?', id);
    res.status(201).json(store.rows[0]);
  } catch (error: any) { res.status(400).json({ error: error.message }); }
});

export default router;
