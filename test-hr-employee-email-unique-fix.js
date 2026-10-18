'use strict';
/**
 * Employee email uniqueness fix verification (API + GUI).
 * Isolated test emails only — no production data mutation beyond test rows.
 */
const fs = require('fs');
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
const DUP = {
  number: `EMP-EU-DUP-${stamp}`,
  name: `موظف مكرر ${stamp}`,
  email: EMP.email
};

const results = [];
function record(name, pass, detail = '') {
  results.push({ name, pass: !!pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'} — ${name}${detail ? `: ${detail}` : ''}`);
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

async function apiFetch(path, { method = 'GET', token, body, headers = {} } = {}) {
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
  const res = await fetch(`${BASE}${path}`, opts);
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
}

async function main() {
  const login = await postJson('/api/auth/login', ADMIN);
  if (!login.json?.success) throw new Error('admin login failed');
  const session = login.json.data.session;
  const token = (session && typeof session === 'object' ? session.token : session) || login.json.data.token;

  // 1) New email → create OK
  const created = await apiFetch('/api/employees', {
    method: 'POST',
    token,
    body: {
      employee_number: EMP.number,
      full_name: EMP.name,
      email: EMP.email.toUpperCase(), // normalization
      position: 'أخصائي',
      department: 'الموارد البشرية',
      employment_type: 'FULL_TIME',
      assigned_entity_type: 'HQ',
      hq_id: 1,
      is_active: true
    }
  });
  record('API: create employee with new email', created.status === 201, `status=${created.status} email=${created.json?.email}`);
  const storedEmail = created.json?.email;
  record('API: email normalized to lowercase', storedEmail === EMP.email, `got=${storedEmail}`);

  // 2) Duplicate email → Arabic 409, no raw PG
  const dup = await apiFetch('/api/employees', {
    method: 'POST',
    token,
    body: {
      employee_number: DUP.number,
      full_name: DUP.name,
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

  // Count rows for this email — must be exactly 1
  const list = await apiFetch('/api/employees', { token });
  const matches = Array.isArray(list.json)
    ? list.json.filter((e) => String(e.email || '').toLowerCase() === EMP.email)
    : [];
  record('API: single row for email after duplicate attempt', matches.length === 1, `count=${matches.length}`);

  // 3) Provision login + login works
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

  // 4) GUI: open HR, add another unique employee, then try duplicate toast
  const guiEmail = `gui-eu-${stamp}@test.local`;
  const browser = await puppeteer.launch({
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium-browser',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });
    await page.goto(`${BASE}/finance/admin-erp-hr.html`, { waitUntil: 'networkidle2', timeout: 60000 });

    // Seed auth into localStorage
    await page.evaluate((tok, user) => {
      localStorage.setItem('sessionToken', tok);
      localStorage.setItem('token', tok);
      localStorage.setItem('user', JSON.stringify(user));
      sessionStorage.setItem('sessionToken', tok);
      sessionStorage.setItem('token', tok);
      sessionStorage.setItem('user', JSON.stringify(user));
    }, token, login.json.data.user);

    await page.reload({ waitUntil: 'networkidle2', timeout: 60000 });
    await page.waitForSelector('#btnAddEmployee, button', { timeout: 20000 });

    // Click add employee
    const addClicked = await page.evaluate(() => {
      const btn = [...document.querySelectorAll('button')].find((b) => /إضافة موظف/.test(b.textContent || ''));
      if (!btn) return false;
      btn.click();
      return true;
    });
    record('GUI: open add employee modal', addClicked);

    await page.waitForSelector('#employeeForm', { timeout: 10000 });
    await page.type('#employeeForm [name="employee_number"]', `EMP-GUI-EU-${stamp}`);
    await page.type('#employeeForm [name="full_name"]', `موظف واجهة بريد ${stamp}`);
    await page.type('#employeeForm [name="email"]', guiEmail);
    await page.type('#employeeForm [name="position"]', 'محاسب');
    await page.type('#employeeForm [name="department"]', 'المالية');

    // Ensure HQ entity = 1
    await page.evaluate(() => {
      const et = document.querySelector('#employeeForm [name="entity_type"]');
      if (et) et.value = 'HQ';
      const ev = document.querySelector('#employeeForm [name="entity_value"]');
      if (ev) ev.value = '1';
    });

    await page.screenshot({ path: `${OUT}/employee-email-unique-form.png`, fullPage: true });

    await page.click('#employeeForm button[type="submit"]');
    await page.waitForTimeout(2500);
    await page.screenshot({ path: `${OUT}/employee-email-unique-created.png`, fullPage: true });

    const createdGui = await apiFetch('/api/employees', { token });
    const guiMatches = Array.isArray(createdGui.json)
      ? createdGui.json.filter((e) => String(e.email || '').toLowerCase() === guiEmail)
      : [];
    record('GUI: new employee created once', guiMatches.length === 1, `count=${guiMatches.length}`);

    // Duplicate via GUI
    await page.evaluate(() => {
      const btn = [...document.querySelectorAll('button')].find((b) => /إضافة موظف/.test(b.textContent || ''));
      if (btn) btn.click();
    });
    await page.waitForSelector('#employeeForm', { timeout: 10000 });
    await page.evaluate(() => {
      const f = document.getElementById('employeeForm');
      if (f) f.reset();
    });
    await page.type('#employeeForm [name="employee_number"]', `EMP-GUI-EU-DUP-${stamp}`);
    await page.type('#employeeForm [name="full_name"]', `موظف واجهة مكرر ${stamp}`);
    await page.type('#employeeForm [name="email"]', guiEmail);
    await page.type('#employeeForm [name="position"]', 'محاسب');
    await page.type('#employeeForm [name="department"]', 'المالية');
    await page.evaluate(() => {
      const et = document.querySelector('#employeeForm [name="entity_type"]');
      if (et) et.value = 'HQ';
      const ev = document.querySelector('#employeeForm [name="entity_value"]');
      if (ev) ev.value = '1';
    });
    await page.click('#employeeForm button[type="submit"]');
    await page.waitForTimeout(2500);
    await page.screenshot({ path: `${OUT}/employee-email-unique-duplicate-toast.png`, fullPage: true });

    const toastText = await page.evaluate(() => {
      const toasts = [...document.querySelectorAll('[class*="toast"], .fixed, .alert, [role="alert"]')];
      return toasts.map((t) => t.textContent || '').join(' | ');
    });
    const bodyText = await page.evaluate(() => document.body.innerText || '');
    const hasArabic = /البريد الإلكتروني مستخدم بالفعل/.test(toastText + bodyText);
    const hasRaw = /duplicate key|employees_email_key/i.test(toastText + bodyText);
    record('GUI: duplicate shows Arabic message', hasArabic && !hasRaw, `toast=${toastText.slice(0, 200)}`);

    const afterDup = await apiFetch('/api/employees', { token });
    const afterMatches = Array.isArray(afterDup.json)
      ? afterDup.json.filter((e) => String(e.email || '').toLowerCase() === guiEmail)
      : [];
    record('GUI: still single row after duplicate attempt', afterMatches.length === 1, `count=${afterMatches.length}`);
  } finally {
    await browser.close();
  }

  const failed = results.filter((r) => !r.pass);
  console.log('\n=== SUMMARY ===');
  results.forEach((r) => console.log(`${r.pass ? 'PASS' : 'FAIL'} ${r.name}`));
  console.log(`Total: ${results.length}, Failed: ${failed.length}`);
  fs.writeFileSync('/opt/cursor/artifacts/employee-email-unique-results.json', JSON.stringify({ stamp, EMP, results }, null, 2));
  if (failed.length) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
