import { Router, Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { v4 as uuid } from 'uuid';
import { execute } from '../db/index.js';
import { uploadMiddleware, UPLOAD_DIR } from '../uploads_server.js';
import fs from 'fs';
import path from 'path';

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
  res.json(result.rows || []);
});

// GET /api/proof/files/:filename — serve uploaded file
router.get('/files/:filename', authMiddleware, (req: AuthRequest, res: Response) => {
  const filePath = path.join(UPLOAD_DIR, req.params.filename);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File not found' });
  res.sendFile(filePath);
});

export default router;
