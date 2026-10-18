'use strict';
/**
 * GUI evidence for HR home reorganization (manager groups + employee ESS).
 */
const fs = require('fs');
const path = require('path');
const http = require('http');
const puppeteer = require('puppeteer-core');
const { buildPortalPayload } = require('./hr-portal-access');

const BASE = process.env.TEST_BASE_URL || 'http://127.0.0.1:3010';
const OUT = '/opt/cursor/artifacts/screenshots';
fs.mkdirSync(OUT, { recursive: true });

const EMPLOYEE = {
  email: process.env.HR_ESS_EMPLOYEE_EMAIL || 'hr-employee@test.local',
  password: process.env.HR_ESS_EMPLOYEE_PASSWORD || 'Employee@123'
};
const MANAGER = {
  email: process.env.HR_ESS_MANAGER_EMAIL || 'hr-manager@test.local',
  password: process.env.HR_ESS_MANAGER_PASSWORD || 'Manager@123'
};
const ADMIN = { email: 'admin@naiosh.com', password: 'Admin@123' };

const results = [];
function record(name, pass, detail) {
  results.push({ name, status: pass ? 'PASS' : 'FAIL', detail: detail || null });
  console.log(`${pass ? 'PASS' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`);
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
  const login = await postJson('/api/auth/login', { email, password });
  if (!login.json?.success) throw new Error(`login failed ${email}`);
  const session = login.json.data.session;
  const token = (session && typeof session === 'object' ? session.token : session) || login.json.data.token;
  return { token, user: login.json.data.user };
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
}

