import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { initSchema, seed } from './db/index.js';

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize database
initSchema();
seed();

// Middleware
app.use(cors());
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json());
app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later' }
}));

// Routes
import authRoutes from './routes/auth.js';
import organizationsRoutes from './routes/organizations.js';
import storesRoutes from './routes/stores.js';
import campaignsRoutes from './routes/campaigns.js';
import jobsRoutes from './routes/jobs.js';
import assignmentsRoutes from './routes/assignments.js';
import workersRoutes from './routes/workers.js';
import tasksRoutes from './routes/tasks.js';
import proofRoutes from './routes/proof.js';
import checkinsRoutes from './routes/checkins.js';
import reviewsRoutes from './routes/reviews.js';
import messagesRoutes from './routes/messages.js';
import dispatchRoutes from './routes/dispatch.js';
import notificationsRoutes from './routes/notifications.js';
import auditRoutes from './routes/audit.js';

app.use('/api/auth', authRoutes);
app.use('/api/organizations', organizationsRoutes);
app.use('/api/stores', storesRoutes);
app.use('/api/campaigns', campaignsRoutes);
app.use('/api/jobs', jobsRoutes);
app.use('/api/assignments', assignmentsRoutes);
app.use('/api/workers', workersRoutes);
app.use('/api/tasks', tasksRoutes);
app.use('/api/proof', proofRoutes);
app.use('/api/checkins', checkinsRoutes);
app.use('/api/reviews', reviewsRoutes);
app.use('/api/messages', messagesRoutes);
app.use('/api/dispatch', dispatchRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/audit', auditRoutes);

// Health check
app.get('/api/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString(), version: '1.0.0' }));

// 404 handler
app.use((req, res) => res.status(404).json({ error: 'Not found' }));

// Error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Server error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log('🚀 MerchNow API running at http://localhost:' + PORT);
  console.log('   Health:      http://localhost:' + PORT + '/api/health');
  console.log('   Environment: ' + (process.env.NODE_ENV || 'development'));
});

export default app;
