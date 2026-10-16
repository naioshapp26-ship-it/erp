'use strict';

/**
 * Phase 4 — Module Settings Center verification.
 * Asserts: persistence, versioning, audit, tenant isolation, RBAC,
 * operational behavior change (leave/tax/stock/pos/fiscal/numbering),
 * invite accept, session TTL policy resolution, catalog honesty, no mock save.
 */

const http = require('http');
const express = require('express');
const crypto = require('crypto');

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('DATABASE_URL required');
  process.exit(1);
}

const db = require('./db');
const modules = require('./module-settings-service');
const moduleRouter = require('./module-settings-api');
const company = require('./company-settings-service');
const companyRouter = require('./company-settings-api');
const { resolveModuleForPath, ALWAYS_ALLOW_PREFIXES } = require('./module-entitlement-middleware');
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

function createTenantApp(tenantId, subdomain) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.tenant = { id: tenantId, subdomain, company_name: `Co ${subdomain}` };
    req.tenantId = tenantId;
    req.tenantPool = db;
    next();
  });
  app.use('/api/module-settings', moduleRouter);
  app.use('/api/company-settings', companyRouter);
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

async function ensureFixtures() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255),
      email VARCHAR(255),
      role VARCHAR(100) NOT NULL,
      tenant_type VARCHAR(40),
      is_active BOOLEAN DEFAULT true
    )
  `);
  // Non-destructive: add columns used by Phase 4 invite accept / tenant-auth on shared DBs
  await db.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS first_name VARCHAR(255)`);
  await db.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS last_name VARCHAR(255)`);
  await db.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS username VARCHAR(255)`);
  await db.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT`);
  await db.query(`
    CREATE TABLE IF NOT EXISTS user_sessions (
      id SERIAL PRIMARY KEY,
      user_id INTEGER,
      session_token VARCHAR(255) UNIQUE,
      ip_address TEXT,
      user_agent TEXT,
      expires_at TIMESTAMP
    )
  `);
  await db.query(`
    CREATE TABLE IF NOT EXISTS sessions (
      id SERIAL PRIMARY KEY,
      user_id INTEGER,
      tenant_id INTEGER,
      session_token VARCHAR(255),
      ip_address TEXT,
      user_agent TEXT,
      expires_at TIMESTAMP
    )
  `);

  await company.ensureEngine();
  await modules.ensureEngine();
  await company.ensureOrgSchema(db);
  await modules.ensureOpsSchema(db);

  const upsertUser = async (email, role) => {
    const existing = await db.query(`SELECT id FROM users WHERE email = $1`, [email]);
    if (existing.rows.length) {
      await db.query(`UPDATE users SET role = $2, is_active = true WHERE id = $1`, [existing.rows[0].id, role]);
      return existing.rows[0].id;
    }
    const r = await db.query(
      `INSERT INTO users (name, first_name, username, email, role, is_active)
       VALUES ($1,$2,$3,$4,$5,true) RETURNING id`,
      [email, email.split('@')[0], email.split('@')[0], email, role]
    );
    return r.rows[0].id;
  };

  const adminA = await upsertUser('p4-admin-a@example.com', 'company_admin');
  const adminB = await upsertUser('p4-admin-b@example.com', 'company_admin');
  const staffA = await upsertUser('p4-staff-a@example.com', 'staff');

  const mkSession = async (userId) => {
    const token = crypto.randomBytes(16).toString('hex');
    await db.query(
      `INSERT INTO user_sessions (user_id, session_token, expires_at)
       VALUES ($1,$2, NOW() + INTERVAL '1 day')`,
      [userId, token]
    );
    await db.query(
      `INSERT INTO sessions (user_id, tenant_id, session_token, expires_at)
       VALUES ($1, 401, $2, NOW() + INTERVAL '1 day')`,
      [userId, token]
    ).catch(() => null);
    return token;
  };

  return {
    tokenA: await mkSession(adminA),
    tokenB: await mkSession(adminB),
    tokenStaff: await mkSession(staffA),
    adminA,
    adminB
  };
}

async function run() {
  section('Catalog honesty (Phase 4)');
  const catalog = getCatalog();
  ok('catalog total 47', catalog.counts.total === 47, JSON.stringify(catalog.counts));
  ok('catalog live increased', catalog.counts.live >= 40, JSON.stringify(catalog.counts));
  ok('catalog mock cleared for templates/numbering', catalog.counts.mock === 0, JSON.stringify(catalog.counts));
  ok('fiscal is live', ALL_ENTRIES.find((e) => e.id === 'module-finance-fiscal')?.status === 'live');
  // Phase 5 lifts backup to live (operational jobs + gated restore-test)
  ok(
    'backup live or partial (phase4→5)',
    ['live', 'partial'].includes(ALL_ENTRIES.find((e) => e.id === 'module-backup')?.status)
  );
  ok(
    'catalog version phase4+',
    catalog.version.startsWith('phase4') || catalog.version.startsWith('phase5')
  );

  section('Entitlement allowlist');
  ok('module-settings allowlisted', ALWAYS_ALLOW_PREFIXES.includes('/api/module-settings'));
  ok('invite path allowlisted', ALWAYS_ALLOW_PREFIXES.includes('/invite'));
  ok('leave-requests maps to hr', resolveModuleForPath('/api/leave-requests') === 'hr');
  ok('tax-settings maps to finance', resolveModuleForPath('/api/tax-settings') === 'finance');

  section('Fixtures');
  const { tokenA, tokenB, tokenStaff } = await ensureFixtures();
  const appA = createTenantApp(401, 'p4-alpha');
  const appB = createTenantApp(402, 'p4-beta');

  section('RBAC');
  const denied = await request(appA, 'GET', '/api/module-settings/bundle', { token: tokenStaff });
  ok('staff blocked from module settings', denied.status === 403, `status=${denied.status}`);
  const allowed = await request(appA, 'GET', '/api/module-settings/bundle', { token: tokenA });
  ok('admin loads bundle', allowed.status === 200 && allowed.body?.success, allowed.raw?.slice?.(0, 200));
  ok('bundle has module definitions', (allowed.body?.data?.definitions || []).length >= 20);

  section('No mock save + read-after-write');
  const bad = await request(appA, 'PUT', '/api/module-settings/values/hr/leave', {
    token: tokenA,
    body: { notValue: true }
  });
  ok('rejects missing value object', bad.status === 400);

  const leaveSave = await request(appA, 'PUT', '/api/module-settings/values/hr/leave', {
    token: tokenA,
    body: {
      value: { max_days_per_request: 7, require_reason: true, allowed_types: ['annual', 'sick'] },
      changeReason: 'test-p4-leave'
    }
  });
  ok('leave policy saved', leaveSave.status === 200 && leaveSave.body?.data?.matches, leaveSave.raw?.slice?.(0, 250));
  ok(
    'leave max_days=7',
    leaveSave.body?.data?.read_after_write?.value?.max_days_per_request === 7
  );

  section('Operational behavior — leave policy');
  const leaveOk = await request(appA, 'POST', '/api/module-settings/ops/validate-leave', {
    token: tokenA,
    body: { leave_type: 'annual', days_count: 3, reason: 'trip', start_date: '2030-01-10' }
  });
  ok('valid leave accepted', leaveOk.status === 200 && leaveOk.body?.success);

  const leaveOver = await request(appA, 'POST', '/api/module-settings/ops/validate-leave', {
    token: tokenA,
    body: { leave_type: 'annual', days_count: 20, reason: 'long', start_date: '2030-01-10' }
  });
  ok('over-limit leave rejected', leaveOver.status === 422 && leaveOver.body?.success === false);

  const leaveNoReason = await modules.validateLeaveRequest(401, {
    leave_type: 'annual',
    days_count: 2,
    reason: '',
    start_date: '2030-01-10'
  });
  ok('missing reason rejected by service', leaveNoReason.ok === false);

  section('Operational behavior — tax');
  await request(appA, 'PUT', '/api/module-settings/values/finance/tax', {
    token: tokenA,
    body: { value: { default_vat_rate: 15, apply_on_invoices: true, inclusive_pricing: false } }
  });
  const tax = await request(appA, 'POST', '/api/module-settings/ops/compute-tax', {
    token: tokenA,
    body: { subtotal: 1000 }
  });
  ok('tax 15% on 1000 = 150', tax.body?.data?.tax_amount === 150 && tax.body?.data?.total === 1150);

  await request(appA, 'PUT', '/api/module-settings/values/finance/tax', {
    token: tokenA,
    body: { value: { default_vat_rate: 5 } }
  });
  const tax2 = await modules.computeInvoiceTax(401, 1000);
  ok('tax rate change alters computation', tax2.tax_amount === 50 && tax2.tax_rate === 5);

  section('Operational behavior — inventory / POS');
  await request(appA, 'PUT', '/api/module-settings/values/inventory/stock', {
    token: tokenA,
    body: { value: { low_stock_threshold: 10, allow_negative: false } }
  });
  const stock = await request(appA, 'POST', '/api/module-settings/ops/evaluate-stock', {
    token: tokenA,
    body: { quantity: 5 }
  });
  ok('qty 5 is low vs threshold 10', stock.body?.data?.is_low === true);

  const neg = await request(appA, 'POST', '/api/module-settings/ops/evaluate-stock', {
    token: tokenA,
    body: { quantity: -1 }
  });
  ok('negative stock blocked', neg.status === 409 && neg.body?.data?.blocked === true);

  await request(appA, 'PUT', '/api/module-settings/values/sales/pos', {
    token: tokenA,
    body: { value: { allow_negative_stock: false } }
  });
  const pos = await request(appA, 'POST', '/api/module-settings/ops/evaluate-pos', {
    token: tokenA,
    body: { stock_qty: 0 }
  });
  ok('POS blocks zero stock when policy forbids', pos.status === 409);

  await request(appA, 'PUT', '/api/module-settings/values/sales/pos', {
    token: tokenA,
    body: { value: { allow_negative_stock: true } }
  });
  const pos2 = await request(appA, 'POST', '/api/module-settings/ops/evaluate-pos', {
    token: tokenA,
    body: { stock_qty: 0 }
  });
  ok('POS allows zero after policy change', pos2.status === 200 && pos2.body?.success);

  section('Fiscal years / periods / posting gate');
  const yearCode = `FY-P4-${Date.now().toString().slice(-6)}`;
  const year = await request(appA, 'POST', '/api/module-settings/fiscal/years', {
    token: tokenA,
    body: {
      code: yearCode,
      name_ar: 'سنة اختبار',
      start_date: '2031-01-01',
      end_date: '2031-12-31',
      is_current: true,
      generate_periods: true
    }
  });
  ok('fiscal year created with periods', year.status === 201 && (year.body?.data?.periods || []).length === 12);

  const periodId = year.body.data.periods[0].id;
  await request(appA, 'POST', `/api/module-settings/fiscal/periods/${periodId}/status`, {
    token: tokenA,
    body: { status: 'closed' }
  });
  await request(appA, 'PUT', '/api/module-settings/values/finance/fiscal', {
    token: tokenA,
    body: { value: { allow_posting_closed: false } }
  });
  const closed = await request(appA, 'POST', '/api/module-settings/fiscal/assert-posting', {
    token: tokenA,
    body: { date: '2031-01-15' }
  });
  ok('posting blocked in closed period', closed.status === 409 && closed.body?.success === false);

  await request(appA, 'PUT', '/api/module-settings/values/finance/fiscal', {
    token: tokenA,
    body: { value: { allow_posting_closed: true } }
  });
  const openPost = await request(appA, 'POST', '/api/module-settings/fiscal/assert-posting', {
    token: tokenA,
    body: { date: '2031-01-15' }
  });
  ok('posting allowed when policy permits closed', openPost.status === 200 && openPost.body?.success);

  section('Templates + numbering');
  const tpl = await request(appA, 'POST', '/api/module-settings/templates', {
    token: tokenA,
    body: {
      template_type: 'email',
      code: `welcome-${Date.now().toString().slice(-5)}`,
      name_ar: 'ترحيب',
      subject: 'مرحبا',
      body: 'أهلاً {{name}}'
    }
  });
  ok('email template persisted', tpl.status === 201 && tpl.body?.data?.id);

  const num1 = await request(appA, 'POST', '/api/module-settings/ops/next-number', {
    token: tokenA,
    body: { series_key: 'invoice' }
  });
  const num2 = await request(appA, 'POST', '/api/module-settings/ops/next-number', {
    token: tokenA,
    body: { series_key: 'invoice' }
  });
  ok('numbering increments', num1.body?.data?.number + 1 === num2.body?.data?.number);

  section('Tenant isolation');
  await request(appA, 'PUT', '/api/module-settings/values/sales/crm', {
    token: tokenA,
    body: { value: { default_stage: 'qualified-A' } }
  });
  await request(appB, 'PUT', '/api/module-settings/values/sales/crm', {
    token: tokenB,
    body: { value: { default_stage: 'lead-B' } }
  });
  const aVal = await modules.getEngineValue(401, 'module.sales.crm');
  const bVal = await modules.getEngineValue(402, 'module.sales.crm');
  ok('tenant A crm stage isolated', aVal.value.default_stage === 'qualified-A');
  ok('tenant B crm stage isolated', bVal.value.default_stage === 'lead-B');
  ok('A != B', aVal.value.default_stage !== bVal.value.default_stage);

  section('Audit + versioning');
  const audit = await request(appA, 'GET', '/api/module-settings/audit?limit=20', { token: tokenA });
  ok('module audit events exist', (audit.body?.data || []).length > 0);
  ok(
    'audit includes module.* keys',
    (audit.body?.data || []).some((e) => String(e.definition_key).startsWith('module.'))
  );
  const leaveAgain = await request(appA, 'PUT', '/api/module-settings/values/hr/leave', {
    token: tokenA,
    body: { value: { max_days_per_request: 5 } }
  });
  ok(
    'version increments',
    Number(leaveAgain.body?.data?.read_after_write?.version) >= 2
  );

  section('Invite accept');
  const invite = await request(appA, 'POST', '/api/company-settings/invites', {
    token: tokenA,
    body: { email: `invitee-p4-${Date.now()}@example.com`, role: 'staff' }
  });
  ok('invite created', invite.status === 201 && invite.body?.data?.invite_token);
  const token = invite.body.data.invite_token;
  const preview = await request(appA, 'GET', `/api/company-settings/invites/preview?token=${token}`);
  ok('invite preview works without admin? wait — preview is before admin middleware', preview.status === 200);
  // preview route is before admin middleware but still needs tenant context — our app has it
  const accepted = await request(appA, 'POST', '/api/company-settings/invites/accept', {
    body: {
      token,
      password: 'StrongPass1x',
      firstName: 'Invitee',
      lastName: 'P4',
      username: `invp4${Date.now().toString().slice(-4)}`
    }
  });
  ok('invite accepted', accepted.status === 200 && accepted.body?.data?.invite?.status === 'accepted', accepted.raw?.slice?.(0, 250));
  const reuse = await request(appA, 'POST', '/api/company-settings/invites/accept', {
    body: { token, password: 'StrongPass1x', firstName: 'X', username: 'x2' }
  });
  ok('invite token single-use', reuse.status === 404 || reuse.body?.success === false);

  section('Security policy resolution (session TTL)');
  await company.saveSection(401, db, 'security', { session_ttl_hours: 6 }, null, 'test-ttl');
  const ttl = await modules.resolveSessionTtlMs(401);
  ok('session TTL resolves to 6h', ttl === 6 * 60 * 60 * 1000, `ttl=${ttl}`);

  section('Task / purchase evaluators');
  await request(appA, 'PUT', '/api/module-settings/values/tasks/projects', {
    token: tokenA,
    body: { value: { require_assignee: true } }
  });
  const taskBad = await request(appA, 'POST', '/api/module-settings/ops/evaluate-task', {
    token: tokenA,
    body: { title: 'x' }
  });
  ok('task without assignee rejected', taskBad.status === 422);
  const taskOk = await request(appA, 'POST', '/api/module-settings/ops/evaluate-task', {
    token: tokenA,
    body: { title: 'x', assignee_id: 1 }
  });
  ok('task with assignee accepted', taskOk.status === 200);

  await request(appA, 'PUT', '/api/module-settings/values/purchases/orders', {
    token: tokenA,
    body: { value: { require_po_approval: true, approval_amount_threshold: 1000 } }
  });
  const po = await request(appA, 'POST', '/api/module-settings/ops/evaluate-purchase', {
    token: tokenA,
    body: { amount: 2500 }
  });
  ok('PO needs approval above threshold', po.body?.data?.needs_approval === true);

  section('Regression Phase 1/3');
  const tables = await db.query(`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema='public'
      AND table_name IN ('setting_definitions','setting_values','setting_versions','setting_audit_events',
                         'fiscal_years','fiscal_periods','module_templates','module_numbering_counters')
  `);
  ok('engine + ops tables present', tables.rows.length >= 8, `found=${tables.rows.length}`);
  const defs = await db.query(`SELECT COUNT(*)::int AS c FROM setting_definitions WHERE key LIKE 'module.%'`);
  ok('module definitions seeded', defs.rows[0].c >= 20, `count=${defs.rows[0].c}`);

  console.log(`\n=== Summary: ${results.length - failed}/${results.length} passed, ${failed} failed ===`);
  await db.pool.end().catch(() => null);
  process.exit(failed ? 1 : 0);
}

run().catch(async (err) => {
  console.error('FATAL', err);
  await db.pool.end().catch(() => null);
  process.exit(1);
});
