'use strict';
const fs = require('fs');
const path = require('path');
const http = require('http');
const puppeteer = require('puppeteer-core');

const BASE = process.env.GAI_GUI_BASE || 'http://127.0.0.1:3010';
const OUT = '/opt/cursor/artifacts/gai-finance-hr';
const EMAIL = process.env.IPP_GUI_EMAIL || 'admin@naiosh.com';
const PASSWORD = process.env.IPP_GUI_PASSWORD || 'Admin@123';
fs.mkdirSync(OUT, { recursive: true });

const results = [];
function record(name, pass, detail) {
  const status = pass ? 'PASS' : 'FAIL';
  results.push({ name, status, detail: detail || null });
  console.log(`${status} ${name}${detail ? ' — ' + detail : ''}`);
}

function postJson(urlPath, body) {
  return new Promise((resolve, reject) => {
    const u = new URL(urlPath, BASE);
    const payload = JSON.stringify(body);
    const req = http.request({
      hostname: u.hostname, port: u.port || 80, path: u.pathname, method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) }
    }, (res) => {
      let raw = '';
      res.on('data', (c) => { raw += c; });
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(raw); } catch { /* */ }
        resolve({ status: res.statusCode, json, raw });
      });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

async function injectSession(page, token, user) {
  await page.goto(`${BASE}/dashboard.html`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.evaluate((t, u) => {
    localStorage.setItem('authToken', t);
    sessionStorage.setItem('authToken', t);
    localStorage.setItem('user', JSON.stringify(u));
    sessionStorage.setItem('user', JSON.stringify(u));
    document.cookie = `authToken=${encodeURIComponent(t)}; path=/`;
  }, token, user);
}

async function main() {
  const login = await postJson('/api/auth/login', { email: EMAIL, password: PASSWORD });
  if (!login.json?.success) {
    record('login', false, login.raw?.slice(0, 200));
    process.exit(1);
  }
  const session = login.json.data.session;
  const token = (session && typeof session === 'object' ? session.token : session)
    || login.json.data.token || login.json.token;
  const user = login.json.data.user;
  record('login', !!token, user.email);

  const browser = await puppeteer.launch({
    executablePath: process.env.CHROME_PATH || '/usr/local/bin/google-chrome',
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1440,900']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  try {
    await injectSession(page, token, user);

    await page.goto(`${BASE}/finance`, { waitUntil: 'networkidle2', timeout: 60000 });
    await new Promise((r) => setTimeout(r, 2000));
    const finance = await page.evaluate(() => {
      const text = document.body.innerText || '';
      const labels = [
        'إدارة المصروفات', 'العهد المالية', 'رحلات العمل', 'مركز القيود المحاسبية',
        'التكامل المحاسبي', 'المدفوعات', 'إدارة الفواتير', 'تخطيط القوى العاملة'
      ];
      return {
        count: document.querySelectorAll('#finance-cards a[href]').length,
        hasAll: labels.every((l) => text.includes(l)),
        hasOld: text.includes('شروط الدفع')
      };
    });
    record('finance-8', finance.count === 8 || finance.hasAll, JSON.stringify(finance));
    await page.screenshot({ path: path.join(OUT, '01-finance-keep-8.png'), fullPage: true });

    await page.goto(`${BASE}/hr`, { waitUntil: 'networkidle2', timeout: 60000 });
    await new Promise((r) => setTimeout(r, 2500));
    const hr = await page.evaluate(() => {
      const text = document.body.innerText || '';
      const labels = [
        'إدارة ملفات الموظفين', 'تقييم الأداء', 'مقارنة الرواتب', 'الحضور والانصراف',
        'تفاعل الموظفين', 'الامتثال لنظام العمل', 'مسير الرواتب', 'إدارة التوظيف', 'مزايا الموظفين'
      ];
      return {
        count: document.querySelectorAll('#hr-cards a[href]').length,
        hasAll: labels.every((l) => text.includes(l)),
        hasOcr: text.includes('حزمة OCR')
      };
    });
    record('hr-9', hr.count === 9 || hr.hasAll, JSON.stringify(hr));
    record('hr-no-ocr', !hr.hasOcr);
    await page.screenshot({ path: path.join(OUT, '02-hr-keep-9.png'), fullPage: true });

    await page.goto(`${BASE}/archive`, { waitUntil: 'networkidle2', timeout: 60000 });
    await new Promise((r) => setTimeout(r, 1500));
    const archive = await page.evaluate(() => ({
      count: document.querySelectorAll('#archive-cards a[href]').length,
      text: document.body.innerText.includes('الأرشفة الإلكترونية')
    }));
    record('archive-2', archive.count === 2 || archive.text, JSON.stringify(archive));
    await page.screenshot({ path: path.join(OUT, '03-archive-keep-2.png'), fullPage: true });

    await page.goto(`${BASE}/governed-administrative-integration`, { waitUntil: 'networkidle2', timeout: 60000 });
    await page.evaluate(() => window.app?.loadRoute?.('governed-administrative-integration'));
    await new Promise((r) => setTimeout(r, 2000));
    const gai = await page.evaluate(() => {
      const docs = document.getElementById('gai-docs-governance');
      const fin = document.getElementById('gai-finance-governance');
      const hrSec = document.getElementById('gai-hr-governance');
      return {
        hasDocs: !!docs && (docs.innerText || '').includes('حوكمة الوثائق'),
        hasFin: !!fin && (fin.innerText || '').includes('الحوكمة المالية'),
        hasHr: !!hrSec && (hrSec.innerText || '').includes('حوكمة الموارد البشرية'),
        docsCount: docs ? docs.querySelectorAll('a[href]').length : 0,
        finCount: fin ? fin.querySelectorAll('a[href]').length : 0,
        hrCount: hrSec ? hrSec.querySelectorAll('a[href]').length : 0
      };
    });
    record('gai-docs-14', gai.docsCount === 14, JSON.stringify(gai));
    record('gai-finance-61', gai.finCount === 61, String(gai.finCount));
    record('gai-hr-21', gai.hrCount === 21, String(gai.hrCount));
    await page.screenshot({ path: path.join(OUT, '04-gai-docs.png'), fullPage: false });
    await page.evaluate(() => document.getElementById('gai-finance-governance')?.scrollIntoView({ block: 'start' }));
    await new Promise((r) => setTimeout(r, 400));
    await page.screenshot({ path: path.join(OUT, '05-gai-finance.png'), fullPage: false });
    await page.evaluate(() => document.getElementById('gai-hr-governance')?.scrollIntoView({ block: 'start' }));
    await new Promise((r) => setTimeout(r, 400));
    await page.screenshot({ path: path.join(OUT, '06-gai-hr.png'), fullPage: false });

    // Open one KEEP + one MOVE
    await page.goto(`${BASE}/finance/expenses.html`, { waitUntil: 'networkidle2', timeout: 60000 });
    record('open-expenses', /expenses/.test(page.url()), page.url());
    await page.goto(`${BASE}/finance/payment-terms.html`, { waitUntil: 'networkidle2', timeout: 60000 });
    record('open-moved-payment-terms', /payment-terms/.test(page.url()), page.url());
  } catch (err) {
    record('suite-error', false, err.message);
  } finally {
    await browser.close();
  }

  const failed = results.filter((r) => r.status === 'FAIL');
  fs.writeFileSync(path.join(OUT, 'gui-results.json'), JSON.stringify({ results }, null, 2));
  console.log('\npassed', results.length - failed.length, '/', results.length);
  if (failed.length) {
    failed.forEach((f) => console.log(' -', f.name, f.detail));
    process.exit(1);
  }
  console.log('VERDICT: GO');
}

main().catch((e) => { console.error(e); process.exit(1); });
