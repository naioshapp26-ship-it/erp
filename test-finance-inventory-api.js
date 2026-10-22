'use strict';

const databaseUrl = process.env.INVENTORY_TEST_DATABASE_URL || '';
if (!databaseUrl) {
  console.log('SKIP inventory-api — set INVENTORY_TEST_DATABASE_URL to a local isolated Postgres');
  process.exit(0);
}
if (!/127\.0\.0\.1|localhost/.test(databaseUrl)) {
  console.error('FAIL inventory-api refuses a non-local database');
  process.exit(1);
}
process.env.DATABASE_URL = databaseUrl;
process.env.DATABASE_SSL = 'false';

const http = require('http');
const express = require('express');
const db = require('./db');
const inventoryRoutes = require('./finance/api/inventory');

const ENTITY = 'INV-PHASE1-TEST';
const app = express();
app.use(express.json());
app.use((req, res, next) => {
  const entityId = req.headers['x-test-entity'] || ENTITY;
  req.userEntity = { type: 'OFFICE', id: entityId };
  req.authenticatedEntityContext = req.userEntity;
  req.authUser = { email: 'inventory-phase1@local.test' };
  next();
});
app.use('/finance/inventory', inventoryRoutes);

function call(method, path, body, extraHeaders) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const headers = Object.assign({}, extraHeaders || {});
    if (payload) {
      headers['Content-Type'] = 'application/json';
      headers['Content-Length'] = Buffer.byteLength(payload);
    }
    const req = http.request({
      hostname: '127.0.0.1',
      port: server.address().port,
      path,
      method,
      headers
    }, (res) => {
      let raw = '';
      res.on('data', (chunk) => { raw += chunk; });
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(raw); } catch { /* */ }
        resolve({ status: res.statusCode, json });
      });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

const results = [];
function ok(name, cond, detail) {
  results.push({ name, ok: !!cond, detail: detail || '' });
  console.log(cond ? 'PASS' : 'FAIL', name, detail || '');
}

