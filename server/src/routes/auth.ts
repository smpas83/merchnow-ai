import express from 'express';
import type { Request, Response, NextFunction } from 'express';
const { Router } = express;
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { v4 as uuid } from 'uuid';
import { execute } from '../db/index.js';
import crypto from 'crypto';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET;
const DEV_SECRET = 'merchnow-dev-secret-change-in-production';
if (!JWT_SECRET || JWT_SECRET === DEV_SECRET) {
  console.warn('WARNING: JWT_SECRET not properly configured. Use a strong secret in production.');
}

function getSecret(): string {
  return JWT_SECRET || DEV_SECRET;
}

interface AuthRequest extends Request {
  user?: { userId: string; role: string };
}

function authMiddleware(req: AuthRequest, res: Response, next: () => void) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  try {
    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, getSecret()) as jwt.JwtPayload & { userId: string; role: string };
    if (!decoded.userId) return res.status(401).json({ error: 'Invalid token' });
    // Check token blacklist
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const blacklisted = execute('SELECT id FROM jwt_blacklist WHERE token_hash = ? AND expires_at > ?',
      tokenHash, new Date().toISOString());
    if (blacklisted.rows?.length) return res.status(401).json({ error: 'Token revoked' });
    req.user = { userId: decoded.userId, role: decoded.role };
    next();
  } catch (err: any) {
    if (err.name === 'TokenExpiredError') return res.status(401).json({ error: 'Token expired' });
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

function createToken(userId: string, role: string): string {
  return jwt.sign({ userId, role }, getSecret(), { expiresIn: '15m' });
}

// ─── REGISTER ─────────────────────────────────────────────────────────────────

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  role: z.enum(['customer', 'worker']).default('worker'),
  phone: z.string().optional(),
  organizationId: z.string().optional()
});

router.post('/register', (req: Request, res: Response) => {
  try {
    const data = registerSchema.parse(req.body);
    const existing = execute('SELECT id FROM users WHERE email = ?', data.email);
    if (existing.rows?.length > 0) {
      return res.status(409).json({ error: 'Email already registered' });
    }
    const id = uuid();
    const passwordHash = bcrypt.hashSync(data.password, 12);
    const now = new Date().toISOString();
    execute('INSERT INTO users (id, email, password_hash, first_name, last_name, role, phone, organization_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      id, data.email, passwordHash, data.firstName, data.lastName, data.role, data.phone || null, data.organizationId || null, now, now);
    if (data.role === 'worker') {
      execute('INSERT INTO worker_profiles (id, user_id, created_at, updated_at) VALUES (?, ?, ?, ?)', uuid(), id, now, now);
    }
    const token = createToken(id, data.role);
    res.status(201).json({ user: { id, email: data.email, role: data.role, firstName: data.firstName, lastName: data.lastName, phone: data.phone }, token });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.errors });
    }
    res.status(400).json({ error: error.message || 'Registration failed' });
  }
});

// ─── LOGIN ─────────────────────────────────────────────────────────────────────

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string()
});

router.post('/login', (req: Request, res: Response) => {
  try {
    const data = loginSchema.parse(req.body);
    const result = execute('SELECT * FROM users WHERE email = ?', data.email);
    const user = result.rows?.[0] as any;
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    const valid = bcrypt.compareSync(data.password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });
    const token = createToken(user.id, user.role);
    execute('UPDATE users SET last_login_at = ?, updated_at = ? WHERE id = ?', new Date().toISOString(), new Date().toISOString(), user.id);
    res.json({
      user: { id: user.id, email: user.email, role: user.role, firstName: user.first_name, lastName: user.last_name, phone: user.phone, profilePhotoUrl: user.profile_photo_url, organizationId: user.organization_id },
      token
    });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// ─── REFRESH ───────────────────────────────────────────────────────────────────

router.post('/refresh', authMiddleware, (req: AuthRequest, res: Response) => {
  try {
    const result = execute('SELECT * FROM users WHERE id = ?', req.user!.userId);
    const user = result.rows?.[0] as any;
    if (!user) return res.status(401).json({ error: 'User not found' });
    const newToken = createToken(user.id, user.role);
    res.json({ token: newToken, expiresIn: 900 });
  } catch (error: any) { res.status(400).json({ error: error.message }); }
});

// ─── LOGOUT ────────────────────────────────────────────────────────────────────

router.post('/logout', authMiddleware, (req: AuthRequest, res: Response) => {
  try {
    const token = (req.headers['authorization'] as string).substring(7);
    const decoded = jwt.verify(token, getSecret()) as jwt.JwtPayload;
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const expiresAt = (decoded.exp ? new Date(decoded.exp * 1000).toISOString() : new Date(Date.now() + 900000).toISOString());
    execute('INSERT OR IGNORE INTO jwt_blacklist (id, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?)',
      uuid(), tokenHash, expiresAt, new Date().toISOString());
    res.json({ success: true, message: 'Logged out' });
  } catch (error: any) { res.status(400).json({ error: error.message }); }
});

// ─── ME ────────────────────────────────────────────────────────────────────────

router.get('/me', authMiddleware, (req: AuthRequest, res: Response) => {
  const result = execute('SELECT id, email, role, first_name, last_name, phone, profile_photo_url, organization_id, last_login_at FROM users WHERE id = ?', req.user!.userId);
  const user = result.rows?.[0] as any;
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ id: user.id, email: user.email, role: user.role, firstName: user.first_name, lastName: user.last_name, phone: user.phone, profilePhotoUrl: user.profile_photo_url, organizationId: user.organization_id, lastLoginAt: user.last_login_at });
});

