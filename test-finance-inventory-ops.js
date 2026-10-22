'use strict';

/**
 * Inventory operations gate — isolated local DB only.
 * Creates clearly prefixed INVOPS records. Does not delete existing finance data.
 * Does not enable FINANCE_POST_*.
 */

const fs = require('fs');
const http = require('http');
const path = require('path');
const { spawn } = require('child_process');
const { Client } = require('pg');
const { resolveAppDatabaseUrl } = require('./finance/testing/finance-test-isolation');

const ART = '/opt/cursor/artifacts';
const PORT = Number(process.env.PORT || 3024);
const BASE = `http://127.0.0.1:${PORT}`;
const results = [];
const stamp = Date.now().toString().slice(-8);

function pass(name, detail = '') {
  results.push({ name, status: 'PASS', detail });
  console.log(`PASS  ${name}${detail ? ` — ${detail}` : ''}`);
}
function fail(name, detail = '') {
  results.push({ name, status: 'FAIL', detail });
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

function waitHealth(timeoutMs = 90000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const tick = () => {
      http.get(`${BASE}/finance/inventory/items`, (res) => {
        res.resume();
        if (res.statusCode && res.statusCode < 500) return resolve();
        if (Date.now() - start > timeoutMs) return reject(new Error('timeout'));
        setTimeout(tick, 500);
      }).on('error', () => {
        if (Date.now() - start > timeoutMs) return reject(new Error('timeout'));
        setTimeout(tick, 500);
      });
    };
    tick();
  });
}

