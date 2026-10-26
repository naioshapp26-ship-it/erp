'use strict';

/**
 * Verify P1 catalog statuses match the approved functional-audit corrections.
 */
const fs = require('fs');
const path = require('path');
const http = require('http');
const puppeteer = require('puppeteer-core');
const catalog = require('./finance/finance-leadership-360-catalog');

const BASE = process.env.APP_BASE_URL || 'http://127.0.0.1:3010';
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
        resolve({ status: res.statusCode, json });
      });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

(async () => {
  const changes = [];

  // Critical audit corrections (updated after ops-complete close-out)
  const must = [
    ['sales', 'invoices-quotes', 'operational', 'الفواتير'],
    ['sales', 'quotes', 'operational', 'ترويج'],
    ['sales', 'deposits', 'operational', 'عربون'],
    ['sales', 'offers-discounts', 'operational', 'خصومات'],
    ['sales', 'zatca', 'operational', 'ضرائب'],
    ['sales', 'e-invoice', 'partial', 'إلكتروني'],
    ['purchases', 'vendors', 'partial', 'مصروف'],
    ['inventory', 'stock-vendors', 'partial', 'مصروف']
  ];

  must.forEach(([sid, pid, status, labelHint]) => {
    const page = catalog.getPage(sid, pid);
    if (!page) {
      fail(`page-exists:${sid}.${pid}`);
      return;
    }
    page.status === status ? pass(`status:${sid}.${pid}`, status) : fail(`status:${sid}.${pid}`, `${page.status}!=${status}`);
    if (labelHint && !new RegExp(labelHint).test(page.label + (page.note || ''))) {
      fail(`label-note:${sid}.${pid}`, page.label);
    } else {
      pass(`label-note:${sid}.${pid}`);
    }
    changes.push({
      id: `${sid}.${pid}`,
      label: page.label,
      status: catalog.STATUS_LABEL[page.status],
      href: catalog.resolveHref(page, sid),
      note: page.note || ''
    });
  });

  // Quotes must NOT claim sales quotations only as "عروض الأسعار" without clarification
  const quotes = catalog.getPage('sales', 'quotes');
  /ترويج|ليست عروض أسعار مبيعات/.test((quotes.label || '') + (quotes.note || ''))
    ? pass('quotes-not-sales-quote-claim')
    : fail('quotes-not-sales-quote-claim', quotes.label);

  // Deposits/discounts keep href (no page delete) but coming_soon badge
  const dep = catalog.getPage('sales', 'deposits');
  const disc = catalog.getPage('sales', 'offers-discounts');
  dep.href && disc.href ? pass('local-pages-href-preserved') : fail('local-pages-href-preserved');

  // Page settings: all 13 operational with real editor hrefs (batch-1 document settings)
  const psOps = catalog.PAGE_SETTINGS.filter((p) => p.status === 'operational');
  const psSoon = catalog.PAGE_SETTINGS.filter((p) => p.status === 'coming_soon');
  catalog.PAGE_SETTINGS.length === 13 ? pass('pagesettings-13') : fail('pagesettings-13');
  psOps.length === 13 ? pass('pagesettings-all-operational', String(psOps.length)) : fail('pagesettings-all-operational', String(psOps.length));
  psSoon.length === 0 ? pass('pagesettings-none-coming-soon') : fail('pagesettings-none-coming-soon', String(psSoon.length));
  psOps.every((p) => p.href && String(p.href).includes('leadership-doc-settings.html'))
    ? pass('pagesettings-editor-hrefs')
    : fail('pagesettings-editor-hrefs');

  // Quick access
  const qaAcc = catalog.QUICK_ACCESS.find((q) => q.id === 'qa-accounting');
  const qaInv = catalog.QUICK_ACCESS.find((q) => q.id === 'qa-invoices');
  qaAcc?.status === 'operational' && String(qaAcc.href || '').includes('accounting-integration')
    ? pass('qa-accounting-operational')
    : fail('qa-accounting-operational', JSON.stringify(qaAcc));
  qaInv?.status === 'operational' ? pass('qa-invoices-operational') : fail('qa-invoices-operational', qaInv?.status);

  // 16 sections intact
  catalog.SECTIONS.length === 16 ? pass('sections-16') : fail('sections-16');

  // No broken resolve for any page
  const flat = catalog.flattenPages();
  flat.every((r) => r.href && r.statusLabel) ? pass('all-pages-resolved', String(flat.length)) : fail('all-pages-resolved');

  // Expected map subset
  Object.entries(catalog.AUDIT_STATUS_EXPECTATIONS || {}).forEach(([key, expected]) => {
    const [scope, id] = key.split('.');
    let actual = null;
    if (scope === 'qa') {
      actual = catalog.QUICK_ACCESS.find((q) => q.id === id)?.status;
    } else if (scope === 'pagesettings') {
      actual = catalog.PAGE_SETTINGS.find((p) => p.id === id)?.status;
    } else {
      actual = catalog.getPage(scope, id)?.status;
    }
    actual === expected ? pass(`expect:${key}`) : fail(`expect:${key}`, `${actual}!=${expected}`);
  });

  fs.writeFileSync(path.join(ART, 'finance-leadership-catalog-corrections.json'), JSON.stringify({ changes, pageCount: flat.length }, null, 2));

  const browser = await puppeteer.launch({
    executablePath: process.env.CHROME_PATH || '/usr/local/bin/google-chrome',
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  try {
    const login = await postJson('/api/auth/login', { email: 'admin@naiosh.com', password: 'Admin@123' });
    if (!login.json?.success) throw new Error('login failed');
    const session = login.json.data.session;
    const token = (session && typeof session === 'object' ? session.token : session) || login.json.data.token;
    const user = login.json.data.user;
    await page.goto(`${BASE}/login-page.html`, { waitUntil: 'domcontentloaded' });
    await page.evaluate((t, u) => {
      localStorage.setItem('authToken', t);
      sessionStorage.setItem('authToken', t);
      localStorage.setItem('user', JSON.stringify(u));
      document.cookie = `authToken=${encodeURIComponent(t)}; path=/`;
    }, token, user);

    await page.setViewport({ width: 1440, height: 900 });
    await page.goto(`${BASE}/finance`, { waitUntil: 'networkidle2', timeout: 60000 });
    await page.waitForSelector('#fl360-nav');

    const ui = await page.evaluate(() => {
      const quick = [...document.querySelectorAll('#fl360-quick a')].map((a) => ({
        text: a.textContent.replace(/\s+/g, ' ').trim(),
        status: a.dataset.status
      }));
      return {
        nav: document.querySelectorAll('#fl360-nav .fl360-nav-btn').length,
        sections: document.querySelectorAll('#finance-cards .fl360-section-card').length,
        quick,
        hOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1
      };
    });
    ui.nav === 16 ? pass('ui-nav-16') : fail('ui-nav-16', String(ui.nav));
    ui.sections === 16 ? pass('ui-sections-16') : fail('ui-sections-16', String(ui.sections));
    ui.quick.find((q) => /إدارة الفواتير/.test(q.text) && q.status === 'partial')
      ? pass('ui-quick-invoices-partial')
      : fail('ui-quick-invoices-partial', JSON.stringify(ui.quick));
    !ui.hOverflow ? pass('ui-desktop-no-hscroll') : fail('ui-desktop-no-hscroll');
    await page.screenshot({ path: path.join(ART, 'finance-catalog-corrected-desktop.png'), fullPage: false });

    await page.click('#fl360-nav .fl360-nav-btn[data-section-id="sales"]');
    await new Promise((r) => setTimeout(r, 300));
    const sales = await page.evaluate(() => [...document.querySelectorAll('#fl360-pages a')].map((a) => ({
      label: a.querySelector('.font-black')?.textContent?.trim(),
      status: a.dataset.status,
      note: a.textContent
    })));
    const inv = sales.find((s) => /الفواتير/.test(s.label || ''));
    const dep = sales.find((s) => /عربون/.test(s.label || ''));
    const promo = sales.find((s) => /ترويج/.test(s.label || '') || /ترويج/.test(s.note || ''));
    inv?.status === 'partial' ? pass('ui-sales-invoices-partial') : fail('ui-sales-invoices-partial', JSON.stringify(inv));
    dep?.status === 'coming_soon' ? pass('ui-sales-deposits-soon') : fail('ui-sales-deposits-soon', JSON.stringify(dep));
    promo ? pass('ui-sales-promo-label') : fail('ui-sales-promo-label');
    await page.screenshot({ path: path.join(ART, 'finance-catalog-corrected-sales.png'), fullPage: false });

    await page.click('#fl360-nav .fl360-nav-btn[data-section-id="purchases"]');
    await new Promise((r) => setTimeout(r, 250));
    const purchases = await page.evaluate(() => [...document.querySelectorAll('#fl360-pages a')].map((a) => a.textContent.replace(/\s+/g, ' ')));
    purchases.some((t) => /موردو المصروفات/.test(t) && /جزئية/.test(t))
      ? pass('ui-purchases-expense-vendors')
      : fail('ui-purchases-expense-vendors', purchases[0] || '');
    await page.screenshot({ path: path.join(ART, 'finance-catalog-corrected-purchases.png'), fullPage: false });

    await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
    await page.goto(`${BASE}/finance`, { waitUntil: 'networkidle2', timeout: 60000 });
    const mob = await page.evaluate(() => ({
      nav: document.querySelectorAll('#fl360-nav .fl360-nav-btn').length,
      hOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1
    }));
    mob.nav === 16 && !mob.hOverflow ? pass('ui-mobile-ok') : fail('ui-mobile-ok', JSON.stringify(mob));
    await page.screenshot({ path: path.join(ART, 'finance-catalog-corrected-mobile.png'), fullPage: false });

    await page.setViewport({ width: 1440, height: 900 });
    await page.goto(`${BASE}/finance/leadership-page-settings.html`, { waitUntil: 'networkidle2', timeout: 60000 });
    const settings = await page.evaluate(() => ({
      total: document.querySelectorAll('#page-settings-list > *').length,
      ops: document.querySelectorAll('#page-settings-list a[data-status="operational"]').length,
      soon: document.querySelectorAll('#page-settings-list [data-status="coming_soon"]').length
    }));
    settings.total === 13 && settings.ops === 13 && settings.soon === 0
      ? pass('ui-settings-13')
      : fail('ui-settings-13', JSON.stringify(settings));
    await page.screenshot({ path: path.join(ART, 'finance-catalog-corrected-page-settings.png'), fullPage: false });

    // HR / archive smoke
    for (const p of ['/hr', '/archive', '/smart-management']) {
      await page.goto(`${BASE}${p}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
      const code = await page.evaluate(() => document.body && document.body.innerText.length > 20);
      code ? pass(`smoke:${p}`) : fail(`smoke:${p}`);
    }
  } catch (err) {
    fail('suite-error', err.message);
    console.error(err);
  } finally {
    await browser.close();
  }

  const md = [
    '# تصحيح كتالوج P1 — جدول التغييرات',
    '',
    '| المعرّف | المسمى بعد التصحيح | الحالة | الرابط | ملاحظة |',
    '|---|---|---|---|---|'
  ];
  changes.forEach((c) => {
    md.push(`| ${c.id} | ${c.label} | ${c.status} | \`${c.href}\` | ${c.note} |`);
  });
  md.push('', '## Quick access');
  catalog.QUICK_ACCESS.forEach((q) => {
    md.push(`- ${q.label}: **${catalog.STATUS_LABEL[q.status]}** — ${q.note || '—'}`);
  });
  fs.writeFileSync(path.join(ART, 'finance-leadership-catalog-corrections.md'), md.join('\n'));

  const summary = {
    passed: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok).length,
    results
  };
  fs.writeFileSync(path.join(ART, 'finance-leadership-catalog-audit-report.json'), JSON.stringify(summary, null, 2));
  console.log('\n=== SUMMARY ===');
  console.log(JSON.stringify({ passed: summary.passed, failed: summary.failed }, null, 2));
  process.exit(summary.failed ? 1 : 0);
})();
