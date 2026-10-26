'use strict';

/**
 * W4 — inventory depth: categories, costs, margins, counts, purchase links + authz.
 * Isolated DB only (PORT 3083). No production writes.
 */
const fs = require('fs');
const http = require('http');
const bcrypt = require('bcryptjs');
const { Client } = require('pg');
const { actorAllows, assertInventoryAction } = require('./finance/services/inventory-authz');

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
      hostname: u.hostname, port: u.port || 80,
      path: u.pathname + u.search, method,
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
    { email: 'viewer.inventory@naiosh.test', name: 'مشاهد مخزون', role: 'viewer', user: 'viewer_inv', pass: 'Viewer@123' },
    { email: 'warehouse.inventory@naiosh.test', name: 'أمين مستودع', role: 'warehouse', user: 'wh_inv', pass: 'Wh@123456' },
    { email: 'accountant.inventory@naiosh.test', name: 'محاسب مخزون', role: 'accountant', user: 'acct_inv', pass: 'Acct@12345' }
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

  const denyAnon = actorAllows({ authenticated: false }, 'categories');
  denyAnon.status === 401 ? pass('unit-anon-401') : fail('unit-anon-401', JSON.stringify(denyAnon));

  const viewerView = assertInventoryAction({
    trustedTestActor: true, actor: { role: 'viewer', permissions: [], entityId: ENTITY }
  }, 'view');
  viewerView.ok ? pass('unit-viewer-view') : fail('unit-viewer-view');

  const viewerCat = assertInventoryAction({
    trustedTestActor: true, actor: { role: 'viewer', permissions: [], entityId: ENTITY }
  }, 'categories');
  !viewerCat.ok ? pass('unit-viewer-deny-categories') : fail('unit-viewer-deny-categories');

  const whApprove = assertInventoryAction({
    trustedTestActor: true, actor: { role: 'warehouse', permissions: [], entityId: ENTITY }
  }, 'count_approve');
  !whApprove.ok ? pass('unit-warehouse-deny-approve') : fail('unit-warehouse-deny-approve');

  const spoof = assertInventoryAction({
    headers: { 'x-user-role': 'admin' }, authUser: null
  }, 'categories');
  spoof.status === 401 ? pass('unit-spoof-ignored') : fail('unit-spoof-ignored', JSON.stringify(spoof));

  const pg = new Client({ connectionString: DATABASE_URL });
  await pg.connect();
  const roles = await ensureRoleUsers(pg);
  await pg.end();

  const noAuth = await httpReq('POST', '/finance/inventory/categories', { code: 'X', name_ar: 'x' });
  noAuth.status === 401 ? pass('http-unauth-401') : fail('http-unauth-401', String(noAuth.status));

  const admin = await login('admin@naiosh.com', 'Admin@123');
  admin.ok ? pass('login-admin') : fail('login-admin', admin.raw?.slice(0, 120));
  const viewer = await login(roles[0].email, roles[0].pass);
  viewer.ok ? pass('login-viewer') : fail('login-viewer');
  const warehouse = await login(roles[1].email, roles[1].pass);
  warehouse.ok ? pass('login-warehouse') : fail('login-warehouse');
  const accountant = await login(roles[2].email, roles[2].pass);
  accountant.ok ? pass('login-accountant') : fail('login-accountant');

  const page = await httpReq('GET', '/finance/inventory.html', null, admin.auth);
  page.status === 200 && /التصنيفات/.test(page.raw) && /الجرد المعتمد/.test(page.raw)
    ? pass('page-inventory-depth-ui')
    : fail('page-inventory-depth-ui', String(page.status));

  const viewerList = await httpReq('GET', '/finance/inventory/categories', null, viewer.auth);
  viewerList.status === 200 ? pass('viewer-list-categories') : fail('viewer-list-categories', `${viewerList.status} ${JSON.stringify(viewerList.json)}`);

  const viewerCreate = await httpReq('POST', '/finance/inventory/categories', {
    code: `V${stamp}`.slice(0, 12), name_ar: 'ممنوع'
  }, viewer.auth);
  viewerCreate.status === 403 ? pass('viewer-deny-create-category') : fail('viewer-deny-create-category', String(viewerCreate.status));

  // Ensure unit + warehouse + item for count cycle
  const unit = await httpReq('POST', '/finance/inventory/units', { code: `U${String(stamp).slice(-4)}`, name_ar: 'وحدة W4' }, admin.auth);
  (unit.status === 201 || unit.status === 409) ? pass('ensure-unit') : fail('ensure-unit', `${unit.status}`);

  const units = await httpReq('GET', '/finance/inventory/units', null, admin.auth);
  const unitCode = (units.json?.units || []).find((u) => u.is_active)?.code || 'PCS';

  const wh = await httpReq('POST', '/finance/inventory/warehouses', {
    code: `W${String(stamp).slice(-4)}`, name_ar: 'مستودع W4'
  }, admin.auth);
  const warehouseId = wh.json?.warehouse?.warehouse_id
    || (await httpReq('GET', '/finance/inventory/warehouses', null, admin.auth)).json?.warehouses?.[0]?.warehouse_id;
  warehouseId ? pass('ensure-warehouse', String(warehouseId)) : fail('ensure-warehouse');

  const item = await httpReq('POST', '/finance/inventory/items', {
    sku: `SKU-W4-${stamp}`,
    name_ar: 'صنف W4',
    item_type: 'product',
    unit: unitCode,
    sale_price: 50,
    reorder_level: 1,
    is_stocked: true
  }, admin.auth);
  const itemId = item.json?.item?.item_id;
  item.status === 201 && itemId ? pass('create-item', String(itemId)) : fail('create-item', `${item.status} ${JSON.stringify(item.json)}`);

  const root = await httpReq('POST', '/finance/inventory/categories', {
    code: `ROOT${String(stamp).slice(-5)}`, name_ar: 'تصنيف جذر W4'
  }, accountant.auth);
  const rootId = root.json?.category?.category_id;
  root.status === 201 ? pass('create-category-root', String(rootId)) : fail('create-category-root', `${root.status} ${JSON.stringify(root.json)}`);

  const child = await httpReq('POST', '/finance/inventory/categories', {
    code: `CH${String(stamp).slice(-5)}`, name_ar: 'فرع W4', parent_id: rootId
  }, accountant.auth);
  const childId = child.json?.category?.category_id;
  child.status === 201 ? pass('create-category-child') : fail('create-category-child', `${child.status}`);

  const assign = await httpReq('POST', `/finance/inventory/items/${itemId}/assign-category`, {
    category_id: childId
  }, accountant.auth);
  assign.status === 200 && Number(assign.json?.item?.category_id) === Number(childId)
    ? pass('assign-item-category')
    : fail('assign-item-category', `${assign.status} ${JSON.stringify(assign.json)}`);

  // Opening stock so costs/margins/count have data
  const opening = await httpReq('POST', '/finance/inventory/movements', {
    movement_type: 'OPENING',
    item_id: itemId,
    warehouse_id: warehouseId,
    quantity: 10,
    unit_cost: 20,
    direction: 'in',
    reason: 'افتتاح W4'
  }, admin.auth);
  (opening.status === 201 || opening.status === 409) ? pass('opening-balance', String(opening.status)) : fail('opening-balance', `${opening.status} ${JSON.stringify(opening.json)}`);

  const costs = await httpReq('GET', '/finance/inventory/costs', null, accountant.auth);
  costs.status === 200 && Array.isArray(costs.json?.costs)
    ? pass('costs-list')
    : fail('costs-list', `${costs.status}`);

  const margins = await httpReq('GET', '/finance/inventory/margins-by-category', null, accountant.auth);
  margins.status === 200 && Array.isArray(margins.json?.rows)
    ? pass('margins-by-category')
    : fail('margins-by-category', `${margins.status}`);

  const links = await httpReq('GET', '/finance/inventory/purchase-links', null, warehouse.auth);
  links.status === 200 && Array.isArray(links.json?.purchase_orders)
    ? pass('purchase-links')
    : fail('purchase-links', `${links.status} ${JSON.stringify(links.json)}`);

  const countDraft = await httpReq('POST', '/finance/inventory/counts', {
    item_id: itemId,
    warehouse_id: warehouseId,
    counted_qty: 8,
    reason: 'جرد اختباري W4'
  }, warehouse.auth);
  const countId = countDraft.json?.count?.count_id;
  countDraft.status === 201 && countDraft.json?.count?.status === 'DRAFT'
    ? pass('count-draft', String(countId))
    : fail('count-draft', `${countDraft.status} ${JSON.stringify(countDraft.json)}`);

  const whApproveHttp = await httpReq('POST', `/finance/inventory/counts/${countId}/approve`, {}, warehouse.auth);
  whApproveHttp.status === 403 ? pass('warehouse-deny-approve-http') : fail('warehouse-deny-approve-http', String(whApproveHttp.status));

  const approve = await httpReq('POST', `/finance/inventory/counts/${countId}/approve`, {}, accountant.auth);
  approve.status === 200 && approve.json?.count?.status === 'APPROVED'
    ? pass('count-approve')
    : fail('count-approve', `${approve.status} ${JSON.stringify(approve.json)}`);

  const bal = await httpReq('GET', '/finance/inventory/balances', null, admin.auth);
  const row = (bal.json?.balances || []).find((b) => Number(b.item_id) === Number(itemId) && Number(b.warehouse_id) === Number(warehouseId));
  row && Number(row.qty) === 8
    ? pass('count-adjusted-qty', String(row.qty))
    : fail('count-adjusted-qty', JSON.stringify(row || bal.json));

  // cancel path on new draft
  const count2 = await httpReq('POST', '/finance/inventory/counts', {
    item_id: itemId, warehouse_id: warehouseId, counted_qty: 8, reason: 'للإلغاء'
  }, accountant.auth);
  const id2 = count2.json?.count?.count_id;
  const cancel = await httpReq('POST', `/finance/inventory/counts/${id2}/cancel`, { reason: 'إلغاء اختبار' }, accountant.auth);
  cancel.status === 200 && cancel.json?.count?.status === 'CANCELLED'
    ? pass('count-cancel')
    : fail('count-cancel', `${cancel.status}`);

  const passed = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok).length;
  const out = {
    generated_at: new Date().toISOString(),
    wave: 'W4-inventory-depth',
    pass: failed === 0,
    passed,
    failed,
    total: results.length,
    results
  };
  fs.writeFileSync(`${ART}/finance-inventory-w4-test-results.json`, JSON.stringify(out, null, 2));
  console.log(`\nW4 inventory: ${passed}/${results.length} PASS (${failed} FAIL)`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  fs.writeFileSync(`${ART}/finance-inventory-w4-test-results.json`, JSON.stringify({ pass: false, error: String(err.stack || err) }, null, 2));
  process.exit(1);
});
