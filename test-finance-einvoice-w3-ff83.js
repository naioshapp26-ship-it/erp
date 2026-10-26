'use strict';

/**
 * W3 — sales e-invoice operational cycle + authz.
 * Isolated DB only (PORT 3083 / finance_pages_isolated). No production writes.
 */
const fs = require('fs');
const http = require('http');
const bcrypt = require('bcryptjs');
const { Client } = require('pg');
const {
  actorAllows,
  assertEInvoiceAction
} = require('./finance/services/sales-einvoice-authz');

const PORT = Number(process.env.PORT || 3083);
const BASE = process.env.APP_BASE_URL || `http://127.0.0.1:${PORT}`;
const ART = '/opt/cursor/artifacts';
const ENTITY = 'HQ001';
const DATABASE_URL = process.env.DATABASE_URL
  || 'postgresql://finance_pages_test:finance_pages_test_local@127.0.0.1:5432/finance_pages_isolated';
fs.mkdirSync(ART, { recursive: true });

const results = [];
function pass(name, detail = '') {
  results.push({ name, ok: true, detail });
  console.log(`PASS  ${name}${detail ? ` — ${detail}` : ''}`);
}
function fail(name, detail = '') {
  results.push({ name, ok: false, detail });
  console.log(`FAIL  ${name}${detail ? ` — ${detail}` : ''}`);
}

function httpReq(method, urlPath, body, headers = {}) {
  const u = new URL(urlPath, BASE);
  const payload = body == null ? null : JSON.stringify(body);
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: u.hostname,
        port: u.port || 80,
        path: u.pathname + u.search,
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
          ...headers
        }
      },
      (res) => {
        let raw = '';
        res.on('data', (c) => { raw += c; });
        res.on('end', () => {
          let json = null;
          try { json = raw ? JSON.parse(raw) : null; } catch { /* */ }
          resolve({ status: res.statusCode, json, raw, headers: res.headers });
        });
      }
    );
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function login(email, password) {
  const res = await httpReq('POST', '/api/auth/login', { email, password });
  const setCookie = res.headers['set-cookie'] || [];
  const cookie = Array.isArray(setCookie) ? setCookie.map((c) => c.split(';')[0]).join('; ') : '';
  const token = res.json?.data?.session?.token || res.json?.token || '';
  return {
    ok: res.status === 200 && !!token,
    auth: {
      Authorization: `Bearer ${token}`,
      Cookie: cookie,
      'x-entity-id': ENTITY,
      'x-entity-type': 'HQ',
      'x-user-email': email
    },
    status: res.status,
    raw: res.raw
  };
}

async function ensureRoleUsers(pg) {
  const roles = [
    { email: 'viewer.einvoice@naiosh.test', name: 'مشاهد فوترة', role: 'viewer', user: 'viewer_ei', pass: 'Viewer@123' },
    { email: 'accountant.einvoice@naiosh.test', name: 'محاسب فوترة', role: 'accountant', user: 'acct_ei', pass: 'Acct@12345' },
    { email: 'warehouse.einvoice@naiosh.test', name: 'أمين مستودع', role: 'warehouse', user: 'wh_ei', pass: 'Wh@123456' }
  ];
  for (const r of roles) {
    const existing = await pg.query(`SELECT id FROM users WHERE email = $1`, [r.email]);
    let userId = existing.rows[0]?.id;
    if (!userId) {
      const ins = await pg.query(
        `INSERT INTO users (name, email, role, tenant_type, entity_id, is_active)
         VALUES ($1,$2,$3,'HQ',$4,true) RETURNING id`,
        [r.name, r.email, r.role, ENTITY]
      );
      userId = ins.rows[0].id;
    } else {
      await pg.query(`UPDATE users SET role = $2, is_active = true WHERE id = $1`, [userId, r.role]);
    }
    const hash = await bcrypt.hash(r.pass, 10);
    await pg.query(
      `INSERT INTO user_credentials (user_id, username, password_hash, is_active, failed_attempts)
       VALUES ($1,$2,$3,true,0)
       ON CONFLICT (user_id) DO UPDATE SET password_hash = EXCLUDED.password_hash, username = EXCLUDED.username, is_active = true`,
      [userId, r.user, hash]
    );
  }
  return roles;
}

