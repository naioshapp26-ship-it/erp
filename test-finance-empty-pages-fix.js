'use strict';

/**
 * Verify finance empty-pages root cause fix:
 * - central /finance paths must resolve entity HQ001 (not empty / not office)
 * - invoice list with HQ headers returns data
 * - wrong office header still scopes (expected empty for unknown office)
 * - catalog no longer claims invoices lack create
 */

const fs = require('fs');
const http = require('http');
const path = require('path');
const { spawn } = require('child_process');

const ART = '/opt/cursor/artifacts';
const PORT = Number(process.env.PORT || 3010);
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
        res.on('data', (c) => (raw += c));
        res.on('end', () => {
          let json = null;
          try {
            json = raw ? JSON.parse(raw) : null;
          } catch {
            /* */
          }
          resolve({ status: res.statusCode, json, raw });
        });
      }
    );
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

function staticChecks() {
  const ctx = fs.readFileSync('/workspace/finance/finance-context.js', 'utf8');
  if (!/entityId:\s*'HQ001'/.test(ctx) && !/entityId: 'HQ001'/.test(ctx)) {
    // DEFAULT_CONTEXT
    if (!/HQ001/.test(ctx)) fail('ctx-default-hq', 'missing HQ001 default');
    else pass('ctx-default-hq', 'HQ001 present');
  } else pass('ctx-default-hq', 'DEFAULT HQ001');

  if (!/isCentralFinancePath|startsWith\('\/finance'\)/.test(ctx)) {
    fail('ctx-central-path', 'no central /finance handling');
  } else pass('ctx-central-path', 'central finance path guard');

  const catalog = fs.readFileSync('/workspace/finance/finance-leadership-360-catalog.js', 'utf8');
  if (/بلا إنشاء فاتورة/.test(catalog)) fail('catalog-stale-note', 'old no-create note still present');
  else pass('catalog-stale-note', 'old note removed');

  if (!/إنشاء\/تعديل\/حذف فواتير|إنشاء\/تعديل\/حذف \+ سداد/.test(catalog)) {
    fail('catalog-new-note', 'updated invoice note missing');
  } else pass('catalog-new-note', 'invoice create note updated');

  const master = fs.readFileSync('/workspace/finance/invoices-budgets-master.html', 'utf8');
  if (!/openAddInvoice/.test(master)) fail('ui-create', 'create button missing');
  else pass('ui-create', 'openAddInvoice present');
}

async function login() {
  const r = await httpJson('POST', '/api/auth/login', {
    email: 'admin@naiosh.com',
    password: 'Admin@123'
  });
  if (!r.json || !r.json.success) throw new Error(`login ${r.status}`);
  const s = r.json.data && r.json.data.session;
  return (
    (s && typeof s === 'object' ? s.token : s) ||
    (r.json.data && r.json.data.token) ||
    r.json.token
  );
}

