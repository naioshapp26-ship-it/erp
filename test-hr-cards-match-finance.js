'use strict';

/**
 * Visual/structural parity: HR module cards vs Finance reference cards.
 * Does not mutate data. Requires a running app (default :3000).
 */

const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const BASE = process.env.APP_BASE_URL || 'http://127.0.0.1:3000';
const ART = '/opt/cursor/artifacts';
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

async function login(page, user, passwd) {
  await page.goto(`${BASE}/login-page.html`, { waitUntil: 'networkidle2', timeout: 60000 });
  await page.type('#username, input[name="username"], input[type="text"]', user, { delay: 10 });
  await page.type('#password, input[name="password"], input[type="password"]', passwd, { delay: 10 });
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 60000 }).catch(() => null),
    page.click('button[type="submit"], .login-btn, #loginBtn')
  ]);
  const token = await page.evaluate(() => localStorage.getItem('authToken') || sessionStorage.getItem('authToken') || '');
  if (!token) {
    // API login fallback
    const data = await page.evaluate(async (u, p) => {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: u, password: p })
      });
      return res.json().catch(() => ({}));
    }, user, passwd);
    if (data.token) {
      await page.evaluate((t) => {
        localStorage.setItem('authToken', t);
        sessionStorage.setItem('authToken', t);
        document.cookie = `authToken=${t}; path=/`;
      }, data.token);
    }
  }
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
      borderRadius: cs.borderRadius,
      background: cs.backgroundColor,
      boxShadow: cs.boxShadow,
      flexDirection: cs.flexDirection,
      iconW: iconCs ? parseFloat(iconCs.width) : null,
      iconH: iconCs ? parseFloat(iconCs.height) : null,
      iconRadius: iconCs ? iconCs.borderRadius : null,
      iconBg: iconCs ? iconCs.backgroundImage || iconCs.backgroundColor : null,
      href: el.getAttribute('href') || null
    };
  }, selector);
}

function near(a, b, tol = 4) {
  return Math.abs(Number(a) - Number(b)) <= tol;
}

(async () => {
  fs.mkdirSync(ART, { recursive: true });
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1440,900']
  });
  const page = await browser.newPage();
  await page.setViewport(VIEWPORT);

  try {
    await login(page, process.env.TEST_USER || 'admin', process.env.TEST_PASS || 'admin123');

    // Finance reference
    await page.goto(`${BASE}/finance`, { waitUntil: 'networkidle2', timeout: 60000 });
    await page.waitForSelector('.finance-links > a', { timeout: 20000 });
    await page.screenshot({ path: path.join(ART, 'finance-cards-reference.png'), fullPage: false });
    const fin = await measureCard(page, '.finance-links > a');
    if (!fin) fail('finance-card-present');
    else pass('finance-card-present', `h=${fin.minHeight} r=${fin.borderRadius}`);

    // HR home
    await page.goto(`${BASE}/hr`, { waitUntil: 'networkidle2', timeout: 60000 });
    await page.waitForSelector('.finance-links > a', { timeout: 25000 });
    await page.screenshot({ path: path.join(ART, 'hr-cards-after-redesign.png'), fullPage: false });
    const hr = await measureCard(page, '.finance-links > a');
    if (!hr || !fin) {
      fail('hr-card-present');
    } else {
      pass('hr-card-present', `h=${hr.minHeight} r=${hr.borderRadius}`);
      near(hr.minHeight, fin.minHeight, 8) ? pass('parity-min-height') : fail('parity-min-height', `${hr.minHeight} vs ${fin.minHeight}`);
      String(hr.borderRadius).includes('20') || near(parseFloat(hr.borderRadius), parseFloat(fin.borderRadius), 2)
        ? pass('parity-radius')
        : fail('parity-radius', `${hr.borderRadius} vs ${fin.borderRadius}`);
      hr.flexDirection === 'column' ? pass('parity-column') : fail('parity-column', hr.flexDirection);
      near(hr.iconW, fin.iconW, 4) && near(hr.iconH, fin.iconH, 4)
        ? pass('parity-icon-size')
        : fail('parity-icon-size', `${hr.iconW}x${hr.iconH} vs ${fin.iconW}x${fin.iconH}`);
      /dc2626|991b1b|rgb\(220,\s*38,\s*38\)/i.test(String(hr.iconBg))
        ? pass('parity-icon-red')
        : fail('parity-icon-red', String(hr.iconBg));
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
    broken === 0 ? pass('hr-links-sample-ok', `checked ${Math.min(12, hrefs.length)}`) : fail('hr-links-sample-ok', `${broken} broken`);

    // Employee 360
    await page.goto(`${BASE}/hr/employee-360`, { waitUntil: 'networkidle2', timeout: 60000 });
    await page.waitForSelector('.roster-card, #rosterGrid', { timeout: 25000 }).catch(() => null);
    await page.screenshot({ path: path.join(ART, 'hr-employee-360-roster-cards.png'), fullPage: false });
    const roster = await measureCard(page, '.roster-card');
    roster && String(roster.borderRadius).includes('20')
      ? pass('employee-360-radius')
      : fail('employee-360-radius', roster ? roster.borderRadius : 'missing');

    // Mobile HR
    await page.setViewport(MOBILE);
    await page.goto(`${BASE}/hr`, { waitUntil: 'networkidle2', timeout: 60000 });
    await page.waitForSelector('.finance-links > a', { timeout: 20000 });
    await page.screenshot({ path: path.join(ART, 'hr-cards-mobile.png'), fullPage: false });
    const cols = await page.evaluate(() => {
      const grid = document.querySelector('.finance-links');
      return grid ? getComputedStyle(grid).gridTemplateColumns.split(' ').length : 0;
    });
    cols === 1 ? pass('mobile-single-column') : fail('mobile-single-column', String(cols));

    // Settings tiles
    await page.setViewport(VIEWPORT);
    await page.goto(`${BASE}/hr/system-settings`, { waitUntil: 'networkidle2', timeout: 60000 });
    await page.waitForSelector('.settings-tile', { timeout: 20000 }).catch(() => null);
    const settings = await measureCard(page, '.settings-tile');
    settings && near(settings.minHeight, 176, 12)
      ? pass('settings-tile-height')
      : fail('settings-tile-height', settings ? String(settings.minHeight) : 'missing');
    await page.screenshot({ path: path.join(ART, 'hr-settings-cards.png'), fullPage: false });

    // Finance unchanged smoke
    const finSrc = fs.readFileSync(path.join(__dirname, 'finance/index.html'), 'utf8');
    /min-height:\s*176px/.test(finSrc) && /border-radius:\s*20px/.test(finSrc)
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
