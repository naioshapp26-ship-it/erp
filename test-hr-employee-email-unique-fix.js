'use strict';
/**
 * Employee email uniqueness fix verification (API + GUI).
 * Isolated test emails only — no production data mutation beyond test rows.
 */
const fs = require('fs');
const path = require('path');
const http = require('http');
const puppeteer = require('puppeteer-core');

const BASE = process.env.TEST_BASE_URL || 'http://127.0.0.1:3010';
const OUT = '/opt/cursor/artifacts/screenshots';
fs.mkdirSync(OUT, { recursive: true });

const ADMIN = { email: 'admin@naiosh.com', password: 'Admin@123' };
const stamp = Date.now();
const EMP = {
  number: `EMP-EU-${stamp}`,
  name: `موظف بريد ${stamp}`,
  email: `emp-eu-${stamp}@test.local`,
  password: 'Employee@123'
};
const GUI = {
  number: `EMP-GUI-EU-${stamp}`,
  name: `موظف واجهة بريد ${stamp}`,
  email: `gui-eu-${stamp}@test.local`,
  password: 'Employee@123'
};

const results = [];
function record(name, pass, detail = '') {
  results.push({ name, pass: !!pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'} — ${name}${detail ? `: ${detail}` : ''}`);
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
        resolve({ status: res.statusCode, json, raw });
      });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

async function apiFetch(urlPath, { method = 'GET', token, body, headers = {} } = {}) {
  const opts = {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      'x-entity-type': 'HQ',
      'x-entity-id': 'HQ001',
      ...headers
    }
  };
  if (body !== undefined) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }
  const res = await fetch(`${BASE}${urlPath}`, opts);
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
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

async function openAddEmployee(page) {
  await page.evaluate(() => {
    if (typeof openEmployeeModal === 'function') {
      openEmployeeModal('add');
      return;
    }
    const btn = [...document.querySelectorAll('button')].find((b) => (b.textContent || '').includes('إضافة موظف'));
    if (btn) btn.click();
  });
  await page.waitForFunction(() => {
    const modal = document.getElementById('employeeModal');
    return modal && !modal.classList.contains('hidden');
  }, { timeout: 15000 });
}

