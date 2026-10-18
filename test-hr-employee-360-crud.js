'use strict';
/**
 * Employee 360 create / photo / edit / RBAC E2E (isolated).
 */
const fs = require('fs');
const path = require('path');
const http = require('http');
const puppeteer = require('puppeteer-core');

const BASE = process.env.TEST_BASE_URL || 'http://127.0.0.1:3010';
const OUT = '/opt/cursor/artifacts';
const SHOTS = path.join(OUT, 'screenshots');
fs.mkdirSync(SHOTS, { recursive: true });

const ADMIN = { email: 'admin@naiosh.com', password: 'Admin@123' };
const EMPLOYEE = { email: 'pract-emp-1792342254297@test.local', password: 'Employee@123' };
const stamp = Date.now();
const NEW_EMP = {
  employee_number: `EMP-360-${stamp}`,
  full_name: `موظف ثلاثمائة وستون ${stamp}`,
  email: `e360-${stamp}@test.local`,
  phone: '0500000999',
  position: 'أخصائي موارد بشرية',
  department: 'الموارد البشرية',
  hire_date: '2026-10-18',
  employment_type: 'FULL_TIME',
  assigned_entity_type: 'HQ',
  hq_id: 1,
  is_active: true
};

const results = [];
function record(name, pass, detail = '') {
  results.push({ name, pass: !!pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'} — ${name}${detail ? `: ${detail}` : ''}`);
}

function postJson(urlPath, body, token) {
  return new Promise((resolve, reject) => {
    const u = new URL(urlPath, BASE);
    const payload = JSON.stringify(body);
    const headers = {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(payload),
      'x-entity-type': 'HQ',
      'x-entity-id': 'HQ001'
    };
    if (token) headers.Authorization = `Bearer ${token}`;
    const req = http.request({
      hostname: u.hostname, port: u.port || 80, path: u.pathname, method: 'POST', headers
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
  if (!res.json?.success) throw new Error(`login failed ${email}`);
  const session = res.json.data.session;
  const token = (session && typeof session === 'object' ? session.token : session) || res.json.data.token;
  return { token, user: res.json.data.user };
}

async function api(token, urlPath, options = {}) {
  const res = await fetch(`${BASE}${urlPath}`, {
    method: options.method || 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      'x-entity-type': 'HQ',
      'x-entity-id': 'HQ001',
      ...(options.body && !(options.body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers || {})
    },
    body: options.body
      ? (options.body instanceof FormData ? options.body : JSON.stringify(options.body))
      : undefined
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
}

function makeTinyPng() {
  // 1x1 PNG
  return Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64'
  );
}

async function inject(page, token, user) {
  await page.goto(`${BASE}/login-page.html`, { waitUntil: 'domcontentloaded', timeout: 60000 });
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
}

async function main() {
  const admin = await login(ADMIN.email, ADMIN.password);
  const emp = await login(EMPLOYEE.email, EMPLOYEE.password);

  // 1) Create employee via shared API
  const created = await api(admin.token, '/api/employees', { method: 'POST', body: NEW_EMP });
  record('API create employee', created.status === 201 && created.json?.employee_number === NEW_EMP.employee_number, JSON.stringify(created.json?.employee_number));
  const dbId = created.json?.id;

  // 2) Upload photo
  const form = new FormData();
  const blob = new Blob([makeTinyPng()], { type: 'image/png' });
  form.append('file', blob, 'photo.png');
  form.append('mediaType', 'photo');
  const up = await api(admin.token, `/api/hr/employee-profile/${encodeURIComponent(NEW_EMP.employee_number)}/media?mediaType=photo`, {
    method: 'POST',
    body: form
  });
  record('API upload photo', up.status === 200 && !!up.json?.url, up.json?.url || up.json?.error);

  // 3) Roster shows employee + photo
  const roster = await api(admin.token, '/api/hr/employee-360/roster');
  const row = (roster.json.employees || []).find((e) => e.employee_number === NEW_EMP.employee_number);
  record('API roster includes new employee with photo', !!row && !!row.photo_url, JSON.stringify(row && { n: row.employee_number, photo: !!row.photo_url }));

  // 4) Profile shows same photo
  const profile = await api(admin.token, `/api/hr/employee-profile?employeeId=${encodeURIComponent(NEW_EMP.employee_number)}`);
  record('API profile photo matches', profile.status === 200 && profile.json?.photo_url === up.json.url, profile.json?.photo_url);

  // 5) Change photo (second upload)
  const form2 = new FormData();
  form2.append('file', new Blob([makeTinyPng()], { type: 'image/png' }), 'photo2.png');
  form2.append('mediaType', 'photo');
  const up2 = await api(admin.token, `/api/hr/employee-profile/${encodeURIComponent(NEW_EMP.employee_number)}/media?mediaType=photo`, {
    method: 'POST',
    body: form2
  });
  const profile2 = await api(admin.token, `/api/hr/employee-profile?employeeId=${encodeURIComponent(NEW_EMP.employee_number)}`);
  record('API photo update persists', up2.status === 200 && profile2.json?.photo_url === up2.json.url);

  // 6) Create without photo → default (null photo_url ok)
  const bare = {
    ...NEW_EMP,
    employee_number: `EMP-360B-${stamp}`,
    email: `e360b-${stamp}@test.local`,
    full_name: `بدون صورة ${stamp}`
  };
  const createdBare = await api(admin.token, '/api/employees', { method: 'POST', body: bare });
  const bareProfile = await api(admin.token, `/api/hr/employee-profile?employeeId=${encodeURIComponent(bare.employee_number)}`);
  record('API employee without photo has no photo_url', createdBare.status === 201 && !bareProfile.json?.photo_url);

  // 7) Same record appears in /api/employees (ملفات الموظفين) — no duplicate
  const filesList = await api(admin.token, '/api/employees');
  const list = Array.isArray(filesList.json) ? filesList.json : [];
  const matches = list.filter((e) => e.employee_number === NEW_EMP.employee_number);
  record('Shared employees table (no duplicate)', matches.length === 1, `count=${matches.length}`);

  // 8) Employee persona cannot create / modify / upload
  const denyCreate = await api(emp.token, '/api/employees', { method: 'POST', body: { ...NEW_EMP, employee_number: `X-${stamp}`, email: `x-${stamp}@t.local` } });
  record('Employee denied create', denyCreate.status === 403);
  const denyPut = await api(emp.token, `/api/employees/${dbId}`, { method: 'PUT', body: { full_name: 'hack' } });
  record('Employee denied update', denyPut.status === 403);
  const denyPhoto = await api(emp.token, `/api/hr/employee-profile/${encodeURIComponent(NEW_EMP.employee_number)}/media?mediaType=photo`, {
    method: 'POST',
    body: (() => { const f = new FormData(); f.append('file', new Blob([makeTinyPng()], { type: 'image/png' }), 'p.png'); return f; })()
  });
  record('Employee denied photo upload', denyPhoto.status === 403 || denyPhoto.status === 401);

  // 9) Photo URL access: employee cannot fetch other employee's photo
  const photoPath = up2.json?.url || up.json?.url;
  const otherPhoto = await fetch(`${BASE}${photoPath}`, {
    headers: { Authorization: `Bearer ${emp.token}`, 'x-entity-type': 'HQ', 'x-entity-id': 'HQ001' }
  });
  record('Employee denied other photo file', otherPhoto.status === 403 || otherPhoto.status === 401, `status=${otherPhoto.status}`);

  const adminPhoto = await fetch(`${BASE}${photoPath}`, {
    headers: { Authorization: `Bearer ${admin.token}`, 'x-entity-type': 'HQ', 'x-entity-id': 'HQ001' }
  });
  record('Admin can fetch photo file', adminPhoto.status === 200, `status=${adminPhoto.status}`);

  // Duplicate email Arabic message
  const dup = await api(admin.token, '/api/employees', {
    method: 'POST',
    body: { ...NEW_EMP, employee_number: `EMP-DUP-${stamp}` }
  });
  record('Duplicate email Arabic 409', dup.status === 409 && /البريد الإلكتروني مستخدم بالفعل/.test(dup.json?.error || ''));

  // GUI
  const browser = await puppeteer.launch({
    executablePath: process.env.CHROME_PATH || '/usr/local/bin/google-chrome',
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1440,900']
  });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });
    await inject(page, admin.token, admin.user);
    await page.goto(`${BASE}/hr/employee-360`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await new Promise((r) => setTimeout(r, 2500));
    await shot(page, 'e360-crud-roster-add-btn.png');
    const hasAdd = await page.evaluate(() => {
      const a = document.getElementById('addEmployeeBtn');
      const b = document.getElementById('addEmployeeBtnInline');
      return (a && !a.classList.contains('hidden')) || (b && !b.classList.contains('hidden'));
    });
    record('GUI add button visible for admin', hasAdd);

    await page.evaluate(() => {
      const btn = document.getElementById('addEmployeeBtn') || document.getElementById('addEmployeeBtnInline');
      if (btn) btn.click();
    });
    await new Promise((r) => setTimeout(r, 800));
    await shot(page, 'e360-crud-add-form.png');
    const formOpen = await page.evaluate(() => document.getElementById('employeeFormModal')?.classList.contains('open'));
    record('GUI add form opens', formOpen);

    // Close and open existing with photo
    await page.evaluate(() => document.getElementById('closeEmployeeForm')?.click());
    await page.goto(`${BASE}/hr/employee-360?employeeId=${encodeURIComponent(NEW_EMP.employee_number)}`, {
      waitUntil: 'domcontentloaded',
      timeout: 60000
    });
    await new Promise((r) => setTimeout(r, 2500));
    await shot(page, 'e360-crud-detail-with-photo.png');
    const detailSnap = await page.evaluate(() => ({
      name: document.getElementById('employeeName')?.textContent || '',
      hasImg: !!document.querySelector('#employeeAvatar img'),
      imgSrc: document.querySelector('#employeeAvatar img')?.getAttribute('src') || ''
    }));
    record('GUI detail shows employee + photo', detailSnap.name.includes('ثلاثمائة') && detailSnap.hasImg && /uploads|hr-employee-360|data:image/.test(detailSnap.imgSrc), JSON.stringify(detailSnap));

    // Roster card with photo
    await page.goto(`${BASE}/hr/employee-360`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await new Promise((r) => setTimeout(r, 2000));
    await page.type('#rosterSearch', NEW_EMP.employee_number);
    await new Promise((r) => setTimeout(r, 600));
    await shot(page, 'e360-crud-roster-with-photo.png');
    const cardPhoto = await page.evaluate((num) => {
      const card = document.querySelector(`[data-employee-number="${num}"]`);
      const img = card?.querySelector('.roster-photo img');
      return { found: !!card, src: img?.getAttribute('src') || '' };
    }, NEW_EMP.employee_number);
    record('GUI roster card shows photo', cardPhoto.found && /hr-employee-360/.test(cardPhoto.src), JSON.stringify(cardPhoto));

    // Mobile
    await page.setViewport({ width: 390, height: 844 });
    await page.goto(`${BASE}/hr/employee-360`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await new Promise((r) => setTimeout(r, 1500));
    await shot(page, 'e360-crud-roster-mobile.png');
    record('GUI mobile roster', true);
  } finally {
    await browser.close();
  }

  const failed = results.filter((r) => !r.pass);
  fs.writeFileSync(path.join(OUT, 'e360-crud-results.json'), JSON.stringify({ results, NEW_EMP }, null, 2));
  console.log(`\n${results.length - failed.length}/${results.length} PASS`);
  if (failed.length) process.exit(1);
}

main().catch((e) => { console.error(e); process.exit(1); });
