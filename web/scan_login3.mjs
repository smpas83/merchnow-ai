import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  const errors = [];
  page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
  page.on('pageerror', err => errors.push(err.message));
  
  // Listen for page navigation
  page.on('pageerror', err => errors.push(err.message));
  
  await page.goto('http://localhost:5173/login');
  await page.waitForSelector('#email', { timeout: 5000 });
  
  console.log('Filling and submitting...');
  await page.fill('#email', 'customer@demo.com');
  await page.fill('#password', 'orgpass');
  
  // Use waitForNavigation instead of click
  const [response] = await Promise.all([
    page.waitForNavigation({ waitUntil: 'networkidle', timeout: 15000 }),
    page.click('button[type="submit"]')
  ]);
  
  console.log('Navigated to:', page.url());
  console.log('Response status:', response?.status());
  
  // Check if dashboard loaded
  const hasJob = await page.$eval('body', el => el.textContent.includes('Demo Merchandising Job')).catch(() => false);
  console.log('Has job text:', hasJob);
  
  console.log('Errors:', errors.length ? errors : 'NONE');
  
  await browser.close();
})();
