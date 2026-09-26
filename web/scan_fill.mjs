import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  const errors = [];
  page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
  page.on('pageerror', err => errors.push(err.message));
  
  await page.goto('http://localhost:5173/login');
  await page.waitForTimeout(3000);
  
  console.log('URL:', page.url());
  console.log('Checking #email...');
  const emailInput = await page.$('#email');
  console.log('Email input:', emailInput ? 'FOUND' : 'NOT FOUND');
  
  if (emailInput) {
    console.log('Attempting fill...');
    try {
      await page.fill('#email', 'customer@demo.com');
      console.log('Fill succeeded!');
      const val = await page.$eval('#email', el => el.value);
      console.log('Value:', val);
    } catch (e) {
      console.log('Fill failed:', e.message.slice(0, 200));
    }
  }
  
  console.log('Errors:', errors.length ? errors : 'NONE');
  await browser.close();
})();
