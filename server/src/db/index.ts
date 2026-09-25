import { v4 as uuid } from 'uuid';
import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, '..', '..', 'data', 'merchnow.db');

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
  }
  return db;
}

// Single coherent contract: execute(sql, ...params)
export function execute(sql: string, ...params: any[]): any {
  const database = getDb();
  const trimmed = sql.trim().toUpperCase();
  const stmt = database.prepare(sql);
  
  if (trimmed.startsWith('SELECT') || trimmed.startsWith('PRAGMA')) {
    if (params.length === 0) {
      const info = stmt.get();
      return info ? { rows: [info], columns: Object.keys(info) } : { rows: [], columns: [] };
    }
    const rows = stmt.all(...params);
    return { rows, columns: Object.keys(rows[0] || {}) };
  } else {
    const info = stmt.run(...params);
    return { rows: [], changes: info.changes, lastInsertRowid: info.lastInsertRowid };
  }
}

export function run(sql: string, ...params: any[]): any {
  const database = getDb();
  const stmt = database.prepare(sql);
  return stmt.run(...params);
}

export function initSchema() {
  const database = getDb();
  const tables = [
    `CREATE TABLE IF NOT EXISTS organizations (id TEXT PRIMARY KEY, name TEXT NOT NULL, slug TEXT NOT NULL UNIQUE, owner_id TEXT NOT NULL, type TEXT NOT NULL DEFAULT 'customer', website TEXT, industry TEXT, logo_url TEXT, status TEXT NOT NULL DEFAULT 'active', created_at TEXT NOT NULL, updated_at TEXT NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, first_name TEXT NOT NULL, last_name TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'customer', phone TEXT, avatar_url TEXT, profile_photo_url TEXT, organization_id TEXT, last_login_at TEXT, status TEXT NOT NULL DEFAULT 'active', created_at TEXT NOT NULL, updated_at TEXT NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS org_members (id TEXT PRIMARY KEY, user_id TEXT NOT NULL UNIQUE, org_id TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'member', joined_at TEXT NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS worker_profiles (id TEXT PRIMARY KEY, user_id TEXT NOT NULL UNIQUE, hourly_rate REAL NOT NULL DEFAULT 20.0, is_available INTEGER NOT NULL DEFAULT 1, experience_years INTEGER DEFAULT 0, availability TEXT, skills TEXT, certifications TEXT, bio TEXT, service_territory TEXT, travel_radius_miles INTEGER NOT NULL DEFAULT 20, total_jobs_completed INTEGER NOT NULL DEFAULT 0, avg_rating REAL, location_note TEXT, avatar_url TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS stores (id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, name TEXT NOT NULL, address TEXT, city TEXT, state TEXT, zip TEXT, latitude REAL, longitude REAL, manager_name TEXT, manager_phone TEXT, description TEXT, instructions TEXT, status TEXT NOT NULL DEFAULT 'active', created_at TEXT NOT NULL, updated_at TEXT NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS campaigns (id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, name TEXT NOT NULL, description TEXT, status TEXT NOT NULL DEFAULT 'draft', start_date TEXT, end_date TEXT, created_by TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS jobs (id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, campaign_id TEXT, store_id TEXT NOT NULL, title TEXT NOT NULL, description TEXT, scope_of_work TEXT, instructions TEXT, requirements TEXT, scheduled_at TEXT, status TEXT NOT NULL DEFAULT 'created', priority TEXT NOT NULL DEFAULT 'normal', pricing_type TEXT NOT NULL DEFAULT 'fixed', base_price REAL, hourly_rate REAL, estimated_duration_minutes INTEGER, created_by TEXT NOT NULL, assigned_worker_id TEXT, reject_reason TEXT, rework_count INTEGER NOT NULL DEFAULT 0, completed_at TEXT, cancelled_at TEXT, no_show_at TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS tasks (id TEXT PRIMARY KEY, job_id TEXT NOT NULL, order_index INTEGER NOT NULL, title TEXT NOT NULL, description TEXT, category TEXT, is_required INTEGER NOT NULL DEFAULT 1, proof_type TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS task_assignments (id TEXT PRIMARY KEY, task_id TEXT NOT NULL UNIQUE, job_id TEXT NOT NULL, worker_id TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending', started_at TEXT, completed_at TEXT, notes TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS task_results (id TEXT PRIMARY KEY, task_id TEXT NOT NULL, job_id TEXT NOT NULL, worker_id TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending', started_at TEXT, completed_at TEXT, notes TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS task_comments (id TEXT PRIMARY KEY, task_id TEXT NOT NULL, job_id TEXT NOT NULL, author_id TEXT NOT NULL, content TEXT NOT NULL, created_at TEXT NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS job_assignments (id TEXT PRIMARY KEY, job_id TEXT NOT NULL, worker_id TEXT NOT NULL, assigned_by TEXT, status TEXT NOT NULL DEFAULT 'pending', assigned_at TEXT NOT NULL, accepted_at TEXT, started_at TEXT, completed_at TEXT, cancelled_at TEXT, no_show_at TEXT, reject_reason TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS job_events (id TEXT PRIMARY KEY, job_id TEXT NOT NULL, event_type TEXT NOT NULL, from_status TEXT, to_status TEXT, actor_id TEXT NOT NULL, actor_type TEXT NOT NULL, metadata TEXT, created_at TEXT NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS proof_assets (id TEXT PRIMARY KEY, job_id TEXT NOT NULL, task_id TEXT, worker_id TEXT NOT NULL, type TEXT NOT NULL DEFAULT 'photo', caption TEXT, latitude REAL, longitude REAL, file_path TEXT, file_url TEXT, uploaded_at TEXT NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS check_ins (id TEXT PRIMARY KEY, job_id TEXT NOT NULL, worker_id TEXT NOT NULL, latitude REAL NOT NULL, longitude REAL NOT NULL, accuracy REAL, location_note TEXT, created_at TEXT NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS reviews (id TEXT PRIMARY KEY, job_id TEXT NOT NULL, reviewer_id TEXT NOT NULL, reviewee_id TEXT NOT NULL, rating INTEGER NOT NULL, comment TEXT, category TEXT NOT NULL DEFAULT 'general', created_at TEXT NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS messages (id TEXT PRIMARY KEY, job_id TEXT, sender_id TEXT NOT NULL, recipient_id TEXT NOT NULL, content TEXT NOT NULL, created_at TEXT NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS notifications (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, type TEXT NOT NULL, title TEXT, body TEXT, data TEXT, read INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS audit_events (id TEXT PRIMARY KEY, event_type TEXT NOT NULL, actor_id TEXT, actor_type TEXT, resource_type TEXT, resource_id TEXT, action TEXT, metadata TEXT, ip_address TEXT, user_agent TEXT, created_at TEXT NOT NULL)`
  ];
  for (const sql of tables) database.exec(sql);
  console.log(`Created ${tables.length} tables`);
}

