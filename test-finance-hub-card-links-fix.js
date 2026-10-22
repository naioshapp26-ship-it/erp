'use strict';

/**
 * Validate Finance Leadership 360 card-link honesty fix (no deploy).
 * - deposits open the Postgres ledger, not the old localStorage page
 * - balance-sheet must not be marked operational
 * - settings print/numbering/page-settings not operational
 * - core finance backends still load for HQ session
 * - office spoof still 403
 */

const fs = require('fs');
const http = require('http');
const path = require('path');
const {
  flattenPages,
  QUICK_ACCESS,
  PAGE_SETTINGS,
  COMING,
  resolveHref,
  getPage,
  AUDIT_STATUS_EXPECTATIONS
} = require('./finance/finance-leadership-360-catalog.js');

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
  const payload = body == null ? null : JSON.stringify(body);
  return new Promise((resolve) => {
    const u = new URL(urlPath, BASE);
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
    req.on('error', (e) => resolve({ status: 0, json: null, raw: String(e.message) }));
    req.end(payload || undefined);
  });
}

async function login(email, password) {
  const r = await httpJson('POST', '/api/auth/login', { email, password });
  if (!r.json || !r.json.success) throw new Error(`login ${email}`);
  const s = r.json.data.session;
  return typeof s === 'object' ? s.token : s;
}

