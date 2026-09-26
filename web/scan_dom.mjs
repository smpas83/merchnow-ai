import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  await page.goto('http://localhost:5173/login');
  await page.waitForTimeout(3000);
  
  const html = await page.content();
  console.log('=== PAGE TITLE ===');
  console.log(await page.title());
  console.log('\n=== INPUTS ===');
  const inputs = await page.$$eval('input, button, form', els => els.map(e => ({
    tag: e.tagName,
    type: e.type,
    name: e.name,
    id: e.id,
    placeholder: e.placeholder,
    value: e.value,
    text: e.textContent?.slice(0, 50)
  })));
  inputs.forEach(i => console.log(JSON.stringify(i)));
  
  console.log('\n=== ERRORS ===');
  page.on('console', msg => { if (msg.type() === 'error') console.log('CONSOLE ERROR:', msg.text()); });
  page.on('pageerror', err => console.log('PAGE ERROR:', err.message));
  
  await browser.close();
})();
