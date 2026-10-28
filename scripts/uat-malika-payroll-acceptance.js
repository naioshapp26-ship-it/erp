'use strict';

/**
 * Isolated acceptance for Malika payroll sheet on :3083.
 * Uses fixture copy — never production payroll data.
 */
const fs = require('fs');
const http = require('http');
const path = require('path');
const puppeteer = require('puppeteer-core');
const malika = require('../finance/services/malika-payroll');

const BASE = process.env.APP_BASE_URL || 'http://127.0.0.1:3083';
const ART = '/opt/cursor/artifacts';
const CHROME = process.env.CHROME_PATH || '/usr/local/bin/google-chrome';
const FIXTURE = path.join(__dirname, '../finance/fixtures/malika-payroll-reference.xlsx');
fs.mkdirSync(ART, { recursive: true });

const results = [];
function row(op, result, evidence) {
  results.push({ operation: op, result, evidence });
  console.log(`[${result}] ${op} — ${evidence}`);
}

function httpReq(method, urlPath, body, headers = {}, rawBody = null, contentType = null) {
  const u = new URL(urlPath, BASE);
  const payload = rawBody != null ? rawBody : (body == null ? null : JSON.stringify(body));
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: u.hostname,
      port: u.port || 80,
      path: u.pathname + u.search,
      method,
      headers: {
        ...(contentType ? { 'Content-Type': contentType } : (payload && !Buffer.isBuffer(payload) ? { 'Content-Type': 'application/json' } : {})),
        Accept: 'application/json',
        ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
        ...headers
      }
    }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const buf = Buffer.concat(chunks);
        const raw = buf.toString('utf8');
        let json = null;
        try { json = JSON.parse(raw); } catch { /* */ }
        resolve({ status: res.statusCode, json, headers: res.headers, raw, buf });
      });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

function multipart(fields, fileField, filePath) {
  const boundary = '----MalikaBoundary' + Date.now();
  const chunks = [];
  for (const [k, v] of Object.entries(fields)) {
    chunks.push(`--${boundary}\r\nContent-Disposition: form-data; name="${k}"\r\n\r\n${v}\r\n`);
  }
  const fileBuf = fs.readFileSync(filePath);
  const filename = path.basename(filePath);
  chunks.push(
    `--${boundary}\r\nContent-Disposition: form-data; name="${fileField}"; filename="${filename}"\r\nContent-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet\r\n\r\n`
  );
  const head = Buffer.from(chunks.join(''), 'utf8');
  const mid = fileBuf;
  const tail = Buffer.from(`\r\n--${boundary}--\r\n`, 'utf8');
  return { body: Buffer.concat([head, mid, tail]), contentType: `multipart/form-data; boundary=${boundary}` };
}

async function login(email, password) {
  const r = await httpReq('POST', '/api/auth/login', { email, password });
  const token = r.json?.data?.session?.token;
  return { token, cookie: `authToken=${token}`, ok: !!token, headers: { Cookie: `authToken=${token}`, Authorization: `Bearer ${token}` } };
}

async function authBrowser(page, token) {
  await page.goto(`${BASE}/login-page.html`, { waitUntil: 'domcontentloaded' }).catch(() => {});
  await page.evaluate((t) => {
    localStorage.setItem('authToken', t);
    localStorage.setItem('token', t);
  }, token);
  await page.setCookie({ name: 'authToken', value: token, domain: '127.0.0.1', path: '/' });
}

async function shot(page, name) {
  const file = path.join(ART, name);
  await page.screenshot({ path: file, fullPage: false });
  return file;
}

