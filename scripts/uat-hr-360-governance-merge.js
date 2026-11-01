/**
 * UAT: Merge HR Governance pages into HR 360 without deleting originals.
 */
const fs = require('fs');
const path = require('path');
const http = require('http');
const hrPortal = require('../hr-portal-access');
const { HR_MOVED } = require('../gai-hub-navigation');

const BASE = process.env.APP_BASE_URL || 'http://127.0.0.1:3083';
const OUT = process.env.UAT_OUT || '/opt/cursor/artifacts';

function httpReq(method, urlPath, body, headers = {}) {
  const u = new URL(urlPath.startsWith('http') ? urlPath : BASE + urlPath);
  const payload = body == null ? null : Buffer.from(JSON.stringify(body));
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: u.hostname,
        port: u.port,
        path: u.pathname + u.search,
        method,
        headers: {
          ...(payload ? { 'Content-Type': 'application/json', 'Content-Length': payload.length } : {}),
          ...headers
        }
      },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const buf = Buffer.concat(chunks);
          let json = null;
          try { json = JSON.parse(buf.toString('utf8')); } catch { /* */ }
          resolve({ status: res.statusCode, headers: res.headers, body: buf.toString('utf8'), json, location: res.headers.location || null });
        });
      }
    );
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const report = {
    ok: true,
    steps: [],
    inventory: { governance: [], hr360OriginalPreserved: true, added: [], overlaps: hrPortal.HR_GOVERNANCE_ALREADY_ON_HR360 },
    linkChecks: [],
    artifacts: []
  };

  const portal = hrPortal.buildPortalPayload('admin');
  const hrefs = new Set(portal.modules.map((m) => m.href.split('?')[0]));
  const added = portal.modules.filter((m) => m.source === 'hr-governance');
  report.inventory.added = added.map((m) => ({ label: m.label, href: m.href, category: m.category, key: m.key }));
  report.inventory.governance = HR_MOVED.map((g) => {
    const onHome = hrefs.has(g.href) || portal.modules.some((m) => m.href === g.href);
    const overlap = hrPortal.HR_GOVERNANCE_ALREADY_ON_HR360.find((o) => o.href === g.href);
    const addedCard = added.find((m) => m.href === g.href);
    return {
      name: g.label,
      original: 'حوكمة الموارد البشرية (GAI)',
      href: g.href,
      newPlace: overlap
        ? `موجود مسبقًا في HR 360 — ${overlap.hr360Label}`
        : addedCard
          ? `أُضيف إلى HR 360 — ${addedCard.category}`
          : 'MISSING',
      status: onHome ? 'on-hr360-home' : 'MISSING'
    };
  });

  report.steps.push({
    step: 'all_governance_on_hr360',
    ok: report.inventory.governance.every((r) => r.status === 'on-hr360-home'),
    totalGov: report.inventory.governance.length,
    addedCount: added.length,
    moduleCount: portal.modules.length,
    sectionCount: portal.sections.length
  });
  report.steps.push({
    step: 'original_hr360_not_removed',
    ok: portal.modules.length >= 34 + added.length - 0 && portal.modules.some((m) => m.key === 'admin-employee-files'),
    moduleCount: portal.modules.length
  });

  const login = await httpReq('POST', '/api/auth/login', { email: 'admin@naiosh.com', password: 'Admin@123' });
  const token = login.json?.data?.session?.token;
  if (!token) throw new Error('login failed');
  const auth = { Authorization: `Bearer ${token}` };

  const homeApi = await httpReq('GET', '/api/hr/home-modules', null, auth);
  report.steps.push({
    step: 'home_modules_api',
    ok: homeApi.status === 200 && homeApi.json?.success && (homeApi.json.modules || []).length >= 40,
    status: homeApi.status,
    count: (homeApi.json?.modules || []).length,
    sections: (homeApi.json?.sections || []).map((s) => ({ id: s.id, title: s.title, n: (s.cards || []).length }))
  });

  // Probe every governance href + a sample of original HR360 cards
  const probeList = [
    ...HR_MOVED.map((g) => ({ name: g.label, href: g.href, group: 'governance' })),
    { name: 'ملفات الموظفين', href: '/hr/employee-360', group: 'hr360-original' },
    { name: 'الموظفون الجدد', href: '/hr/employee-360?mode=add', group: 'hr360-original' },
    { name: 'تشغيل الموارد البشرية', href: '/hr/human-resources', group: 'hr360-original' },
    { name: 'مسير الرواتب', href: '/hr/payroll', group: 'hr360-original' },
    { name: 'إعدادات الموارد البشرية', href: '/hr/system-settings', group: 'hr360-original' }
  ];

  for (const item of probeList) {
    const res = await httpReq('GET', item.href, null, {
      ...auth,
      Accept: 'text/html,application/xhtml+xml',
      Cookie: `authToken=${token}`
    });
    const ok = res.status === 200
      || (res.status >= 300 && res.status < 400 && res.location && !/login-page/i.test(res.location));
    const row = {
      name: item.name,
      href: item.href,
      group: item.group,
      status: res.status,
      ok,
      location: res.location,
      bytes: res.body?.length || 0
    };
    report.linkChecks.push(row);
  }
  report.steps.push({
    step: 'all_probed_links_ok',
    ok: report.linkChecks.every((r) => r.ok),
    failed: report.linkChecks.filter((r) => !r.ok)
  });

  // GAI HR section is redirect CTA, not duplicate card grid
  const gai = await httpReq('GET', '/governed-administrative-integration', null, {
    ...auth,
    Accept: 'text/html',
    Cookie: `authToken=${token}`
  });
  // SPA page may be dashboard shell — check script source instead
  const scriptSrc = fs.readFileSync(path.join(__dirname, '../script.js'), 'utf8');
  const gaiRedirect = scriptSrc.includes('فتح الموارد البشرية 360')
    && scriptSrc.includes('gai-hr-governance')
    && scriptSrc.includes('GAI_HR_GOVERNANCE_CARDS');
  report.steps.push({ step: 'gai_hr_redirect_cta', ok: gaiRedirect, gaiStatus: gai.status });

  // Browser screenshots
  const puppeteer = require('puppeteer-core');
  const browser = await puppeteer.launch({
    executablePath: process.env.CHROME_PATH || '/usr/local/bin/google-chrome',
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1440,900']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  await page.setCacheEnabled(false);
  await page.goto(`${BASE}/login-page.html`, { waitUntil: 'domcontentloaded' });
  await page.evaluate((t) => {
    localStorage.setItem('authToken', t);
    sessionStorage.setItem('authToken', t);
  }, token);
  await page.setCookie({ name: 'authToken', value: token, domain: '127.0.0.1', path: '/' });

  await page.goto(`${BASE}/hr`, { waitUntil: 'networkidle2', timeout: 60000 });
  await page.waitForSelector('#hr-sections', { timeout: 20000 });
  await new Promise((r) => setTimeout(r, 1500));
  const homeMeta = await page.evaluate(() => {
    const sections = [...document.querySelectorAll('.hr-section-block')].map((s) => ({
      id: s.getAttribute('data-section-id'),
      title: s.querySelector('.hr-section-title')?.textContent?.trim(),
      cards: Number(s.getAttribute('data-card-count') || 0)
    }));
    const links = [...document.querySelectorAll('#hr-sections a[href]')].map((a) => a.getAttribute('href'));
    return { sections, linkCount: links.length, links };
  });
  report.steps.push({
    step: 'hr360_ui_sections',
    ok: homeMeta.linkCount >= 40
      && homeMeta.sections.some((s) => s.id === 'training-skills')
      && homeMeta.sections.some((s) => s.id === 'governance-compliance')
      && homeMeta.sections.some((s) => s.id === 'analytics-integrations')
      && homeMeta.links.includes('/hr/employee-360')
      && homeMeta.links.includes('/hr/integrations-erp'),
    ...homeMeta
  });
  const afterShot = path.join(OUT, 'hr-360-after-governance-merge.png');
  await page.screenshot({ path: afterShot, fullPage: true });
  report.artifacts.push(afterShot);

  // Open one added governance card and one original card
  await page.goto(`${BASE}/hr/integrations-erp`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await new Promise((r) => setTimeout(r, 1200));
  const integOk = !/login-page/i.test(page.url());
  report.steps.push({ step: 'open_added_integrations_erp', ok: integOk, url: page.url() });
  await page.screenshot({ path: path.join(OUT, 'hr-360-open-integrations-erp.png'), fullPage: false });
  report.artifacts.push(path.join(OUT, 'hr-360-open-integrations-erp.png'));

  await page.goto(`${BASE}/hr/employee-360`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await new Promise((r) => setTimeout(r, 1200));
  report.steps.push({ step: 'open_original_employee_360', ok: !/login-page/i.test(page.url()), url: page.url() });
  await page.screenshot({ path: path.join(OUT, 'hr-360-open-employee-360.png'), fullPage: false });
  report.artifacts.push(path.join(OUT, 'hr-360-open-employee-360.png'));

  // Mobile
  await page.setViewport({ width: 390, height: 844 });
  await page.goto(`${BASE}/hr`, { waitUntil: 'networkidle2', timeout: 60000 });
  await page.waitForSelector('#hr-sections', { timeout: 20000 });
  await page.screenshot({ path: path.join(OUT, 'hr-360-after-mobile-390.png'), fullPage: true });
  report.artifacts.push(path.join(OUT, 'hr-360-after-mobile-390.png'));

  await browser.close();

  // Write inventory table markdown
  const md = [
    '# جرد دمج حوكمة الموارد البشرية → الموارد البشرية 360',
    '',
    `تاريخ: ${new Date().toISOString()}`,
    '',
    '## ملخص',
    `- بطاقات HR 360 بعد الدمج: **${portal.modules.length}**`,
    `- أُضيفت من الحوكمة: **${added.length}**`,
    `- تداخل بنفس المسار (احتُفظ بالموجود، بلا حذف): **${hrPortal.HR_GOVERNANCE_ALREADY_ON_HR360.length}**`,
    '',
    '## جدول النقل',
    '| الصفحة | المكان الأصلي | المكان الجديد | الحالة |',
    '|---|---|---|---|',
    ...report.inventory.governance.map((r) => `| ${r.name} | ${r.original} | ${r.newPlace} | ${r.status} |`),
    '',
    '## تكرارات للمراجعة (نفس href — لم تُحذف أي جهة)',
    '| href | عنوان الحوكمة | عنوان HR 360 |',
    '|---|---|---|',
    ...hrPortal.HR_GOVERNANCE_ALREADY_ON_HR360.map((o) => `| ${o.href} | ${o.governanceLabel} | ${o.hr360Label} |`),
    '',
    '## فحص الروابط',
    '| الصفحة | href | HTTP | ok |',
    '|---|---|---|---|',
    ...report.linkChecks.map((r) => `| ${r.name} | ${r.href} | ${r.status} | ${r.ok} |`)
  ].join('\n');
  fs.writeFileSync(path.join(OUT, 'hr-360-governance-merge-inventory.md'), md);

  report.ok = report.steps.every((s) => s.ok !== false) && report.linkChecks.every((r) => r.ok);
  fs.writeFileSync(path.join(OUT, 'hr-360-governance-merge-uat.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ ok: report.ok, steps: report.steps, inventorySummary: {
    modules: portal.modules.length,
    added: added.length,
    overlaps: hrPortal.HR_GOVERNANCE_ALREADY_ON_HR360.length,
    linkFails: report.linkChecks.filter((r) => !r.ok).length
  }, artifacts: report.artifacts }, null, 2));
  if (!report.ok) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
