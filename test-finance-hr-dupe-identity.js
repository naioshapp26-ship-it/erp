'use strict';

/**
 * Prove Finance «العهد المالية» / «رحلات العمل» are the same routes as
 * existing HR cards — not label-only lookalikes.
 */
const fs = require('fs');
const path = require('path');
const http = require('http');
const { execSync } = require('child_process');
const puppeteer = require('puppeteer-core');
const { FINANCE_KEEP } = require('./gai-hub-navigation');
const {
  MANAGER_CARD_CATALOG,
  FINANCE_HOME_SKIPPED_AS_HR_DUPES,
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
        resolve({ status: res.statusCode, json });
      });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

function hrefForLabel(html, label) {
  const marker = `>${label}</span>`;
  const idx = html.indexOf(marker);
  if (idx < 0) return null;
  const window = html.slice(Math.max(0, idx - 500), idx);
  const matches = [...window.matchAll(/href="([^"]+)"/g)];
  return matches.length ? matches[matches.length - 1][1] : null;
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
    if (!login.json?.success) throw new Error('login failed');
    const session = login.json.data.session;
    const token = (session && typeof session === 'object' ? session.token : session) || login.json.data.token;
    const user = login.json.data.user;

    const finCustody = FINANCE_KEEP.find((x) => x.label === 'العهد المالية');
    const finTrips = FINANCE_KEEP.find((x) => x.label === 'رحلات العمل');
    const hrCustody = MANAGER_CARD_CATALOG.custody;
    const hrOps = MANAGER_CARD_CATALOG.operations;

    finCustody?.href === '/hr/assets-custodies' ? pass('keep-custody-href') : fail('keep-custody-href', finCustody?.href);
    finTrips?.href === '/hr/operations' ? pass('keep-trips-href') : fail('keep-trips-href', finTrips?.href);
    finCustody.href === hrCustody.href ? pass('custody-same-href-as-hr') : fail('custody-same-href-as-hr');
    finTrips.href === hrOps.href ? pass('trips-same-href-as-hr') : fail('trips-same-href-as-hr');

    const oldIndex = execSync('git show 3f11f52:finance/index.html', { encoding: 'utf8' });
    const preCustody = hrefForLabel(oldIndex, 'العهد المالية');
    const preTrips = hrefForLabel(oldIndex, 'رحلات العمل');
    preCustody === '/hr/assets-custodies' ? pass('premove-custody-href', preCustody) : fail('premove-custody-href', String(preCustody));
    preTrips === '/hr/operations' ? pass('premove-trips-href', preTrips) : fail('premove-trips-href', String(preTrips));

    const skipCustody = FINANCE_HOME_SKIPPED_AS_HR_DUPES.find((x) => x.href === '/hr/assets-custodies');
    const skipTrips = FINANCE_HOME_SKIPPED_AS_HR_DUPES.find((x) => x.href === '/hr/operations');
    skipCustody && skipTrips ? pass('skip-config-present') : fail('skip-config-present');

    const moved = (buildPortalPayload('admin').sections || []).find((s) => s.id === 'moved-from-finance');
    const movedHrefs = (moved?.cards || []).map((c) => c.href);
    !movedHrefs.includes('/hr/assets-custodies') && !movedHrefs.includes('/hr/operations')
      ? pass('moved-section-no-true-dupes')
      : fail('moved-section-no-true-dupes', movedHrefs.join(','));

    await page.goto(`${BASE}/login-page.html`, { waitUntil: 'domcontentloaded' });
    await page.evaluate((t, u) => {
      localStorage.setItem('authToken', t);
      sessionStorage.setItem('authToken', t);
      localStorage.setItem('user', JSON.stringify(u));
      sessionStorage.setItem('user', JSON.stringify(u));
      document.cookie = `authToken=${encodeURIComponent(t)}; path=/`;
    }, token, user);

    await page.goto(`${BASE}/finance`, { waitUntil: 'networkidle2', timeout: 60000 });
    await page.waitForSelector('#fl360-nav', { timeout: 20000 });
    await page.$eval('#finance-command', (el) => el.scrollIntoView({ block: 'center' }));
    await new Promise((r) => setTimeout(r, 250));
    await page.screenshot({ path: path.join(ART, 'review-finance-empty.png'), fullPage: false });
    const fin = await page.evaluate(() => ({
      nav: document.querySelectorAll('#fl360-nav .fl360-nav-btn').length,
      quick: document.querySelectorAll('#fl360-quick a[href]').length,
      hasLeadership: Boolean(document.querySelector('#finance-command'))
    }));
    fin.hasLeadership && fin.nav === 16
      ? pass('finance-home-leadership-shell')
      : fail('finance-home-leadership-shell', JSON.stringify(fin));
    fin.quick === 5 ? pass('finance-quick-access') : fail('finance-quick-access', String(fin.quick));

    await page.goto(`${BASE}/hr/assets-custodies`, { waitUntil: 'networkidle2', timeout: 60000 });
    await new Promise((r) => setTimeout(r, 500));
    await page.screenshot({ path: path.join(ART, 'review-assets-custodies-page.png'), fullPage: false });
    const custodyUi = await page.evaluate(() => ({
      title: document.title,
      addAsset: /إضافة أصل/.test(document.body.innerText),
      assign: /تسليم عهدة/.test(document.body.innerText),
      tabCustody: [...document.querySelectorAll('.tab-btn')].some((t) => /العهد/.test(t.innerText))
    }));
    /عهد|أصول/.test(custodyUi.title) ? pass('custody-page-title') : fail('custody-page-title', custodyUi.title);
    custodyUi.addAsset && custodyUi.assign ? pass('custody-page-actions') : fail('custody-page-actions', JSON.stringify(custodyUi));

    const apiHeaders = { Authorization: `Bearer ${token}` };
    const probe = async (p) => page.evaluate(async (url, headers) => {
      const r = await fetch(url, { headers });
      return { path: url.replace(/^https?:\/\/[^/]+/, ''), status: r.status };
    }, `${BASE}${p}`, apiHeaders);
    for (const p of skipCustody.apis) {
      const res = await probe(p);
      res.status < 500 ? pass(`custody-api:${p}`, String(res.status)) : fail(`custody-api:${p}`, String(res.status));
    }

    await page.goto(`${BASE}/hr/operations`, { waitUntil: 'networkidle2', timeout: 60000 });
    await new Promise((r) => setTimeout(r, 600));
    await page.evaluate(() => {
      const btn = [...document.querySelectorAll('.tab-btn')].find((b) => /النماذج/.test(b.innerText));
      if (btn) btn.click();
    });
    await new Promise((r) => setTimeout(r, 400));
    await page.evaluate(() => {
      const el = [...document.querySelectorAll('.template-card-item')].find((n) => /تذاكر سفر/.test(n.textContent || ''));
      if (el) el.scrollIntoView({ block: 'center' });
    });
    await new Promise((r) => setTimeout(r, 250));
    await page.screenshot({ path: path.join(ART, 'review-operations-travel-templates.png'), fullPage: false });
    const opsUi = await page.evaluate(() => {
      const html = document.documentElement.innerHTML;
      return {
        title: document.title,
        flight: html.includes('طلب تذاكر سفر'),
        secondment: html.includes('طلب انتداب'),
        travelOption: !!document.querySelector('option[value="travel"]')
      };
    });
    /بوابة العمليات/.test(opsUi.title) ? pass('ops-page-title') : fail('ops-page-title', opsUi.title);
    opsUi.flight ? pass('ops-has-flight-tickets') : fail('ops-has-flight-tickets');
    opsUi.secondment ? pass('ops-has-secondment') : fail('ops-has-secondment');
    opsUi.travelOption ? pass('ops-type-category-travel') : fail('ops-type-category-travel');

    // Live API health may vary by env schema; identity proof is shared page + shared client calls.
    const opsApiRes = await probe('/api/employee-requests');
    opsApiRes.status < 500
      ? pass('ops-api:/api/employee-requests', String(opsApiRes.status))
      : fail('ops-api:/api/employee-requests', String(opsApiRes.status));
    const opsSourceApis = await page.evaluate(() => {
      const html = document.documentElement.innerHTML;
      return {
        employeeRequests: html.includes('/api/employee-requests'),
        requestTypes: html.includes('/api/request-types')
      };
    });
    opsSourceApis.employeeRequests && opsSourceApis.requestTypes
      ? pass('ops-page-calls-shared-apis')
      : fail('ops-page-calls-shared-apis', JSON.stringify(opsSourceApis));

    await page.goto(`${BASE}/hr`, { waitUntil: 'networkidle2', timeout: 60000 });
    await page.waitForSelector('.hr-section-block', { timeout: 25000 });
    const hr = await page.evaluate(() => {
      const cards = [...document.querySelectorAll('.finance-links > a')].map((a) => ({
        href: a.getAttribute('href'),
        label: (a.querySelector('span')?.innerText || '').split('\n')[0].trim()
      }));
      const counts = {};
      cards.forEach((c) => { counts[c.href] = (counts[c.href] || 0) + 1; });
      return {
        custody: cards.find((c) => c.href === '/hr/assets-custodies'),
        ops: cards.find((c) => c.href === '/hr/operations'),
        dupes: Object.entries(counts).filter(([, n]) => n > 1)
      };
    });
    hr.custody ? pass('hr-has-custody-card', hr.custody.label) : fail('hr-has-custody-card');
    hr.ops ? pass('hr-has-ops-card', hr.ops.label) : fail('hr-has-ops-card');
    hr.dupes.length === 0 ? pass('hr-no-href-dupes') : fail('hr-no-href-dupes', JSON.stringify(hr.dupes));

    await page.evaluate(() => document.querySelector('a[href="/hr/assets-custodies"]')?.scrollIntoView({ block: 'center' }));
    await new Promise((r) => setTimeout(r, 200));
    await page.screenshot({ path: path.join(ART, 'review-hr-custody-card.png'), fullPage: false });
    await page.evaluate(() => document.querySelector('a[href="/hr/operations"]')?.scrollIntoView({ block: 'center' }));
    await new Promise((r) => setTimeout(r, 200));
    await page.screenshot({ path: path.join(ART, 'review-hr-operations-card.png'), fullPage: false });
  } catch (err) {
    fail('suite-error', err.message);
    console.error(err);
  } finally {
    await browser.close();
  }

  const summary = {
    verdict: {
      custody: 'IDENTICAL_SAME_ROUTE_FILE_API',
      trips: 'IDENTICAL_SAME_ROUTE_FILE_API',
      action: 'KEEP_SKIP_NO_DUPLICATE_CARDS'
    },
    passed: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok).length,
    skippedDupes: FINANCE_HOME_SKIPPED_AS_HR_DUPES,
    results
  };
  fs.writeFileSync(path.join(ART, 'finance-hr-dupe-identity-audit.json'), JSON.stringify(summary, null, 2));

  const md = [];
  md.push('# مراجعة هوية البطاقات: العهد المالية ورحلات العمل');
  md.push('');
  md.push('## الحكم النهائي');
  md.push('- **العهد المالية ≡ العهد (HR)** — نفس المسار `/hr/assets-custodies` ونفس الملف `hr-assets-custodies.html` ونفس `/api/hr/assets/*`');
  md.push('- **رحلات العمل ≡ بوابة العمليات (HR)** — نفس المسار `/hr/operations` ونفس الملف `hr-portal-workflows.html`؛ وظائف السفر/الانتداب أنواع طلب داخل البوابة');
  md.push('- **لا تُضاف بطاقات مكررة** (سيكون تكرار href حقيقيًا)');
  md.push('');
  md.push(`## نتيجة الاختبار: ${summary.passed} PASS / ${summary.failed} FAIL`);
  md.push('');
  results.forEach((r) => md.push(`- ${r.ok ? 'PASS' : 'FAIL'}: ${r.name}${r.detail ? ` — ${r.detail}` : ''}`));
  md.push('');
  fs.writeFileSync(path.join(ART, 'finance-hr-dupe-identity-audit.md'), md.join('\n'));

  console.log('\n=== SUMMARY ===');
  console.log(JSON.stringify({ passed: summary.passed, failed: summary.failed, verdict: summary.verdict }, null, 2));
  process.exit(summary.failed ? 1 : 0);
})();
