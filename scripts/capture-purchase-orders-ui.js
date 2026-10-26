'use strict';

/**
 * Headless UI capture + smoke for purchase-orders workbench on isolated :3083
 */
const fs = require('fs');
const http = require('http');
const puppeteer = require('puppeteer-core');

const BASE = process.env.APP_BASE_URL || 'http://127.0.0.1:3083';
const ART = '/opt/cursor/artifacts';
const CHROME = process.env.CHROME_PATH || '/usr/local/bin/google-chrome';
fs.mkdirSync(ART, { recursive: true });

function httpReq(method, urlPath, body, headers = {}) {
  const u = new URL(urlPath, BASE);
  const payload = body == null ? null : JSON.stringify(body);
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: u.hostname,
      port: u.port || 80,
      path: u.pathname + u.search,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
        ...headers
      }
    }, (res) => {
      let raw = '';
      res.on('data', (c) => { raw += c; });
      res.on('end', () => {
        let json = null;
        try { json = raw ? JSON.parse(raw) : null; } catch { /* */ }
        resolve({ status: res.statusCode, json, headers: res.headers });
      });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function main() {
  const results = [];
  const login = await httpReq('POST', '/api/auth/login', {
    email: 'admin@naiosh.com',
    password: 'Admin@123'
  });
  const token = login.json?.data?.session?.token || '';
  const setCookie = login.headers['set-cookie'] || [];
  const cookieHeader = Array.isArray(setCookie)
    ? setCookie.map((c) => c.split(';')[0]).join('; ')
    : '';
  if (!token) throw new Error('login failed');

  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: 'new',
    args: ['--no-sandbox', '--disable-gpu', '--window-size=1440,1100']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 1100 });
  page.on('pageerror', (err) => results.push({ type: 'pageerror', message: String(err.message || err) }));
  page.on('console', (msg) => {
    if (msg.type() === 'error') results.push({ type: 'console', message: msg.text() });
  });

  await page.goto(`${BASE}/login.html`, { waitUntil: 'networkidle2', timeout: 60000 }).catch(() => {});
  await page.evaluate((t) => {
    try {
      localStorage.setItem('authToken', t);
      sessionStorage.setItem('authToken', t);
    } catch (_) { /* */ }
  }, token);
  // also set cookie via CDP
  const client = await page.createCDPSession();
  await client.send('Network.enable');
  for (const part of cookieHeader.split('; ')) {
    const [name, ...rest] = part.split('=');
    if (!name) continue;
    await page.setCookie({
      name,
      value: rest.join('='),
      domain: '127.0.0.1',
      path: '/'
    });
  }

  await page.goto(`${BASE}/finance/purchase-orders.html`, { waitUntil: 'networkidle2', timeout: 60000 });
  await page.waitForSelector('.fw-hero', { timeout: 20000 });
  await new Promise((r) => setTimeout(r, 1200));
  await page.screenshot({ path: `${ART}/po-after-workbench-desktop.png`, fullPage: false });

  // Create PO via UI
  await page.click('#btn-new-po');
  await page.waitForSelector('#modal-po:not([hidden])', { timeout: 10000 });
  await page.$eval('#po_vendor_name', (el) => { el.value = 'مورد واجهة اختبار'; el.dispatchEvent(new Event('input', { bubbles: true })); });
  await page.$eval('#po_order_date', (el, v) => { el.value = v; }, new Date().toISOString().slice(0, 10));
  await page.$eval('#po_expected_date', (el) => { el.value = '2026-11-15'; });
  // first line
  await page.$$eval('#po-lines .po-line-row', (rows) => {
    const row = rows[0];
    const set = (f, v) => {
      const inp = row.querySelector(`[data-f="${f}"]`);
      inp.value = v;
      inp.dispatchEvent(new Event('input', { bubbles: true }));
    };
    set('item_code', 'UI-01');
    set('item_name', 'بند واجهة');
    set('quantity', '3');
    set('unit_price', '120');
    set('tax_pct', '15');
  });
  await page.click('#btn-add-line');
  await page.$$eval('#po-lines .po-line-row', (rows) => {
    const row = rows[1];
    const set = (f, v) => {
      const inp = row.querySelector(`[data-f="${f}"]`);
      inp.value = v;
      inp.dispatchEvent(new Event('input', { bubbles: true }));
    };
    set('item_name', 'بند إضافي');
    set('quantity', '1');
    set('unit_price', '40');
    set('tax_pct', '15');
  });
  await page.click('#btn-po-save');
  await page.waitForFunction(() => {
    const alert = document.getElementById('alert');
    return alert && !alert.hidden && /حُفظ الأمر|تم تحميل/.test(alert.textContent || '');
  }, { timeout: 20000 }).catch(() => {});
  await new Promise((r) => setTimeout(r, 800));
  await page.screenshot({ path: `${ART}/po-after-orders-table.png`, fullPage: false });

  // Drawer should show detail — approve if button present
  const approved = await page.evaluate(async () => {
    const btn = document.getElementById('d-approve-po');
    if (!btn) return { ok: false, reason: 'no-approve-btn' };
    // ErpDialog.confirm stub if needed
    if (window.ErpDialog) {
      window.ErpDialog.confirm = async () => true;
      window.ErpDialog.prompt = async (_m, d) => d || 'ok';
      window.ErpDialog.toast = () => {};
    }
    btn.click();
    await new Promise((r) => setTimeout(r, 1200));
    return { ok: true };
  });
  await new Promise((r) => setTimeout(r, 1000));
  await page.screenshot({ path: `${ART}/po-after-drawer-detail.png`, fullPage: false });

  // Invoice from PO
  await page.evaluate(async () => {
    if (window.ErpDialog) {
      window.ErpDialog.confirm = async () => true;
      window.ErpDialog.prompt = async (m, d) => {
        if (String(m || '').includes('مبلغ')) return '100';
        if (String(m || '').includes('طريقة')) return 'BANK_TRANSFER';
        if (String(m || '').includes('مرجع')) return 'UI-PAY-1';
        return d || 'ok';
      };
    }
    const btn = document.getElementById('d-invoice-po');
    if (btn) btn.click();
  });
  await page.waitForSelector('#modal-vi:not([hidden])', { timeout: 10000 }).catch(() => null);
  const viVisible = await page.$eval('#modal-vi', (el) => !el.hidden).catch(() => false);
  if (viVisible) {
    await page.$eval('#vi_invoice_date', (el, v) => { el.value = v; }, new Date().toISOString().slice(0, 10));
    // totals may be prefilled
    await page.click('#form-vi button[type="submit"]');
    await new Promise((r) => setTimeout(r, 1500));
  }

  await page.click('#tab-invoices');
  await new Promise((r) => setTimeout(r, 800));
  await page.screenshot({ path: `${ART}/po-after-invoices-tab.png`, fullPage: false });

  // Mobile
  await page.setViewport({ width: 390, height: 844 });
  await page.click('#tab-orders').catch(() => {});
  await new Promise((r) => setTimeout(r, 600));
  await page.screenshot({ path: `${ART}/po-after-mobile.png`, fullPage: false });

  // Dark mode if inject supports it
  await page.setViewport({ width: 1440, height: 1100 });
  await page.evaluate(() => {
    document.documentElement.classList.add('dark');
    document.body.classList.add('dark-mode', 'dark');
    document.documentElement.setAttribute('data-theme', 'dark');
  });
  await new Promise((r) => setTimeout(r, 400));
  await page.screenshot({ path: `${ART}/po-after-dark.png`, fullPage: false });

  const hasKpis = await page.$('.fw-kpi');
  const hasTable = await page.$('.fw-table');
  const summary = {
    approved_click: approved,
    vi_modal_was_shown: viVisible,
    has_kpis: !!hasKpis,
    has_table: !!hasTable,
    console_errors: results,
    screenshots: [
      'po-after-workbench-desktop.png',
      'po-after-orders-table.png',
      'po-after-drawer-detail.png',
      'po-after-invoices-tab.png',
      'po-after-mobile.png',
      'po-after-dark.png'
    ]
  };
  fs.writeFileSync(`${ART}/po-ui-capture-results.json`, JSON.stringify(summary, null, 2));
  console.log(JSON.stringify(summary, null, 2));
  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
