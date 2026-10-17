'use strict';

const fs = require('fs');
const path = require('path');
const http = require('http');
const puppeteer = require('puppeteer-core');

const BASE = process.env.GAI_BASE || 'http://127.0.0.1:3010';
const OUT = '/opt/cursor/artifacts/walkthrough';
const EMAIL = process.env.GAI_EMAIL || 'admin@naiosh.com';
const PASSWORD = process.env.GAI_PASSWORD || 'Admin@123';

fs.mkdirSync(OUT, { recursive: true });
const results = [];
function record(name, status, detail) {
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

async function main() {
  const login = await postJson('/api/auth/login', { email: EMAIL, password: PASSWORD });
  if (!login.json?.success) {
    record('login', 'FAIL', login.raw?.slice(0, 200));
    process.exit(1);
  }
  const token = login.json.data.session.token;
  const user = login.json.data.user;
  record('login', 'PASS', user.email);

  const browser = await puppeteer.launch({
    executablePath: process.env.CHROME_PATH || '/usr/local/bin/google-chrome',
    headless: 'new',
    timeout: 60000,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--window-size=1440,900',
      `--user-data-dir=/tmp/gai-chrome-${Date.now()}`]
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  try {
    await page.goto(`${BASE}/dashboard.html`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.evaluate((t, u) => {
      localStorage.setItem('authToken', t);
      sessionStorage.setItem('authToken', t);
      localStorage.setItem('user', JSON.stringify(u));
      sessionStorage.setItem('user', JSON.stringify(u));
      document.cookie = `authToken=${encodeURIComponent(t)}; path=/`;
    }, token, user);

    await page.goto(`${BASE}/home`, { waitUntil: 'networkidle2', timeout: 90000 });
    await page.waitForSelector('#nav-menu', { timeout: 45000 });
    await new Promise((r) => setTimeout(r, 3000));

    const menu = await page.evaluate(() => {
      const text = document.getElementById('nav-menu')?.innerText || '';
      const links = Array.from(document.querySelectorAll('#nav-menu a, #nav-menu button')).map((el) => el.innerText.trim());
      const ipp = links.findIndex((t) => t.includes('حاضنات و منصات اعمال'));
      const gai = links.findIndex((t) => t.includes('التكامل الإداري المحكوم'));
      const eti = links.findIndex((t) => t.includes('حاضنات التعليم والتدريب'));
      return { text, ipp, gai, eti, hasGai: text.includes('التكامل الإداري المحكوم') };
    });
    await page.screenshot({ path: path.join(OUT, 'gai-sidebar.png'), fullPage: false });
    record('sidebar-visible', menu.hasGai ? 'PASS' : 'FAIL', JSON.stringify(menu));
    record('sidebar-order', menu.ipp >= 0 && menu.gai === menu.ipp + 1 ? 'PASS' : 'FAIL',
      `ipp=${menu.ipp} gai=${menu.gai} eti=${menu.eti}`);

    await page.goto(`${BASE}/governed-administrative-integration`, { waitUntil: 'networkidle2', timeout: 90000 });
    await page.waitForSelector('#main-view', { timeout: 45000 });
    await new Promise((r) => setTimeout(r, 2500));
    await page.screenshot({ path: path.join(OUT, 'gai-page-empty.png'), fullPage: true });

    const pageState = await page.evaluate(() => {
      const main = document.getElementById('main-view')?.innerText || '';
      const title = document.getElementById('page-title')?.innerText || '';
      return {
        path: location.pathname,
        title,
        main,
        hasHeading: main.includes('التكامل الإداري المحكوم'),
        emptyish: !/قريبًا|لا توجد بيانات|Coming soon|إضافة|تصدير|جدول/i.test(main),
        hasBack: !!Array.from(document.querySelectorAll('button,a')).find((el) => /رجوع/.test(el.innerText || ''))
      };
    });
    record('page-open', pageState.path.includes('governed-administrative-integration') && pageState.hasHeading ? 'PASS' : 'FAIL',
      JSON.stringify(pageState));
    record('page-empty', pageState.emptyish ? 'PASS' : 'FAIL', pageState.main.slice(0, 120));
    record('back-button-present', pageState.hasBack ? 'PASS' : 'FAIL');

    // Direct refresh should not 404
    const status = await page.evaluate(async () => {
      const res = await fetch(location.pathname, { credentials: 'include' });
      return res.status;
    });
    record('direct-refresh-ok', status === 200 ? 'PASS' : 'FAIL', String(status));

    // Other portals intact
    await page.goto(`${BASE}/home`, { waitUntil: 'networkidle2', timeout: 60000 });
    await new Promise((r) => setTimeout(r, 2000));
    const others = await page.evaluate(() => {
      const t = document.getElementById('nav-menu')?.innerText || '';
      return {
        smart: t.includes('الإدارة الذكية 360'),
        ipp: t.includes('حاضنات و منصات اعمال'),
        gai: t.includes('التكامل الإداري المحكوم')
      };
    });
    await page.screenshot({ path: path.join(OUT, 'gai-dashboard-menu.png'), fullPage: false });
    record('others-intact', others.smart && others.ipp && others.gai ? 'PASS' : 'FAIL', JSON.stringify(others));
  } catch (err) {
    record('suite-error', 'FAIL', err.stack || err.message);
    try { await page.screenshot({ path: path.join(OUT, 'gai-error.png'), fullPage: true }); } catch { /* */ }
  } finally {
    await browser.close();
  }

  const report = {
    at: new Date().toISOString(),
    results,
    passed: results.filter((r) => r.status === 'PASS').length,
    failed: results.filter((r) => r.status === 'FAIL').length
  };
  fs.writeFileSync('/opt/cursor/artifacts/gai-gui-report.json', JSON.stringify(report, null, 2));
  console.log('\n=== GAI GUI ===');
  console.log('passed:', report.passed, '/', results.length);
  if (report.failed) process.exit(1);
  console.log('VERDICT: GO');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
