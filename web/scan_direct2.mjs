import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  const errors = [];
  page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
  page.on('pageerror', err => errors.push(err.message));
  
  // Login via fetch in page context
  const loginData = await page.evaluate(async () => {
    const res = await fetch('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'customer@demo.com', password: 'orgpass' })
    });
    return res.json();
  });
  console.log('Login:', loginData.token ? 'OK' : 'FAIL', loginData.error || '');
  
  if (loginData.token) {
    await page.goto('http://localhost:5173/');
    await page.evaluate((token) => {
      localStorage.setItem('merchnow_token', token);
    }, loginData.token);
    
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    
    console.log('URL:', page.url());
    const bodyText = await page.$eval('body', el => el.textContent.slice(0, 500)).catch(() => '');
    console.log('Has dashboard:', bodyText.includes('Demo Merchandising Job') ? 'YES' : 'NO');
    console.log('Has jobs link:', bodyText.includes('Jobs') ? 'YES' : 'NO');
    
    // Navigate to job detail
    if (bodyText.includes('Demo Merchandising Job')) {
      await page.click('text=Demo Merchandising Job');
      await page.waitForTimeout(2000);
      console.log('After job click URL:', page.url());
      const jobBody = await page.$eval('body', el => el.textContent.slice(0, 500)).catch(() => '');
      console.log('Has Check In:', jobBody.includes('Check In') ? 'YES' : 'NO');
      console.log('Has task:', jobBody.includes('Proof') ? 'YES' : 'NO');
    }
    
    // Navigate to stores
    await page.goto('http://localhost:5173/stores');
    await page.waitForTimeout(1000);
    const storesBody = await page.$eval('body', el => el.textContent.slice(0, 300)).catch(() => '');
    console.log('Stores page has Demo Store:', storesBody.includes('Demo Store') ? 'YES' : 'NO');
    
    // Navigate to campaigns
    await page.goto('http://localhost:5173/campaigns');
    await page.waitForTimeout(1000);
    const campBody = await page.$eval('body', el => el.textContent.slice(0, 300)).catch(() => '');
    console.log('Campaigns page has Demo Campaign:', campBody.includes('Demo Campaign') ? 'YES' : 'NO');
    
    // Admin login
    const adminData = await page.evaluate(async () => {
      const res = await fetch('http://localhost:3000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'admin@demo.com', password: 'adminpass' })
      });
      return res.json();
    });
    console.log('Admin login:', adminData.token ? 'OK' : 'FAIL');
    
    if (adminData.token) {
      await page.evaluate((token) => localStorage.setItem('merchnow_token', token), adminData.token);
      await page.reload({ waitUntil: 'networkidle' });
      await page.waitForTimeout(1000);
      
      await page.goto('http://localhost:5173/workers');
      await page.waitForTimeout(1000);
      const workersBody = await page.$eval('body', el => el.textContent.slice(0, 300)).catch(() => '');
      console.log('Workers page has Demo Worker:', workersBody.includes('Demo Worker') ? 'YES' : 'NO');
    }
    
    console.log('Console errors:', errors.length ? errors : 'NONE');
  }
  
  await browser.close();
})();