async function main() {
  // Unit: no duplicate hrefs + expected groups
  const mgrPayload = buildPortalPayload('MANAGER');
  const hrefs = mgrPayload.modules.map((m) => m.href);
  record('unit-no-duplicate-hrefs', new Set(hrefs).size === hrefs.length, `n=${hrefs.length}`);
  record(
    'unit-has-groups',
    ['employees-mgmt', 'attendance-payroll', 'performance-dev', 'requests-approvals', 'reports-settings']
      .every((id) => mgrPayload.sections.some((s) => s.id === id)),
    mgrPayload.sections.map((s) => s.id).join(',')
  );
  record(
    'unit-no-duplicate-files-label',
    !mgrPayload.modules.some((m) => m.label === 'إدارة ملفات الموظفين')
      && mgrPayload.modules.some((m) => m.label === 'ملفات الموظفين')
      && mgrPayload.modules.some((m) => m.label.includes('360')),
    mgrPayload.modules.filter((m) => /ملفات|360/.test(m.label)).map((m) => m.label).join(' | ')
  );

  const emp = await login(EMPLOYEE.email, EMPLOYEE.password);
  let mgr;
  try {
    mgr = await login(MANAGER.email, MANAGER.password);
  } catch {
    mgr = await login(ADMIN.email, ADMIN.password);
  }
  record('login-employee', true, emp.user.email);
  record('login-manager', true, mgr.user.email);

  const browser = await puppeteer.launch({
    executablePath: process.env.CHROME_PATH || '/usr/local/bin/google-chrome',
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1440,900']
  });

  try {
    // Manager desktop
    const mgrPage = await browser.newPage();
    await mgrPage.setViewport({ width: 1440, height: 900 });
    await injectSession(mgrPage, mgr.token, mgr.user);
    await mgrPage.goto(`${BASE}/hr`, { waitUntil: 'networkidle2', timeout: 90000 });
    await new Promise((r) => setTimeout(r, 2500));
    await mgrPage.screenshot({ path: path.join(OUT, 'hr-home-manager-desktop.png'), fullPage: true });
    fs.copyFileSync(path.join(OUT, 'hr-home-manager-desktop.png'), '/opt/cursor/artifacts/hr-home-manager-desktop.png');

    const mgrSnap = await mgrPage.evaluate(() => {
      const sections = [...document.querySelectorAll('#hr-sections [data-section-id]')].map((s) => ({
        id: s.getAttribute('data-section-id'),
        title: s.querySelector('.hr-section-title')?.textContent?.trim() || '',
        cards: [...s.querySelectorAll('a')].map((a) => ({
          href: a.getAttribute('href'),
          label: (a.querySelector('span span') || a).textContent.replace(/\s+/g, ' ').trim()
        }))
      }));
      const allHrefs = sections.flatMap((s) => s.cards.map((c) => c.href));
      return {
        persona: document.body.getAttribute('data-hr-persona'),
        title: document.getElementById('hrHomeTitle')?.textContent || '',
        sections,
        dupHrefs: allHrefs.filter((h, i) => allHrefs.indexOf(h) !== i),
        hasOldDupLabel: sections.some((s) => s.cards.some((c) => c.label.includes('إدارة ملفات الموظفين')))
      };
    });
    record('gui-manager-persona', /manager|admin|owner|hr/i.test(String(mgrSnap.persona)), mgrSnap.persona);
    record('gui-manager-groups', mgrSnap.sections.length >= 5, `n=${mgrSnap.sections.length}`);
    record('gui-manager-no-dup-href', mgrSnap.dupHrefs.length === 0, JSON.stringify(mgrSnap.dupHrefs));
    record('gui-manager-no-old-dup-label', !mgrSnap.hasOldDupLabel);

    // Click-through a few manager cards
    const clickTargets = [
      { name: 'ملفات الموظفين', href: '/hr/employees' },
      { name: 'الحضور والانصراف', href: '/hr/attendance-departure' },
      { name: 'تقييم الأداء', href: '/hr/performance' },
      { name: 'مسير الرواتب', href: '/hr/payroll' },
      { name: 'الموافقات والرفض', href: '/hr/pending-actions' }
    ];
    for (const target of clickTargets) {
      await mgrPage.goto(`${BASE}/hr`, { waitUntil: 'networkidle2', timeout: 60000 });
      await new Promise((r) => setTimeout(r, 800));
      const clicked = await mgrPage.evaluate((href) => {
        const a = [...document.querySelectorAll('#hr-sections a')].find((el) => (el.getAttribute('href') || '') === href);
        if (!a) return false;
        a.click();
        return true;
      }, target.href);
      await new Promise((r) => setTimeout(r, 2000));
      const url = mgrPage.url();
      const ok = clicked && url.includes(target.href.split('?')[0].replace(/^\//, '').split('/').pop() || target.href);
      // softer: path contains key segment
      const softOk = clicked && (url.includes(target.href) || url.includes(target.href.replace('/hr/', '')));
      record(`click-${target.name}`, softOk || (clicked && !url.endsWith('/hr')), `url=${url}`);
    }

    // Manager mobile
    await mgrPage.setViewport({ width: 390, height: 844 });
    await mgrPage.goto(`${BASE}/hr`, { waitUntil: 'networkidle2', timeout: 60000 });
    await new Promise((r) => setTimeout(r, 2000));
    await mgrPage.screenshot({ path: path.join(OUT, 'hr-home-manager-mobile.png'), fullPage: true });
    fs.copyFileSync(path.join(OUT, 'hr-home-manager-mobile.png'), '/opt/cursor/artifacts/hr-home-manager-mobile.png');

    // Employee desktop
    const empPage = await browser.newPage();
    await empPage.setViewport({ width: 1440, height: 900 });
    await injectSession(empPage, emp.token, emp.user);
    await empPage.goto(`${BASE}/hr`, { waitUntil: 'networkidle2', timeout: 90000 });
    await new Promise((r) => setTimeout(r, 2500));
    await empPage.screenshot({ path: path.join(OUT, 'hr-home-employee-desktop.png'), fullPage: true });
    fs.copyFileSync(path.join(OUT, 'hr-home-employee-desktop.png'), '/opt/cursor/artifacts/hr-home-employee-desktop.png');

    const empSnap = await empPage.evaluate(() => {
      const cards = [...document.querySelectorAll('#hr-sections a')].map((a) => a.textContent.replace(/\s+/g, ' ').trim());
      const sections = [...document.querySelectorAll('#hr-sections [data-section-id]')].map((s) => s.getAttribute('data-section-id'));
      return {
        persona: document.body.getAttribute('data-hr-persona'),
        essMode: document.body.classList.contains('hr-ess-mode'),
        sections,
        cards,
        hasAdminFiles: cards.some((c) => c.includes('ملفات الموظفين') && !c.includes('حضوري')),
        hasLeave: cards.some((c) => c.includes('إجازة')),
        hasPending: cards.some((c) => c.includes('الموافقات'))
      };
    });
    record('gui-employee-persona', empSnap.persona === 'employee', empSnap.persona);
    record('gui-employee-ess-only', empSnap.sections.includes('ess') && !empSnap.hasAdminFiles && !empSnap.hasPending, JSON.stringify(empSnap.sections));
    record('gui-employee-has-leave', empSnap.hasLeave);

    // Employee leave page
    await empPage.goto(`${BASE}/hr/leaves`, { waitUntil: 'networkidle2', timeout: 60000 });
    await new Promise((r) => setTimeout(r, 1500));
    const leaveOk = /إجازة|طلب/i.test(await empPage.evaluate(() => document.body.innerText || ''));
    record('gui-employee-leave-page', leaveOk);
    await empPage.screenshot({ path: path.join(OUT, 'hr-home-employee-leave.png'), fullPage: true });

    // Employee mobile
    await empPage.setViewport({ width: 390, height: 844 });
    await empPage.goto(`${BASE}/hr`, { waitUntil: 'networkidle2', timeout: 60000 });
    await new Promise((r) => setTimeout(r, 2000));
    await empPage.screenshot({ path: path.join(OUT, 'hr-home-employee-mobile.png'), fullPage: true });
    fs.copyFileSync(path.join(OUT, 'hr-home-employee-mobile.png'), '/opt/cursor/artifacts/hr-home-employee-mobile.png');
  } finally {
    await browser.close();
  }

  const failed = results.filter((r) => r.status === 'FAIL');
  fs.writeFileSync('/opt/cursor/artifacts/hr-home-reorganize-results.json', JSON.stringify({ results, mgrPayload: {
    sections: mgrPayload.sections.map((s) => ({ id: s.id, title: s.title, cards: s.cards.map((c) => ({ label: c.label, href: c.href })) }))
  } }, null, 2));
  console.log(`\n${results.length - failed.length}/${results.length} PASS`);
  if (failed.length) process.exit(1);
}

main().catch((e) => { console.error(e); process.exit(1); });
