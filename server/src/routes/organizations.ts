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

// ─── ORGANIZATIONS ────────────────────────────────────────────────────────────

router.post('/', authMiddleware, (req: AuthRequest, res: Response) => {
  try {
    const { name, slug, type, industry, contactEmail, contactPhone, address } = req.body;
    if (!name || !slug) return res.status(400).json({ error: 'Name and slug required' });
    const id = uuid();
    const now = new Date().toISOString();
    execute('INSERT INTO organizations (id, name, slug, owner_id, type, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      id, name, slug, req.user!.userId, type || 'customer', 'active', now, now);
    res.status(201).json({ id, name, slug, type: type || 'customer' });
  } catch (error: any) { res.status(400).json({ error: error.message }); }
});

router.get('/', authMiddleware, (req: AuthRequest, res: Response) => {
  const result = execute(`
    SELECT o.*, COUNT(DISTINCT j.id) as job_count
    FROM organizations o LEFT JOIN jobs j ON j.organization_id = o.id
    GROUP BY o.id ORDER BY o.name`);
  res.json(result.rows);
});

router.get('/:id', authMiddleware, (req: AuthRequest, res: Response) => {
  const result = execute('SELECT * FROM organizations WHERE id = ?', req.params.id);
  const org = result.rows?.[0] as any;
  if (!org) return res.status(404).json({ error: 'Organization not found' });
  const stores = execute('SELECT * FROM stores WHERE organization_id = ?', org.id).rows;
  const campaigns = execute('SELECT * FROM campaigns WHERE organization_id = ? ORDER BY created_at DESC', org.id).rows;
  res.json({ ...org, stores, campaigns });
});

// ─── MEMBERS ──────────────────────────────────────────────────────────────────

router.post('/:id/members', authMiddleware, (req: AuthRequest, res: Response) => {
  try {
    const orgId = req.params.id;
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ error: 'userId required' });
    const existing = execute('SELECT id FROM org_members WHERE org_id = ? AND user_id = ?', orgId, userId);
    if (existing.rows?.length) return res.status(409).json({ error: 'User already member' });
    const id = uuid();
    const now = new Date().toISOString();
    execute('INSERT INTO org_members (id, user_id, org_id, role, joined_at) VALUES (?, ?, ?, ?, ?)',
      id, userId, orgId, 'member', now);
    res.status(201).json({ id, userId, orgId, role: 'member' });
  } catch (error: any) { res.status(400).json({ error: error.message }); }
});

router.get('/:id/members', authMiddleware, (req: AuthRequest, res: Response) => {
  const result = execute(`
    SELECT u.id, u.email, u.first_name, u.last_name, u.role, om.role as org_role, om.joined_at
    FROM org_members om JOIN users u ON om.user_id = u.id
    WHERE om.org_id = ?`, req.params.id);
  res.json(result.rows);
});

// ─── INVITATIONS ──────────────────────────────────────────────────────────────

router.post('/:id/invite', authMiddleware, (req: AuthRequest, res: Response) => {
  try {
    const orgId = req.params.id;
    const { email, role } = req.body;
    if (!email) return res.status(400).json({ error: 'email required' });
    const user = execute('SELECT id FROM users WHERE email = ?', email).rows?.[0];
    if (!user) return res.status(404).json({ error: 'User not found' });
    const existing = execute('SELECT id FROM org_members WHERE org_id = ? AND user_id = ?', orgId, user.id);
    if (existing.rows?.length) return res.status(409).json({ error: 'User already member' });
    const id = uuid();
    const now = new Date().toISOString();
    execute('INSERT INTO org_members (id, user_id, org_id, role, joined_at) VALUES (?, ?, ?, ?, ?)',
      id, user.id, orgId, role || 'member', now);
    res.status(201).json({ id, userId: user.id, orgId, role: role || 'member' });
  } catch (error: any) { res.status(400).json({ error: error.message }); }
});

export default router;
