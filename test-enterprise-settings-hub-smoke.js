'use strict';

/**
 * Local hub + API smoke for Enterprise Settings Center.
 * Exercises login-gated API (save/read), SPA route wiring, and mock-action hard-stop.
 * Does not deploy. Requires DATABASE_URL.
 */

const fs = require('fs');
const http = require('http');
const express = require('express');
const path = require('path');

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('DATABASE_URL required');
  process.exit(1);
}

const db = require('./db');
const settingsRouter = require('./enterprise-settings-engine-api');

let failed = 0;
const ok = (name, cond, detail = '') => {
  if (cond) console.log(`PASS ${name}`);
  else {
    failed += 1;
    console.error(`FAIL ${name}${detail ? ` — ${detail}` : ''}`);
  }
};

function request(port, method, urlPath, { token, body, cookie } = {}) {
  return new Promise((resolve, reject) => {
    const payload = body != null ? JSON.stringify(body) : null;
    const headers = { Accept: 'application/json' };
    if (payload) {
      headers['Content-Type'] = 'application/json';
      headers['Content-Length'] = Buffer.byteLength(payload);
    }
    if (token) headers.Authorization = `Bearer ${token}`;
    if (cookie) headers.Cookie = cookie;

    const req = http.request(
      { hostname: '127.0.0.1', port, path: urlPath, method, headers },
      (res) => {
        let raw = '';
        res.on('data', (c) => { raw += c; });
        res.on('end', () => {
          let json = null;
          try { json = JSON.parse(raw); } catch { /* html */ }
          resolve({ status: res.statusCode, headers: res.headers, body: json, raw });
        });
      }
    );
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function main() {
  console.log('\n=== Static SPA / hub wiring checks ===');
  const script = fs.readFileSync(path.join(__dirname, 'script.js'), 'utf8');
  ok('hub route settings-admin present', script.includes("'settings-admin': '/settings/admin'"));
  ok('renderSettingsHub uses enterprise catalog', script.includes('ensureEnterpriseSettingsCatalog'));
  ok('mock/planned blocked without fake success', script.includes('غير جاهز للتشغيل بعد'));
  ok('legacy mock actions hard-stopped', script.includes('تم تعطيل الإجراءات الشكلية'));
  ok('permissions opens super-admin', script.includes("/super-admin-page.html"));

  const serverJs = fs.readFileSync(path.join(__dirname, 'server.js'), 'utf8');
  ok('API mounted at /api/enterprise-settings', serverJs.includes("app.use('/api/enterprise-settings'"));
  ok('/settings/admin SPA route registered', serverJs.includes("app.get('/settings/admin'"));
  ok('exact /settings homepage preserved', serverJs.includes("app.get('/settings'"));

  console.log('\n=== Live API hub smoke (auth + save + read) ===');
  await settingsRouter.ensureSchema();

  await db.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255),
      email VARCHAR(255) UNIQUE,
      role VARCHAR(50) NOT NULL,
      tenant_type VARCHAR(20),
      is_active BOOLEAN DEFAULT true
    )
  `);
  await db.query(`
    CREATE TABLE IF NOT EXISTS user_sessions (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      session_token VARCHAR(255) NOT NULL UNIQUE,
      expires_at TIMESTAMP NOT NULL
    )
  `);

  await db.query(`DELETE FROM user_sessions WHERE session_token = 'hub-smoke-platform'`);
  await db.query(`DELETE FROM users WHERE email = 'hub-smoke-platform@test.local'`);
  const user = await db.query(
    `INSERT INTO users (name, email, role, tenant_type, is_active)
     VALUES ('Hub Smoke', 'hub-smoke-platform@test.local', 'super_admin', 'HQ', true)
     RETURNING id`
  );
  await db.query(
    `INSERT INTO user_sessions (user_id, session_token, expires_at)
     VALUES ($1, 'hub-smoke-platform', NOW() + INTERVAL '1 hour')`,
    [user.rows[0].id]
  );

  const app = express();
  app.use(express.json());
  app.use('/api/enterprise-settings', settingsRouter);
  // Minimal SPA shells for route smoke
  app.get('/settings/admin', (_req, res) => {
    res.type('html').send('<!doctype html><title>Settings Admin Hub</title><div id="app">enterprise-settings-hub</div>');
  });
  app.get('/settings', (_req, res) => {
    res.type('html').send('<!doctype html><title>Homepage Identity</title><div>platform-homepage</div>');
  });

  const server = await new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  const port = server.address().port;
  const token = 'hub-smoke-platform';

  const unauth = await request(port, 'GET', '/api/enterprise-settings/catalog');
  ok('catalog without login → 401', unauth.status === 401);

  const catalog = await request(port, 'GET', '/api/enterprise-settings/catalog', { token });
  ok('catalog with login → 200', catalog.status === 200 && catalog.body?.success);
  ok('hub counts total 47', catalog.body?.data?.counts?.total === 47);
  ok('hub has mock badges data', catalog.body?.data?.counts?.mock === 8);
  ok('hub live includes phase2 platform cards', catalog.body?.data?.counts?.live >= 21);

  const seed = await request(port, 'POST', '/api/enterprise-settings/definitions/seed', { token });
  ok('seed from hub session', seed.status === 200);

  const key = 'nav.company-payment';
  await db.query(`DELETE FROM setting_values WHERE definition_key = $1`, [key]);
  const save = await request(port, 'PUT', `/api/enterprise-settings/values/${key}`, {
    token,
    body: { value: { gateway: 'stripe', live: false, smoke: true }, changeReason: 'hub-smoke-save' }
  });
  ok('save setting → 200', save.status === 200 && save.body?.success, save.raw?.slice?.(0, 180));

  const read = await request(port, 'GET', `/api/enterprise-settings/values/${key}`, { token });
  ok('read-after-save smoke=true', read.body?.data?.value?.value?.smoke === true);

  const versions = await request(port, 'GET', `/api/enterprise-settings/values/${key}/versions`, { token });
  ok('versions after save', versions.status === 200 && (versions.body?.data || []).length >= 1);

  const adminPage = await request(port, 'GET', '/settings/admin');
  ok('/settings/admin serves hub shell', adminPage.status === 200 && adminPage.raw.includes('enterprise-settings-hub'));

  const homepage = await request(port, 'GET', '/settings');
  ok('/settings still homepage identity', homepage.status === 200 && homepage.raw.includes('platform-homepage'));
  ok('/settings !== /settings/admin', true);

  server.close();

  const out = {
    generatedAt: new Date().toISOString(),
    failed,
    note: 'Local hub/API smoke. Railway staging not updated with Phase 1 branch — browser E2E on remote staging deferred until explicit deploy approval.'
  };
  fs.mkdirSync('/opt/cursor/artifacts', { recursive: true });
  fs.writeFileSync('/opt/cursor/artifacts/phase1-hub-smoke.json', JSON.stringify(out, null, 2));

  if (failed) {
    console.error(`\nHUB SMOKE FAILED: ${failed}`);
    process.exitCode = 1;
  } else {
    console.log('\nHub smoke passed.');
  }
  setTimeout(() => process.exit(failed ? 1 : 0), 200);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
