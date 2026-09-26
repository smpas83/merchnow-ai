import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  const errors = [];
  page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
  page.on('pageerror', err => errors.push(err.message));
  
  // First login via API to get token
  const res = await page.goto('http://localhost:3000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'customer@demo.com', password: 'orgpass' })
  });
  const data = await res.json();
  console.log('Login response:', data.token ? 'OK' : 'FAIL');
  
  // Set token in localStorage and navigate
  await page.goto('http://localhost:5173/');
  await page.evaluate((token) => {
    localStorage.setItem('merchnow_token', token);
  }, data.token);
  
  // Reload to trigger auth
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  
  console.log('URL after reload:', page.url());
  const bodyText = await page.$eval('body', el => el.textContent.slice(0, 500)).catch(() => '');
  console.log('Has dashboard:', bodyText.includes('Demo Merchandising Job') ? 'YES' : 'NO');
  console.log('Has job detail:', bodyText.includes('Check In') ? 'YES' : 'NO');
  
  console.log('Errors:', errors.length ? errors : 'NONE');
  
  await browser.close();
})();