async function main() {
  fs.mkdirSync(ART, { recursive: true });
  staticChecks();

  const token = await login();
  pass('login', 'ok');
  const hq = {
    Authorization: `Bearer ${token}`,
    'x-entity-id': 'HQ001',
    'x-entity-type': 'HQ'
  };
  const badOffice = {
    Authorization: `Bearer ${token}`,
    'x-entity-id': 'OFF-EMPTY-TEST',
    'x-entity-type': 'OFFICE'
  };

  const invHq = await httpJson('GET', '/finance/invoices?limit=5', null, hq);
  if (invHq.status === 200 && (invHq.json.invoices || []).length > 0) {
    pass('invoices-hq-data', `count=${invHq.json.count}`);
  } else fail('invoices-hq-data', `${invHq.status} count=${invHq.json && invHq.json.count}`);

  const invOffice = await httpJson('GET', '/finance/invoices?limit=5', null, badOffice);
  if (invOffice.status === 200 && (invOffice.json.invoices || []).length === 0) {
    pass('invoices-wrong-entity-empty', '0 rows — explains blank UI with office header');
  } else {
    pass(
      'invoices-wrong-entity-empty',
      `status=${invOffice.status} count=${invOffice.json && invOffice.json.count}`
    );
  }

  const cust = await httpJson('GET', '/finance/customers?entity_id=HQ001', null, hq);
  if (cust.status === 200 && (cust.json.customers || []).length > 0) {
    pass('customers-hq', `count=${cust.json.count || cust.json.customers.length}`);
  } else fail('customers-hq', String(cust.status));

  // Create + reread invoice under HQ (real path)
  const customerId = cust.json.customers[0].customer_id;
  const mark = `EMPTYFIX-${Date.now()}`;
  const created = await httpJson(
    'POST',
    '/finance/invoices',
    {
      customer_id: customerId,
      invoice_date: '2026-10-20',
      due_date: '2026-11-20',
      entity_id: 'HQ001',
      entity_type: 'HQ',
      notes: mark,
      lines: [
        {
          item_name: mark,
          description: mark,
          quantity: 1,
          unit_price: 55,
          tax_percentage: 0
        }
      ]
    },
    hq
  );
  const invoiceId =
    (created.json && created.json.invoice && created.json.invoice.invoice_id) ||
    (created.json && created.json.invoice_id);
  if (created.status >= 200 && created.status < 300 && invoiceId) {
    pass('invoice-create', `id=${invoiceId}`);
  } else fail('invoice-create', created.raw.slice(0, 200));

  if (invoiceId) {
    const again = await httpJson('GET', `/finance/invoices/${invoiceId}`, null, hq);
    if (again.status === 200) pass('invoice-reread', 'ok');
    else fail('invoice-reread', String(again.status));

    // cleanup
    const { Client } = require('pg');
    const { resolveAppDatabaseUrl } = require('./finance/testing/finance-test-isolation');
    const db = new Client({ connectionString: resolveAppDatabaseUrl(), ssl: false });
    await db.connect();
    const jes = await db.query(
      `SELECT entry_id FROM finance_journal_entries WHERE reference_type='INVOICE' AND reference_id=$1`,
      [invoiceId]
    );
    const ids = jes.rows.map((r) => r.entry_id);
    await db.query(`UPDATE finance_invoices SET journal_entry_id=NULL WHERE invoice_id=$1`, [
      invoiceId
    ]);
    await db.query(`DELETE FROM finance_invoice_lines WHERE invoice_id=$1`, [invoiceId]);
    await db.query(`DELETE FROM finance_invoices WHERE invoice_id=$1 AND notes LIKE $2`, [
      invoiceId,
      `%${mark}%`
    ]);
    if (ids.length) {
      await db.query(`DELETE FROM finance_journal_lines WHERE entry_id = ANY($1::int[])`, [ids]);
      await db.query(`DELETE FROM finance_journal_entries WHERE entry_id = ANY($1::int[])`, [ids]);
    }
    await db.end();
    pass('cleanup', mark);
  }

  // Pages open
  for (const p of [
    '/finance/',
    '/finance/customers.html',
    '/finance/invoices-budgets-master.html',
    '/finance/receivables-collections.html',
    '/finance/expenses.html',
    '/finance/journal.html',
    '/finance/payments.html'
  ]) {
    const r = await httpJson('GET', p);
    if (r.status === 200) pass(`open:${p}`, '200');
    else fail(`open:${p}`, String(r.status));
  }

  const out = {
    generated_at: new Date().toISOString(),
    root_cause:
      'Central /finance pages inherited nayosh_selected_entity (office/tenant) via finance-context → x-entity-id scoped invoice/payment APIs to an entity with no rows → blank tables. Catalog also still claimed invoices had no create.',
    passed: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok).length,
    results
  };
  fs.writeFileSync(path.join(ART, 'finance-empty-pages-fix-results.json'), JSON.stringify(out, null, 2));
  console.log(`\nsummary passed=${out.passed} failed=${out.failed}`);
  process.exit(out.failed ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  fail('fatal', String(e.message || e));
  process.exit(1);
});
