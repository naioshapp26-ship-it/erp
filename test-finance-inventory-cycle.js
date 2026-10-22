'use strict';

/**
 * Real local cycle: product → warehouse → opening → PO lines → receive → balances.
 * Uses DATABASE_URL / running server. Does not touch production migrations.
 */

const http = require('http');

const PORT = Number(process.env.PORT || 3000);
const BASE = `http://127.0.0.1:${PORT}`;
const results = [];
const stamp = Date.now().toString().slice(-8);

function pass(name, detail = '') {
  results.push({ name, ok: true, detail });
  console.log(`PASS  ${name}${detail ? ` — ${detail}` : ''}`);
}
function fail(name, detail = '') {
  results.push({ name, ok: false, detail });
  console.log(`FAIL  ${name}${detail ? ` — ${detail}` : ''}`);
}

function httpJson(method, urlPath, body, headers = {}) {
  const u = new URL(urlPath, BASE);
  const payload = body == null ? null : JSON.stringify(body);
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: u.hostname,
        port: u.port,
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
          resolve({ status: res.statusCode, json, raw: raw.slice(0, 500) });
        });
      }
    );
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function main() {
  console.log(`\n=== Finance inventory cycle @ ${BASE} ===\n`);

  const pages = [
    '/finance/inventory.html',
    '/finance/products.html',
    '/finance/purchase-orders.html'
  ];
  for (const p of pages) {
    const r = await httpJson('GET', p);
    if (r.status === 200 && !/قيد التطوير/.test(r.raw)) pass(`page ${p}`, `HTTP ${r.status}`);
    else fail(`page ${p}`, `HTTP ${r.status}`);
  }

  const entity = { entity_id: 'HQ001', entity_type: 'HQ' };

  const wh = await httpJson('POST', '/finance/inventory/warehouses', {
    ...entity,
    code: `WH-T${stamp}`,
    name_ar: `مستودع اختبار ${stamp}`,
    location: 'الرياض'
  });
  if (wh.status === 201 && wh.json && wh.json.warehouse) {
    pass('create warehouse', wh.json.warehouse.code);
  } else {
    fail('create warehouse', wh.raw);
    return finish(1);
  }
  const warehouseId = wh.json.warehouse.warehouse_id;

  const prod = await httpJson('POST', '/finance/inventory/products', {
    ...entity,
    sku: `SKU-T${stamp}`,
    name_ar: `صنف اختبار ${stamp}`,
    product_type: 'GOODS',
    category: 'TEST',
    unit: 'PCS',
    cost_price: 25,
    sale_price: 40,
    reorder_level: 5,
    track_inventory: true
  });
  if (prod.status === 201 && prod.json && prod.json.product) {
    pass('create product', prod.json.product.sku);
  } else {
    fail('create product', prod.raw);
    return finish(1);
  }
  const productId = prod.json.product.product_id;

  const open = await httpJson('POST', '/finance/inventory/movements', {
    ...entity,
    movement_type: 'OPENING',
    product_id: productId,
    warehouse_id: warehouseId,
    quantity: 10,
    unit_cost: 25,
    notes: `opening-${stamp}`
  });
  if (open.status === 201) pass('opening stock', `qty 10`);
  else fail('opening stock', open.raw);

  const neg = await httpJson('POST', '/finance/inventory/movements', {
    ...entity,
    movement_type: 'OUT',
    product_id: productId,
    warehouse_id: warehouseId,
    quantity: 9999,
    notes: 'should-fail-negative'
  });
  if (neg.status === 409 && neg.json && neg.json.code === 'NEGATIVE_STOCK') {
    pass('block negative stock', neg.json.code);
  } else {
    fail('block negative stock', neg.raw);
  }

  const po = await httpJson('POST', '/finance/purchases/orders', {
    ...entity,
    vendor_name: `مورد اختبار ${stamp}`,
    status: 'OPEN',
    notes: `inv-cycle-${stamp}`,
    lines: [{ product_id: productId, qty: 4, unit_cost: 22, description: 'line' }]
  });
  if (po.status === 201 && po.json && po.json.order && (po.json.lines || []).length === 1) {
    pass('create PO with lines', po.json.order.po_number);
  } else {
    fail('create PO with lines', po.raw);
    return finish(1);
  }

  const receive = await httpJson('POST', `/finance/purchases/orders/${po.json.order.po_id}/receive`, {
    ...entity,
    warehouse_id: warehouseId,
    lines: [{ line_id: po.json.lines[0].line_id, qty: 4 }],
    notes: 'receive-test'
  });
  if (receive.status === 200 && receive.json && receive.json.order && receive.json.order.status === 'RECEIVED') {
    pass('receive PO into stock', `status ${receive.json.order.status}`);
  } else {
    fail('receive PO into stock', receive.raw);
  }

  const bal = await httpJson('GET', `/finance/inventory/balances?entity_id=HQ001&product_id=${productId}`);
  const row = (bal.json && bal.json.balances || []).find((b) => Number(b.warehouse_id) === Number(warehouseId));
  const qty = row ? Number(row.quantity) : NaN;
  if (bal.status === 200 && qty === 14) {
    pass('balance after opening+receive', `qty=${qty}`);
  } else {
    fail('balance after opening+receive', `qty=${qty} raw=${bal.raw}`);
  }

  const reloadProd = await httpJson('GET', `/finance/inventory/products?entity_id=HQ001&q=${encodeURIComponent('SKU-T' + stamp)}`);
  if (reloadProd.status === 200 && (reloadProd.json.products || []).some((p) => p.product_id === productId)) {
    pass('persist product after reload', 'found');
  } else {
    fail('persist product after reload', reloadProd.raw);
  }

  // cleanup: cancel opening not needed; leave test rows isolated by stamp notes
  return finish(results.every((r) => r.ok) ? 0 : 1);
}

function finish(code) {
  const passed = results.filter((r) => r.ok).length;
  const failed = results.length - passed;
  console.log(`\n=== SUMMARY: ${passed} PASS / ${failed} FAIL ===\n`);
  process.exit(code);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
