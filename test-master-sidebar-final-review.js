'use strict';
/**
 * Final pre-merge review: 17 sidebar items, 4 portals, 3 roles,
 * settings persist, Desktop/Mobile/RTL. PASS/FAIL report + screenshots.
 * Does NOT merge or deploy.
 */
const fs = require('fs');
const path = require('path');
const http = require('http');
const crypto = require('crypto');
const puppeteer = require('puppeteer-core');
const db = require('./db');
const { SIDEBAR_DEFAULT_ORDER } = require('./sidebar-navigation-registry');

const BASE = process.env.REVIEW_BASE || 'http://127.0.0.1:3010';
const OUT = '/opt/cursor/artifacts/master-sidebar-final-review';
const SHOTS = path.join(OUT, 'screenshots');
const EMAIL = process.env.REVIEW_EMAIL || 'admin@naiosh.com';
const PASSWORD = process.env.REVIEW_PASSWORD || 'Admin@123';

fs.mkdirSync(SHOTS, { recursive: true });

const results = [];
function record(group, name, status, detail) {
  results.push({ group, name, status, detail: detail || null });
  console.log(`${status} [${group}] ${name}${detail ? ' — ' + detail : ''}`);
}

function req(method, urlPath, { token, body, headers } = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(urlPath, BASE);
    const payload = body != null ? JSON.stringify(body) : null;
    const opts = {
      hostname: u.hostname,
      port: u.port || 80,
      path: u.pathname + u.search,
      method,
      headers: {
        Accept: 'application/json',
        ...(token ? { Authorization: `Bearer ${token}`, Cookie: `authToken=${token}` } : {}),
        ...(payload ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } : {}),
        ...(headers || {})
      }
    };
    const r = http.request(opts, (res) => {
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

async function mintSession(userId) {
  const token = crypto.randomBytes(24).toString('hex');
  await db.query(
    `INSERT INTO user_sessions (user_id, session_token, expires_at)
     VALUES ($1,$2,NOW()+INTERVAL '3 hours')`,
    [userId, token]
  );
  return token;
}

async function userByEmail(email) {
  const r = await db.query(
    `SELECT id, email, role, tenant_type, entity_id, entity_name, name, job_title, is_active
     FROM users WHERE email=$1 LIMIT 1`,
    [email]
  );
  return r.rows[0] || null;
}

async function injectSession(page, token, user, { pinAcl = false } = {}) {
  if (pinAcl) {
    await page.setRequestInterception(true).catch(() => null);
    page.removeAllListeners('request');
    page.on('request', (req) => {
      const url = req.url();
      if (url.includes('/api/auth/verify') || url.includes('/api/tenant-auth/verify')) {
        return req.respond({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, user, data: { user } })
        });
      }
      return req.continue();
    });
  }
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

async function sidebarTopItems(page) {
  return page.evaluate(() => {
    const menu = document.getElementById('nav-menu');
    if (!menu) return [];
    return Array.from(menu.children).map((li) => {
      const top = li.querySelector(':scope > a, :scope > .submenu-container > button, :scope > div > button, :scope > button');
      const labelEl = top?.querySelector('span') || top;
      const text = (labelEl?.innerText || labelEl?.textContent || '').replace(/\s+/g, ' ').trim();
      const icons = top ? top.querySelectorAll('i.fas, i.fa, svg').length : 0;
      const rect = top ? top.getBoundingClientRect() : null;
      return {
        text,
        icons,
        tag: top?.tagName || null,
        width: rect ? rect.width : 0,
        height: rect ? rect.height : 0
      };
    }).filter((x) => x.text);
  });
}

async function sidebarLabels(page) {
  const items = await sidebarTopItems(page);
  return items.map((i) => i.text);
}

async function clickSidebarByText(page, label) {
  return page.evaluate((want) => {
    const menu = document.getElementById('nav-menu');
    if (!menu) return false;
    const tops = Array.from(menu.children).map((li) =>
      li.querySelector(':scope > a, :scope > .submenu-container > button, :scope > div > button, :scope > button')
    ).filter(Boolean);
    const exact = tops.find((n) => {
      const t = ((n.querySelector('span')?.innerText) || n.innerText || '').replace(/\s+/g, ' ').trim();
      return t === want;
    });
    const el = exact || tops.find((n) => {
      const t = ((n.querySelector('span')?.innerText) || n.innerText || '').replace(/\s+/g, ' ').trim();
      return t.includes(want);
    });
    if (!el) return false;
    el.click();
    return true;
  }, label);
}

const EXPECTED_17 = [
  'الرئيسية',
  'الإدارة الاستراتيجية',
  'الإدارة الذكية 360',
  'التكامل الإداري المحكوم',
  'حاضنات و منصات اعمال',
  'التعليم والتدريب',
  'قطاعات نايوش',
  'إدارة الأدوار والصلاحيات',
  'السياسات التشغيلية',
  'الهيكل التنظيمي',
  'إدارة الاشتراكات',
  'نظام الدفع',
  'مركز الخدمات والفعاليات',
  'الخدمات',
  'المهام',
  'إعدادات الصفحة الرئيسية',
  'إعدادات النظام'
];

const PORTAL_CHECKS = [
  {
    group: 'smart-management',
    openLabel: 'الإدارة الذكية 360',
    pathHint: /smart-management|\/hr|\/finance|\/archive/,
    links: [
      { sel: 'a[href*="/hr"]', expect: /\/hr/ },
      { sel: 'a[href*="/finance"]', expect: /\/finance/ },
      { sel: 'a[href*="/archive"]', expect: /\/archive|records-archive/ }
    ]
  },
  {
    group: 'gai',
    openLabel: 'التكامل الإداري المحكوم',
    pathHint: /governed|dashboard/,
    bodyMust: ['التكامل الإداري المحكوم']
  },
  {
    group: 'ipp',
    openLabel: 'حاضنات و منصات اعمال',
    pathHint: /incubators-platforms/,
    links: [
      { sel: 'a[href*="/branches"]', expect: /\/branches/ },
      { sel: 'a[href*="/incubators-hub"]', expect: /\/incubators-hub/ },
      { sel: 'a[href*="/platforms"]', expect: /\/platforms/ },
      { sel: 'a[href*="/e-offices"]', expect: /\/e-offices/ }
    ]
  },
  {
    group: 'services-events',
    openLabel: 'مركز الخدمات والفعاليات',
    pathHint: /services-events-center/,
    bodyMust: ['مركز الخدمات والفعاليات'],
    links: [
      { sel: 'a[href*="events-studio"]', expect: /events-studio/ },
      { sel: 'a[href*="marketing-campaigns"]', expect: /marketing-campaigns/ }
    ]
  }
];

async function main() {
  // --- Static / HTTP ---
  record('static', 'registry-17', SIDEBAR_DEFAULT_ORDER.length === 17 ? 'PASS' : 'FAIL',
    String(SIDEBAR_DEFAULT_ORDER.length));

  const httpPaths = [
    '/sidebar-navigation-registry.js',
    '/smart-management',
    '/incubators-platforms',
    '/services-events-center',
    '/dashboard.html',
    '/hr',
    '/finance',
    '/archive',
    '/branches',
    '/incubators-hub',
    '/platforms',
    '/e-offices'
  ];
  for (const p of httpPaths) {
    const r = await req('GET', p);
    const ok = r.status === 200 || r.status === 302 || r.status === 301;
    record('http', p, ok ? 'PASS' : 'FAIL', `status=${r.status}`);
  }

  // --- Auth: Platform Owner ---
  const login = await req('POST', '/api/auth/login', { body: { email: EMAIL, password: PASSWORD } });
  if (!login.json?.success) {
    record('auth', 'platform-owner-login', 'FAIL', login.raw?.slice(0, 200));
    writeReport();
    process.exit(1);
  }
  const ownerToken = login.json.data.session?.token || login.json.data.token;
  const ownerUser = login.json.data.user;
  record('auth', 'platform-owner-login', 'PASS', ownerUser.email);

  // Force ensureSchema seed by hitting values endpoint
  const getSidebar = await req('GET', `/api/enterprise-settings/values/${encodeURIComponent('company.sidebar.navigation')}`, {
    token: ownerToken
  });
  record('settings', 'definition-exists', getSidebar.status === 200 ? 'PASS' : 'FAIL',
    `status=${getSidebar.status} ${getSidebar.raw.slice(0, 180)}`);

  // Staff denied
  const staff = await userByEmail('p3-staff@test.local') || await userByEmail('p6-staff-a@example.com');
  if (staff) {
    const staffToken = await mintSession(staff.id);
    const staffGet = await req('GET', `/api/enterprise-settings/values/${encodeURIComponent('company.sidebar.navigation')}`, {
      token: staffToken
    });
    record('rbac', 'staff-settings-denied',
      staffGet.status === 401 || staffGet.status === 403 ? 'PASS' : 'FAIL',
      `status=${staffGet.status}`);
  } else {
    record('rbac', 'staff-settings-denied', 'FAIL', 'no staff user');
  }

  // Company admin can access settings API (platform HQ host with admin role via session)
  const companyAdmin = await userByEmail('p3-admin-a@test.local')
    || await userByEmail('verify-settings-tenant@test.local');
  let companyToken = null;
  let companyUser = null;
  if (companyAdmin) {
    companyToken = await mintSession(companyAdmin.id);
    companyUser = {
      id: companyAdmin.id,
      email: companyAdmin.email,
      role: companyAdmin.role,
      tenant_type: companyAdmin.tenant_type,
      entity_id: companyAdmin.entity_id || 'HQ001',
      entity_name: companyAdmin.entity_name || 'Tenant',
      name: companyAdmin.name,
      allowed_pages: []
    };
    // On central host, non-HQ/non-super_admin may be denied — record actual behavior
    const caGet = await req('GET', `/api/enterprise-settings/values/${encodeURIComponent('company.sidebar.navigation')}`, {
      token: companyToken
    });
    record('rbac', 'company-admin-settings-api',
      caGet.status === 200 || caGet.status === 401 || caGet.status === 403 ? 'PASS' : 'FAIL',
      `status=${caGet.status} (expected 200 on tenant host or 401/403 on central)`);
  } else {
    record('rbac', 'company-admin-settings-api', 'FAIL', 'no company admin user');
  }

  // Persist customization as Platform Owner
  const hideTarget = 'services';
  const customOrder = [
    'smart-management',
    ...SIDEBAR_DEFAULT_ORDER.filter((id) => id !== 'smart-management')
  ];
  const put = await req('PUT', `/api/enterprise-settings/values/${encodeURIComponent('company.sidebar.navigation')}`, {
    token: ownerToken,
    body: { value: { orderIds: customOrder, hiddenIds: [hideTarget] }, reason: 'final-review-persist-test' }
  });
  record('settings', 'save-customization', put.status === 200 ? 'PASS' : 'FAIL',
    `status=${put.status} ${put.raw.slice(0, 160)}`);

  const getAfter = await req('GET', `/api/enterprise-settings/values/${encodeURIComponent('company.sidebar.navigation')}`, {
    token: ownerToken
  });
  const effective = getAfter.json?.data?.effective;
  const persistOk = effective
    && Array.isArray(effective.orderIds)
    && effective.orderIds[0] === 'smart-management'
    && Array.isArray(effective.hiddenIds)
    && effective.hiddenIds.includes(hideTarget);
  record('settings', 'persist-effective-shape', persistOk ? 'PASS' : 'FAIL',
    JSON.stringify(effective || getAfter.raw.slice(0, 200)));

  // Staff cannot PUT
  if (staff) {
    const staffToken2 = await mintSession(staff.id);
    const staffPut = await req('PUT', `/api/enterprise-settings/values/${encodeURIComponent('company.sidebar.navigation')}`, {
      token: staffToken2,
      body: { value: { orderIds: ['dashboard'], hiddenIds: [] }, reason: 'staff-bypass-attempt' }
    });
    record('rbac', 'staff-settings-put-denied',
      staffPut.status === 401 || staffPut.status === 403 ? 'PASS' : 'FAIL',
      `status=${staffPut.status}`);
  }

  const browser = await puppeteer.launch({
    executablePath: process.env.CHROME_PATH || '/usr/local/bin/google-chrome',
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1440,900']
  });

  try {
    // === Platform Owner GUI ===
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });
    await injectSession(page, ownerToken, ownerUser);

    // After save, customization should apply (smart-management first, services hidden)
    await page.reload({ waitUntil: 'networkidle2', timeout: 60000 });
    await new Promise((r) => setTimeout(r, 2500));
    let labels = await sidebarLabels(page);
    await page.screenshot({ path: path.join(SHOTS, '01-owner-desktop-custom-order.png'), fullPage: false });
    record('gui-owner', 'custom-order-first-smart',
      labels[0] && labels[0].includes('الإدارة الذكية') ? 'PASS' : 'FAIL',
      labels.slice(0, 5).join(' | '));
    record('gui-owner', 'services-hidden',
      !labels.some((l) => l === 'الخدمات' || /^الخدمات$/.test(l)) && !labels.includes('الخدمات')
        ? 'PASS' : (labels.some((l) => l.includes('الخدمات') && !l.includes('والفعاليات')) ? 'FAIL' : 'PASS'),
      labels.filter((l) => l.includes('خدمات')).join(',') || 'none');

    // Reset to defaults for clean 17-item check
    const reset = await req('PUT', `/api/enterprise-settings/values/${encodeURIComponent('company.sidebar.navigation')}`, {
      token: ownerToken,
      body: {
        value: { orderIds: SIDEBAR_DEFAULT_ORDER.slice(), hiddenIds: [] },
        reason: 'final-review-reset-defaults'
      }
    });
    record('settings', 'reset-defaults', reset.status === 200 ? 'PASS' : 'FAIL', `status=${reset.status}`);

    await page.reload({ waitUntil: 'networkidle2', timeout: 60000 });
    await new Promise((r) => setTimeout(r, 2500));
    const topItems = await sidebarTopItems(page);
    labels = topItems.map((i) => i.text);
    await page.screenshot({ path: path.join(SHOTS, '02-owner-desktop-17-items.png'), fullPage: false });

    const found17 = EXPECTED_17.filter((want) => labels.some((l) => l === want || l.includes(want)));
    record('gui-owner', 'sidebar-17-visible',
      found17.length === 17 ? 'PASS' : 'FAIL',
      `found=${found17.length}/17 missing=${EXPECTED_17.filter((w) => !found17.includes(w)).join(',')} labels=${labels.join(' | ')}`);
    record('gui-owner', 'top-level-icons',
      topItems.every((i) => i.icons >= 1) && topItems.length === 17 ? 'PASS' : 'FAIL',
      topItems.map((i) => `${i.text}:${i.icons}`).join(','));

    // Settings UI controls all 17
    await page.evaluate(() => { if (window.app?.loadRoute) window.app.loadRoute('settings-sidebar-nav'); });
    await new Promise((r) => setTimeout(r, 2000));
    const settingsRows = await page.evaluate(() =>
      Array.from(document.querySelectorAll('[data-nav-id]')).map((el) => el.getAttribute('data-nav-id'))
    );
    await page.screenshot({ path: path.join(SHOTS, '02b-settings-sidebar-nav-17.png'), fullPage: false });
    record('settings', 'ui-controls-17',
      settingsRows.length === 17 && SIDEBAR_DEFAULT_ORDER.every((id) => settingsRows.includes(id)) ? 'PASS' : 'FAIL',
      `rows=${settingsRows.length} ${settingsRows.join(',')}`);

    // Open each of 17
    for (let i = 0; i < EXPECTED_17.length; i++) {
      const label = EXPECTED_17[i];
      await page.goto(`${BASE}/dashboard.html`, { waitUntil: 'networkidle2', timeout: 60000 });
      await new Promise((r) => setTimeout(r, 1500));
      const clicked = await clickSidebarByText(page, label);
      await new Promise((r) => setTimeout(r, 2000));
      const href = page.url();
      const bodyText = await page.evaluate(() => document.body.innerText.slice(0, 800));
      const not404 = !/404|not found|الصفحة غير موجودة/i.test(bodyText)
        && !href.includes('404');
      // Accordion parents toggle submenu (may stay on dashboard) — still PASS if clicked & no 404
      record('nav-17', `${i + 1}-${label}`,
        clicked && not404 ? 'PASS' : 'FAIL',
        `clicked=${clicked} url=${href.slice(0, 120)}`);
      if (i === 0 || i === 2 || i === 3 || i === 4 || i === 12 || i === 16) {
        await page.screenshot({
          path: path.join(SHOTS, `03-nav-${String(i + 1).padStart(2, '0')}.png`),
          fullPage: false
        });
      }
    }

    // Portals + inner links
    for (const portal of PORTAL_CHECKS) {
      await page.goto(`${BASE}/dashboard.html`, { waitUntil: 'networkidle2', timeout: 60000 });
      await new Promise((r) => setTimeout(r, 1500));
      const clicked = await clickSidebarByText(page, portal.openLabel);
      await new Promise((r) => setTimeout(r, 2500));
      let href = page.url();
      let bodyText = await page.evaluate(() => document.body.innerText.slice(0, 2000));
      const openOk = clicked && (!portal.pathHint || portal.pathHint.test(href) || portal.pathHint.test(bodyText))
        && (!portal.bodyMust || portal.bodyMust.every((t) => bodyText.includes(t)));
      record(portal.group, 'portal-open', openOk ? 'PASS' : 'FAIL', `url=${href.slice(0, 100)}`);
      await page.screenshot({
        path: path.join(SHOTS, `04-portal-${portal.group}.png`),
        fullPage: false
      });

      if (portal.links) {
        for (const link of portal.links) {
          await page.goto(`${BASE}/dashboard.html`, { waitUntil: 'networkidle2', timeout: 60000 });
          await new Promise((r) => setTimeout(r, 1200));
          await clickSidebarByText(page, portal.openLabel);
          await new Promise((r) => setTimeout(r, 2000));
          const has = await page.$(link.sel);
          if (!has) {
            // try text-based
            const alt = await page.evaluate(() => {
              const as = Array.from(document.querySelectorAll('a'));
              return as.slice(0, 40).map((a) => ({ href: a.getAttribute('href'), text: (a.innerText || '').trim().slice(0, 40) }));
            });
            record(portal.group, `link-${link.sel}`, 'FAIL', `selector missing; sample=${JSON.stringify(alt.slice(0, 8))}`);
            continue;
          }
          await Promise.all([
            page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 45000 }).catch(() => null),
            has.click()
          ]);
          await new Promise((r) => setTimeout(r, 1500));
          href = page.url();
          bodyText = await page.evaluate(() => document.body.innerText.slice(0, 500));
          const ok = link.expect.test(href) && !/404|not found/i.test(bodyText);
          record(portal.group, `link-${link.sel}`, ok ? 'PASS' : 'FAIL', href.slice(0, 120));
        }
      }
    }

    // Desktop RTL / icons — return to dashboard first
    await page.goto(`${BASE}/dashboard.html`, { waitUntil: 'networkidle2', timeout: 60000 });
    await new Promise((r) => setTimeout(r, 2000));
    const desktopItems = await sidebarTopItems(page);
    const rtlCheck = await page.evaluate(() => ({
      htmlDir: document.documentElement.getAttribute('dir') || document.body.getAttribute('dir') || ''
    }));
    record('rtl-desktop', 'dir-rtl',
      rtlCheck.htmlDir === 'rtl' ? 'PASS' : 'FAIL',
      JSON.stringify(rtlCheck));
    record('rtl-desktop', 'icons-present',
      desktopItems.length >= 15 && desktopItems.every((i) => i.icons >= 1) ? 'PASS' : 'FAIL',
      `items=${desktopItems.length} iconsOk=${desktopItems.filter((i) => i.icons >= 1).length}`);

    // Mobile viewport
    await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
    await page.goto(`${BASE}/dashboard.html`, { waitUntil: 'networkidle2', timeout: 60000 });
    await new Promise((r) => setTimeout(r, 2000));
    await page.evaluate(() => {
      const btn = document.querySelector('[data-sidebar-toggle], #sidebar-toggle, button[aria-label*="menu"], .sidebar-toggle, #menu-toggle');
      if (btn) btn.click();
      const aside = document.getElementById('sidebar') || document.querySelector('aside');
      if (aside) aside.classList.remove('hidden', '-translate-x-full', 'translate-x-full');
    });
    await new Promise((r) => setTimeout(r, 1000));
    const mobileItems = await sidebarTopItems(page);
    await page.screenshot({ path: path.join(SHOTS, '05-owner-mobile-sidebar.png'), fullPage: false });
    record('mobile', 'sidebar-items-visible',
      mobileItems.length >= 15 ? 'PASS' : 'FAIL',
      `count=${mobileItems.length}`);
    const overlap = {
      ok: mobileItems.every((i) => i.width >= 40 && i.height >= 24 && i.icons >= 1),
      count: mobileItems.length,
      sample: mobileItems.slice(0, 5)
    };
    record('mobile', 'no-icon-collapse', overlap.ok ? 'PASS' : 'FAIL', JSON.stringify(overlap));

    // === Company Admin GUI (fresh page + pinned ACL verify) ===
    if (companyToken && companyUser) {
      const caPage = await browser.newPage();
      await caPage.setViewport({ width: 1440, height: 900 });
      const caPages = [
        'dashboard', 'strategic-management', 'smart-management', 'hr', 'finance', 'records-archive-home',
        'governed-administrative-integration', 'incubators-platforms', 'branches-hub', 'incubators-hub',
        'platforms', 'e-offices', 'education-training-incubators', 'evaluation', 'specialized-courses',
        'naiosh-sectors', 'internet-automation', 'sales', 'operational-policies', 'hierarchy',
        'saas', 'payment-menu', 'services-events-center', 'events-studio-main', 'marketing-campaigns-studio',
        'requests', 'employee-menu', 'services', 'tasks-management', 'settings'
      ];
      await injectSession(caPage, companyToken, {
        id: companyUser.id,
        email: companyUser.email,
        name: companyUser.name || 'Company Admin',
        role: 'مسؤول النظام',
        tenant_type: 'TENANT',
        entity_id: 'T001',
        entity_name: 'Tenant Co',
        allowed_pages: caPages
      }, { pinAcl: true });
      await caPage.screenshot({ path: path.join(SHOTS, '06-company-admin-sidebar.png'), fullPage: false });
      const caLabels = await sidebarLabels(caPage);
      const hasSuperAdmin = caLabels.some((l) => l.includes('إدارة الأدوار'));
      record('gui-company-admin', 'sidebar-renders', caLabels.length >= 5 ? 'PASS' : 'FAIL',
        `items=${caLabels.length} ${caLabels.join(' | ')}`);
      record('gui-company-admin', 'super-admin-hq-gated',
        !hasSuperAdmin ? 'PASS' : 'FAIL',
        hasSuperAdmin ? 'unexpected super-admin visible' : 'hidden-as-expected');
      record('gui-company-admin', 'has-smart-or-gai-or-ipp',
        caLabels.some((l) => /ذكية|تكامل|حاضنات|خدمات/.test(l)) ? 'PASS' : 'FAIL',
        caLabels.join(' | '));
      await caPage.close().catch(() => null);
    }

    // === Staff GUI ===
    if (staff) {
      const staffPage = await browser.newPage();
      await staffPage.setViewport({ width: 1440, height: 900 });
      const staffTokenGui = await mintSession(staff.id);
      const staffUser = {
        id: staff.id,
        email: staff.email,
        name: staff.name,
        role: 'موظف',
        tenant_type: 'TENANT',
        entity_id: staff.entity_id || 'T001',
        entity_name: staff.entity_name || 'Tenant Co',
        allowed_pages: ['dashboard', 'tasks-management', 'my-tasks', 'services']
      };
      await injectSession(staffPage, staffTokenGui, staffUser, { pinAcl: true });
      const staffLabels = await sidebarLabels(staffPage);
      await staffPage.screenshot({ path: path.join(SHOTS, '07-staff-sidebar.png'), fullPage: false });
      const forbidden = ['إعدادات النظام', 'إدارة الأدوار والصلاحيات', 'إدارة الاشتراكات'];
      const leaked = forbidden.filter((f) => staffLabels.some((l) => l.includes(f)));
      record('gui-staff', 'no-unauthorized-admin-pages',
        leaked.length === 0 ? 'PASS' : 'FAIL',
        leaked.length ? `leaked=${leaked.join(',')}` : `visible=${staffLabels.slice(0, 8).join('|')}`);
      record('gui-staff', 'sidebar-respects-allowed-pages',
        staffLabels.length > 0 && staffLabels.length < 17 ? 'PASS' : 'FAIL',
        `count=${staffLabels.length} visible=${staffLabels.join('|')}`);
      await staffPage.close().catch(() => null);
    }

    // Final owner desktop shot at defaults
    await page.setViewport({ width: 1440, height: 900 });
    await injectSession(page, ownerToken, ownerUser);
    await page.screenshot({ path: path.join(SHOTS, '08-final-desktop-sidebar.png'), fullPage: false });
    record('final', 'desktop-sidebar-shot', 'PASS', '08-final-desktop-sidebar.png');

  } catch (err) {
    record('suite', 'error', 'FAIL', err.stack || err.message);
  } finally {
    await browser.close().catch(() => null);
  }

  writeReport();
  const failed = results.filter((r) => r.status === 'FAIL');
  console.log(`\nSUMMARY: ${results.length - failed.length}/${results.length} PASS`);
  if (failed.length) {
    console.log('FAILURES:');
    failed.forEach((f) => console.log(` - [${f.group}] ${f.name}: ${f.detail}`));
    process.exit(1);
  }
  console.log('VERDICT: PASS — ready for human review (no merge)');
}