async function main() {
  fs.mkdirSync(ART, { recursive: true });
  const dbUrl = resolveAppDatabaseUrl();
  const catalog = require('./finance/finance-leadership-360-catalog');
  const stock = catalog.getPage('inventory', 'stock');
  stock && stock.status === 'operational' && stock.href === '/finance/inventory.html'
    ? pass('catalog-stock-operational')
    : fail('catalog-stock-operational', JSON.stringify(stock));
  const docs = catalog.getPage('inventory', 'warehouse-docs');
  docs && docs.status === 'operational' && String(docs.href).includes('#moves')
    ? pass('catalog-moves-operational')
    : fail('catalog-moves-operational', JSON.stringify(docs));
  const count = catalog.getPage('inventory', 'stock-count');
  count && count.status === 'coming_soon'
    ? pass('catalog-count-still-soon')
    : fail('catalog-count-still-soon');
  const purchases = catalog.getPage('inventory', 'stock-purchases');
  purchases && purchases.status === 'coming_soon'
    ? pass('catalog-po-link-still-soon')
    : fail('catalog-po-link-still-soon');

  const html = fs.readFileSync(path.join(__dirname, 'finance/inventory.html'), 'utf8');
  !/قيد التطوير/.test(html) ? pass('page-no-coming-soon-copy') : fail('page-no-coming-soon-copy');
  !/localStorage/.test(html) ? pass('page-no-localstorage') : fail('page-no-localstorage');

  const routes = fs.readFileSync(path.join(__dirname, 'finance/api/finance-routes.js'), 'utf8');
  /await ensurePaymentAddressColumns\(\)/.test(routes) ? pass('payment-ensure-called') : fail('payment-ensure-called');
  /لا يُمنح HQ001 تلقائيًا/.test(routes) ? pass('payment-no-hq-fallback') : fail('payment-no-hq-fallback');

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

  const pg = new Client({ connectionString: dbUrl, ssl: false });
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
    const token = tokenMatch ? decodeURIComponent(tokenMatch[1]) : '';
    login.status === 200 && token ? pass('login') : fail('login', `${login.status} ${login.raw?.slice(0, 180)}`);
    const auth = { Authorization: `Bearer ${token}`, Cookie: cookie };

    const sku = `INVOPS-${stamp}`;
    const code = `WH-${stamp}`;
    const wh = await httpJson('POST', '/finance/inventory/warehouses', {
      code, name_ar: 'مستودع اختبار معزول', location_name: 'معمل محلي'
    }, auth);
    wh.status === 201 ? pass('create-warehouse', code) : fail('create-warehouse', `${wh.status} ${wh.json?.error}`);

    const wh2 = await httpJson('POST', '/finance/inventory/warehouses', {
      code: code + '-B', name_ar: 'مستودع وجهة', location_name: 'معمل محلي'
    }, auth);
    wh2.status === 201 ? pass('create-warehouse-dest') : fail('create-warehouse-dest', wh2.json?.error);

    const dupWh = await httpJson('POST', '/finance/inventory/warehouses', { code, name_ar: 'مكرر' }, auth);
    dupWh.status === 409 ? pass('duplicate-warehouse') : fail('duplicate-warehouse', String(dupWh.status));

    const item = await httpJson('POST', '/finance/inventory/items', {
      sku, name_ar: 'صنف اختبار معزول', category: 'INVOPS', unit_name: 'قطعة',
      purchase_cost: 10, sale_price: 25, reorder_level: 2, track_inventory: true
    }, auth);
    item.status === 201 ? pass('create-item', sku) : fail('create-item', `${item.status} ${item.json?.error}`);
    const itemId = item.json?.item?.id;
    const whId = wh.json?.warehouse?.id;
    const whTo = wh2.json?.warehouse?.id;

    const dupItem = await httpJson('POST', '/finance/inventory/items', { sku, name_ar: 'مكرر' }, auth);
    dupItem.status === 409 ? pass('duplicate-sku') : fail('duplicate-sku', String(dupItem.status));

    const key = `idem-${stamp}`;
    const inn = await httpJson('POST', '/finance/inventory/moves', {
      move_type: 'IN', item_id: itemId, warehouse_id: whId, qty: 5, unit_cost: 10,
      notes: 'INVOPS opening', idempotency_key: key
    }, auth);
    inn.status === 201 ? pass('move-in', inn.json?.move?.move_number) : fail('move-in', `${inn.status} ${inn.json?.error}`);

    const replay = await httpJson('POST', '/finance/inventory/moves', {
      move_type: 'IN', item_id: itemId, warehouse_id: whId, qty: 5, unit_cost: 10, idempotency_key: key
    }, auth);
    replay.json?.duplicate === true ? pass('idempotent-replay') : fail('idempotent-replay', JSON.stringify(replay.json));

    const over = await httpJson('POST', '/finance/inventory/moves', {
      move_type: 'OUT', item_id: itemId, warehouse_id: whId, qty: 99, notes: 'INVOPS over'
    }, auth);
    over.status === 400 ? pass('reject-negative') : fail('reject-negative', `${over.status} ${over.json?.error}`);

    const out = await httpJson('POST', '/finance/inventory/moves', {
      move_type: 'OUT', item_id: itemId, warehouse_id: whId, qty: 2, notes: 'INVOPS issue'
    }, auth);
    out.status === 201 ? pass('move-out') : fail('move-out', `${out.status} ${out.json?.error}`);

    const xfer = await httpJson('POST', '/finance/inventory/moves', {
      move_type: 'TRANSFER', item_id: itemId, warehouse_id: whId, warehouse_to_id: whTo, qty: 1, notes: 'INVOPS transfer'
    }, auth);
    xfer.status === 201 ? pass('move-transfer') : fail('move-transfer', `${xfer.status} ${xfer.json?.error}`);

    const listed = await httpJson('GET', '/finance/inventory/balances', null, auth);
    const rows = (listed.json?.balances || []).filter((b) => b.sku === sku);
    const src = rows.find((b) => Number(b.warehouse_id) === Number(whId));
    const dst = rows.find((b) => Number(b.warehouse_id) === Number(whTo));
    Number(src?.qty) === 2 && Number(dst?.qty) === 1 && Number(src?.avg_cost) === 10
      ? pass('balances', `src=${src.qty} dst=${dst.qty} avg=${src.avg_cost}`)
      : fail('balances', JSON.stringify(rows));

    const sessionList = await httpJson('GET', '/finance/inventory/items?q=' + encodeURIComponent(sku), null, auth);
    sessionList.status === 200 && (sessionList.json?.items || []).some((i) => i.sku === sku)
      ? pass('search-session-scope', `entity=${sessionList.json.entity_id}`)
      : fail('search-session-scope', sessionList.json?.error || '');

    await pg.connect();
    const proof = await pg.query(
      `SELECT i.sku, b.qty, b.avg_cost, w.code
       FROM finance_stock_balances b
       JOIN finance_items i ON i.id = b.item_id
       JOIN finance_warehouses w ON w.id = b.warehouse_id
       WHERE i.sku = $1
       ORDER BY w.code`,
      [sku]
    );
    proof.rows.length === 2 ? pass('postgres-proof', JSON.stringify(proof.rows)) : fail('postgres-proof', JSON.stringify(proof.rows));

    const moves = await pg.query(
      `SELECT move_number, move_type, status FROM finance_stock_moves m
       JOIN finance_items i ON i.id = m.item_id WHERE i.sku = $1 ORDER BY m.id`,
      [sku]
    );
    moves.rows.length === 3 && moves.rows.every((m) => m.status === 'POSTED')
      ? pass('posted-moves', moves.rows.map((m) => m.move_number).join(','))
      : fail('posted-moves', JSON.stringify(moves.rows));

    try {
      const puppeteer = require('puppeteer-core');
      const browser = await puppeteer.launch({
        executablePath: process.env.CHROME_PATH || '/usr/local/bin/google-chrome',
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
      const page = await browser.newPage();
      await page.setCookie({ name: 'authToken', value: token, url: BASE });
      await page.setViewport({ width: 1440, height: 900 });
      await page.goto(`${BASE}/finance/inventory.html`, { waitUntil: 'networkidle2', timeout: 60000 });
      await page.waitForFunction(() => document.getElementById('kpiItems') && document.getElementById('kpiItems').textContent !== '—', { timeout: 20000 });
      const uiSku = `INVOPS-UI-${stamp}`;
      await page.click('.tabs button[data-tab="items"]');
      await page.type('#itemForm [name=sku]', uiSku);
      await page.type('#itemForm [name=name_ar]', 'صنف من الواجهة');
      await page.click('#itemForm button[type=submit]');
      await page.waitForFunction((codeSku) => document.body.innerText.includes(codeSku), { timeout: 15000 }, uiSku);
      pass('ui-create-item', uiSku);
      await page.screenshot({ path: path.join(ART, 'inventory-items-desktop.png'), fullPage: false });
      await page.setViewport({ width: 390, height: 844 });
      await page.screenshot({ path: path.join(ART, 'inventory-items-mobile.png'), fullPage: false });
      await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
      await page.setViewport({ width: 1440, height: 900 });
      await page.click('.tabs button[data-tab="balances"]');
      await page.waitForFunction((codeSku) => document.body.innerText.includes(codeSku), { timeout: 10000 }, sku);
      await page.screenshot({ path: path.join(ART, 'inventory-balances-dark.png'), fullPage: false });
      pass('ui-balances-visible');
      await browser.close();
    } catch (uiErr) {
      fail('ui', uiErr.message);
    }
  } catch (error) {
    fail('fatal', error.message);
    fs.writeFileSync(path.join(ART, 'inventory-ops-server.log'), serverLog.slice(-8000));
  } finally {
    try { await pg.end(); } catch (_) { /* */ }
    server.kill('SIGTERM');
  }

  const summary = {
    at: new Date().toISOString(),
    pass: results.filter((r) => r.status === 'PASS').length,
    fail: results.filter((r) => r.status === 'FAIL').length,
    results
  };
  fs.writeFileSync(path.join(ART, 'finance-inventory-ops.json'), JSON.stringify(summary, null, 2));
  console.log(`RESULT ${summary.pass} pass / ${summary.fail} fail`);
  process.exit(summary.fail ? 1 : 0);
}

main();
