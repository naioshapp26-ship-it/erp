'use strict';

/**
 * Finance home → HR «الصفحات المنقولة من المالية» relocation audit.
 */
const fs = require('fs');
const path = require('path');
const http = require('http');
const puppeteer = require('puppeteer-core');
const {
  FINANCE_HOME_MOVED_TO_HR,
  FINANCE_HOME_SKIPPED_AS_HR_DUPES,
  FINANCE_KEEP,
  buildPortalPayload
} = require('./hr-portal-access');

const BASE = process.env.APP_BASE_URL || process.env.TEST_BASE_URL || 'http://127.0.0.1:3010';
const ART = '/opt/cursor/artifacts';
fs.mkdirSync(ART, { recursive: true });

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

async function probe(page, href) {
  const url = href.startsWith('http') ? href : `${BASE}${href}`;
  const res = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 }).catch(() => null);
  const status = res ? res.status() : 0;
  return { status, ok: !!res && status < 400, finalUrl: page.url() };
}

(async () => {
  const browser = await puppeteer.launch({
    executablePath: process.env.CHROME_PATH || '/usr/local/bin/google-chrome',
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1440,900']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  const cardResults = [];

  try {
    const admin = await login('admin@naiosh.com', 'Admin@123');
    const manager = await login('hr-manager@test.local', 'Manager@123');
    const employee = await login(
      process.env.HR_ESS_EMPLOYEE_EMAIL || 'hr-employee@test.local',
      process.env.HR_ESS_EMPLOYEE_PASSWORD || 'Employee@123'
    );
    pass('logins');

    // Static source checks
    const financeHtml = fs.readFileSync(path.join(__dirname, 'finance/index.html'), 'utf8');
    /سيتم إضافة أنظمة وخدمات المالية 360 قريبًا\./.test(financeHtml)
      ? pass('finance-html-coming-soon')
      : fail('finance-html-coming-soon');
    !/href="\/finance\/expenses\.html"/.test(financeHtml)
      ? pass('finance-html-no-expense-card')
      : fail('finance-html-no-expense-card');
    FINANCE_KEEP.length === 8 ? pass('finance-keep-catalog-8') : fail('finance-keep-catalog-8', String(FINANCE_KEEP.length));
    FINANCE_HOME_MOVED_TO_HR.length === 6 ? pass('moved-list-6') : fail('moved-list-6');
    FINANCE_HOME_SKIPPED_AS_HR_DUPES.length === 2 ? pass('skipped-dupes-2') : fail('skipped-dupes-2');

    const adminPortal = buildPortalPayload(admin.user?.role || 'admin');
    const mgrPortal = buildPortalPayload(manager.user?.role || 'manager');
    const empPortal = buildPortalPayload(employee.user?.role || 'employee');
    const movedAdmin = (adminPortal.sections || []).find((s) => s.id === 'moved-from-finance');
    const movedMgr = (mgrPortal.sections || []).find((s) => s.id === 'moved-from-finance');
    movedAdmin?.cards?.length === 6 ? pass('api-admin-moved-6') : fail('api-admin-moved-6', String(movedAdmin?.cards?.length));
    movedMgr?.cards?.length === 6 ? pass('api-manager-moved-6') : fail('api-manager-moved-6', String(movedMgr?.cards?.length));
    !(empPortal.sections || []).some((s) => s.id === 'moved-from-finance')
      ? pass('api-employee-no-moved-section')
      : fail('api-employee-no-moved-section');

    // No href duplicates between moved section and other HR sections
    const otherHrefs = new Set(
      (adminPortal.sections || [])
        .filter((s) => s.id !== 'moved-from-finance')
        .flatMap((s) => (s.cards || []).map((c) => c.href))
    );
    const dupInHr = (movedAdmin?.cards || []).filter((c) => otherHrefs.has(c.href));
    dupInHr.length === 0 ? pass('no-hr-href-duplicates') : fail('no-hr-href-duplicates', dupInHr.map((c) => c.href).join(','));

    // Finance UI empty
    await inject(page, admin.token, admin.user);
    await page.goto(`${BASE}/finance`, { waitUntil: 'networkidle2', timeout: 60000 });
    await page.waitForSelector('#finance-cards', { timeout: 20000 });
    await page.$eval('#finance-cards', (el) => el.scrollIntoView({ block: 'center' }));
    await new Promise((r) => setTimeout(r, 300));
    await page.screenshot({ path: path.join(ART, 'finance-home-after-empty.png'), fullPage: false });
    const finState = await page.evaluate(() => ({
      links: [...document.querySelectorAll('#finance-cards a[href]')].map((a) => a.getAttribute('href')),
      emptyText: (document.querySelector('[data-finance-empty], #finance-cards')?.innerText || '').trim(),
      title: document.querySelector('h1')?.innerText || ''
    }));
    finState.links.length === 0 ? pass('finance-dom-no-cards') : fail('finance-dom-no-cards', finState.links.join(','));
    /سيتم إضافة أنظمة وخدمات المالية 360 قريبًا/.test(finState.emptyText)
      ? pass('finance-dom-coming-soon')
      : fail('finance-dom-coming-soon', finState.emptyText.slice(0, 80));
    /المالية/.test(finState.title) ? pass('finance-page-title-kept') : fail('finance-page-title-kept', finState.title);

    // HR UI has moved section
    await page.goto(`${BASE}/hr`, { waitUntil: 'networkidle2', timeout: 60000 });
    await page.waitForSelector('[data-section-id="moved-from-finance"] .finance-links > a, .hr-section-block', { timeout: 25000 });
    const section = await page.$('[data-section-id="moved-from-finance"]');
    if (section) await section.evaluate((el) => el.scrollIntoView({ block: 'start' }));
    await new Promise((r) => setTimeout(r, 350));
    await page.screenshot({ path: path.join(ART, 'hr-home-moved-from-finance.png'), fullPage: false });

    const hrMoved = await page.evaluate(() => {
      const block = document.querySelector('[data-section-id="moved-from-finance"]');
      if (!block) return null;
      const title = block.querySelector('.hr-section-title')?.textContent?.trim() || '';
      const cards = [...block.querySelectorAll('.finance-links > a')].map((a) => {
        const icon = a.querySelector('i:first-child');
        const cs = icon ? getComputedStyle(icon) : null;
        return {
          href: a.getAttribute('href'),
          label: (a.querySelector('span')?.innerText || '').split('\n')[0].trim(),
          iconColor: cs?.color || null,
          iconBg: cs ? (cs.backgroundImage || cs.backgroundColor) : null
        };
      });
      return { title, cards };
    });
    hrMoved?.title === 'الصفحات المنقولة من المالية'
      ? pass('hr-section-title')
      : fail('hr-section-title', hrMoved?.title);
    hrMoved?.cards?.length === 6 ? pass('hr-dom-moved-6') : fail('hr-dom-moved-6', String(hrMoved?.cards?.length));

    // Existing HR groups still present
    const sectionIds = await page.evaluate(() =>
      [...document.querySelectorAll('.hr-section-block')].map((el) => el.getAttribute('data-section-id'))
    );
    ['employees-mgmt', 'attendance-payroll', 'performance-dev', 'requests-approvals', 'ops-services', 'moved-from-finance']
      .forEach((id) => (sectionIds.includes(id) ? pass(`hr-group-${id}`) : fail(`hr-group-${id}`)));

    // White icons on red for moved cards
    const badIcon = (hrMoved?.cards || []).find((c) => {
      const white = /rgb\(255,\s*255,\s*255\)|#fff/i.test(String(c.iconColor));
      const red = /dc2626|991b1b|rgb\(220,\s*38,\s*38\)/i.test(String(c.iconBg));
      return !(white && red);
    });
    !badIcon ? pass('moved-icons-white-on-red') : fail('moved-icons-white-on-red', JSON.stringify(badIcon));

    // Probe every moved card + skipped original paths (still work)
    for (const item of FINANCE_HOME_MOVED_TO_HR) {
      const probeRes = await probe(page, item.href);
      cardResults.push({ label: item.label, href: item.href, ...probeRes, kind: 'moved' });
      probeRes.ok
        ? pass(`moved-link:${item.href}`, String(probeRes.status))
        : fail(`moved-link:${item.href}`, `${probeRes.status} ${probeRes.finalUrl}`);
    }
    for (const item of FINANCE_HOME_SKIPPED_AS_HR_DUPES) {
      const probeRes = await probe(page, item.href);
      cardResults.push({ label: item.financeLabel, href: item.href, ...probeRes, kind: 'skipped-dupe-existing' });
      probeRes.ok
        ? pass(`dupe-link:${item.href}`, String(probeRes.status))
        : fail(`dupe-link:${item.href}`, String(probeRes.status));
    }

    // Manager sees moved cards; employee does not
    await inject(page, manager.token, manager.user);
    await page.goto(`${BASE}/hr`, { waitUntil: 'networkidle2', timeout: 60000 });
    const mgrCount = await page.evaluate(() =>
      document.querySelectorAll('[data-section-id="moved-from-finance"] .finance-links > a').length
    );
    mgrCount === 6 ? pass('manager-sees-moved-6') : fail('manager-sees-moved-6', String(mgrCount));

    await inject(page, employee.token, employee.user);
    await page.goto(`${BASE}/hr`, { waitUntil: 'networkidle2', timeout: 60000 });
    const empCount = await page.evaluate(() =>
      document.querySelectorAll('[data-section-id="moved-from-finance"] .finance-links > a').length
    );
    empCount === 0 ? pass('employee-no-moved') : fail('employee-no-moved', String(empCount));
    await page.screenshot({ path: path.join(ART, 'hr-home-employee-no-finance-moved.png'), fullPage: false });

    // Compat markers
    const homeSrc = fs.readFileSync(path.join(__dirname, 'finance/hr-home.html'), 'utf8');
    const e360Src = fs.readFileSync(path.join(__dirname, 'finance/hr-employee-360.html'), 'utf8');
    /hr-section-block/.test(homeSrc) ? pass('compat-pr177') : fail('compat-pr177');
    /open-360-btn|roster-photo/.test(e360Src) ? pass('compat-pr178') : fail('compat-pr178');
    fs.existsSync(path.join(__dirname, 'finance/erp-module-nav-cards.css'))
      ? pass('compat-pr179-css')
      : fail('compat-pr179-css');
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
    movedCards: FINANCE_HOME_MOVED_TO_HR,
    skippedDupes: FINANCE_HOME_SKIPPED_AS_HR_DUPES,
    cardResults,
    results
  };
  fs.writeFileSync(path.join(ART, 'finance-cards-moved-to-hr-report.json'), JSON.stringify(summary, null, 2));
  console.log('\n=== SUMMARY ===');
  console.log(JSON.stringify({
    passed: summary.passed,
    failed: summary.failed,
    moved: FINANCE_HOME_MOVED_TO_HR.length,
    skippedDupes: FINANCE_HOME_SKIPPED_AS_HR_DUPES.length,
    links: cardResults.length
  }, null, 2));
  process.exit(summary.failed ? 1 : 0);
})();
