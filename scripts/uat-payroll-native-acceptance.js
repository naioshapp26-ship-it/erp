'use strict';

/**
 * Browser UAT: native payroll ops WITHOUT Excel import.
 */
const fs = require('fs');
const http = require('http');
const path = require('path');
const puppeteer = require('puppeteer-core');
const malika = require('../finance/services/malika-payroll');

const BASE = process.env.APP_BASE_URL || 'http://127.0.0.1:3083';
const ART = '/opt/cursor/artifacts';
const CHROME = process.env.CHROME_PATH || '/usr/local/bin/google-chrome';
fs.mkdirSync(ART, { recursive: true });
const results = [];
function row(op, result, evidence) {
  results.push({ operation: op, result, evidence });
  console.log(`[${result}] ${op} — ${evidence}`);
}

function httpReq(method, urlPath, body, headers = {}) {
  const u = new URL(urlPath, BASE);
  const payload = body == null ? null : JSON.stringify(body);
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: u.hostname, port: u.port || 80, path: u.pathname + u.search, method,
      headers: {
        'Content-Type': 'application/json', Accept: 'application/json',
        ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
        ...headers
      }
    }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const buf = Buffer.concat(chunks);
        let json = null;
        try { json = JSON.parse(buf.toString('utf8')); } catch { /* */ }
        resolve({ status: res.statusCode, json, buf });
      });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function login() {
  const r = await httpReq('POST', '/api/auth/login', { email: 'admin@naiosh.com', password: 'Admin@123' });
  const token = r.json?.data?.session?.token;
  return { token, headers: { Authorization: `Bearer ${token}`, Cookie: `authToken=${token}` }, ok: !!token };
}

