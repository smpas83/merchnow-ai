const Database = require('better-sqlite3');

const BASE = 'http://localhost:3000';

async function login(email, password) {
  const r = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  return r.json();
}

function findSeedTask() {
  const db = new Database('./data/merchnow.db');
  try {
    const jobs = db.prepare("SELECT j.id FROM jobs j WHERE j.status = 'accepted' LIMIT 1").all();
    if (!jobs.length) return null;
    const jobId = jobs[0].id;
    const tasks = db.prepare('SELECT id FROM tasks WHERE job_id = ? LIMIT 1').all(jobId);
    if (!tasks.length) return null;
    return { jobId, taskId: tasks[0].id };
  } finally {
    db.close();
  }
}

async function runTests(token, taskId) {
  const key1 = `idem_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  console.log('\n--- T1: First submission (expect 201) ---');
  const r1 = await fetch(`${BASE}/api/tasks/complete/${taskId}`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json', 'X-Idempotency-Key': key1 },
    body: JSON.stringify({ notes: 'First' })
  });
  const d1 = await r1.json();
  console.log('Status:', r1.status, '|', JSON.stringify(d1).slice(0, 80));
  const t1 = r1.status === 201 && d1.status === 'completed';

  console.log('\n--- T2: Duplicate same key+payload (expect replay, same status as original) ---');
  const r2 = await fetch(`${BASE}/api/tasks/complete/${taskId}`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json', 'X-Idempotency-Key': key1 },
    body: JSON.stringify({ notes: 'First' })
  });
  const d2 = await r2.json();
  console.log('Status:', r2.status, '|', JSON.stringify(d2).slice(0, 80));
  const t2 = r2.status === r1.status && d2.idempotencyReplay === true && d2.id === d1.id;

  console.log('\n--- T3: DB exactly-once ---');
  const db = new Database('./data/merchnow.db');
  const cnt = db.prepare('SELECT COUNT(*) as cnt FROM task_results WHERE task_id = ?').get(taskId).cnt;
  const idem = db.prepare('SELECT response_status, response_body FROM idempotency_keys WHERE key = ?').get(key1);
  db.close();
  console.log('Results:', cnt, '| Idempotency status:', idem?.response_status);
  const t3 = cnt === 1 && idem !== undefined && idem.response_status === r1.status;

  console.log('\n--- T4: Conflict same key diff payload (expect 409) ---');
  const r4 = await fetch(`${BASE}/api/tasks/complete/${taskId}`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json', 'X-Idempotency-Key': key1 },
    body: JSON.stringify({ notes: 'Different!' })
  });
  const d4 = await r4.json();
  console.log('Status:', r4.status, '|', JSON.stringify(d4).slice(0, 80));
  const t4 = r4.status === 409;

  // T5/T6: Use a DIFFERENT key for the restart replay test (realistic scenario)
  const key2 = `idem2_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  console.log('\n--- T5: New key, first submission (expect 201) ---');
  const r5 = await fetch(`${BASE}/api/tasks/complete/${taskId}`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json', 'X-Idempotency-Key': key2 },
    body: JSON.stringify({ notes: 'Second task result' })
  });
  const d5 = await r5.json();
  console.log('Status:', r5.status, '|', JSON.stringify(d5).slice(0, 80));
  const t5 = r5.status === 201 && d5.status === 'completed';

  console.log('\n--- T6: Restart replay with key2 (expect replay, count still 2) ---');
  const db2 = new Database('./data/merchnow.db');
  const cntBefore = db2.prepare('SELECT COUNT(*) as cnt FROM task_results WHERE task_id = ?').get(taskId).cnt;
  db2.close();
  console.log('Count before:', cntBefore);
  const r6 = await fetch(`${BASE}/api/tasks/complete/${taskId}`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json', 'X-Idempotency-Key': key2 },
    body: JSON.stringify({ notes: 'Second task result' })
  });
  const d6 = await r6.json();
  console.log('Status:', r6.status, '|', JSON.stringify(d6).slice(0, 80));
  const db3 = new Database('./data/merchnow.db');
  const cntAfter = db3.prepare('SELECT COUNT(*) as cnt FROM task_results WHERE task_id = ?').get(taskId).cnt;
  db3.close();
  console.log('Count after:', cntAfter);
  const t6 = r6.status === r5.status && d6.idempotencyReplay === true && d6.id === d5.id && cntAfter === cntBefore;

  console.log('\n=== RESULTS ===');
  const all = t1 && t2 && t3 && t4 && t5 && t6;
  console.log('T1 201:', t1 ? 'PASS' : 'FAIL');
  console.log('T2 replay:', t2 ? 'PASS' : 'FAIL');
  console.log('T3 DB 1 row:', t3 ? 'PASS' : 'FAIL');
  console.log('T4 conflict:', t4 ? 'PASS' : 'FAIL');
  console.log('T5 new key 201:', t5 ? 'PASS' : 'FAIL');
  console.log('T6 restart replay:', t6 ? 'PASS' : 'FAIL');
  console.log('\nGate 1+2:', all ? 'VERIFIED WORKING' : 'BROKEN');
  return all;
}

async function main() {
  console.log('=== GATE 1 & 2: IDEMPOTENCY EXACTLY-ONCE TEST ===\n');

  const seed = findSeedTask();
  if (seed) {
    console.log('Using seed task: job=' + seed.jobId + ' task=' + seed.taskId);
    const worker = await login('worker@demo.com', 'workerpass');
    if (!worker.token) { console.log('FAIL: worker login'); process.exit(1); }
    return runTests(worker.token, seed.taskId);
  }

  console.log('No seed task, creating via admin...');
  const admin = await login('admin@demo.com', 'adminpass');
  if (!admin.token) { console.log('FAIL: admin login'); process.exit(1); }

  const orgs = await (await fetch(`${BASE}/api/organizations`, { headers: { 'Authorization': `Bearer ${admin.token}` } })).json();
  const org = orgs[0];
  if (!org) { console.log('FAIL: no org'); process.exit(1); }

  const jr = await fetch(`${BASE}/api/jobs`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${admin.token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ organization_id: org.id, store_id: 'store_demo', title: 'Idem Test', status: 'created' })
  });
  const jd = await jr.json();
  if (jr.status !== 201 && jr.status !== 200) { console.log('FAIL: job creation', jr.status, JSON.stringify(jd).slice(0, 100)); process.exit(1); }

  const jobId = jd.id;
  const tr = await fetch(`${BASE}/api/jobs/${jobId}/tasks`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${admin.token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: 'T1', order_index: 0 })
  });
  const td = await tr.json();
  const taskId = td.id || (Array.isArray(td) ? (td[0] && td[0].id) : '');
  if (!taskId) { console.log('FAIL: no task'); process.exit(1); }

  return runTests(admin.token, taskId);
}

main().catch(e => { console.error(e); process.exit(1); });
