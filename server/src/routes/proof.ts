import express from 'express';
const { Router, Request, Response, NextFunction } = express;
import jwt from 'jsonwebtoken';
import { v4 as uuid } from 'uuid';
import { execute } from '../db/index.js';
import { uploadMiddleware, UPLOAD_DIR } from '../uploads_server.js';
import fs from 'fs';
import path from 'path';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'merchnow-dev-secret-change-in-production';

interface AuthRequest extends Request {
  user?: { userId: string; role: string; organizationId?: string };
  params: { filename?: string; jobId?: string; [key: string]: string | undefined };
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

// POST /api/proof — metadata only (no file)
router.post('/', authMiddleware, (req: AuthRequest, res: Response) => {
  try {
    const { jobId, taskId, type, caption, latitude, longitude } = req.body || {};
    if (!jobId) return res.status(400).json({ error: 'jobId required' });
    const assignment = execute('SELECT * FROM job_assignments WHERE job_id = ? AND worker_id = ? AND status = ?', jobId, req.user!.userId, 'accepted');
    if (!assignment.rows?.length) return res.status(403).json({ error: 'No accepted assignment for this job' });
    const id = uuid();
    const now = new Date().toISOString();
    execute('INSERT INTO proof_assets (id, job_id, task_id, worker_id, type, caption, latitude, longitude, file_url, uploaded_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      id, jobId, taskId || null, req.user!.userId, type || 'photo', caption || null, latitude || null, longitude || null, null, now);
    execute('INSERT INTO job_events (id, job_id, event_type, from_status, to_status, actor_id, actor_type, metadata, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      uuid(), jobId, 'proof_uploaded', 'in_progress', 'in_progress', req.user!.userId, 'worker', JSON.stringify({ assetId: id }), now);
    res.status(201).json({ id, jobId, type: type || 'photo', status: 'uploaded' });
  } catch (error: any) { res.status(400).json({ error: error.message }); }
});

// POST /api/proof/upload — multipart file upload
router.post('/upload', authMiddleware, uploadMiddleware.single('file'), (req: AuthRequest & { file?: any }, res: Response) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const { jobId, taskId, type, caption, latitude, longitude } = req.body || {};
    if (!jobId) return res.status(400).json({ error: 'jobId required' });
    const assignment = execute('SELECT * FROM job_assignments WHERE job_id = ? AND worker_id = ? AND status = ?', jobId, req.user!.userId, 'accepted');
    if (!assignment.rows?.length) return res.status(403).json({ error: 'No accepted assignment for this job' });
    const id = uuid();
    const now = new Date().toISOString();
    const fileUrl = `/api/proof/files/${req.file.filename}`;
    execute('INSERT INTO proof_assets (id, job_id, task_id, worker_id, type, caption, latitude, longitude, file_path, file_url, uploaded_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      id, jobId, taskId || null, req.user!.userId, type || 'photo', caption || null, latitude || null, longitude || null, req.file.filename, fileUrl, now);
    execute('INSERT INTO job_events (id, job_id, event_type, from_status, to_status, actor_id, actor_type, metadata, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      uuid(), jobId, 'proof_uploaded', 'in_progress', 'in_progress', req.user!.userId, 'worker', JSON.stringify({ assetId: id, filename: req.file.filename }), now);
    res.status(201).json({ id, jobId, type: type || 'photo', fileUrl, status: 'uploaded' });
  } catch (error: any) { res.status(400).json({ error: error.message }); }
});

// GET /api/proof/job/:jobId
router.get('/job/:jobId', authMiddleware, (req: AuthRequest, res: Response) => {
  const result = execute('SELECT * FROM proof_assets WHERE job_id = ? ORDER BY uploaded_at DESC', req.params.jobId);
  const proofs = result.rows || [];
  if (!proofs.length) return res.json([]);

  const authorized: any[] = [];
  for (const proof of proofs) {
    const authResult = authorizeProofAccess(req, res, proof);
    if (authResult instanceof Response) return authResult;
    authorized.push(authResult);
  }
  res.json(authorized);
});

/** Authorize access to a proof asset. Returns the proof row if authorized,
 *  or a Response with an error status if not. */
function authorizeProofAccess(
  req: AuthRequest,
  res: Response,
  proof: any
): any {
  const role = req.user!.role;
  const userId = req.user!.userId;

  if (role === 'admin') return proof;

  const jobId = proof.job_id;

  if (role === 'worker') {
    const assignment = execute(
      'SELECT * FROM job_assignments WHERE job_id = ? AND worker_id = ? AND status = ?',
      jobId, userId, 'accepted'
    );
    if (!assignment.rows?.length) {
      return res.status(403).json({ error: 'Not authorized: not assigned to this job' });
    }
    return proof;
  }

  if (role === 'customer') {
    const user = execute('SELECT organization_id FROM users WHERE id = ?', userId);
    const orgId = user.rows?.[0]?.organization_id;
    if (!orgId) {
      return res.status(403).json({ error: 'Not authorized: no organization associated' });
    }
    const job = execute('SELECT organization_id FROM jobs WHERE id = ?', jobId);
    if (!job.rows?.length || job.rows[0].organization_id !== orgId) {
      return res.status(403).json({ error: 'Not authorized: job does not belong to your organization' });
    }
    return proof;
  }

  return res.status(403).json({ error: 'Not authorized' });
}

/** Look up a proof asset by its file path (filename). Returns the proof row
 *  or null if not found. Path traversal is prevented via basename. */
function findProofByFilename(filename: string): any {
  const safeFilename = path.basename(filename);
  const proof = execute('SELECT * FROM proof_assets WHERE file_path = ?', safeFilename);
  return proof.rows?.[0] || null;
}

// GET /api/proof/files/:filename — serve uploaded file with authorization
router.get('/files/:filename', authMiddleware, (req: AuthRequest, res: Response) => {
  // Path traversal prevention — only allow the basename
  const safeFilename = path.basename(req.params.filename || '');
  if (!safeFilename || safeFilename !== (req.params.filename || '')) {
    return res.status(400).json({ error: 'Invalid filename' });
  }

  // Resolve proof asset and check ownership
  const proof = execute('SELECT pa.*, j.worker_id, o.id as org_id FROM proof_assets pa LEFT JOIN jobs j ON pa.job_id = j.id LEFT JOIN organizations o ON j.organization_id = o.id WHERE pa.file_path = ?', safeFilename || '');
  const record = proof.rows?.[0];
  if (!record) return res.status(404).json({ error: 'File not found' });

  const user = req.user;
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  // Role-based authorization
  if (user.role === 'admin') {
    // Admins can access all proof
  } else if (user.role === 'worker') {
    if (record.worker_id !== user.userId) {
      return res.status(403).json({ error: 'Not authorized to access this proof' });
    }
  } else if (user.role === 'customer') {
    if (record.org_id !== user.organizationId) {
      return res.status(403).json({ error: 'Not authorized to access this proof' });
    }
  } else {
    return res.status(403).json({ error: 'Not authorized' });
  }

  const filePath = path.join(UPLOAD_DIR, safeFilename);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File not found' });
  res.sendFile(filePath);
});

export default router;
