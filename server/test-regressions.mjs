import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, '..', 'data', 'merchnow.db');

// Remove stale DB to ensure clean schema
import { unlinkSync } from 'node:fs';
try { unlinkSync(DB_PATH); } catch {}

const db = new Database(DB_PATH);

function execute(sql, ...params) {
  const trimmed = sql.trim().toUpperCase();
  const stmt = db.prepare(sql);
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

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (e) {
    console.log(`  ✗ ${name}: ${e.message}`);
    failed++;
  }
}

const tables = [
  `CREATE TABLE IF NOT EXISTS organizations (id TEXT PRIMARY KEY, name TEXT NOT NULL, slug TEXT NOT NULL UNIQUE, owner_id TEXT NOT NULL, type TEXT NOT NULL DEFAULT 'customer', website TEXT, industry TEXT, logo_url TEXT, status TEXT NOT NULL DEFAULT 'active', created_at TEXT NOT NULL, updated_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, first_name TEXT NOT NULL, last_name TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'customer', phone TEXT, avatar_url TEXT, profile_photo_url TEXT, organization_id TEXT, last_login_at TEXT, status TEXT NOT NULL DEFAULT 'active', created_at TEXT NOT NULL, updated_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS org_members (id TEXT PRIMARY KEY, user_id TEXT NOT NULL UNIQUE, org_id TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'member', joined_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS worker_profiles (id TEXT PRIMARY KEY, user_id TEXT NOT NULL UNIQUE, hourly_rate REAL NOT NULL DEFAULT 20.0, is_available INTEGER NOT NULL DEFAULT 1, skills TEXT, certifications TEXT, bio TEXT, travel_radius_miles INTEGER NOT NULL DEFAULT 20, total_jobs_completed INTEGER NOT NULL DEFAULT 0, avg_rating REAL, location_note TEXT, avatar_url TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS stores (id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, name TEXT NOT NULL, address TEXT, city TEXT, state TEXT, zip TEXT, latitude REAL, longitude REAL, manager_name TEXT, manager_phone TEXT, description TEXT, instructions TEXT, status TEXT NOT NULL DEFAULT 'active', created_at TEXT NOT NULL, updated_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS campaigns (id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, name TEXT NOT NULL, description TEXT, status TEXT NOT NULL DEFAULT 'draft', start_date TEXT, end_date TEXT, created_by TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS jobs (id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, campaign_id TEXT, store_id TEXT NOT NULL, title TEXT NOT NULL, description TEXT, scope_of_work TEXT, instructions TEXT, requirements TEXT, scheduled_at TEXT, status TEXT NOT NULL DEFAULT 'created', priority TEXT NOT NULL DEFAULT 'normal', pricing_type TEXT NOT NULL DEFAULT 'fixed', base_price REAL, hourly_rate REAL, estimated_duration_minutes INTEGER, created_by TEXT NOT NULL, assigned_worker_id TEXT, reject_reason TEXT, rework_count INTEGER NOT NULL DEFAULT 0, completed_at TEXT, cancelled_at TEXT, no_show_at TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS tasks (id TEXT PRIMARY KEY, job_id TEXT NOT NULL, order_index INTEGER NOT NULL, title TEXT NOT NULL, description TEXT, category TEXT, is_required INTEGER NOT NULL DEFAULT 1, proof_type TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS task_assignments (id TEXT PRIMARY KEY, task_id TEXT NOT NULL UNIQUE, job_id TEXT NOT NULL, worker_id TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending', started_at TEXT, completed_at TEXT, notes TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS task_results (id TEXT PRIMARY KEY, task_id TEXT NOT NULL, job_id TEXT NOT NULL, worker_id TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending', started_at TEXT, completed_at TEXT, notes TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS task_comments (id TEXT PRIMARY KEY, task_id TEXT NOT NULL, job_id TEXT NOT NULL, author_id TEXT NOT NULL, content TEXT NOT NULL, created_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS job_assignments (id TEXT PRIMARY KEY, job_id TEXT NOT NULL, worker_id TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending', assigned_at TEXT NOT NULL, accepted_at TEXT, started_at TEXT, completed_at TEXT, cancelled_at TEXT, no_show_at TEXT, reject_reason TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS job_events (id TEXT PRIMARY KEY, job_id TEXT NOT NULL, event_type TEXT NOT NULL, from_status TEXT, to_status TEXT, actor_id TEXT NOT NULL, actor_type TEXT NOT NULL, metadata TEXT, created_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS proof_assets (id TEXT PRIMARY KEY, job_id TEXT NOT NULL, task_id TEXT, worker_id TEXT NOT NULL, type TEXT NOT NULL DEFAULT 'photo', caption TEXT, latitude REAL, longitude REAL, file_path TEXT, file_url TEXT, uploaded_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS check_ins (id TEXT PRIMARY KEY, job_id TEXT NOT NULL, worker_id TEXT NOT NULL, latitude REAL NOT NULL, longitude REAL NOT NULL, accuracy REAL, location_note TEXT, created_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS reviews (id TEXT PRIMARY KEY, job_id TEXT NOT NULL, reviewer_id TEXT NOT NULL, reviewee_id TEXT NOT NULL, rating INTEGER NOT NULL, comment TEXT, category TEXT NOT NULL DEFAULT 'general', created_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS messages (id TEXT PRIMARY KEY, job_id TEXT, sender_id TEXT NOT NULL, recipient_id TEXT NOT NULL, content TEXT NOT NULL, created_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS notifications (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, type TEXT NOT NULL, title TEXT, body TEXT, data TEXT, read INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS audit_events (id TEXT PRIMARY KEY, event_type TEXT NOT NULL, actor_id TEXT, actor_type TEXT, resource_type TEXT, resource_id TEXT, action TEXT, metadata TEXT, ip_address TEXT, user_agent TEXT, created_at TEXT NOT NULL)`
];

