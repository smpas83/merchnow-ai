import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  const errors = [];
  const apiCalls = [];
  page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
  page.on('pageerror', err => errors.push(err.message));
  page.on('response', resp => {
    if (resp.url().includes('/api/')) apiCalls.push({ status: resp.status(), url: resp.url().replace('http://localhost:3000','') });
  });
  
  await page.goto('http://localhost:5173/login');
  await page.waitForSelector('#email', { timeout: 5000 });
  
  console.log('Filling form...');
  await page.fill('#email', 'customer@demo.com');
  await page.fill('#password', 'orgpass');
  await page.click('button[type="submit"]');
  
  console.log('Waiting 5s...');
  await page.waitForTimeout(5000);
  
  console.log('URL:', page.url());
  console.log('API calls:', JSON.stringify(apiCalls, null, 2));
  console.log('Errors:', errors.length ? errors : 'NONE');
  
  const rootContent = await page.$eval('#root', el => el.innerHTML.slice(0, 3000)).catch(() => '(empty)');
  console.log('Root:', rootContent.slice(0, 500));
  
  await browser.close();
})();
