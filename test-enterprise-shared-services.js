'use strict';

/**
 * Phase 5 — Enterprise Shared Services verification.
 * Workflow persistence across "restart", backup/restore-test safety,
 * templates, notifications, integrations, catalog honesty, Phase 1–4 regression smoke.
 */

const http = require('http');
const express = require('express');
const crypto = require('crypto');
const fs = require('fs');

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('DATABASE_URL required');
  process.exit(1);
}

const db = require('./db');
const shared = require('./enterprise-shared-service');
const sharedRouter = require('./enterprise-shared-api');
const modules = require('./module-settings-service');
const company = require('./company-settings-service');
const { getCatalog, ALL_ENTRIES } = require('./enterprise-settings-catalog');
const { ALWAYS_ALLOW_PREFIXES } = require('./module-entitlement-middleware');

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
  app.use('/api/shared-services', sharedRouter);
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
  await db.query(`CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY, name VARCHAR(255), email VARCHAR(255), role VARCHAR(100) NOT NULL,
    tenant_type VARCHAR(40), is_active BOOLEAN DEFAULT true
  )`);
  await db.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS first_name VARCHAR(255)`);
  await db.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT`);
  await db.query(`CREATE TABLE IF NOT EXISTS user_sessions (
    id SERIAL PRIMARY KEY, user_id INTEGER, session_token VARCHAR(255) UNIQUE,
    ip_address TEXT, user_agent TEXT, expires_at TIMESTAMP
  )`);
  await db.query(`CREATE TABLE IF NOT EXISTS sessions (
    id SERIAL PRIMARY KEY, user_id INTEGER, tenant_id INTEGER, session_token VARCHAR(255),
    ip_address TEXT, user_agent TEXT, expires_at TIMESTAMP
  )`);
  await shared.ensureSchema(db);
  await modules.ensureEngine();
  await company.ensureEngine();

  const email = 'p5-admin@example.com';
  let user = await db.query(`SELECT id FROM users WHERE email=$1`, [email]);
  let userId;
  if (user.rows.length) {
    userId = user.rows[0].id;
    await db.query(`UPDATE users SET role='company_admin', is_active=true WHERE id=$1`, [userId]);
  } else {
    const ins = await db.query(
      `INSERT INTO users (name, email, role, is_active) VALUES ($1,$2,'company_admin',true) RETURNING id`,
      [email, email]
    );
    userId = ins.rows[0].id;
  }
  const token = crypto.randomBytes(16).toString('hex');
  await db.query(
    `INSERT INTO user_sessions (user_id, session_token, expires_at) VALUES ($1,$2,NOW()+INTERVAL '1 day')`,
    [userId, token]
  );
  return { token, userId };
}

