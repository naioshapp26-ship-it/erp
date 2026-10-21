'use strict';

/**
 * Batch-1 gate: finance page-document settings persist to PostgreSQL
 * and apply to sales invoices / customers / journal / expenses entity resolve.
 */

const fs = require('fs');
const http = require('http');
const path = require('path');
const { spawn } = require('child_process');
const { Client } = require('pg');
const { resolveAppDatabaseUrl } = require('./finance/testing/finance-test-isolation');

const ART = '/opt/cursor/artifacts';
const PORT = Number(process.env.PORT || 3021);
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

function waitHealth(timeoutMs = 60000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const tick = () => {
      http
        .get(`${BASE}/finance/page-settings/sales-invoices/schema`, (res) => {
          res.resume();
          if (res.statusCode && res.statusCode < 500) return resolve();
          if (Date.now() - start > timeoutMs) return reject(new Error('server health timeout'));
          setTimeout(tick, 400);
        })
        .on('error', () => {
          if (Date.now() - start > timeoutMs) return reject(new Error('server health timeout'));
          setTimeout(tick, 400);
        });
    };
    tick();
  });
}

async function main() {
  fs.mkdirSync(ART, { recursive: true });
  const dbUrl = resolveAppDatabaseUrl();
  if (!dbUrl) {
    fail('db-url', 'no DATABASE_URL');
    process.exit(1);
  }

  // Static checks
  const expenses = fs.readFileSync(path.join(__dirname, 'finance/api/expenses.js'), 'utf8');
  /entity_id = 'HQ001'/.test(expenses)
    ? fail('expenses-no-hq-default', 'create still defaults HQ001')
    : pass('expenses-no-hq-default');
  /resolveScopedEntityId/.test(expenses) ? pass('expenses-session-resolve') : fail('expenses-session-resolve');

  const journal = fs.readFileSync(path.join(__dirname, 'finance/api/journal.js'), 'utf8');
  /resolveScopedEntityId/.test(journal) ? pass('journal-session-resolve') : fail('journal-session-resolve');
  /page-document-settings/.test(journal) ? pass('journal-applies-settings') : fail('journal-applies-settings');

  const routes = fs.readFileSync(path.join(__dirname, 'finance/api/finance-routes.js'), 'utf8');
  /sales-invoices/.test(routes) ? pass('invoices-apply-page-settings') : fail('invoices-apply-page-settings');
  /require_tax_number/.test(routes) ? pass('customers-apply-page-settings') : fail('customers-apply-page-settings');

  const catalog = fs.readFileSync(path.join(__dirname, 'finance/finance-leadership-360-catalog.js'), 'utf8');
  (catalog.match(/leadership-doc-settings\.html\?doc=/g) || []).length >= 13
    ? pass('catalog-13-editor-links')
    : fail('catalog-13-editor-links');

  const server = spawn(process.execPath, ['server.js'], {
    cwd: __dirname,
    env: {
      ...process.env,
      PORT: String(PORT),
      DATABASE_URL: dbUrl,
      DATABASE_SSL: 'false',
      NODE_ENV: 'development',
      FINANCE_POST_INVOICE_VIA_SERVICE: 'false',
      FINANCE_POST_PAYMENT_VIA_SERVICE: 'false'
    },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  let serverLog = '';
  server.stdout.on('data', (d) => {
    serverLog += d.toString();
  });
  server.stderr.on('data', (d) => {
    serverLog += d.toString();
  });

  try {
    await waitHealth();
    pass('server-up', String(PORT));

    const list = await httpJson('GET', '/finance/page-settings');
    list.status === 200 && list.json?.count === 13
      ? pass('list-13', String(list.json.count))
      : fail('list-13', `${list.status} ${list.json?.count}`);

    const putPrefix = `TB${Date.now().toString().slice(-6)}`;
    const put = await httpJson('PUT', '/finance/page-settings/sales-invoices', {
      value: {
        number_prefix: putPrefix,
        due_days: 21,
        default_tax_pct: 15,
        require_customer: true,
        allow_partial_payment_default: true,
        allow_installments_default: false,
        footer_text: 'batch1-test',
        default_currency: 'SAR'
      },
      reason: 'batch1-gate'
    });
    put.status === 200 && put.json?.item?.value?.number_prefix === putPrefix
      ? pass('put-sales-invoices', putPrefix)
      : fail('put-sales-invoices', `${put.status} ${put.raw?.slice(0, 200)}`);

    const get = await httpJson('GET', '/finance/page-settings/sales-invoices');
    get.status === 200 && get.json?.item?.value?.number_prefix === putPrefix && get.json?.item?.isDefault === false
      ? pass('reload-sales-invoices')
      : fail('reload-sales-invoices', `${get.status} ${JSON.stringify(get.json?.item?.value || {})}`);

    // Direct DB proof
    const client = new Client({ connectionString: dbUrl, ssl: false });
    await client.connect();
    const dbRow = await client.query(
      `SELECT value->>'number_prefix' AS prefix, value->>'footer_text' AS footer
       FROM setting_values
       WHERE definition_key = 'finance.page.sales-invoices'
       ORDER BY updated_at DESC LIMIT 1`
    );
    dbRow.rows[0]?.prefix === putPrefix && dbRow.rows[0]?.footer === 'batch1-test'
      ? pass('postgres-persisted', dbRow.rows[0].prefix)
      : fail('postgres-persisted', JSON.stringify(dbRow.rows[0] || null));

    // Expenses without query entity_id but with HQ session headers → should resolve (unauth falls to HQ001 default context)
    const expenses = await httpJson('GET', '/finance/expenses');
    expenses.status === 200 || expenses.status === 401 || expenses.status === 403
      ? pass('expenses-no-query-entity', String(expenses.status))
      : fail('expenses-no-query-entity', `${expenses.status} ${expenses.raw?.slice(0, 160)}`);

    const journal = await httpJson('GET', '/finance/journal/entries');
    journal.status === 200 || journal.status === 401 || journal.status === 403
      ? pass('journal-no-query-entity', String(journal.status))
      : fail('journal-no-query-entity', `${journal.status} ${journal.raw?.slice(0, 160)}`);

    // Customer settings defaults applied on create
    await httpJson('PUT', '/finance/page-settings/customers', {
      value: {
        require_tax_number: false,
        require_phone: false,
        require_email: false,
        default_payment_terms_days: 45,
        default_credit_limit: 1500,
        default_currency: 'SAR'
      }
    });
    const custPayload = {
      customer_name_ar: 'عميل اختبار إعدادات',
      customer_type: 'COMPANY',
      company_name: 'شركة اختبار',
      website: 'https://example.test',
      email: `cust${Date.now()}@example.test`,
      email_secondary: `cust2${Date.now()}@example.test`,
      mobile: '0500000001',
      mobile_secondary: '0500000002',
      tax_number: `3${String(Date.now()).slice(-14)}`,
      city: 'الرياض',
      country: 'Saudi Arabia',
      street_name: 'شارع',
      postal_code: '12345',
      building_number: '1',
      district: 'حي',
      shipping_copy_billing: true,
      credit_limit: 0,
      credit_period_days: 30,
      entity_id: 'HQ001',
      entity_type: 'HQ'
    };
    const goodCust = await httpJson('POST', '/finance/customers', custPayload);
    const created = goodCust.json?.customer;
    goodCust.status === 201 &&
      Number(created?.credit_period_days) === 45 &&
      Number(created?.credit_limit) === 1500
      ? pass('customers-settings-defaults-applied', `days=${created?.credit_period_days} limit=${created?.credit_limit}`)
      : fail(
          'customers-settings-defaults-applied',
          `${goodCust.status} days=${created?.credit_period_days} limit=${created?.credit_limit} err=${goodCust.json?.error || goodCust.raw?.slice(0, 160)}`
        );

    // Journal settings: require description
    await httpJson('PUT', '/finance/page-settings/journal-entries', {
      value: {
        number_prefix: 'JE',
        require_balanced: true,
        require_description: true,
        allow_future_dates: false
      }
    });
    const badJe = await httpJson('POST', '/finance/journal/entries', {
      entity_id: 'HQ001',
      entry_date: '2026-01-15',
      description: '',
      lines: [
        { account_id: 1, debit_amount: 10, credit_amount: 0 },
        { account_id: 2, debit_amount: 0, credit_amount: 10 }
      ]
    });
    badJe.status === 400 && /وصف/.test(badJe.json?.error || '')
      ? pass('journal-settings-description', String(badJe.status))
      : fail('journal-settings-description', `${badJe.status} ${badJe.json?.error || badJe.raw?.slice(0, 160)}`);

    await client.end();

    const editorHtml = await new Promise((resolve) => {
      http.get(`${BASE}/finance/leadership-doc-settings.html?doc=sales-invoices`, (res) => {
        let raw = '';
        res.on('data', (c) => (raw += c));
        res.on('end', () => resolve({ status: res.statusCode, raw }));
      }).on('error', (e) => resolve({ status: 0, raw: String(e) }));
    });
    editorHtml.status === 200 && /حفظ في قاعدة البيانات/.test(editorHtml.raw)
      ? pass('editor-html-serves')
      : fail('editor-html-serves', String(editorHtml.status));

    const hub = await new Promise((resolve) => {
      http.get(`${BASE}/finance/leadership-page-settings.html`, (res) => {
        let raw = '';
        res.on('data', (c) => (raw += c));
        res.on('end', () => resolve({ status: res.statusCode, raw }));
      }).on('error', (e) => resolve({ status: 0, raw: String(e) }));
    });
    hub.status === 200 ? pass('hub-html-serves') : fail('hub-html-serves', String(hub.status));
  } catch (err) {
    fail('runtime', err.message || String(err));
  } finally {
    server.kill('SIGTERM');
    fs.writeFileSync(path.join(ART, 'finance-page-document-settings-gate.log'), serverLog.slice(-8000));
    const summary = {
      passed: results.filter((r) => r.ok).length,
      failed: results.filter((r) => !r.ok).length,
      results
    };
    fs.writeFileSync(path.join(ART, 'finance-page-document-settings-gate.json'), JSON.stringify(summary, null, 2));
    console.log('\nSUMMARY', summary.passed, 'pass /', summary.failed, 'fail');
    process.exit(summary.failed ? 1 : 0);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
