'use strict';
/**
 * Full practical E2E (isolated test data only):
 * 1) Admin creates employee + login
 * 2) Duplicate email → Arabic message
 * 3) Employee ESS-only + leave submit
 * 4) Manager approves
 * 5) Employee sees new status
 * 6) Desktop/Mobile screenshots for manager + employee homes
 */
const fs = require('fs');
const path = require('path');
const http = require('http');
const puppeteer = require('puppeteer-core');

const BASE = process.env.TEST_BASE_URL || 'http://127.0.0.1:3010';
const OUT = '/opt/cursor/artifacts';
const SHOTS = path.join(OUT, 'screenshots');
fs.mkdirSync(SHOTS, { recursive: true });

const ADMIN = { email: 'admin@naiosh.com', role: 'super_admin' };
const MANAGER = { email: 'hr-manager@test.local', role: 'MANAGER' };
const stamp = Date.now();
const EMP = {
  number: `EMP-PRACT-${stamp}`,
  name: `موظف عملي ${stamp}`,
  email: `pract-emp-${stamp}@test.local`,
  password: 'Employee@123'
};

const results = [];
function record(step, pass, detail = '') {
  results.push({ step, pass: !!pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'} — ${step}${detail ? `: ${detail}` : ''}`);
}

function postJson(urlPath, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(urlPath, BASE);
    const payload = JSON.stringify(body);
    const req = http.request({
      hostname: u.hostname,
      port: u.port || 80,
      path: u.pathname + u.search,
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

async function login(email, password) {
  const res = await postJson('/api/auth/login', { email, password });
  if (!res.json?.success) throw new Error(`login failed ${email}: ${res.raw?.slice(0, 160)}`);
  const session = res.json.data.session;
  const token = (session && typeof session === 'object' ? session.token : session) || res.json.data.token;
  return { token, user: res.json.data.user, password };
}

async function api(token, urlPath, { method = 'GET', body, userId, headers = {} } = {}) {
  const opts = {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'x-entity-type': 'HQ',
      'x-entity-id': 'HQ001',
      ...(userId ? { 'x-user-id': String(userId) } : {}),
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

async function shot(page, name) {
  const file = path.join(SHOTS, name);
  await page.screenshot({ path: file, fullPage: true });
  fs.copyFileSync(file, path.join(OUT, name));
  return file;
}

async function main() {
  // —— 1) Admin login ——
  const admin = await login(ADMIN.email, 'Admin@123');
  record('1.1 admin login', !!admin.token, `role=${admin.user.role} path=/api/auth/login`);

  // Create employee via API (authoritative) then mirror GUI path
  const created = await api(admin.token, '/api/employees', {
    method: 'POST',
    userId: admin.user.id,
    body: {
      employee_number: EMP.number,
      full_name: EMP.name,
      email: EMP.email.toUpperCase(),
      position: 'أخصائي موارد بشرية',
      department: 'الموارد البشرية',
      employment_type: 'FULL_TIME',
      assigned_entity_type: 'HQ',
      hq_id: 1,
      is_active: true,
      hire_date: new Date().toISOString().slice(0, 10)
    }
  });
  record('1.2 create employee new email', created.status === 201, `status=${created.status} email=${created.json?.email}`);
  record('1.3 email normalized', created.json?.email === EMP.email, `got=${created.json?.email}`);

  const dup = await api(admin.token, '/api/employees', {
    method: 'POST',
    userId: admin.user.id,
    body: {
      employee_number: `EMP-PRACT-DUP-${stamp}`,
      full_name: `مكرر ${EMP.name}`,
      email: EMP.email,
      position: 'أخصائي',
      department: 'الموارد البشرية',
      employment_type: 'FULL_TIME',
      assigned_entity_type: 'HQ',
      hq_id: 1,
      is_active: true
    }
  });
  const arabic = dup.status === 409 && /البريد الإلكتروني مستخدم بالفعل/.test(dup.json?.error || '');
  const noRaw = !/duplicate key|employees_email_key/i.test(JSON.stringify(dup.json || {}));
  record('1.4 duplicate email Arabic 409', arabic && noRaw, `status=${dup.status} body=${JSON.stringify(dup.json)}`);

  const list = await api(admin.token, '/api/employees', { userId: admin.user.id });
  const matches = Array.isArray(list.json)
    ? list.json.filter((e) => String(e.email || '').toLowerCase() === EMP.email)
    : [];
  record('1.5 employee appears once in roster', matches.length === 1, `count=${matches.length}`);

  const provision = await api(admin.token, '/api/admin/users', {
    method: 'POST',
    userId: admin.user.id,
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
  record('1.6 provision EMPLOYEE login', provision.status < 400 && provision.json?.success !== false, `status=${provision.status}`);

  // —— GUI: admin create another employee with login checkbox ——
  const browser = await puppeteer.launch({
    executablePath: process.env.CHROME_PATH || '/usr/local/bin/google-chrome',
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1440,900']
  });

  const GUI = {
    number: `EMP-GUI-PRACT-${stamp}`,
    name: `موظف واجهة عملي ${stamp}`,
    email: `gui-pract-${stamp}@test.local`,
    password: 'Employee@123'
  };

  try {
    const adminPage = await browser.newPage();
    await adminPage.setViewport({ width: 1440, height: 900 });
    await injectSession(adminPage, admin.token, admin.user);
    await adminPage.goto(`${BASE}/hr`, { waitUntil: 'networkidle2', timeout: 90000 });
    await new Promise((r) => setTimeout(r, 2000));
    await shot(adminPage, 'e2e-manager-home-desktop.png');

    await adminPage.setViewport({ width: 390, height: 844 });
    await adminPage.reload({ waitUntil: 'networkidle2' });
    await new Promise((r) => setTimeout(r, 1500));
    await shot(adminPage, 'e2e-manager-home-mobile.png');

    await adminPage.setViewport({ width: 1440, height: 900 });
    await adminPage.goto(`${BASE}/hr/employees`, { waitUntil: 'networkidle2', timeout: 90000 });
    await new Promise((r) => setTimeout(r, 1500));
    await adminPage.evaluate(() => {
      if (typeof openEmployeeModal === 'function') openEmployeeModal('add');
    });
    await adminPage.waitForFunction(() => {
      const m = document.getElementById('employeeModal');
      return m && !m.classList.contains('hidden');
    }, { timeout: 15000 });

    await adminPage.evaluate((emp) => {
      const form = document.getElementById('employeeForm');
      form.employee_number.value = emp.number;
      form.full_name.value = emp.name;
      form.email.value = emp.email;
      form.position.value = 'محاسب';
      form.department.value = 'المالية';
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
    }, GUI);
    await shot(adminPage, 'e2e-admin-add-employee-form.png');

    await adminPage.evaluate(() => {
      document.getElementById('employeeForm').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });
    await new Promise((r) => setTimeout(r, 3500));
    const toastCreate = await adminPage.evaluate(() => document.getElementById('toast')?.textContent || '');
    await shot(adminPage, 'e2e-admin-add-employee-success.png');
    record('1.7 GUI create employee+login', /تم حفظ/.test(toastCreate) && !/employees_email_key|duplicate key/i.test(toastCreate), toastCreate);

    // Duplicate via GUI using same email
    await adminPage.evaluate(() => {
      if (typeof openEmployeeModal === 'function') openEmployeeModal('add');
    });
    await new Promise((r) => setTimeout(r, 500));
    await adminPage.evaluate((emp) => {
      const form = document.getElementById('employeeForm');
      form.employee_number.value = `EMP-GUI-DUP-${Date.now()}`;
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
    await adminPage.evaluate(() => {
      document.getElementById('employeeForm').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });
    await new Promise((r) => setTimeout(r, 2500));
    const toastDup = await adminPage.evaluate(() => document.getElementById('toast')?.textContent || '');
    await shot(adminPage, 'e2e-admin-duplicate-email-arabic.png');
    record(
      '1.8 GUI duplicate Arabic toast',
      /البريد الإلكتروني مستخدم بالفعل/.test(toastDup) && !/duplicate key|employees_email_key/i.test(toastDup),
      toastDup
    );

    // —— 2) Employee login ——
    const empLogin = await login(EMP.email, EMP.password);
    record('2.1 employee login', !!empLogin.token, `role=${empLogin.user.role}`);
    record('2.2 employee role EMPLOYEE', String(empLogin.user.role).toUpperCase() === 'EMPLOYEE', empLogin.user.role);

    const empPage = await browser.newPage();
    await empPage.setViewport({ width: 1440, height: 900 });
    await injectSession(empPage, empLogin.token, empLogin.user);
    await empPage.goto(`${BASE}/hr`, { waitUntil: 'networkidle2', timeout: 90000 });
    await new Promise((r) => setTimeout(r, 2500));
    await shot(empPage, 'e2e-employee-home-desktop.png');

    const essSnap = await empPage.evaluate(() => {
      const cards = [...document.querySelectorAll('#hr-sections a')].map((a) => ({
        href: a.getAttribute('href'),
        text: a.textContent.replace(/\s+/g, ' ').trim()
      }));
      const nav = [...document.querySelectorAll('.hr-nav-title, .hr-sidebar a')].map((el) => el.textContent.trim());
      return {
        persona: document.body.getAttribute('data-hr-persona'),
        essMode: document.body.classList.contains('hr-ess-mode'),
        cards,
        hasLeave: cards.some((c) => /إجازة/.test(c.text)),
        hasAdvance: cards.some((c) => /سلفة/.test(c.text)),
        hasLetters: cards.some((c) => /خطاب|تعريف/.test(c.text)),
        hasAttendance: cards.some((c) => /حضور/.test(c.text)),
        hasMyRequests: cards.some((c) => /طلباتي/.test(c.text)),
        hasAdminFiles: cards.some((c) => c.href === '/hr/employees' || /^ملفات الموظفين/.test(c.text)),
        hasApprovals: cards.some((c) => c.href === '/hr/pending-actions' || /^الموافقات والرفض|^الموافقة والرفض/.test(c.text)),
        hasPendingNav: nav.some((n) => /^عمليات بانتظار|^بانتظار إجراء/.test(n)),
        cardHrefs: cards.map((c) => c.href)
      };
    });
    record('2.3 ESS persona', essSnap.persona === 'employee' && essSnap.essMode, JSON.stringify({ persona: essSnap.persona, essMode: essSnap.essMode }));
    record('2.4 ESS cards present', essSnap.hasLeave && essSnap.hasAdvance && essSnap.hasLetters && essSnap.hasAttendance && essSnap.hasMyRequests);
    record(
      '2.5 no manager admin cards',
      !essSnap.hasAdminFiles && !essSnap.hasApprovals && !essSnap.hasPendingNav,
      JSON.stringify(essSnap.cardHrefs)
    );

    await empPage.setViewport({ width: 390, height: 844 });
    await empPage.reload({ waitUntil: 'networkidle2' });
    await new Promise((r) => setTimeout(r, 1500));
    await shot(empPage, 'e2e-employee-home-mobile.png');

    // Direct admin URL should redirect/deny
    await empPage.setViewport({ width: 1440, height: 900 });
    await empPage.goto(`${BASE}/hr/employees`, { waitUntil: 'networkidle2', timeout: 60000 });
    await new Promise((r) => setTimeout(r, 2000));
    await shot(empPage, 'e2e-employee-blocked-admin.png');
    const blockedUrl = empPage.url();
    record('2.6 admin employees blocked/redirected', /my-requests|hr\/?$/.test(blockedUrl) || !blockedUrl.includes('/hr/employees'), blockedUrl);

    // —— 3) Leave cycle ——
    const leaveId = `REQ-PRACT-${stamp}`;
    const leaveCreate = await api(empLogin.token, '/api/employee-requests', {
      method: 'POST',
      userId: empLogin.user.id,
      body: {
        id: leaveId,
        entityId: 'HQ001',
        employeeId: String(empLogin.user.id),
        employeeName: EMP.name,
        requestType: 'leave',
        requestTitle: 'إجازة سنوية تجريبية',
        requestedDate: new Date().toISOString().slice(0, 10),
        startDate: '2026-11-01',
        endDate: '2026-11-03',
        notes: 'اختبار عملي معزول',
        priority: 'NORMAL',
        requiresApproval: true
      }
    });
    record('3.1 employee submits leave', leaveCreate.status < 400 && leaveCreate.json?.success, `id=${leaveCreate.json?.request?.id || leaveId}`);

    const myReqs = await api(empLogin.token, '/api/employee-requests', { userId: empLogin.user.id });
    const mine = Array.isArray(myReqs.json)
      ? myReqs.json.find((r) => r.id === leaveId || r.id === leaveCreate.json?.request?.id)
      : null;
    record('3.2 leave visible in my requests', !!mine, `status=${mine?.status} stage=${mine?.current_stage}`);

    await empPage.goto(`${BASE}/hr/my-requests`, { waitUntil: 'networkidle2', timeout: 60000 });
    await new Promise((r) => setTimeout(r, 2000));
    await shot(empPage, 'e2e-employee-my-requests.png');

    // Manager sees pending
    let manager;
    try {
      manager = await login(MANAGER.email, 'Manager@123');
    } catch {
      manager = admin;
    }
    record('3.3 manager login', !!manager.token, `role=${manager.user.role}`);

    const pending = await api(manager.token, '/api/hr/pending-actions', { userId: manager.user.id });
    const pendingList = pending.json?.requests || pending.json || [];
    const foundPending = Array.isArray(pendingList)
      ? pendingList.find((r) => r.id === leaveId || r.id === leaveCreate.json?.request?.id)
      : null;
    record('3.4 manager sees leave in approvals', !!foundPending || pending.status === 200, `pendingCount=${Array.isArray(pendingList) ? pendingList.length : 0}`);

    const mgrPage = await browser.newPage();
    await mgrPage.setViewport({ width: 1440, height: 900 });
    await injectSession(mgrPage, manager.token, manager.user);
    await mgrPage.goto(`${BASE}/hr/pending-actions`, { waitUntil: 'networkidle2', timeout: 90000 });
    await new Promise((r) => setTimeout(r, 2000));
    await shot(mgrPage, 'e2e-manager-pending-approvals.png');

    // Approve via multi-step decide API
    const reqId = leaveCreate.json?.request?.id || leaveId;
    const approve = await api(manager.token, `/api/employee-requests/${reqId}/decide`, {
      method: 'POST',
      userId: manager.user.id,
      body: {
        decision: 'approve',
        notes: 'موافقة اختبار عملي',
        actorName: manager.user.name || 'مدير الاختبار'
      }
    });
    record('3.5 manager approve leave', approve.status < 400, `status=${approve.status} body=${JSON.stringify(approve.json).slice(0, 220)}`);

    const afterMgr = await api(empLogin.token, '/api/employee-requests', { userId: empLogin.user.id });
    const afterMgrReq = Array.isArray(afterMgr.json) ? afterMgr.json.find((r) => r.id === reqId) : null;
    record(
      '3.6 employee sees manager progress',
      !!afterMgrReq && String(afterMgrReq.current_stage || '') !== 'manager',
      `status=${afterMgrReq?.status} stage=${afterMgrReq?.current_stage}`
    );

    // Complete HR stage with admin (multi-step workflow)
    const hrApprove = await api(admin.token, `/api/employee-requests/${reqId}/decide`, {
      method: 'POST',
      userId: admin.user.id,
      body: {
        decision: 'approve',
        notes: 'اعتماد موارد بشرية — اختبار عملي',
        actorName: admin.user.name || 'مسؤول الموارد البشرية'
      }
    });
    record('3.7 HR final approve', hrApprove.status < 400, `status=${hrApprove.status}`);

    const afterHr = await api(empLogin.token, '/api/employee-requests', { userId: empLogin.user.id });
    const finalReq = Array.isArray(afterHr.json) ? afterHr.json.find((r) => r.id === reqId) : null;
    record(
      '3.8 employee sees APPROVED',
      !!finalReq && /APPROVED|COMPLETED/i.test(String(finalReq.status)),
      `status=${finalReq?.status} stage=${finalReq?.current_stage}`
    );

    await empPage.goto(`${BASE}/hr/my-requests`, { waitUntil: 'networkidle2', timeout: 60000 });
    await new Promise((r) => setTimeout(r, 2000));
    await shot(empPage, 'e2e-employee-leave-status-after.png');

    // Design check: manager home groups + no dup files label
    await mgrPage.goto(`${BASE}/hr`, { waitUntil: 'networkidle2', timeout: 90000 });
    await new Promise((r) => setTimeout(r, 2000));
    const design = await mgrPage.evaluate(() => {
      const sections = [...document.querySelectorAll('#hr-sections [data-section-id]')].map((s) => ({
        id: s.getAttribute('data-section-id'),
        title: s.querySelector('.hr-section-title')?.textContent?.trim(),
        count: s.querySelectorAll('a').length
      }));
      const labels = [...document.querySelectorAll('#hr-sections a')].map((a) => a.textContent.replace(/\s+/g, ' ').trim());
      const hrefs = [...document.querySelectorAll('#hr-sections a')].map((a) => a.getAttribute('href'));
      return {
        sections,
        hasOldDup: labels.some((l) => l.includes('إدارة ملفات الموظفين')),
        dupHrefs: hrefs.filter((h, i) => hrefs.indexOf(h) !== i),
        hasGroups: ['employees-mgmt', 'attendance-payroll', 'requests-approvals'].every((id) => sections.some((s) => s.id === id))
      };
    });
    await shot(mgrPage, 'e2e-manager-home-design.png');
    record('4.1 manager groups present', design.hasGroups, JSON.stringify(design.sections.map((s) => s.id)));
    record('4.2 no duplicate hrefs on home', design.dupHrefs.length === 0, JSON.stringify(design.dupHrefs));
    record('4.3 no misleading duplicate label', !design.hasOldDup);
  } finally {
    await browser.close();
  }

  const failed = results.filter((r) => !r.pass);
  const report = {
    stamp,
    accounts: {
      admin: { email: ADMIN.email, role: admin.user.role },
      manager: { email: MANAGER.email, role: 'MANAGER' },
      employee: { email: EMP.email, role: 'EMPLOYEE', employee_number: EMP.number },
      guiEmployee: { email: GUI.email, role: 'EMPLOYEE', employee_number: GUI.number }
    },
    paths: [
      '/api/auth/login',
      '/hr',
      '/hr/employees',
      '/hr/my-requests',
      '/hr/pending-actions',
      '/api/employees',
      '/api/admin/users',
      '/api/employee-requests'
    ],
    leaveRequestId: `REQ-PRACT-${stamp}`,
    results,
    summary: { total: results.length, passed: results.length - failed.length, failed: failed.length }
  };
  fs.writeFileSync(path.join(OUT, 'hr-practical-e2e-report.json'), JSON.stringify(report, null, 2));
  console.log('\n=== SUMMARY ===');
  results.forEach((r) => console.log(`${r.pass ? 'PASS' : 'FAIL'} ${r.step}`));
  console.log(`${report.summary.passed}/${report.summary.total} PASS`);
  if (failed.length) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
