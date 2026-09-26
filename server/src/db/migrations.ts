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
    sql: `\n      CREATE TABLE IF NOT EXISTS organizations (\n        id TEXT PRIMARY KEY, name TEXT NOT NULL, slug TEXT NOT NULL UNIQUE,\n        owner_id TEXT NOT NULL, type TEXT NOT NULL DEFAULT 'customer',\n        website TEXT, industry TEXT, logo_url TEXT,\n        status TEXT NOT NULL DEFAULT 'active', created_at TEXT NOT NULL, updated_at TEXT NOT NULL\n      );\n      CREATE TABLE IF NOT EXISTS users (\n        id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL,\n        first_name TEXT NOT NULL, last_name TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'customer',\n        phone TEXT, avatar_url TEXT, profile_photo_url TEXT, organization_id TEXT,\n        last_login_at TEXT, status TEXT NOT NULL DEFAULT 'active',\n        created_at TEXT NOT NULL, updated_at TEXT NOT NULL\n      );\n      CREATE TABLE IF NOT EXISTS org_members (\n        id TEXT PRIMARY KEY, user_id TEXT NOT NULL UNIQUE, org_id TEXT NOT NULL,\n        role TEXT NOT NULL DEFAULT 'member', joined_at TEXT NOT NULL\n      );\n      CREATE TABLE IF NOT EXISTS worker_profiles (\n        id TEXT PRIMARY KEY, user_id TEXT NOT NULL UNIQUE, hourly_rate REAL NOT NULL DEFAULT 20.0,\n        is_available INTEGER NOT NULL DEFAULT 1, experience_years INTEGER DEFAULT 0,\n        availability TEXT, skills TEXT, certifications TEXT, bio TEXT,\n        service_territory TEXT, travel_radius_miles INTEGER NOT NULL DEFAULT 20,\n        total_jobs_completed INTEGER NOT NULL DEFAULT 0, avg_rating REAL,\n        location_note TEXT, avatar_url TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL\n      );\n      CREATE TABLE IF NOT EXISTS stores (\n        id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, name TEXT NOT NULL, address TEXT,\n        city TEXT, state TEXT, zip TEXT, latitude REAL, longitude REAL, manager_name TEXT,\n        manager_phone TEXT, description TEXT, instructions TEXT,\n        status TEXT NOT NULL DEFAULT 'active', created_at TEXT NOT NULL, updated_at TEXT NOT NULL\n      );\n      CREATE TABLE IF NOT EXISTS campaigns (\n        id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, name TEXT NOT NULL, description TEXT,\n        status TEXT NOT NULL DEFAULT 'draft', start_date TEXT, end_date TEXT,\n        created_by TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL\n      );\n      CREATE TABLE IF NOT EXISTS jobs (\n        id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, campaign_id TEXT, store_id TEXT NOT NULL,\n        title TEXT NOT NULL, description TEXT, scope_of_work TEXT, instructions TEXT,\n        requirements TEXT, scheduled_at TEXT, status TEXT NOT NULL DEFAULT 'created',\n        priority TEXT NOT NULL DEFAULT 'normal', pricing_type TEXT NOT NULL DEFAULT 'fixed',\n        base_price REAL, hourly_rate REAL, estimated_duration_minutes INTEGER,\n        created_by TEXT NOT NULL, assigned_worker_id TEXT, reject_reason TEXT,\n        rework_count INTEGER NOT NULL DEFAULT 0, completed_at TEXT, cancelled_at TEXT,\n        no_show_at TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL\n      );\n      CREATE TABLE IF NOT EXISTS tasks (\n        id TEXT PRIMARY KEY, job_id TEXT NOT NULL, order_index INTEGER NOT NULL,\n        title TEXT NOT NULL, description TEXT, category TEXT,\n        is_required INTEGER NOT NULL DEFAULT 1, proof_type TEXT,\n        created_at TEXT NOT NULL, updated_at TEXT NOT NULL
      );\n      CREATE TABLE IF NOT EXISTS task_assignments (\n        id TEXT PRIMARY KEY, task_id TEXT NOT NULL UNIQUE, job_id TEXT NOT NULL,\n        worker_id TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending',\n        started_at TEXT, completed_at TEXT, notes TEXT,\n        created_at TEXT NOT NULL, updated_at TEXT NOT NULL
      );\n      CREATE TABLE IF NOT EXISTS task_results (\n        id TEXT PRIMARY KEY, task_id TEXT NOT NULL, job_id TEXT NOT NULL,\n        worker_id TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending',\n        started_at TEXT, completed_at TEXT, notes TEXT,\n        created_at TEXT NOT NULL, updated_at TEXT NOT NULL
      );\n      CREATE TABLE IF NOT EXISTS task_comments (\n        id TEXT PRIMARY KEY, task_id TEXT NOT NULL, job_id TEXT NOT NULL,\n        author_id TEXT NOT NULL, content TEXT NOT NULL, created_at TEXT NOT NULL
      );\n      CREATE TABLE IF NOT EXISTS job_assignments (\n        id TEXT PRIMARY KEY, job_id TEXT NOT NULL, worker_id TEXT NOT NULL,\n        assigned_by TEXT, status TEXT NOT NULL DEFAULT 'pending', assigned_at TEXT NOT NULL,\n        accepted_at TEXT, started_at TEXT, completed_at TEXT, cancelled_at TEXT,\n        no_show_at TEXT, reject_reason TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
      );\n      CREATE TABLE IF NOT EXISTS job_events (\n        id TEXT PRIMARY KEY, job_id TEXT NOT NULL, event_type TEXT NOT NULL,\n        from_status TEXT, to_status TEXT, actor_id TEXT NOT NULL, actor_type TEXT NOT NULL,\n        metadata TEXT, created_at TEXT NOT NULL
      );\n      CREATE TABLE IF NOT EXISTS proof_assets (\n        id TEXT PRIMARY KEY, job_id TEXT NOT NULL, task_id TEXT, worker_id TEXT NOT NULL,\n        type TEXT NOT NULL DEFAULT 'photo', caption TEXT, latitude REAL, longitude REAL,\n        file_path TEXT, file_url TEXT, uploaded_at TEXT NOT NULL
      );\n      CREATE TABLE IF NOT EXISTS check_ins (\n        id TEXT PRIMARY KEY, job_id TEXT NOT NULL, worker_id TEXT NOT NULL,\n        latitude REAL NOT NULL, longitude REAL NOT NULL, accuracy REAL,\n        location_note TEXT, created_at TEXT NOT NULL
      );\n      CREATE TABLE IF NOT EXISTS reviews (\n        id TEXT PRIMARY KEY, job_id TEXT NOT NULL, reviewer_id TEXT NOT NULL,\n        reviewee_id TEXT NOT NULL, rating INTEGER NOT NULL, comment TEXT,\n        category TEXT NOT NULL DEFAULT 'general', created_at TEXT NOT NULL
      );\n      CREATE TABLE IF NOT EXISTS messages (\n        id TEXT PRIMARY KEY, job_id TEXT, sender_id TEXT NOT NULL,\n        recipient_id TEXT NOT NULL, content TEXT NOT NULL, created_at TEXT NOT NULL
      );\n      CREATE TABLE IF NOT EXISTS notifications (\n        id TEXT PRIMARY KEY, user_id TEXT NOT NULL, type TEXT NOT NULL, title TEXT,\n        body TEXT, data TEXT, read INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL
      );\n      CREATE TABLE IF NOT EXISTS audit_events (\n        id TEXT PRIMARY KEY, event_type TEXT NOT NULL, actor_id TEXT, actor_type TEXT,\n        resource_type TEXT, resource_id TEXT, action TEXT, metadata TEXT,\n        ip_address TEXT, user_agent TEXT, created_at TEXT NOT NULL
      );\n    `,
  },
  {
    version: '002',
    description: 'Add jwt_blacklist table for token revocation on logout',
    sql: JWT_BLACKLIST_SQL,
  },
  {
    version: '003',
    description: 'Add idempotency_keys table for exactly-once mutation enforcement',
    sql: `
      CREATE TABLE IF NOT EXISTS idempotency_keys (
        id TEXT PRIMARY KEY,
        key TEXT NOT NULL UNIQUE,
        user_id TEXT NOT NULL,
        operation TEXT NOT NULL,
        resource_id TEXT,
        request_hash TEXT,
        response_status INTEGER,
        response_body TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `,
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