async function ensureTestInvoice(pg) {
  let customerId;
  let customerName;
  const existing = await pg.query(
    `SELECT customer_id, COALESCE(customer_name_ar, customer_name_en, 'عميل') AS customer_name
     FROM finance_customers
     WHERE entity_id = 'HQ001' AND COALESCE(is_active, true) = true
     ORDER BY customer_id DESC LIMIT 1`
  );
  if (existing.rows[0]) {
    customerId = existing.rows[0].customer_id;
    customerName = existing.rows[0].customer_name;
  } else {
    const code = `EI${Date.now().toString().slice(-6)}`;
    const ins = await pg.query(
      `INSERT INTO finance_customers (customer_code, customer_name_ar, entity_id, entity_type, is_active)
       VALUES ($1,$2,'HQ001','HQ',true)
       RETURNING customer_id, customer_name_ar AS customer_name`,
      [code, `عميل إلكتروني ${Date.now()}`]
    );
    customerId = ins.rows[0].customer_id;
    customerName = ins.rows[0].customer_name;
  }
  if (!customerId) throw new Error('no customer for e-invoice test');

  const num = `INV-EI-${Date.now().toString().slice(-8)}`;
  const inv = await pg.query(
    `INSERT INTO finance_invoices
      (invoice_number, invoice_date, due_date, customer_id, customer_name, status, payment_status,
       subtotal, tax_amount, total_amount, paid_amount, remaining_amount,
       entity_id, entity_type, currency_code)
     VALUES ($1,CURRENT_DATE,CURRENT_DATE + 30,$2,$3,'ISSUED','UNPAID',100,15,115,0,115,'HQ001','HQ','SAR')
     RETURNING invoice_id, invoice_number, customer_id, customer_name, total_amount, status`,
    [num, customerId, customerName || 'عميل']
  );
  return inv.rows[0];
}

