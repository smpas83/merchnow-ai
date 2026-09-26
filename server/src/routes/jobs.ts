import express from 'express';
import type { Request, Response, NextFunction } from 'express';
const { Router } = express;
import jwt from 'jsonwebtoken';
import { v4 as uuid } from 'uuid';
import { execute, recordAudit } from '../db/index.js';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'merchnow-dev-secret-change-in-production';

interface AuthRequest extends Request {
  user?: { userId: string; role: string };
}

function authMiddleware(req: AuthRequest, res: Response, next: () => void) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string; role: string };
    req.user = decoded;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// ─── JOBS ─────────────────────────────────────────────────────────────────────

const createJobSchema = {
  organizationId: '' as string,
  campaignId: '' as string,
  storeId: '' as string,
  title: '' as string,
  description: '' as string,
  scopeOfWork: {} as Record<string, unknown>,
  instructions: '' as string,
  scheduledAt: '' as string,
  estimatedDurationMinutes: 0 as number,
  pricingModel: 'fixed' as string,
  priceAmount: 0 as number,
  currency: 'USD' as string,
  requiresCheckIn: true as boolean,
  requiresPhotos: true as boolean,
  maxPhotos: 10 as number,
  priority: 0 as number,
  customerNotes: '' as string
};

router.post('/', authMiddleware, (req: AuthRequest, res: Response) => {
  try {
    const data = req.body;
    if (!data.organizationId || !data.storeId || !data.title) {
      return res.status(400).json({ error: 'organizationId, storeId, and title required' });
    }
    // Verify store belongs to organization
    const storeResult = execute('SELECT id FROM stores WHERE id = ? AND organization_id = ?', data.storeId, data.organizationId);
    if (!storeResult.rows?.length) return res.status(400).json({ error: 'Store does not belong to organization' });
    const id = uuid();
    const now = new Date().toISOString();
    const basePrice = data.basePrice || data.priceAmount || 0;
    execute(`INSERT INTO jobs (id, organization_id, campaign_id, store_id, title, description, scope_of_work, instructions, scheduled_at, estimated_duration_minutes, pricing_type, base_price, hourly_rate, status, priority, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      id, data.organizationId, data.campaignId || null, data.storeId, data.title, data.description || null,
      data.scopeOfWork || null, data.instructions || null,
      data.scheduledAt || data.scheduled_at || null, data.estimatedDurationMinutes || data.estimated_duration_minutes || null,
      data.pricingType || data.pricing_type || 'fixed', basePrice, data.hourlyRate || data.hourly_rate || null,
      'created', data.priority || 'normal', data.createdBy || data.created_by || req.user!.userId, now, now);
    // Create tasks from scopeOfWork if provided as array
    if (data.tasks && Array.isArray(data.tasks)) {
      for (let i = 0; i < data.tasks.length; i++) {
        const t = data.tasks[i];
        execute('INSERT INTO tasks (id, job_id, order_index, title, description, category, is_required, proof_type, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          uuid(), id, i, t.title, t.description || null, t.category || null, t.isRequired !== false ? 1 : 1, t.proofType || null, now, now);
      }
    }
    // Create job event
    execute('INSERT INTO job_events (id, job_id, event_type, from_status, to_status, actor_id, actor_type, metadata, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      uuid(), id, 'job_created', null, 'created', req.user!.userId, 'customer', JSON.stringify({}), now);
    res.status(201).json({ id, title: data.title, status: 'created', organizationId: data.organizationId, storeId: data.storeId });
    recordAudit('job_created', req.user!.userId, 'customer', 'job', id, 'create', { organizationId: data.organizationId, storeId: data.storeId, title: data.title });
  } catch (error: any) { res.status(400).json({ error: error.message }); }
});

router.get('/', authMiddleware, (req: AuthRequest, res: Response) => {
  const { organizationId, status, storeId } = req.query;
  let query = 'SELECT j.* FROM jobs j WHERE 1=1';
  const params: string[] = [];
  if (organizationId) { query += ' AND j.organization_id = ?'; params.push(organizationId as string); }
  if (status) { query += ' AND j.status = ?'; params.push(status as string); }
  if (storeId) { query += ' AND j.store_id = ?'; params.push(storeId as string); }
  query += ' ORDER BY j.priority DESC, j.created_at DESC';
  const jobs = execute(query, params).rows;
  // Enrich with store info
  const enriched = jobs.map((job: any) => {
    const store = execute('SELECT * FROM stores WHERE id = ?', job.store_id).rows?.[0];
    const org = execute('SELECT * FROM organizations WHERE id = ?', job.organization_id).rows?.[0];
    const assignment = execute(`SELECT ja.*, u.first_name, u.last_name FROM job_assignments ja JOIN users u ON ja.worker_id = u.id WHERE ja.job_id = ? AND ja.status IN ('pending', 'accepted')`, [job.id]).rows?.[0];
    return { ...job, store, organization: org, assignment: assignment ? { ...assignment, workerName: `${assignment.first_name} ${assignment.last_name}` } : null };
  });
  res.json(enriched);
});

router.get('/:id', authMiddleware, (req: AuthRequest, res: Response) => {
  const result = execute('SELECT * FROM jobs WHERE id = ?', req.params.id);
  const job = result.rows?.[0] as any;
  if (!job) return res.status(404).json({ error: 'Job not found' });
  const store = execute('SELECT * FROM stores WHERE id = ?', job.store_id).rows?.[0];
  const org = execute('SELECT * FROM organizations WHERE id = ?', job.organization_id).rows?.[0];
  const tasks = execute('SELECT * FROM tasks WHERE job_id = ? ORDER BY order_index', job.id).rows;
  const events = execute('SELECT * FROM job_events WHERE job_id = ? ORDER BY created_at DESC', job.id).rows;
  const assignment = execute(`
    SELECT ja.*, u.first_name, u.last_name, u.email, wp.skills, wp.experience_years, wp.avg_rating
    FROM job_assignments ja JOIN users u ON ja.worker_id = u.id
    LEFT JOIN worker_profiles wp ON ja.worker_id = wp.user_id
    WHERE ja.job_id = ? AND ja.status IN ('pending', 'accepted', 'declined')`, [job.id]).rows?.[0];
  res.json({
    ...job, store, organization: org, tasks, events,
    assignment: assignment ? { ...assignment, skills: JSON.parse(assignment.skills || '[]'), workerName: `${assignment.first_name} ${assignment.last_name}` } : null
  });

// GET /api/jobs/:id/events
router.get('/:id/events', authMiddleware, (req: AuthRequest, res: Response) => {
  const events = execute('SELECT * FROM job_events WHERE job_id = ? ORDER BY created_at DESC', req.params.id).rows || [];
  res.json(events)
})
});

// ─── JOB STATE TRANSITIONS ────────────────────────────────────────────────────

const validTransitions: Record<string, string[]> = {
  'created': ['scheduled', 'assigned', 'cancelled'],
  'scheduled': ['assigned', 'cancelled'],
  'assigned': ['accepted', 'cancelled'],
  'accepted': ['en_route'],
  'en_route': ['checked_in', 'cancelled', 'no_show'],
  'checked_in': ['in_progress', 'no_show'],
  'in_progress': ['submitted', 'cancelled'],
  'submitted': ['under_review'],
  'under_review': ['completed', 'rework_required', 'disputed'],
  'rework_required': ['assigned', 'in_progress'],
  'completed': [], 'cancelled': [], 'no_show': [], 'disputed': []
};

router.patch('/:id/status', authMiddleware, (req: AuthRequest, res: Response) => {
  try {
    const { status } = req.body;
    const jobId = req.params.id;
    const result = execute('SELECT * FROM jobs WHERE id = ?', jobId);
    const job = result.rows?.[0] as any;
    if (!job) return res.status(404).json({ error: 'Job not found' });
    const validStatuses = validTransitions[job.status] || [];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: `Cannot transition from "${job.status}" to "${status}". Valid: ${validStatuses.join(', ') || 'none (terminal)'}` });
    }
    const now = new Date().toISOString();
    execute('UPDATE jobs SET status = ?, updated_at = ? WHERE id = ?', status, now, jobId);
    execute('INSERT INTO job_events (id, job_id, event_type, from_status, to_status, actor_id, actor_type, metadata, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      uuid(), jobId, `job_${status}`, job.status, status, req.user!.userId,
      req.user!.role === 'admin' ? 'admin' : req.user!.role, JSON.stringify({}), now);
    res.json({ id: jobId, status, previousStatus: job.status });
  } catch (error: any) { res.status(400).json({ error: error.message }); }
});

// ─── ASSIGNMENT ───────────────────────────────────────────────────────────────

router.post('/:id/assign', authMiddleware, (req: AuthRequest, res: Response) => {
  try {
    const { workerId } = req.body;
    const jobId = req.params.id;
    if (!workerId) return res.status(400).json({ error: 'workerId required' });
    const jobResult = execute('SELECT * FROM jobs WHERE id = ?', jobId);
    const job = jobResult.rows?.[0] as any;
    if (!job) return res.status(404).json({ error: 'Job not found' });
    const workerResult = execute('SELECT * FROM users WHERE id = ? AND role = ?', workerId, 'worker');
    if (!workerResult.rows?.length) return res.status(400).json({ error: 'Worker not found' });
    execute('UPDATE job_assignments SET status = ? WHERE job_id = ? AND status = ?', 'cancelled', jobId, 'pending');
    const id = uuid();
    const now = new Date().toISOString();
    execute('INSERT INTO job_assignments (id, job_id, worker_id, assigned_by, status, assigned_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      id, jobId, workerId, req.user!.userId, 'pending', now, now, now);
    execute('UPDATE jobs SET status = ?, updated_at = ? WHERE id = ?', 'assigned', now, jobId);
    execute('INSERT INTO job_events (id, job_id, event_type, from_status, to_status, actor_id, actor_type, metadata, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      uuid(), jobId, 'job_assigned', job.status, 'assigned', req.user!.userId, 'admin', JSON.stringify({ workerId }), now);
    res.status(201).json({ id, jobId, workerId, status: 'assigned' });
  } catch (error: any) { res.status(400).json({ error: error.message }); }
});

router.post('/:id/accept', authMiddleware, (req: AuthRequest, res: Response) => {
  // Find pending assignment for this worker, or create one if job is in 'created' or 'assigned' state
  let assignment = execute('SELECT * FROM job_assignments WHERE job_id = ? AND worker_id = ? AND status = ?', req.params.id, req.user!.userId, 'pending').rows?.[0] as any;
  if (!assignment) {
    // Check if job can be auto-assigned
    const job = execute('SELECT * FROM jobs WHERE id = ?', req.params.id).rows?.[0] as any;
    if (!job) return res.status(404).json({ error: 'Job not found' });
    if (job.status === 'created' || job.status === 'assigned') {
      // Create assignment and accept in one step
      const now = new Date().toISOString();
      const id = uuid();
      execute('INSERT INTO job_assignments (id, job_id, worker_id, assigned_by, status, assigned_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        id, job.id, req.user!.userId, req.user!.userId, 'accepted', now, now, now);
      execute('UPDATE jobs SET status = ?, updated_at = ?, assigned_worker_id = ? WHERE id = ?', 'accepted', now, req.user!.userId, job.id);
      execute('INSERT INTO job_events (id, job_id, event_type, from_status, to_status, actor_id, actor_type, metadata, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        uuid(), job.id, 'job_accepted', job.status, 'accepted', req.user!.userId, 'worker', JSON.stringify({ autoAssigned: true }), now);
      recordAudit('job_accepted', req.user!.userId, 'worker', 'job', job.id, 'accept', { autoAssigned: true });
      return res.json({ status: 'accepted', autoAssigned: true });
    }
    return res.status(404).json({ error: 'Assignment not found or already processed' });
  }
  const now = new Date().toISOString();
  execute('UPDATE job_assignments SET status = ?, accepted_at = ? WHERE id = ?', 'accepted', now, assignment.id);
  execute('UPDATE jobs SET status = ?, updated_at = ? WHERE id = ?', 'accepted', now, assignment.job_id);
  execute('INSERT INTO job_events (id, job_id, event_type, from_status, to_status, actor_id, actor_type, metadata, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    uuid(), assignment.job_id, 'job_accepted', 'assigned', 'accepted', req.user!.userId, 'worker', JSON.stringify({}), now);
  res.json({ status: 'accepted' });
  recordAudit('job_accepted', req.user!.userId, 'worker', 'job', assignment.job_id, 'accept', {});
});

router.post('/:id/decline', authMiddleware, (req: AuthRequest, res: Response) => {
  const { reason } = req.body;
  const result = execute('SELECT * FROM job_assignments WHERE job_id = ? AND worker_id = ? AND status = ?', req.params.id, req.user!.userId, 'pending');
  const assignment = result.rows?.[0] as any;
  if (!assignment) return res.status(404).json({ error: 'Assignment not found or already processed' });
  const now = new Date().toISOString();
  execute('UPDATE job_assignments SET status = ?, reject_reason = ?, updated_at = ? WHERE id = ?', 'declined', reason || null, now, assignment.id);
  execute('INSERT INTO job_events (id, job_id, event_type, from_status, to_status, actor_id, actor_type, metadata, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    uuid(), assignment.job_id, 'job_declined', 'assigned', 'assigned', req.user!.userId, 'worker', JSON.stringify({ reason }), now);
  res.json({ status: 'declined' });
});

// ─── CHECK-IN ────────────────────────────────────────────────────────────────

router.post('/:id/checkin', authMiddleware, (req: AuthRequest, res: Response) => {
  try {
    const jobId = req.params.id;
    const job = execute('SELECT * FROM jobs WHERE id = ?', jobId).rows?.[0] as any;
    if (!job) return res.status(404).json({ error: 'Job not found' });
    if (job.status !== 'accepted' && job.status !== 'en_route') {
      return res.status(400).json({ error: `Cannot check in from status "${job.status}"` });
    }
    const { latitude, longitude, accuracy, locationNote } = req.body;
    if (latitude === undefined || longitude === undefined) {
      return res.status(400).json({ error: 'latitude and longitude required' });
    }
    const now = new Date().toISOString();
    execute('INSERT INTO check_ins (id, job_id, worker_id, latitude, longitude, accuracy, location_note, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      uuid(), jobId, req.user!.userId, latitude, longitude, accuracy || null, locationNote || null, now);
    execute('UPDATE jobs SET status = ?, updated_at = ? WHERE id = ?', 'checked_in', now, jobId);
    execute('INSERT INTO job_events (id, job_id, event_type, from_status, to_status, actor_id, actor_type, metadata, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      uuid(), jobId, 'job_checked_in', job.status, 'checked_in', req.user!.userId, 'worker', JSON.stringify({ latitude, longitude }), now);
    res.json({ status: 'checked_in', checkInId: uuid() });
    recordAudit('job_checked_in', req.user!.userId, 'worker', 'job', jobId, 'check_in', { latitude, longitude });
  } catch (error: any) { res.status(400).json({ error: error.message }); }
});

// ─── START TASK ──────────────────────────────────────────────────────────────

router.post('/:id/start', authMiddleware, (req: AuthRequest, res: Response) => {
  try {
    const jobId = req.params.id;
    const job = execute('SELECT * FROM jobs WHERE id = ?', jobId).rows?.[0] as any;
    if (!job) return res.status(404).json({ error: 'Job not found' });
    // Verify worker is assigned
    const assignment = execute('SELECT * FROM job_assignments WHERE job_id = ? AND worker_id = ? AND status = ?', jobId, req.user!.userId, 'accepted').rows?.[0];
    if (!assignment) return res.status(403).json({ error: 'Not assigned to this job' });
    const now = new Date().toISOString();
    execute('UPDATE jobs SET status = ?, updated_at = ? WHERE id = ?', 'in_progress', now, jobId);
    execute('INSERT INTO job_events (id, job_id, event_type, from_status, to_status, actor_id, actor_type, metadata, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      uuid(), jobId, 'job_started', job.status, 'in_progress', req.user!.userId, 'worker', JSON.stringify({}), now);
    res.json({ status: 'in_progress' });
    recordAudit('job_started', req.user!.userId, 'worker', 'job', jobId, 'start', {});
  } catch (error: any) { res.status(400).json({ error: error.message }); }
});

// ─── SUBMIT ──────────────────────────────────────────────────────────────────

router.post('/:id/submit', authMiddleware, (req: AuthRequest, res: Response) => {
  try {
    const jobId = req.params.id;
    const job = execute('SELECT * FROM jobs WHERE id = ?', jobId).rows?.[0] as any;
    if (!job) return res.status(404).json({ error: 'Job not found' });
    if (job.status !== 'in_progress' && job.status !== 'checked_in') {
      return res.status(400).json({ error: `Cannot submit from status "${job.status}"` });
    }
    const { notes } = req.body;
    const now = new Date().toISOString();
    execute('UPDATE jobs SET status = ?, updated_at = ?, completed_at = ? WHERE id = ?', 'submitted', now, now, jobId);
    execute('INSERT INTO job_events (id, job_id, event_type, from_status, to_status, actor_id, actor_type, metadata, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      uuid(), jobId, 'job_submitted', job.status, 'submitted', req.user!.userId, 'worker', JSON.stringify({ notes }), now);
    res.json({ status: 'submitted' });
    recordAudit('job_submitted', req.user!.userId, 'worker', 'job', jobId, 'submit', { notes });
  } catch (error: any) { res.status(400).json({ error: error.message }); }
});

// ─── APPROVE / REWORK ────────────────────────────────────────────────────────

router.post('/:id/approve', authMiddleware, (req: AuthRequest, res: Response) => {
  try {
    const jobId = req.params.id;
    const job = execute('SELECT * FROM jobs WHERE id = ?', jobId).rows?.[0] as any;
    if (!job) return res.status(404).json({ error: 'Job not found' });
    if (job.status !== 'submitted') {
      return res.status(400).json({ error: `Cannot approve from status "${job.status}". Must be submitted.` });
    }
    // Look up the active assignment to get the worker being reviewed
    const assignment = execute('SELECT * FROM job_assignments WHERE job_id = ? AND status = ?', jobId, 'accepted').rows?.[0] as any;
    const revieweeId = assignment ? assignment.worker_id : job.assigned_worker_id;
    if (!revieweeId) return res.status(400).json({ error: 'No worker assigned to this job' });
    const { rating, comment } = req.body;
    const now = new Date().toISOString();
    execute('UPDATE jobs SET status = ?, updated_at = ?, completed_at = ? WHERE id = ?', 'completed', now, now, jobId);
    if (rating !== undefined) {
      execute('INSERT INTO reviews (id, job_id, reviewer_id, reviewee_id, rating, comment, category, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        uuid(), jobId, req.user!.userId, revieweeId, rating, comment || null, 'general', now);
    }
    execute('INSERT INTO job_events (id, job_id, event_type, from_status, to_status, actor_id, actor_type, metadata, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      uuid(), jobId, 'job_approved', 'submitted', 'completed', req.user!.userId, 'admin', JSON.stringify({ rating, comment }), now);
    res.json({ status: 'completed' });
    recordAudit('job_completed', req.user!.userId, 'admin', 'job', jobId, 'approve', { rating, comment, revieweeId });
  } catch (error: any) { res.status(400).json({ error: error.message }); }
});

// ─── REWORK ──────────────────────────────────────────────────────────────────

router.post('/:id/rework', authMiddleware, (req: AuthRequest, res: Response) => {
  try {
    const jobId = req.params.id;
    const job = execute('SELECT * FROM jobs WHERE id = ?', jobId).rows?.[0] as any;
    if (!job) return res.status(404).json({ error: 'Job not found' });
    if (job.status !== 'submitted') {
      return res.status(400).json({ error: `Cannot request rework from status "${job.status}". Must be submitted.` });
    }
    const { reason, specificTasks } = req.body;
    const now = new Date().toISOString();
    execute('UPDATE jobs SET status = ?, updated_at = ?, reject_reason = ? WHERE id = ?', 'rework_required', now, reason || null, jobId);
    execute('UPDATE job_assignments SET status = ? WHERE job_id = ?', 'pending', jobId);
    execute('INSERT INTO job_events (id, job_id, event_type, from_status, to_status, actor_id, actor_type, metadata, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      uuid(), jobId, 'job_rework_required', 'submitted', 'rework_required', req.user!.userId, 'admin', JSON.stringify({ reason, specificTasks }), now);
    recordAudit('job_rework_required', req.user!.userId, 'admin', 'job', jobId, 'rework', { reason, specificTasks });
    res.json({ status: 'rework_required' });
  } catch (error: any) { res.status(400).json({ error: error.message }); }
});

export default router;
