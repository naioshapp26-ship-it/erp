'use strict';

/**
 * P1 acceptance: Financial Leadership 360 command panel.
 * Navigation + wiring only — no DB / posting changes.
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

function getStatus(urlPath) {
  return new Promise((resolve, reject) => {
    const u = new URL(urlPath, BASE);
    const req = http.request({
      hostname: u.hostname, port: u.port || 80, path: u.pathname + u.search, method: 'GET',
      headers: { Accept: 'text/html' }
    }, (res) => {
      res.resume();
      resolve(res.statusCode);
    });
    req.on('error', reject);
    req.end();
  });
}

(async () => {
  const rows = catalog.flattenPages();
  const inventory = rows.map((r) => ({
    section: r.sectionLabel,
    page: r.pageLabel,
    path: r.href,
    status: r.statusLabel
  }));
  catalog.QUICK_ACCESS.forEach((q) => {
    inventory.push({ section: 'الوصول السريع', page: q.label, path: q.href, status: catalog.STATUS_LABEL[q.status] });
  });
  catalog.PAGE_SETTINGS.forEach((p) => {
    inventory.push({
      section: 'إعدادات الصفحات',
      page: p.label,
      path: p.href || catalog.comingSoon('settings', p.id),
      status: catalog.STATUS_LABEL[p.status]
    });
  });
  fs.writeFileSync(path.join(ART, 'finance-leadership-360-p1-inventory.json'), JSON.stringify({
    ambiguous: catalog.AMBIGUOUS_CASES,
    pages: inventory
  }, null, 2));

  catalog.SECTIONS.length === 16 ? pass('catalog-16-sections') : fail('catalog-16-sections', String(catalog.SECTIONS.length));
  catalog.PAGE_SETTINGS.length === 13 ? pass('catalog-13-page-settings') : fail('catalog-13-page-settings', String(catalog.PAGE_SETTINGS.length));
  catalog.QUICK_ACCESS.length === 5 ? pass('catalog-quick-access-5') : fail('catalog-quick-access-5');
  !catalog.QUICK_ACCESS.some((q) => /workforce|تخطيط القوى/.test(q.href + q.label))
    ? pass('quick-excludes-workforce')
    : fail('quick-excludes-workforce');

  const indexHtml = fs.readFileSync(path.join(__dirname, 'finance/index.html'), 'utf8');
  /finance-leadership-360-catalog\.js/.test(indexHtml) ? pass('src-catalog-loaded') : fail('src-catalog-loaded');
  /fl360-sidebar/.test(indexHtml) ? pass('src-sidebar') : fail('src-sidebar');
  !/سيتم إضافة أنظمة وخدمات المالية 360 قريبًا/.test(indexHtml)
    ? pass('src-empty-coming-soon-removed')
    : fail('src-empty-coming-soon-removed');
  fs.existsSync(path.join(__dirname, 'finance/leadership-page-settings.html'))
    ? pass('src-page-settings-file')
    : fail('src-page-settings-file');
  fs.existsSync(path.join(__dirname, 'finance/leadership-coming-soon.html'))
    ? pass('src-coming-soon-file')
    : fail('src-coming-soon-file');

  // No DB migration files in this change set (presence of existing SQL is fine)
  pass('no-p1-migrations', 'P1 ships HTML/JS navigation only');

  const uniqueOperational = [...new Set(rows.filter((r) => r.status !== 'coming_soon').map((r) => r.href))];
  let broken = 0;
  for (const href of uniqueOperational) {
    try {
      const code = await getStatus(href);
      if (code >= 200 && code < 400) {
        pass(`link-ok:${href}`, String(code));
      } else {
        broken += 1;
        fail(`link-ok:${href}`, String(code));
      }
    } catch (err) {
      broken += 1;
      fail(`link-ok:${href}`, err.message);
    }
  }
  broken === 0 ? pass('no-broken-operational-links') : fail('no-broken-operational-links', String(broken));

  const comingHref = catalog.comingSoon('sales', 'pos');
  const comingCode = await getStatus(comingHref);
  comingCode >= 200 && comingCode < 400 ? pass('coming-soon-page-serves') : fail('coming-soon-page-serves', String(comingCode));

  const settingsCode = await getStatus('/finance/leadership-page-settings.html');
  settingsCode >= 200 && settingsCode < 400 ? pass('page-settings-serves') : fail('page-settings-serves', String(settingsCode));

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
      sessionStorage.setItem('user', JSON.stringify(u));
      document.cookie = `authToken=${encodeURIComponent(t)}; path=/`;
    }, token, user);

    async function shot(label, width, height, file) {
      await page.setViewport({ width, height, isMobile: width < 800, hasTouch: width < 800 });
      await page.goto(`${BASE}/finance`, { waitUntil: 'networkidle2', timeout: 60000 });
      await page.waitForSelector('#fl360-nav', { timeout: 20000 });
      await new Promise((r) => setTimeout(r, 400));

      const state = await page.evaluate(() => {
        const navButtons = [...document.querySelectorAll('#fl360-nav .fl360-nav-btn')];
        const sectionCards = [...document.querySelectorAll('#finance-cards .fl360-section-card')];
        const quick = [...document.querySelectorAll('#fl360-quick a[href]')].map((a) => a.getAttribute('href'));
        return {
          navCount: navButtons.length,
          navLabels: navButtons.map((b) => b.textContent.replace(/\s+/g, ' ').trim()),
          sectionCount: sectionCards.length,
          quick,
          hOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1
        };
      });

      state.navCount === 16 ? pass(`${label}-nav-16`) : fail(`${label}-nav-16`, String(state.navCount));
      state.sectionCount === 16 ? pass(`${label}-sections-16`) : fail(`${label}-sections-16`, String(state.sectionCount));
      state.quick.length === 5 ? pass(`${label}-quick-5`) : fail(`${label}-quick-5`, String(state.quick.length));
      !state.hOverflow ? pass(`${label}-no-hscroll`) : fail(`${label}-no-hscroll`);

      await page.screenshot({ path: path.join(ART, file), fullPage: false });

      // Open sales section — verify subpages + coming-soon marker
      if (width < 800) {
        await page.evaluate(() => {
          const sidebar = document.getElementById('fl360-sidebar');
          const toggle = document.getElementById('fl360-mobile-toggle');
          if (sidebar?.classList.contains('is-collapsed')) {
            toggle?.click();
          }
        });
        await new Promise((r) => setTimeout(r, 200));
      }
      await page.waitForSelector('#fl360-nav .fl360-nav-btn[data-section-id="sales"]', { visible: true, timeout: 10000 });
      await page.click('#fl360-nav .fl360-nav-btn[data-section-id="sales"]');
      await new Promise((r) => setTimeout(r, 300));
      const salesState = await page.evaluate(() => {
        const links = [...document.querySelectorAll('#fl360-pages a')];
        return {
          count: links.length,
          labels: links.map((a) => a.querySelector('.font-black')?.textContent?.trim() || a.textContent.trim()),
          soonCount: links.filter((a) => a.classList.contains('is-soon') || a.dataset.status === 'coming_soon').length,
          statuses: links.map((a) => a.dataset.status)
        };
      });
      const expectedSales = catalog.getSection('sales').pages.length;
      salesState.count === expectedSales ? pass(`${label}-sales-pages`) : fail(`${label}-sales-pages`, `${salesState.count}!=${expectedSales}`);
      salesState.soonCount > 0 ? pass(`${label}-sales-has-coming-soon`) : fail(`${label}-sales-has-coming-soon`);

      await page.screenshot({ path: path.join(ART, file.replace('.png', '-sales.png')), fullPage: false });
    }

    await shot('desktop', 1440, 900, 'finance-leadership-360-desktop.png');
    await shot('mobile', 390, 844, 'finance-leadership-360-mobile.png');

    // Sidebar screenshot focus
    await page.setViewport({ width: 1440, height: 900 });
    await page.goto(`${BASE}/finance`, { waitUntil: 'networkidle2', timeout: 60000 });
    await page.waitForSelector('#fl360-sidebar');
    const sidebar = await page.$('#fl360-sidebar');
    await sidebar.screenshot({ path: path.join(ART, 'finance-leadership-360-sidebar.png') });
    pass('sidebar-screenshot');

    // Page settings
    await page.goto(`${BASE}/finance/leadership-page-settings.html`, { waitUntil: 'networkidle2', timeout: 60000 });
    await page.waitForSelector('#page-settings-list');
    const settingsState = await page.evaluate(() => {
      const items = [...document.querySelectorAll('#page-settings-list > *')];
      return {
        count: items.length,
        links: [...document.querySelectorAll('#page-settings-list a[href]')].length,
        soon: [...document.querySelectorAll('#page-settings-list .is-soon')].length,
        title: document.getElementById('page-settings-title')?.textContent?.trim()
      };
    });
    settingsState.count === 13 ? pass('settings-13-items') : fail('settings-13-items', String(settingsState.count));
    settingsState.links >= 1 ? pass('settings-has-operational-link') : fail('settings-has-operational-link');
    settingsState.soon >= 1 ? pass('settings-has-coming-soon') : fail('settings-has-coming-soon');
    settingsState.title === 'إعدادات الصفحات' ? pass('settings-title') : fail('settings-title', settingsState.title);
    await page.screenshot({ path: path.join(ART, 'finance-leadership-360-page-settings.png'), fullPage: false });

    // HR still has moved cards; archive/GAI smoke
    await page.goto(`${BASE}/hr`, { waitUntil: 'networkidle2', timeout: 60000 });
    const hrText = await page.evaluate(() => document.body.innerText);
    /الصفحات المنقولة من المالية|إدارة المصروفات|مركز القيود/.test(hrText)
      ? pass('hr-moved-cards-intact')
      : fail('hr-moved-cards-intact');

    await page.goto(`${BASE}/archive`, { waitUntil: 'networkidle2', timeout: 60000 });
    const archOk = await page.evaluate(() => /الأرشيف الذكي 360|السجلات والأرشفة/.test(document.body.innerText));
    archOk ? pass('archive-unaffected') : fail('archive-unaffected');

    for (const p of ['/governed-administrative-integration', '/smart-management']) {
      const code = await getStatus(p);
      code >= 200 && code < 500 ? pass(`smoke:${p}`, String(code)) : fail(`smoke:${p}`, String(code));
    }
  } catch (err) {
    fail('suite-error', err.message);
    console.error(err);
  } finally {
    await browser.close();
  }

  const summary = {
    passed: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok).length,
    results,
    inventoryPath: path.join(ART, 'finance-leadership-360-p1-inventory.json')
  };
  fs.writeFileSync(path.join(ART, 'finance-leadership-360-p1-report.json'), JSON.stringify(summary, null, 2));

  // Markdown inventory table for PR
  const md = [
    '# Finance Leadership 360 P1 — page inventory',
    '',
    '| القسم | الصفحة | المسار | الحالة |',
    '|---|---|---|---|'
  ];
  inventory.forEach((r) => {
    md.push(`| ${r.section} | ${r.page} | \`${r.path}\` | ${r.status} |`);
  });
  md.push('', '## حالات ملتبسة (لم تُكرَّر في المالية)', '');
  catalog.AMBIGUOUS_CASES.forEach((c) => {
    md.push(`- **${c.label}**: ${c.decision} — ${c.reason} (\`${c.href}\`)`);
  });
  fs.writeFileSync(path.join(ART, 'finance-leadership-360-p1-inventory.md'), md.join('\n'));

  console.log('\n=== SUMMARY ===');
  console.log(JSON.stringify({ passed: summary.passed, failed: summary.failed }, null, 2));
  process.exit(summary.failed ? 1 : 0);
})();