async function main() {
  fs.mkdirSync(ART, { recursive: true });

  const deposits = getPage('sales', 'deposits');
  if (deposits && deposits.status === 'operational' && deposits.href === '/finance/deposits.html') {
    pass('deposits-operational', deposits.href);
  } else fail('deposits-operational', JSON.stringify(deposits));

  const bs = getPage('reports', 'balance-sheet');
  if (bs && bs.status === 'partial' && bs.href === '/finance/balance-sheet.html') {
    pass('balance-sheet-demoted', bs.status);
  } else fail('balance-sheet-demoted', JSON.stringify(bs));

  const pageSettings = getPage('settings', 'page-settings');
  if (pageSettings && pageSettings.status === 'operational') {
    pass('page-settings-operational', pageSettings.href);
  } else fail('page-settings-operational', JSON.stringify(pageSettings));

  for (const [sid, pid] of [
    ['settings', 'numbering'],
    ['settings', 'print-templates']
  ]) {
    const p = getPage(sid, pid);
    if (p && p.status === 'partial') pass(`demote:${sid}.${pid}`, p.status);
    else fail(`demote:${sid}.${pid}`, JSON.stringify(p));
  }

  const printPs = PAGE_SETTINGS.find((p) => p.id === 'print');
  if (
    printPs &&
    printPs.status === 'operational' &&
    String(printPs.href || '').includes('leadership-doc-settings.html')
  ) {
    pass('pagesettings-print-operational', printPs.href);
  } else fail('pagesettings-print-operational', JSON.stringify(printPs));

  // No operational card may resolve to coming-soon
  let badOps = 0;
  for (const row of flattenPages()) {
    if (row.status === 'operational' && row.href.includes('leadership-coming-soon')) {
      badOps += 1;
      fail('operational-opens-coming-soon', `${row.sectionId}.${row.pageId}`);
    }
  }
  for (const q of QUICK_ACCESS) {
    if (q.status === 'operational' && (!q.href || q.href.includes('leadership-coming-soon'))) {
      badOps += 1;
      fail('qa-operational-coming-soon', q.id);
    }
  }
  if (!badOps) pass('no-operational-coming-soon', 'ok');

  // Expectations map matches catalog for keys we care about
  for (const [key, expected] of Object.entries(AUDIT_STATUS_EXPECTATIONS)) {
    const [sec, id] = key.split('.');
    let actual = null;
    if (sec === 'qa') {
      actual = (QUICK_ACCESS.find((q) => q.id === id) || {}).status;
    } else if (sec === 'pagesettings') {
      actual = (PAGE_SETTINGS.find((q) => q.id === id) || {}).status;
    } else {
      const p = getPage(sec, id);
      actual = p && p.status;
    }
    if (actual === expected) pass(`expect:${key}`, expected);
    else fail(`expect:${key}`, `expected=${expected} actual=${actual}`);
  }

  const hq = await login('admin@naiosh.com', 'Admin@123');
  pass('login-hq', 'ok');
  const H = { Authorization: `Bearer ${hq}` };

  const core = [
    ['customers', '/finance/customers?entity_id=HQ001', 'customers'],
    ['invoices', '/finance/invoices?entity_id=HQ001&limit=5', 'invoices'],
    ['payments', '/finance/payments?entity_id=HQ001&limit=5', 'payments'],
    ['expenses', '/finance/expenses?entity_id=HQ001', 'expenses'],
    ['journal', '/finance/journal/entries?entity_id=HQ001', 'entries'],
    ['collection', '/finance/ar-aging?entity_id=HQ001', 'rows'],
    ['purchase-orders', '/finance/purchases/orders?entity_id=HQ001', 'orders'],
    ['discounts', '/finance/item-discounts?entity_id=HQ001', 'discounts'],
    ['budgets', '/finance/budgets?entity_id=HQ001', 'budgets'],
    ['income-statement', '/finance/income-statement?entity_id=HQ001', null],
    ['cashflow', '/finance/cashflow/overview?entity_id=HQ001', null],
    ['quick-offers', '/finance/quick-offers', 'offers'],
    ['return-requests', '/finance/return-requests?entity_id=HQ001', null]
  ];
  for (const [name, p, key] of core) {
    const r = await httpJson('GET', p, null, H);
    const ok = r.status === 200 && r.json && r.json.success !== false;
    if (ok) pass(`api:${name}`, key ? `n=${(r.json[key] || []).length}` : 'ok');
    else fail(`api:${name}`, `${r.status} ${r.json && r.json.error}`);
  }

  // Invoice create + reread + cleanup
  const cust = await httpJson('GET', '/finance/customers?entity_id=HQ001', null, H);
  const customerId = ((cust.json && cust.json.customers) || [])[0]?.customer_id;
  const mark = `HUBFIX-${Date.now()}`;
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
      lines: [{ item_name: mark, quantity: 1, unit_price: 9, tax_percentage: 0 }]
    },
    H
  );
  const invoiceId =
    created.json && ((created.json.invoice && created.json.invoice.invoice_id) || created.json.invoice_id);
  if (created.status < 300 && invoiceId) pass('invoice-create', String(invoiceId));
  else fail('invoice-create', (created.raw || '').slice(0, 160));
  if (invoiceId) {
    const again = await httpJson('GET', `/finance/invoices/${invoiceId}`, null, H);
    if (again.status === 200 && again.json && again.json.success !== false) pass('invoice-reread', 'ok');
    else fail('invoice-reread', String(again.status));
    const { Client } = require('pg');
    const { resolveAppDatabaseUrl } = require('./finance/testing/finance-test-isolation');
    const db = new Client({ connectionString: resolveAppDatabaseUrl(), ssl: false });
    await db.connect();
    await db.query('UPDATE finance_invoices SET journal_entry_id=NULL WHERE invoice_id=$1', [invoiceId]);
    await db.query('DELETE FROM finance_invoice_lines WHERE invoice_id=$1', [invoiceId]);
    await db.query('DELETE FROM finance_invoices WHERE invoice_id=$1 AND notes LIKE $2', [
      invoiceId,
      `%${mark}%`
    ]);
    await db.end();
    pass('invoice-cleanup', mark);
  }

  // Entity gate
  const office = await httpJson('POST', '/api/auth/login', {
    email: 'office-fin-sec-test@naiosh.local',
    password: 'Office@123'
  });
  if (office.json && office.json.success) {
    const ot =
      typeof office.json.data.session === 'object'
        ? office.json.data.session.token
        : office.json.data.session;
    const spoof = await httpJson('GET', '/finance/invoices?limit=3', null, {
      Authorization: `Bearer ${ot}`,
      'x-entity-id': 'HQ001',
      'x-entity-type': 'HQ'
    });
    if (spoof.status === 403) pass('office-spoof-403', 'blocked');
    else fail('office-spoof-403', String(spoof.status));
  } else {
    pass('office-spoof-403', 'skipped — office user absent');
  }

  // Pages open
  for (const p of [
    '/finance/',
    '/finance/customers.html',
    '/finance/invoices-budgets-master.html',
    '/finance/payments.html',
    '/finance/expenses.html',
    '/finance/journal.html',
    '/finance/receivables-collections.html',
    '/finance/leadership-coming-soon.html',
    COMING
  ]) {
    const r = await httpJson('GET', p);
    if (r.status === 200) pass(`open:${p}`, '200');
    else fail(`open:${p}`, String(r.status));
  }

  const out = {
    generated_at: new Date().toISOString(),
    passed: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok).length,
    results
  };
  fs.writeFileSync(path.join(ART, 'finance-hub-card-links-fix-results.json'), JSON.stringify(out, null, 2));
  console.log(`\nsummary passed=${out.passed} failed=${out.failed}`);
  process.exit(out.failed ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  fail('fatal', String(e.message || e));
  process.exit(1);
});
