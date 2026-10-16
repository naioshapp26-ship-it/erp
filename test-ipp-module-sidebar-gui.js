'use strict';
/**
 * GUI E2E: Incubators & Platforms portal → module-scoped sidebars.
 */
const fs = require('fs');
const path = require('path');
const http = require('http');
const puppeteer = require('puppeteer-core');

const BASE = process.env.IPP_GUI_BASE || 'http://127.0.0.1:3010';
const OUT = '/opt/cursor/artifacts';
const SHOTS = path.join(OUT, 'screenshots');
const EMAIL = process.env.IPP_GUI_EMAIL || 'admin@naiosh.com';
const PASSWORD = process.env.IPP_GUI_PASSWORD || 'Admin@123';

fs.mkdirSync(SHOTS, { recursive: true });

const results = [];
function record(name, status, detail) {
  results.push({ name, status, detail: detail || null });
  console.log(`${status} ${name}${detail ? ' — ' + detail : ''}`);
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
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
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
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

const MODULES = [
  {
    key: 'branches',
    portalHref: '/branches',
    expectPath: /\/branches/,
    sectionLink: 'link-br-sales',
    mustHave: ['link-br-daily-operations', 'link-br-sales', 'link-br-training'],
    // Forbid other systems by link id / exact global labels (not substring of "الموارد البشرية المحلية")
    mustNotIds: ['link-smart-management', 'link-dashboard', 'link-education-training-incubators', 'link-naiosh-sectors', 'link-hr', 'link-finance'],
    mustNotText: ['نظام الأرشفة', 'الإدارة الذكية 360', 'حاضنات التعليم والتدريب', 'قطاعات نايوش']
  },
  {
    key: 'incubators',
    portalHref: '/incubators-hub',
    expectPath: /\/incubators-hub/,
    sectionLink: 'link-ic-sales',
    mustHave: ['link-ic-daily-operations', 'link-ic-sales', 'link-ic-training'],
    mustNotIds: ['link-smart-management', 'link-dashboard', 'link-education-training-incubators', 'link-naiosh-sectors', 'link-br-daily-operations'],
    mustNotText: ['نظام الأرشفة', 'الإدارة الذكية 360', 'حاضنات التعليم والتدريب', 'قطاعات نايوش']
  },
  {
    key: 'platforms',
    portalHref: '/platforms',
    expectPath: /\/platforms/,
    sectionLink: 'link-pl-sales',
    mustHave: ['link-pl-daily-operations', 'link-pl-sales', 'link-pl-training'],
    mustNotIds: ['link-smart-management', 'link-dashboard', 'link-education-training-incubators', 'link-naiosh-sectors', 'link-br-daily-operations'],
    mustNotText: ['نظام الأرشفة', 'الإدارة الذكية 360', 'حاضنات التعليم والتدريب', 'قطاعات نايوش']
  },
  {
    key: 'e-offices',
    portalHref: '/e-offices',
    expectPath: /\/e-offices/,
    sectionLink: 'link-eo-files',
    mustHave: ['link-eo-daily-operations', 'link-eo-files', 'link-eo-archive'],
    mustNotIds: ['link-smart-management', 'link-dashboard', 'link-education-training-incubators', 'link-naiosh-sectors', 'link-br-daily-operations'],
    mustNotText: ['نظام الأرشفة', 'الإدارة الذكية 360', 'حاضنات التعليم والتدريب', 'قطاعات نايوش']
  }
];

async function injectSession(page, token, user) {
  await page.goto(`${BASE}/dashboard.html`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.evaluate((t, u) => {
    localStorage.setItem('authToken', t);
    sessionStorage.setItem('authToken', t);
    localStorage.setItem('user', JSON.stringify(u));
    sessionStorage.setItem('user', JSON.stringify(u));
    document.cookie = `authToken=${encodeURIComponent(t)}; path=/`;
  }, token, user);
}

async function sidebarSnapshot(page) {
  return page.evaluate(() => {
    const menu = document.getElementById('nav-menu');
    const text = menu ? menu.innerText : '';
    const ids = Array.from(document.querySelectorAll('#nav-menu [id^="link-"]')).map((el) => el.id);
    const back = !!document.getElementById('link-incubators-platforms');
    return { text, ids, back, href: location.href, path: location.pathname };
  });
}

async function main() {
  const login = await postJson('/api/auth/login', { email: EMAIL, password: PASSWORD });
  if (!login.json?.success) {
    record('login', 'FAIL', login.raw?.slice(0, 200));
    process.exit(1);
  }
  const session = login.json.data.session;
  const token = (session && typeof session === 'object' ? session.token : session)
    || login.json.data.token
    || login.json.token;
  const user = login.json.data.user;
  if (!token) {
    record('login-token', 'FAIL', 'missing session token');
    process.exit(1);
  }
  record('login', 'PASS', user.email);

  const browser = await puppeteer.launch({
    executablePath: process.env.CHROME_PATH || '/usr/local/bin/google-chrome',
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1440,900']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  try {
    await injectSession(page, token, user);

    // Portal entry
    await page.goto(`${BASE}/incubators-platforms`, { waitUntil: 'networkidle2', timeout: 60000 });
    await page.screenshot({ path: path.join(SHOTS, 'ipp-portal-entry.png'), fullPage: true });
    const portalOk = await page.evaluate(() => document.body.innerText.includes('حاضنات و منصات اعمال'));
    record('portal-open', portalOk ? 'PASS' : 'FAIL');

    // Dashboard control: global menu should still show portal + smart management, not only module sections
    await page.goto(`${BASE}/dashboard.html`, { waitUntil: 'networkidle2', timeout: 60000 });
    await page.waitForSelector('#nav-menu', { timeout: 30000 }).catch(() => null);
    await new Promise((r) => setTimeout(r, 2500));
    await page.screenshot({ path: path.join(SHOTS, 'ipp-dashboard-global-sidebar.png'), fullPage: false });
    const dashSide = await sidebarSnapshot(page);
    const dashHasPortal = dashSide.text.includes('حاضنات و منصات اعمال') || dashSide.ids.includes('link-incubators-platforms');
    const dashHasSmart = dashSide.text.includes('الإدارة الذكية 360');
    const dashNotScopedOnly = !dashSide.ids.includes('link-br-daily-operations') || dashSide.text.includes('الرئيسية');
    record('dashboard-global-menu', dashHasPortal && dashHasSmart && dashNotScopedOnly ? 'PASS' : 'FAIL',
      `portal=${dashHasPortal} smart=${dashHasSmart} ids=${dashSide.ids.slice(0, 8).join(',')}`);

    for (const mod of MODULES) {
      await page.goto(`${BASE}/incubators-platforms`, { waitUntil: 'networkidle2', timeout: 60000 });
      await page.waitForSelector(`a[data-enter][href="${mod.portalHref}"], a[data-enter][href$="${mod.portalHref}"]`, { timeout: 15000 }).catch(() => null);

      // Click card enter button
      const clicked = await page.evaluate((href) => {
        const a = document.querySelector(`a[data-enter][href="${href}"]`)
          || Array.from(document.querySelectorAll('a[data-enter]')).find((el) => (el.getAttribute('href') || '').endsWith(href));
        if (!a) return false;
        a.click();
        return true;
      }, mod.portalHref);
      record(`${mod.key}-click-enter`, clicked ? 'PASS' : 'FAIL');

      await page.waitForFunction(
        (reSource) => new RegExp(reSource).test(location.pathname),
        { timeout: 30000 },
        mod.expectPath.source
      ).catch(() => null);
      await page.waitForSelector('#nav-menu', { timeout: 30000 }).catch(() => null);
      await new Promise((r) => setTimeout(r, 3000));

      await page.screenshot({ path: path.join(SHOTS, `ipp-module-${mod.key}.png`), fullPage: false });
      let side = await sidebarSnapshot(page);

      const hasSections = mod.mustHave.every((id) => side.ids.includes(id) || side.text.includes(id.replace('link-', '')));
      // Prefer id checks; fall back to label presence for Arabic labels in mustHave ids
      const hasById = mod.mustHave.every((id) => side.ids.includes(id));
      const hasBack = side.back || side.text.includes('العودة إلى حاضنات و منصات اعمال');
      const leakedText = (mod.mustNotText || []).filter((t) => side.text.includes(t));
      const leakedIds = (mod.mustNotIds || []).filter((id) => side.ids.includes(id));
      const leaked = [...leakedText, ...leakedIds];
      record(`${mod.key}-scoped-sidebar`, hasById && hasBack && leaked.length === 0 ? 'PASS' : 'FAIL',
        `ids=${hasById} back=${hasBack} leak=${leaked.join('|') || 'none'} path=${side.path}`);

      // Navigate within module
      if (hasById) {
        await page.evaluate((id) => {
          const el = document.getElementById(id);
          if (el) el.click();
        }, mod.sectionLink);
        await new Promise((r) => setTimeout(r, 2000));
        await page.screenshot({ path: path.join(SHOTS, `ipp-module-${mod.key}-nav.png`), fullPage: false });
        side = await sidebarSnapshot(page);
        const stillScoped = mod.mustHave.every((id) => side.ids.includes(id)) && (side.back || side.text.includes('العودة'));
        record(`${mod.key}-inner-nav`, stillScoped ? 'PASS' : 'FAIL', side.path);
      } else {
        record(`${mod.key}-inner-nav`, 'FAIL', 'missing section links');
      }

      // Back to portal
      const backClicked = await page.evaluate(() => {
        const el = document.getElementById('link-incubators-platforms');
        if (!el) return false;
        el.click();
        return true;
      });
      await page.waitForFunction(() => location.pathname.includes('incubators-platforms'), { timeout: 20000 }).catch(() => null);
      const onPortal = (await page.evaluate(() => location.pathname)).includes('incubators-platforms');
      record(`${mod.key}-back-portal`, backClicked && onPortal ? 'PASS' : 'FAIL', await page.evaluate(() => location.pathname));
      await page.screenshot({ path: path.join(SHOTS, `ipp-module-${mod.key}-back.png`), fullPage: false });
    }

    // Direct legacy URL still works with scoped sidebar
    await page.goto(`${BASE}/branches`, { waitUntil: 'networkidle2', timeout: 60000 });
    await page.waitForSelector('#nav-menu', { timeout: 30000 }).catch(() => null);
    await new Promise((r) => setTimeout(r, 3000));
    await page.screenshot({ path: path.join(SHOTS, 'ipp-legacy-branches-direct.png'), fullPage: false });
    const legacy = await sidebarSnapshot(page);
    record('legacy-branches-direct',
      legacy.ids.includes('link-br-daily-operations') && legacy.back && !legacy.text.includes('الإدارة الذكية 360') ? 'PASS' : 'FAIL',
      legacy.path);
  } catch (err) {
    record('suite-error', 'FAIL', err.stack || err.message);
    try {
      await page.screenshot({ path: path.join(SHOTS, 'ipp-module-error.png'), fullPage: true });
    } catch { /* */ }
  } finally {
    await browser.close();
  }

  const report = {
    at: new Date().toISOString(),
    base: BASE,
    results,
    passed: results.filter((r) => r.status === 'PASS').length,
    failed: results.filter((r) => r.status === 'FAIL').length
  };
  fs.writeFileSync(path.join(OUT, 'ipp-module-sidebar-gui-report.json'), JSON.stringify(report, null, 2));
  console.log('\n=== IPP Module Sidebar GUI ===');
  console.log('passed:', report.passed, '/', results.length);
  if (report.failed) process.exit(1);
  console.log('VERDICT: GO');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
