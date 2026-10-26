'use strict';

/**
 * Wave 2: purchases authz + vendor quotes + purchase vendors + receiving.
 * Isolated DB only (PORT 3083 / finance_pages_isolated).
 */
const fs = require('fs');
const http = require('http');
const bcrypt = require('bcryptjs');
const { Client } = require('pg');
const { assertPurchasesAction, actorAllows } = require('./finance/services/purchases-authz');

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
    const req = http.request({
      hostname: u.hostname,
      port: u.port || 80,
      path: u.pathname + u.search,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
        ...headers
      }
    }, (res) => {
      let raw = '';
      res.on('data', (c) => { raw += c; });
      res.on('end', () => {
        let json = null;
        try { json = raw ? JSON.parse(raw) : null; } catch { /* */ }
        resolve({ status: res.statusCode, json, raw, headers: res.headers });
      });
    });
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
    { email: 'viewer.purchases@naiosh.test', name: 'مشاهد مشتريات', role: 'viewer', user: 'viewer_po', pass: 'Viewer@123' },
    { email: 'accountant.purchases@naiosh.test', name: 'محاسب مشتريات', role: 'accountant', user: 'acct_po', pass: 'Acct@12345' },
    { email: 'warehouse.purchases@naiosh.test', name: 'أمين مستودع', role: 'warehouse', user: 'wh_po', pass: 'Wh@123456' }
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