async function main() {
  const stamp = Date.now();

  // --- Unit authz ---
  const denyAnon = actorAllows({ authenticated: false }, 'enqueue');
  denyAnon.ok === false && denyAnon.status === 401
    ? pass('unit-anon-401')
    : fail('unit-anon-401', JSON.stringify(denyAnon));

  const viewerOk = assertEInvoiceAction({
    trustedTestActor: true,
    actor: { role: 'viewer', permissions: [], entityId: ENTITY }
  }, 'view');
  viewerOk.ok ? pass('unit-viewer-view') : fail('unit-viewer-view', JSON.stringify(viewerOk));

  const viewerEnqueue = assertEInvoiceAction({
    trustedTestActor: true,
    actor: { role: 'viewer', permissions: [], entityId: ENTITY }
  }, 'enqueue');
  !viewerEnqueue.ok && viewerEnqueue.status === 403
    ? pass('unit-viewer-deny-enqueue')
    : fail('unit-viewer-deny-enqueue', JSON.stringify(viewerEnqueue));

  const acctTransition = assertEInvoiceAction({
    trustedTestActor: true,
    actor: { role: 'accountant', permissions: [], entityId: ENTITY }
  }, 'transition');
  acctTransition.ok ? pass('unit-accountant-transition') : fail('unit-accountant-transition');

  const acctCancel = assertEInvoiceAction({
    trustedTestActor: true,
    actor: { role: 'accountant', permissions: [], entityId: ENTITY }
  }, 'cancel');
  !acctCancel.ok ? pass('unit-accountant-deny-cancel') : fail('unit-accountant-deny-cancel');

  const spoof = assertEInvoiceAction({
    headers: { 'x-user-role': 'Admin', 'x-finance-permissions': '*' },
    authUser: null
  }, 'enqueue');
  !spoof.ok && spoof.status === 401
    ? pass('unit-spoof-headers-ignored')
    : fail('unit-spoof-headers-ignored', JSON.stringify(spoof));

  const govSend = assertEInvoiceAction({
    trustedTestActor: true,
    actor: { role: 'admin', permissions: [], entityId: ENTITY }
  }, 'gov_send');
  govSend.ok ? pass('unit-admin-gov-send-perm') : fail('unit-admin-gov-send-perm');

  // --- Schema compatibility ---
  const pg = new Client({ connectionString: DATABASE_URL });
  await pg.connect();
  const ops = await pg.query(`
    SELECT 1 FROM information_schema.tables
    WHERE table_schema='public' AND table_name='finance_ops_records'
  `);
  ops.rows.length === 1 ? pass('compat-ops-table-present') : fail('compat-ops-table-present');

  const invTable = await pg.query(`
    SELECT 1 FROM information_schema.tables
    WHERE table_schema='public' AND table_name='finance_invoices'
  `);
  invTable.rows.length === 1 ? pass('compat-invoices-present') : fail('compat-invoices-present');

  const roles = await ensureRoleUsers(pg);
  const invoice = await ensureTestInvoice(pg);
  invoice?.invoice_id ? pass('seed-invoice', String(invoice.invoice_id)) : fail('seed-invoice');

  // Additive audit column (API ensureTables will add; verify after first call)
  await pg.end();

  // --- HTTP ---
  const noAuth = await httpReq('POST', '/finance/e-invoice/queue', {
    entity_id: ENTITY,
    invoice_id: invoice.invoice_id
  });
  noAuth.status === 401
    ? pass('http-unauth-enqueue-401')
    : fail('http-unauth-enqueue-401', `${noAuth.status} ${JSON.stringify(noAuth.json)}`);

  const admin = await login('admin@naiosh.com', 'Admin@123');
  admin.ok ? pass('login-admin') : fail('login-admin', admin.raw?.slice(0, 120));

  const viewer = await login(roles[0].email, roles[0].pass);
  viewer.ok ? pass('login-viewer') : fail('login-viewer', String(viewer.status));

  const accountant = await login(roles[1].email, roles[1].pass);
  accountant.ok ? pass('login-accountant') : fail('login-accountant', String(accountant.status));

  const warehouse = await login(roles[2].email, roles[2].pass);
  warehouse.ok ? pass('login-warehouse') : fail('login-warehouse', String(warehouse.status));

  const page = await httpReq('GET', '/finance/e-invoice-queue.html', null, admin.auth);
  page.status === 200
    && /finance-workbench\.css/.test(page.raw)
    && /\/finance\/e-invoice\/queue/.test(page.raw)
    ? pass('page-workbench-served')
    : fail('page-workbench-served', String(page.status));

  const viewerList = await httpReq('GET', `/finance/e-invoice/queue?entity_id=${ENTITY}`, null, viewer.auth);
  viewerList.status === 200 && viewerList.json?.success
    ? pass('viewer-can-list')
    : fail('viewer-can-list', `${viewerList.status}`);

  const viewerEnqueueHttp = await httpReq('POST', '/finance/e-invoice/queue', {
    entity_id: ENTITY,
    invoice_id: invoice.invoice_id,
    title: `viewer-denied-${stamp}`
  }, viewer.auth);
  viewerEnqueueHttp.status === 403
    ? pass('viewer-deny-enqueue-http')
    : fail('viewer-deny-enqueue-http', `${viewerEnqueueHttp.status} ${JSON.stringify(viewerEnqueueHttp.json)}`);

  const whEnqueue = await httpReq('POST', '/finance/e-invoice/queue', {
    entity_id: ENTITY,
    invoice_id: invoice.invoice_id
  }, warehouse.auth);
  whEnqueue.status === 403
    ? pass('warehouse-deny-enqueue-http')
    : fail('warehouse-deny-enqueue-http', `${whEnqueue.status}`);

  // Full cycle as accountant: enqueue → queue → validate → archive
  const created = await httpReq('POST', '/finance/e-invoice/queue', {
    entity_id: ENTITY,
    invoice_id: invoice.invoice_id,
    title: `W3-cycle-${stamp}`,
    notes: 'اختبار دورة W3'
  }, accountant.auth);
  created.status === 201 && created.json?.record?.status === 'READY'
    ? pass('accountant-enqueue-ready', created.json.record.record_number)
    : fail('accountant-enqueue-ready', `${created.status} ${JSON.stringify(created.json)}`);
  const recordId = created.json?.record?.record_id;

  const dup = await httpReq('POST', '/finance/e-invoice/queue', {
    entity_id: ENTITY,
    invoice_id: invoice.invoice_id
  }, accountant.auth);
  dup.status === 409 && dup.json?.code === 'ALREADY_QUEUED'
    ? pass('reject-duplicate-enqueue')
    : fail('reject-duplicate-enqueue', `${dup.status} ${JSON.stringify(dup.json)}`);

  const getOne = await httpReq('GET', `/finance/e-invoice/queue/${recordId}?entity_id=${ENTITY}`, null, accountant.auth);
  getOne.status === 200 && getOne.json?.record?.invoice_id === invoice.invoice_id
    ? pass('retrieve-record')
    : fail('retrieve-record', `${getOne.status}`);

  const update = await httpReq('PUT', `/finance/e-invoice/queue/${recordId}`, {
    entity_id: ENTITY,
    title: `W3-updated-${stamp}`,
    notes: 'ملاحظة محدّثة'
  }, accountant.auth);
  update.status === 200 && update.json?.record?.title === `W3-updated-${stamp}`
    ? pass('update-ready-notes')
    : fail('update-ready-notes', `${update.status} ${JSON.stringify(update.json)}`);

  const toQueued = await httpReq('POST', `/finance/e-invoice/queue/${recordId}/transition`, {
    entity_id: ENTITY,
    status: 'QUEUED'
  }, accountant.auth);
  toQueued.status === 200 && toQueued.json?.record?.status === 'QUEUED'
    ? pass('transition-queued')
    : fail('transition-queued', `${toQueued.status} ${JSON.stringify(toQueued.json)}`);

  const badJump = await httpReq('POST', `/finance/e-invoice/queue/${recordId}/transition`, {
    entity_id: ENTITY,
    status: 'ARCHIVED'
  }, accountant.auth);
  badJump.status === 409 && badJump.json?.code === 'INVALID_TRANSITION'
    ? pass('reject-invalid-transition')
    : fail('reject-invalid-transition', `${badJump.status}`);

  const toValidated = await httpReq('POST', `/finance/e-invoice/queue/${recordId}/transition`, {
    entity_id: ENTITY,
    status: 'VALIDATED'
  }, accountant.auth);
  toValidated.status === 200 && toValidated.json?.record?.status === 'VALIDATED'
    ? pass('transition-validated')
    : fail('transition-validated', `${toValidated.status} ${JSON.stringify(toValidated.json)}`);

  const viewerArchive = await httpReq('POST', `/finance/e-invoice/queue/${recordId}/transition`, {
    entity_id: ENTITY,
    status: 'ARCHIVED'
  }, viewer.auth);
  viewerArchive.status === 403
    ? pass('viewer-deny-archive-http')
    : fail('viewer-deny-archive-http', `${viewerArchive.status}`);

  const toArchived = await httpReq('POST', `/finance/e-invoice/queue/${recordId}/transition`, {
    entity_id: ENTITY,
    status: 'ARCHIVED'
  }, accountant.auth);
  toArchived.status === 200 && toArchived.json?.record?.status === 'ARCHIVED'
    ? pass('transition-archived')
    : fail('transition-archived', `${toArchived.status}`);

  const audit = toArchived.json?.record?.audit_log;
  const auditArr = Array.isArray(audit) ? audit : [];
  auditArr.length >= 3
    ? pass('audit-log-populated', String(auditArr.length))
    : fail('audit-log-populated', JSON.stringify(auditArr));

  // Second invoice: cancel path + gov-send denied
  const pg2 = new Client({ connectionString: DATABASE_URL });
  await pg2.connect();
  const invoice2 = await ensureTestInvoice(pg2);

  // verify additive audit_log column exists after API ensureTables
  const auditCol = await pg2.query(`
    SELECT 1 FROM information_schema.columns
    WHERE table_name='finance_ops_records' AND column_name='audit_log'
  `);
  auditCol.rows.length === 1 ? pass('compat-audit-column-additive') : fail('compat-audit-column-additive');
  await pg2.end();

  const created2 = await httpReq('POST', '/finance/e-invoice/queue', {
    entity_id: ENTITY,
    invoice_id: invoice2.invoice_id,
    title: `W3-cancel-${stamp}`
  }, admin.auth);
  const id2 = created2.json?.record?.record_id;
  created2.status === 201 ? pass('admin-enqueue-2') : fail('admin-enqueue-2', `${created2.status}`);

  const cancelNoReason = await httpReq('POST', `/finance/e-invoice/queue/${id2}/cancel`, {
    entity_id: ENTITY
  }, admin.auth);
  cancelNoReason.status === 400 && cancelNoReason.json?.code === 'REASON_REQUIRED'
    ? pass('cancel-requires-reason')
    : fail('cancel-requires-reason', `${cancelNoReason.status} ${JSON.stringify(cancelNoReason.json)}`);

  const cancelled = await httpReq('POST', `/finance/e-invoice/queue/${id2}/cancel`, {
    entity_id: ENTITY,
    reason: 'إلغاء اختبار W3'
  }, admin.auth);
  cancelled.status === 200 && cancelled.json?.record?.status === 'CANCELLED'
    ? pass('cancel-with-reason')
    : fail('cancel-with-reason', `${cancelled.status} ${JSON.stringify(cancelled.json)}`);

  const gov = await httpReq('POST', `/finance/e-invoice/queue/${recordId}/gov-send`, {
    entity_id: ENTITY
  }, admin.auth);
  gov.status === 409 && gov.json?.code === 'CONNECTOR_ABSENT'
    ? pass('gov-send-connector-absent')
    : fail('gov-send-connector-absent', `${gov.status} ${JSON.stringify(gov.json)}`);

  const eligible = await httpReq('GET', `/finance/e-invoice/eligible-invoices?entity_id=${ENTITY}`, null, accountant.auth);
  eligible.status === 200 && Array.isArray(eligible.json?.invoices)
    ? pass('eligible-invoices-list')
    : fail('eligible-invoices-list', `${eligible.status}`);

  const passed = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok).length;
  const out = {
    generated_at: new Date().toISOString(),
    wave: 'W3-sales-gov',
    page: 'sales.e-invoice',
    pass: failed === 0,
    passed,
    failed,
    total: results.length,
    results
  };
  fs.writeFileSync(`${ART}/finance-einvoice-w3-test-results.json`, JSON.stringify(out, null, 2));
  console.log(`\nW3 e-invoice: ${passed}/${results.length} PASS (${failed} FAIL)`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  fs.writeFileSync(`${ART}/finance-einvoice-w3-test-results.json`, JSON.stringify({
    pass: false,
    error: String(err && err.stack || err)
  }, null, 2));
  process.exit(1);
});
