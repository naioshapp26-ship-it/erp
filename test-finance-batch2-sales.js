'use strict';

/**
 * Batch-2 gate: sales quotes, deposits, targets — Postgres CRUD + catalog honesty.
 */

const fs = require('fs');
const http = require('http');
const path = require('path');
const { spawn } = require('child_process');
const { Client } = require('pg');
const { resolveAppDatabaseUrl } = require('./finance/testing/finance-test-isolation');

const ART = '/opt/cursor/artifacts';
const PORT = Number(process.env.PORT || 3022);
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
      http.get(`${BASE}/finance/deposits`, (res) => {
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

  const catalog = fs.readFileSync(path.join(__dirname, 'finance/finance-leadership-360-catalog.js'), 'utf8');
  /sales\.quotes['"]\s*:\s*['"]operational['"]/.test(catalog) ? pass('catalog-quotes-ops') : fail('catalog-quotes-ops');
  /sales\.deposits['"]\s*:\s*['"]operational['"]/.test(catalog) ? pass('catalog-deposits-ops') : fail('catalog-deposits-ops');
  /sales\.targets-commissions['"]\s*:\s*['"]operational['"]/.test(catalog) ? pass('catalog-targets-ops') : fail('catalog-targets-ops');
  /localStorage/.test(fs.readFileSync(path.join(__dirname, 'finance/deposits-advance-payments.html'), 'utf8'))
    ? fail('deposits-no-localstorage')
    : pass('deposits-no-localstorage');
  /\/finance\/deposits/.test(fs.readFileSync(path.join(__dirname, 'finance/deposits-advance-payments.html'), 'utf8'))
    ? pass('deposits-calls-api')
    : fail('deposits-calls-api');
  /fl360-soon-item/.test(fs.readFileSync(path.join(__dirname, 'finance/index.html'), 'utf8'))
    ? pass('hub-soon-not-link')
    : fail('hub-soon-not-link');

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

    const depCode = `DAP-B2-${Date.now().toString().slice(-6)}`;
    const depCreate = await httpJson('POST', '/finance/deposits', {
      id: depCode,
      client: 'عميل دفعة 2',
      type: 'عربون',
      amount: 2500,
      currency: 'SAR',
      dueDate: '2026-12-01',
      status: 'نشط',
      refundable: true,
      entity_id: 'HQ001',
      entity_type: 'HQ'
    });
    depCreate.status === 201 && depCreate.json?.record?.id === depCode
      ? pass('deposit-create', depCode)
      : fail('deposit-create', `${depCreate.status} ${depCreate.raw?.slice(0, 180)}`);

    const depList = await httpJson('GET', '/finance/deposits');
    const foundDep = (depList.json?.records || []).some((r) => r.id === depCode);
    depList.status === 200 && foundDep ? pass('deposit-reload') : fail('deposit-reload', String(depList.status));

    const quote = await httpJson('POST', '/finance/sales-quotes', {
      customer_name: 'عميل عرض سعر',
      entity_id: 'HQ001',
      entity_type: 'HQ',
      lines: [{ item_name: 'استشارة', quantity: 2, unit_price: 500 }]
    });
    quote.status === 201 && quote.json?.quote?.quote_number
      ? pass('quote-create', quote.json.quote.quote_number)
      : fail('quote-create', `${quote.status} ${quote.raw?.slice(0, 180)}`);

    const quoteList = await httpJson('GET', '/finance/sales-quotes');
    quoteList.status === 200 && quoteList.json?.count >= 1
      ? pass('quote-list', String(quoteList.json.count))
      : fail('quote-list', String(quoteList.status));

    const target = await httpJson('POST', '/finance/sales-targets', {
      salesperson_name: 'مندوب تجريبي',
      period_label: '2026-Q4',
      target_amount: 100000,
      achieved_amount: 40000,
      commission_rate: 5,
      entity_id: 'HQ001',
      entity_type: 'HQ'
    });
    target.status === 201 && Number(target.json?.target?.commission_amount) === 2000
      ? pass('target-create', String(target.json.target.commission_amount))
      : fail('target-create', `${target.status} ${target.raw?.slice(0, 180)}`);

    const client = new Client({ connectionString: dbUrl, ssl: false });
    await client.connect();
    const dbProof = await client.query(
      `SELECT
         (SELECT COUNT(*)::int FROM finance_deposits WHERE deposit_code = $1) AS deposits,
         (SELECT COUNT(*)::int FROM finance_sales_quotes WHERE customer_name = 'عميل عرض سعر') AS quotes,
         (SELECT COUNT(*)::int FROM finance_sales_targets WHERE salesperson_name = 'مندوب تجريبي') AS targets`,
      [depCode]
    );
    const p = dbProof.rows[0];
    p.deposits === 1 && p.quotes >= 1 && p.targets >= 1
      ? pass('postgres-proof', JSON.stringify(p))
      : fail('postgres-proof', JSON.stringify(p));
    await client.end();

    for (const page of [
      '/finance/sales-quotes.html',
      '/finance/sales-targets-commissions.html',
      '/finance/deposits-advance-payments.html'
    ]) {
      const code = await new Promise((resolve) => {
        http.get(`${BASE}${page}`, (res) => { res.resume(); resolve(res.statusCode); })
          .on('error', () => resolve(0));
      });
      code === 200 ? pass(`page:${page}`) : fail(`page:${page}`, String(code));
    }
  } catch (err) {
    fail('runtime', err.message || String(err));
  } finally {
    server.kill('SIGTERM');
    fs.writeFileSync(path.join(ART, 'finance-batch2-sales-gate.log'), serverLog.slice(-8000));
    const summary = {
      passed: results.filter((r) => r.ok).length,
      failed: results.filter((r) => !r.ok).length,
      results
    };
    fs.writeFileSync(path.join(ART, 'finance-batch2-sales-gate.json'), JSON.stringify(summary, null, 2));
    console.log('\nSUMMARY', summary.passed, 'pass /', summary.failed, 'fail');
    process.exit(summary.failed ? 1 : 0);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
