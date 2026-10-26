'use strict';

/**
 * Isolated E2E: purchase orders + vendor invoices operational cycle.
 * Target: finance_pages_isolated on PORT (default 3083). No production writes.
 */
const fs = require('fs');
const http = require('http');

const PORT = Number(process.env.PORT || 3083);
const BASE = process.env.APP_BASE_URL || `http://127.0.0.1:${PORT}`;
const ART = '/opt/cursor/artifacts';
const ENTITY = 'HQ001';
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

async function main() {
  const stamp = Date.now();
  const login = await httpReq('POST', '/api/auth/login', {
    email: 'admin@naiosh.com',
    password: 'Admin@123'
  });
  const setCookie = login.headers['set-cookie'] || [];
  const cookie = Array.isArray(setCookie) ? setCookie.map((c) => c.split(';')[0]).join('; ') : '';
  const token = login.json?.data?.session?.token || login.json?.token || '';
  if (login.status === 200 && token) pass('login');
  else fail('login', String(login.status) + ' ' + (login.raw || '').slice(0, 120));

  const auth = {
    Authorization: `Bearer ${token}`,
    Cookie: cookie,
    'x-entity-id': ENTITY,
    'x-entity-type': 'HQ',
    'x-user-email': 'admin@naiosh.com'
  };

  const page = await httpReq('GET', '/finance/purchase-orders.html', null, auth);
  const pageNeedles = [
    'finance-workbench.css',
    'fw-kpis',
    'fw-drawer',
    'أمر شراء جديد',
    'فواتير الموردين',
    '/finance/purchases/orders',
    'لا أوامر شراء مطابقة',
    'ErpDialog'
  ];
  if (page.status !== 200) fail('page-html', `HTTP ${page.status}`);
  else {
    const missing = pageNeedles.filter((n) => !page.raw.includes(n));
    missing.length ? fail('page-html', `missing ${missing.join(', ')}`) : pass('page-html');
  }

  // Reject PO without lines
  const noLines = await httpReq('POST', '/finance/purchases/orders', {
    vendor_name: 'مورد بلا بنود',
    entity_id: ENTITY,
    total_amount: 100
  }, auth);
  noLines.status === 400 && noLines.json?.code === 'LINES_REQUIRED'
    ? pass('reject-po-without-lines')
    : fail('reject-po-without-lines', `${noLines.status} ${JSON.stringify(noLines.json)}`);

  const vendorName = `مورد اختبار PO-${stamp}`;
  const create = await httpReq('POST', '/finance/purchases/orders', {
    entity_id: ENTITY,
    vendor_name: vendorName,
    order_date: '2026-10-26',
    expected_date: '2026-11-05',
    currency_code: 'SAR',
    notes: 'isolated-e2e',
    lines: [
      { item_code: 'RM-01', item_name: 'مادة خام أ', quantity: 4, unit_price: 100, tax_pct: 15 },
      { item_code: 'RM-02', item_name: 'مادة خام ب', quantity: 2, unit_price: 50, tax_pct: 15 }
    ]
  }, auth);

  const order = create.json?.order;
  const lines = create.json?.lines || [];
  const expectedSub = 4 * 100 + 2 * 50; // 500
  const expectedTax = expectedSub * 0.15; // 75
  const expectedTotal = expectedSub + expectedTax; // 575
  create.status === 201 && order && Number(order.total_amount) === expectedTotal && lines.length === 2
    ? pass('create-po-with-lines', `${order.po_number} total=${order.total_amount}`)
    : fail('create-po-with-lines', `${create.status} ${JSON.stringify(create.json)}`);

  const poId = order?.po_id;
  const detail1 = await httpReq('GET', `/finance/purchases/orders/${poId}?entity_id=${ENTITY}`, null, auth);
  detail1.status === 200 && detail1.json?.lines?.length === 2
    ? pass('reload-po-detail', detail1.json.order.po_number)
    : fail('reload-po-detail', `${detail1.status}`);

  const draftInvoice = await httpReq('POST', '/finance/purchases/vendor-invoices', {
    entity_id: ENTITY,
    vendor_name: vendorName,
    po_id: poId,
    total_amount: 100,
    tax_amount: 0,
    subtotal: 100
  }, auth);
  draftInvoice.status === 409 && draftInvoice.json?.code === 'PO_NOT_READY'
    ? pass('block-invoice-on-draft-po')
    : fail('block-invoice-on-draft-po', `${draftInvoice.status} ${JSON.stringify(draftInvoice.json)}`);

  const approve = await httpReq('POST', `/finance/purchases/orders/${poId}/approve`, { entity_id: ENTITY }, auth);
  const approveOk = approve.status === 200 && String(approve.json?.order?.status || '').toUpperCase() === 'APPROVED';
  approveOk ? pass('approve-po') : fail('approve-po', `${approve.status} ${JSON.stringify(approve.json)}`);

  // Re-read after approve — loadPoDetail may overwrite order in response
  const afterApprove = await httpReq('GET', `/finance/purchases/orders/${poId}?entity_id=${ENTITY}`, null, auth);
  String(afterApprove.json?.order?.status).toUpperCase() === 'APPROVED'
    ? pass('approve-persisted')
    : fail('approve-persisted', String(afterApprove.json?.order?.status));

  const invNo = `VI-E2E-${stamp}`;
  const inv = await httpReq('POST', '/finance/purchases/vendor-invoices', {
    entity_id: ENTITY,
    invoice_number: invNo,
    vendor_name: vendorName,
    po_id: poId,
    invoice_date: '2026-10-26',
    due_date: '2026-11-26',
    subtotal: expectedSub,
    tax_amount: expectedTax,
    total_amount: expectedTotal,
    currency_code: 'SAR'
  }, auth);
  const invoice = inv.json?.invoice;
  inv.status === 201 && invoice
    ? pass('create-vendor-invoice', invoice.invoice_number)
    : fail('create-vendor-invoice', `${inv.status} ${JSON.stringify(inv.json)}`);

  const dup = await httpReq('POST', '/finance/purchases/vendor-invoices', {
    entity_id: ENTITY,
    invoice_number: invNo,
    vendor_name: vendorName,
    po_id: poId,
    total_amount: 10,
    subtotal: 10,
    tax_amount: 0
  }, auth);
  dup.status === 409 && (dup.json?.code === 'DUPLICATE_PO_INVOICE' || dup.json?.code === 'DUPLICATE_INVOICE_NUMBER')
    ? pass('reject-duplicate-invoice')
    : fail('reject-duplicate-invoice', `${dup.status} ${JSON.stringify(dup.json)}`);

  const viId = invoice?.vendor_invoice_id;
  const invApprove = await httpReq('POST', `/finance/purchases/vendor-invoices/${viId}/approve`, { entity_id: ENTITY }, auth);
  String(invApprove.json?.invoice?.status).toUpperCase() === 'APPROVED'
    ? pass('approve-vendor-invoice')
    : fail('approve-vendor-invoice', `${invApprove.status} ${JSON.stringify(invApprove.json)}`);

  const hardDel = await httpReq('DELETE', `/finance/purchases/vendor-invoices/${viId}?entity_id=${ENTITY}`, null, auth);
  hardDel.status === 409 && hardDel.json?.code === 'NO_HARD_DELETE'
    ? pass('block-delete-approved-invoice')
    : fail('block-delete-approved-invoice', `${hardDel.status} ${JSON.stringify(hardDel.json)}`);

  const payPartial = await httpReq('POST', `/finance/purchases/vendor-invoices/${viId}/pay`, {
    entity_id: ENTITY,
    amount: 200,
    method: 'BANK_TRANSFER',
    reference: `PAY-${stamp}-1`
  }, auth);
  String(payPartial.json?.invoice?.status).toUpperCase() === 'PARTIAL'
    && Number(payPartial.json?.remaining_amount) === expectedTotal - 200
    ? pass('partial-payment', `remaining=${payPartial.json.remaining_amount}`)
    : fail('partial-payment', `${payPartial.status} ${JSON.stringify(payPartial.json)}`);

  const overPay = await httpReq('POST', `/finance/purchases/vendor-invoices/${viId}/pay`, {
    entity_id: ENTITY,
    amount: 99999
  }, auth);
  overPay.status === 409 && overPay.json?.code === 'OVER_PAYMENT'
    ? pass('block-over-payment')
    : fail('block-over-payment', `${overPay.status} ${JSON.stringify(overPay.json)}`);

  const payRest = await httpReq('POST', `/finance/purchases/vendor-invoices/${viId}/pay`, {
    entity_id: ENTITY,
    amount: expectedTotal - 200,
    method: 'CASH',
    reference: `PAY-${stamp}-2`
  }, auth);
  String(payRest.json?.invoice?.status).toUpperCase() === 'PAID'
    && Number(payRest.json?.remaining_amount) === 0
    ? pass('full-payment')
    : fail('full-payment', `${payRest.status} ${JSON.stringify(payRest.json)}`);

  const receive = await httpReq('POST', `/finance/purchases/orders/${poId}/receive`, { entity_id: ENTITY }, auth);
  String(receive.json?.order?.status || afterApprove.json?.order?.status).toUpperCase();
  const afterRecv = await httpReq('GET', `/finance/purchases/orders/${poId}?entity_id=${ENTITY}`, null, auth);
  String(afterRecv.json?.order?.status).toUpperCase() === 'RECEIVED'
    ? pass('receive-po')
    : fail('receive-po', `${receive.status} ${JSON.stringify(receive.json)} / ${afterRecv.json?.order?.status}`);

  Number(afterRecv.json?.order?.invoiced_amount) === expectedTotal
    ? pass('po-invoiced-amount', String(afterRecv.json.order.invoiced_amount))
    : fail('po-invoiced-amount', JSON.stringify(afterRecv.json?.order));

  const cancelBlocked = await httpReq('POST', `/finance/purchases/orders/${poId}/cancel`, {
    entity_id: ENTITY,
    reason: 'should fail'
  }, auth);
  cancelBlocked.status === 409
    ? pass('block-cancel-received-po')
    : fail('block-cancel-received-po', `${cancelBlocked.status} ${JSON.stringify(cancelBlocked.json)}`);

  // Second PO: draft delete + cancel path
  const draft = await httpReq('POST', '/finance/purchases/orders', {
    entity_id: ENTITY,
    vendor_name: `${vendorName}-DRAFT`,
    lines: [{ item_name: 'بند مؤقت', quantity: 1, unit_price: 10, tax_pct: 0 }]
  }, auth);
  const draftId = draft.json?.order?.po_id;
  const delDraft = await httpReq('DELETE', `/finance/purchases/orders/${draftId}?entity_id=${ENTITY}`, null, auth);
  delDraft.status === 200 ? pass('delete-draft-po') : fail('delete-draft-po', `${delDraft.status}`);

  const cancelPo = await httpReq('POST', '/finance/purchases/orders', {
    entity_id: ENTITY,
    vendor_name: `${vendorName}-CXL`,
    lines: [{ item_name: 'بند للإلغاء', quantity: 1, unit_price: 20, tax_pct: 0 }]
  }, auth);
  const cxlId = cancelPo.json?.order?.po_id;
  await httpReq('POST', `/finance/purchases/orders/${cxlId}/approve`, { entity_id: ENTITY }, auth);
  const noReason = await httpReq('POST', `/finance/purchases/orders/${cxlId}/cancel`, { entity_id: ENTITY }, auth);
  noReason.status === 400 && noReason.json?.code === 'REASON_REQUIRED'
    ? pass('cancel-requires-reason')
    : fail('cancel-requires-reason', `${noReason.status} ${JSON.stringify(noReason.json)}`);
  const cxl = await httpReq('POST', `/finance/purchases/orders/${cxlId}/cancel`, {
    entity_id: ENTITY,
    reason: 'اختبار إلغاء معزول'
  }, auth);
  String(cxl.json?.order?.status).toUpperCase() === 'CANCELLED' ||
  (await httpReq('GET', `/finance/purchases/orders/${cxlId}?entity_id=${ENTITY}`, null, auth)).json?.order?.status === 'CANCELLED'
    ? pass('cancel-approved-po')
    : fail('cancel-approved-po', `${cxl.status} ${JSON.stringify(cxl.json)}`);

  const summary = await httpReq('GET', `/finance/purchases/summary?entity_id=${ENTITY}`, null, auth);
  summary.status === 200 && summary.json?.success && summary.json.orders && summary.json.invoices
    ? pass('summary-kpis', `orders=${summary.json.orders.total} invoices=${summary.json.invoices.total}`)
    : fail('summary-kpis', `${summary.status} ${summary.raw.slice(0, 200)}`);

  const listReload = await httpReq('GET', `/finance/purchases/orders?entity_id=${ENTITY}`, null, auth);
  const found = (listReload.json?.orders || []).some((o) => o.po_id === poId && String(o.status).toUpperCase() === 'RECEIVED');
  found ? pass('postgres-persistence-after-reload') : fail('postgres-persistence-after-reload');

  const audit = afterRecv.json?.order?.audit_log;
  const auditArr = Array.isArray(audit) ? audit : (() => { try { return JSON.parse(audit); } catch { return []; } })();
  const actions = auditArr.map((e) => String(e.action || '').toLowerCase());
  actions.some((a) => a === 'approve' || a === 'approved') &&
  actions.some((a) => a === 'receive' || a === 'received')
    ? pass('po-audit-trail', `${auditArr.length} events`)
    : fail('po-audit-trail', JSON.stringify(auditArr));

  const viAfter = await httpReq('GET', `/finance/purchases/vendor-invoices/${viId}?entity_id=${ENTITY}`, null, auth);
  const viAudit = viAfter.json?.invoice?.audit_log;
  const viArr = Array.isArray(viAudit) ? viAudit : (() => { try { return JSON.parse(viAudit); } catch { return []; } })();
  viArr.some((e) => e.action === 'payment')
    ? pass('invoice-payment-audit')
    : fail('invoice-payment-audit', JSON.stringify(viArr));

  const passed = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok).length;
  const out = {
    generated_at: new Date().toISOString(),
    base: BASE,
    entity: ENTITY,
    passed,
    failed,
    total: results.length,
    results
  };
  fs.writeFileSync(`${ART}/finance-purchases-ops-test-results.json`, JSON.stringify(out, null, 2));
  fs.writeFileSync(
    `${ART}/finance-purchases-ops-test-run.log`,
    results.map((r) => `${r.ok ? 'PASS' : 'FAIL'}  ${r.name}${r.detail ? ` — ${r.detail}` : ''}`).join('\n') + `\n\n${passed}/${results.length} passed\n`
  );
  console.log(`\n${passed}/${results.length} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
