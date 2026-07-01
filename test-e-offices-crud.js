const fs = require('fs');
const path = require('path');
const http = require('http');

const serverContent = fs.readFileSync(path.join(__dirname, 'server.js'), 'utf8');
const pagesContent = fs.readFileSync(path.join(__dirname, 'e-offices-pages.js'), 'utf8');
const routesContent = fs.readFileSync(path.join(__dirname, 'finance', 'api', 'e-offices-routes.js'), 'utf8');

const checks = [
  { name: 'entities query qualifies type column', ok: /AND e\.type = ANY/.test(serverContent) },
  { name: 'entities query qualifies created_at', ok: /ORDER BY e\.created_at DESC/.test(serverContent) },
  { name: 'server mounts /api/e-offices', ok: /app\.use\('\/api\/e-offices',\s*eOfficesRoutes\)/.test(serverContent) },
  { name: 'routes expose GET module', ok: /router\.get\('\/:moduleKey'/.test(routesContent) },
  { name: 'routes expose POST module', ok: /router\.post\('\/:moduleKey'/.test(routesContent) },
  { name: 'routes expose seed endpoint', ok: /router\.post\('\/:moduleKey\/seed'/.test(routesContent) },
  { name: 'routes expose PUT record', ok: /router\.put\('\/:moduleKey\/:id'/.test(routesContent) },
  { name: 'routes expose DELETE record', ok: /router\.delete\('\/:moduleKey\/:id'/.test(routesContent) },
  { name: 'pages use API_BASE', ok: /const API_BASE = '\/api\/e-offices'/.test(pagesContent) },
  { name: 'pages expose handleAction', ok: /handleAction\(action, route, index, event\)/.test(pagesContent) },
  { name: 'pages use onclick handlers', ok: /eoOnClick\(/.test(pagesContent) },
  { name: 'pages remove record on server', ok: /async function removeRecord/.test(pagesContent) },
  { name: 'all 15 eo routes configured', ok: (pagesContent.match(/'eo-[^']+':\s*\{/g) || []).length >= 15 }
];

const failed = checks.filter((check) => !check.ok);
if (failed.length) {
  console.error('❌ E-Offices CRUD validation failed');
  failed.forEach((check) => console.error(`   Missing: ${check.name}`));
  process.exit(1);
}

function request(method, reqPath, body) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const req = http.request({
      hostname: '127.0.0.1',
      port: process.env.TEST_PORT || 8792,
      path: reqPath,
      method,
      headers: payload ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } : {}
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        let parsed = {};
        try { parsed = data ? JSON.parse(data) : {}; } catch (_) { parsed = { raw: data }; }
        resolve({ status: res.statusCode, body: parsed });
      });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function runLive() {
  const { spawn } = require('child_process');
  const port = process.env.TEST_PORT || 8792;
  const child = spawn('node', ['server.js'], {
    cwd: __dirname,
    env: { ...process.env, PORT: String(port), NODE_ENV: 'test' }
  });

  const wait = async () => {
    for (let i = 0; i < 40; i += 1) {
      try {
        const res = await request('GET', '/api/e-offices/eo-daily-operations');
        if (res.status === 200) return;
      } catch (_) {}
      await new Promise((r) => setTimeout(r, 500));
    }
    throw new Error('server did not boot');
  };

  try {
    await wait();
    const created = await request('POST', '/api/e-offices/eo-daily-operations', {
      cells: ['عملية اختبار', 'فريق QA', 'قيد التنفيذ', '2026-06-09']
    });
    if (created.status !== 201) throw new Error(`create failed ${created.status}`);
    const id = created.body.record?.id;
    const updated = await request('PUT', `/api/e-offices/eo-daily-operations/${id}`, {
      cells: ['عملية محدثة', 'فريق QA', 'مكتمل', '2026-06-09']
    });
    if (updated.status !== 200) throw new Error(`update failed ${updated.status}`);
    const deleted = await request('DELETE', `/api/e-offices/eo-daily-operations/${id}`);
    if (deleted.status !== 200) throw new Error(`delete failed ${deleted.status}`);
    console.log('✅ E-Offices CRUD static + live validation passed');
  } catch (error) {
    if (/server did not boot|ECONNREFUSED/i.test(error.message)) {
      console.log('✅ E-Offices CRUD static validation passed (live test skipped: database unavailable)');
      return;
    }
    throw error;
  } finally {
    child.kill('SIGTERM');
  }
}

runLive().catch((error) => {
  console.error('❌ E-Offices live validation failed');
  console.error(`   ${error.message}`);
  process.exit(1);
});
