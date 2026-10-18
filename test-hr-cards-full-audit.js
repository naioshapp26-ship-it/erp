'use strict';

/**
 * Full HR functional-card audit vs Finance reference.
 * Tests every manager home card link + employee ESS cards + secondary card pages.
 */
const fs = require('fs');
const path = require('path');
const http = require('http');
const puppeteer = require('puppeteer-core');

const BASE = process.env.APP_BASE_URL || process.env.TEST_BASE_URL || 'http://127.0.0.1:3010';
const ART = '/opt/cursor/artifacts';
const SHOTS = path.join(ART, 'screenshots');
fs.mkdirSync(SHOTS, { recursive: true });

const ADMIN = { email: 'admin@naiosh.com', password: 'Admin@123' };
const MANAGER = { email: 'hr-manager@test.local', password: 'Manager@123' };
const EMPLOYEE = {
  email: process.env.HR_ESS_EMPLOYEE_EMAIL || 'pract-emp-1792342254297@test.local',
  password: process.env.HR_ESS_EMPLOYEE_PASSWORD || 'Employee@123'
};

const FINANCE_EXPECT = {
  minHeight: 176,
  radius: 20,
  icon: 48,
  flex: 'column'
};

const results = [];
const pageInventory = [];
const excluded = [];

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

function getJson(urlPath, token) {
  return new Promise((resolve, reject) => {
    const u = new URL(urlPath, BASE);
    const req = http.request({
      hostname: u.hostname, port: u.port || 80, path: `${u.pathname}${u.search}`, method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        'x-entity-id': 'HQ001',
        'x-entity-type': 'HQ'
      }
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
    req.end();
  });
}

async function login(email, password) {
  const res = await postJson('/api/auth/login', { email, password });
  if (!res.json?.success) throw new Error(`login failed ${email}`);
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

function near(a, b, tol = 6) {
  return Math.abs(Number(a) - Number(b)) <= tol;
}

async function measureCards(page, selector) {
  return page.evaluate((sel) => {
    const nodes = [...document.querySelectorAll(sel)];
    return nodes.map((el) => {
      const cs = getComputedStyle(el);
      const icon = el.querySelector('i:first-child, .settings-tile-icon');
      const iconCs = icon ? getComputedStyle(icon) : null;
      const rect = el.getBoundingClientRect();
      const title = (el.querySelector('span')?.innerText || el.innerText || '').trim().split('\n')[0];
      return {
        href: el.getAttribute('href') || el.dataset?.href || null,
        title: title.slice(0, 60),
        minHeight: parseFloat(cs.minHeight) || rect.height,
        height: rect.height,
        width: rect.width,
        borderRadius: cs.borderRadius,
        flexDirection: cs.flexDirection,
        boxShadow: cs.boxShadow,
        background: cs.backgroundColor,
        iconW: iconCs ? parseFloat(iconCs.width) : null,
        iconH: iconCs ? parseFloat(iconCs.height) : null,
        iconBg: iconCs ? (iconCs.backgroundImage || iconCs.backgroundColor) : null,
        overflow: {
          titleClipped: !!(el.querySelector('span') && el.querySelector('span').scrollWidth > el.querySelector('span').clientWidth + 2)
        },
        dir: getComputedStyle(document.documentElement).direction
      };
    });
  }, selector);
}

function assertFinanceStyle(card, label) {
  const issues = [];
  if (!near(card.minHeight, FINANCE_EXPECT.minHeight, 8)) issues.push(`minH ${card.minHeight}`);
  if (!(String(card.borderRadius).includes(String(FINANCE_EXPECT.radius)) || near(parseFloat(card.borderRadius), FINANCE_EXPECT.radius, 2))) {
    issues.push(`radius ${card.borderRadius}`);
  }
  if (card.flexDirection !== FINANCE_EXPECT.flex) issues.push(`flex ${card.flexDirection}`);
  if (!near(card.iconW, FINANCE_EXPECT.icon, 4) || !near(card.iconH, FINANCE_EXPECT.icon, 4)) {
    issues.push(`icon ${card.iconW}x${card.iconH}`);
  }
  if (!/dc2626|991b1b|rgb\(220,\s*38,\s*38\)/i.test(String(card.iconBg || ''))) issues.push(`iconBg`);
  if (!String(card.boxShadow || '').includes('rgba')) issues.push('shadow');
  if (card.dir !== 'rtl') issues.push(`dir ${card.dir}`);
  if (issues.length) fail(`style:${label}`, issues.join(', '));
  else pass(`style:${label}`, card.title || '');
  return issues.length === 0;
}

async function probeHref(page, href) {
  const url = href.startsWith('http') ? href : `${BASE}${href}`;
  const res = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 }).catch(() => null);
  const status = res ? res.status() : 0;
  const finalUrl = page.url();
  const bouncedToLogin = /login/i.test(finalUrl) && !/hr\//i.test(finalUrl);
  return { status, ok: !!res && status < 400 && !bouncedToLogin, finalUrl };
}

