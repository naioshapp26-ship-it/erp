'use strict';
/**
 * Real browser E2E: Super Admin creates employee + login, employee ESS leave, manager approve.
 * Local only — uses :3010.
 */
const fs = require('fs');
const path = require('path');
const http = require('http');
const puppeteer = require('puppeteer-core');

const BASE = process.env.TEST_BASE_URL || 'http://127.0.0.1:3010';
const OUT = '/opt/cursor/artifacts/screenshots';
const REPORT = '/opt/cursor/artifacts/hr-onboard-gui-results.json';
fs.mkdirSync(OUT, { recursive: true });

const ADMIN = { email: 'admin@naiosh.com', password: 'Admin@123' };
const MANAGER = { email: 'hr-manager@test.local', password: 'Manager@123' };
const stamp = Date.now();
const EMP = {
  number: `EMP-GUI-${stamp}`,
  name: `موظف واجهة ${stamp}`,
  email: `gui-emp-${stamp}@test.local`,
  password: 'Employee@123',
  position: 'موظف تجريبي',
  department: 'الموارد البشرية'
};

const results = [];
function record(name, pass, detail) {
  results.push({ name, status: pass ? 'PASS' : 'FAIL', detail: detail || null });
  console.log(`${pass ? 'PASS' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`);
}

function postJson(urlPath, body, headers = {}) {
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
        'Content-Length': Buffer.byteLength(payload),
        ...headers
      }
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

