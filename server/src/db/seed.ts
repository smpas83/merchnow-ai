#!/usr/bin/env node
import bcrypt from 'bcryptjs';
import { execute, initSchema } from './index.js';

function q(...args: (string | number | null)[]) {
  const sql = args[0] as string;
  const params = args.slice(1) as (string | number | null)[];
  return execute(sql, params);
}

async function seed() {
  await initSchema();
  const now = new Date().toISOString();
  const orgHash = bcrypt.hashSync('orgpass', 12);
  const workerHash = bcrypt.hashSync('workerpass', 12);
  const adminHash = bcrypt.hashSync('adminpass', 12);

  const orgId = 'org_demo_' + Date.now();
  q(`INSERT OR IGNORE INTO organizations (id, name, slug, owner_id, type, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    orgId, 'Demo Organization', 'demo-org', 'user_admin', 'customer', 'active', now, now);

  q(`INSERT OR IGNORE INTO users (id, email, password_hash, first_name, last_name, role, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    'user_admin', 'admin@demo.com', adminHash, 'Demo', 'Admin', 'admin', 'active', now, now);
  q(`INSERT OR IGNORE INTO users (id, email, password_hash, first_name, last_name, role, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    'user_worker', 'worker@demo.com', workerHash, 'Demo', 'Worker', 'worker', 'active', now, now);
  q(`INSERT OR IGNORE INTO users (id, email, password_hash, first_name, last_name, role, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    'user_customer', 'customer@demo.com', orgHash, 'Demo', 'Customer', 'customer', 'active', now, now);

  q(`INSERT OR IGNORE INTO worker_profiles (id, user_id, hourly_rate, is_available, travel_radius_miles, total_jobs_completed, avg_rating, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    'wp_worker', 'user_worker', 25.0, 1, 25, 0, null, now, now);

  q(`INSERT OR IGNORE INTO stores (id, organization_id, name, address, city, state, zip, latitude, longitude, instructions, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    'store_demo', orgId, 'Demo Store', '123 Main Street', 'San Francisco', 'CA', '94102', 37.78, -122.41, 'Check in at front desk', 'active', now, now);

  q(`INSERT OR IGNORE INTO campaigns (id, organization_id, name, description, status, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    'camp_demo', orgId, 'Demo Campaign', 'A demo merchandising campaign', 'active', 'user_customer', now, now);

  const jobId = 'job_demo_' + Date.now();
  q(`INSERT OR IGNORE INTO jobs (id, organization_id, campaign_id, store_id, title, description, scope_of_work, instructions, status, pricing_type, base_price, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    jobId, orgId, 'camp_demo', 'store_demo', 'Demo Merchandising Job', 'Set up promotional display in the front aisle',
    'Install display, verify product placement, take photos',
    'Check in with store manager before starting. Wear provided vest.',
    'created', 'fixed', 75.00, 'user_customer', now, now);

  const tasks = [
    ['task_1', jobId, 1, 'Check In', 'Arrive at store and check in with manager', 'check_in', 1, 'location'],
    ['task_2', jobId, 2, 'Verify Display Area', 'Confirm the display area is clear and ready', 'verification', 1, 'photo'],
    ['task_3', jobId, 3, 'Install Display', 'Set up promotional display according to planogram', 'execution', 1, 'photo'],
    ['task_4', jobId, 4, 'Photograph Completed Setup', 'Take photos of finished display', 'photo', 1, 'photo'],
    ['task_5', jobId, 5, 'Check Out', 'Confirm completion with store manager', 'check_out', 1, 'notes'],
  ];
  for (const [id, jid, order, title, desc, cat, req, proof] of tasks) {
    q(`INSERT OR IGNORE INTO tasks (id, job_id, order_index, title, description, category, is_required, proof_type, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      id, jid, order, title, desc, cat, req, proof, now, now);
  }

  console.log('\nSeed complete. Sample credentials:');
  console.log('  Customer: customer@demo.com / orgpass');
  console.log('  Worker:   worker@demo.com / workerpass');
  console.log('  Admin:    admin@demo.com / adminpass');
}

seed().catch(e => { console.error(e); process.exit(1); });
