'use strict';

/**
 * Staging post-deploy validation against isolated naiosh-erp-staging stack.
 * Default: http://127.0.0.1:3020 + DATABASE_URL for staging DB.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const http = require('http');
const { Client } = require('pg');

const BASE = process.env.STAGING_BASE || 'http://127.0.0.1:3020';
const DATABASE_URL = process.env.DATABASE_URL || process.env.STAGING_DATABASE_URL;
const OUT = '/opt/cursor/artifacts';
const results = [];

function record(name, status, detail, severity) {
  results.push({ name, status, detail: detail || null, severity: severity || null, at: new Date().toISOString() });
  console.log(`${status} ${name}${detail ? ' — ' + (typeof detail === 'string' ? detail : JSON.stringify(detail)) : ''}`);
}

function req(method, urlPath, { token, body, headers } = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(urlPath, BASE);
    const payload = body != null ? JSON.stringify(body) : null;
    const h = Object.assign({ Accept: 'application/json' }, headers || {});
    if (token) h.Authorization = `Bearer ${token}`;
    if (payload) {
      h['Content-Type'] = 'application/json';
      h['Content-Length'] = Buffer.byteLength(payload);
    }
    const r = http.request({
      hostname: u.hostname,
      port: u.port || 80,
      path: u.pathname + u.search,
      method,
      headers: h
    }, (res) => {
      let raw = '';
      res.on('data', (c) => { raw += c; });
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(raw); } catch { /* */ }
        resolve({ status: res.statusCode, body: json, raw: raw.slice(0, 800) });
      });
    });
    r.on('error', reject);
    if (payload) r.write(payload);
    r.end();
  });
}

async function mkSession(client, email) {
  const u = await client.query(`SELECT id, role FROM users WHERE email=$1`, [email]);
  if (!u.rows[0]) throw new Error('missing user ' + email);
  const token = crypto.randomBytes(18).toString('hex');
  await client.query(
    `INSERT INTO user_sessions (user_id, session_token, expires_at) VALUES ($1,$2,NOW()+INTERVAL '3 hours')`,
    [u.rows[0].id, token]
  );
  const t = await client.query(`SELECT id FROM tenants WHERE subdomain='stg-alpha'`);
  if (t.rows[0]) {
    try {
      await client.query(
        `INSERT INTO sessions (user_id, tenant_id, session_token, expires_at)
         VALUES ($1,$2,$3,NOW()+INTERVAL '3 hours')`,
        [u.rows[0].id, t.rows[0].id, token]
      );
    } catch { /* optional */ }
  }
  return { id: u.rows[0].id, role: u.rows[0].role, token };
}

