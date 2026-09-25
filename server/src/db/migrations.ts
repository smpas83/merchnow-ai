import { getDb } from './index';

export type Migration = {
  version: string;
  description: string;
  sql: string;
};

const JWT_BLACKLIST_SQL = `
  CREATE TABLE IF NOT EXISTS jwt_blacklist (
    id TEXT PRIMARY KEY, token_hash TEXT NOT NULL UNIQUE,
    expires_at TEXT NOT NULL, created_at TEXT NOT NULL
  );
`;

export const MIGRATIONS: Migration[] = [
  {
    version: '001',
    description: 'Initial schema',
    sql: `
      CREATE TABLE IF NOT EXISTS organizations (
        id TEXT PRIMARY KEY, name TEXT NOT NULL, slug TEXT NOT NULL UNIQUE,
        owner_id TEXT NOT NULL, type TEXT NOT NULL DEFAULT 'customer',
        website TEXT, industry TEXT, logo_url TEXT,
        status TEXT NOT NULL DEFAULT 'active', created_at TEXT NOT NULL, updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL,
        first_name TEXT NOT NULL, last_name TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'customer',
        phone TEXT, avatar_url TEXT, profile_photo_url TEXT, organization_id TEXT,
        last_login_at TEXT, status TEXT NOT NULL DEFAULT 'active',
        created_at TEXT NOT NULL, updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS org_members (
        id TEXT PRIMARY KEY, user_id TEXT NOT NULL UNIQUE, org_id TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'member', joined_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS worker_profiles (
        id TEXT PRIMARY KEY, user_id TEXT NOT NULL UNIQUE, hourly_rate REAL NOT NULL DEFAULT 20.0,
        is_available INTEGER NOT NULL DEFAULT 1, experience_years INTEGER DEFAULT 0,
        availability TEXT, skills TEXT, certifications TEXT, bio TEXT,
        service_territory TEXT, travel_radius_miles INTEGER NOT NULL DEFAULT 20,
        total_jobs_completed INTEGER NOT NULL DEFAULT 0, avg_rating REAL,
        location_note TEXT, avatar_url TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS stores (
        id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, name TEXT NOT NULL, address TEXT,
        city TEXT, state TEXT, zip TEXT, latitude REAL, longitude REAL, manager_name TEXT,
        manager_phone TEXT, description TEXT, instructions TEXT,
        status TEXT NOT NULL DEFAULT 'active', created_at TEXT NOT NULL, updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS campaigns (
        id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, name TEXT NOT NULL, description TEXT,
        status TEXT NOT NULL DEFAULT 'draft', start_date TEXT, end_date TEXT,
        created_by TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS jobs (
        id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, campaign_id TEXT, store_id TEXT NOT NULL,
        title TEXT NOT NULL, description TEXT, scope_of_work TEXT, instructions TEXT,
        requirements TEXT, scheduled_at TEXT, status TEXT NOT NULL DEFAULT 'created',
        priority TEXT NOT NULL DEFAULT 'normal', pricing_type TEXT NOT NULL DEFAULT 'fixed',
        base_price REAL, hourly_rate REAL, estimated_duration_minutes INTEGER,
        created_by TEXT NOT NULL, assigned_worker_id TEXT, reject_reason TEXT,
        rework_count INTEGER NOT NULL DEFAULT 0, completed_at TEXT, cancelled_at TEXT,
        no_show_at TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY, job_id TEXT NOT NULL, order_index INTEGER NOT NULL,
        title TEXT NOT NULL, description TEXT, category TEXT,
        is_required INTEGER NOT NULL DEFAULT 1, proof_type TEXT,
        created_at TEXT NOT NULL, updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS task_assignments (
        id TEXT PRIMARY KEY, task_id TEXT NOT NULL UNIQUE, job_id TEXT NOT NULL,
        worker_id TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending',
        started_at TEXT, completed_at TEXT, notes TEXT,
        created_at TEXT NOT NULL, updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS task_results (
        id TEXT PRIMARY KEY, task_id TEXT NOT NULL, job_id TEXT NOT NULL,
        worker_id TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending',
        started_at TEXT, completed_at TEXT, notes TEXT,
        created_at TEXT NOT NULL, updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS task_comments (
        id TEXT PRIMARY KEY, task_id TEXT NOT NULL, job_id TEXT NOT NULL,
        author_id TEXT NOT NULL, content TEXT NOT NULL, created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS job_assignments (
        id TEXT PRIMARY KEY, job_id TEXT NOT NULL, worker_id TEXT NOT NULL,
        assigned_by TEXT, status TEXT NOT NULL DEFAULT 'pending', assigned_at TEXT NOT NULL,
        accepted_at TEXT, started_at TEXT, completed_at TEXT, cancelled_at TEXT,
        no_show_at TEXT, reject_reason TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS job_events (
        id TEXT PRIMARY KEY, job_id TEXT NOT NULL, event_type TEXT NOT NULL,
        from_status TEXT, to_status TEXT, actor_id TEXT NOT NULL, actor_type TEXT NOT NULL,
        metadata TEXT, created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS proof_assets (
        id TEXT PRIMARY KEY, job_id TEXT NOT NULL, task_id TEXT, worker_id TEXT NOT NULL,
        type TEXT NOT NULL DEFAULT 'photo', caption TEXT, latitude REAL, longitude REAL,
        file_path TEXT, file_url TEXT, uploaded_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS check_ins (
        id TEXT PRIMARY KEY, job_id TEXT NOT NULL, worker_id TEXT NOT NULL,
        latitude REAL NOT NULL, longitude REAL NOT NULL, accuracy REAL,
        location_note TEXT, created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS reviews (
        id TEXT PRIMARY KEY, job_id TEXT NOT NULL, reviewer_id TEXT NOT NULL,
        reviewee_id TEXT NOT NULL, rating INTEGER NOT NULL, comment TEXT,
        category TEXT NOT NULL DEFAULT 'general', created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY, job_id TEXT, sender_id TEXT NOT NULL,
        recipient_id TEXT NOT NULL, content TEXT NOT NULL, created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS notifications (
        id TEXT PRIMARY KEY, user_id TEXT NOT NULL, type TEXT NOT NULL, title TEXT,
        body TEXT, data TEXT, read INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS audit_events (
        id TEXT PRIMARY KEY, event_type TEXT NOT NULL, actor_id TEXT, actor_type TEXT,
        resource_type TEXT, resource_id TEXT, action TEXT, metadata TEXT,
        ip_address TEXT, user_agent TEXT, created_at TEXT NOT NULL
      );
    `,
  },
  {
    version: '002',
    description: 'Add jwt_blacklist table for token revocation on logout',
    sql: JWT_BLACKLIST_SQL,
  },
];

