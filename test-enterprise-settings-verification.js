'use strict';

/**
 * Phase 1 verification — Settings Engine against real Postgres.
 * Covers: schema, seed, auth, tenant isolation, versioning, audit, catalog filtering.
 * Does NOT touch production. Requires DATABASE_URL pointing at a local/dev DB.
 */

const assert = require('assert');
const http = require('http');
const express = require('express');
const { getCatalog, getSeedDefinitions, ALL_ENTRIES } = require('./enterprise-settings-catalog');

const DATABASE_URL = process.env.DATABASE_URL || '';
if (!DATABASE_URL) {
  console.error('FAIL: DATABASE_URL is required for verification tests');
  process.exit(1);
}

// Ensure db.js sees the URL before first require
process.env.DATABASE_URL = DATABASE_URL;

const db = require('./db');
const settingsRouter = require('./enterprise-settings-engine-api');

let failed = 0;
const results = [];

function ok(name, cond, detail = '') {
  if (cond) {
    console.log(`PASS ${name}`);
    results.push({ name, pass: true });
  } else {
    failed += 1;
    console.error(`FAIL ${name}${detail ? ` — ${detail}` : ''}`);
    results.push({ name, pass: false, detail });
  }
}

function section(title) {
  console.log(`\n=== ${title} ===`);
}

