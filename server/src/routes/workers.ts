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

// ─── WORKERS LIST ─────────────────────────────────────────────────────────────

router.get('/', authMiddleware, (req: AuthRequest, res: Response) => {
  const { skills, minRating, isAvailable } = req.query;
  let query = `
    SELECT u.id, u.email, u.first_name, u.last_name, u.phone, u.profile_photo_url,
           wp.bio, wp.skills, wp.experience_years, wp.certifications, wp.service_territory,
           wp.travel_radius_miles, wp.availability, wp.hourly_rate, wp.is_available,
           wp.total_jobs_completed, wp.avg_rating, wp.created_at
    FROM users u JOIN worker_profiles wp ON u.id = wp.user_id
    WHERE u.role = 'worker' AND u.is_active = 1`;
  const params: string[] = [];
  if (skills) {
    const skillList = (skills as string).split(',');
    for (const skill of skillList) { query += ' AND wp.skills LIKE ?'; params.push(`%${skill}%`); }
  }
  if (minRating) { query += ' AND wp.avg_rating >= ?'; params.push(minRating as string); }
  if (isAvailable !== undefined) { query += ' AND wp.is_available = ?'; params.push(isAvailable === 'true' ? '1' : '0'); }
  query += ' ORDER BY wp.avg_rating DESC, wp.total_jobs_completed DESC';
  const workers = execute(query, params).rows;
  res.json(workers.map((w: any) => ({
    ...w, skills: JSON.parse(w.skills), certifications: JSON.parse(w.certifications),
    availability: JSON.parse(w.availability), isAvailable: w.is_available === 1
  })));
});

router.get('/:id', authMiddleware, (req: AuthRequest, res: Response) => {
  const result = execute(`
    SELECT u.id, u.email, u.first_name, u.last_name, u.phone, u.profile_photo_url,
           wp.bio, wp.skills, wp.experience_years, wp.certifications, wp.service_territory,
           wp.travel_radius_miles, wp.availability, wp.hourly_rate, wp.is_available,
           wp.total_jobs_completed, wp.avg_rating
    FROM users u JOIN worker_profiles wp ON u.id = wp.user_id WHERE u.id = ?`, [req.params.id]);
  const worker = result.rows?.[0] as any;
  if (!worker) return res.status(404).json({ error: 'Worker not found' });
  res.json({
    ...worker, skills: JSON.parse(worker.skills), certifications: JSON.parse(worker.certifications),
    availability: JSON.parse(worker.availability), isAvailable: worker.is_available === 1
  });
});

// ─── WORKER PROFILE (alternative endpoint) ────────────────────────────────────

router.patch('/profile/availability', authMiddleware, (req: AuthRequest, res: Response) => {
  if (req.user!.role !== 'worker') return res.status(403).json({ error: 'Only workers can update availability' });
  const { isAvailable } = req.body;
  execute('UPDATE worker_profiles SET is_available = ?, updated_at = ? WHERE user_id = ?', isAvailable ? 1 : 0, new Date().toISOString(), req.user!.userId);
  res.json({ isAvailable });
});

router.patch('/:id/availability', authMiddleware, (req: AuthRequest, res: Response) => {
  if (req.user!.role !== 'worker') return res.status(403).json({ error: 'Only workers can update availability' });
  const { isAvailable } = req.body;
  if (typeof isAvailable !== 'boolean') return res.status(400).json({ error: 'isAvailable must be boolean' });
  execute('UPDATE worker_profiles SET is_available = ?, updated_at = ? WHERE user_id = ?', isAvailable ? 1 : 0, new Date().toISOString(), req.user!.userId);
  res.json({ isAvailable });
});

export default router;