let server;
(async () => {
  server = await new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  try {
    const unit = await call('POST', '/finance/inventory/units', { code: 'pcs', name_ar: 'قطعة' });
    ok('create-unit', unit.status === 201 && unit.json.unit.code === 'PCS', String(unit.status));
    const dupUnit = await call('POST', '/finance/inventory/units', { code: 'PCS', name_ar: 'مكررة' });
    ok('duplicate-unit', dupUnit.status === 409);
    const wh = await call('POST', '/finance/inventory/warehouses', { code: 'MAIN', name_ar: 'المستودع الرئيسي' });
    ok('create-warehouse', wh.status === 201 && wh.json.warehouse.code === 'MAIN', String(wh.status));
    const wh2 = await call('POST', '/finance/inventory/warehouses', { code: 'EAST', name_ar: 'مستودع الشرق' });
    ok('create-second-warehouse', wh2.status === 201);
    const dup = await call('POST', '/finance/inventory/warehouses', { code: 'main', name_ar: 'مكرر' });
    ok('duplicate-warehouse', dup.status === 409);

    const missingUnit = await call('POST', '/finance/inventory/items', {
      sku: 'no-unit', name_ar: 'بدون وحدة', item_type: 'product'
    });
    ok('item-requires-unit', missingUnit.status === 400);
    const item = await call('POST', '/finance/inventory/items', {
      sku: 'sku-1', name_ar: 'صنف اختبار', item_type: 'product', category: 'عام', unit: 'PCS', sale_price: 15, reorder_level: 4
    });
    ok('create-item', item.status === 201 && item.json.item.sku === 'SKU-1');
    const dupItem = await call('POST', '/finance/inventory/items', { sku: 'SKU-1', name_ar: 'آخر', unit: 'PCS' });
    ok('duplicate-sku', dupItem.status === 409, String(dupItem.status) + ' ' + ((dupItem.json && dupItem.json.error) || ''));
    const service = await call('POST', '/finance/inventory/items', { sku: 'SRV-1', name_ar: 'خدمة', item_type: 'service', unit: 'PCS', sale_price: 20 });
    ok('create-service', service.status === 201 && service.json.item.is_stocked === false);

    const itemId = item.json.item.item_id;
    const whId = wh.json.warehouse.warehouse_id;
    const wh2Id = wh2.json.warehouse.warehouse_id;
    const opening = await call('POST', '/finance/inventory/movements', {
      item_id: itemId, warehouse_id: whId, movement_type: 'OPENING', quantity: 10, unit_cost: 5, client_request_id: 'open-1'
    });
    ok('opening', opening.status === 201 && opening.json.document.document_no === 'STK-0001', JSON.stringify(opening.json && opening.json.error));
    const replay = await call('POST', '/finance/inventory/movements', {
      item_id: itemId, warehouse_id: whId, movement_type: 'OPENING', quantity: 99, unit_cost: 1, client_request_id: 'open-1'
    });
    ok('idempotent-replay', replay.status === 200 && replay.json.replayed === true);

    const inbound = await call('POST', '/finance/inventory/movements', {
      item_id: itemId, warehouse_id: whId, movement_type: 'IN', quantity: 10, unit_cost: 7, client_request_id: 'in-1'
    });
    ok('inbound', inbound.status === 201);
    const balances = await call('GET', '/finance/inventory/balances');
    const row = (balances.json.balances || []).find((b) => b.item_id === itemId && b.warehouse_id === whId);
    ok('weighted-average-persisted', balances.status === 200 && Number(row.qty) === 20 && Number(row.avg_cost) === 6, JSON.stringify(row));

    const outbound = await call('POST', '/finance/inventory/movements', {
      item_id: itemId, warehouse_id: whId, movement_type: 'OUT', quantity: 5, reason: 'صرف اختبار', client_request_id: 'out-1'
    });
    ok('outbound', outbound.status === 201 && Number(outbound.json.lines[0].unit_cost) === 6);
    const tooMuch = await call('POST', '/finance/inventory/movements', {
      item_id: itemId, warehouse_id: whId, movement_type: 'OUT', quantity: 100, reason: 'زيادة', client_request_id: 'out-2'
    });
    ok('negative-blocked', tooMuch.status === 409);

    const edit = await call('PUT', '/finance/inventory/movements/1', { quantity: 1 });
    ok('posted-immutable', edit.status === 409);

    const transfer = await call('POST', '/finance/inventory/movements', {
      item_id: itemId, warehouse_id: whId, counter_warehouse_id: wh2Id, movement_type: 'TRANSFER', quantity: 4, client_request_id: 'tr-1'
    });
    ok('transfer', transfer.status === 201 && transfer.json.lines.length === 2);
    const serviceMove = await call('POST', '/finance/inventory/movements', {
      item_id: service.json.item.item_id, warehouse_id: whId, movement_type: 'IN', quantity: 1, unit_cost: 1, client_request_id: 'srv-move'
    });
    ok('service-not-stocked', serviceMove.status === 422);

    const after = await call('GET', '/finance/inventory/balances');
    const source = after.json.balances.find((b) => b.warehouse_id === whId);
    const dest = after.json.balances.find((b) => b.warehouse_id === wh2Id);
    ok('balances-after-transfer', Number(source.qty) === 11 && Number(dest.qty) === 4 && Number(dest.avg_cost) === 6, JSON.stringify({ source: source && source.qty, dest: dest && dest.qty }));
    ok('journal-not-claimed', transfer.json.journal_posted === false);
    const raised = await call('PUT', '/finance/inventory/items/' + itemId, { reorder_level: 20 });
    ok('raise-reorder', raised.status === 200);
    const alerts = await call('GET', '/finance/inventory/balances');
    ok('low-stock-alert', alerts.json.low_stock_count >= 1 && Number(alerts.json.total_value) > 0, String(alerts.json.low_stock_count));
    const filtered = await call('GET', '/finance/inventory/movements?movement_type=TRANSFER');
    ok('movement-report-filter', filtered.status === 200 && filtered.json.movements.every((row) => row.movement_type === 'TRANSFER') && filtered.json.count >= 2);
    const other = await call('GET', '/finance/inventory/items', null, { 'x-test-entity': 'INV-OTHER-ENTITY' });
    ok('entity-isolation', other.status === 200 && other.json.count === 0, String(other.json && other.json.count));
  } catch (error) {
    ok('unexpected', false, error.stack || error.message);
  } finally {
    await db.query(`DELETE FROM finance_stock_movements WHERE entity_id = $1`, [ENTITY]);
    await db.query(`DELETE FROM finance_stock_documents WHERE entity_id = $1`, [ENTITY]);
    await db.query(`DELETE FROM finance_stock_balances WHERE entity_id = $1`, [ENTITY]);
    await db.query(`DELETE FROM finance_item_audit WHERE entity_id = $1`, [ENTITY]);
    await db.query(`DELETE FROM finance_items WHERE entity_id = $1`, [ENTITY]);
    await db.query(`DELETE FROM finance_units WHERE entity_id = $1`, [ENTITY]);
    await db.query(`DELETE FROM finance_warehouses WHERE entity_id = $1`, [ENTITY]);
    await db.query(`DELETE FROM finance_stock_counters WHERE entity_id = $1`, [ENTITY]);
    server.close();
    await db.pool.end();
  }
  const failed = results.filter((row) => !row.ok);
  console.log(`inventory-api ${results.length - failed.length}/${results.length}`);
  process.exit(failed.length ? 1 : 0);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