// ─── WORKER PROFILE ───────────────────────────────────────────────────────────

router.get('/me/profile', authMiddleware, (req: AuthRequest, res: Response) => {
  if (req.user!.role !== 'worker') return res.status(403).json({ error: 'Only workers have profiles' });
  const result = execute(`
    SELECT wp.*, u.first_name, u.last_name, u.email, u.phone, u.profile_photo_url
    FROM worker_profiles wp
    JOIN users u ON wp.user_id = u.id
    WHERE wp.user_id = ?`, [req.user!.userId]);
  const profile = result.rows?.[0] as any;
  if (!profile) return res.status(404).json({ error: 'Profile not found' });
  res.json({
    id: profile.id, userId: profile.user_id, bio: profile.bio,
    skills: JSON.parse(profile.skills), experienceYears: profile.experience_years,
    certifications: JSON.parse(profile.certifications), serviceTerritory: profile.service_territory,
    travelRadiusMiles: profile.travel_radius_miles, availability: JSON.parse(profile.availability),
    hourlyRate: profile.hourly_rate, isAvailable: profile.is_available === 1,
    totalJobsCompleted: profile.total_jobs_completed, avgRating: profile.avg_rating,
    firstName: profile.first_name, lastName: profile.last_name, email: profile.email,
    phone: profile.phone, profilePhotoUrl: profile.profile_photo_url,
    createdAt: profile.created_at, updatedAt: profile.updated_at
  });
});

router.patch('/me/profile', authMiddleware, (req: AuthRequest, res: Response) => {
  if (req.user!.role !== 'worker') return res.status(403).json({ error: 'Only workers can update their profile' });
  try {
    const { bio, skills, experience, certifications, hourlyRate, serviceTerritory, travelRadiusMiles } = req.body;
    const now = new Date().toISOString();
    execute(`
      UPDATE worker_profiles SET
        bio = COALESCE(?, bio), skills = COALESCE(?, skills), experience_years = COALESCE(?, experience_years),
        certifications = COALESCE(?, certifications), hourly_rate = COALESCE(?, hourly_rate),
        service_territory = COALESCE(?, service_territory), travel_radius_miles = COALESCE(?, travel_radius_miles),
        updated_at = ? WHERE user_id = ?`,
      bio || null, skills ? JSON.stringify(skills) : null, experience ?? null,
      certifications ? JSON.stringify(certifications) : null, hourlyRate ?? null,
      serviceTerritory || null, travelRadiusMiles ?? null, now, req.user!.userId);
    const result = execute(`
      SELECT wp.*, u.first_name, u.last_name, u.email, u.phone
      FROM worker_profiles wp JOIN users u ON wp.user_id = u.id WHERE wp.user_id = ?`, [req.user!.userId]);
    const profile = result.rows?.[0] as any;
    res.json({
      id: profile.id, userId: profile.user_id, bio: profile.bio,
      skills: JSON.parse(profile.skills), experienceYears: profile.experience_years,
      certifications: JSON.parse(profile.certifications), serviceTerritory: profile.service_territory,
      travelRadiusMiles: profile.travel_radius_miles, hourlyRate: profile.hourly_rate,
      isAvailable: profile.is_available === 1, totalJobsCompleted: profile.total_jobs_completed,
      avgRating: profile.avg_rating
    });
  } catch (error: any) { res.status(400).json({ error: error.message }); }
});

router.patch('/me/availability', authMiddleware, (req: AuthRequest, res: Response) => {
  if (req.user!.role !== 'worker') return res.status(403).json({ error: 'Only workers can update availability' });
  const { isAvailable } = req.body;
  if (typeof isAvailable !== 'boolean') return res.status(400).json({ error: 'isAvailable must be boolean' });
  execute('UPDATE worker_profiles SET is_available = ?, updated_at = ? WHERE user_id = ?', isAvailable ? 1 : 0, new Date().toISOString(), req.user!.userId);
  res.json({ isAvailable });
});