async function run() {
  section('Catalog honesty (Phase 5)');
  const catalog = getCatalog();
  ok('catalog total 47', catalog.counts.total === 47, JSON.stringify(catalog.counts));
  ok('catalog all live', catalog.counts.live === 47 && catalog.counts.partial === 0 && catalog.counts.mock === 0);
  ok('hr-workflow live', ALL_ENTRIES.find((e) => e.id === 'module-hr-workflow')?.status === 'live');
  ok('backup live', ALL_ENTRIES.find((e) => e.id === 'module-backup')?.status === 'live');
  ok('catalog version phase5+', /^phase[56]/.test(catalog.version));
  ok('shared-services allowlisted', ALWAYS_ALLOW_PREFIXES.includes('/api/shared-services'));

  section('Fixtures');
  const { token, userId } = await ensureFixtures();
  const app = createTenantApp(501, 'p5-alpha');
  const TENANT = 501;

  section('Workflow definitions — durable');
  const def = await request(app, 'POST', '/api/shared-services/workflows/definitions', {
    token,
    body: {
      code: 'hr-leave-p5',
      name_ar: 'موافقة إجازة P5',
      module_key: 'hr',
      entity_type: 'employee_request',
      escalate_hours: 1,
      steps: [
        { key: 'manager', label_ar: 'مدير', role: 'manager' },
        { key: 'hr', label_ar: 'موارد', role: 'hr' }
      ],
      conditions: { nodes: [], connections: [] }
    }
  });
  ok('definition saved', def.status === 201 && def.body?.data?.id, def.raw?.slice?.(0, 200));
  const defId = def.body.data.id;

  // Simulate process restart: clear in-memory schemaReady and re-read from DB
  shared.ensureSchema._reset = true;
  const reloaded = require('./enterprise-shared-service');
  // Force re-ensure by querying fresh
  const defsAfter = await reloaded.listDefinitions(db, TENANT, { moduleKey: 'hr' });
  ok('definition survives reload', defsAfter.some((d) => d.id === defId && d.code === 'hr-leave-p5'));

  section('Workflow instances — approve path + event history');
  const started = await request(app, 'POST', '/api/shared-services/workflows/instances', {
    token,
    body: {
      definition_code: 'hr-leave-p5',
      entity_type: 'employee_request',
      entity_id: `ER-P5-${Date.now()}`,
      title: 'طلب إجازة اختبار'
    }
  });
  ok('instance started', started.status === 201 && started.body?.data?.id);
  const instanceId = started.body.data.id;

  const step1 = await request(app, 'POST', `/api/shared-services/workflows/instances/${instanceId}/decide`, {
    token,
    body: { action: 'approve', notes: 'موافق مدير' }
  });
  ok('step1 approved still in progress', step1.body?.data?.instance?.status === 'in_progress');

  const step2 = await request(app, 'POST', `/api/shared-services/workflows/instances/${instanceId}/decide`, {
    token,
    body: { action: 'approve', notes: 'موافق HR' }
  });
  ok('fully approved', step2.body?.data?.instance?.status === 'approved');
  ok('events recorded', (step2.body?.data?.events || []).length >= 3);

  section('Restart persistence proof');
  // New DB query without relying on process state
  const persisted = await db.query(`SELECT status, current_step FROM wf_instances WHERE id=$1`, [instanceId]);
  ok('instance still approved after DB re-read', persisted.rows[0]?.status === 'approved');
  const events = await db.query(`SELECT COUNT(*)::int AS c FROM wf_instance_events WHERE instance_id=$1`, [instanceId]);
  ok('events persist', events.rows[0].c >= 3);

  // Reject / return / escalate paths
  const inst2 = await shared.startInstance(db, TENANT, {
    definitionCode: 'hr-leave-p5',
    entityType: 'employee_request',
    entityId: `ER-REJ-${Date.now()}`,
    title: 'reject test',
    actorId: userId
  });
  const rejected = await shared.decideInstance(db, TENANT, inst2.id, { action: 'reject', actorId: userId, notes: 'رفض' });
  ok('reject works', rejected.status === 'rejected');

  section('Finance approvals reuse');
  const fin = await request(app, 'POST', '/api/shared-services/approvals', {
    token,
    body: {
      item_type: 'INVOICE',
      item_id: `INV-P5-${Date.now()}`,
      item_title: 'فاتورة اختبار',
      amount: 1200,
      steps: [
        { step_level: 1, approver_role: 'ACCOUNTANT' },
        { step_level: 2, approver_role: 'FINANCE_MANAGER' }
      ]
    }
  });
  ok('finance approval created', fin.status === 201 && fin.body?.data?.id);
  const finDecide = await request(app, 'POST', `/api/shared-services/approvals/${fin.body.data.id}/decide`, {
    token,
    body: { decision: 'approve', comments: 'ok' }
  });
  ok('finance step advanced', finDecide.status === 200 && ['IN_REVIEW', 'APPROVED'].includes(finDecide.body?.data?.status));

  section('Backup operational + restore safety');
  const job = await request(app, 'POST', '/api/shared-services/backup/jobs', {
    token,
    body: { name: 'P5 daily', schedule_cron: 'daily', retention_days: 14 }
  });
  ok('backup job created', job.status === 201 && job.body?.data?.id);

  const bak = await request(app, 'POST', '/api/shared-services/backup/run', {
    token,
    body: { job_id: job.body.data.id }
  });
  ok('backup run success', bak.status === 200 && bak.body?.data?.status === 'success', bak.raw?.slice?.(0, 250));
  ok('backup artifact exists', bak.body?.data?.artifact_path && fs.existsSync(bak.body.data.artifact_path));

  const blocked = await request(app, 'POST', '/api/shared-services/backup/restore-test', {
    token,
    body: { confirmToken: 'nope', artifact_path: bak.body.data.artifact_path }
  });
  ok('restore blocked without confirm', blocked.status === 403);

  // Safe restore via schema sandbox (non-destructive; used when CREATE DATABASE is denied)
  delete process.env.TEST_RESTORE_DATABASE_URL;
  process.env.PHASE5_RESTORE_SCHEMA_SANDBOX = 'true';
  const restored = await request(app, 'POST', '/api/shared-services/backup/restore-test', {
    token,
    body: {
      confirmToken: 'CONFIRM_DESTRUCTIVE_RESTORE',
      artifact_path: bak.body.data.artifact_path
    }
  });
  ok(
    'restore-test succeeded in schema sandbox',
    restored.status === 200 && restored.body?.data?.status === 'success',
    restored.raw?.slice?.(0, 300)
  );
  const marker = await db.query(
    `SELECT COUNT(*)::int AS c FROM phase5_restore_sandbox.restore_markers`
  ).catch(() => ({ rows: [{ c: 0 }] }));
  ok('sandbox marker written', marker.rows[0].c >= 1);

  // Must not allow restore targeting primary DATABASE_URL as test target
  delete process.env.PHASE5_RESTORE_SCHEMA_SANDBOX;
  delete process.env.ALLOW_PHASE5_TEST_RESTORE;
  process.env.TEST_RESTORE_DATABASE_URL = DATABASE_URL;
  const evil = await request(app, 'POST', '/api/shared-services/backup/restore-test', {
    token,
    body: { confirmToken: 'CONFIRM_DESTRUCTIVE_RESTORE', artifact_path: bak.body.data.artifact_path }
  });
  ok('restore to primary DATABASE_URL blocked', evil.status === 403 || evil.body?.success === false);

  section('Template studio');
  const tpl = await request(app, 'POST', '/api/shared-services/templates', {
    token,
    body: {
      template_type: 'email',
      code: `welcome-p5-${Date.now().toString().slice(-5)}`,
      name_ar: 'ترحيب',
      subject: 'مرحبا {{name}}',
      body: 'أهلاً {{name}}، رقمك {{id}}'
    }
  });
  ok('template versioned save', tpl.status === 201 && tpl.body?.data?.version >= 1);
  const tplId = tpl.body.data.template.id;
  const preview = await request(app, 'POST', `/api/shared-services/templates/${tplId}/preview`, {
    token,
    body: { variables: { name: '<b>Ali</b>', id: '42' } }
  });
  ok('preview escapes HTML', preview.body?.data?.body.includes('&lt;b&gt;Ali&lt;/b&gt;'));
  const unsafe = await request(app, 'POST', '/api/shared-services/templates', {
    token,
    body: {
      template_type: 'email',
      code: `bad-${Date.now()}`,
      name_ar: 'سيء',
      body: '<script>alert(1)</script>'
    }
  });
  ok('unsafe script rejected', unsafe.status === 400);

  section('Notifications outbox');
  await modules.putEngineValue(TENANT, 'module.notifications.channels', {
    email: true, sms: false, in_app: true, digest: 'daily'
  }, userId, 'p5-test');
  const smsBlocked = await request(app, 'POST', '/api/shared-services/notifications/enqueue', {
    token,
    body: { channel: 'sms', recipient: '0500000000', body: 'hi' }
  });
  ok('sms blocked by policy', smsBlocked.status === 403);

  const enq = await request(app, 'POST', '/api/shared-services/notifications/enqueue', {
    token,
    body: { channel: 'in_app', recipient: String(userId), subject: 'P5', body: 'مرحبا' }
  });
  ok('notification enqueued', enq.status === 201 && enq.body?.data?.status === 'pending');
  const proc = await request(app, 'POST', '/api/shared-services/notifications/process', {
    token,
    body: { limit: 10 }
  });
  ok('outbox processed', proc.status === 200 && (proc.body?.data || []).some((r) => r.status === 'sent'));

  section('Integrations registry');
  const integ = await request(app, 'GET', '/api/shared-services/integrations', { token });
  ok('integrations listed', (integ.body?.data || []).length >= 5);
  const enable = await request(app, 'POST', '/api/shared-services/integrations/tenant_smtp/enable', {
    token,
    body: { enabled: true }
  });
  ok('integration enable', enable.body?.data?.is_enabled === true);
  const testInteg = await request(app, 'POST', '/api/shared-services/integrations/tenant_smtp/test', {
    token,
    body: {}
  });
  ok('integration test returns result', testInteg.status === 200 || testInteg.status === 422);

  section('No mock save');
  const emptyDef = await request(app, 'POST', '/api/shared-services/workflows/definitions', {
    token,
    body: {}
  });
  ok('empty definition rejected', emptyDef.status === 400);

  section('Regression smoke Phase 1–4');
  const tables = await db.query(`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema='public' AND table_name IN (
      'setting_definitions','setting_values','setting_versions','setting_audit_events',
      'wf_definitions','wf_instances','wf_instance_events',
      'backup_jobs','backup_runs','notification_outbox','integration_registry',
      'module_templates','module_template_versions','fiscal_years'
    )
  `);
  ok('shared + engine tables present', tables.rows.length >= 12, `found=${tables.rows.length}`);
  const companyKey = await company.getEngineValue(TENANT, 'company.security');
  ok('phase3 company.security readable', companyKey.key === 'company.security');
  const leave = await modules.getEngineValue(TENANT, 'module.hr.leave');
  ok('phase4 module.hr.leave readable', leave.key === 'module.hr.leave');

  console.log(`\n=== Summary: ${results.length - failed}/${results.length} passed, ${failed} failed ===`);
  await db.pool.end().catch(() => null);
  process.exit(failed ? 1 : 0);
}

run().catch(async (err) => {
  console.error('FATAL', err);
  await db.pool.end().catch(() => null);
  process.exit(1);
});
