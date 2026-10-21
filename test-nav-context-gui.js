'use strict';
const fs = require('fs');
const path = require('path');
const http = require('http');
const puppeteer = require('puppeteer-core');

const BASE = process.env.GAI_GUI_BASE || 'http://127.0.0.1:3010';
const OUT = '/opt/cursor/artifacts/nav-context-fix';
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
        resolve({ json, raw });
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

async function sidebarInfo(page) {
  return page.evaluate(() => {
    const brand = document.querySelector('.hr-sidebar-brand p, .hr-sidebar-brand h2');
    const brandText = document.querySelector('.hr-sidebar-brand')?.innerText || '';
    const links = Array.from(document.querySelectorAll('.hr-nav-section a.hr-nav-link .hr-nav-title'))
      .map((el) => el.textContent.trim());
    const ctx = document.body.getAttribute('data-nav-context')
      || document.querySelector('[data-nav-context]')?.getAttribute('data-nav-context')
      || (window.__NAIOSH_NAV_PAYLOAD__ && window.__NAIOSH_NAV_PAYLOAD__.context)
      || '';
    return {
      ctx,
      brandText,
      links,
      hasHrSystemLabel: /نظام الموارد البشرية/.test(brandText),
      hasRecruitment: links.includes('التوظيف'),
      hasArchiveHub: links.some((l) => l.includes('السجلات') || l.includes('الأرشفة')),
      hasGai: links.some((l) => l.includes('التكامل الإداري')),
      hasEArchive: links.includes('الأرشفة الإلكترونية'),
      hasMail: links.includes('إدارة مراسلات الصادر والوارد')
    };
  });
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

    await page.goto(`${BASE}/hr/e-archive`, { waitUntil: 'networkidle2', timeout: 60000 });
    await new Promise((r) => setTimeout(r, 2000));
    let info = await sidebarInfo(page);
    record('e-archive-no-hr-sidebar', !info.hasHrSystemLabel && !info.hasRecruitment, JSON.stringify(info));
    record('e-archive-has-archive-nav', info.hasEArchive && info.hasMail, JSON.stringify(info.links));
    await page.screenshot({ path: path.join(OUT, '02-e-archive-after.png'), fullPage: true });

    await page.goto(`${BASE}/hr/inbound-outbound-mail`, { waitUntil: 'networkidle2', timeout: 60000 });
    await new Promise((r) => setTimeout(r, 1500));
    info = await sidebarInfo(page);
    record('mail-no-hr-sidebar', !info.hasHrSystemLabel && !info.hasRecruitment, JSON.stringify(info));
    await page.screenshot({ path: path.join(OUT, '03-mail-after.png'), fullPage: false });

    await page.goto(`${BASE}/hr/ocr-suite`, { waitUntil: 'networkidle2', timeout: 60000 });
    await new Promise((r) => setTimeout(r, 1500));
    info = await sidebarInfo(page);
    record('ocr-gai-docs', !info.hasHrSystemLabel && (info.hasGai || info.ctx === 'gai-docs'), JSON.stringify(info));
    await page.screenshot({ path: path.join(OUT, '04-ocr-gai-docs.png'), fullPage: false });

    await page.goto(`${BASE}/finance/payment-terms.html`, { waitUntil: 'networkidle2', timeout: 60000 });
    await new Promise((r) => setTimeout(r, 1500));
    info = await sidebarInfo(page);
    const financeText = await page.evaluate(() => document.body.innerText || '');
    record('finance-page-not-gai', !info.hasGai && !financeText.includes('التكامل الإداري المحكوم'), JSON.stringify(info));
    await page.screenshot({ path: path.join(OUT, '05-finance-moved-gai.png'), fullPage: false });

    await page.goto(`${BASE}/hr/employees`, { waitUntil: 'networkidle2', timeout: 60000 });
    await new Promise((r) => setTimeout(r, 1500));
    info = await sidebarInfo(page);
    record('hr-moved-gai', !info.hasHrSystemLabel && (info.ctx === 'gai-hr' || info.hasGai), JSON.stringify(info));
    await page.screenshot({ path: path.join(OUT, '06-hr-moved-gai.png'), fullPage: false });

    await page.goto(`${BASE}/hr/employee-360`, { waitUntil: 'networkidle2', timeout: 60000 });
    await new Promise((r) => setTimeout(r, 1500));
    info = await sidebarInfo(page);
    record('hr-keep-still-hr', info.hasHrSystemLabel || info.ctx === 'hr', JSON.stringify(info));
    await page.screenshot({ path: path.join(OUT, '07-hr-keep-employee-360.png'), fullPage: false });

    await page.goto(`${BASE}/finance/expenses.html`, { waitUntil: 'networkidle2', timeout: 60000 });
    await new Promise((r) => setTimeout(r, 1200));
    record('finance-keep-open', /expenses/.test(page.url()), page.url());
    await page.screenshot({ path: path.join(OUT, '08-finance-keep-expenses.png'), fullPage: false });
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
