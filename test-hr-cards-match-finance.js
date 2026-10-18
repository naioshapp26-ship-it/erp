'use strict';

/**
 * Visual/structural parity: HR module cards vs Finance reference cards.
 */
const fs = require('fs');
const path = require('path');
const http = require('http');
const puppeteer = require('puppeteer-core');

const BASE = process.env.APP_BASE_URL || process.env.TEST_BASE_URL || 'http://127.0.0.1:3010';
const ART = '/opt/cursor/artifacts';
const SHOTS = path.join(ART, 'screenshots');
fs.mkdirSync(SHOTS, { recursive: true });

const ADMIN = {
  email: process.env.TEST_USER || 'admin@naiosh.com',
  password: process.env.TEST_PASS || 'Admin@123'
};
const EMPLOYEE = {
  email: process.env.HR_ESS_EMPLOYEE_EMAIL || 'pract-emp-1792342254297@test.local',
  password: process.env.HR_ESS_EMPLOYEE_PASSWORD || 'Employee@123'
};
const MANAGER = {
  email: process.env.HR_ESS_MANAGER_EMAIL || 'hr-manager@test.local',
  password: process.env.HR_ESS_MANAGER_PASSWORD || 'Manager@123'
};

const VIEWPORT = { width: 1440, height: 900 };
const MOBILE = { width: 390, height: 844 };
const results = [];

function pass(name, detail = '') {
  results.push({ name, ok: true, detail });
  console.log(`PASS  ${name}${detail ? ` — ${detail}` : ''}`);
}
function fail(name, detail = '') {
  results.push({ name, ok: false, detail });
  console.log(`FAIL  ${name}${detail ? ` — ${detail}` : ''}`);
}

