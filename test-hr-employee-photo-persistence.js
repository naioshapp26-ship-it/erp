'use strict';
/**
 * Prove employee photos survive process restart + disk wipe (DB-backed storage).
 */
const fs = require('fs');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');

const BASE = process.env.TEST_BASE_URL || 'http://127.0.0.1:3010';
const OUT = '/opt/cursor/artifacts';
fs.mkdirSync(OUT, { recursive: true });

const ADMIN = { email: 'admin@naiosh.com', password: 'Admin@123' };
const stamp = Date.now();
const EMP = {
  employee_number: `EMP-PERS-${stamp}`,
  full_name: `ثبات صورة ${stamp}`,
  email: `pers-${stamp}@test.local`,
  position: 'مختبر',
  department: 'الجودة',
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

async function login() {
  const res = await postJson('/api/auth/login', ADMIN);
  const session = res.json.data.session;
  return (session && typeof session === 'object' ? session.token : session) || res.json.data.token;
}

async function api(token, urlPath, options = {}) {
  const res = await fetch(`${BASE}${urlPath}`, {
    method: options.method || 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      'x-entity-type': 'HQ',
      'x-entity-id': 'HQ001',
      ...(options.body && !(options.body instanceof FormData) ? { 'Content-Type': 'application/json' } : {})
    },
    body: options.body
      ? (options.body instanceof FormData ? options.body : JSON.stringify(options.body))
      : undefined
  });
  const ct = res.headers.get('content-type') || '';
  if (ct.includes('application/json')) {
    return { status: res.status, json: await res.json().catch(() => ({})), headers: res.headers };
  }
  const buf = Buffer.from(await res.arrayBuffer());
  return { status: res.status, buf, headers: res.headers, storageHeader: res.headers.get('x-photo-storage') };
}

function tinyPng() {
  return Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64'
  );
}

function waitForHealth(timeoutMs = 60000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const tick = async () => {
      try {
        const r = await fetch(BASE + '/');
        if (r.status > 0) return resolve(true);
      } catch { /* */ }
      if (Date.now() - start > timeoutMs) return reject(new Error('server health timeout'));
      setTimeout(tick, 500);
    };
    tick();
  });
}

async function restartServer() {
  const old = require('child_process').execSync("lsof -t -i :3010 2>/dev/null | head -1", { encoding: 'utf8' }).trim();
  if (old) {
    try { process.kill(Number(old), 'SIGTERM'); } catch { /* */ }
    await new Promise((r) => setTimeout(r, 2000));
  }
  const env = {
    ...process.env,
    DATABASE_URL: process.env.DATABASE_URL || 'postgresql://vendowor_erp_user:vendowor_local_dev@127.0.0.1:5432/vendowor_erp',
    DATABASE_SSL: 'false',
    PORT: '3010',
    NODE_ENV: 'development',
    BASE_DOMAIN: 'localhost',
    // Keep intentionally ephemeral disk to prove DB persistence
    UPLOADS_ROOT_DIR: process.env.UPLOADS_ROOT_DIR || '/tmp/naiosh-erp-staging/uploads'
  };
  const log = fs.openSync(path.join(OUT, 'photo-persist-server.log'), 'a');
  const child = spawn('node', ['server.js'], {
    cwd: '/workspace',
    env,
    detached: true,
    stdio: ['ignore', log, log]
  });
  child.unref();
  await waitForHealth();
  return child.pid;
}

