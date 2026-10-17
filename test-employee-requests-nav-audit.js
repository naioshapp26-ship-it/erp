'use strict';
/**
 * Real GUI audit: Employee Requests card + client IA sidebar comparison.
 * Evidence-based — does not claim PASS without content assertions.
 */
const fs = require('fs');
const path = require('path');
const http = require('http');
const puppeteer = require('puppeteer-core');
const {
  SIDEBAR_DEFAULT_ORDER,
  SIDEBAR_DEDUPE_FROM_TOP
} = require('./sidebar-navigation-registry');

const BASE = process.env.REVIEW_BASE || 'http://127.0.0.1:3010';
const OUT = '/opt/cursor/artifacts/employee-requests-nav-audit';
const SHOTS = path.join(OUT, 'screenshots');
const EMAIL = process.env.REVIEW_EMAIL || 'admin@naiosh.com';
const PASSWORD = process.env.REVIEW_PASSWORD || 'Admin@123';

fs.mkdirSync(SHOTS, { recursive: true });

const results = [];
function record(group, name, status, detail) {
  results.push({ group, name, status, detail: detail || null });
  console.log(`${status} [${group}] ${name}${detail ? ' — ' + detail : ''}`);
}

function req(method, urlPath, { token, body } = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(urlPath, BASE);
    const payload = body != null ? JSON.stringify(body) : null;
    const r = http.request({
      hostname: u.hostname,
      port: u.port || 80,
      path: u.pathname + u.search,
      method,
      headers: {
        Accept: 'application/json',
        ...(token ? { Authorization: `Bearer ${token}`, Cookie: `authToken=${token}` } : {}),
        ...(payload ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } : {})
      }
    }, (res) => {
      let raw = '';
      res.on('data', (c) => { raw += c; });
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(raw); } catch { /* */ }
        resolve({ status: res.statusCode, json, raw, headers: res.headers });
      });
    });
    r.on('error', reject);
    if (payload) r.write(payload);
    r.end();
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
  await page.reload({ waitUntil: 'networkidle2', timeout: 60000 });
  await page.waitForSelector('#nav-menu', { timeout: 30000 }).catch(() => null);
  await new Promise((r) => setTimeout(r, 2000));
}

async function sidebarTopLabels(page) {
  return page.evaluate(() => {
    const menu = document.getElementById('nav-menu');
    if (!menu) return [];
    return Array.from(menu.children).map((li) => {
      const top = li.querySelector(':scope > a, :scope > .submenu-container > button, :scope > div > button, :scope > button');
      const text = ((top?.querySelector('span')?.innerText) || top?.innerText || '').replace(/\s+/g, ' ').trim();
      return text;
    }).filter(Boolean);
  });
}

const CLIENT_IA_EXPECTED = [
  { id: 'dashboard', label: 'الرئيسية', place: 'top' },
  { id: 'strategic-management', label: 'الإدارة الاستراتيجية', place: 'top' },
  { id: 'smart-management', label: 'الإدارة الذكية 360', place: 'portal' },
  { id: 'governed-administrative-integration', label: 'التكامل الإداري المحكوم', place: 'portal' },
  { id: 'incubators-platforms', label: 'حاضنات و منصات اعمال', place: 'portal' },
  { id: 'education-training-incubators', label: 'التعليم والتدريب', place: 'top' },
  { id: 'naiosh-sectors', label: 'قطاعات نايوش', place: 'top' },
  { id: 'super-admin', label: 'إدارة الأدوار والصلاحيات', place: 'top' },
  { id: 'operational-policies', label: 'السياسات التشغيلية', place: 'top' },
  { id: 'hierarchy', label: 'الهيكل التنظيمي', place: 'top' },
  { id: 'saas', label: 'إدارة الاشتراكات', place: 'top' },
  { id: 'services-events-center', label: 'مركز الخدمات والفعاليات', place: 'portal' },
  { id: 'payment-menu', label: 'نظام الدفع', place: 'top' },
  { id: 'services', label: 'الخدمات', place: 'top' },
  { id: 'tasks-management', label: 'المهام', place: 'top' },
  { id: 'settings', label: 'إعدادات الصفحة الرئيسية', place: 'top' },
  { id: 'settings-admin', label: 'إعدادات النظام', place: 'top' }
];

