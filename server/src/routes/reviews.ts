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

// POST /api/reviews
router.post('/', authMiddleware, (req: AuthRequest, res: Response) => {
  try {
    const { jobId, revieweeId, rating, comment, category } = req.body || {};
    if (!jobId || !revieweeId || !rating || !category) return res.status(400).json({ error: 'jobId, revieweeId, rating, and category required' });
    if (rating < 1 || rating > 5) return res.status(400).json({ error: 'Rating must be 1-5' });
    const id = uuid();
    const now = new Date().toISOString();
    execute('INSERT INTO reviews (id, job_id, reviewer_id, reviewee_id, rating, comment, category, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      id, jobId, req.user!.userId, revieweeId, rating, comment || null, category, now);
    if (category === 'worker') {
      const avgResult = execute('SELECT AVG(rating) as avg FROM reviews WHERE reviewee_id = ? AND category = ?', revieweeId, 'worker');
      const avg = avgResult.rows?.[0]?.avg || 0;
      execute('UPDATE worker_profiles SET avg_rating = ?, updated_at = ? WHERE user_id = ?', avg, now, revieweeId);
    }
    res.status(201).json({ id, jobId, revieweeId, rating, category });
  } catch (error: any) { res.status(400).json({ error: error.message }); }
});

// GET /api/reviews/job/:jobId
router.get('/job/:jobId', authMiddleware, (req: AuthRequest, res: Response) => {
  const result = execute(`
    SELECT r.*, u.first_name as reviewer_first, u.last_name as reviewer_last,
           ru.first_name as reviewee_first, ru.last_name as reviewee_last
    FROM reviews r JOIN users u ON r.reviewer_id = u.id JOIN users ru ON r.reviewee_id = ru.id
    WHERE r.job_id = ?`, [req.params.jobId]);
  res.json(result.rows || []);
});

export default router;
