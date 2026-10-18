'use strict';

/** Assert HR module-card icon glyphs are pure white on red squares. */
const http = require('http');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');

const BASE = process.env.APP_BASE_URL || 'http://127.0.0.1:3010';
const ART = '/opt/cursor/artifacts';
fs.mkdirSync(ART, { recursive: true });

const results = [];
function pass(n, d = '') { results.push({ n, ok: true, d }); console.log(`PASS  ${n}${d ? ` — ${d}` : ''}`); }
function fail(n, d = '') { results.push({ n, ok: false, d }); console.log(`FAIL  ${n}${d ? ` — ${d}` : ''}`); }

function isWhite(color) {
  const m = String(color || '').match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
  if (!m) return /#fff(fff)?/i.test(String(color));
  return Number(m[1]) >= 250 && Number(m[2]) >= 250 && Number(m[3]) >= 250;
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
        try { resolve(JSON.parse(raw)); } catch { resolve({}); }
      });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

(async () => {
  const browser = await puppeteer.launch({
    executablePath: process.env.CHROME_PATH || '/usr/local/bin/google-chrome',
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1440,900']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  try {
    const login = await postJson('/api/auth/login', { email: 'admin@naiosh.com', password: 'Admin@123' });
    const session = login.data?.session;
    const token = (session && typeof session === 'object' ? session.token : session) || login.data?.token;
    if (!token) throw new Error('login failed');

    await page.goto(`${BASE}/login-page.html`, { waitUntil: 'domcontentloaded' });
    await page.evaluate((t, u) => {
      localStorage.setItem('authToken', t);
      sessionStorage.setItem('authToken', t);
      localStorage.setItem('user', JSON.stringify(u || {}));
      document.cookie = `authToken=${encodeURIComponent(t)}; path=/`;
    }, token, login.data.user);

    // HR home — all icons
    await page.goto(`${BASE}/hr`, { waitUntil: 'networkidle2', timeout: 60000 });
    await page.waitForSelector('.finance-links > a > i:first-child');
    await page.$eval('#hr-sections .finance-links, .finance-links', (el) => el.scrollIntoView({ block: 'start' }));
    await new Promise((r) => setTimeout(r, 300));
    await page.screenshot({ path: path.join(ART, 'hr-card-icons-white-home.png'), fullPage: false });

    const homeIcons = await page.evaluate(() => [...document.querySelectorAll('.finance-links > a > i:first-child')].map((i) => {
      const cs = getComputedStyle(i);
      return {
        color: cs.color,
        fill: cs.webkitTextFillColor || cs.fill,
        bg: cs.backgroundImage || cs.backgroundColor,
        cls: i.className
      };
    }));
    homeIcons.length ? pass('home-icon-count', String(homeIcons.length)) : fail('home-icon-count');
    const badHome = homeIcons.filter((x) => !isWhite(x.color) || !isWhite(x.fill));
    badHome.length === 0 ? pass('home-icons-white') : fail('home-icons-white', JSON.stringify(badHome.slice(0, 3)));
    /dc2626|991b1b|rgb\(220,\s*38,\s*38\)/i.test(homeIcons[0]?.bg || '')
      ? pass('home-icon-box-red')
      : fail('home-icon-box-red', homeIcons[0]?.bg);

    // Hover state
    await page.hover('.finance-links > a');
    const hoverColor = await page.evaluate(() => getComputedStyle(document.querySelector('.finance-links > a > i:first-child')).color);
    isWhite(hoverColor) ? pass('home-hover-white', hoverColor) : fail('home-hover-white', hoverColor);

    // ESS employee home
    const empLogin = await postJson('/api/auth/login', {
      email: 'pract-emp-1792342254297@test.local',
      password: 'Employee@123'
    });
    const empSession = empLogin.data?.session;
    const empToken = (empSession && typeof empSession === 'object' ? empSession.token : empSession) || empLogin.data?.token;
    await page.evaluate((t, u) => {
      localStorage.setItem('authToken', t);
      sessionStorage.setItem('authToken', t);
      localStorage.setItem('user', JSON.stringify(u || {}));
      document.cookie = `authToken=${encodeURIComponent(t)}; path=/`;
    }, empToken, empLogin.data.user);
    await page.goto(`${BASE}/hr`, { waitUntil: 'networkidle2' });
    await page.waitForSelector('.finance-links > a > i:first-child');
    await page.screenshot({ path: path.join(ART, 'hr-card-icons-white-ess.png'), fullPage: false });
    const ess = await page.evaluate(() => [...document.querySelectorAll('.finance-links > a > i:first-child')].map((i) => getComputedStyle(i).color));
    ess.every(isWhite) ? pass('ess-icons-white', String(ess.length)) : fail('ess-icons-white', JSON.stringify(ess));

    // My requests (admin session again)
    await page.evaluate((t, u) => {
      localStorage.setItem('authToken', t);
      sessionStorage.setItem('authToken', t);
      localStorage.setItem('user', JSON.stringify(u || {}));
      document.cookie = `authToken=${encodeURIComponent(t)}; path=/`;
    }, token, login.data.user);
    await page.goto(`${BASE}/hr/my-requests`, { waitUntil: 'networkidle2' });
    await page.waitForSelector('#requestTypesGrid > button > i:first-child, .erp-module-nav-cards > button > i:first-child');
    await page.$eval('#requestTypesGrid', (el) => el.scrollIntoView({ block: 'start' }));
    await page.screenshot({ path: path.join(ART, 'hr-card-icons-white-requests.png'), fullPage: false });
    const req = await page.evaluate(() => [...document.querySelectorAll('#requestTypesGrid > button > i:first-child')].map((i) => getComputedStyle(i).color));
    req.every(isWhite) ? pass('requests-icons-white', String(req.length)) : fail('requests-icons-white', JSON.stringify(req.slice(0, 3)));

    // Finance not changed — still has its own markup; just ensure file markers intact
    const fin = fs.readFileSync(path.join(__dirname, 'finance/index.html'), 'utf8');
    /min-height:\s*176px/.test(fin) ? pass('finance-untouched') : fail('finance-untouched');
  } catch (err) {
    fail('suite-error', err.message);
    console.error(err);
  } finally {
    await browser.close();
  }

  const summary = { passed: results.filter((r) => r.ok).length, failed: results.filter((r) => !r.ok).length, results };
  fs.writeFileSync(path.join(ART, 'hr-card-icon-white-report.json'), JSON.stringify(summary, null, 2));
  console.log('\n=== SUMMARY ===');
  console.log(JSON.stringify(summary, null, 2));
  process.exit(summary.failed ? 1 : 0);
})();