async function main() {
  // Static source checks
  const portalHtml = fs.readFileSync(path.join(__dirname, 'services-events-center.html'), 'utf8');
  record('source', 'requests-card-href-not-dashboard',
    /id="requests-enter"[^>]*href="\/requests"/.test(portalHtml)
      && /data-href="\/requests"/.test(portalHtml)
      && !/pendingRoute/.test(portalHtml)
      && !/requests-enter[^>]*href="\/dashboard\.html"/.test(portalHtml)
      ? 'PASS' : 'FAIL',
    'requests enter must target /requests; no pendingRoute hack');
  record('source', 'order-services-events-before-payment',
    SIDEBAR_DEFAULT_ORDER.indexOf('services-events-center')
      < SIDEBAR_DEFAULT_ORDER.indexOf('payment-menu') ? 'PASS' : 'FAIL');
  record('source', 'dedupe-requests-from-top',
    SIDEBAR_DEDUPE_FROM_TOP.some((d) => d.id === 'requests') ? 'PASS' : 'FAIL');

  const login = await req('POST', '/api/auth/login', { body: { email: EMAIL, password: PASSWORD } });
  if (!login.json?.success) {
    record('auth', 'login', 'FAIL', login.raw?.slice(0, 200));
    writeReport();
    process.exit(1);
  }
  const token = login.json.data.session?.token || login.json.data.token;
  const user = login.json.data.user;
  record('auth', 'login', 'PASS', user.email);

  // Reset sidebar customization to defaults (client order)
  await req('PUT', `/api/enterprise-settings/values/${encodeURIComponent('company.sidebar.navigation')}`, {
    token,
    body: {
      value: { orderIds: SIDEBAR_DEFAULT_ORDER.slice(), hiddenIds: [] },
      reason: 'nav-audit-reset-defaults'
    }
  });

  const browser = await puppeteer.launch({
    executablePath: process.env.CHROME_PATH || '/usr/local/bin/google-chrome',
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1440,900']
  });

  const auditRows = [];

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });
    await injectSession(page, token, user);

    const labels = await sidebarTopLabels(page);
    await page.screenshot({ path: path.join(SHOTS, '01-sidebar-full-desktop.png'), fullPage: true });
    record('sidebar', 'count-17', labels.length === 17 ? 'PASS' : 'FAIL', `count=${labels.length} ${labels.join(' | ')}`);

    for (let i = 0; i < CLIENT_IA_EXPECTED.length; i++) {
      const exp = CLIENT_IA_EXPECTED[i];
      const currentId = SIDEBAR_DEFAULT_ORDER[i];
      const currentLabel = labels[i] || '(missing)';
      const matchId = currentId === exp.id;
      const matchLabel = currentLabel.includes(exp.label) || exp.label.includes(currentLabel.split('|')[0]);
      const status = matchId && matchLabel ? 'مطابق' : 'مخالف';
      auditRows.push({
        required: exp.label,
        requiredId: exp.id,
        correctPlace: exp.place,
        currentId,
        currentLabel,
        match: status,
        duplicateTop: SIDEBAR_DEDUPE_FROM_TOP.some((d) => d.id === exp.id) ? 'n/a-deduped' : 'no'
      });
      record('ia-compare', `${i + 1}-${exp.id}`,
        matchId && matchLabel ? 'PASS' : 'FAIL',
        `want=${exp.label} got=${currentLabel} id=${currentId}`);
    }

    // Click services-events portal then Employee Requests card — must NOT land on dashboard home
    await page.goto(`${BASE}/services-events-center`, { waitUntil: 'networkidle2', timeout: 60000 });
    await page.screenshot({ path: path.join(SHOTS, '02-services-events-portal.png'), fullPage: false });
    const portalSnap = await page.evaluate(() => {
      const req = document.getElementById('requests-enter');
      return {
        title: document.body.innerText.includes('مركز الخدمات والفعاليات'),
        href: req ? req.getAttribute('href') : null,
        dataTarget: req ? req.getAttribute('data-target') : null
      };
    });
    record('portal', 'services-events-open', portalSnap.title ? 'PASS' : 'FAIL');
    record('portal', 'requests-href-is-requests',
      portalSnap.href && /\/requests\/?$/.test(portalSnap.href.split('?')[0]) ? 'PASS' : 'FAIL',
      JSON.stringify(portalSnap));

    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 60000 }).catch(() => null),
      page.click('#requests-enter')
    ]);
    await new Promise((r) => setTimeout(r, 3000));
    const after = await page.evaluate(() => ({
      href: location.href,
      path: location.pathname,
      title: document.getElementById('page-title')?.innerText || '',
      body: document.body.innerText.slice(0, 1200),
      hasRequestTypes: /طلب تعريف بالراتب|طلب إجازة|طلب سلفة|هذه المكونات الرئيسية لطلبات/.test(document.body.innerText),
      isDashboardHome: /لوحة التحكم الرئيسية|مرحباً بك في نظام|إحصائيات عامة/.test(document.body.innerText)
        && !/هذه المكونات الرئيسية لطلبات/.test(document.body.innerText)
        && location.pathname.replace(/\/+$/, '').endsWith('dashboard.html')
    }));
    await page.screenshot({ path: path.join(SHOTS, '03-employee-requests-page.png'), fullPage: true });
    record('portal', 'requests-not-dashboard',
      !after.path.includes('dashboard.html') && after.path.includes('/requests') ? 'PASS' : 'FAIL',
      after.href);
    record('portal', 'requests-content-loaded',
      after.hasRequestTypes ? 'PASS' : 'FAIL',
      `title=${after.title} snippet=${after.body.slice(0, 180)}`);

    // Other portal cards — real navigation + content
    const portalCards = [
      {
        group: 'smart-management',
        open: `${BASE}/smart-management`,
        cards: [
          { sel: 'a.enter-btn[href*="/hr"]', expectPath: /\/hr/, must: /موارد|HR|الموارد البشرية/i },
          { sel: 'a.enter-btn[href*="/finance"]', expectPath: /\/finance/, must: /مالية|Finance|الحسابات/i },
          { sel: 'a.enter-btn[href*="/archive"]', expectPath: /\/archive/, must: /أرشيف|archive/i }
        ]
      },
      {
        group: 'ipp',
        open: `${BASE}/incubators-platforms`,
        cards: [
          { sel: 'a.enter-btn[href*="/branches"]', expectPath: /\/branches/, must: /فروع|branches/i },
          { sel: 'a.enter-btn[href*="/incubators-hub"]', expectPath: /\/incubators-hub/, must: /حاضن|incubator/i },
          { sel: 'a.enter-btn[href*="/platforms"]', expectPath: /\/platforms/, must: /منص|platform/i },
          { sel: 'a.enter-btn[href*="/e-offices"]', expectPath: /\/e-offices/, must: /مكتب|office|إلكتروني/i }
        ]
      },
      {
        group: 'services-events-cards',
        open: `${BASE}/services-events-center`,
        cards: [
          { sel: 'a.enter-btn[href*="events-studio"]', expectPath: /events-studio/, must: /فعال|studio|أحداث|Event/i },
          { sel: 'a.enter-btn[href*="marketing-campaigns"]', expectPath: /marketing-campaigns/, must: /تسويق|campaign|Marketing/i }
        ]
      }
    ];

    for (const portal of portalCards) {
      for (const card of portal.cards) {
        await page.goto(portal.open, { waitUntil: 'networkidle2', timeout: 60000 });
        await new Promise((r) => setTimeout(r, 1000));
        const el = await page.$(card.sel);
        if (!el) {
          record(portal.group, card.sel, 'FAIL', 'selector missing');
          continue;
        }
        await Promise.all([
          page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 60000 }).catch(() => null),
          el.click()
        ]);
        await new Promise((r) => setTimeout(r, 2000));
        const snap = await page.evaluate(() => ({
          href: location.href,
          path: location.pathname,
          body: document.body.innerText.slice(0, 800)
        }));
        const pathOk = card.expectPath.test(snap.path) || card.expectPath.test(snap.href);
        const contentOk = card.must.test(snap.body);
        const notDash = !/dashboard\.html$/.test(snap.path.replace(/\/+$/, ''));
        record(portal.group, card.sel,
          pathOk && contentOk && notDash ? 'PASS' : 'FAIL',
          `pathOk=${pathOk} contentOk=${contentOk} notDash=${notDash} url=${snap.href.slice(0, 100)}`);
      }
    }

    // GAI page content
    await page.goto(`${BASE}/dashboard.html`, { waitUntil: 'networkidle2', timeout: 60000 });
    await new Promise((r) => setTimeout(r, 1500));
    await page.evaluate(() => {
      const menu = document.getElementById('nav-menu');
      const btn = Array.from(menu?.querySelectorAll('a,button') || [])
        .find((n) => (n.innerText || '').includes('التكامل الإداري المحكوم'));
      if (btn) btn.click();
    });
    await new Promise((r) => setTimeout(r, 2500));
    const gai = await page.evaluate(() => ({
      href: location.href,
      body: document.body.innerText.slice(0, 1000),
      hasHrGov: /حوكمة.*موارد|الموارد البشرية/.test(document.body.innerText),
      hasFinGov: /حوكمة.*مالية|الإدارة المالية/.test(document.body.innerText),
      hasArchGov: /حوكمة.*أرش|الأرشفة/.test(document.body.innerText)
    }));
    await page.screenshot({ path: path.join(SHOTS, '04-gai-portal.png'), fullPage: false });
    record('gai', 'three-governance-sections',
      gai.hasHrGov && gai.hasFinGov && gai.hasArchGov ? 'PASS' : 'FAIL',
      JSON.stringify({ hasHrGov: gai.hasHrGov, hasFinGov: gai.hasFinGov, hasArchGov: gai.hasArchGov }));

    // Mobile RTL
    await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
    await page.goto(`${BASE}/dashboard.html`, { waitUntil: 'networkidle2', timeout: 60000 });
    await new Promise((r) => setTimeout(r, 2000));
    await page.evaluate(() => {
      const aside = document.getElementById('sidebar') || document.querySelector('aside');
      if (aside) aside.classList.remove('hidden', '-translate-x-full', 'translate-x-full');
    });
    const mobileLabels = await sidebarTopLabels(page);
    await page.screenshot({ path: path.join(SHOTS, '05-sidebar-mobile.png'), fullPage: false });
    record('mobile', 'sidebar-17', mobileLabels.length === 17 ? 'PASS' : 'FAIL', `count=${mobileLabels.length}`);
    const dir = await page.evaluate(() => document.documentElement.getAttribute('dir'));
    record('rtl', 'dir-rtl', dir === 'rtl' ? 'PASS' : 'FAIL', dir);

    // Top-level must not reintroduce deduped modules
    const forbiddenTop = ['سلاسل التوريد', 'السلامة والصحة المهنية', 'استوديو الفعاليات', 'استوديو التسويق'];
    const leaked = forbiddenTop.filter((f) => mobileLabels.some((l) => l === f || (l.includes(f) && !l.includes('مركز'))));
    // Re-check on desktop labels
    await page.setViewport({ width: 1440, height: 900 });
    await page.goto(`${BASE}/dashboard.html`, { waitUntil: 'networkidle2', timeout: 60000 });
    await new Promise((r) => setTimeout(r, 2000));
    const deskLabels = await sidebarTopLabels(page);
    const leakedDesk = ['سلاسل التوريد', 'استوديو الفعاليات', 'استوديو التسويق', 'الموارد البشرية']
      .filter((f) => deskLabels.some((l) => l === f));
    record('dedupe', 'no-top-level-dupes',
      leakedDesk.length === 0 ? 'PASS' : 'FAIL',
      leakedDesk.join(',') || 'none');

    fs.writeFileSync(path.join(OUT, 'ia-comparison-table.json'), JSON.stringify(auditRows, null, 2));

  } catch (err) {
    record('suite', 'error', 'FAIL', err.stack || err.message);
  } finally {
    await browser.close().catch(() => null);
  }

  writeReport(auditRows);
  const failed = results.filter((r) => r.status === 'FAIL');
  console.log(`\nSUMMARY: ${results.length - failed.length}/${results.length} PASS`);
  if (failed.length) {
    failed.forEach((f) => console.log(' -', `[${f.group}] ${f.name}: ${f.detail}`));
    process.exit(1);
  }
  console.log('VERDICT: PASS — evidence in artifacts (no merge)');
}