(async () => {
  const browser = await puppeteer.launch({
    executablePath: process.env.CHROME_PATH || '/usr/local/bin/google-chrome',
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1440,900']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  let linksTested = 0;
  let linksFailed = 0;

  try {
    const admin = await login(ADMIN.email, ADMIN.password);
    const manager = await login(MANAGER.email, MANAGER.password);
    const employee = await login(EMPLOYEE.email, EMPLOYEE.password);
    pass('logins');

    const adminHome = await getJson('/api/hr/home-modules', admin.token);
    const managerHome = await getJson('/api/hr/home-modules', manager.token);
    const employeeHome = await getJson('/api/hr/home-modules', employee.token);
    const adminMods = adminHome.json?.modules || [];
    const managerMods = managerHome.json?.modules || [];
    const employeeMods = employeeHome.json?.modules || [];

    pass('admin-home-count', String(adminMods.length));
    pass('manager-home-count', String(managerMods.length));
    managerMods.length === 28 ? pass('manager-expected-28') : fail('manager-expected-28', String(managerMods.length));
    employeeMods.length === 5 ? pass('employee-expected-5') : fail('employee-expected-5', String(employeeMods.length));
    employeeHome.json?.adminHidden === true ? pass('employee-admin-hidden') : fail('employee-admin-hidden');

    const adminBlocked = [
      '/hr/employees', '/hr/requests', '/hr/pending-actions', '/hr/manager',
      '/hr/system-settings', '/hr/reports', '/hr/new-hires', '/hr/payroll'
    ];
    const employeeHrefs = new Set(employeeMods.map((m) => m.href.split('?')[0]));
    const leak = adminBlocked.filter((h) => employeeHrefs.has(h));
    leak.length === 0 ? pass('employee-no-admin-cards') : fail('employee-no-admin-cards', leak.join(','));

    // Finance reference screenshot + style
    await inject(page, admin.token, admin.user);
    await page.goto(`${BASE}/finance`, { waitUntil: 'networkidle2', timeout: 60000 });
    await page.waitForSelector('.finance-links > a');
    await page.$eval('.finance-links', (el) => el.scrollIntoView({ block: 'start' }));
    await new Promise((r) => setTimeout(r, 300));
    await shot(page, 'audit-finance-home-cards.png');
    const finCards = await measureCards(page, '.finance-links > a');
    pageInventory.push({ page: '/finance', role: 'ref', cards: finCards.length, selector: '.finance-links > a' });
    finCards[0] && assertFinanceStyle(finCards[0], 'finance-ref');

    // HR home admin — all sections
    await page.goto(`${BASE}/hr`, { waitUntil: 'networkidle2', timeout: 60000 });
    await page.waitForSelector('.finance-links > a', { timeout: 25000 });
    await page.$eval('#hr-sections .finance-links, .finance-links', (el) => el.scrollIntoView({ block: 'start' }));
    await new Promise((r) => setTimeout(r, 300));
    await shot(page, 'audit-hr-home-cards.png');
    const hrCards = await measureCards(page, '#hr-sections .finance-links > a');
    pageInventory.push({
      page: '/hr',
      role: 'company_admin',
      cards: hrCards.length,
      sections: (adminHome.json?.sections || []).map((s) => ({ title: s.title, count: (s.cards || []).length }))
    });
    hrCards.length === adminMods.length
      ? pass('hr-home-dom-matches-api', `${hrCards.length}`)
      : fail('hr-home-dom-matches-api', `${hrCards.length} vs ${adminMods.length}`);
    let styleFail = 0;
    for (const [i, c] of hrCards.entries()) {
      if (!assertFinanceStyle(c, `hr-home-${i}`)) styleFail += 1;
    }
    styleFail === 0 ? pass('hr-home-all-styles') : fail('hr-home-all-styles', `${styleFail} bad`);

    // Manager: test ALL 28 links
    await inject(page, manager.token, manager.user);
    await page.goto(`${BASE}/hr`, { waitUntil: 'networkidle2', timeout: 60000 });
    await page.waitForSelector('.finance-links > a');
    const mgrDom = await measureCards(page, '#hr-sections .finance-links > a');
    pageInventory.push({ page: '/hr', role: 'manager', cards: mgrDom.length });
    mgrDom.length === 28 ? pass('manager-dom-28') : fail('manager-dom-28', String(mgrDom.length));
    await shot(page, 'audit-hr-home-manager.png');

    for (const mod of managerMods) {
      linksTested += 1;
      const probe = await probeHref(page, mod.href);
      if (probe.ok) pass(`mgr-link:${mod.href}`, String(probe.status));
      else {
        linksFailed += 1;
        fail(`mgr-link:${mod.href}`, `${probe.status} ${probe.finalUrl}`);
      }
    }

    // Employee: all 5 links + no admin cards in DOM
    await inject(page, employee.token, employee.user);
    await page.goto(`${BASE}/hr`, { waitUntil: 'networkidle2', timeout: 60000 });
    await page.waitForSelector('.finance-links > a, .hr-home-empty', { timeout: 20000 });
    const empDom = await measureCards(page, '#hr-sections .finance-links > a, .finance-links > a');
    pageInventory.push({ page: '/hr', role: 'employee', cards: empDom.length });
    empDom.length === 5 ? pass('employee-dom-5') : fail('employee-dom-5', String(empDom.length));
    await shot(page, 'audit-hr-home-employee.png');
    for (const c of empDom) assertFinanceStyle(c, `ess-${c.href}`);
    for (const mod of employeeMods) {
      linksTested += 1;
      const probe = await probeHref(page, mod.href);
      if (probe.ok) pass(`emp-link:${mod.href}`, String(probe.status));
      else {
        linksFailed += 1;
        fail(`emp-link:${mod.href}`, `${probe.status} ${probe.finalUrl}`);
      }
    }

    // Secondary functional-card pages
    await inject(page, admin.token, admin.user);
    const secondary = [
      { path: '/hr/system-settings', selector: '.settings-tile', shot: 'audit-hr-settings-cards.png', name: 'settings' },
      { path: '/hr/my-requests', selector: '#requestTypesGrid > button, #requestTypesGrid > a', shot: 'audit-hr-my-requests-cards.png', name: 'my-requests' },
      { path: '/hr/manager', selector: '#statGrid.finance-links > a, .finance-links > a', shot: 'audit-hr-manager-dashboard-cards.png', name: 'manager-dashboard' },
      { path: '/hr/operations', selector: '.finance-links > a, .hr-hub-links > a', shot: 'audit-hr-ops-hub-cards.png', name: 'ops-workspace', optional: true },
      { path: '/hr/employee-360', selector: '.roster-card', shot: 'audit-hr-employee-360-roster.png', name: 'employee-360-roster', roster: true }
    ];

    for (const item of secondary) {
      await page.goto(`${BASE}${item.path}`, { waitUntil: 'networkidle2', timeout: 60000 }).catch(() => null);
      const found = await page.waitForSelector(item.selector, { timeout: 15000 }).then(() => true).catch(() => false);
      if (!found) {
        if (item.optional) {
          excluded.push({ page: item.path, reason: 'no functional-card grid on this ops key/route variant' });
          pass(`secondary:${item.name}:skipped`);
          continue;
        }
        fail(`secondary:${item.name}:missing`);
        continue;
      }
      await page.$eval(item.selector, (el) => el.scrollIntoView({ block: 'center' })).catch(() => null);
      await new Promise((r) => setTimeout(r, 250));
      await shot(page, item.shot);
      const cards = await measureCards(page, item.selector);
      pageInventory.push({ page: item.path, role: 'admin', cards: cards.length, selector: item.selector });
      if (item.roster) {
        // Roster: preserve photo circle + actions; soft finance chrome only
        const photo = await page.evaluate(() => {
          const el = document.querySelector('.roster-photo');
          if (!el) return null;
          const cs = getComputedStyle(el);
          return { radius: cs.borderRadius, hasImg: !!el.querySelector('img'), hasOpen: !!document.querySelector('.open-360-btn'), hasEdit: !!document.querySelector('.edit-emp-btn') };
        });
        photo && (photo.radius === '50%' || parseFloat(photo.radius) >= 30)
          ? pass('e360-photo-circular')
          : fail('e360-photo-circular', photo ? photo.radius : 'missing');
        photo?.hasOpen ? pass('e360-open-btn') : fail('e360-open-btn');
        photo?.hasEdit ? pass('e360-edit-btn') : fail('e360-edit-btn');
        cards[0] && String(cards[0].borderRadius).includes('20')
          ? pass('e360-card-radius')
          : fail('e360-card-radius', cards[0]?.borderRadius);
      } else {
        let bad = 0;
        for (const [i, c] of cards.entries()) {
          if (!assertFinanceStyle(c, `${item.name}-${i}`)) bad += 1;
        }
        bad === 0 ? pass(`secondary:${item.name}:styles`, `${cards.length} cards`) : fail(`secondary:${item.name}:styles`, `${bad}/${cards.length}`);
        // probe each href on secondary nav cards
        for (const c of cards) {
          if (!c.href) continue;
          linksTested += 1;
          const probe = await probeHref(page, c.href);
          if (probe.ok) pass(`sec-link:${c.href}`, String(probe.status));
          else {
            linksFailed += 1;
            fail(`sec-link:${c.href}`, `${probe.status}`);
          }
        }
      }
    }

    // Portal workflows quick links (if reachable)
    await page.goto(`${BASE}/hr/operations`, { waitUntil: 'networkidle2', timeout: 60000 }).catch(() => null);
    // Try portal-workflows route variants
    for (const p of ['/hr/portal-workflows', '/finance/hr-portal-workflows.html']) {
      const res = await page.goto(`${BASE}${p}`, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => null);
      if (res && res.status() < 400 && await page.$('.hr-quick-links-grid > a, .finance-links.hr-quick-links-grid > a')) {
        const cards = await measureCards(page, '.hr-quick-links-grid > a, .finance-links.hr-quick-links-grid > a');
        pageInventory.push({ page: p, role: 'admin', cards: cards.length });
        await shot(page, 'audit-hr-portal-workflows-cards.png');
        cards.forEach((c, i) => assertFinanceStyle(c, `workflows-${i}`));
        break;
      }
    }

    // Mobile + overflow
    await inject(page, admin.token, admin.user);
    await page.setViewport({ width: 390, height: 844 });
    await page.goto(`${BASE}/hr`, { waitUntil: 'networkidle2', timeout: 60000 });
    await page.waitForSelector('.finance-links > a');
    await page.$eval('.finance-links', (el) => el.scrollIntoView({ block: 'start' }));
    await shot(page, 'audit-hr-home-mobile.png');
    const mobileMeta = await page.evaluate(() => {
      const grid = document.querySelector('.finance-links');
      const card = document.querySelector('.finance-links > a');
      const span = card?.querySelector('span');
      return {
        cols: grid ? getComputedStyle(grid).gridTemplateColumns.split(' ').filter(Boolean).length : 0,
        overflowX: document.documentElement.scrollWidth > window.innerWidth + 2,
        titleOverflow: span ? span.scrollHeight > span.clientHeight + 4 && span.scrollWidth > span.clientWidth + 4 : false,
        dir: document.documentElement.dir
      };
    });
    mobileMeta.cols === 1 ? pass('mobile-1-col') : fail('mobile-1-col', String(mobileMeta.cols));
    !mobileMeta.overflowX ? pass('mobile-no-h-scroll') : fail('mobile-no-h-scroll');
    mobileMeta.dir === 'rtl' ? pass('mobile-rtl') : fail('mobile-rtl', mobileMeta.dir);

    // Document intentional exclusions
    excluded.push(
      { page: 'hub KPI/stat widgets (attendance/payroll/performance hubs)', reason: 'مؤشرات تشغيلية/إحصائية وليست بطاقات تنقل وظيفية بنمط المالية' },
      { page: 'hero quick-link chips on /hr/manager dark banner', reason: 'أزرار شفافة فوق بانر داكن؛ البطاقات الوظيفية البيضاء أسفلها تتبع نظام المالية' },
      { page: 'accepted-employees feature-card blocks', reason: 'بطاقات وصف تسويقية داخل الصفحة وليست شبكة تنقل وظيفية' },
      { page: 'performance-hub tool-card tags', reason: 'وسوم أدوات تفاعلية داخل الصفحة وليست بطاقات تنقل' },
      { page: 'موظف 360 roster cards', reason: 'بطاقات ملفات موظفين (صورة/بيانات/أزرار) — متناسقة بصريًا مع الهوية دون تحويلها لبطاقات تنقل' }
    );

    // Compatibility markers for PR 177/178
    const homeSrc = fs.readFileSync(path.join(__dirname, 'finance/hr-home.html'), 'utf8');
    const e360Src = fs.readFileSync(path.join(__dirname, 'finance/hr-employee-360.html'), 'utf8');
    /hr-section-block|hr-section-title/.test(homeSrc) ? pass('compat-pr177-groups') : fail('compat-pr177-groups');
    /open-360-btn|edit-emp-btn|roster-photo|hr_employee_photo|عرض ملف 360/.test(e360Src)
      ? pass('compat-pr178-e360')
      : fail('compat-pr178-e360');

  } catch (err) {
    fail('suite-error', err.message);
    console.error(err);
  } finally {
    await browser.close();
  }

  const summary = {
    base: BASE,
    passed: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok).length,
    linksTested,
    linksFailed,
    pagesReviewed: pageInventory.length,
    totalCardsCounted: pageInventory.reduce((n, p) => n + (p.cards || 0), 0),
    pageInventory,
    excluded,
    results
  };
  fs.writeFileSync(path.join(ART, 'hr-cards-full-audit-report.json'), JSON.stringify(summary, null, 2));
  console.log('\n=== FULL AUDIT SUMMARY ===');
  console.log(JSON.stringify({
    passed: summary.passed,
    failed: summary.failed,
    linksTested,
    linksFailed,
    pagesReviewed: summary.pagesReviewed,
    totalCardsCounted: summary.totalCardsCounted,
    excluded: excluded.length
  }, null, 2));
  process.exit(summary.failed ? 1 : 0);
})();
