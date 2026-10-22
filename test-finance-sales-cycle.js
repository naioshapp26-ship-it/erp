'use strict';

/**
 * Real local cycle: customer → invoice → collection → reload from PostgreSQL.
 * Uses the app database (DATABASE_URL). Does not enable FINANCE_POST_* flags.
 */

const http = require('http');
const { Client } = require('pg');

const PORT = Number(process.env.PORT || 3000);
const BASE = `http://127.0.0.1:${PORT}`;
const results = [];

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
          resolve({ status: res.statusCode, json, raw: raw.slice(0, 400), headers: res.headers });
        });
      }
    );
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

function customerBody(stamp, name) {
  return {
    customer_name_ar: name,
    customer_type: 'COMPANY',
    company_name: `منشأة الدورة ${stamp}`,
    website: 'https://cycle.example',
    email: `cycle-${stamp}@example.com`,
    email_secondary: `cycle2-${stamp}@example.com`,
    mobile: '0500000001',
    mobile_secondary: '0500000002',
    tax_number: `3${String(stamp).slice(-14).padStart(14, '0')}`,
    street_name: 'شارع الاختبار',
    city: 'الرياض',
    district: 'العليا',
    building_number: '1234',
    postal_code: '12211',
    country: 'السعودية',
    shipping_copy_billing: true,
    credit_limit: 10000,
    entity_id: 'HQ001',
    entity_type: 'HQ'
  };
}

