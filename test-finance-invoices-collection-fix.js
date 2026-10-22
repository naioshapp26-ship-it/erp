'use strict';

/**
 * Gate: invoices page + collection page — create invoice, reload, collect payment.
 * Isolated local DB only. No FINANCE_POST_* activation.
 */

const fs = require('fs');
const http = require('http');
const path = require('path');
const { spawn } = require('child_process');
const { Client } = require('pg');
const { resolveAppDatabaseUrl } = require('./finance/testing/finance-test-isolation');

const ART = '/opt/cursor/artifacts';
const PORT = Number(process.env.PORT || 3023);
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

function waitHealth(timeoutMs = 60000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const tick = () => {
      http.get(`${BASE}/finance/invoices`, (res) => {
        res.resume();
        if (res.statusCode && res.statusCode < 500) return resolve();
        if (Date.now() - start > timeoutMs) return reject(new Error('timeout'));
        setTimeout(tick, 400);
      }).on('error', () => {
        if (Date.now() - start > timeoutMs) return reject(new Error('timeout'));
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
    fail('db-url');
    process.exit(1);
  }

  const ar = fs.readFileSync(path.join(__dirname, 'finance/api/ar-aging.js'), 'utf8');
  /resolveScopedEntityId/.test(ar) ? pass('ar-aging-session-resolve') : fail('ar-aging-session-resolve');
  /entity_id = 'HQ001'/.test(ar) ? fail('ar-aging-no-hq-default') : pass('ar-aging-no-hq-default');

  const routes = fs.readFileSync(path.join(__dirname, 'finance/api/finance-routes.js'), 'utf8');
  /ensureInvoiceAddressColumns/.test(routes) ? pass('invoice-ensure-columns') : fail('invoice-ensure-columns');

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
  server.stdout.on('data', (d) => { serverLog += d.toString(); });
  server.stderr.on('data', (d) => { serverLog += d.toString(); });

  try {
    await waitHealth();
    pass('server-up');

    const login = await httpJson('POST', '/api/auth/login', {
      email: 'ahmed@nayosh.com',
      password: 'Admin@123'
    });
    const setCookie = login.headers['set-cookie'] || [];
    const cookie = Array.isArray(setCookie) ? setCookie.map((c) => c.split(';')[0]).join('; ') : '';
    const tokenMatch = cookie.match(/authToken=([^;]+)/);
    const token = tokenMatch ? tokenMatch[1] : '';
    login.status === 200 && token ? pass('login') : fail('login', String(login.status));
    const auth = { Authorization: `Bearer ${token}`, Cookie: cookie };

    // Pages serve
    for (const p of [
      '/finance/invoices-budgets-master.html',
      '/finance/receivables-collections.html'
    ]) {
      const code = await new Promise((resolve) => {
        http.get(`${BASE}${p}`, (res) => { res.resume(); resolve(res.statusCode); })
          .on('error', () => resolve(0));
      });
      code === 200 ? pass(`page:${p}`) : fail(`page:${p}`, String(code));
    }

    // Collection list without query entity_id (session only)
    const agingNoQs = await httpJson('GET', '/finance/ar-aging', null, auth);
    agingNoQs.status === 200 && agingNoQs.json?.success
      ? pass('collection-ar-aging-session', `rows=${(agingNoQs.json.rows || []).length}`)
      : fail('collection-ar-aging-session', `${agingNoQs.status} ${agingNoQs.json?.error || agingNoQs.raw?.slice(0, 120)}`);

    const plansNoQs = await httpJson('GET', '/finance/payment-plans', null, auth);
    plansNoQs.status === 200 && plansNoQs.json?.success !== false
      ? pass('collection-payment-plans-session', String(plansNoQs.status))
      : fail('collection-payment-plans-session', `${plansNoQs.status} ${plansNoQs.json?.error || ''}`);

    const cust = await httpJson('GET', '/finance/customers', null, auth);
    const customerId = cust.json?.customers?.[0]?.customer_id;
    customerId ? pass('customer-ready', String(customerId)) : fail('customer-ready');

    const invCreate = await httpJson('POST', '/finance/invoices', {
      customer_id: customerId,
      invoice_date: '2026-10-21',
      due_date: '2026-11-20',
      entity_id: 'HQ001',
      entity_type: 'HQ',
      allow_partial_payment: true,
      notes: 'gate-invoices-collection',
      lines: [{ item_name: 'خدمة اختبار', quantity: 1, unit_price: 200, tax_percentage: 15 }]
    }, auth);
    const invoice = invCreate.json?.invoice;
    invCreate.status === 201 || (invCreate.status === 200 && invoice)
      ? pass('invoice-create', invoice?.invoice_number || String(invCreate.status))
      : fail('invoice-create', `${invCreate.status} ${invCreate.json?.error || invCreate.raw?.slice(0, 200)}`);

    const invoiceId = invoice?.invoice_id;
    const list = await httpJson('GET', '/finance/invoices', null, auth);
    const found = (list.json?.invoices || []).some((i) => i.invoice_id === invoiceId);
    found ? pass('invoice-reload-list') : fail('invoice-reload-list');

    const one = await httpJson('GET', `/finance/invoices/${invoiceId}`, null, auth);
    one.status === 200 && one.json?.invoice?.invoice_id === invoiceId
      ? pass('invoice-get-one', one.json.invoice.invoice_number)
      : fail('invoice-get-one', String(one.status));

    const payAmount = Number(invoice?.total_amount) || 230;
    const pay = await httpJson('POST', '/finance/payments', {
      customer_id: customerId,
      payment_date: '2026-10-21',
      payment_amount: payAmount,
      payment_method: 'CASH',
      entity_id: 'HQ001',
      entity_type: 'HQ',
      notes: 'تحصيل اختبار بوابة',
      allocations: [{ invoice_id: invoiceId, allocated_amount: payAmount }]
    }, auth);
    const payment = pay.json?.payment;
    pay.status === 201 || (pay.status === 200 && payment)
      ? pass('collection-payment-create', payment?.payment_number || String(pay.status))
      : fail('collection-payment-create', `${pay.status} ${pay.json?.error || pay.raw?.slice(0, 200)}`);

    const after = await httpJson('GET', `/finance/invoices/${invoiceId}`, null, auth);
    const invAfter = after.json?.invoice;
    const remaining = Number(invAfter?.remaining_amount);
    remaining === 0 || Number(invAfter?.paid_amount) >= payAmount
      ? pass('invoice-after-collection', `paid=${invAfter?.paid_amount} rem=${invAfter?.remaining_amount} status=${invAfter?.payment_status}`)
      : fail('invoice-after-collection', JSON.stringify({
        paid: invAfter?.paid_amount,
        rem: invAfter?.remaining_amount,
        payment_status: invAfter?.payment_status
      }));

    const client = new Client({ connectionString: dbUrl, ssl: false });
    await client.connect();
    const dbProof = await client.query(
      `SELECT
         (SELECT COUNT(*)::int FROM finance_invoices WHERE invoice_id = $1) AS inv,
         (SELECT COUNT(*)::int FROM finance_payments p
            JOIN finance_payment_allocations a ON a.payment_id = p.payment_id
          WHERE a.invoice_id = $1) AS pays`,
      [invoiceId]
    );
    dbProof.rows[0].inv === 1 && dbProof.rows[0].pays >= 1
      ? pass('postgres-proof', JSON.stringify(dbProof.rows[0]))
      : fail('postgres-proof', JSON.stringify(dbProof.rows[0]));
    await client.end();
  } catch (err) {
    fail('runtime', err.message || String(err));
  } finally {
    server.kill('SIGTERM');
    const summary = {
      passed: results.filter((r) => r.ok).length,
      failed: results.filter((r) => !r.ok).length,
      results
    };
    fs.writeFileSync(path.join(ART, 'finance-invoices-collection-fix.json'), JSON.stringify(summary, null, 2));
    fs.writeFileSync(path.join(ART, 'finance-invoices-collection-fix.log'), serverLog.slice(-8000));
    console.log('\nSUMMARY', summary.passed, 'pass /', summary.failed, 'fail');
    process.exit(summary.failed ? 1 : 0);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
