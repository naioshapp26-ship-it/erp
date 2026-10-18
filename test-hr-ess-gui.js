'use strict';
/**
 * GUI evidence: employee ESS (no admin sidebar) + manager portal cards + leave flow.
 */
const fs = require('fs');
const path = require('path');
const http = require('http');
const puppeteer = require('puppeteer-core');

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
  const token = (session && typeof session === 'object' ? session.token : session)
    || login.json.data.token;
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
  const emp = await login(EMPLOYEE.email, EMPLOYEE.password);
  const mgr = await login(MANAGER.email, MANAGER.password);
  record('login-employee', true, emp.user.email);
  record('login-manager', true, mgr.user.email);

  const browser = await puppeteer.launch({
    executablePath: process.env.CHROME_PATH || '/usr/local/bin/google-chrome',
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1440,900']
  });

  try {
    // —— Employee ESS home ——
    const empPage = await browser.newPage();
    await empPage.setViewport({ width: 1440, height: 900 });
    await injectSession(empPage, emp.token, emp.user);
    await empPage.goto(`${BASE}/hr`, { waitUntil: 'networkidle2', timeout: 60000 });
    await new Promise((r) => setTimeout(r, 2500));

    const empSnap = await empPage.evaluate(() => {
      const text = document.body.innerText || '';
      const nav = [...document.querySelectorAll('.hr-nav-title')].map((el) => el.textContent.trim());
      const cards = [...document.querySelectorAll('#hr-sections a, #hr-cards a')].map((a) => a.textContent.replace(/\s+/g, ' ').trim());
      return {
        persona: document.body.getAttribute('data-hr-persona'),
        title: document.getElementById('hrHomeTitle')?.textContent || '',
        nav,
        cards,
        hasAdminEmployees: nav.some((n) => n === 'الموظف' || n.includes('إعدادات النظام')),
        hasLeave: cards.some((c) => c.includes('طلب إجازة')) || nav.some((n) => n.includes('إجازة')),
        hasPendingNav: nav.some((n) => n.includes('بانتظار')),
        essMode: document.body.classList.contains('hr-ess-mode')
      };
    });
    record('employee-persona', empSnap.persona === 'employee', empSnap.persona);
    record('employee-no-admin-nav', !empSnap.hasAdminEmployees && !empSnap.hasPendingNav, JSON.stringify(empSnap.nav));
    record('employee-has-leave-card', empSnap.hasLeave, JSON.stringify(empSnap.cards.slice(0, 8)));
    await empPage.screenshot({ path: path.join(OUT, 'hr-ess-employee-desktop.png'), fullPage: true });

    await empPage.setViewport({ width: 390, height: 844 });
    await empPage.reload({ waitUntil: 'networkidle2' });
    await new Promise((r) => setTimeout(r, 2000));
    await empPage.screenshot({ path: path.join(OUT, 'hr-ess-employee-mobile.png'), fullPage: true });

    // Leave flow UI
    await empPage.setViewport({ width: 1440, height: 900 });
    await empPage.goto(`${BASE}/hr/leaves`, { waitUntil: 'networkidle2', timeout: 60000 });
    await new Promise((r) => setTimeout(r, 2000));
    const modalOpen = await empPage.evaluate(() => {
      const modal = document.getElementById('requestModal');
      return modal && modal.classList.contains('open');
    });
    record('employee-leave-modal', modalOpen, 'modal open on /hr/leaves');
    if (modalOpen) {
      await empPage.evaluate(() => {
        const reason = document.getElementById('reqReason');
        if (reason) reason.value = 'اختبار GUI طلب إجازة';
      });
      await empPage.click('#submitRequestBtn');
      await new Promise((r) => setTimeout(r, 2500));
    }
    await empPage.screenshot({ path: path.join(OUT, 'hr-ess-leave-submit.png'), fullPage: true });
    const myList = await empPage.evaluate(() => document.getElementById('requestsList')?.innerText || '');
    record('employee-my-requests-shows-leave', /إجازة|بانتظار|قيد/i.test(myList), myList.slice(0, 180));

    // —— Manager home ——
    const mgrPage = await browser.newPage();
    await mgrPage.setViewport({ width: 1440, height: 900 });
    await injectSession(mgrPage, mgr.token, mgr.user);
    await mgrPage.goto(`${BASE}/hr`, { waitUntil: 'networkidle2', timeout: 60000 });
    await new Promise((r) => setTimeout(r, 2500));
    const mgrSnap = await mgrPage.evaluate(() => {
      const text = document.body.innerText || '';
      const cards = [...document.querySelectorAll('#hr-sections a, #hr-cards a')].map((a) => a.textContent.replace(/\s+/g, ' ').trim());
      const sections = [...document.querySelectorAll('#hr-sections [data-section-id]')].map((s) => s.getAttribute('data-section-id'));
      return {
        persona: document.body.getAttribute('data-hr-persona'),
        title: document.getElementById('hrHomeTitle')?.textContent || '',
        sections,
        hasApprovals: cards.some((c) => c.includes('الموافقة والرفض')),
        hasEmpRequests: cards.some((c) => c.includes('طلبات الموظفين')),
        hasFiles: cards.some((c) => c.includes('ملفات الموظفين')),
        hasReports: cards.some((c) => c.includes('التقارير')),
        hasSettings: cards.some((c) => c.includes('إعدادات')),
        hasKeep: cards.some((c) => c.includes('تقييم الأداء') || c.includes('إدارة ملفات الموظفين')),
        cardCount: cards.length
      };
    });
    record('manager-persona', mgrSnap.persona === 'manager', mgrSnap.persona);
    record('manager-admin-section', mgrSnap.sections.includes('admin'), JSON.stringify(mgrSnap.sections));
    record('manager-approvals-card', mgrSnap.hasApprovals);
    record('manager-requests-card', mgrSnap.hasEmpRequests);
    record('manager-files-card', mgrSnap.hasFiles);
    record('manager-reports-card', mgrSnap.hasReports);
    record('manager-keep-present', mgrSnap.hasKeep, `cards=${mgrSnap.cardCount}`);
    await mgrPage.screenshot({ path: path.join(OUT, 'hr-manager-home-desktop.png'), fullPage: true });

    await mgrPage.setViewport({ width: 390, height: 844 });
    await mgrPage.reload({ waitUntil: 'networkidle2' });
    await new Promise((r) => setTimeout(r, 2000));
    await mgrPage.screenshot({ path: path.join(OUT, 'hr-manager-home-mobile.png'), fullPage: true });

    await mgrPage.setViewport({ width: 1440, height: 900 });
    await mgrPage.goto(`${BASE}/hr/pending-actions`, { waitUntil: 'networkidle2', timeout: 60000 });
    await new Promise((r) => setTimeout(r, 2000));
    await mgrPage.screenshot({ path: path.join(OUT, 'hr-manager-pending.png'), fullPage: true });
    const pendingText = await mgrPage.evaluate(() => document.body.innerText || '');
    record('manager-pending-page', /بانتظار|طلب|إجازة/i.test(pendingText), pendingText.slice(0, 120));
  } finally {
    await browser.close();
  }

  const failed = results.filter((r) => r.status === 'FAIL');
  fs.writeFileSync('/opt/cursor/artifacts/hr-ess-gui-results.json', JSON.stringify(results, null, 2));
  console.log(`\n${results.length - failed.length}/${results.length} PASS`);
  if (failed.length) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
