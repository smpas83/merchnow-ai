import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  const logs = [];
  page.on('console', msg => logs.push(`[${msg.type()}] ${msg.text()}`));
  page.on('pageerror', err => logs.push(`[ERROR] ${err.message}`));
  
  // Step 1: Login via API
  const data = await page.evaluate(async () => {
    const res = await fetch('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'customer@demo.com', password: 'orgpass' })
    });
    return res.json();
  });
  console.log('Login API:', data.token ? 'OK token=' + data.token.slice(0,20) + '...' : 'FAIL ' + data.error);
  
  // Step 2: Set token and go to root
  await page.goto('http://localhost:5173/');
  await page.evaluate((token) => {
    localStorage.setItem('merchnow_token', token);
    console.log('Token set in localStorage');
  }, data.token);
  
  // Step 3: Reload
  console.log('Reloading...');
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  
  console.log('URL after reload:', page.url());
  
  // Check what's rendered
  const bodyText = await page.$eval('body', el => el.textContent).catch(() => '(empty)');
  console.log('Page text snippet:', bodyText.slice(0, 300));
  
  // Check localStorage
  const stored = await page.evaluate(() => localStorage.getItem('merchnow_token'));
  console.log('Token in localStorage:', stored ? 'YES (' + stored.slice(0,20) + '...)' : 'NO');
  
  console.log('\nConsole logs:', logs.length ? logs.slice(0,10) : 'NONE');
  
  await browser.close();
})();