function writeReport(auditRows) {
  const byGroup = {};
  for (const r of results) {
    if (!byGroup[r.group]) byGroup[r.group] = { PASS: 0, FAIL: 0 };
    byGroup[r.group][r.status] = (byGroup[r.group][r.status] || 0) + 1;
  }
  const report = {
    generatedAt: new Date().toISOString(),
    verdict: results.some((r) => r.status === 'FAIL') ? 'FAIL' : 'PASS',
    rootCauseEmployeeRequests:
      'Card linked to /dashboard.html and set sessionStorage pendingRoute=requests, but the SPA never reads pendingRoute or ?route= — so the user stayed on Dashboard home.',
    fixedPath: '/requests (SPA route renderRequests — original employee request types page)',
    totals: {
      pass: results.filter((r) => r.status === 'PASS').length,
      fail: results.filter((r) => r.status === 'FAIL').length,
      total: results.length
    },
    byGroup,
    auditRows: auditRows || [],
    results
  };
  fs.writeFileSync(path.join(OUT, 'AUDIT-REPORT.json'), JSON.stringify(report, null, 2));

  const md = [
    '# Employee Requests Fix + Client IA Audit',
    '',
    `Generated: ${report.generatedAt}`,
    `Verdict: **${report.verdict}** (${report.totals.pass}/${report.totals.total})`,
    '',
    '## 1. Why did Employee Requests open Dashboard?',
    report.rootCauseEmployeeRequests,
    '',
    '## 2. Correct path now',
    report.fixedPath,
    '',
    '## 3. Client IA comparison',
    '| # | Required | Current label | Match |',
    '|---|---|---|---|',
    ...(report.auditRows || []).map((r, i) =>
      `| ${i + 1} | ${r.required} (\`${r.requiredId}\`) | ${r.currentLabel} (\`${r.currentId}\`) | ${r.match} |`),
    '',
    '## 4. Results by group',
    ...Object.entries(byGroup).map(([g, v]) => `- **${g}**: ${v.PASS || 0} PASS / ${v.FAIL || 0} FAIL`),
    '',
    '## 5. Screenshots',
    ...fs.readdirSync(SHOTS).map((f) => `- \`${f}\``),
    '',
    'No merge / staging / production without explicit approval.'
  ].join('\n');
  fs.writeFileSync(path.join(OUT, 'AUDIT-REPORT.md'), md);
  console.log(`Wrote ${path.join(OUT, 'AUDIT-REPORT.md')}`);
}

main().catch((err) => {
  console.error(err);
  record('suite', 'fatal', 'FAIL', err.message);
  writeReport([]);
  process.exit(1);
});
