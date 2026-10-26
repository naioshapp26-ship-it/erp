'use strict';

const databaseUrl = process.env.INVENTORY_TEST_DATABASE_URL || '';
if (!databaseUrl) {
  console.log('SKIP stock-link — set INVENTORY_TEST_DATABASE_URL to a local isolated Postgres');
  process.exit(0);
}
if (!/127\.0\.0\.1|localhost/.test(databaseUrl)) {
  console.error('FAIL stock-link refuses a non-local database');
  process.exit(1);
}
process.env.DATABASE_URL = databaseUrl;
process.env.DATABASE_SSL = 'false';

const http = require('http');
const express = require('express');
const db = require('./db');
const inventoryRoutes = require('./finance/api/inventory');
const purchaseRoutes = require('./finance/api/purchase-orders');

const ENTITY = 'INV-LINK-TEST';
const app = express();
app.use(express.json());
app.use((req, res, next) => {
  if (req.headers['x-test-unauth']) return next();
  const entityId = req.headers['x-test-entity'] || ENTITY;
  req.userEntity = { type: 'OFFICE', id: entityId };
  req.authenticatedEntityContext = req.userEntity;
  req.authUser = { email: 'stock-link@local.test' };
  next();
});
app.use('/finance/purchases', purchaseRoutes);
app.use('/finance/inventory', inventoryRoutes);