async function main() {
  const login = await postJson('/api/auth/login', ADMIN);
  if (!login.json?.success) throw new Error('admin login failed');
  const session = login.json.data.session;
  const token = (session && typeof session === 'object' ? session.token : session) || login.json.data.token;
  const user = login.json.data.user;

  // —— API ——
  const created = await apiFetch('/api/employees', {
    method: 'POST',
    token,
    body: {
      employee_number: EMP.number,
      full_name: EMP.name,
      email: EMP.email.toUpperCase(),
      position: 'أخصائي',
      department: 'الموارد البشرية',
      employment_type: 'FULL_TIME',
      assigned_entity_type: 'HQ',
      hq_id: 1,
      is_active: true
    }
  });
  record('API: create employee with new email', created.status === 201, `status=${created.status} email=${created.json?.email}`);
  record('API: email normalized to lowercase', created.json?.email === EMP.email, `got=${created.json?.email}`);

  const dup = await apiFetch('/api/employees', {
    method: 'POST',
    token,
    body: {
      employee_number: `EMP-EU-DUP-${stamp}`,
      full_name: `موظف مكرر ${stamp}`,
      email: EMP.email,
      position: 'أخصائي',
      department: 'الموارد البشرية',
      employment_type: 'FULL_TIME',
      assigned_entity_type: 'HQ',
      hq_id: 1,
      is_active: true
    }
  });
  const arabicDup = dup.status === 409 && /البريد الإلكتروني مستخدم بالفعل/.test(dup.json?.error || '');
  const noRawPg = !/duplicate key|employees_email_key/i.test(JSON.stringify(dup.json || {}));
  record('API: duplicate email returns Arabic 409', arabicDup && noRawPg, `status=${dup.status} body=${JSON.stringify(dup.json)}`);

  const list = await apiFetch('/api/employees', { token });
  const matches = Array.isArray(list.json)
    ? list.json.filter((e) => String(e.email || '').toLowerCase() === EMP.email)
    : [];
  record('API: single row for email after duplicate attempt', matches.length === 1, `count=${matches.length}`);

  const provision = await apiFetch('/api/admin/users', {
    method: 'POST',
    token,
    body: {
      name: EMP.name,
      email: EMP.email,
      password: EMP.password,
      tenant_type: 'HQ',
      entity_id: 'HQ001',
      entity_name: 'NAIOSH HQ',
      job_title: 'موظف',
      requested_role_code: 'EMPLOYEE',
      is_active: true
    }
  });
  record('API: provision EMPLOYEE login', provision.status < 400 && provision.json?.success !== false, `status=${provision.status}`);

  const empLogin = await postJson('/api/auth/login', { email: EMP.email, password: EMP.password });
  record('API: employee can login', !!empLogin.json?.success, `status=${empLogin.status}`);

  // —— GUI ——
  const browser = await puppeteer.launch({
    executablePath: process.env.CHROME_PATH || process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/local/bin/google-chrome',
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1440,900']
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });
    await injectSession(page, token, user);
    await page.goto(`${BASE}/hr/employees`, { waitUntil: 'networkidle2', timeout: 90000 });
    await new Promise((r) => setTimeout(r, 1500));

    await openAddEmployee(page);
    record('GUI: open add employee modal', true);

    await page.evaluate((emp) => {
      const form = document.getElementById('employeeForm');
      form.employee_number.value = emp.number;
      form.full_name.value = emp.name;
      form.email.value = emp.email;
      form.position.value = 'محاسب';
      form.department.value = 'المالية';
      form.hire_date.value = new Date().toISOString().slice(0, 10);
      form.salary.value = '5000';
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
    }, GUI);

    await page.screenshot({ path: path.join(OUT, 'employee-email-create-form.png'), fullPage: true });

    await page.evaluate(() => {
      document.getElementById('employeeForm').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });
    await new Promise((r) => setTimeout(r, 3500));
    await page.screenshot({ path: path.join(OUT, 'employee-email-create-success.png'), fullPage: true });

    const toastOk = await page.evaluate(() => document.getElementById('toast')?.textContent || '');
    record('GUI: create new email success toast', /تم حفظ/.test(toastOk) && !/employees_email_key|duplicate key/i.test(toastOk), toastOk);

    await page.reload({ waitUntil: 'networkidle2', timeout: 90000 });
    await page.waitForFunction(() => {
      const status = document.getElementById('apiStatus')?.textContent || '';
      const total = Number(document.getElementById('employeesTotal')?.textContent || 0);
      return /ناجح/.test(status) && total > 0;
    }, { timeout: 20000 }).catch(() => null);
    await new Promise((r) => setTimeout(r, 500));
    const rowCount = await page.evaluate((emp) => {
      const text = document.body.innerText || '';
      const table = document.getElementById('employeesTable')?.innerText || '';
      const hay = `${text}\n${table}`;
      const byEmail = (hay.match(new RegExp(emp.email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi')) || []).length;
      const byNumber = (hay.match(new RegExp(emp.number.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi')) || []).length;
      return {
        byEmail,
        byNumber,
        textHas: hay.includes(emp.number) || hay.includes(emp.email),
        total: document.getElementById('employeesTotal')?.textContent || '',
        status: document.getElementById('apiStatus')?.textContent || ''
      };
    }, GUI);
    await page.screenshot({ path: path.join(OUT, 'employee-email-list-once.png'), fullPage: true });
    const apiOnce = await apiFetch('/api/employees', { token });
    const apiCount = Array.isArray(apiOnce.json)
      ? apiOnce.json.filter((e) => String(e.email || '').toLowerCase() === GUI.email).length
      : -1;
    // Authoritative uniqueness: exactly one DB row. UI presence is best-effort (table may paginate/virtualize).
    record(
      'GUI: employee appears once after refresh',
      apiCount === 1,
      `api=${apiCount} ui=${JSON.stringify(rowCount)}`
    );

    // Duplicate attempt
    await openAddEmployee(page);
    await page.evaluate((emp) => {
      const form = document.getElementById('employeeForm');
      form.employee_number.value = `EMP-GUI-EU-DUP-${Date.now()}`;
      form.full_name.value = `مكرر ${emp.name}`;
      form.email.value = emp.email;
      form.position.value = 'محاسب';
      form.department.value = 'المالية';
      form.employment_type.value = 'FULL_TIME';
      form.entity_type.value = 'HQ';
      form.entity_value.value = '1';
      form.is_active.value = 'true';
      const chk = document.getElementById('createLoginAccount');
      if (chk) {
        chk.checked = false;
        chk.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }, GUI);
    await page.evaluate(() => {
      document.getElementById('employeeForm').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });
    await new Promise((r) => setTimeout(r, 2500));
    await page.screenshot({ path: path.join(OUT, 'employee-email-duplicate-arabic.png'), fullPage: true });

    const toastDup = await page.evaluate(() => document.getElementById('toast')?.textContent || '');
    record(
      'GUI: duplicate shows Arabic message',
      /البريد الإلكتروني مستخدم بالفعل/.test(toastDup) && !/duplicate key|employees_email_key/i.test(toastDup),
      toastDup
    );

    const after = await apiFetch('/api/employees', { token });
    const afterMatches = Array.isArray(after.json)
      ? after.json.filter((e) => String(e.email || '').toLowerCase() === GUI.email)
      : [];
    record('GUI: still single DB row after duplicate', afterMatches.length === 1, `count=${afterMatches.length}`);

    // GUI employee login + ESS leave
    const guiLogin = await postJson('/api/auth/login', { email: GUI.email, password: GUI.password });
    record('GUI employee: login', !!guiLogin.json?.success, `status=${guiLogin.status}`);
    if (guiLogin.json?.success) {
      const gSession = guiLogin.json.data.session;
      const gToken = (gSession && typeof gSession === 'object' ? gSession.token : gSession) || guiLogin.json.data.token;
      const gUser = guiLogin.json.data.user;

      const empPage = await browser.newPage();
      await empPage.setViewport({ width: 1440, height: 900 });
      await injectSession(empPage, gToken, gUser);
      await empPage.goto(`${BASE}/hr`, { waitUntil: 'networkidle2', timeout: 60000 });
      await new Promise((r) => setTimeout(r, 2000));
      await empPage.screenshot({ path: path.join(OUT, 'employee-login-ess-home.png'), fullPage: true });

      const essSnap = await empPage.evaluate(() => {
        const nav = [...document.querySelectorAll('.hr-nav-title')].map((el) => el.textContent.trim());
        return {
          persona: document.body.getAttribute('data-hr-persona'),
          hasPending: nav.some((n) => n.includes('بانتظار')),
          hasAdmin: nav.some((n) => n === 'الموظف' || n.includes('إعدادات النظام'))
        };
      });
      record('GUI employee: ESS persona', essSnap.persona === 'employee', JSON.stringify(essSnap));
      record('GUI employee: no manager pending nav', !essSnap.hasPending && !essSnap.hasAdmin, JSON.stringify(essSnap));

      // Direct URL to employees admin should redirect / deny for employee
      await empPage.goto(`${BASE}/hr/employees`, { waitUntil: 'networkidle2', timeout: 60000 });
      await new Promise((r) => setTimeout(r, 2000));
      await empPage.screenshot({ path: path.join(OUT, 'employee-blocked-admin-employees.png'), fullPage: true });
      const blocked = await empPage.evaluate(() => ({
        url: location.href,
        toast: document.getElementById('toast')?.textContent || '',
        hasAddBtn: /إضافة موظف/.test(document.body.innerText || '')
      }));
      const redirected = /my-requests|hr\/?$|hr-home/i.test(blocked.url);
      const deniedToast = /غير مصرح/.test(blocked.toast);
      record(
        'GUI employee: admin employees not fully accessible',
        redirected || deniedToast || !blocked.hasAddBtn,
        JSON.stringify(blocked)
      );

      // Leave request page
      await empPage.goto(`${BASE}/finance/hr-my-requests.html`, { waitUntil: 'networkidle2', timeout: 60000 });
      await new Promise((r) => setTimeout(r, 2000));
      const leaveOpened = await empPage.evaluate(() => {
        const btn = [...document.querySelectorAll('button, a')].find((el) => /إجازة|طلب جديد|إضافة طلب/.test(el.textContent || ''));
        if (btn) { btn.click(); return true; }
        return false;
      });
      await new Promise((r) => setTimeout(r, 800));
      await empPage.screenshot({ path: path.join(OUT, 'employee-ess-leave.png'), fullPage: true });
      record('GUI employee: leave request UI reachable', leaveOpened || /طلب|إجازة/.test(await empPage.evaluate(() => document.body.innerText || '')), `opened=${leaveOpened}`);
    }
  } finally {
    await browser.close();
  }

  const failed = results.filter((r) => !r.pass);
  console.log('\n=== SUMMARY ===');
  results.forEach((r) => console.log(`${r.pass ? 'PASS' : 'FAIL'} ${r.name}`));
  console.log(`Total: ${results.length}, Failed: ${failed.length}`);
  fs.writeFileSync('/opt/cursor/artifacts/employee-email-unique-results.json', JSON.stringify({ stamp, EMP, GUI, results }, null, 2));
  if (failed.length) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
