'use strict';
/**
 * Reproduce the Save failure case from the user screenshot and verify the fix.
 * Case: HQ + entity id 4 + create login checked + passwords filled.
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
  number: `EMP-FIX-${stamp}`,
  name: `موظف إصلاح ${stamp}`,
  email: `emp-fix-${stamp}@test.local`,
  password: 'Employee@123'
};

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

async function main() {
  const login = await postJson('/api/auth/login', ADMIN);
  if (!login.json?.success) throw new Error('admin login failed');
  const session = login.json.data.session;
  const token = (session && typeof session === 'object' ? session.token : session) || login.json.data.token;
  const user = login.json.data.user;

  // API regression: Bearer-only must work
  const provision = await postJson('/api/admin/users', {
    name: EMP.name,
    email: `api-${EMP.email}`,
    password: EMP.password,
    tenant_type: 'HQ',
    entity_id: 'HQ001',
    entity_name: 'NAIOSH HQ',
    job_title: 'موظف',
    requested_role_code: 'EMPLOYEE',
    is_active: true
  });
  // postJson helper doesn't send Authorization for admin - do dedicated fetch
  const bearerOnly = await fetch(`${BASE}/api/admin/users`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: EMP.name,
      email: `bearer-${EMP.email}`,
      password: EMP.password,
      tenant_type: 'HQ',
      entity_id: 'HQ001',
      entity_name: 'NAIOSH HQ',
      job_title: 'موظف',
      requested_role_code: 'EMPLOYEE',
      is_active: true
    })
  }).then(async (r) => ({ status: r.status, json: await r.json() }));
  console.log(bearerOnly.json?.success ? 'PASS bearer-only-admin-create' : `FAIL bearer-only ${JSON.stringify(bearerOnly.json)}`);
  if (!bearerOnly.json?.success) process.exit(1);

  const browser = await puppeteer.launch({
    executablePath: process.env.CHROME_PATH || '/usr/local/bin/google-chrome',
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1440,900']
  });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });
    await page.goto(`${BASE}/dashboard.html`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    // Intentionally omit user.id from one storage path? Keep full user — but also test token-only recovery
    await page.evaluate((t, u) => {
      localStorage.setItem('authToken', t);
      sessionStorage.setItem('authToken', t);
      localStorage.setItem('user', JSON.stringify(u));
      sessionStorage.setItem('user', JSON.stringify(u));
      document.cookie = `authToken=${encodeURIComponent(t)}; path=/`;
    }, token, user);

    await page.goto(`${BASE}/hr/employees`, { waitUntil: 'networkidle2', timeout: 90000 });
    await new Promise((r) => setTimeout(r, 2000));
    await page.evaluate(() => {
      const btn = [...document.querySelectorAll('button')].find((b) => (b.textContent || '').includes('إضافة موظف'));
      if (btn) btn.click();
    });
    await new Promise((r) => setTimeout(r, 600));

    // Match user screenshot values: HQ, entity 4, part-time, inactive, login checked
    await page.evaluate((emp) => {
      const form = document.getElementById('employeeForm');
      form.employee_number.value = emp.number;
      form.full_name.value = emp.name;
      form.email.value = emp.email;
      form.position.value = 'موظف';
      form.department.value = 'الموارد البشرية';
      form.hire_date.value = new Date().toISOString().slice(0, 10);
      form.salary.value = '30';
      form.employment_type.value = 'PART_TIME';
      form.entity_type.value = 'HQ';
      form.entity_value.value = '4'; // buggy value from screenshot
      form.is_active.value = 'false';
      const chk = document.getElementById('createLoginAccount');
      chk.checked = true;
      chk.dispatchEvent(new Event('change', { bubbles: true }));
      document.getElementById('loginPassword').value = emp.password;
      document.getElementById('loginPasswordConfirm').value = emp.password;
    }, EMP);
    await page.screenshot({ path: path.join(OUT, 'save-error-before.png'), fullPage: true });

    await page.evaluate(() => {
      document.getElementById('employeeForm').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });
    await new Promise((r) => setTimeout(r, 3500));
    await page.screenshot({ path: path.join(OUT, 'save-error-after.png'), fullPage: true });

    const toast = await page.evaluate(() => document.getElementById('toast')?.textContent || '');
    const ok = /تم حفظ|حساب الدخول/i.test(toast);
    console.log(ok ? `PASS ui-save — ${toast}` : `FAIL ui-save — ${toast}`);

    const empLogin = await postJson('/api/auth/login', { email: EMP.email, password: EMP.password });
    console.log(empLogin.json?.success ? 'PASS employee-can-login' : `FAIL employee-login — ${empLogin.raw?.slice(0, 160)}`);

    if (!ok || !empLogin.json?.success) process.exit(1);
  } finally {
    await browser.close();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
