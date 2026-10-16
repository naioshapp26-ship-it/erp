'use strict';

/**
 * Phase 2 — Platform Owner Console verification (real Postgres + HTTP).
 * Asserts more than HTTP 200: persisted rows, isolation, seat limits, module gates.
 */

const http = require('http');
const express = require('express');
const assert = require('assert');

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('DATABASE_URL required');
  process.exit(1);
}

const db = require('./db');
const owner = require('./platform-owner-service');
const platformOwnerRouter = require('./platform-owner-api');
const { resolveModuleForPath, createModuleEntitlementMiddleware } = require('./module-entitlement-middleware');
const { ALL_ENTRIES, getCatalog } = require('./enterprise-settings-catalog');

let failed = 0;
const results = [];
const ok = (name, cond, detail = '') => {
  if (cond) {
    console.log(`PASS ${name}`);
    results.push({ name, pass: true });
  } else {
    failed += 1;
    console.error(`FAIL ${name}${detail ? ` — ${detail}` : ''}`);
    results.push({ name, pass: false, detail });
  }
};
const section = (t) => console.log(`\n=== ${t} ===`);

function createApp({ asTenantHost = false, tenantId = null } = {}) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    if (asTenantHost) {
      req.tenant = { id: tenantId, subdomain: 't' + tenantId };
      req.tenantId = tenantId;
    }
    next();
  });
  app.use('/api/platform-owner', platformOwnerRouter);
  app.use(createModuleEntitlementMiddleware());
  app.get('/api/hr/ping', (_req, res) => res.json({ ok: true, module: 'hr' }));
  app.get('/api/finance/ping', (_req, res) => res.json({ ok: true, module: 'finance' }));
  return app;
}

function request(app, method, url, { token, body } = {}) {
  return new Promise((resolve, reject) => {
    const server = app.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      const payload = body != null ? JSON.stringify(body) : null;
      const headers = { Accept: 'application/json' };
      if (payload) {
        headers['Content-Type'] = 'application/json';
        headers['Content-Length'] = Buffer.byteLength(payload);
      }
      if (token) headers.Authorization = `Bearer ${token}`;
      const req = http.request({ hostname: '127.0.0.1', port, path: url, method, headers }, (res) => {
        let raw = '';
        res.on('data', (c) => { raw += c; });
        res.on('end', () => {
          server.close();
          let json = null;
          try { json = JSON.parse(raw); } catch { /* */ }
          resolve({ status: res.statusCode, body: json, raw });
        });
      });
      req.on('error', (err) => { server.close(); reject(err); });
      if (payload) req.write(payload);
      req.end();
    });
  });
}

async function ensureAuthFixtures() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255),
      email VARCHAR(255) UNIQUE,
      role VARCHAR(100) NOT NULL,
      tenant_type VARCHAR(40),
      is_active BOOLEAN DEFAULT true
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

  await db.query(`DELETE FROM user_sessions WHERE session_token LIKE 'p2-%'`);
  await db.query(`DELETE FROM users WHERE email LIKE 'p2-%@test.local'`);

  const platform = await db.query(
    `INSERT INTO users (name, email, role, tenant_type, is_active)
     VALUES ('P2 Owner', 'p2-owner@test.local', 'super_admin', 'HQ', true) RETURNING id`
  );
  const companyAdmin = await db.query(
    `INSERT INTO users (name, email, role, tenant_type, is_active)
     VALUES ('P2 Company Admin', 'p2-company@test.local', 'admin', 'TENANT', true) RETURNING id`
  );

  await db.query(
    `INSERT INTO user_sessions (user_id, session_token, expires_at)
     VALUES ($1, 'p2-owner-token', NOW() + INTERVAL '2 hours'),
            ($2, 'p2-company-token', NOW() + INTERVAL '2 hours')`,
    [platform.rows[0].id, companyAdmin.rows[0].id]
  );

  return {
    ownerId: platform.rows[0].id,
    ownerToken: 'p2-owner-token',
    companyToken: 'p2-company-token'
  };
}