const SCHEMA_MIGRATIONS_SQL = `
  CREATE TABLE IF NOT EXISTS schema_migrations (
    version TEXT PRIMARY KEY,
    applied_at TEXT NOT NULL
  );
`;

function trackingTableExists(): boolean {
  const db = getDb();
  const row = db.prepare(
    "SELECT COUNT(*) AS cnt FROM sqlite_master WHERE type='table' AND name='schema_migrations'"
  ).get() as { cnt: number };
  return row.cnt > 0;
}

function alreadyApplied(version: string): boolean {
  const db = getDb();
  const row = db.prepare(
    'SELECT COUNT(*) AS cnt FROM schema_migrations WHERE version = ?'
  ).get(version) as { cnt: number };
  return row.cnt > 0;
}

function recordApplied(version: string): void {
  const db = getDb();
  const now = new Date().toISOString();
  db.prepare(
    'INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)'
  ).run(version, now);
}

export function runMigrations(): void {
  const db = getDb();
  if (!trackingTableExists()) {
    db.exec(SCHEMA_MIGRATIONS_SQL);
    console.log('[migrations] Created schema_migrations tracking table');
  }
  const applied = MIGRATIONS.filter((m) => !alreadyApplied(m.version));
  if (applied.length === 0) {
    console.log('[migrations] All migrations up to date');
    return;
  }
  console.log(`[migrations] Running ${applied.length} migration(s)...`);
  for (const migration of applied) {
    try {
      db.exec(migration.sql);
      recordApplied(migration.version);
      console.log(`[migrations] ✓ ${migration.version} — ${migration.description}`);
    } catch (err) {
      console.error(`[migrations] ✗ ${migration.version} — ${migration.description}`);
      console.error('[migrations]   ', (err as Error).message);
      throw err;
    }
  }
}

export function getAppliedVersions(): string[] {
  if (!trackingTableExists()) return [];
  const db = getDb();
  const rows = db.prepare(
    'SELECT version FROM schema_migrations ORDER BY version'
  ).all() as { version: string }[];
  return rows.map((r) => r.version);
}