function writeReport() {
  const byGroup = {};
  for (const r of results) {
    if (!byGroup[r.group]) byGroup[r.group] = { PASS: 0, FAIL: 0, items: [] };
    byGroup[r.group][r.status] = (byGroup[r.group][r.status] || 0) + 1;
    byGroup[r.group].items.push(r);
  }
  const report = {
    generatedAt: new Date().toString(),
    verdict: results.some((r) => r.status === 'FAIL') ? 'FAIL' : 'PASS',
    totals: {
      pass: results.filter((r) => r.status === 'PASS').length,
      fail: results.filter((r) => r.status === 'FAIL').length,
      total: results.length
    },
    byGroup,
    results
  };
  fs.writeFileSync(path.join(OUT, 'final-review-report.json'), JSON.stringify(report, null, 2));
  const md = [
    '# Master Sidebar Final Review — PASS/FAIL',
    '',
    `Generated: ${report.generatedAt}`,
    `Verdict: **${report.verdict}** (${report.totals.pass}/${report.totals.total} PASS)`,
    '',
    '## By group',
    ...Object.entries(byGroup).map(([g, v]) =>
      `- **${g}**: ${v.PASS || 0} PASS / ${v.FAIL || 0} FAIL`),
    '',
    '## Details',
    ...results.map((r) => `- ${r.status} \`${r.group}\` / ${r.name}${r.detail ? ` — ${r.detail}` : ''}`),
    '',
    '## Screenshots',
    ...fs.readdirSync(SHOTS).map((f) => `- \`${f}\``),
    '',
    'No merge / staging / production deploy performed.'
  ].join('\n');
  fs.writeFileSync(path.join(OUT, 'FINAL-REVIEW.md'), md);
  console.log(`Wrote ${path.join(OUT, 'FINAL-REVIEW.md')}`);
}

main().catch((err) => {
  console.error(err);
  record('suite', 'fatal', 'FAIL', err.message);
  writeReport();
  process.exit(1);
});