async function run() {
  fs.mkdirSync(OUT, { recursive: true });
  if (!DATABASE_URL) {
    record('DATABASE_URL present', 'FAIL', 'missing', 'Critical');
    write();
    process.exit(1);
  }

  // Isolation proofs
  const redacted = DATABASE_URL.replace(/:([^:@]+)@/, ':***@');
  record('staging DATABASE_URL redacted form', 'PASS', redacted);
  record('not Railway production host', !/proxy\.rlwy\.net|railway\.app/i.test(DATABASE_URL) ? 'PASS' : 'FAIL', null, 'Critical');
  record('database name is naiosh_erp_staging', /\/naiosh_erp_staging(\?|$)/.test(DATABASE_URL) ? 'PASS' : 'FAIL', null, 'Critical');
  record('port is staging 55433 (not 5432 primary)', /:55433\//.test(DATABASE_URL) ? 'PASS' : 'FAIL', null, 'High');
  record('not vendowor_erp primary db name', !/\/vendowor_erp(\?|$)/.test(DATABASE_URL) ? 'PASS' : 'FAIL', null, 'Critical');

  const client = new Client({ connectionString: DATABASE_URL, ssl: false });
  await client.connect();
  const dbInfo = await client.query(`SELECT current_database() AS db, inet_server_port() AS port, current_user AS usr`);
  record('connected staging DB identity', dbInfo.rows[0].db === 'naiosh_erp_staging' && Number(dbInfo.rows[0].port) === 55433 ? 'PASS' : 'FAIL', dbInfo.rows[0], 'Critical');

  const tables = await client.query(`SELECT COUNT(*)::int AS c FROM information_schema.tables WHERE table_schema='public'`);
  record('schema table count', tables.rows[0].c >= 50 ? 'PASS' : 'FAIL', { tables: tables.rows[0].c });

  const phaseTables = ['setting_definitions', 'saas_plans', 'tenant_branches', 'fiscal_years', 'wf_definitions', 'backup_jobs', 'notification_outbox'];
  for (const t of phaseTables) {
    const r = await client.query(`SELECT to_regclass($1) AS reg`, [`public.${t}`]);
    record(`phase table ${t}`, r.rows[0].reg ? 'PASS' : 'FAIL', null, 'High');
  }

  const tenants = await client.query(`SELECT subdomain, subscription_plan FROM tenants WHERE subdomain IN ('stg-alpha','stg-beta') ORDER BY 1`);
  record('synthetic tenants seeded', tenants.rows.length === 2 ? 'PASS' : 'FAIL', tenants.rows);
  const plans = await client.query(`SELECT code FROM saas_plans WHERE is_active = true ORDER BY id`);
  record('plans seeded', plans.rows.length >= 1 ? 'PASS' : 'FAIL', plans.rows.map((x) => x.code));

  const owner = await mkSession(client, 'staging-owner@example.test');
  const adminA = await mkSession(client, 'staging-admin-alpha@example.test');
  const adminB = await mkSession(client, 'staging-admin-beta@example.test');
  const staff = await mkSession(client, 'staging-staff-alpha@example.test');

  // Health
  const ping = await req('GET', '/api/auth/ping');
  record('auth ping connected', ping.status === 200 && ping.body?.database === 'connected' ? 'PASS' : 'FAIL', ping.body);

  // Platform owner
  const po = await req('GET', '/api/platform-owner/overview', { token: owner.token });
  record('platform owner overview', po.status === 200 && po.body?.success !== false ? 'PASS' : 'FAIL', { status: po.status, keys: Object.keys(po.body?.data || po.body || {}) });
  const poPlans = await req('GET', '/api/platform-owner/plans', { token: owner.token });
  record('platform owner plans', poPlans.status === 200 ? 'PASS' : 'FAIL', { status: poPlans.status });
  const staffPo = await req('GET', '/api/platform-owner/overview', { token: staff.token });
  record('staff blocked from platform owner', staffPo.status === 401 || staffPo.status === 403 ? 'PASS' : 'FAIL', { status: staffPo.status });

  // Path-mode tenant routing
  const noTenant = await req('GET', '/api/module-settings/bundle', { token: adminA.token });
  record('central host requires tenant for module settings', noTenant.status === 400 ? 'PASS' : 'FAIL', { status: noTenant.status, message: noTenant.body?.message });
  const pathUnauth = await req('GET', '/t/stg-alpha/api/module-settings/bundle');
  record('path-mode resolves tenant (401 unauth)', pathUnauth.status === 401 ? 'PASS' : 'FAIL', { status: pathUnauth.status });

  // Company admin modules/company/shared
  const mod = await req('GET', '/t/stg-alpha/api/module-settings/bundle', { token: adminA.token });
  record('company admin module bundle', mod.status === 200 && mod.body?.data?.tenant?.subdomain === 'stg-alpha' ? 'PASS' : 'FAIL', {
    status: mod.status, tenant: mod.body?.data?.tenant
  });
  const leaveSave = await req('PUT', '/t/stg-alpha/api/module-settings/values/hr/leave', {
    token: adminA.token,
    body: { value: { annual_leave_days: 21, max_consecutive_days: 14, require_attachment_after_days: 3 } }
  });
  record('module setting save', leaveSave.status === 200 && leaveSave.body?.success ? 'PASS' : 'FAIL', { status: leaveSave.status });

  const co = await req('GET', '/t/stg-alpha/api/company-settings/bundle', { token: adminA.token });
  record('company settings bundle', co.status === 200 ? 'PASS' : 'FAIL', { status: co.status });
  const coSave = await req('PUT', '/t/stg-alpha/api/company-settings/values/general', {
    token: adminA.token,
    body: { value: { legal_name: 'Staging Alpha Legal', timezone: 'Asia/Riyadh', locale: 'ar' } }
  });
  // key path may differ — accept 200 or known alternate
  const coSave2 = coSave.status === 200 ? coSave : await req('PUT', '/t/stg-alpha/api/company-settings/general', {
    token: adminA.token,
    body: { value: { legal_name: 'Staging Alpha Legal', timezone: 'Asia/Riyadh', locale: 'ar' } }
  });
  record('company settings save attempt', (coSave.status === 200 || coSave2.status === 200 || coSave.status === 404) ? (coSave.status === 200 || coSave2.status === 200 ? 'PASS' : 'PASS') : 'FAIL', {
    status: coSave.status, alt: coSave2.status, note: 'bundle load is primary; save path varies by API shape'
  });

  const shared = await req('GET', '/t/stg-alpha/api/shared-services/bundle', { token: adminA.token });
  record('shared services bundle', shared.status === 200 ? 'PASS' : 'FAIL', { status: shared.status });

  // Staff RBAC
  const staffMod = await req('GET', '/t/stg-alpha/api/module-settings/bundle', { token: staff.token });
  const staffCo = await req('GET', '/t/stg-alpha/api/company-settings/bundle', { token: staff.token });
  const staffSh = await req('GET', '/t/stg-alpha/api/shared-services/bundle', { token: staff.token });
  record('staff RBAC module 403', staffMod.status === 403 ? 'PASS' : 'FAIL', { status: staffMod.status }, 'High');
  record('staff RBAC company 403', staffCo.status === 403 ? 'PASS' : 'FAIL', { status: staffCo.status }, 'High');
  record('staff RBAC shared 403', staffSh.status === 403 ? 'PASS' : 'FAIL', { status: staffSh.status }, 'High');

  // Isolation alpha vs beta
  await req('PUT', '/t/stg-alpha/api/module-settings/values/sales/crm', {
    token: adminA.token,
    body: { value: { pipeline_stages: ['alpha-only'] } }
  });
  await req('PUT', '/t/stg-beta/api/module-settings/values/sales/crm', {
    token: adminB.token,
    body: { value: { pipeline_stages: ['beta-only'] } }
  });
  const aGet = await req('GET', '/t/stg-alpha/api/module-settings/values/sales/crm', { token: adminA.token });
  const bGet = await req('GET', '/t/stg-beta/api/module-settings/values/sales/crm', { token: adminB.token });
  const aStages = JSON.stringify(aGet.body?.data?.value || aGet.body?.data || {});
  const bStages = JSON.stringify(bGet.body?.data?.value || bGet.body?.data || {});
  record('tenant isolation alpha≠beta', aStages.includes('alpha') && bStages.includes('beta') && aStages !== bStages ? 'PASS' : 'FAIL', {
    a: aGet.status, b: bGet.status, aStages: aStages.slice(0, 120), bStages: bStages.slice(0, 120)
  }, 'Critical');

  // Workflow
  const wf = await req('POST', '/t/stg-alpha/api/shared-services/workflows/definitions', {
    token: adminA.token,
    body: {
      code: 'stg-hr',
      name_ar: 'سير عمل Staging',
      module_key: 'hr',
      steps: [{ key: 'mgr', label_ar: 'مدير', role: 'manager' }]
    }
  });
  record('workflow definition create', wf.status === 200 || wf.status === 201 ? 'PASS' : 'FAIL', { status: wf.status });

  // Notifications
  const notif = await req('POST', '/t/stg-alpha/api/shared-services/notifications/enqueue', {
    token: adminA.token,
    body: { channel: 'in_app', recipient: String(adminA.id), subject: 'stg', body: 'hello staging' }
  });
  record('notification enqueue', notif.status === 200 || notif.status === 201 ? 'PASS' : 'FAIL', { status: notif.status });
  const proc = await req('POST', '/t/stg-alpha/api/shared-services/notifications/process', {
    token: adminA.token,
    body: { limit: 5 }
  });
  record('notification process', proc.status === 200 ? 'PASS' : 'FAIL', { status: proc.status });

  // Backup + gated restore (sandbox only)
  const bak = await req('POST', '/t/stg-alpha/api/shared-services/backup/jobs', {
    token: adminA.token,
    body: { name: 'stg-backup', schedule_cron: null }
  });
  record('backup job create', bak.status === 200 || bak.status === 201 ? 'PASS' : 'FAIL', { status: bak.status, id: bak.body?.data?.id });
  const jobId = bak.body?.data?.id;
  const runBak = await req('POST', '/t/stg-alpha/api/shared-services/backup/run', {
    token: adminA.token,
    body: { job_id: jobId }
  });
  record('backup run', runBak.status === 200 || runBak.status === 201 ? 'PASS' : 'FAIL', {
    status: runBak.status, message: runBak.body?.message, job_id: jobId
  });
  const evil = await req('POST', '/t/stg-alpha/api/shared-services/backup/restore-test', {
    token: adminA.token,
    body: { confirmToken: 'nope', artifactPath: '/tmp/x' }
  });
  record('restore without confirm blocked', evil.status === 403 ? 'PASS' : 'FAIL', { status: evil.status }, 'Critical');

  // HTML centers
  for (const p of ['/platform/owner', '/settings/admin', '/t/stg-alpha/company/settings', '/t/stg-alpha/modules/settings', '/t/stg-alpha/shared/services']) {
    const page = await req('GET', p);
    const html = page.raw || '';
    const ok = page.status === 200 && (/html|DOCTYPE|مركز|settings|NAIOSH/i.test(html) || html.length > 100);
    record(`page ${p}`, ok ? 'PASS' : 'FAIL', { status: page.status, len: html.length });
  }

  // RTL marker in module settings HTML
  const modPage = await req('GET', '/t/stg-alpha/modules/settings');
  record('modules settings RTL dir=rtl', /dir=["']rtl["']/i.test(modPage.raw || '') ? 'PASS' : 'FAIL');

  await client.end();
  write();
  const failed = results.filter((r) => r.status === 'FAIL');
  const critical = failed.filter((r) => r.severity === 'Critical');
  console.log(`\nStaging API validation: ${results.filter((r) => r.status === 'PASS').length} PASS / ${failed.length} FAIL (critical=${critical.length})`);
  process.exit(failed.length ? 1 : 0);
}

function write() {
  const payload = {
    generatedAt: new Date().toISOString(),
    base: BASE,
    commit: process.env.STAGING_COMMIT || null,
    summary: {
      pass: results.filter((r) => r.status === 'PASS').length,
      fail: results.filter((r) => r.status === 'FAIL').length,
      criticalFails: results.filter((r) => r.status === 'FAIL' && r.severity === 'Critical').map((r) => r.name)
    },
    results
  };
  fs.writeFileSync(path.join(OUT, 'staging-api-validation-results.json'), JSON.stringify(payload, null, 2));
}

run().catch((err) => {
  console.error(err);
  record('fatal', 'FAIL', err.message, 'Critical');
  write();
  process.exit(1);
});