async function main() {
  const stamp = Date.now();

  // --- Unit authz ---
  const denyAnon = actorAllows({ authenticated: false }, 'approve');
  denyAnon.ok === false && denyAnon.status === 401
    ? pass('unit-anon-401')
    : fail('unit-anon-401', JSON.stringify(denyAnon));

  const viewerOk = assertPurchasesAction({
    trustedTestActor: true,
    actor: { role: 'viewer', permissions: [], entityId: ENTITY }
  }, 'view');
  viewerOk.ok ? pass('unit-viewer-view') : fail('unit-viewer-view', JSON.stringify(viewerOk));

  const viewerApprove = assertPurchasesAction({
    trustedTestActor: true,
    actor: { role: 'viewer', permissions: [], entityId: ENTITY }
  }, 'approve');
  !viewerApprove.ok && viewerApprove.status === 403
    ? pass('unit-viewer-deny-approve')
    : fail('unit-viewer-deny-approve', JSON.stringify(viewerApprove));

  const acctPay = assertPurchasesAction({
    trustedTestActor: true,
    actor: { role: 'accountant', permissions: [], entityId: ENTITY }
  }, 'pay');
  acctPay.ok ? pass('unit-accountant-pay') : fail('unit-accountant-pay', JSON.stringify(acctPay));

  const acctApprove = assertPurchasesAction({
    trustedTestActor: true,
    actor: { role: 'accountant', permissions: [], entityId: ENTITY }
  }, 'approve');
  !acctApprove.ok ? pass('unit-accountant-deny-approve') : fail('unit-accountant-deny-approve');

  const whReceive = assertPurchasesAction({
    trustedTestActor: true,
    actor: { role: 'warehouse', permissions: [], entityId: ENTITY }
  }, 'receive');
  whReceive.ok ? pass('unit-warehouse-receive') : fail('unit-warehouse-receive', JSON.stringify(whReceive));

  const whCreate = assertPurchasesAction({
    trustedTestActor: true,
    actor: { role: 'warehouse', permissions: [], entityId: ENTITY }
  }, 'create');
  !whCreate.ok ? pass('unit-warehouse-deny-create') : fail('unit-warehouse-deny-create');

  // Spoof headers alone must not grant via assertPurchasesAction(req) without authUser
  const spoof = assertPurchasesAction({
    headers: { 'x-user-role': 'Admin', 'x-finance-permissions': '*' },
    authUser: null
  }, 'approve');
  !spoof.ok && spoof.status === 401
    ? pass('unit-spoof-headers-ignored')
    : fail('unit-spoof-headers-ignored', JSON.stringify(spoof));

  // --- Schema compatibility (additive only) ---
  const pg = new Client({ connectionString: DATABASE_URL });
  await pg.connect();
  const destructive = await pg.query(`
    SELECT 1 FROM information_schema.tables
    WHERE table_schema='public' AND table_name IN ('finance_purchase_orders','finance_vendors')
  `);
  destructive.rows.length === 2
    ? pass('compat-core-tables-present')
    : fail('compat-core-tables-present');

  // Ensure role users
  const roles = await ensureRoleUsers(pg);
  await pg.end();

  // --- HTTP authz ---
  const noAuth = await httpReq('POST', '/finance/purchases/orders', {
    entity_id: ENTITY,
    vendor_name: 'x',
    lines: [{ item_name: 'y', quantity: 1, unit_price: 1 }]
  });
  noAuth.status === 401
    ? pass('http-unauth-create-401', String(noAuth.status))
    : fail('http-unauth-create-401', `${noAuth.status} ${JSON.stringify(noAuth.json)}`);

  const admin = await login('admin@naiosh.com', 'Admin@123');
  admin.ok ? pass('login-admin') : fail('login-admin', admin.raw?.slice(0, 120));

  const viewer = await login(roles[0].email, roles[0].pass);
  viewer.ok ? pass('login-viewer') : fail('login-viewer', String(viewer.status));

  const accountant = await login(roles[1].email, roles[1].pass);
  accountant.ok ? pass('login-accountant') : fail('login-accountant', String(accountant.status));

  const warehouse = await login(roles[2].email, roles[2].pass);
  warehouse.ok ? pass('login-warehouse') : fail('login-warehouse', String(warehouse.status));

  // Viewer can list, cannot create/approve
  const viewerList = await httpReq('GET', `/finance/purchases/orders?entity_id=${ENTITY}`, null, viewer.auth);
  viewerList.status === 200 && viewerList.json?.success
    ? pass('viewer-can-list')
    : fail('viewer-can-list', `${viewerList.status}`);

  const viewerCreate = await httpReq('POST', '/finance/purchases/orders', {
    entity_id: ENTITY,
    vendor_name: 'ممنوع',
    lines: [{ item_name: 'x', quantity: 1, unit_price: 10, tax_pct: 0 }]
  }, viewer.auth);
  viewerCreate.status === 403
    ? pass('viewer-denied-create')
    : fail('viewer-denied-create', `${viewerCreate.status} ${JSON.stringify(viewerCreate.json)}`);

  // Accountant creates PO
  const po = await httpReq('POST', '/finance/purchases/orders', {
    entity_id: ENTITY,
    vendor_name: `مورد صلاحيات-${stamp}`,
    lines: [{ item_name: 'بند صلاحيات', quantity: 2, unit_price: 50, tax_pct: 0 }]
  }, accountant.auth);
  po.status === 201 ? pass('accountant-create-po', po.json?.order?.po_number) : fail('accountant-create-po', `${po.status} ${JSON.stringify(po.json)}`);
  const poId = po.json?.order?.po_id;

  const acctApproveHttp = await httpReq('POST', `/finance/purchases/orders/${poId}/approve`, { entity_id: ENTITY }, accountant.auth);
  acctApproveHttp.status === 403
    ? pass('accountant-denied-approve')
    : fail('accountant-denied-approve', `${acctApproveHttp.status} ${JSON.stringify(acctApproveHttp.json)}`);

  const adminApprove = await httpReq('POST', `/finance/purchases/orders/${poId}/approve`, { entity_id: ENTITY }, admin.auth);
  adminApprove.status === 200
    ? pass('admin-approve-po')
    : fail('admin-approve-po', `${adminApprove.status} ${JSON.stringify(adminApprove.json)}`);

  // Audit visible to viewer after approve
  const detail = await httpReq('GET', `/finance/purchases/orders/${poId}?entity_id=${ENTITY}`, null, viewer.auth);
  const audit = detail.json?.order?.audit_log;
  const auditArr = Array.isArray(audit) ? audit : (() => { try { return JSON.parse(audit || '[]'); } catch { return []; } })();
  auditArr.some((e) => /approv/i.test(String(e.action || '')))
    ? pass('viewer-can-read-audit')
    : fail('viewer-can-read-audit', JSON.stringify(auditArr));

  // --- Purchase vendor ---
  const vendor = await httpReq('POST', '/finance/purchases/vendors', {
    entity_id: ENTITY,
    vendor_name_ar: `مورد مشتريات ${stamp}`,
    vendor_scope: 'PURCHASE',
    tax_number: `TX-${stamp}`
  }, accountant.auth);
  vendor.status === 201
    ? pass('create-purchase-vendor', vendor.json?.vendor?.vendor_code)
    : fail('create-purchase-vendor', `${vendor.status} ${JSON.stringify(vendor.json)}`);
  const vendorId = vendor.json?.vendor?.vendor_id;

  const vendorDenied = await httpReq('POST', '/finance/purchases/vendors', {
    entity_id: ENTITY,
    vendor_name_ar: 'ممنوع',
    vendor_scope: 'PURCHASE'
  }, viewer.auth);
  vendorDenied.status === 403
    ? pass('viewer-denied-vendor-write')
    : fail('viewer-denied-vendor-write', `${vendorDenied.status}`);

  const vendorDetail = await httpReq('GET', `/finance/purchases/vendors/${vendorId}?entity_id=${ENTITY}`, null, admin.auth);
  vendorDetail.status === 200 && vendorDetail.json?.vendor
    ? pass('vendor-detail-links')
    : fail('vendor-detail-links', `${vendorDetail.status}`);

  // --- Quotes ---
  const quote = await httpReq('POST', '/finance/purchases/quotes', {
    entity_id: ENTITY,
    vendor_name: `مورد عرض ${stamp}`,
    vendor_id: vendorId,
    lines: [
      { item_name: 'خام أ', quantity: 3, unit_price: 20, tax_pct: 15 },
      { item_name: 'خام ب', quantity: 1, unit_price: 10, tax_pct: 15 }
    ]
  }, accountant.auth);
  quote.status === 201
    ? pass('create-vendor-quote', quote.json?.quote?.quote_number)
    : fail('create-vendor-quote', `${quote.status} ${JSON.stringify(quote.json)}`);
  const quoteId = quote.json?.quote?.quote_id;

  await httpReq('POST', `/finance/purchases/quotes/${quoteId}/send`, { entity_id: ENTITY }, accountant.auth);
  await httpReq('POST', `/finance/purchases/quotes/${quoteId}/accept`, { entity_id: ENTITY }, accountant.auth);
  const converted = await httpReq('POST', `/finance/purchases/quotes/${quoteId}/convert`, { entity_id: ENTITY }, accountant.auth);
  converted.status === 201 && converted.json?.order?.po_id
    ? pass('convert-quote-to-po', converted.json.order.po_number)
    : fail('convert-quote-to-po', `${converted.status} ${JSON.stringify(converted.json)}`);

  const dupConvert = await httpReq('POST', `/finance/purchases/quotes/${quoteId}/convert`, { entity_id: ENTITY }, accountant.auth);
  dupConvert.status === 409
    ? pass('block-double-convert')
    : fail('block-double-convert', `${dupConvert.status}`);

  // --- Invoice/pay permission ---
  const inv = await httpReq('POST', '/finance/purchases/vendor-invoices', {
    entity_id: ENTITY,
    vendor_name: `مورد صلاحيات-${stamp}`,
    po_id: poId,
    total_amount: 100,
    subtotal: 100,
    tax_amount: 0,
    invoice_number: `VI-PERM-${stamp}`
  }, accountant.auth);
  inv.status === 201 ? pass('accountant-create-invoice') : fail('accountant-create-invoice', `${inv.status} ${JSON.stringify(inv.json)}`);
  const viId = inv.json?.invoice?.vendor_invoice_id;
  await httpReq('POST', `/finance/purchases/vendor-invoices/${viId}/approve`, { entity_id: ENTITY }, admin.auth);
  // accountant may approve invoice (invoice action) - our map gives invoice to accountant via 'invoice' action which accountant has
  const pay = await httpReq('POST', `/finance/purchases/vendor-invoices/${viId}/pay`, {
    entity_id: ENTITY,
    amount: 40,
    method: 'CASH'
  }, accountant.auth);
  pay.status === 200 && String(pay.json?.invoice?.status).toUpperCase() === 'PARTIAL'
    ? pass('accountant-partial-pay')
    : fail('accountant-partial-pay', `${pay.status} ${JSON.stringify(pay.json)}`);

  const viewerPay = await httpReq('POST', `/finance/purchases/vendor-invoices/${viId}/pay`, {
    entity_id: ENTITY,
    amount: 1
  }, viewer.auth);
  viewerPay.status === 403
    ? pass('viewer-denied-pay')
    : fail('viewer-denied-pay', `${viewerPay.status}`);

  // --- Cancel permission ---
  const cancelPo = await httpReq('POST', '/finance/purchases/orders', {
    entity_id: ENTITY,
    vendor_name: `CXL-${stamp}`,
    lines: [{ item_name: 'x', quantity: 1, unit_price: 5, tax_pct: 0 }]
  }, accountant.auth);
  const cxlId = cancelPo.json?.order?.po_id;
  await httpReq('POST', `/finance/purchases/orders/${cxlId}/approve`, { entity_id: ENTITY }, admin.auth);
  const viewerCancel = await httpReq('POST', `/finance/purchases/orders/${cxlId}/cancel`, {
    entity_id: ENTITY,
    reason: 'اختبار'
  }, viewer.auth);
  viewerCancel.status === 403
    ? pass('viewer-denied-cancel')
    : fail('viewer-denied-cancel', `${viewerCancel.status}`);
  const adminCancel = await httpReq('POST', `/finance/purchases/orders/${cxlId}/cancel`, {
    entity_id: ENTITY,
    reason: 'إلغاء إداري معزول'
  }, admin.auth);
  adminCancel.status === 200
    ? pass('admin-cancel-po')
    : fail('admin-cancel-po', `${adminCancel.status} ${JSON.stringify(adminCancel.json)}`);

  // --- Receiving open-orders + warehouse receive permission ---
  const openOrders = await httpReq('GET', `/finance/purchases/receiving/open-orders?entity_id=${ENTITY}`, null, warehouse.auth);
  openOrders.status === 200 && openOrders.json?.success
    ? pass('warehouse-list-open-orders', String(openOrders.json.count))
    : fail('warehouse-list-open-orders', `${openOrders.status} ${JSON.stringify(openOrders.json)}`);

  const whCreatePo = await httpReq('POST', '/finance/purchases/orders', {
    entity_id: ENTITY,
    vendor_name: 'wh-denied',
    lines: [{ item_name: 'x', quantity: 1, unit_price: 1, tax_pct: 0 }]
  }, warehouse.auth);
  whCreatePo.status === 403
    ? pass('warehouse-denied-create-po')
    : fail('warehouse-denied-create-po', `${whCreatePo.status}`);

  // Pages exist
  for (const path of [
    '/finance/vendor-quotes.html',
    '/finance/purchase-vendors.html',
    '/finance/purchase-receiving.html'
  ]) {
    const page = await httpReq('GET', path, null, admin.auth);
    page.status === 200 && page.raw.includes('finance-workbench.css')
      ? pass(`page ${path}`)
      : fail(`page ${path}`, `HTTP ${page.status}`);
  }

  // Catalog honesty
  const catalog = require('./finance/finance-leadership-360-catalog');
  const purchases = catalog.SECTIONS.find((s) => s.id === 'purchases');
  const mustOps = ['vendors', 'vendor-quotes', 'receiving', 'purchase-orders', 'vendor-invoices'];
  const bad = mustOps.filter((id) => {
    const p = purchases.pages.find((x) => x.id === id);
    return !p || p.status !== 'operational';
  });
  bad.length === 0 ? pass('catalog-purchases-operational') : fail('catalog-purchases-operational', bad.join(','));

  const passed = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok).length;
  const out = {
    generated_at: new Date().toISOString(),
    base: BASE,
    passed,
    failed,
    total: results.length,
    results
  };
  fs.writeFileSync(`${ART}/finance-purchases-wave2-test-results.json`, JSON.stringify(out, null, 2));
  fs.writeFileSync(
    `${ART}/finance-purchases-wave2-test-run.log`,
    results.map((r) => `${r.ok ? 'PASS' : 'FAIL'}  ${r.name}${r.detail ? ` — ${r.detail}` : ''}`).join('\n') + `\n\n${passed}/${results.length}\n`
  );
  console.log(`\n${passed}/${results.length} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