async function loginApi(email, password) {
  const login = await postJson('/api/auth/login', { email, password });
  if (!login.json?.success) throw new Error(`login failed ${email}: ${login.raw?.slice(0, 200)}`);
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

async function shot(page, name) {
  const file = path.join(OUT, name);
  await page.screenshot({ path: file, fullPage: true });
  return file;
}

async function main() {
  const admin = await loginApi(ADMIN.email, ADMIN.password);
  record('admin-login-api', true, admin.user.email);

  const browser = await puppeteer.launch({
    executablePath: process.env.CHROME_PATH || '/usr/local/bin/google-chrome',
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1440,900']
  });

  let leaveTitleHint = '';

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });
    await injectSession(page, admin.token, admin.user);

    // 1) Open employees page
    await page.goto(`${BASE}/hr/employees`, { waitUntil: 'networkidle2', timeout: 90000 });
    await new Promise((r) => setTimeout(r, 2500));
    const hasAddBtn = await page.evaluate(() => {
      const btns = [...document.querySelectorAll('button')];
      return btns.some((b) => (b.textContent || '').includes('إضافة موظف'));
    });
    record('employees-page-add-button', hasAddBtn);
    await shot(page, 'onboard-01-employees-page.png');

    // 2) Open modal and fill
    await page.evaluate(() => {
      const btn = [...document.querySelectorAll('button')].find((b) => (b.textContent || '').includes('إضافة موظف'));
      if (btn) btn.click();
      else if (typeof openEmployeeModal === 'function') openEmployeeModal('add');
    });
    await new Promise((r) => setTimeout(r, 800));
    const modalVisible = await page.evaluate(() => {
      const m = document.getElementById('employeeModal');
      return m && !m.classList.contains('hidden');
    });
    record('employee-modal-open', modalVisible);
    await shot(page, 'onboard-02-employee-modal.png');

    await page.evaluate((emp) => {
      const form = document.getElementById('employeeForm');
      form.employee_number.value = emp.number;
      form.full_name.value = emp.name;
      form.email.value = emp.email;
      form.position.value = emp.position;
      form.department.value = emp.department;
      form.hire_date.value = new Date().toISOString().slice(0, 10);
      form.employment_type.value = 'FULL_TIME';
      form.entity_type.value = 'HQ';
      form.entity_value.value = '1';
      form.is_active.value = 'true';
      const chk = document.getElementById('createLoginAccount');
      if (chk) {
        chk.checked = true;
        chk.dispatchEvent(new Event('change', { bubbles: true }));
      }
      const p1 = document.getElementById('loginPassword');
      const p2 = document.getElementById('loginPasswordConfirm');
      if (p1) p1.value = emp.password;
      if (p2) p2.value = emp.password;
    }, EMP);
    await shot(page, 'onboard-03-employee-form-filled.png');

    // Submit
    await page.evaluate(() => {
      document.getElementById('employeeForm').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });
    await new Promise((r) => setTimeout(r, 3500));
    await shot(page, 'onboard-04-after-save.png');

    const toastText = await page.evaluate(() => document.getElementById('toast')?.textContent || '');
    const savedOk = /تم حفظ|نجاح|حساب الدخول/i.test(toastText)
      || await page.evaluate((email) => (document.body.innerText || '').includes(email), EMP.email);
    record('employee-save-ui', savedOk, toastText.slice(0, 120));

    // Verify login account exists via API login
    const empLogin = await loginApi(EMP.email, EMP.password);
    record('employee-login-api', !!empLogin.token, `id=${empLogin.user.id} role=${empLogin.user.role}`);
    record('employee-role-is-employee', String(empLogin.user.role).toUpperCase() === 'EMPLOYEE', empLogin.user.role);

    // 3) Employee session — ESS home
    await injectSession(page, empLogin.token, empLogin.user);
    await page.goto(`${BASE}/hr`, { waitUntil: 'networkidle2', timeout: 90000 });
    await new Promise((r) => setTimeout(r, 2500));
    const ess = await page.evaluate(() => {
      const nav = [...document.querySelectorAll('.hr-nav-title')].map((el) => el.textContent.trim());
      const cards = [...document.querySelectorAll('#hr-sections a')].map((a) => a.textContent.replace(/\s+/g, ' ').trim());
      return {
        persona: document.body.getAttribute('data-hr-persona'),
        title: document.getElementById('hrHomeTitle')?.textContent || '',
        nav,
        cards,
        hasAdminEmployees: nav.includes('الموظف') || nav.some((n) => n.includes('إعدادات النظام')),
        hasPending: nav.some((n) => n.includes('بانتظار')),
        hasLeave: cards.some((c) => c.includes('طلب إجازة')) || nav.some((n) => n.includes('إجازة'))
      };
    });
    record('ess-persona-employee', ess.persona === 'employee', ess.persona);
    record('ess-no-admin-sidebar', !ess.hasAdminEmployees && !ess.hasPending, JSON.stringify(ess.nav));
    record('ess-has-leave', ess.hasLeave, JSON.stringify(ess.cards.slice(0, 5)));
    await shot(page, 'onboard-05-employee-ess-home.png');

    // Direct admin path blocked in UI sense: pending-actions should fail API
    const pendingDenied = await page.evaluate(async () => {
      const token = localStorage.getItem('authToken');
      const res = await fetch('/api/hr/pending-actions', {
        headers: { Authorization: `Bearer ${token}`, 'x-entity-type': 'HQ', 'x-entity-id': 'HQ001' }
      });
      return { status: res.status };
    });
    record('ess-api-pending-denied', pendingDenied.status === 403, String(pendingDenied.status));

    // 4) Leave request from UI
    await page.goto(`${BASE}/hr/leaves`, { waitUntil: 'networkidle2', timeout: 90000 });
    await new Promise((r) => setTimeout(r, 2000));
    const modalOpen = await page.evaluate(() => document.getElementById('requestModal')?.classList.contains('open'));
    record('leave-modal-opens', modalOpen);
    await shot(page, 'onboard-06-leave-modal.png');

    if (modalOpen) {
      leaveTitleHint = `اختبار واجهة إجازة ${stamp}`;
      await page.evaluate((reason) => {
        const r = document.getElementById('reqReason');
        if (r) r.value = reason;
        const start = document.getElementById('reqStart');
        const end = document.getElementById('reqEnd');
        const today = new Date();
        if (start) start.value = today.toISOString().slice(0, 10);
        const next = new Date(today); next.setDate(today.getDate() + 2);
        if (end) end.value = next.toISOString().slice(0, 10);
      }, leaveTitleHint);
      await page.click('#submitRequestBtn');
      await new Promise((r) => setTimeout(r, 3000));
    }
    await shot(page, 'onboard-07-leave-submitted.png');
    const myReqs = await page.evaluate(() => document.getElementById('requestsList')?.innerText || '');
    record('leave-in-my-requests', /إجازة|بانتظار|قيد/i.test(myReqs), myReqs.slice(0, 160));

    // 5) Manager approve via API (manager account) then verify employee status in UI
    const mgr = await loginApi(MANAGER.email, MANAGER.password);
    const pending = await page.evaluate(async (token) => {
      const res = await fetch('/api/hr/pending-actions', {
        headers: { Authorization: `Bearer ${token}`, 'x-entity-type': 'HQ', 'x-entity-id': 'HQ001', 'Content-Type': 'application/json' }
      });
      return { status: res.status, data: await res.json() };
    }, mgr.token);
    record('manager-sees-pending', pending.status < 300 && (pending.data.count || 0) >= 1, `count=${pending.data.count}`);

    const leaveRow = (pending.data.requests || []).find((r) =>
      String(r.employee_id) === String(empLogin.user.id)
      || String(r.employee_name || '').includes(String(stamp))
      || /إجازة|leave/i.test(r.request_type || '')
    );
    record('manager-finds-employee-leave', !!leaveRow, leaveRow?.id || 'none');

    if (leaveRow) {
      for (const actor of ['المدير المباشر', 'الموارد البشرية']) {
        const dec = await postJson(`/api/employee-requests/${encodeURIComponent(leaveRow.id)}/decide`, {
          decision: 'approve',
          actorName: actor,
          notes: 'اعتماد اختبار واجهة'
        }, {
          Authorization: `Bearer ${mgr.token}`,
          'x-entity-type': 'HQ',
          'x-entity-id': 'HQ001'
        });
        if (!(dec.status < 300 && dec.json?.success)) {
          record('manager-approve-step', false, JSON.stringify(dec.json || dec.raw).slice(0, 180));
          break;
        }
        if (dec.json.request?.status === 'APPROVED') {
          record('manager-approve-final', true, dec.json.request.status);
          break;
        }
      }
    }

    await injectSession(page, mgr.token, mgr.user);
    await page.goto(`${BASE}/hr`, { waitUntil: 'networkidle2', timeout: 90000 });
    await new Promise((r) => setTimeout(r, 2500));
    const mgrHome = await page.evaluate(() => ({
      persona: document.body.getAttribute('data-hr-persona'),
      hasApprovals: (document.body.innerText || '').includes('الموافقة والرفض'),
      hasAdminSection: !!document.querySelector('[data-section-id="admin"]')
    }));
    record('manager-home-admin-cards', mgrHome.persona === 'manager' && mgrHome.hasApprovals, JSON.stringify(mgrHome));
    await shot(page, 'onboard-08-manager-home.png');

    await page.goto(`${BASE}/hr/pending-actions`, { waitUntil: 'networkidle2', timeout: 90000 });
    await new Promise((r) => setTimeout(r, 2000));
    await shot(page, 'onboard-09-manager-pending.png');

    // Employee sees approved
    await injectSession(page, empLogin.token, empLogin.user);
    await page.goto(`${BASE}/hr/my-requests`, { waitUntil: 'networkidle2', timeout: 90000 });
    await new Promise((r) => setTimeout(r, 2500));
    const finalList = await page.evaluate(() => document.getElementById('requestsList')?.innerText || '');
    record('employee-sees-approved', /مقبول|معتمد|APPROVED/i.test(finalList), finalList.slice(0, 200));
    await shot(page, 'onboard-10-employee-approved.png');

    // Mobile ESS
    await page.setViewport({ width: 390, height: 844 });
    await page.goto(`${BASE}/hr`, { waitUntil: 'networkidle2', timeout: 90000 });
    await new Promise((r) => setTimeout(r, 2000));
    await shot(page, 'onboard-11-employee-ess-mobile.png');
  } finally {
    await browser.close();
  }

  fs.writeFileSync(REPORT, JSON.stringify({
    env: 'local',
    base: BASE,
    employee: { email: EMP.email, number: EMP.number },
    results,
    pr174Merged: false
  }, null, 2));

  const failed = results.filter((r) => r.status === 'FAIL');
  console.log(`\n${results.length - failed.length}/${results.length} PASS`);
  console.log(`Employee credentials for manual retry: ${EMP.email} / ${EMP.password}`);
  if (failed.length) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