function postJson(urlPath, body) {
  return new Promise((resolve, reject) => {
    const u = new URL(urlPath, BASE);
    const payload = JSON.stringify(body);
    const req = http.request({
      hostname: u.hostname,
      port: u.port || 80,
      path: u.pathname,
      method: 'POST',
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

async function login(email, password) {
  const res = await postJson('/api/auth/login', { email, password });
  if (!res.json?.success) throw new Error(`login failed ${email}: ${res.raw?.slice(0, 180)}`);
  const session = res.json.data.session;
  const token = (session && typeof session === 'object' ? session.token : session) || res.json.data.token;
  return { token, user: res.json.data.user };
}

async function inject(page, token, user) {
  await page.goto(`${BASE}/login-page.html`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.evaluate((t, u) => {
    localStorage.setItem('authToken', t);
    sessionStorage.setItem('authToken', t);
    localStorage.setItem('user', JSON.stringify(u));
    sessionStorage.setItem('user', JSON.stringify(u));
    document.cookie = `authToken=${encodeURIComponent(t)}; path=/`;
  }, token, user);
}

async function shot(page, name) {
  const file = path.join(SHOTS, name);
  await page.screenshot({ path: file, fullPage: false });
  fs.copyFileSync(file, path.join(ART, name));
}

async function measureCard(page, selector) {
  return page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const cs = getComputedStyle(el);
    const icon = el.querySelector('i:first-child, .settings-tile-icon, .icon-wrap');
    const iconCs = icon ? getComputedStyle(icon) : null;
    const rect = el.getBoundingClientRect();
    return {
      minHeight: parseFloat(cs.minHeight) || rect.height,
      height: rect.height,
      borderRadius: cs.borderRadius,
      background: cs.backgroundColor,
      boxShadow: cs.boxShadow,
      flexDirection: cs.flexDirection,
      iconW: iconCs ? parseFloat(iconCs.width) : null,
      iconH: iconCs ? parseFloat(iconCs.height) : null,
      iconRadius: iconCs ? iconCs.borderRadius : null,
      iconBg: iconCs ? (iconCs.backgroundImage || iconCs.backgroundColor) : null,
      href: el.getAttribute('href') || null,
      text: (el.innerText || '').trim().slice(0, 80)
    };
  }, selector);
}

function near(a, b, tol = 4) {
  return Math.abs(Number(a) - Number(b)) <= tol;
}

(async () => {
  const browser = await puppeteer.launch({
    executablePath: process.env.CHROME_PATH || '/usr/local/bin/google-chrome',
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1440,900']
  });
  const page = await browser.newPage();
  await page.setViewport(VIEWPORT);

  try {
    const admin = await login(ADMIN.email, ADMIN.password);
    await inject(page, admin.token, admin.user);
    pass('admin-login');

    // Finance reference
    await page.goto(`${BASE}/finance`, { waitUntil: 'networkidle2', timeout: 60000 });
    await page.waitForSelector('.finance-links > a', { timeout: 20000 });
    await shot(page, 'finance-cards-reference.png');
    const fin = await measureCard(page, '.finance-links > a');
    fin ? pass('finance-card-present', `h=${fin.minHeight} r=${fin.borderRadius}`) : fail('finance-card-present');

    // HR home
    await page.goto(`${BASE}/hr`, { waitUntil: 'networkidle2', timeout: 60000 });
    await page.waitForSelector('.finance-links > a', { timeout: 25000 });
    await shot(page, 'hr-cards-after-redesign.png');
    const hr = await measureCard(page, '.finance-links > a');
    if (!hr || !fin) {
      fail('hr-card-present');
    } else {
      pass('hr-card-present', `h=${hr.minHeight} r=${hr.borderRadius}`);
      near(hr.minHeight, fin.minHeight, 8) ? pass('parity-min-height') : fail('parity-min-height', `${hr.minHeight} vs ${fin.minHeight}`);
      (String(hr.borderRadius).includes('20') || near(parseFloat(hr.borderRadius), parseFloat(fin.borderRadius), 2))
        ? pass('parity-radius')
        : fail('parity-radius', `${hr.borderRadius} vs ${fin.borderRadius}`);
      hr.flexDirection === 'column' ? pass('parity-column') : fail('parity-column', hr.flexDirection);
      (near(hr.iconW, fin.iconW, 4) && near(hr.iconH, fin.iconH, 4))
        ? pass('parity-icon-size')
        : fail('parity-icon-size', `${hr.iconW}x${hr.iconH} vs ${fin.iconW}x${fin.iconH}`);
      /dc2626|991b1b|rgb\(220,\s*38,\s*38\)/i.test(String(hr.iconBg))
        ? pass('parity-icon-red')
        : fail('parity-icon-red', String(hr.iconBg));
      String(hr.boxShadow || '').includes('rgba')
        ? pass('parity-shadow')
        : fail('parity-shadow', String(hr.boxShadow));
    }

    // Link integrity sample
    const hrefs = await page.evaluate(() =>
      [...document.querySelectorAll('.finance-links > a')].map((a) => a.getAttribute('href')).filter(Boolean)
    );
    hrefs.length ? pass('hr-links-count', String(hrefs.length)) : fail('hr-links-count');
    let broken = 0;
    for (const href of hrefs.slice(0, 12)) {
      const url = href.startsWith('http') ? href : `${BASE}${href}`;
      const res = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => null);
      const status = res ? res.status() : 0;
      if (!res || status >= 400) broken += 1;
    }
    broken === 0
      ? pass('hr-links-sample-ok', `checked ${Math.min(12, hrefs.length)}`)
      : fail('hr-links-sample-ok', `${broken} broken`);

    // Employee 360
    await inject(page, admin.token, admin.user);
    await page.goto(`${BASE}/hr/employee-360`, { waitUntil: 'networkidle2', timeout: 60000 });
    await page.waitForSelector('.roster-card, #rosterGrid', { timeout: 25000 }).catch(() => null);
    await shot(page, 'hr-employee-360-roster-cards.png');
    const roster = await measureCard(page, '.roster-card');
    roster && String(roster.borderRadius).includes('20')
      ? pass('employee-360-radius')
      : fail('employee-360-radius', roster ? roster.borderRadius : 'missing');
    const hasActions = await page.evaluate(() => !!document.querySelector('.open-360-btn'));
    hasActions ? pass('employee-360-actions-present') : fail('employee-360-actions-present');

    // Settings
    await page.goto(`${BASE}/hr/system-settings`, { waitUntil: 'networkidle2', timeout: 60000 });
    await page.waitForSelector('.settings-tile', { timeout: 20000 }).catch(() => null);
    const settings = await measureCard(page, '.settings-tile');
    settings && near(settings.minHeight, 176, 12)
      ? pass('settings-tile-height')
      : fail('settings-tile-height', settings ? String(settings.minHeight) : 'missing');
    await shot(page, 'hr-settings-cards.png');

    // My requests ESS cards
    await page.goto(`${BASE}/hr/my-requests`, { waitUntil: 'networkidle2', timeout: 60000 });
    await page.waitForSelector('#requestTypesGrid > button, #requestTypesGrid > a', { timeout: 20000 }).catch(() => null);
    const reqCard = await measureCard(page, '#requestTypesGrid > button, #requestTypesGrid > a');
    reqCard && reqCard.flexDirection === 'column' && near(reqCard.minHeight, 176, 12)
      ? pass('ess-request-cards')
      : fail('ess-request-cards', reqCard ? JSON.stringify(reqCard) : 'missing');
    await shot(page, 'hr-ess-request-cards.png');

    // Mobile HR
    await page.setViewport(MOBILE);
    await inject(page, admin.token, admin.user);
    await page.goto(`${BASE}/hr`, { waitUntil: 'networkidle2', timeout: 60000 });
    await page.waitForSelector('.finance-links > a', { timeout: 20000 });
    await shot(page, 'hr-cards-mobile.png');
    const cols = await page.evaluate(() => {
      const grid = document.querySelector('.finance-links');
      return grid ? getComputedStyle(grid).gridTemplateColumns.split(' ').filter(Boolean).length : 0;
    });
    cols === 1 ? pass('mobile-single-column') : fail('mobile-single-column', String(cols));

    // Manager / employee persona smoke (cards still render)
    await page.setViewport(VIEWPORT);
    for (const persona of [
      { label: 'manager', creds: MANAGER },
      { label: 'employee', creds: EMPLOYEE }
    ]) {
      try {
        const sess = await login(persona.creds.email, persona.creds.password);
        await inject(page, sess.token, sess.user);
        await page.goto(`${BASE}/hr`, { waitUntil: 'networkidle2', timeout: 60000 });
        await page.waitForSelector('.finance-links > a, .hr-home-empty, #hr-sections', { timeout: 20000 });
        const count = await page.evaluate(() => document.querySelectorAll('.finance-links > a').length);
        count > 0
          ? pass(`${persona.label}-cards-visible`, String(count))
          : fail(`${persona.label}-cards-visible`, '0 cards');
        await shot(page, `hr-cards-${persona.label}.png`);
      } catch (err) {
        fail(`${persona.label}-cards-visible`, err.message);
      }
    }

    // Finance source markers untouched
    const finSrc = fs.readFileSync(path.join(__dirname, 'finance/index.html'), 'utf8');
    (/min-height:\s*176px/.test(finSrc) && /border-radius:\s*20px/.test(finSrc))
      ? pass('finance-source-untouched-markers')
      : fail('finance-source-untouched-markers');
  } catch (err) {
    fail('suite-error', err.message);
    console.error(err);
  } finally {
    await browser.close();
  }

  const failed = results.filter((r) => !r.ok);
  const summary = {
    base: BASE,
    passed: results.filter((r) => r.ok).length,
    failed: failed.length,
    results
  };
  fs.writeFileSync(path.join(ART, 'hr-cards-match-finance-report.json'), JSON.stringify(summary, null, 2));
  console.log('\n=== SUMMARY ===');
  console.log(JSON.stringify(summary, null, 2));
  process.exit(failed.length ? 1 : 0);
})();