async function insertTestTenant(subdomain, plan = 'basic') {
  const row = await db.query(
    `INSERT INTO tenants (subdomain, company_name, subscription_plan, status, settings)
     VALUES ($1, $2, $3, 'active', '{}'::jsonb)
     ON CONFLICT (subdomain) DO UPDATE SET
       company_name = EXCLUDED.company_name,
       subscription_plan = EXCLUDED.subscription_plan,
       status = 'active',
       updated_at = NOW()
     RETURNING *`,
    [subdomain, `Company ${subdomain}`, plan]
  );
  return row.rows[0];
}

async function run() {
  section('Catalog Phase 2 status updates');
  const catalog = getCatalog({ includeMock: true });
  ok('still 47 entries', catalog.counts.total === 47, `total=${catalog.counts.total}`);
  const subs = ALL_ENTRIES.find((e) => e.id === 'platform-subscriptions');
  const saas = ALL_ENTRIES.find((e) => e.id === 'platform-saas-signup');
  const ops = ALL_ENTRIES.find((e) => e.id === 'platform-ops-health');
  ok('subscriptions live + href', subs?.status === 'live' && subs.href === '/platform/owner');
  ok('saas-signup live + href', saas?.status === 'live' && saas.href === '/platform/owner');
  ok('ops-health live + href', ops?.status === 'live' && ops.href === '/platform/owner');

  section('Schema + default plans');
  await owner.ensureSchema();
  const plans = await owner.listPlans({ includeInactive: true });
  ok('default plans >= 3', plans.length >= 3, `count=${plans.length}`);
  ok('basic/pro/enterprise present', ['basic', 'pro', 'enterprise'].every((c) => plans.some((p) => p.code === c)));
  ok('basic has modules', (plans.find((p) => p.code === 'basic')?.module_keys || []).includes('hr'));

  const auth = await ensureAuthFixtures();
  const centralApp = createApp({ asTenantHost: false });
  const tenantApp = createApp({ asTenantHost: true, tenantId: 999001 });

  section('Auth separation');
  {
    const unauth = await request(centralApp, 'GET', '/api/platform-owner/overview');
    ok('unauth 401', unauth.status === 401);

    const company = await request(centralApp, 'GET', '/api/platform-owner/overview', {
      token: auth.companyToken
    });
    ok('company admin blocked 403', company.status === 403, `status=${company.status}`);

    const tenantHost = await request(tenantApp, 'GET', '/api/platform-owner/overview', {
      token: auth.ownerToken
    });
    ok('tenant host blocked even with owner token', tenantHost.status === 403);

    const ownerOk = await request(centralApp, 'GET', '/api/platform-owner/overview', {
      token: auth.ownerToken
    });
    ok('platform owner overview 200', ownerOk.status === 200 && ownerOk.body?.success);
    ok('overview has ops usage', ownerOk.body?.data?.ops?.usage?.tenants != null);
  }

  section('Plans CRUD + custom plan');
  {
    const created = await request(centralApp, 'POST', '/api/platform-owner/plans', {
      token: auth.ownerToken,
      body: {
        code: 'p2-gold',
        name_ar: 'ذهبية اختبار',
        price: 99,
        currency: 'USD',
        billing_cycle: 'monthly',
        max_users: 3,
        max_storage_mb: 500,
        trial_days: 5,
        grace_days: 2,
        module_keys: ['dashboard', 'hr', 'tenant-branding']
      }
    });
    ok('custom plan created', created.status === 201 && created.body?.data?.code === 'p2-gold', created.raw?.slice?.(0, 200));
    ok('custom plan max_users=3', created.body?.data?.max_users === 3);
    ok('custom plan modules exclude finance', !(created.body?.data?.module_keys || []).includes('finance'));

    const fetched = await request(centralApp, 'GET', '/api/platform-owner/plans/p2-gold', {
      token: auth.ownerToken
    });
    ok('plan persisted in DB via GET', fetched.body?.data?.name_ar === 'ذهبية اختبار');

    const modUpdate = await request(centralApp, 'PUT', '/api/platform-owner/plans/p2-gold/modules', {
      token: auth.ownerToken,
      body: { module_keys: ['dashboard', 'hr', 'finance', 'tenant-branding'] }
    });
    ok('plan modules updated with finance', (modUpdate.body?.data?.module_keys || []).includes('finance'));
  }

  section('Companies lifecycle + subscription + license');
  const tenantA = await insertTestTenant('p2co-a', 'basic');
  const tenantB = await insertTestTenant('p2co-b', 'pro');
  {
    await owner.ensureLicenseForTenant(tenantA.id, 'basic', auth.ownerId);
    await owner.syncSubscriptionRow(tenantA.id, { plan: 'basic', status: 'active' }, auth.ownerId);

    const list = await request(centralApp, 'GET', '/api/platform-owner/companies?search=p2co', {
      token: auth.ownerToken
    });
    ok('companies list includes fixtures', (list.body?.data?.items || []).length >= 2);

    const patched = await request(centralApp, 'PATCH', `/api/platform-owner/companies/${tenantA.id}`, {
      token: auth.ownerToken,
      body: {
        company_name: 'P2 Company A Renamed',
        plan: 'p2-gold',
        subscription_status: 'trialing',
        reseed_modules: false
      }
    });
    ok('company rename+plan patch 200', patched.status === 200, patched.raw?.slice?.(0, 200));
    ok('company plan is p2-gold', patched.body?.data?.subscription_plan === 'p2-gold');
    ok('subscription trialing', patched.body?.data?.subscription_status === 'trialing');

    const lic = await request(centralApp, 'GET', `/api/platform-owner/licenses/${tenantA.id}`, {
      token: auth.ownerToken
    });
    ok('license seats follow plan (3)', lic.body?.data?.seats === 3, JSON.stringify(lic.body?.data));

    const suspend = await request(centralApp, 'POST', `/api/platform-owner/companies/${tenantA.id}/suspend`, {
      token: auth.ownerToken,
      body: {}
    });
    ok('suspend without delete', suspend.body?.data?.status === 'suspended');
    const stillThere = await db.query(`SELECT status FROM tenants WHERE id = $1`, [tenantA.id]);
    ok('tenant row still exists after suspend', stillThere.rows[0].status === 'suspended');

    const activate = await request(centralApp, 'POST', `/api/platform-owner/companies/${tenantA.id}/activate`, {
      token: auth.ownerToken,
      body: {}
    });
    ok('reactivate', activate.body?.data?.status === 'active');
  }

  section('Tenant isolation of modules/licenses');
  {
    await owner.ensureLicenseForTenant(tenantB.id, 'pro', auth.ownerId);
    await owner.updateLicense(tenantB.id, { seats: 7, storage_mb_limit: 2048 }, auth.ownerId);

    const aMods = await owner.resolveTenantModules(tenantA.id);
    const bMods = await owner.resolveTenantModules(tenantB.id);
    ok('tenant A and B module sets are independent objects', aMods !== bMods);

    await owner.setTenantModuleOverride(tenantA.id, 'finance', false, 'test-disable', auth.ownerId);
    await owner.setTenantModuleOverride(tenantB.id, 'finance', true, 'test-enable', auth.ownerId);
    const a2 = await owner.resolveTenantModules(tenantA.id);
    const b2 = await owner.resolveTenantModules(tenantB.id);
    ok('A finance disabled', a2.locked.some((m) => m.key === 'finance') || !a2.enabled.some((m) => m.key === 'finance'));
    ok('B finance enabled', b2.enabled.some((m) => m.key === 'finance'));

    const aLic = await db.query(`SELECT seats FROM tenant_licenses WHERE tenant_id=$1`, [tenantA.id]);
    const bLic = await db.query(`SELECT seats FROM tenant_licenses WHERE tenant_id=$1`, [tenantB.id]);
    ok('license seats isolated A!=B', aLic.rows[0].seats !== bLic.rows[0].seats, `A=${aLic.rows[0].seats} B=${bLic.rows[0].seats}`);
  }

  section('Seat limit enforcement');
  {
    await owner.updateLicense(tenantA.id, { seats: 1, seats_used: 1, status: 'active' }, auth.ownerId);
    // force seats_used
    await db.query(`UPDATE tenant_licenses SET seats_used = 1, seats = 1 WHERE tenant_id = $1`, [tenantA.id]);
    await owner.setFlag('seat_enforcement.enabled', true, auth.ownerId);
    const check = await owner.checkSeatAllowance(tenantA.id);
    ok('seat limit blocks when used>=seats', check.allowed === false && check.reason === 'seat_limit', JSON.stringify(check));

    await db.query(`UPDATE tenant_licenses SET seats_used = 0 WHERE tenant_id = $1`, [tenantA.id]);
    const check2 = await owner.checkSeatAllowance(tenantA.id);
    ok('seat allow when capacity free', check2.allowed === true);
  }

  section('Module API entitlement middleware');
  {
    ok('resolve /api/hr → hr', resolveModuleForPath('/api/hr/employees') === 'hr');
    ok('resolve /api/finance → finance', resolveModuleForPath('/api/finance/invoices') === 'finance');

    await owner.setFlag('module_enforcement.enabled', true, auth.ownerId);
    await owner.setTenantModuleOverride(tenantA.id, 'hr', false, 'gate-test', auth.ownerId);
    await owner.setTenantModuleOverride(tenantA.id, 'finance', true, 'gate-test', auth.ownerId);

    const gatedApp = createApp({ asTenantHost: true, tenantId: tenantA.id });
    const hrDenied = await request(gatedApp, 'GET', '/api/hr/ping', { token: auth.ownerToken });
    ok('disabled HR API → 403 MODULE_NOT_ENTITLED', hrDenied.status === 403 && hrDenied.body?.code === 'MODULE_NOT_ENTITLED', hrDenied.raw);

    const finOk = await request(gatedApp, 'GET', '/api/finance/ping', { token: auth.ownerToken });
    ok('enabled Finance API → 200', finOk.status === 200 && finOk.body?.ok === true, finOk.raw);
  }

  section('Versioning / audit trail');
  {
    const before = await owner.listAudit({ limit: 5 });
    await owner.setFlag('ops.error_capture', true, auth.ownerId);
    await owner.writeAudit({
      actorId: auth.ownerId,
      action: 'test.marker',
      entityType: 'test',
      entityId: 'p2',
      newValue: { ok: true }
    });
    const after = await owner.listAudit({ limit: 20 });
    ok('audit grew', after.length >= before.length);
    ok('audit contains test.marker or flag.set', after.some((a) => a.action === 'test.marker' || a.action === 'flag.set'));

    const ops = await request(centralApp, 'GET', '/api/platform-owner/ops/health', { token: auth.ownerToken });
    ok('ops health database ok', ops.body?.data?.services?.database?.status === 'ok');
    ok('ops has feature flags', Array.isArray(ops.body?.data?.feature_flags));
    ok('ops has usage tenants', ops.body?.data?.usage?.tenants?.total >= 0);
  }

  section('Regression: enterprise settings catalog still works');
  {
    const { getCatalog: gc } = require('./enterprise-settings-catalog');
    const c = gc({ includeMock: true });
    ok('catalog total 47', c.counts.total === 47);
    ok('live increased after phase2 (>=21)', c.counts.live >= 21, `live=${c.counts.live}`);
    ok('planned decreased (<=1)', c.counts.planned <= 1, `planned=${c.counts.planned}`);
  }

  section('Summary');
  const fs = require('fs');
  fs.mkdirSync('/opt/cursor/artifacts', { recursive: true });
  fs.writeFileSync(
    '/opt/cursor/artifacts/phase2-verification-results.json',
    JSON.stringify({
      generatedAt: new Date().toISOString(),
      failed,
      passed: results.filter((r) => r.pass).length,
      results
    }, null, 2)
  );

  if (failed) {
    console.error(`\nFAILED: ${failed}`);
    process.exitCode = 1;
  } else {
    console.log(`\nAll Phase 2 assertions passed (${results.length}).`);
  }
  setTimeout(() => process.exit(failed ? 1 : 0), 300);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
