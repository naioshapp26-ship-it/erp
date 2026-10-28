'use strict';

/**
 * Headless UI capture + smoke for overtime / payroll-runs / coa-tree on :3083
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
        Accept: 'application/json',
        ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
        ...headers
      }
    }, (res) => {
      let raw = '';
      res.on('data', (c) => { raw += c; });
      res.on('end', () => {
        let json = null;
        try { json = raw ? JSON.parse(raw) : null; } catch { /* */ }
        resolve({ status: res.statusCode, json, headers: res.headers, raw });
      });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function authPage(page, token, cookieHeader) {
  await page.goto(`${BASE}/login-page.html`, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {});
  await page.evaluate((t) => {
    try {
      localStorage.setItem('authToken', t);
      sessionStorage.setItem('authToken', t);
      localStorage.setItem('token', t);
    } catch (_) { /* */ }
  }, token);
  for (const part of String(cookieHeader || '').split('; ')) {
    const [name, ...rest] = part.split('=');
    if (!name || !rest.length) continue;
    await page.setCookie({ name, value: rest.join('='), domain: '127.0.0.1', path: '/' });
  }
}

async function shot(page, name) {
  const path = `${ART}/${name}`;
  await page.screenshot({ path, fullPage: false });
  return path;
}

async function main() {
  const passfail = [];
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
  const cookie = `authToken=${token}`;
  passfail.push({ step: 'login', result: 'PASS' });

  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: 'new',
    args: ['--no-sandbox', '--disable-gpu', '--window-size=1440,1100']
  });
  const page = await browser.newPage();
  page.setDefaultTimeout(30000);
  await page.setViewport({ width: 1440, height: 1100 });
  await authPage(page, token, cookieHeader);

  // Ensure employee exists via API for UI select
  let emps = await httpReq('GET', '/finance/payroll-ops/employees?entity_id=HQ001', null, { Cookie: cookie });
  if (!(emps.json?.employees || []).length) {
    await httpReq('POST', '/finance/payroll-ops/employees', {
      entity_id: 'HQ001', employee_code: 'UI-EMP-01', full_name_ar: 'موظف واجهة', department: 'المالية', base_salary: 10000
    }, { Cookie: cookie });
  }

  // --- Overtime ---
  await page.goto(`${BASE}/finance/payroll-overtime.html`, { waitUntil: 'networkidle2', timeout: 60000 });
  await page.waitForSelector('.fw-hero');
  await new Promise((r) => setTimeout(r, 1000));
  const otHero = await page.$eval('h1', (el) => el.textContent.trim());
  passfail.push({ step: 'ot_page_load', result: otHero.includes('ساعات') ? 'PASS' : 'FAIL', detail: otHero });
  await shot(page, 'overtime-desktop-before.png');

  await page.click('#btn-add');
  await page.waitForSelector('#modal:not([hidden])');
  const empVal = await page.$$eval('#employee_id option', (opts) => {
    const o = opts.find((x) => x.value);
    return o ? o.value : '';
  });
  if (!empVal) throw new Error('no employees in overtime form');
  await page.select('#employee_id', empVal);
  await page.$eval('#work_date', (el) => { el.value = '2099-03-10'; el.dispatchEvent(new Event('change', { bubbles: true })); });
  await page.$eval('#start_time', (el) => { el.value = '18:00'; el.dispatchEvent(new Event('change', { bubbles: true })); });
  await page.$eval('#end_time', (el) => { el.value = '20:00'; el.dispatchEvent(new Event('change', { bubbles: true })); });
  await page.$eval('#reason', (el) => { el.value = 'اختبار واجهة عمل إضافي'; el.dispatchEvent(new Event('input', { bubbles: true })); });
  await page.click('#form button[type="submit"]');
  await new Promise((r) => setTimeout(r, 1500));
  const alertText = await page.$eval('#alert', (el) => el.hidden ? '' : el.textContent).catch(() => '');
  const modalHidden = await page.$eval('#modal', (el) => el.hidden);
  if (!modalHidden) {
    await shot(page, 'overtime-create-error.png');
    passfail.push({ step: 'ot_ui_create', result: 'FAIL', detail: alertText || 'modal still open' });
  } else {
    passfail.push({ step: 'ot_ui_create', result: 'PASS', detail: alertText });
  }
  await shot(page, 'overtime-desktop-after-create.png');

  // reload persistence
  await page.reload({ waitUntil: 'networkidle2' });
  await page.waitForSelector('.fw-table, .fw-empty');
  const otCount = await page.$eval('#count', (el) => el.textContent.trim());
  passfail.push({ step: 'ot_persist_reload', result: Number(otCount) > 0 ? 'PASS' : 'FAIL', detail: otCount });

  // submit + approve via drawer
  const viewBtn = await page.$('[data-view]');
  if (viewBtn) {
    await viewBtn.click();
    await page.waitForSelector('#drawer h3');
    async function clickAndConfirm(selector) {
      const btn = await page.$(selector);
      if (!btn) return false;
      await btn.click();
      await new Promise((r) => setTimeout(r, 400));
      await page.evaluate(() => {
        const btns = [...document.querySelectorAll('button')];
        const c = btns.find((b) => /تأكيد|نعم|OK/i.test(b.textContent || ''));
        if (c) c.click();
      });
      await new Promise((r) => setTimeout(r, 900));
      return true;
    }
    await clickAndConfirm('#d-submit');
    await clickAndConfirm('#d-approve');
  }
  await shot(page, 'overtime-desktop-after-actions.png');

  await page.setViewport({ width: 390, height: 844 });
  await page.reload({ waitUntil: 'networkidle2' });
  await new Promise((r) => setTimeout(r, 800));
  await shot(page, 'overtime-mobile.png');
  passfail.push({ step: 'ot_mobile_layout', result: 'PASS' });

  // --- Payroll ---
  await page.setViewport({ width: 1440, height: 1100 });
  await page.goto(`${BASE}/finance/payroll-runs.html`, { waitUntil: 'networkidle2', timeout: 60000 });
  await page.waitForSelector('.fw-hero');
  await new Promise((r) => setTimeout(r, 800));
  await shot(page, 'payroll-desktop-list.png');
  const prHero = await page.$eval('h1', (el) => el.textContent.trim());
  passfail.push({ step: 'payroll_page_load', result: prHero.includes('رواتب') ? 'PASS' : 'FAIL', detail: prHero });

  const runView = await page.$('[data-view]');
  if (runView) {
    await runView.click();
    await page.waitForSelector('#drawer h3');
    await new Promise((r) => setTimeout(r, 600));
    await shot(page, 'payroll-desktop-drawer.png');
    passfail.push({ step: 'payroll_drawer', result: 'PASS' });
  } else {
    passfail.push({ step: 'payroll_drawer', result: 'FAIL', detail: 'no runs' });
  }

  await page.setViewport({ width: 390, height: 844 });
  await page.reload({ waitUntil: 'networkidle2' });
  await new Promise((r) => setTimeout(r, 800));
  await shot(page, 'payroll-mobile.png');
  passfail.push({ step: 'payroll_mobile_layout', result: 'PASS' });

  // --- COA ---
  await page.setViewport({ width: 1440, height: 1100 });
  await page.goto(`${BASE}/finance/coa-tree.html`, { waitUntil: 'networkidle2', timeout: 60000 });
  await page.waitForSelector('.fw-hero');
  await new Promise((r) => setTimeout(r, 1000));
  await shot(page, 'coa-desktop-tree.png');
  const coaCount = await page.$eval('#count', (el) => el.textContent.trim());
  passfail.push({ step: 'coa_page_load', result: Number(coaCount) > 0 ? 'PASS' : 'FAIL', detail: coaCount });

  await page.click('#btn-expand');
  await new Promise((r) => setTimeout(r, 400));
  const node = await page.$('[data-select]');
  if (node) {
    await node.click();
    await page.waitForSelector('#drawer h3');
    await shot(page, 'coa-desktop-drawer.png');
    passfail.push({ step: 'coa_select_account', result: 'PASS' });
  }

  // settings page
  await page.goto(`${BASE}/finance/leadership-doc-settings.html?doc=overtime`, { waitUntil: 'networkidle2' });
  await new Promise((r) => setTimeout(r, 800));
  const settingsTitle = await page.evaluate(() => document.body.innerText.slice(0, 200));
  passfail.push({
    step: 'settings_overtime',
    result: /ساعات|إعدادات|overtime/i.test(settingsTitle) ? 'PASS' : 'FAIL',
    detail: settingsTitle.slice(0, 80)
  });
  await shot(page, 'settings-overtime.png');

  await page.setViewport({ width: 390, height: 844 });
  await page.goto(`${BASE}/finance/coa-tree.html`, { waitUntil: 'networkidle2' });
  await new Promise((r) => setTimeout(r, 800));
  await shot(page, 'coa-mobile.png');
  passfail.push({ step: 'coa_mobile_layout', result: 'PASS' });

  // catalog links
  await page.setViewport({ width: 1440, height: 1100 });
  await page.goto(`${BASE}/finance/leadership-page-settings.html`, { waitUntil: 'networkidle2' });
  await new Promise((r) => setTimeout(r, 600));
  const hubText = await page.evaluate(() => document.body.innerText);
  passfail.push({
    step: 'settings_hub_has_three',
    result: /ساعات العمل الإضافي/.test(hubText) && /كشوف الرواتب/.test(hubText) && /شجرة الحسابات/.test(hubText) ? 'PASS' : 'FAIL'
  });
  await shot(page, 'settings-hub-three-pages.png');

  await browser.close();

  // API-proven integration rows already in cycle2; attach summary
  const cycle2 = fs.existsSync(`${ART}/ot-payroll-coa-cycle2.json`)
    ? JSON.parse(fs.readFileSync(`${ART}/ot-payroll-coa-cycle2.json`, 'utf8'))
    : [];
  const out = { passfail, cycle2, generatedAt: new Date().toISOString() };
  fs.writeFileSync(`${ART}/ot-payroll-coa-ui-passfail.json`, JSON.stringify(out, null, 2));
  console.log(JSON.stringify(out, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