// ─── DASHBOARD ─────────────────────────────────────────────────────────────────

router.get('/me/dashboard', authMiddleware, (req: AuthRequest, res: Response) => {
  const result = execute('SELECT * FROM users WHERE id = ?', req.user!.userId);
  const user = result.rows?.[0] as any;
  if (!user) return res.status(404).json({ error: 'User not found' });

  if (user.role === 'worker') {
    const assignments = execute(`
      SELECT ja.*, j.title as job_title, j.status as job_status, j.pricing_model, j.price_amount, j.currency,
             s.name as store_name, s.address as store_address, s.city, s.state
      FROM job_assignments ja JOIN jobs j ON ja.job_id = j.id JOIN stores s ON j.store_id = s.id
      WHERE ja.worker_id = ? AND ja.status IN ('pending', 'accepted', 'en_route', 'checked_in', 'in_progress')
      ORDER BY ja.assigned_at DESC`, [req.user!.userId]).rows;
    const completed = execute('SELECT COUNT(*) as count FROM job_assignments WHERE worker_id = ? AND status = ?', req.user!.userId, 'completed').rows?.[0]?.count || 0;
    const earnings = execute('SELECT COALESCE(SUM(j.price_amount), 0) as total FROM job_assignments ja JOIN jobs j ON ja.job_id = j.id WHERE ja.worker_id = ? AND ja.status = ?', req.user!.userId, 'completed').rows?.[0]?.total || 0;
    res.json({
      type: 'worker', userId: user.id, assignments,
      stats: { totalJobsCompleted: completed, totalEarnings: earnings, activeAssignments: assignments?.filter((a: any) => ['pending', 'accepted', 'en_route', 'checked_in', 'in_progress'].includes(a.status)).length || 0 }
    });
  } else if (user.role === 'customer' || user.role === 'admin') {
    const orgId = user.organization_id;
    if (!orgId) return res.json({ type: 'customer', userId: user.id, message: 'No organization associated' });
    const jobs = execute(`
      SELECT j.*, s.name as store_name, s.address as store_address, s.city, s.state,
             (SELECT COUNT(*) FROM tasks WHERE job_id = j.id) as task_count,
             (SELECT COUNT(*) FROM proof_assets WHERE job_id = j.id) as proof_count
      FROM jobs j JOIN stores s ON j.store_id = s.id WHERE j.organization_id = ?
      ORDER BY j.priority DESC, j.created_at DESC LIMIT 50`, [orgId]).rows;
    const stats = {
      totalJobs: execute('SELECT COUNT(*) as count FROM jobs WHERE organization_id = ?', orgId).rows?.[0]?.count || 0,
      activeJobs: execute("SELECT COUNT(*) as count FROM jobs WHERE organization_id = ? AND status IN ('scheduled', 'assigned', 'accepted', 'en_route', 'checked_in', 'in_progress', 'submitted', 'under_review')", orgId).rows?.[0]?.count || 0,
      completedJobs: execute("SELECT COUNT(*) as count FROM jobs WHERE organization_id = ? AND status = 'completed'", orgId).rows?.[0]?.count || 0,
      totalSpend: execute('SELECT COALESCE(SUM(j.price_amount), 0) as total FROM jobs j WHERE j.organization_id = ? AND j.status = ?', orgId, 'completed').rows?.[0]?.total || 0
    };
    res.json({ type: 'customer', userId: user.id, organizationId: orgId, jobs, stats });
  } else {
    const totalWorkers = execute("SELECT COUNT(*) as count FROM users WHERE role = 'worker' AND status = 'active'").rows?.[0]?.count || 0;
    const totalCustomers = execute("SELECT COUNT(*) as count FROM users WHERE role = 'customer' AND status = 'active'").rows?.[0]?.count || 0;
    const totalJobs = execute('SELECT COUNT(*) as count FROM jobs').rows?.[0]?.count || 0;
    const activeJobs = execute("SELECT COUNT(*) as count FROM jobs WHERE status IN ('scheduled', 'assigned', 'accepted', 'en_route', 'checked_in', 'in_progress', 'submitted', 'under_review')").rows?.[0]?.count || 0;
    const completedJobs = execute("SELECT COUNT(*) as count FROM jobs WHERE status = 'completed'").rows?.[0]?.count || 0;
    res.json({
      type: 'admin', userId: user.id,
      stats: { totalWorkers, totalCustomers, totalJobs, activeJobs, completedJobs }
    });
  }
});

export default router;