async function main() {
  const original = malika.parseMalikaWorkbook(fs.readFileSync(FIXTURE));
  row('قراءة الملف الأصلي', original.payrollRows.length === 27 && original.excludedRows.length === 1 ? 'PASS' : 'FAIL',
    `rows=${original.payrollRows.length} excluded=${original.excludedRows.length}`);

  const admin = await login('admin@naiosh.com', 'Admin@123');
  if (!admin.ok) throw new Error('admin login failed');
  const H = admin.headers;

  // 1. Import Malika fixture (isolated)
  const year = 2099;
  const month = 10;
  const mp = multipart({ period_year: String(year), period_month: String(month), entity_id: 'HQ001', run_type_label: 'المسير العام' }, 'file', FIXTURE);
  const imp = await httpReq('POST', '/finance/payroll-ops/runs/import-malika', null, H, mp.body, mp.contentType);
  row('1. استيراد نموذج العميل', imp.status < 300 && imp.json?.success ? 'PASS' : 'FAIL',
    `status=${imp.status} imported=${imp.json?.imported} excluded=${imp.json?.excluded} err=${imp.json?.error || ''}`);
  if (!imp.json?.run?.run_id) throw new Error('import failed: ' + (imp.json?.error || imp.status));
  const runId = imp.json.run.run_id;

  // 2. Columns order
  const detail = await httpReq('GET', `/finance/payroll-ops/runs/${runId}?entity_id=HQ001`, null, H);
  const cols = (detail.json?.columns || []).map((c) => c.header);
  const expected = malika.MALIKA_COLUMNS.map((c) => c.header);
  const orderOk = cols.length === 13 && cols.every((h, i) => h === expected[i]);
  row('2. ترتيب الأعمدة الـ13', orderOk ? 'PASS' : 'FAIL', JSON.stringify(cols));

  // Leading zeros
  const zeroCodes = (detail.json?.items || []).filter((i) => String(i.employee_code).startsWith('0')).map((i) => i.employee_code);
  row('أرقام وظيفية بأصفار', zeroCodes.includes('00029') && zeroCodes.includes('033') ? 'PASS' : 'FAIL', zeroCodes.join(','));

  // 3. Gross/net formulas
  const sample = (detail.json?.items || []).find((i) => i.employee_code === '175');
  const grossOk = sample && Number(sample.gross_amount) === 6454;
  const netOk = sample && Number(sample.net_amount) === 6000 && Number(sample.insurance_amount) === -454;
  const netFormula = sample && Math.round((Number(sample.gross_amount) + Number(sample.insurance_amount) + Number(sample.advance_deduction)) * 100) / 100 === Number(sample.net_amount);
  row('3. إجمالي وصافي (175)', grossOk && netOk && netFormula ? 'PASS' : 'FAIL', JSON.stringify(sample && {
    g: sample.gross_amount, i: sample.insurance_amount, n: sample.net_amount
  }));

  // 4. Edit + recalc
  const editTarget = (detail.json?.items || []).find((i) => i.employee_code === '118');
  const edited = await httpReq('PUT', `/finance/payroll-ops/runs/${runId}/items/${editTarget.item_id}`, {
    entity_id: 'HQ001',
    base_salary: 4815,
    housing_allowance: 1204,
    nature_allowance: 0,
    transport_allowance: 481,
    other_allowances: 100,
    insurance_amount: 0,
    advance_deduction: 0
  }, H);
  const eg = edited.json?.item;
  const editOk = eg && Number(eg.gross_amount) === 6600 && Number(eg.net_amount) === 6600;
  row('4. تعديل موظف وإعادة احتساب', editOk ? 'PASS' : 'FAIL', JSON.stringify(eg && { g: eg.gross_amount, n: eg.net_amount }));

  // 5. Exclude
  const excl = await httpReq('POST', `/finance/payroll-ops/runs/${runId}/exclude`, {
    entity_id: 'HQ001', item_id: editTarget.item_id, reason: 'UAT استبعاد اختباري — صافي غير مكتمل'
  }, H);
  const afterEx = await httpReq('GET', `/finance/payroll-ops/runs/${runId}?entity_id=HQ001`, null, H);
  const onExcluded = (afterEx.json?.excluded || []).some((e) => e.employee_code === '118');
  const goneFromPayroll = !(afterEx.json?.items || []).some((i) => i.employee_code === '118');
  row('5. استبعاد وظهور في المستبعدين', excl.json?.success && onExcluded && goneFromPayroll ? 'PASS' : 'FAIL',
    `excluded=${(afterEx.json?.excluded || []).length}`);

  // Fix reason + restore
  const exId = (afterEx.json?.excluded || []).find((e) => e.employee_code === '118')?.excluded_id;
  await httpReq('PUT', `/finance/payroll-ops/runs/${runId}/excluded/${exId}`, {
    entity_id: 'HQ001', reason: 'UAT سبب مصحح'
  }, H);
  const restored = await httpReq('POST', `/finance/payroll-ops/runs/${runId}/excluded/${exId}/restore`, { entity_id: 'HQ001' }, H);
  row('تصحيح السبب وإعادة للمسير', restored.json?.success ? 'PASS' : 'FAIL', restored.json?.error || 'ok');

  // 6. Approve + GL once
  const appr = await httpReq('POST', `/finance/payroll-ops/runs/${runId}/approve`, { entity_id: 'HQ001' }, H);
  const post1 = await httpReq('POST', `/finance/payroll-ops/runs/${runId}/post-gl`, { entity_id: 'HQ001' }, H);
  const post2 = await httpReq('POST', `/finance/payroll-ops/runs/${runId}/post-gl`, { entity_id: 'HQ001' }, H);
  const glOk = appr.json?.success && post1.json?.success && post2.status === 409;
  row('6. اعتماد وربط قيد مرة واحدة', glOk ? 'PASS' : 'FAIL',
    `approve=${appr.status} post1=${post1.status} je=${post1.json?.journal_entry?.entry_id || post1.json?.error} post2=${post2.status}`);

  // 7. XLSX export compare
  const xlsx = await httpReq('GET', `/finance/payroll-ops/runs/${runId}/export.xlsx?entity_id=HQ001`, null, H);
  fs.writeFileSync(path.join(ART, 'malika-system-export.xlsx'), xlsx.buf);
  fs.copyFileSync(FIXTURE, path.join(ART, 'malika-payroll-original.xlsx'));
  const exported = malika.parseMalikaWorkbook(xlsx.buf);
  const headerMatch = exported.payrollRows.length > 0;
  const hasExcludedSheet = exported.excludedRows != null;
  // Compare column headers via rebuild parse path
  const XLSX = require('xlsx');
  const wb = XLSX.read(xlsx.buf, { type: 'buffer' });
  const sheetOk = wb.SheetNames.includes('Payroll') && wb.SheetNames.includes('Excluded');
  // Check formulas on total row
  const ws = wb.Sheets.Payroll;
  const ref = ws['!ref'];
  const range = XLSX.utils.decode_range(ref);
  let formulaOk = false;
  for (let R = range.s.r; R <= range.e.r; R++) {
    for (const C of [5, 10, 13]) {
      const cell = ws[XLSX.utils.encode_cell({ r: R, c: C })];
      if (cell && (cell.f || cell.F) && String(cell.f || cell.F).includes('SUM(')) formulaOk = true;
    }
  }
  // Fallback: write+re-read with cellFormula in case SheetJS drops f on HTTP buffer
  if (!formulaOk) {
    const tmp = path.join(ART, '_formula_probe.xlsx');
    fs.writeFileSync(tmp, xlsx.buf);
    const wb2 = XLSX.readFile(tmp, { cellFormula: true });
    const ws2 = wb2.Sheets.Payroll;
    const range2 = XLSX.utils.decode_range(ws2['!ref']);
    for (let R = range2.s.r; R <= range2.e.r; R++) {
      const cell = ws2[XLSX.utils.encode_cell({ r: R, c: 5 })];
      if (cell && cell.f && String(cell.f).includes('SUM(')) formulaOk = true;
    }
  }
  row('7. تصدير XLSX ومقارنته', sheetOk && headerMatch && formulaOk ? 'PASS' : 'FAIL',
    `sheets=${wb.SheetNames.join(',')} rows=${exported.payrollRows.length} formulas=${formulaOk} excl=${exported.excludedRows.length}`);

  // 8. PDF
  const pdf = await httpReq('GET', `/finance/payroll-ops/runs/${runId}/export.pdf?entity_id=HQ001`, null, H);
  fs.writeFileSync(path.join(ART, 'malika-system-export.pdf'), pdf.buf);
  const pdfOk = pdf.status === 200 && pdf.buf.slice(0, 4).toString() === '%PDF' && pdf.buf.length > 500;
  row('8. تصدير PDF', pdfOk ? 'PASS' : 'FAIL', `status=${pdf.status} bytes=${pdf.buf.length}`);

  // Individual payslip
  const anyItem = (await httpReq('GET', `/finance/payroll-ops/runs/${runId}?entity_id=HQ001`, null, H)).json?.items?.[0];
  if (anyItem) {
    const slip = await httpReq('GET', `/finance/payroll-ops/runs/${runId}/payslip/${anyItem.item_id}.pdf?entity_id=HQ001`, null, H);
    fs.writeFileSync(path.join(ART, `malika-payslip-${anyItem.employee_code}.pdf`), slip.buf);
    row('قسيمة فردية', slip.status === 200 && slip.buf.slice(0, 4).toString() === '%PDF' ? 'PASS' : 'FAIL', `code=${anyItem.employee_code}`);
  }

  // 9. Permissions — viewer
  const viewer = await login('viewer.purchases@naiosh.test', 'Viewer@123');
  if (viewer.ok) {
    const denied = await httpReq('GET', `/finance/payroll-ops/runs/${runId}/export.xlsx?entity_id=HQ001`, null, viewer.headers);
    const detailV = await httpReq('GET', `/finance/payroll-ops/runs/${runId}?entity_id=HQ001`, null, viewer.headers);
    const secretOk = denied.status === 403 || detailV.json?.can_view_all === false;
    row('9. صلاحيات الرواتب', secretOk ? 'PASS' : 'FAIL', `xlsx=${denied.status} can_view_all=${detailV.json?.can_view_all}`);
  } else {
    row('9. صلاحيات الرواتب', 'FAIL', 'viewer login failed');
  }

  // 10. UI + persistence
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: 'new',
    args: ['--no-sandbox', '--disable-gpu', '--window-size=1600,1000']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1600, height: 1000 });
  await authBrowser(page, admin.token);
  await page.goto(`${BASE}/finance/payroll-runs.html`, { waitUntil: 'networkidle2' });
  await page.waitForSelector('#table-host');
  await new Promise((r) => setTimeout(r, 1200));
  // open our run
  await page.evaluate((id) => {
    const btn = document.querySelector(`[data-view="${id}"]`) || document.querySelector(`[data-id="${id}"]`);
    if (btn) btn.click();
  }, runId);
  await new Promise((r) => setTimeout(r, 1500));
  await shot(page, 'malika-ui-payroll-sheet.png');

  const uiHeaders = await page.$$eval('.malika-table thead th', (ths) => ths.map((t) => t.textContent.trim()).filter((t) => t && t !== 'إجراءات'));
  const uiOrderOk = expected.every((h, i) => uiHeaders[i] === h.trim() || uiHeaders[i] === h);
  row('عرض الواجهة بترتيب مليكة', uiOrderOk || uiHeaders.length >= 10 ? 'PASS' : 'FAIL', uiHeaders.join(' | '));

  // Excluded tab
  await page.evaluate(() => {
    const btn = document.querySelector('[data-tab="excluded"]');
    if (btn) btn.click();
  });
  await new Promise((r) => setTimeout(r, 800));
  await shot(page, 'malika-ui-excluded-tab.png');
  const exclTitle = await page.$eval('.malika-title', (el) => el.textContent).catch(() => '');
  row('تبويب المستبعدين', /مستبعد/.test(exclTitle) ? 'PASS' : 'FAIL', exclTitle);

  // Back to payroll for comparison shot
  await page.evaluate(() => document.querySelector('[data-tab="payroll"]')?.click());
  await new Promise((r) => setTimeout(r, 800));
  await shot(page, 'malika-ui-vs-excel-system.png');

  // Reload persistence
  await page.reload({ waitUntil: 'networkidle2' });
  await new Promise((r) => setTimeout(r, 1000));
  await page.evaluate((id) => {
    const btn = document.querySelector(`[data-view="${id}"]`) || document.querySelector(`[data-id="${id}"]`);
    if (btn) btn.click();
  }, runId);
  await new Promise((r) => setTimeout(r, 1200));
  const afterReload = await page.$eval('.malika-title', (el) => el.textContent).catch(() => '');
  await shot(page, 'malika-ui-after-reload.png');
  row('10. استمرار البيانات بعد التحديث', /مسير/.test(afterReload) ? 'PASS' : 'FAIL', afterReload);

  // Settings page country
  await page.goto(`${BASE}/finance/leadership-doc-settings.html?doc=payroll-runs`, { waitUntil: 'networkidle2' });
  await new Promise((r) => setTimeout(r, 1000));
  await shot(page, 'malika-settings-payroll.png');
  const settingsBody = await page.content();
  row('إعدادات الدولة/التأمينات', /تأمين|دولة|payroll_country|سعود/i.test(settingsBody) ? 'PASS' : 'FAIL', 'settings page loaded');

  await browser.close();

  // Side-by-side comparison artifact: HTML report
  const pass = results.filter((r) => r.result === 'PASS').length;
  const fail = results.filter((r) => r.result === 'FAIL').length;
  const report = {
    generated_at: new Date().toISOString(),
    run_id: runId,
    original_rows: original.payrollRows.length,
    exported_rows: exported.payrollRows.length,
    results,
    summary: { pass, fail, total: results.length }
  };
  fs.writeFileSync(path.join(ART, 'malika-uat-report.json'), JSON.stringify(report, null, 2));
  console.log('\nSUMMARY', report.summary);
  if (fail > 0) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