async function main() {
  const login = await httpJson('POST', '/api/auth/login', {
    email: 'admin@naiosh.com',
    password: 'Admin@123'
  });
  const setCookie = login.headers['set-cookie'] || [];
  const cookie = Array.isArray(setCookie) ? setCookie.map((c) => c.split(';')[0]).join('; ') : '';
  const token = login.json?.data?.session?.token || (cookie.match(/authToken=([^;]+)/) || [])[1] || '';
  login.status === 200 && token ? pass('login', login.json?.data?.user?.email || '') : fail('login', `${login.status} ${login.raw}`);
  const auth = { Authorization: `Bearer ${token}`, Cookie: cookie };

  const stamp = Date.now();
  const name = `عميل دورة ${stamp}`;
  const created = await httpJson('POST', '/finance/customers', customerBody(stamp, name), auth);
  const customer = created.json?.customer;
  created.status === 201 && customer?.customer_id
    ? pass('customer-create', `${customer.customer_code} #${customer.customer_id}`)
    : fail('customer-create', `${created.status} ${created.json?.error || created.raw}`);
  if (!customer?.customer_id) return finish(1);

  const listed = await httpJson('GET', `/finance/customers?q=${encodeURIComponent(name)}`, null, auth);
  const found = (listed.json?.customers || []).some((c) => c.customer_id === customer.customer_id);
  // q may be client-side only; fall back to full list membership
  const listedAll = found ? listed : await httpJson('GET', '/finance/customers?limit=500', null, auth);
  const inList = (listedAll.json?.customers || []).some((c) => Number(c.customer_id) === Number(customer.customer_id));
  inList ? pass('customer-list') : fail('customer-list', listedAll.json?.error || String(listedAll.status));

  const editedName = `${name} معدّل`;
  const edited = await httpJson('PUT', `/finance/customers/${customer.customer_id}`, {
    ...customerBody(stamp, editedName),
    customer_code: customer.customer_code
  }, auth);
  edited.status === 200 && edited.json?.customer?.customer_name_ar === editedName
    ? pass('customer-edit', edited.json.customer.customer_name_ar)
    : fail('customer-edit', `${edited.status} ${edited.json?.error || edited.raw}`);

  const inv = await httpJson('POST', '/finance/invoices', {
    customer_id: customer.customer_id,
    invoice_date: '2026-10-22',
    due_date: '2026-11-21',
    entity_id: 'HQ001',
    entity_type: 'HQ',
    allow_partial_payment: true,
    notes: `دورة ${stamp}`,
    lines: [{ item_name: 'خدمة دورة مالية', quantity: 1, unit_price: 250, tax_percentage: 0, discount_percentage: 0 }]
  }, auth);
  const invoice = inv.json?.invoice;
  (inv.status === 201 && invoice?.invoice_id)
    ? pass('invoice-create', `${invoice.invoice_number} total=${invoice.total_amount}`)
    : fail('invoice-create', `${inv.status} ${inv.json?.error || inv.raw}`);
  if (!invoice?.invoice_id) return finish(1);

  const search = await httpJson('GET', `/finance/invoices?q=${encodeURIComponent(invoice.invoice_number)}`, null, auth);
  const searched = (search.json?.invoices || []).some((row) => row.invoice_id === invoice.invoice_id);
  searched ? pass('invoice-search', invoice.invoice_number) : fail('invoice-search', search.json?.error || String(search.status));

  const noteEdit = await httpJson('PUT', `/finance/invoices/${invoice.invoice_id}`, {
    notes: `ملاحظة بعد الترحيل ${stamp}`,
    due_date: '2026-11-21',
    total_amount: invoice.total_amount,
    status: invoice.status
  }, auth);
  noteEdit.status === 200 && noteEdit.json?.invoice?.notes?.includes('ملاحظة بعد الترحيل')
    ? pass('invoice-edit-notes')
    : fail('invoice-edit-notes', `${noteEdit.status} ${noteEdit.json?.error || noteEdit.raw}`);

  const amountEdit = await httpJson('PUT', `/finance/invoices/${invoice.invoice_id}`, {
    total_amount: Number(invoice.total_amount) + 50
  }, auth);
  amountEdit.status === 409
    ? pass('invoice-amount-locked', amountEdit.json?.code || amountEdit.json?.error)
    : fail('invoice-amount-locked', `${amountEdit.status} ${amountEdit.json?.error || amountEdit.raw}`);

  const del = await httpJson('DELETE', `/finance/invoices/${invoice.invoice_id}`, null, auth);
  del.status === 409
    ? pass('invoice-delete-locked', del.json?.code || '')
    : fail('invoice-delete-locked', `${del.status} ${del.json?.error || del.raw}`);

  const payAmount = Number(invoice.total_amount);
  const pay = await httpJson('POST', '/finance/payments', {
    customer_id: customer.customer_id,
    payment_date: '2026-10-22',
    payment_amount: payAmount,
    payment_method: 'CASH',
    payment_type: 'FULL',
    entity_id: 'HQ001',
    entity_type: 'HQ',
    notes: `تحصيل دورة ${stamp}`,
    allocations: [{ invoice_id: invoice.invoice_id, allocated_amount: payAmount }]
  }, auth);
  const payment = pay.json?.payment;
  (pay.status === 201 && payment?.payment_id)
    ? pass('collection-create', payment.payment_number)
    : fail('collection-create', `${pay.status} ${pay.json?.error || pay.raw}`);
  if (!payment?.payment_id) return finish(1);

  const afterPay = await httpJson('GET', `/finance/invoices/${invoice.invoice_id}`, null, auth);
  const paidRow = afterPay.json?.invoice;
  Number(paidRow?.remaining_amount) === 0 && String(paidRow?.status).toUpperCase() === 'PAID'
    ? pass('invoice-after-collection', `paid=${paidRow.paid_amount} rem=${paidRow.remaining_amount}`)
    : fail('invoice-after-collection', JSON.stringify({
      status: paidRow?.status,
      paid: paidRow?.paid_amount,
      rem: paidRow?.remaining_amount
    }));

  const earlyCancel = await httpJson('POST', `/finance/invoices/${invoice.invoice_id}/cancel`, { reason: 'محاولة إلغاء قبل إلغاء التحصيل' }, auth);
  earlyCancel.status === 409
    ? pass('invoice-cancel-blocked-while-collected', earlyCancel.json?.code || '')
    : fail('invoice-cancel-blocked-while-collected', `${earlyCancel.status} ${earlyCancel.json?.error || earlyCancel.raw}`);

  const payNote = await httpJson('PUT', `/finance/payments/${payment.payment_id}`, {
    notes: `ملاحظة تحصيل ${stamp}`,
    payment_amount: payAmount,
    payment_date: '2026-10-22',
    payment_method: 'CASH',
    status: payment.status
  }, auth);
  payNote.status === 200
    ? pass('collection-edit-notes')
    : fail('collection-edit-notes', `${payNote.status} ${payNote.json?.error || payNote.raw}`);

  const cancelPay = await httpJson('POST', `/finance/payments/${payment.payment_id}/cancel`, {
    reason: 'إلغاء تحصيل الدورة الاختبارية'
  }, auth);
  cancelPay.status === 200
    ? pass('collection-cancel', cancelPay.json?.message || '')
    : fail('collection-cancel', `${cancelPay.status} ${cancelPay.json?.error || cancelPay.raw}`);

  const restored = await httpJson('GET', `/finance/invoices/${invoice.invoice_id}`, null, auth);
  const restoredRow = restored.json?.invoice;
  Number(restoredRow?.remaining_amount) === payAmount && String(restoredRow?.payment_status).toUpperCase() === 'UNPAID'
    ? pass('invoice-balance-restored', `rem=${restoredRow.remaining_amount} pay=${restoredRow.payment_status}`)
    : fail('invoice-balance-restored', JSON.stringify({
      rem: restoredRow?.remaining_amount,
      paid: restoredRow?.paid_amount,
      payment_status: restoredRow?.payment_status,
      status: restoredRow?.status
    }));

  const cancelInv = await httpJson('POST', `/finance/invoices/${invoice.invoice_id}/cancel`, {
    reason: 'إلغاء فاتورة الدورة بعد إلغاء التحصيل'
  }, auth);
  cancelInv.status === 200 && String(cancelInv.json?.invoice?.status).toUpperCase() === 'CANCELLED'
    ? pass('invoice-cancel')
    : fail('invoice-cancel', `${cancelInv.status} ${cancelInv.json?.error || cancelInv.raw}`);

  const collectCancelled = await httpJson('POST', '/finance/payments', {
    customer_id: customer.customer_id,
    payment_date: '2026-10-22',
    payment_amount: payAmount,
    payment_method: 'CASH',
    entity_id: 'HQ001',
    entity_type: 'HQ',
    allocations: [{ invoice_id: invoice.invoice_id, allocated_amount: payAmount }]
  }, auth);
  collectCancelled.status >= 400
    ? pass('collection-rejects-cancelled-invoice', collectCancelled.json?.code || String(collectCancelled.status))
    : fail('collection-rejects-cancelled-invoice', String(collectCancelled.status));

  const orphan = await httpJson('POST', '/finance/customers', customerBody(`${stamp}9`, `عميل بلا فواتير ${stamp}`), auth);
  const orphanId = orphan.json?.customer?.customer_id;
  orphanId ? pass('orphan-customer', String(orphanId)) : fail('orphan-customer', orphan.json?.error || String(orphan.status));
  if (orphanId) {
    const removed = await httpJson('DELETE', `/finance/customers/${orphanId}?entity_id=HQ001`, null, auth);
    removed.status === 200 ? pass('orphan-delete', removed.json?.message || '') : fail('orphan-delete', `${removed.status} ${removed.json?.error || removed.raw}`);
    const gone = await httpJson('GET', '/finance/customers?limit=500', null, auth);
    const still = (gone.json?.customers || []).some((c) => Number(c.customer_id) === Number(orphanId));
    still ? fail('orphan-absent') : pass('orphan-absent');
  }

  const dbUrl = process.env.DATABASE_URL || 'postgresql://vendowor_erp_user:vendowor_local_dev@127.0.0.1:5432/vendowor_erp';
  const client = new Client({ connectionString: dbUrl, ssl: false });
  await client.connect();
  const proof = await client.query(
    `SELECT
       (SELECT customer_name_ar FROM finance_customers WHERE customer_id = $1) AS customer_name,
       (SELECT status FROM finance_invoices WHERE invoice_id = $2) AS invoice_status,
       (SELECT status FROM finance_payments WHERE payment_id = $3) AS payment_status,
       (SELECT COUNT(*)::int FROM finance_journal_entries WHERE reference_type = 'JOURNAL_REVERSAL') AS reversals`,
    [customer.customer_id, invoice.invoice_id, payment.payment_id]
  );
  const row = proof.rows[0];
  row.customer_name === editedName && row.invoice_status === 'CANCELLED' && row.payment_status === 'CANCELLED' && row.reversals >= 1
    ? pass('postgres-proof', JSON.stringify(row))
    : fail('postgres-proof', JSON.stringify(row));
  await client.end();

  const reloadedCustomer = await httpJson('GET', '/finance/customers?limit=500', null, auth);
  const persisted = (reloadedCustomer.json?.customers || []).find((c) => Number(c.customer_id) === Number(customer.customer_id));
  persisted && persisted.customer_name_ar === editedName
    ? pass('customer-persists-after-reload', persisted.customer_name_ar)
    : fail('customer-persists-after-reload');

  return finish(results.some((r) => !r.ok) ? 1 : 0);
}

function finish(code) {
  const summary = {
    passed: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok).length,
    results
  };
  console.log('\nSUMMARY', summary.passed, 'pass /', summary.failed, 'fail');
  require('fs').mkdirSync('/opt/cursor/artifacts', { recursive: true });
  require('fs').writeFileSync('/opt/cursor/artifacts/finance-sales-cycle.json', JSON.stringify(summary, null, 2));
  process.exit(code);
}

main().catch((err) => {
  console.error(err);
  fail('runtime', err.message);
  finish(1);
});
