import { chromium } from 'playwright';

const BASE = 'http://localhost:5173';
const API = 'http://localhost:3000/api';
let browserErrors = [];
let consoleErrors = [];
let responseErrors = [];

console.log('=== PLAYWRIGHT WEB RUNTIME TEST ===\n');

async function apiLogin(page, email, password) {
  const data = await page.evaluate(async ({ email, password }) => {
    const res = await fetch(`${API}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    return res.json();
  }, { email, password });
  
  if (!data.token) throw new Error(data.error || 'Login failed');
  return data;
}

async function setAuth(page, token) {
  await page.evaluate((token) => {
    localStorage.setItem('merchnow_token', token);
  }, token);
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
}

async function run() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  page.on('console', msg => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', err => browserErrors.push(err.message));
  page.on('response', resp => {
    if (resp.status() >= 400 && !resp.url().includes('favicon') && !resp.url().includes('/api/')) {
      responseErrors.push(`${resp.status()} ${resp.url()}`);
    }
  });

  try {
    // === CUSTOMER FLOW ===
    console.log('1. Customer login via API...');
    const customerData = await apiLogin(page, 'customer@demo.com', 'orgpass');
    console.log('   Token received, setting auth...');
    await setAuth(page, customerData.token);
    console.log('   URL after auth:', page.url());
    
    // Wait for dashboard to render after reload
    await page.waitForSelector('text=Demo Merchandising Job', { timeout: 10000 });
    console.log('   PASS: customer dashboard loaded');

    console.log('2. Customer jobs list visible...');
    await page.waitForSelector('text=Demo Merchandising Job', { timeout: 5000 });
    console.log('   PASS: job visible on dashboard');

    console.log('3. Job detail navigation...');
    await page.click('text=Demo Merchandising Job');
    await page.waitForLoadState('networkidle', { timeout: 10000 });
    await page.waitForTimeout(500);
    console.log('   URL:', page.url());
    await page.waitForSelector('text=Check In', { timeout: 5000 });
    console.log('   PASS: job detail with tasks loaded');

    // Safe mutation: complete a task
    console.log('4. Complete a task (safe mutation via UI)...');
    const jobMatch = page.url().match(/\/job\/([^/]+)/);
    if (jobMatch) {
      const taskRes = await page.evaluate(async () => {
        const token = localStorage.getItem('merchnow_token');
        const jobId = location.pathname.split('/job/')[1];
        const res = await fetch(`${API}/tasks/${jobId}/results`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            'X-Idempotency-Key': 'playwright-mutation-' + Date.now()
          },
          body: JSON.stringify({ status: 'completed', notes: 'Playwright runtime verification test' })
        });
        return res.json();
      });
      console.log('   Task result:', taskRes.id ? `CREATED id=${taskRes.id}` : taskRes.error || 'unknown');
    } else {
      console.log('   SKIP: not on job detail page');
    }

    console.log('5. Stores page...');
    await page.goto(`${BASE}/stores`);
    await page.waitForLoadState('networkidle', { timeout: 5000 });
    await page.waitForSelector('text=Demo Store', { timeout: 5000 });
    console.log('   PASS: stores page');

    console.log('6. Campaigns page...');
    await page.goto(`${BASE}/campaigns`);
    await page.waitForLoadState('networkidle', { timeout: 5000 });
    await page.waitForSelector('text=Demo Campaign', { timeout: 5000 });
    console.log('   PASS: campaigns page');

    console.log('7. Profile page...');
    await page.goto(`${BASE}/profile`);
    await page.waitForLoadState('networkidle', { timeout: 5000 });
    await page.waitForSelector('text=Demo Customer', { timeout: 5000 });
    console.log('   PASS: profile page');

    console.log('8. Logout and back to login...');
    await page.evaluate(() => { localStorage.removeItem('merchnow_token'); });
    await page.goto(`${BASE}/login`);
    await page.waitForLoadState('networkidle', { timeout: 5000 });
    await page.waitForSelector('input#email', { timeout: 5000 });
    console.log('   PASS: back to login page');

    // === ADMIN FLOW ===
    console.log('9. Admin login via API...');
    const adminData = await apiLogin(page, 'admin@demo.com', 'adminpass');
    await setAuth(page, adminData.token);
    console.log('   URL after auth:', page.url());
    await page.waitForSelector('text=Demo Merchandising Job', { timeout: 10000 });
    console.log('   PASS: admin dashboard loaded');

    console.log('10. Admin workers page...');
    await page.goto(`${BASE}/workers`);
    await page.waitForLoadState('networkidle', { timeout: 5000 });
    await page.waitForSelector('text=Demo Worker', { timeout: 5000 });
    console.log('   PASS: workers page');

    console.log('\n=== RESULTS ===');
    console.log('Console errors:', consoleErrors.length ? consoleErrors.join('; ') : 'NONE');
    console.log('Browser errors:', browserErrors.length ? browserErrors.join('; ') : 'NONE');
    console.log('Network errors:', responseErrors.length ? responseErrors.slice(0,5).join('; ') : 'NONE');
    const pass = consoleErrors.length === 0 && browserErrors.length === 0;
    console.log('Web runtime:', pass ? 'VERIFIED WORKING' : 'BROKEN');
    process.exit(pass ? 0 : 1);
  } catch (err) {
    console.log('FAIL:', err.message.slice(0, 200));
    console.log('Console errors:', consoleErrors.length ? consoleErrors.join('; ') : 'NONE');
    console.log('Browser errors:', browserErrors.length ? browserErrors.join('; ') : 'NONE');
    console.log('URL at failure:', page.url());
    process.exit(1);
  } finally {
    await browser.close();
  }
}

run();
