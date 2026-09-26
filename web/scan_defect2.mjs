import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  const errors = [];
  const logs = [];
  page.on('console', msg => { 
    if (msg.type() === 'error') errors.push(msg.text());
    logs.push(`[${msg.type()}] ${msg.text()}`);
  });
  page.on('pageerror', err => errors.push(err.message));
  
  // Inject error tracking into the login form
  await page.goto('http://localhost:5173/login');
  await page.waitForSelector('#email', { timeout: 5000 });
  
  // Override handleSubmit to catch errors
  await page.evaluate(() => {
    const origError = console.error;
    console.error = (...args) => { logs.push('CONSOLE ERROR: ' + args.join(' ')); origError(...args); };
  });
  
  console.log(' Filling form...');
  await page.fill('#email', 'customer@demo.com');
  await page.fill('#password', 'orgpass');
  
  // Click and wait for the FULL reload cycle
  await page.click('button[type="submit"]');
  
  // Wait for network to settle
  await page.waitForLoadState('networkidle', { timeout: 15000 });
  console.log('After networkidle, URL:', page.url());
  
  await page.waitForTimeout(2000);
  console.log('After 2s, URL:', page.url());
  
  // Check if we're on dashboard by looking for dashboard-specific content
  const bodyText = await page.$eval('body', el => el.textContent).catch(() => '');
  console.log('URL:', page.url());
  console.log('Has "Demo Merchandising Job":', bodyText.includes('Demo Merchandising Job'));
  console.log('Has "Welcome back":', bodyText.includes('Welcome back'));
  console.log('Has "Sign in" button:', bodyText.includes('Sign in'));
  
  console.log('All logs:', logs.slice(-10).join('\n'));
  console.log('Errors:', errors.length ? errors : 'NONE');
  
  await browser.close();
})();