function runSeed() {
  for (const sql of tables) db.exec(sql);
  const now = new Date().toISOString();
  const orgHash = bcrypt.hashSync('orgpass', 12);
  const workerHash = bcrypt.hashSync('workerpass', 12);
  const adminHash = bcrypt.hashSync('adminpass', 12);
  const orgId = 'org_demo_' + Date.now();

  const insert = (sql, ...params) => { db.prepare(sql).run(...params); };

  insert(`INSERT OR IGNORE INTO organizations (id, name, slug, owner_id, type, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    orgId, 'Demo Organization', 'demo-org', 'user_admin', 'customer', 'active', now, now);
  insert(`INSERT OR IGNORE INTO users (id, email, password_hash, first_name, last_name, role, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    'user_admin', 'admin@demo.com', adminHash, 'Demo', 'Admin', 'admin', 'active', now, now);
  insert(`INSERT OR IGNORE INTO users (id, email, password_hash, first_name, last_name, role, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    'user_worker', 'worker@demo.com', workerHash, 'Demo', 'Worker', 'worker', 'active', now, now);
  insert(`INSERT OR IGNORE INTO users (id, email, password_hash, first_name, last_name, role, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    'user_customer', 'customer@demo.com', orgHash, 'Demo', 'Customer', 'customer', 'active', now, now);
  insert(`INSERT OR IGNORE INTO worker_profiles (id, user_id, hourly_rate, is_available, travel_radius_miles, total_jobs_completed, avg_rating, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    'wp_worker', 'user_worker', 25.0, 1, 25, 0, null, now, now);
  insert(`INSERT OR IGNORE INTO stores (id, organization_id, name, address, city, state, zip, latitude, longitude, instructions, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    'store_demo', orgId, 'Demo Store', '123 Main Street', 'San Francisco', 'CA', '94102', 37.7749, -122.4194, 'Check in at front desk', 'active', now, now);
  insert(`INSERT OR IGNORE INTO campaigns (id, organization_id, name, description, status, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    'camp_demo', orgId, 'Demo Campaign', 'A demo merchandising campaign', 'active', 'user_customer', now, now);
  const jobId = 'job_demo_' + Date.now();
  insert(`INSERT OR IGNORE INTO jobs (id, organization_id, campaign_id, store_id, title, description, scope_of_work, instructions, status, pricing_type, base_price, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    jobId, orgId, 'camp_demo', 'store_demo', 'Demo Merchandising Job', 'Set up promotional display in the front aisle',
    'Install display, verify product placement, take photos', 'Check in with store manager before starting. Wear provided vest.',
    'created', 'fixed', 75.00, 'user_customer', now, now);
  const taskData = [
    ['task_1', jobId, 1, 'Check In', 'Arrive at store and check in with manager', 'check_in', 1, 'location'],
    ['task_2', jobId, 2, 'Verify Display Area', 'Confirm the display area is clear and ready', 'verification', 1, 'photo'],
    ['task_3', jobId, 3, 'Install Display', 'Set up promotional display according to planogram', 'execution', 1, 'photo'],
    ['task_4', jobId, 4, 'Photograph Completed Setup', 'Take photos of finished display', 'photo', 1, 'photo'],
    ['task_5', jobId, 5, 'Check Out', 'Confirm completion with store manager', 'check_out', 1, 'notes']
  ];
  for (const [id, jid, order, title, desc, cat, req, proof] of taskData) {
    insert(`INSERT OR IGNORE INTO tasks (id, job_id, order_index, title, description, category, is_required, proof_type, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      id, jid, order, title, desc, cat, req, proof, now, now);
  }
}

console.log('\n═══ MerchNow Backend Regression Tests ═══\n');

// 1. Database initialization
console.log('1. Database initialization');
runSeed();
const tableRows = execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").rows;
test('19 tables created', () => {
  if (tableRows.length !== 19) throw new Error(`Expected 19 tables, got ${tableRows.length}: ${tableRows.map(t => t.name).join(', ')}`);
});

// 2. Seed idempotency
console.log('\n2. Seed idempotency');
const userCountBefore = execute('SELECT COUNT(*) as c FROM users').rows[0].c;
runSeed();
const userCountAfter = execute('SELECT COUNT(*) as c FROM users').rows[0].c;
test('Seed is idempotent (no duplicate users)', () => {
  if (userCountBefore !== userCountAfter) throw new Error(`Users before: ${userCountBefore}, after: ${userCountAfter}`);
});

// Helper
const login = async (email, password) => {
  const res = await fetch('http://localhost:3000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  return res.json();
};

// 3. Health endpoint
console.log('\n3. Health endpoint');
test('Health returns 200', async () => {
  const res = await fetch('http://localhost:3000/api/health');
  if (res.status !== 200) throw new Error(`Status: ${res.status}`);
  const data = await res.json();
  if (data.status !== 'ok') throw new Error(`Status: ${data.status}`);
  if (!data.timestamp) throw new Error('Missing timestamp');
  if (data.version !== '1.0.0') throw new Error(`Version: ${data.version}`);
});

// 4-9: Auth + CRUD tests
console.log('\n4. Customer login');
test('Customer login returns token', async () => {
  const data = await login('customer@demo.com', 'orgpass');
  if (!data.token) throw new Error('Missing token');
  if (data.user.role !== 'customer') throw new Error(`Role: ${data.user.role}`);
});

console.log('\n5. Worker login');
test('Worker login returns token', async () => {
  const data = await login('worker@demo.com', 'workerpass');
  if (!data.token) throw new Error('Missing token');
  if (data.user.role !== 'worker') throw new Error(`Role: ${data.user.role}`);
});

console.log('\n6. Admin login');
test('Admin login returns token', async () => {
  const data = await login('admin@demo.com', 'adminpass');
  if (!data.token) throw new Error('Missing token');
  if (data.user.role !== 'admin') throw new Error(`Role: ${data.user.role}`);
});

console.log('\n7. Invalid login');
test('Invalid credentials rejected', async () => {
  const res = await fetch('http://localhost:3000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'fake@demo.com', password: 'wrong' })
  });
  if (res.status !== 401) throw new Error(`Status: ${res.status}`);
});

console.log('\n8. Protected route authorization');
test('Protected route returns 401 without token', async () => {
  const res = await fetch('http://localhost:3000/api/organizations');
  if (res.status !== 401) throw new Error(`Status: ${res.status}`);
});

test('Protected route works with valid token', async () => {
  const data = await login('admin@demo.com', 'adminpass');
  const res = await fetch('http://localhost:3000/api/organizations', {
    headers: { 'Authorization': `Bearer ${data.token}` }
  });
  if (res.status !== 200) throw new Error(`Status: ${res.status}: ${await res.text()}`);
});

test('Customer cannot access admin-only audit endpoint', async () => {
  const data = await login('customer@demo.com', 'orgpass');
  const res = await fetch('http://localhost:3000/api/audit', {
    headers: { 'Authorization': `Bearer ${data.token}` }
  });
  if (res.status === 200) throw new Error('Customer should not access admin audit');
});

console.log('\n9. Basic CRUD operation');
test('Create and retrieve organization', async () => {
  const data = await login('admin@demo.com', 'adminpass');
  const ts = Date.now();
  const createdRes = await fetch('http://localhost:3000/api/organizations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${data.token}` },
    body: JSON.stringify({ name: 'Test Org ' + ts, slug: 'test-org-' + ts, type: 'customer' })
  });
  if (createdRes.status !== 201) throw new Error(`Create: ${await createdRes.text()}`);
  const created = await createdRes.json();
  if (!created.id) throw new Error('Missing id');
  
  const getRes = await fetch(`http://localhost:3000/api/organizations/${created.id}`, {
    headers: { 'Authorization': `Bearer ${data.token}` }
  });
  if (getRes.status !== 200) throw new Error(`Get: ${await getRes.text()}`);
  const retrieved = await getRes.json();
  if (retrieved.name !== created.name) throw new Error('Name mismatch');
});

console.log(`\n═══ Results: ${passed} passed, ${failed} failed ═══\n`);
process.exit(failed > 0 ? 1 : 0);
