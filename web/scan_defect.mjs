import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  const errors = [];
  page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
  page.on('pageerror', err => errors.push(err.message));
  
  // Step 1: Login and capture what happens
  await page.goto('http://localhost:5173/login');
  await page.waitForSelector('#email', { timeout: 5000 });
  
  // Listen for navigation
  const navs = [];
  page.on('response', resp => {
    if (resp.url().includes('/api/')) navs.push({ status: resp.status(), url: resp.url().replace('http://localhost:3000','') });
  });
  
  console.log(' Filling form...');
  await page.fill('#email', 'customer@demo.com');
  await page.fill('#password', 'orgpass');
  
  // Click and wait for ANY navigation
  await page.click('button[type="submit"]');
  
  // Wait for the full page reload
  await page.waitForLoadState('domcontentloaded', { timeout: 10000 });
  console.log('After domcontentloaded, URL:', page.url());
  
  await page.waitForTimeout(3000);
  console.log('After 3s wait, URL:', page.url());
  
  // Check what's rendered
  const bodyText = await page.$eval('body', el => el.textContent.slice(0, 500)).catch(() => '');
  console.log('Body has Dashboard:', bodyText.includes('Dashboard') ? 'YES' : 'NO');
  console.log('Body has Welcome back:', bodyText.includes('Welcome back') ? 'YES' : 'NO');
  console.log('Body has Demo Merchandising Job:', bodyText.includes('Demo Merchandising Job') ? 'YES' : 'NO');
  
  console.log('API calls:', JSON.stringify(navs, null, 2));
  console.log('Errors:', errors.length ? errors : 'NONE');
  
  await browser.close();
})();
