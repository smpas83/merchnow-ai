import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  const logs = [];
  page.on('console', msg => logs.push(`[${msg.type()}] ${msg.text()}`));
  
  // Set token and navigate to root
  await page.goto('http://localhost:5173/');
  await page.evaluate((token) => {
    localStorage.setItem('merchnow_token', token);
  }, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIwMDAwMDAwMC0wMDAwLTAwMDAtMDAwMC0wMDAwMDAwMDAwMDAiLCJvbXNpZ25pdG9ySWQiOiIwMDAwMDAwMC0wMDAwLTAwMDAtMDAwMC0wMDAwMDAwMDAwMDAiLCJyb2xlIjoiY3VzdG9tZXIiLCJleHAiOjE3OTI2MjcwODAwLCJpYXQiOjE3OTI1ODc4ODB9.test');
  
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);
  
  console.log('URL:', page.url());
  
  // Check if API calls were made
  const apiCalls = await page.evaluate(() => {
    return window._apiCalls || [];
  });
  
  const bodyText = await page.$eval('body', el => el.textContent.slice(0, 300)).catch(() => '');
  console.log('Body:', bodyText.slice(0, 200));
  
  console.log('Logs:', logs.slice(0, 15));
  
  await browser.close();
})();
