import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  const errors = [];
  page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
  page.on('pageerror', err => errors.push(err.message));
  
  await page.goto('http://localhost:5173/login');
  await page.waitForTimeout(5000);
  
  const rootHtml = await page.$eval('#root', el => el.innerHTML.slice(0, 3000)).catch(() => '(no #root)');
  console.log('=== ROOT HTML ===');
  console.log(rootHtml);
  console.log('\n=== ERRORS ===');
  errors.forEach(e => console.log(e));
  if (errors.length === 0) console.log('NONE');
  
  await browser.close();
})();
