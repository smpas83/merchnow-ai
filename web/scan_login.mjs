import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  const errors = [];
  page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
  page.on('pageerror', err => errors.push(err.message));
  
  await page.goto('http://localhost:5173/login');
  await page.waitForTimeout(5000);
  
  // Check what's in the DOM
  const url = page.url();
  console.log('URL after navigation:', url);
  
  const rootContent = await page.$eval('#root', el => el.innerHTML.slice(0, 5000)).catch(() => '(empty)');
  console.log('ROOT content length:', rootContent.length);
  console.log('ROOT snippet:', rootContent.slice(0, 2000));
  
  // Try to find inputs by various selectors
  const byId = await page.$('#email').then(r => r ? 'FOUND #email' : 'NOT FOUND #email');
  const byName = await page.$('input[name="email"]').then(r => r ? 'FOUND name=email' : 'NOT FOUND name=email');
  const byLabel = await page.$('label[for="email"]').then(r => r ? 'FOUND label' : 'NOT FOUND label');
  console.log(byId, byName, byLabel);
  
  // Take screenshot for debugging
  await page.screenshot({ path: '/tmp/login_scan.png' });
  console.log('Screenshot saved to /tmp/login_scan.png');
  
  console.log('\nERRORS:', errors.length ? errors : 'NONE');
  
  await browser.close();
})();
