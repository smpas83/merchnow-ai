import express from 'express';
import type { Request, Response, NextFunction } from 'express';
const { Router } = express;
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

// GET /api/dispatch/available-jobs
router.get('/available-jobs', authMiddleware, (req: AuthRequest, res: Response) => {
  if (req.user!.role !== 'worker') return res.status(403).json({ error: 'Only workers can view available jobs' });
  const profile = execute('SELECT is_available FROM worker_profiles WHERE user_id = ?', req.user!.userId);
  if (!profile.rows?.length || profile.rows[0].is_available !== 1) return res.status(400).json({ error: 'You are not currently available' });
  const jobs = execute(`
    SELECT j.*, s.name as store_name, s.address, s.latitude, s.longitude, o.name as organization_name
    FROM jobs j JOIN stores s ON j.store_id = s.id JOIN organizations o ON j.organization_id = o.id
    WHERE j.status = 'assigned' ORDER BY j.priority DESC, j.created_at ASC`);
  res.json(jobs.rows || []);
});

// GET /api/dispatch/worker-availability
router.get('/worker-availability', authMiddleware, (req: AuthRequest, res: Response) => {
  if (req.user!.role !== 'worker') return res.status(403).json({ error: 'Only workers can check availability' });
  const profile = execute(
    `SELECT wp.*, u.first_name, u.last_name, u.email
    FROM worker_profiles wp JOIN users u ON wp.user_id = u.id WHERE wp.user_id = ?`, [req.user!.userId]);
  if (!profile.rows?.length) return res.status(404).json({ error: 'Profile not found' });
  const p = profile.rows[0];
  res.json({
    userId: p.user_id, isAvailable: p.is_available === 1, hourlyRate: p.hourly_rate,
    travelRadiusMiles: p.travel_radius_miles, totalJobsCompleted: p.total_jobs_completed,
    avgRating: p.avg_rating, firstName: p.first_name, lastName: p.last_name, email: p.email
  });
});

export default router;