export function seed() {
  const now = new Date().toISOString();
  const orgHash = bcrypt.hashSync('orgpass', 12);
  const workerHash = bcrypt.hashSync('workerpass', 12);
  const adminHash = bcrypt.hashSync('adminpass', 12);
  const orgId = 'org_demo_' + Date.now();

  execute(`INSERT OR IGNORE INTO organizations (id, name, slug, owner_id, type, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    orgId, 'Demo Organization', 'demo-org', 'user_admin', 'customer', 'active', now, now);
  execute(`INSERT OR IGNORE INTO users (id, email, password_hash, first_name, last_name, role, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    'user_admin', 'admin@demo.com', adminHash, 'Demo', 'Admin', 'admin', 'active', now, now);
  execute(`INSERT OR IGNORE INTO users (id, email, password_hash, first_name, last_name, role, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    'user_worker', 'worker@demo.com', workerHash, 'Demo', 'Worker', 'worker', 'active', now, now);
  execute(`INSERT OR IGNORE INTO users (id, email, password_hash, first_name, last_name, role, organization_id, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    'user_customer', 'customer@demo.com', orgHash, 'Demo', 'Customer', 'customer', orgId, 'active', now, now);
  execute(`INSERT OR IGNORE INTO worker_profiles (id, user_id, hourly_rate, is_available, travel_radius_miles, total_jobs_completed, avg_rating, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    'wp_worker', 'user_worker', 25.0, 1, 25, 0, null, now, now);
  execute(`INSERT OR IGNORE INTO stores (id, organization_id, name, address, city, state, zip, latitude, longitude, instructions, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    'store_demo', orgId, 'Demo Store', '123 Main Street', 'San Francisco', 'CA', '94102', 37.7749, -122.4194, 'Check in at front desk', 'active', now, now);
  execute(`INSERT OR IGNORE INTO campaigns (id, organization_id, name, description, status, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    'camp_demo', orgId, 'Demo Campaign', 'A demo merchandising campaign', 'active', 'user_customer', now, now);

  const jobId = 'job_demo_' + Date.now();
  execute(`INSERT OR IGNORE INTO jobs (id, organization_id, campaign_id, store_id, title, description, scope_of_work, instructions, status, pricing_type, base_price, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    jobId, orgId, 'camp_demo', 'store_demo', 'Demo Merchandising Job', 'Set up promotional display in the front aisle',
    'Install display, verify product placement, take photos', 'Check in with store manager before starting. Wear provided vest.',
    'created', 'fixed', 75.00, 'user_customer', now, now);

  const tasks = [
    ['task_1', jobId, 1, 'Check In', 'Arrive at store and check in with manager', 'check_in', 1, 'location'],
    ['task_2', jobId, 2, 'Verify Display Area', 'Confirm the display area is clear and ready', 'verification', 1, 'photo'],
    ['task_3', jobId, 3, 'Install Display', 'Set up promotional display according to planogram', 'execution', 1, 'photo'],
    ['task_4', jobId, 4, 'Photograph Completed Setup', 'Take photos of finished display', 'photo', 1, 'photo'],
    ['task_5', jobId, 5, 'Check Out', 'Confirm completion with store manager', 'check_out', 1, 'notes']
  ];
  for (const [id, jid, order, title, desc, cat, req, proof] of tasks) {
    execute(`INSERT OR IGNORE INTO tasks (id, job_id, order_index, title, description, category, is_required, proof_type, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      id, jid, order, title, desc, cat, req, proof, now, now);
  }

  console.log('\nSeed complete. Sample credentials:');
  console.log('  Customer: customer@demo.com / orgpass');
  console.log('  Worker:   worker@demo.com / workerpass');
  console.log('  Admin:    admin@demo.com / adminpass');
}

export function recordAudit(event_type: string, actor_id: string, actor_type: string, resource_type: string, resource_id: string, action: string, metadata?: any) {
  try {
    const now = new Date().toISOString();
    execute('INSERT INTO audit_events (id, event_type, actor_id, actor_type, resource_type, resource_id, action, metadata, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      uuid(), event_type, actor_id, actor_type, resource_type, resource_id, action, metadata ? JSON.stringify(metadata) : null, now);
  } catch (e) {
    // Audit is best-effort; never fail the main operation
    console.error('Audit record failed:', e);
  }
}