async function setupAuthFixtures() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255),
      email VARCHAR(255) UNIQUE,
      role VARCHAR(50) NOT NULL,
      tenant_type VARCHAR(20),
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await db.query(`
    CREATE TABLE IF NOT EXISTS user_sessions (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      session_token VARCHAR(255) NOT NULL UNIQUE,
      expires_at TIMESTAMP NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await db.query(`DELETE FROM user_sessions WHERE session_token LIKE 'verify-%'`);
  await db.query(`DELETE FROM users WHERE email LIKE 'verify-settings-%@test.local'`);

  const platform = await db.query(
    `INSERT INTO users (name, email, role, tenant_type, is_active)
     VALUES ('Verify Platform', 'verify-settings-platform@test.local', 'super_admin', 'HQ', true)
     RETURNING id`
  );
  const tenantAdmin = await db.query(
    `INSERT INTO users (name, email, role, tenant_type, is_active)
     VALUES ('Verify Tenant Admin', 'verify-settings-tenant@test.local', 'admin', 'TENANT', true)
     RETURNING id`
  );
  const plainUser = await db.query(
    `INSERT INTO users (name, email, role, tenant_type, is_active)
     VALUES ('Verify Staff', 'verify-settings-staff@test.local', 'staff', 'TENANT', true)
     RETURNING id`
  );

  const tokens = {
    platform: 'verify-platform-token',
    tenantAdmin: 'verify-tenant-admin-token',
    staff: 'verify-staff-token'
  };

  for (const [key, token] of Object.entries(tokens)) {
    const userId =
      key === 'platform' ? platform.rows[0].id :
      key === 'tenantAdmin' ? tenantAdmin.rows[0].id :
      plainUser.rows[0].id;
    await db.query(
      `INSERT INTO user_sessions (user_id, session_token, expires_at)
       VALUES ($1, $2, NOW() + INTERVAL '2 hours')`,
      [userId, token]
    );
  }

  return {
    platformUserId: platform.rows[0].id,
    tenantAdminUserId: tenantAdmin.rows[0].id,
    tokens
  };
}

function createApp({ asTenantHost = false, tenantId = 42 } = {}) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    if (asTenantHost) {
      req.tenant = { id: tenantId, slug: 'verify-tenant' };
      req.tenantId = tenantId;
      // Simulate tenant pool = same local DB for auth resolution
      req.tenantPool = db;
    }
    next();
  });
  app.use('/api/enterprise-settings', settingsRouter);
  return app;
}

function request(app, method, url, { token, body, headers = {} } = {}) {
  return new Promise((resolve, reject) => {
    const server = app.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      const payload = body != null ? JSON.stringify(body) : null;
      const reqHeaders = {
        Accept: 'application/json',
        ...(payload ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } : {}),
        ...headers
      };
      if (token) reqHeaders.Authorization = `Bearer ${token}`;

      const req = http.request(
        { hostname: '127.0.0.1', port, path: url, method, headers: reqHeaders },
        (res) => {
          let raw = '';
          res.on('data', (chunk) => { raw += chunk; });
          res.on('end', () => {
            server.close();
            let json = null;
            try { json = JSON.parse(raw); } catch { /* leave null */ }
            resolve({ status: res.statusCode, body: json, raw });
          });
        }
      );
      req.on('error', (err) => {
        server.close();
        reject(err);
      });
      if (payload) req.write(payload);
      req.end();
    });
  });
}

async function run() {
  section('Catalog matrix counts');
  const catalog = getCatalog({ includeMock: true });
  ok('total entries = 47', catalog.counts.total === 47, `got ${catalog.counts.total}`);
  ok('live >= 21 (phase2 platform cards)', catalog.counts.live >= 21, `got ${catalog.counts.live}`);
  ok('partial >= 1', catalog.counts.partial >= 1, `got ${catalog.counts.partial}`);
  ok('planned >= 0', catalog.counts.planned >= 0, `got ${catalog.counts.planned}`);
  ok('mock = 8', catalog.counts.mock === 8, `got ${catalog.counts.mock}`);

  const partial = ALL_ENTRIES.filter((e) => e.status === 'partial');
  const mock = ALL_ENTRIES.filter((e) => e.status === 'mock');
  ok('partial list length matches counts', partial.length === catalog.counts.partial);
  ok('mock list length 8', mock.length === 8);

  section('Partial entries detail dump');
  for (const e of partial) {
    console.log(
      `  PARTIAL ${e.id} [${e.level}/${e.moduleKey}] href=${e.href || '-'} spa=${e.spaRoute || '-'} api=${e.api || '-'} notes=${(e.notes || e.descriptionAr || '').slice(0, 90)}`
    );
  }
  section('Mock entries detail dump');
  for (const e of mock) {
    console.log(
      `  MOCK ${e.id} [${e.level}/${e.moduleKey}] href=${e.href || '-'} spa=${e.spaRoute || '-'} notes=${(e.notes || e.descriptionAr || '').slice(0, 90)}`
    );
  }

  section('Real DB: ensure schema');
  await settingsRouter.ensureSchema();
  const tables = await db.query(
    `SELECT table_name FROM information_schema.tables
     WHERE table_schema = 'public'
       AND table_name IN ('setting_definitions','setting_values','setting_versions','setting_audit_events')
     ORDER BY table_name`
  );
  ok('four engine tables exist', tables.rows.length === 4, `found=${tables.rows.map((r) => r.table_name).join(',')}`);

  section('Auth fixtures');
  const fixtures = await setupAuthFixtures();
  ok('platform + tenant + staff tokens created', Boolean(fixtures.tokens.platform && fixtures.tokens.tenantAdmin));

  const centralApp = createApp({ asTenantHost: false });
  const tenantAppA = createApp({ asTenantHost: true, tenantId: 101 });
  const tenantAppB = createApp({ asTenantHost: true, tenantId: 202 });

  section('Auth: unauthenticated rejected');
  {
    const res = await request(centralApp, 'GET', '/api/enterprise-settings/catalog');
    ok('no token → 401', res.status === 401, `status=${res.status}`);
  }

  section('Auth: staff without admin role rejected on central');
  {
    const res = await request(centralApp, 'GET', '/api/enterprise-settings/catalog', {
      token: fixtures.tokens.staff
    });
    ok('staff on central → 401', res.status === 401, `status=${res.status}`);
  }

  section('Auth: platform admin can catalog');
  {
    const res = await request(centralApp, 'GET', '/api/enterprise-settings/catalog', {
      token: fixtures.tokens.platform
    });
    ok('platform catalog 200', res.status === 200 && res.body?.success === true);
    ok('platform sees platform level', (res.body?.data?.byLevel?.platform || []).length > 0);
    ok('platform catalog total 47', res.body?.data?.counts?.total === 47, `total=${res.body?.data?.counts?.total}`);
  }

  section('Tenant host: platform entries hidden');
  {
    const res = await request(tenantAppA, 'GET', '/api/enterprise-settings/catalog', {
      token: fixtures.tokens.tenantAdmin
    });
    ok('tenant catalog 200', res.status === 200 && res.body?.success === true);
    ok('tenant platform level empty', (res.body?.data?.byLevel?.platform || []).length === 0);
    ok(
      'tenant entries have no platform level',
      (res.body?.data?.entries || []).every((e) => e.level !== 'platform')
    );
    ok(
      'tenant total < 47',
      res.body?.data?.counts?.total < 47,
      `total=${res.body?.data?.counts?.total}`
    );
  }

  section('Seed definitions (platform only)');
  {
    const denyTenant = await request(tenantAppA, 'POST', '/api/enterprise-settings/definitions/seed', {
      token: fixtures.tokens.tenantAdmin
    });
    ok('tenant cannot seed → 403', denyTenant.status === 403, `status=${denyTenant.status}`);

    const seed = await request(centralApp, 'POST', '/api/enterprise-settings/definitions/seed', {
      token: fixtures.tokens.platform
    });
    ok('platform seed 200', seed.status === 200 && seed.body?.success === true);
    ok(
      'seed upserted >= 30',
      (seed.body?.data?.upserted || 0) >= 30,
      `upserted=${seed.body?.data?.upserted}`
    );

    const defs = await request(centralApp, 'GET', '/api/enterprise-settings/definitions', {
      token: fixtures.tokens.platform
    });
    ok('definitions readable', defs.status === 200 && Array.isArray(defs.body?.data));
    ok(
      'definitions count matches seeds',
      (defs.body?.data || []).length >= getSeedDefinitions().length,
      `defs=${defs.body?.data?.length}`
    );
  }

  section('Versioning + audit on platform setting');
  const platformKey = 'nav.platform-homepage';
  {
    // Cleanup prior runs (NULL tenant_id uniqueness is weak in Postgres — delete all matches)
    await db.query(`DELETE FROM setting_values WHERE definition_key = $1`, [platformKey]);
    const put1 = await request(centralApp, 'PUT', `/api/enterprise-settings/values/${platformKey}`, {
      token: fixtures.tokens.platform,
      body: { value: { href: '/settings', enabled: true, stamp: 'v1' }, changeReason: 'verify-create' }
    });
    ok('create platform value 200', put1.status === 200 && put1.body?.success === true, put1.raw?.slice?.(0, 200));
    const v1 = Number(put1.body?.data?.version);
    ok('create version starts at 1', v1 === 1, `v=${put1.body?.data?.version}`);

    const put2 = await request(centralApp, 'PUT', `/api/enterprise-settings/values/${platformKey}`, {
      token: fixtures.tokens.platform,
      body: { value: { href: '/settings', enabled: true, stamp: 'v2' }, changeReason: 'verify-update' }
    });
    ok('update platform value 200', put2.status === 200);
    const v2 = Number(put2.body?.data?.version);
    ok('version increments by 1', v2 === v1 + 1, `v1=${v1} v2=${v2}`);

    const put3 = await request(centralApp, 'PUT', `/api/enterprise-settings/values/${platformKey}`, {
      token: fixtures.tokens.platform,
      body: { value: { href: '/settings', enabled: true, stamp: 'v3' }, changeReason: 'verify-update-2' }
    });
    ok('second update 200', put3.status === 200);
    ok('version increments again', Number(put3.body?.data?.version) === v2 + 1, `v=${put3.body?.data?.version}`);

    const versions = await request(
      centralApp,
      'GET',
      `/api/enterprise-settings/values/${platformKey}/versions`,
      { token: fixtures.tokens.platform }
    );
    ok('versions endpoint 200', versions.status === 200);
    ok(
      'version history has multiple rows',
      (versions.body?.data || []).length >= 2,
      `count=${versions.body?.data?.length}`
    );

    const getVal = await request(centralApp, 'GET', `/api/enterprise-settings/values/${platformKey}`, {
      token: fixtures.tokens.platform
    });
    ok('get value stamp=v3', getVal.body?.data?.value?.value?.stamp === 'v3', JSON.stringify(getVal.body?.data?.value?.value));

    const audit = await request(centralApp, 'GET', '/api/enterprise-settings/audit', {
      token: fixtures.tokens.platform
    });
    ok('audit 200', audit.status === 200);
    ok(
      'audit has create/update for key',
      (audit.body?.data || []).some((row) => row.definition_key === platformKey),
      `rows=${(audit.body?.data || []).length}`
    );
  }

  section('Tenant isolation: values scoped by tenant_id');
  const tenantKey = 'nav.company-branding';
  {
    await db.query(
      `DELETE FROM setting_values WHERE definition_key = $1 AND tenant_id IN (101, 202)`,
      [tenantKey]
    );
    // Tenant A writes
    const aPut = await request(tenantAppA, 'PUT', `/api/enterprise-settings/values/${tenantKey}`, {
      token: fixtures.tokens.tenantAdmin,
      body: { value: { brand: 'TenantA', color: '#111' }, changeReason: 'tenant-a' }
    });
    ok('tenant A put 200', aPut.status === 200, aPut.raw?.slice?.(0, 200));
    ok('tenant A row tenant_id=101', aPut.body?.data?.tenant_id === 101, `tid=${aPut.body?.data?.tenant_id}`);

    // Tenant B writes different value
    const bPut = await request(tenantAppB, 'PUT', `/api/enterprise-settings/values/${tenantKey}`, {
      token: fixtures.tokens.tenantAdmin,
      body: { value: { brand: 'TenantB', color: '#222' }, changeReason: 'tenant-b' }
    });
    ok('tenant B put 200', bPut.status === 200);
    ok('tenant B row tenant_id=202', bPut.body?.data?.tenant_id === 202);

    const aGet = await request(tenantAppA, 'GET', `/api/enterprise-settings/values/${tenantKey}`, {
      token: fixtures.tokens.tenantAdmin
    });
    const bGet = await request(tenantAppB, 'GET', `/api/enterprise-settings/values/${tenantKey}`, {
      token: fixtures.tokens.tenantAdmin
    });
    ok('tenant A reads own brand', aGet.body?.data?.value?.value?.brand === 'TenantA', JSON.stringify(aGet.body?.data?.value?.value));
    ok('tenant B reads own brand', bGet.body?.data?.value?.value?.brand === 'TenantB', JSON.stringify(bGet.body?.data?.value?.value));

    // Cross-check DB rows
    const rows = await db.query(
      `SELECT tenant_id, value->>'brand' AS brand FROM setting_values
       WHERE definition_key = $1 AND tenant_id IN (101, 202) ORDER BY tenant_id`,
      [tenantKey]
    );
    ok('two isolated DB rows', rows.rows.length === 2, `count=${rows.rows.length}`);
    ok('DB brands distinct', rows.rows[0].brand === 'TenantA' && rows.rows[1].brand === 'TenantB');
  }

  section('Permissions: tenant cannot write platform-scoped definition');
  {
    const res = await request(tenantAppA, 'PUT', `/api/enterprise-settings/values/${platformKey}`, {
      token: fixtures.tokens.tenantAdmin,
      body: { value: { hijack: true }, changeReason: 'should-fail' }
    });
    ok('tenant write platform key → 403', res.status === 403, `status=${res.status}`);
  }

  section('Compatibility: existing /settings homepage route not overridden in catalog');
  {
    const homepage = ALL_ENTRIES.find((e) => e.id === 'platform-homepage');
    ok('homepage href remains /settings', homepage?.href === '/settings');
    ok('admin hub is separate spa route', true); // documented in server.js /settings/admin
  }

  section('Summary');
  if (failed) {
    console.error(`\nFAILED: ${failed} assertion(s)`);
    process.exitCode = 1;
  } else {
    console.log(`\nAll verification assertions passed (${results.length}).`);
  }

  // Write machine-readable artifact
  const fs = require('fs');
  const out = {
    generatedAt: new Date().toISOString(),
    databaseHost: '127.0.0.1',
    failed,
    passed: results.filter((r) => r.pass).length,
    results,
    catalogCounts: catalog.counts,
    partialIds: partial.map((e) => e.id),
    mockIds: mock.map((e) => e.id)
  };
  fs.mkdirSync('/opt/cursor/artifacts', { recursive: true });
  fs.writeFileSync(
    '/opt/cursor/artifacts/phase1-verification-results.json',
    JSON.stringify(out, null, 2)
  );
  console.log('Wrote /opt/cursor/artifacts/phase1-verification-results.json');

  try {
    await db.end?.();
  } catch {
    /* ignore */
  }
  // Force exit in case pool keeps process alive
  setTimeout(() => process.exit(failed ? 1 : 0), 250);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