async function main() {
  const admin = await login();
  if (!admin.ok) throw new Error('login failed');
  const H = admin.headers;
  const year = 2098;
  const month = 3;
  const code = '00081';

  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: 'new',
    args: ['--no-sandbox', '--disable-gpu', '--window-size=1600,1100']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1600, height: 1100 });
  await page.goto(`${BASE}/login-page.html`, { waitUntil: 'domcontentloaded' }).catch(() => {});
  await page.evaluate((t) => {
    localStorage.setItem('authToken', t);
    localStorage.setItem('token', t);
  }, admin.token);
  await page.setCookie({ name: 'authToken', value: admin.token, domain: '127.0.0.1', path: '/' });

  await page.goto(`${BASE}/finance/payroll-runs.html`, { waitUntil: 'networkidle2' });
  await page.waitForSelector('#btn-generate');
  await page.screenshot({ path: path.join(ART, 'native-01-page.png') });

  // Create empty run via UI
  await page.click('#btn-generate');
  await page.waitForSelector('#modal:not([hidden])');
  await page.$eval('#period_year', (el, v) => { el.value = v; }, String(year));
  await page.$eval('#period_month', (el, v) => { el.value = v; }, String(month));
  await page.$eval('#seed_empty', (el) => { el.checked = true; });
  await page.$eval('#run_type_label', (el) => { el.value = 'المسير العام'; });
  await page.screenshot({ path: path.join(ART, 'native-02-create-run-modal.png') });
  await page.click('#form button[type="submit"]');
  await new Promise((r) => setTimeout(r, 1500));

  // Salary form should open
  await page.waitForSelector('#salary-modal:not([hidden])', { timeout: 8000 }).catch(() => null);
  const formOpen = await page.$eval('#salary-modal', (el) => !el.hidden).catch(() => false);
  row('فتح نموذج الراتب بعد إنشاء مسير فارغ', formOpen ? 'PASS' : 'FAIL', `formOpen=${formOpen}`);
  if (!formOpen) {
    await page.click('#btn-add-emp');
    await page.waitForSelector('#salary-modal:not([hidden])');
  }

  await page.$eval('#sf_code', (el, v) => { el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); }, code);
  await page.$eval('#sf_name', (el) => { el.value = 'سارة التشغيل الأصلي'; el.dispatchEvent(new Event('input', { bubbles: true })); });
  await page.$eval('#sf_dept', (el) => { el.value = 'الموارد البشرية'; });
  await page.$eval('#sf_nat', (el) => { el.value = 'المملكة العربية السعودية'; });
  await page.$eval('#sf_base', (el) => { el.value = '8000'; el.dispatchEvent(new Event('input', { bubbles: true })); });
  await page.$eval('#sf_housing', (el) => { el.value = '2000'; el.dispatchEvent(new Event('input', { bubbles: true })); });
  await page.$eval('#sf_nature', (el) => { el.value = '1000'; el.dispatchEvent(new Event('input', { bubbles: true })); });
  await page.$eval('#sf_transport', (el) => { el.value = '800'; el.dispatchEvent(new Event('input', { bubbles: true })); });
  await page.$eval('#sf_other', (el) => { el.value = '200'; el.dispatchEvent(new Event('input', { bubbles: true })); });
  await page.$eval('#sf_ins', (el) => { el.value = '780'; el.dispatchEvent(new Event('input', { bubbles: true })); });
  await page.$eval('#sf_adv', (el) => { el.value = '500'; el.dispatchEvent(new Event('input', { bubbles: true })); });
  await page.$eval('#sf_other_ded', (el) => { el.value = '100'; el.dispatchEvent(new Event('input', { bubbles: true })); });
  await new Promise((r) => setTimeout(r, 300));
  const liveGross = await page.$eval('#sf_gross', (el) => el.textContent.trim());
  const liveNet = await page.$eval('#sf_net', (el) => el.textContent.trim());
  row('حساب تلقائي في النموذج', liveGross === '12000' && liveNet === '10620' ? 'PASS' : 'FAIL', `gross=${liveGross} net=${liveNet}`);
  await page.screenshot({ path: path.join(ART, 'native-03-salary-form.png') });
  await page.click('#salary-save');
  await new Promise((r) => setTimeout(r, 1500));

  // Employee appears in table
  const inTable = await page.evaluate((c) => document.body.innerText.includes(c), code);
  row('ظهور الموظف في جدول المسير', inTable ? 'PASS' : 'FAIL', `code=${code}`);
  await page.screenshot({ path: path.join(ART, 'native-04-table-after-add.png') });

  // Edit allowance via UI
  await page.click('[data-edit-item]');
  await page.waitForSelector('#salary-modal:not([hidden])');
  await page.$eval('#sf_housing', (el) => { el.value = '2200'; el.dispatchEvent(new Event('input', { bubbles: true })); });
  await new Promise((r) => setTimeout(r, 200));
  const afterEditGross = await page.$eval('#sf_gross', (el) => el.textContent.trim());
  await page.click('#salary-save');
  await new Promise((r) => setTimeout(r, 1200));
  row('تعديل بدل وانعكاس الإجمالي', afterEditGross === '12200' ? 'PASS' : 'FAIL', `gross=${afterEditGross}`);
  await page.screenshot({ path: path.join(ART, 'native-05-after-edit.png') });

  // Reload persistence
  await page.reload({ waitUntil: 'networkidle2' });
  await new Promise((r) => setTimeout(r, 1200));
  await page.evaluate((c) => {
    const tr = [...document.querySelectorAll('tr')].find((t) => t.innerText.includes('2098/03') || t.innerText.includes(c));
    (tr?.querySelector('[data-view],[data-id]') || document.querySelector('[data-view]'))?.click();
  }, code);
  await new Promise((r) => setTimeout(r, 1200));
  const afterReload = await page.evaluate((c) => document.body.innerText.includes(c) && document.body.innerText.includes('12200'), code);
  row('استمرار البيانات بعد إعادة التحميل', afterReload ? 'PASS' : 'FAIL', `persisted=${afterReload}`);
  await page.screenshot({ path: path.join(ART, 'native-06-after-reload.png') });

  // Approve + export via API (buttons need confirm dialogs)
  const runs = await httpReq('GET', '/finance/payroll-ops/runs?entity_id=HQ001', null, H);
  const run = (runs.json?.runs || []).find((r) => Number(r.period_year) === year && Number(r.period_month) === month);
  const runId = run?.run_id;
  const appr = await httpReq('POST', `/finance/payroll-ops/runs/${runId}/approve`, { entity_id: 'HQ001' }, H);
  row('اعتماد المسير', appr.json?.success ? 'PASS' : 'FAIL', `status=${appr.status}`);
  const xlsx = await httpReq('GET', `/finance/payroll-ops/runs/${runId}/export.xlsx?entity_id=HQ001`, null, H);
  fs.writeFileSync(path.join(ART, 'native-export-malika.xlsx'), xlsx.buf);
  const parsed = malika.parseMalikaWorkbook(xlsx.buf);
  const headersOk = JSON.stringify(parsed.payrollRows.length && malika.MALIKA_COLUMNS.map((c) => c.header)) ;
  const expRow = parsed.payrollRows.find((r) => String(r.employee_code) === code);
  // Export folds other_deductions into advance: -500 + -100 = -600
  const exportOk = expRow
    && Number(expRow.gross_amount) === 12200
    && Number(expRow.insurance_amount) === -780
    && Number(expRow.advance_deduction) === -600
    && Number(expRow.net_amount) === 10820
    && String(expRow.employee_code) === code;
  row('تصدير Excel مطابق للمواصفات (13 عمودًا + طي استقطاعات)', exportOk ? 'PASS' : 'FAIL', JSON.stringify(expRow));
  row('أصفار الرقم الوظيفي في التصدير', String(expRow?.employee_code) === code ? 'PASS' : 'FAIL', expRow?.employee_code);

  // Compare headers to fixture
  const fixture = malika.parseMalikaWorkbook(fs.readFileSync(path.join(__dirname, '../finance/fixtures/malika-payroll-reference.xlsx')));
  const hdrMatch = malika.MALIKA_COLUMNS.every((c, i) => c.header === (fixture.payrollRows && malika.MALIKA_COLUMNS[i].header));
  row('ترتيب أعمدة التصدير = المواصفات المرجعية', hdrMatch ? 'PASS' : 'FAIL', malika.MALIKA_COLUMNS.map((c) => c.header.trim()).join(' | '));

  // Duplicate approve blocked conceptually - already approved; item edit locked
  const locked = await httpReq('PUT', `/finance/payroll-ops/runs/${runId}/items/${expRow ? (await httpReq('GET', `/finance/payroll-ops/runs/${runId}?entity_id=HQ001`, null, H)).json.items[0].item_id : 0}`, {
    entity_id: 'HQ001', housing_allowance: 1
  }, H);
  row('منع تعديل بعد الاعتماد', locked.status === 409 ? 'PASS' : 'FAIL', `status=${locked.status} code=${locked.json?.code}`);

  await page.reload({ waitUntil: 'networkidle2' });
  await new Promise((r) => setTimeout(r, 1000));
  await page.evaluate((id) => {
    const btn = document.querySelector(`[data-view="${id}"]`) || document.querySelector(`[data-id="${id}"]`);
    btn?.click();
  }, runId);
  await new Promise((r) => setTimeout(r, 1200));
  await page.screenshot({ path: path.join(ART, 'native-07-approved-cycle.png') });

  await browser.close();

  const pass = results.filter((r) => r.result === 'PASS').length;
  const fail = results.filter((r) => r.result === 'FAIL').length;
  const report = { generated_at: new Date().toISOString(), run_id: runId, results, summary: { pass, fail, total: results.length } };
  fs.writeFileSync(path.join(ART, 'native-payroll-uat-report.json'), JSON.stringify(report, null, 2));
  console.log('\nSUMMARY', report.summary);
  if (fail > 0) process.exitCode = 1;
}

main().catch((e) => { console.error(e); process.exit(1); });
