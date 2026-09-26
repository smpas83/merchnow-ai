const { chromium } = require('playwright');
const BASE = 'http://localhost:5173';
const API = 'http://localhost:3000/api';
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  const consoleErrors = [];
  const browserErrors = [];
  page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
  page.on('pageerror', err => browserErrors.push(err.message));

  const results = [];

  // Helper: fill login form and submit, wait for navigation
  async function formLogin(email, password) {
    await page.goto(BASE + '/login');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForSelector('#email', { timeout: 5000 });
    await page.fill('#email', email);
    await page.fill('#password', password);
    // Click submit and wait for the page to navigate (window.location.href reload)
    const [response] = await Promise.all([
      page.waitForResponse(resp => resp.url().includes('/api/auth/login') && resp.status() === 200),
      page.click('button[type="submit"]')
    ]);
    // After API success, the page does window.location.href = '/' which is a full reload
    await page.waitForLoadState('networkidle');
    await sleep(1000);
    return response.json();
  }

  try {
    // === CUSTOMER ===
    console.log('1. Customer form login...');
    const custData = await formLogin('customer@demo.com', 'orgpass');
    console.log('   API:', custData.token ? 'OK' : ('FAIL: ' + custData.error));
    console.log('   URL:', page.url());

    // Wait for dashboard content after reload
    try {
      await page.waitForSelector('text=Demo Merchandising Job', { timeout: 10000 });
      console.log('2. Customer dashboard: PASS');
      results.push('customer_dashboard', 'PASS');
    } catch(e) {
      console.log('2. Customer dashboard: FAIL -', e.message.slice(0,80));
      const body = await page.evaluate(() => (document.body || {}).innerText?.slice(0, 200) || '');
      console.log('   Body:', body);
      results.push('customer_dashboard', 'FAIL');
    }

    // Job detail
    try {
      await page.click('a[href="/jobs"]');
      await page.waitForLoadState('networkidle');
      await sleep(300);
      await page.waitForSelector('text=Demo Merchandising Job', { timeout: 5000 });
      console.log('3. Jobs page: PASS');
      results.push('jobs_page', 'PASS');
    } catch(e) { console.log('3. Jobs page: FAIL'); results.push('jobs_page', 'FAIL'); }

    try {
      await page.click('text=Demo Merchandising Job');
      await page.waitForLoadState('networkidle');
      await sleep(500);
      console.log('4. Job detail URL:', page.url());
      await page.waitForSelector('text=Check In', { timeout: 5000 });
      console.log('5. Job detail tasks: PASS');
      results.push('job_detail', 'PASS');
    } catch(e) { console.log('5. Job detail: FAIL'); results.push('job_detail', 'FAIL'); }

    // Task mutation
    const jobId = page.url().split('/job/')[1];
    if (jobId) {
      const mutRes = await page.evaluate(({ api, jid }) => {
        const token = localStorage.getItem('merchnow_token');
        return fetch(api + '/tasks/' + jid + '/results', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + token,
            'X-Idempotency-Key': 'pw-mut-' + Date.now()
          },
          body: JSON.stringify({ status: 'completed', notes: 'Playwright test' })
        }).then(r => r.json());
      }, { api: API, jid: jobId });
      console.log('6. Task mutation:', mutRes.id ? ('CREATED ' + mutRes.id) : (mutRes.error || 'unknown'));
      results.push('task_mutation', mutRes.id ? 'PASS' : 'FAIL');
    }

    // Stores
    try {
      await page.goto(BASE + '/stores');
      await page.waitForLoadState('networkidle');
      await sleep(300);
      await page.waitForSelector('text=Demo Store', { timeout: 5000 });
      console.log('7. Stores: PASS');
      results.push('stores', 'PASS');
    } catch(e) { console.log('7. Stores: FAIL'); results.push('stores', 'FAIL'); }

    // Campaigns
    try {
      await page.goto(BASE + '/campaigns');
      await page.waitForLoadState('networkidle');
      await sleep(300);
      await page.waitForSelector('text=Demo Campaign', { timeout: 5000 });
      console.log('8. Campaigns: PASS');
      results.push('campaigns', 'PASS');
    } catch(e) { console.log('8. Campaigns: FAIL'); results.push('campaigns', 'FAIL'); }

    // Profile
    try {
      await page.goto(BASE + '/profile');
      await page.waitForLoadState('networkidle');
      await sleep(300);
      await page.waitForSelector('text=Demo Customer', { timeout: 5000 });
      console.log('9. Profile: PASS');
      results.push('profile', 'PASS');
    } catch(e) { console.log('9. Profile: FAIL'); results.push('profile', 'FAIL'); }

    // Logout
    try {
      await page.evaluate(() => localStorage.removeItem('merchnow_token'));
      await page.goto(BASE + '/login');
      await page.waitForLoadState('networkidle');
      await sleep(300);
      await page.waitForSelector('#email', { timeout: 5000 });
      console.log('10. Logout: PASS');
      results.push('logout', 'PASS');
    } catch(e) { console.log('10. Logout: FAIL'); results.push('logout', 'FAIL'); }

    // === ADMIN ===
    console.log('11. Admin form login...');
    const admData = await formLogin('admin@demo.com', 'adminpass');
    console.log('   API:', admData.token ? 'OK' : ('FAIL: ' + admData.error));
    console.log('   URL:', page.url());

    try {
      await page.waitForSelector('text=Demo Merchandising Job', { timeout: 10000 });
      console.log('12. Admin dashboard: PASS');
      results.push('admin_dashboard', 'PASS');
    } catch(e) { console.log('12. Admin dashboard: FAIL'); results.push('admin_dashboard', 'FAIL'); }

    try {
      await page.goto(BASE + '/workers');
      await page.waitForLoadState('networkidle');
      await sleep(300);
      await page.waitForSelector('text=Demo Worker', { timeout: 5000 });
      console.log('13. Admin workers: PASS');
      results.push('workers', 'PASS');
    } catch(e) { console.log('13. Workers: FAIL'); results.push('workers', 'FAIL'); }

  } catch(err) {
    console.log('FATAL:', err.message.slice(0,200));
    results.push('fatal', err.message.slice(0,100));
  }

  console.log('');
  console.log('=== RESULTS ===');
  console.log('Console errors:', consoleErrors.length ? consoleErrors.slice(0,5).join('; ') : 'NONE');
  console.log('Browser errors:', browserErrors.length ? browserErrors.slice(0,5).join('; ') : 'NONE');

  const consoleClean = consoleErrors.length === 0;
  const browserClean = browserErrors.length === 0;
  console.log('Console clean:', consoleClean ? 'YES' : 'NO (' + consoleErrors.length + ' errors)');
  console.log('Browser clean:', browserClean ? 'YES' : 'NO (' + browserErrors.length + ' errors)');

  const webPass = consoleClean && browserClean;
  console.log('Web runtime:', webPass ? 'VERIFIED WORKING' : 'BROKEN');

  await browser.close();
  process.exit(webPass ? 0 : 1);
})();
