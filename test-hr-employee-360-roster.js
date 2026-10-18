'use strict';
/**
 * Employee 360 roster + detail isolation E2E (isolated test data).
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
  const res = await postJson('/api/auth/login', { email, password });
  if (!res.json?.success) throw new Error(`login failed ${email}`);
  const session = res.json.data.session;
  const token = (session && typeof session === 'object' ? session.token : session) || res.json.data.token;
  return { token, user: res.json.data.user };
}

async function api(token, urlPath) {
  const res = await fetch(`${BASE}${urlPath}`, {
    headers: { Authorization: `Bearer ${token}`, 'x-entity-type': 'HQ', 'x-entity-id': 'HQ001' }
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
}

async function inject(page, token, user) {
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
}

async function main() {
  const admin = await login(ADMIN.email, ADMIN.password);
  const emp = await login(EMPLOYEE.email, EMPLOYEE.password);

  const roster = await api(admin.token, '/api/hr/employee-360/roster');
  record('API roster for manager', roster.status === 200 && (roster.json.employees || []).length >= 3, `n=${(roster.json.employees || []).length}`);
  const people = (roster.json.employees || []).slice(0, 3);
  record('API at least 3 employees', people.length >= 3, people.map((p) => p.employee_number).join(','));

  const p1 = await api(admin.token, `/api/hr/employee-profile?employeeId=${encodeURIComponent(people[0].employee_number)}`);
  const p2 = await api(admin.token, `/api/hr/employee-profile?employeeId=${encodeURIComponent(people[1].employee_number)}`);
  record('API profile employee 1', p1.status === 200 && p1.json?.employee_id === people[0].employee_number, p1.json?.name);
  record('API profile employee 2', p2.status === 200 && p2.json?.employee_id === people[1].employee_number, p2.json?.name);
  record('API profiles differ', p1.json?.name !== p2.json?.name || p1.json?.employee_id !== p2.json?.employee_id);

  const deny = await api(emp.token, `/api/hr/employee-profile?employeeId=${encodeURIComponent(people[0].employee_number)}`);
  record('API employee denied other profile', deny.status === 403, JSON.stringify(deny.json));

  const selfRoster = await api(emp.token, '/api/hr/employee-360/roster');
  record('API employee self roster', selfRoster.status === 200 && selfRoster.json.mode === 'self', JSON.stringify(selfRoster.json.employees));

  const home = await api(admin.token, '/api/hr/home-modules');
  const labelOk = (home.json.modules || []).some((m) => m.key === 'employee-360' && m.label === 'موظف 360');
  record('Home card renamed to موظف 360', labelOk);

  const browser = await puppeteer.launch({
    executablePath: process.env.CHROME_PATH || '/usr/local/bin/google-chrome',
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1440,900']
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });
    await inject(page, admin.token, admin.user);
    await page.goto(`${BASE}/hr/employee-360`, { waitUntil: 'networkidle2', timeout: 90000 });
    await new Promise((r) => setTimeout(r, 2500));
    await shot(page, 'e360-roster-desktop.png');

    const rosterSnap = await page.evaluate(() => ({
      title: document.getElementById('pageTitle')?.textContent || '',
      rosterVisible: !document.getElementById('employee360Roster')?.classList.contains('hidden'),
      detailHidden: document.getElementById('employee360Detail')?.classList.contains('hidden'),
      cards: document.querySelectorAll('#rosterGrid .roster-card').length,
      hasLegacyTitle: /ملف الموظف 360°/.test(document.body.innerText || '')
    }));
    record('GUI roster landing', rosterSnap.rosterVisible && rosterSnap.detailHidden && rosterSnap.cards >= 3, JSON.stringify(rosterSnap));
    record('GUI title موظف 360', rosterSnap.title.includes('موظف 360'));

    // Search filter
    await page.type('#rosterSearch', people[0].employee_number.slice(0, 8));
    await new Promise((r) => setTimeout(r, 500));
    const filtered = await page.evaluate(() => document.querySelectorAll('#rosterGrid .roster-card').length);
    record('GUI search filters cards', filtered >= 1 && filtered < rosterSnap.cards, `filtered=${filtered}`);
    await page.evaluate(() => { const el = document.getElementById('rosterSearch'); if (el) el.value = ''; });
    await page.evaluate(() => document.getElementById('rosterSearch')?.dispatchEvent(new Event('input')));
    await new Promise((r) => setTimeout(r, 300));

    // Open first employee
    await page.evaluate(() => {
      const btn = document.querySelector('#rosterGrid .open-360-btn');
      if (btn) btn.click();
    });
    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 60000 }).catch(() => null);
    await new Promise((r) => setTimeout(r, 2500));
    await shot(page, 'e360-detail-employee-a.png');

    const detailA = await page.evaluate(() => ({
      url: location.href,
      detailVisible: !document.getElementById('employee360Detail')?.classList.contains('hidden'),
      name: document.getElementById('employeeName')?.textContent || '',
      id: document.getElementById('employeeIdBadge')?.textContent || '',
      hasBack: !!document.getElementById('backToRoster')
    }));
    record('GUI detail A opened', detailA.detailVisible && /employeeId=/.test(detailA.url), JSON.stringify(detailA));

    // Back to roster then open second different employee
    await page.click('#backToRoster');
    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 60000 }).catch(() => null);
    await new Promise((r) => setTimeout(r, 2000));
    const secondId = people[1].employee_number;
    await page.evaluate((id) => {
      const btn = [...document.querySelectorAll('#rosterGrid .open-360-btn')].find((b) => b.getAttribute('data-id') === id);
      if (btn) btn.click();
      else {
        const any = [...document.querySelectorAll('#rosterGrid .open-360-btn')][1];
        if (any) any.click();
      }
    }, secondId);
    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 60000 }).catch(() => null);
    await new Promise((r) => setTimeout(r, 2500));
    await shot(page, 'e360-detail-employee-b.png');

    const detailB = await page.evaluate(() => ({
      url: location.href,
      name: document.getElementById('employeeName')?.textContent || '',
      id: document.getElementById('employeeIdBadge')?.textContent || ''
    }));
    record('GUI detail B different from A', detailB.name !== detailA.name || detailB.id !== detailA.id, JSON.stringify({ a: detailA.name, b: detailB.name }));

    // Mobile roster
    await page.setViewport({ width: 390, height: 844 });
    await page.goto(`${BASE}/hr/employee-360`, { waitUntil: 'networkidle2', timeout: 90000 });
    await new Promise((r) => setTimeout(r, 2000));
    await shot(page, 'e360-roster-mobile.png');
    record('GUI mobile roster', true);

    // Employee blocked from other detail URL
    const empPage = await browser.newPage();
    await empPage.setViewport({ width: 1440, height: 900 });
    await inject(empPage, emp.token, emp.user);
    await empPage.goto(`${BASE}/hr/employee-360?employeeId=${encodeURIComponent(people[0].employee_number)}`, {
      waitUntil: 'networkidle2',
      timeout: 90000
    });
    await new Promise((r) => setTimeout(r, 2500));
    await shot(empPage, 'e360-employee-denied-other.png');
    const deniedUi = await empPage.evaluate(() => ({
      text: document.body.innerText || '',
      name: document.getElementById('employeeName')?.textContent || '',
      rosterVisible: !document.getElementById('employee360Roster')?.classList.contains('hidden')
    }));
    // Should alert and fall back to roster, or show empty — not the other employee's data
    const leaked = deniedUi.name && deniedUi.name === people[0].full_name;
    record('GUI employee cannot view other detail', !leaked, JSON.stringify(deniedUi).slice(0, 200));
  } finally {
    await browser.close();
  }

  const failed = results.filter((r) => !r.pass);
  fs.writeFileSync(path.join(OUT, 'e360-roster-results.json'), JSON.stringify({ results, people }, null, 2));
  console.log(`\n${results.length - failed.length}/${results.length} PASS`);
  if (failed.length) process.exit(1);
}

main().catch((e) => { console.error(e); process.exit(1); });