function call(method, path, body, extraHeaders) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const headers = Object.assign({}, extraHeaders || {});
    if (payload) {
      headers['Content-Type'] = 'application/json';
      headers['Content-Length'] = Buffer.byteLength(payload);
    }
    const req = http.request({ hostname: '127.0.0.1', port: server.address().port, path, method, headers }, (res) => {
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

async function q(sql, params) {
  try {
    return await db.query(sql, params);
  } catch (error) {
    if (error.code === '42P01') return { rows: [] };
    throw error;
  }
}

async function cleanup() {
  const entries = await q(`SELECT entry_id FROM finance_journal_entries WHERE entity_id = $1`, [ENTITY]);
  const ids = entries.rows.map((row) => row.entry_id);
  if (ids.length) await q(`DELETE FROM finance_journal_lines WHERE entry_id = ANY($1::int[])`, [ids]);
  await q(`DELETE FROM finance_journal_entries WHERE entity_id = $1`, [ENTITY]);
  await q(`DELETE FROM finance_stock_source_qty WHERE entity_id = $1`, [ENTITY]);
  await q(`DELETE FROM finance_document_links WHERE entity_id = $1`, [ENTITY]);
  await q(`DELETE FROM finance_stock_movements WHERE entity_id = $1`, [ENTITY]);
  await q(`DELETE FROM finance_stock_documents WHERE entity_id = $1`, [ENTITY]);
  await q(`DELETE FROM finance_stock_balances WHERE entity_id = $1`, [ENTITY]);
  await q(`DELETE FROM finance_item_audit WHERE entity_id = $1`, [ENTITY]);
  await q(`DELETE FROM finance_items WHERE entity_id = $1`, [ENTITY]);
  await q(`DELETE FROM finance_units WHERE entity_id = $1`, [ENTITY]);
  await q(`DELETE FROM finance_warehouses WHERE entity_id = $1`, [ENTITY]);
  await q(`DELETE FROM finance_stock_counters WHERE entity_id = $1`, [ENTITY]);
  await q(`DELETE FROM finance_inventory_account_map WHERE entity_id = $1`, [ENTITY]);
  await q(`DELETE FROM finance_purchase_orders WHERE entity_id = $1`, [ENTITY]);
  const invoices = await q(`SELECT invoice_id FROM finance_invoices WHERE entity_id = $1`, [ENTITY]);
  const invoiceIds = invoices.rows.map((row) => row.invoice_id);
  if (invoiceIds.length) await db.query(`DELETE FROM finance_invoice_lines WHERE invoice_id = ANY($1::int[])`, [invoiceIds]);
  await db.query(`DELETE FROM finance_invoices WHERE entity_id = $1`, [ENTITY]);
  await db.query(`DELETE FROM finance_customers WHERE customer_code = 'ZLNKCUST'`);
  await db.query(`DELETE FROM finance_accounts WHERE account_code IN ('ZLNK1400','ZLNK2100','ZLNK5100')`);
}

let server;
(async () => {
  server = await new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  try {
    await cleanup();
    const accounts = [];
    for (const spec of [
      ['ZLNK1400', 'مخزون ربط', 'ASSET'],
      ['ZLNK2100', 'وسيط استلام', 'LIABILITY'],
      ['ZLNK5100', 'تكلفة مبيعات ربط', 'EXPENSE']
    ]) {
      const inserted = await db.query(
        `INSERT INTO finance_accounts (account_code, account_name_ar, account_type, is_active, is_header, normal_balance, entity_id, created_by)
         VALUES ($1,$2,$3,true,false,$4,$5,'stock-link-test') RETURNING account_id`,
        [spec[0], spec[1], spec[2], spec[2] === 'LIABILITY' ? 'CREDIT' : 'DEBIT', ENTITY]
      );
      accounts.push(inserted.rows[0].account_id);
    }
    const map = await call('PUT', '/finance/inventory/account-map', {
      inventory_account_id: accounts[0],
      grni_account_id: accounts[1],
      cogs_account_id: accounts[2],
      currency_code: 'SAR'
    });
    ok('save-account-map', map.status === 200 && map.json.account_map.currency_code === 'SAR', String(map.status));

    const unit = await call('POST', '/finance/inventory/units', { code: 'PCS', name_ar: 'قطعة' });
    const spare = await call('POST', '/finance/inventory/units', { code: 'BOX', name_ar: 'صندوق' });
    const wh = await call('POST', '/finance/inventory/warehouses', { code: 'MAIN', name_ar: 'الرئيسي' });
    const item = await call('POST', '/finance/inventory/items', { sku: 'LNK1', name_ar: 'صنف الربط', unit: 'PCS', sale_price: 12, reorder_level: 1 });
    const service = await call('POST', '/finance/inventory/items', { sku: 'LNKS', name_ar: 'خدمة', item_type: 'service', unit: 'PCS', sale_price: 5 });
    ok('masters', unit.status === 201 && wh.status === 201 && item.status === 201 && service.json.item.is_stocked === false);
    const itemId = item.json.item.item_id;
    const whId = wh.json.warehouse.warehouse_id;

    const po = await call('POST', '/finance/purchases/orders', {
      po_number: 'PO-ZLNK-' + Date.now(),
      vendor_name: 'مورد اختبار',
      entity_id: ENTITY,
      lines: [{ item_code: 'LNK1', item_name: 'صنف الربط', quantity: 10, unit_price: 5, tax_pct: 0 }]
    });
    ok('po-created', po.status === 201, String(po.status) + ' ' + JSON.stringify(po.json && po.json.error));
    const before = await call('GET', '/finance/inventory/balances');
    ok('po-does-not-stock', before.json.balances.length === 0, String(before.json.balances.length));
    const early = await call('POST', '/finance/inventory/receipts', {
      po_id: po.json.order.po_id,
      warehouse_id: whId,
      client_request_id: 'receipt-early',
      lines: [{ item_id: itemId, quantity: 10, unit_cost: 5 }]
    });
    ok('draft-receipt-blocked', early.status === 409, String(early.status) + ' ' + (early.json && early.json.error));
    const still = await call('GET', '/finance/inventory/balances');
    ok('draft-receipt-no-balance', still.json.balances.length === 0);

    await call('POST', '/finance/purchases/orders/' + po.json.order.po_id + '/approve', { entity_id: ENTITY });
    const receiptKey = 'receipt-1';
    const receipt = await call('POST', '/finance/inventory/receipts', {
      po_id: po.json.order.po_id,
      warehouse_id: whId,
      client_request_id: receiptKey,
      cost_center_id: 15,
      currency_code: 'SAR',
      lines: [{ item_id: itemId, quantity: 10, unit_cost: 5 }]
    });
    const balance1 = await call('GET', '/finance/inventory/balances');
    const row1 = balance1.json.balances.find((row) => row.item_id === itemId);
    const journal1 = receipt.json && receipt.json.journal;
    ok('receipt-posts', receipt.status === 201 && Number(row1.qty) === 10 && Number(row1.avg_cost) === 5, JSON.stringify({ status: receipt.status, error: receipt.json && receipt.json.error, qty: row1 && row1.qty }));
    ok('receipt-journal', journal1 && journal1.balanced && journal1.total_debit === 50 && Number(journal1.lines[0].cost_center_id) === 15 && journal1.lines.some((line) => Number(line.account_id) === accounts[0] && Number(line.debit_amount) === 50) && journal1.lines.some((line) => Number(line.account_id) === accounts[1] && Number(line.credit_amount) === 50));
    const replay = await call('POST', '/finance/inventory/receipts', {
      po_id: po.json.order.po_id,
      warehouse_id: whId,
      client_request_id: receiptKey,
      lines: [{ item_id: itemId, quantity: 10, unit_cost: 5 }]
    });
    const afterReplay = await call('GET', '/finance/inventory/balances');
    ok('receipt-replay', replay.json.replayed === true && Number(afterReplay.json.balances.find((row) => row.item_id === itemId).qty) === 10);

    const receipt2 = await call('POST', '/finance/inventory/receipts', {
      po_id: po.json.order.po_id,
      warehouse_id: whId,
      client_request_id: 'receipt-2',
      lines: [{ item_id: itemId, quantity: 10, unit_cost: 7 }]
    });
    const row2 = (await call('GET', '/finance/inventory/balances')).json.balances.find((row) => row.item_id === itemId);
    ok('weighted-average', receipt2.status === 201 && Number(row2.qty) === 20 && Number(row2.avg_cost) === 6, JSON.stringify(row2 && { qty: row2.qty, avg: row2.avg_cost, error: receipt2.json.error }));
    const trace = await call('GET', '/finance/inventory/trace?from_type=PURCHASE_ORDER&from_id=' + po.json.order.po_id);
    const types = (trace.json.nodes || []).map((node) => node.type);
    ok('trace-po', trace.status === 200 && types.includes('STOCK_DOCUMENT') && types.includes('JOURNAL_ENTRY'), types.join(','));

    const svc = await call('POST', '/finance/inventory/receipts', {
      po_id: po.json.order.po_id,
      warehouse_id: whId,
      client_request_id: 'receipt-service',
      lines: [{ item_id: service.json.item.item_id, quantity: 1, unit_cost: 5 }]
    });
    ok('service-receipt-blocked', svc.status === 422, String(svc.status));

    const customer = await db.query(
      `INSERT INTO finance_customers (customer_code, customer_name_ar, entity_id) VALUES ('ZLNKCUST','عميل ربط',$1) RETURNING customer_id`,
      [ENTITY]
    );
    const invoice = await db.query(
      `INSERT INTO finance_invoices
        (invoice_number, invoice_date, due_date, customer_id, customer_name, subtotal, total_amount, remaining_amount, status, payment_status, entity_id)
       VALUES ('INV-ZLNK-1', CURRENT_DATE, CURRENT_DATE, $1, 'عميل ربط', 80, 80, 80, 'ISSUED', 'UNPAID', $2)
       RETURNING invoice_id`,
      [customer.rows[0].customer_id, ENTITY]
    );
    await db.query(
      `INSERT INTO finance_invoice_lines
        (invoice_id, line_number, item_code, item_name, quantity, unit_price, line_total)
       VALUES ($1, 1, 'LNK1', 'صنف الربط', 4, 20, 80)`,
      [invoice.rows[0].invoice_id]
    );
    const draft = await db.query(
      `INSERT INTO finance_invoices
        (invoice_number, invoice_date, due_date, customer_id, customer_name, subtotal, total_amount, remaining_amount, status, payment_status, entity_id)
       VALUES ('INV-ZLNK-D', CURRENT_DATE, CURRENT_DATE, $1, 'عميل ربط', 20, 20, 20, 'DRAFT', 'UNPAID', $2)
       RETURNING invoice_id`,
      [customer.rows[0].customer_id, ENTITY]
    );
    const issue = await call('POST', '/finance/inventory/issues', {
      invoice_id: invoice.rows[0].invoice_id,
      warehouse_id: whId,
      client_request_id: 'issue-1',
      lines: [{ item_id: itemId, quantity: 4 }]
    });
    const row3 = (await call('GET', '/finance/inventory/balances')).json.balances.find((row) => row.item_id === itemId);
    const issueJournal = issue.json && issue.json.journal;
    ok('issue-posts', issue.status === 201 && Number(row3.qty) === 16 && Number(row3.avg_cost) === 6, JSON.stringify({ status: issue.status, error: issue.json && issue.json.error, qty: row3 && row3.qty }));
    ok('issue-cogs-journal', issueJournal && issueJournal.balanced && issueJournal.total_debit === 24 && issueJournal.lines.some((line) => Number(line.account_id) === accounts[2] && Number(line.debit_amount) === 24) && issueJournal.lines.some((line) => Number(line.account_id) === accounts[0] && Number(line.credit_amount) === 24));
    const issueAgain = await call('POST', '/finance/inventory/issues', {
      invoice_id: invoice.rows[0].invoice_id,
      warehouse_id: whId,
      client_request_id: 'issue-2',
      lines: [{ item_id: itemId, quantity: 1 }]
    });
    ok('duplicate-issue-blocked', issueAgain.status === 409, String(issueAgain.status) + ' ' + (issueAgain.json && issueAgain.json.error));
    const issueReplay = await call('POST', '/finance/inventory/issues', {
      invoice_id: invoice.rows[0].invoice_id,
      warehouse_id: whId,
      client_request_id: 'issue-1',
      lines: [{ item_id: itemId, quantity: 4 }]
    });
    const row4 = (await call('GET', '/finance/inventory/balances')).json.balances.find((row) => row.item_id === itemId);
    ok('issue-replay', issueReplay.json.replayed === true && Number(row4.qty) === 16);
    const draftIssue = await call('POST', '/finance/inventory/issues', {
      invoice_id: draft.rows[0].invoice_id,
      warehouse_id: whId,
      client_request_id: 'issue-draft',
      lines: [{ item_id: itemId, quantity: 1 }]
    });
    ok('draft-invoice-blocked', draftIssue.status === 409, String(draftIssue.status));
    const originalEntryId = issue.json.document.journal_entry_id;
    const originalLines = await db.query(`SELECT debit_amount, credit_amount, account_id FROM finance_journal_lines WHERE entry_id = $1 ORDER BY line_number`, [originalEntryId]);
    const returned = await call('POST', '/finance/inventory/returns', {
      document_id: issue.json.document.document_id,
      client_request_id: 'return-1',
      reason: 'مرتجع عميل',
      lines: [{ item_id: itemId, warehouse_id: whId, quantity: 2 }]
    });
    const row5 = (await call('GET', '/finance/inventory/balances')).json.balances.find((row) => row.item_id === itemId);
    const originalAfter = await db.query(`SELECT is_posted, entry_id FROM finance_journal_entries WHERE entry_id = $1`, [originalEntryId]);
    const originalLinesAfter = await db.query(`SELECT debit_amount, credit_amount, account_id FROM finance_journal_lines WHERE entry_id = $1 ORDER BY line_number`, [originalEntryId]);
    ok('return-restores-qty', returned.status === 201 && Number(row5.qty) === 18 && Number(row5.avg_cost) === 6, JSON.stringify({ status: returned.status, error: returned.json && returned.json.error, qty: row5 && row5.qty }));
    ok('return-keeps-original-journal', originalAfter.rows[0].is_posted === true && JSON.stringify(originalLines.rows) === JSON.stringify(originalLinesAfter.rows) && returned.json.journal.balanced && returned.json.journal.lines.some((line) => Number(line.account_id) === accounts[0] && Number(line.debit_amount) === 12));
    const tooMuch = await call('POST', '/finance/inventory/returns', {
      document_id: issue.json.document.document_id,
      client_request_id: 'return-too-much',
      reason: 'زيادة',
      lines: [{ item_id: itemId, warehouse_id: whId, quantity: 3 }]
    });
    ok('return-over-blocked', tooMuch.status === 409, String(tooMuch.status));
    const returnReplay = await call('POST', '/finance/inventory/returns', {
      document_id: issue.json.document.document_id,
      client_request_id: 'return-1',
      reason: 'مرتجع عميل',
      lines: [{ item_id: itemId, warehouse_id: whId, quantity: 2 }]
    });
    const row6 = (await call('GET', '/finance/inventory/balances')).json.balances.find((row) => row.item_id === itemId);
    ok('return-replay', returnReplay.json.replayed === true && Number(row6.qty) === 18);
    const backTrace = await call('GET', '/finance/inventory/trace?from_type=JOURNAL_ENTRY&from_id=' + originalEntryId);
    ok('trace-back', backTrace.status === 200 && (backTrace.json.nodes || []).some((node) => node.type === 'SALES_INVOICE' || node.type === 'STOCK_DOCUMENT'));

    const removedMove = await call('DELETE', '/finance/inventory/movements/1');
    ok('movement-delete-blocked', removedMove.status === 409);
    const removedItem = await call('DELETE', '/finance/inventory/items/' + itemId);
    ok('linked-item-delete-blocked', removedItem.status === 409, removedItem.json && removedItem.json.error);
    const copied = await call('POST', '/finance/inventory/items/' + itemId + '/copy', { sku: 'LNK1-COPY' });
    const removedCopy = await call('DELETE', '/finance/inventory/items/' + copied.json.item.item_id);
    ok('unused-copy-deleted', copied.status === 201 && removedCopy.status === 200, String(removedCopy.status));
    const removedUnit = await call('DELETE', '/finance/inventory/units/' + spare.json.unit.unit_id);
    ok('unused-unit-deleted', removedUnit.status === 200);
    const usedUnit = await call('DELETE', '/finance/inventory/units/' + unit.json.unit.unit_id);
    ok('used-unit-blocked', usedUnit.status === 409);
    const bulk = await call('POST', '/finance/inventory/bulk', { record_type: 'item', action: 'deactivate', ids: [itemId, 999999] });
    const afterBulk = await call('GET', '/finance/inventory/items/' + itemId);
    ok('bulk-partial', bulk.status === 200 && bulk.json.updated === 1 && bulk.json.failed === 1 && afterBulk.json.item.is_active === false, JSON.stringify(bulk.json && { updated: bulk.json.updated, failed: bulk.json.failed }));
    const audit = await call('GET', '/finance/inventory/audit?record_type=item&record_id=' + itemId);
    ok('audit-history', audit.status === 200 && audit.json.audit.some((row) => row.action === 'deactivate' && row.actor === 'stock-link@local.test' && row.before_data && row.after_data));
    const unauth = await call('DELETE', '/finance/inventory/items/' + itemId, null, { 'x-test-unauth': '1' });
    ok('unauth-blocked', unauth.status === 401, String(unauth.status));
    const other = await call('GET', '/finance/inventory/items', null, { 'x-test-entity': 'INV-LINK-OTHER' });
    const otherReceipt = await call('POST', '/finance/inventory/receipts', {
      po_id: po.json.order.po_id,
      warehouse_id: whId,
      client_request_id: 'other-entity',
      lines: [{ item_id: itemId, quantity: 1, unit_cost: 1 }]
    }, { 'x-test-entity': 'INV-LINK-OTHER' });
    ok('other-entity-blocked', other.json.count === 0 && otherReceipt.status === 404, String(otherReceipt.status));
    const manual = await call('POST', '/finance/inventory/items', { sku: 'LNKM', name_ar: 'يدوي', unit: 'PCS', sale_price: 1 });
    await call('POST', '/finance/inventory/bulk', { record_type: 'item', action: 'activate', ids: [itemId] });
    const opening = await call('POST', '/finance/inventory/movements', {
      item_id: manual.json.item.item_id,
      warehouse_id: whId,
      movement_type: 'OPENING',
      quantity: 2,
      unit_cost: 3,
      client_request_id: 'manual-opening'
    });
    ok('manual-has-no-journal', opening.status === 201 && opening.json.journal_posted === false, String(opening.status) + ' ' + (opening.json && opening.json.error));
  } catch (error) {
    ok('unexpected', false, error.stack || error.message);
  } finally {
    try { await cleanup(); } catch (error) { console.error('cleanup', error.message); }
    server.close();
    await db.pool.end();
  }
  const failed = results.filter((row) => !row.ok);
  console.log(`stock-link ${results.length - failed.length}/${results.length}`);
  process.exit(failed.length ? 1 : 0);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