async function main() {
  const { resolveUploadsRootDir, isEphemeralUploadStorage } = require('./uploads-config');
  const uploadsRoot = resolveUploadsRootDir(path.join(__dirname, 'uploads'));
  record('Uploads root detected', true, uploadsRoot);
  record('Disk path classified ephemeral (or /tmp)', isEphemeralUploadStorage(uploadsRoot) || String(uploadsRoot).includes('/tmp'),
    `ephemeral=${isEphemeralUploadStorage(uploadsRoot)}`);

  let token = await login();
  const created = await api(token, '/api/employees', { method: 'POST', body: EMP });
  record('Create employee for photo test', created.status === 201, created.json?.employee_number);

  const form = new FormData();
  form.append('file', new Blob([tinyPng()], { type: 'image/png' }), 'persist.png');
  form.append('mediaType', 'photo');
  const up = await api(token, `/api/hr/employee-profile/${encodeURIComponent(EMP.employee_number)}/media?mediaType=photo`, {
    method: 'POST',
    body: form
  });
  record('Upload returns database storage', up.status === 200 && up.json?.storage === 'database', JSON.stringify({ storage: up.json?.storage, url: up.json?.url }));
  record('Upload URL is API persistent path', String(up.json?.url || '').includes('/api/hr/employee-profile/') && String(up.json?.url || '').endsWith('/photo'));

  // Prove row in DB
  const { Pool } = require('pg');
  const pool = new Pool({ connectionString: process.env.DATABASE_URL || 'postgresql://vendowor_erp_user:vendowor_local_dev@127.0.0.1:5432/vendowor_erp' });
  const dbRow = await pool.query(
    `SELECT id, entity_id, employee_id, mime_type, byte_size, octet_length(file_data) AS bytes
     FROM hr_employee_photo_assets WHERE employee_id = $1`,
    [EMP.employee_number]
  );
  record('Photo bytes stored in PostgreSQL', dbRow.rows[0]?.bytes > 0,
    JSON.stringify(dbRow.rows[0] || {}));

  // Wipe disk copies if any
  const diskDir = path.join(uploadsRoot, 'hr-employee-360', 'HQ001', EMP.employee_number);
  if (fs.existsSync(diskDir)) {
    fs.rmSync(diskDir, { recursive: true, force: true });
  }
  record('Disk folder wiped (simulating redeploy without volume)', !fs.existsSync(diskDir), diskDir);

  // Restart server process
  const pid = await restartServer();
  record('Server restarted', !!pid, `pid=${pid}`);

  token = await login();
  const photoGet = await api(token, `/api/hr/employee-profile/${encodeURIComponent(EMP.employee_number)}/photo`);
  record('Photo still served after restart + disk wipe',
    photoGet.status === 200 && photoGet.buf && photoGet.buf.length > 0 && photoGet.storageHeader === 'database',
    JSON.stringify({ status: photoGet.status, bytes: photoGet.buf?.length, storage: photoGet.storageHeader }));

  const profile = await api(token, `/api/hr/employee-profile?employeeId=${encodeURIComponent(EMP.employee_number)}`);
  record('Profile photo_url points to persistent API',
    profile.json?.photo_storage === 'database' && /\/api\/hr\/employee-profile\//.test(profile.json?.photo_url || ''),
    JSON.stringify({ url: profile.json?.photo_url, storage: profile.json?.photo_storage }));

  // RBAC still enforced after restart
  const empLogin = await postJson('/api/auth/login', { email: 'pract-emp-1792342254297@test.local', password: 'Employee@123' });
  const empToken = empLogin.json?.data?.session?.token || empLogin.json?.data?.session;
  const denied = await api(empToken, `/api/hr/employee-profile/${encodeURIComponent(EMP.employee_number)}/photo`);
  record('Access control still enforced on DB photo', denied.status === 403, `status=${denied.status}`);

  await pool.end();

  const report = {
    title: 'Employee photo persistence review',
    when: new Date().toISOString(),
    storage: {
      durable_backend: 'PostgreSQL table hr_employee_photo_assets (BYTEA)',
      serve_url: '/api/hr/employee-profile/:employeeId/photo',
      disk_role: 'optional cache / legacy only; wiped safely when ephemeral',
      backup: 'Included in normal PostgreSQL backups (pg_dump / managed DB snapshots). Example: pg_dump -Fc "$DATABASE_URL" -t hr_employee_photo_assets -f hr_photos.dump'
    },
    results,
    overall: results.every((r) => r.pass) ? 'PASS' : 'FAIL'
  };
  fs.writeFileSync(path.join(OUT, 'photo-persistence-report.json'), JSON.stringify(report, null, 2));
  const md = [
    '# اختبار ثبات صور موظف 360',
    '',
    `**النتيجة:** ${report.overall}`,
    '',
    '## مكان التخزين',
    '- **دائم:** جدول PostgreSQL `hr_employee_photo_assets` (عمود `file_data` BYTEA) مع عزل `entity_id` + `employee_id`.',
    '- **التقديم:** `GET /api/hr/employee-profile/:employeeId/photo` (صلاحيات 360 + كوكي/Bearer).',
    '- **القرص المحلي** (`UPLOADS_ROOT_DIR/hr-employee-360/...`): اختياري/قديم فقط — لا يُعتمد عليه بعد إعادة النشر.',
    '',
    '## النسخ الاحتياطي',
    '```bash',
    'pg_dump -Fc "$DATABASE_URL" -t hr_employee_photo_assets -f hr_employee_photos.dump',
    '# أو ضمن النسخة الكاملة لقاعدة البيانات / لقطات مزوّد الاستضافة',
    '```',
    '',
    '## نتائج الاختبار',
    ...results.map((r) => `- ${r.pass ? 'PASS' : 'FAIL'} — ${r.name}${r.detail ? `: \`${r.detail}\`` : ''}`),
    ''
  ].join('\n');
  fs.writeFileSync(path.join(OUT, 'photo-persistence-report.md'), md);

  console.log(`\nOVERALL: ${report.overall} (${results.filter((r) => r.pass).length}/${results.length})`);
  if (!results.every((r) => r.pass)) process.exit(1);
}

main().catch((e) => { console.error(e); process.exit(1); });
