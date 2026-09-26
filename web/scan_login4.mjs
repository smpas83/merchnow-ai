import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  const errors = [];
  page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
  page.on('pageerror', err => errors.push(err.message));
  
  // Step 1: Login
  await page.goto('http://localhost:5173/login');
  await page.waitForSelector('#email', { timeout: 5000 });
  await page.fill('#email', 'customer@demo.com');
  await page.fill('#password', 'orgpass');
  await page.click('button[type="submit"]');
  
  // Step 2: Wait for the full page reload after window.location.href
  console.log('Waiting for reload...');
  await page.waitForLoadState('networkidle', { timeout: 10000 });
  console.log('After networkidle, URL:', page.url());
  
  // Step 3: If still on /login, the reload might have happened but SPA re-mounted
  // Check if we're logged in by looking for dashboard content
  await page.waitForTimeout(2000);
  console.log('After wait, URL:', page.url());
  
  const bodyText = await page.$eval('body', el => el.textContent.slice(0, 500)).catch(() => '');
  console.log('Body text:', bodyText);
  
  console.log('Errors:', errors.length ? errors : 'NONE');
  
  await browser.close();
})();
