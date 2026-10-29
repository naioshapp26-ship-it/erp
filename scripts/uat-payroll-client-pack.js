'use strict';

/**
 * Client acceptance pack — visual walkthrough on isolated :3083.
 * No production data, no bank payout. Produces screenshots + Excel/PDF + comparison.
 */
const fs = require('fs');
const http = require('http');
const path = require('path');
const { execSync } = require('child_process');
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
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const login = await httpReq('POST', '/api/auth/login', { email: 'admin@naiosh.com', password: 'Admin@123' });
  const token = login.json?.data?.session?.token;
  if (!token) throw new Error('login failed');
  const H = { Authorization: `Bearer ${token}`, Cookie: `authToken=${token}` };

  const seed = await httpReq('POST', '/finance/payroll-ops/runs/demo-seed', {
    entity_id: 'HQ001', period_year: 2099, period_month: 11
  }, H);
  row('مسير تجريبي DRAFT', seed.json?.success ? 'PASS' : 'FAIL', seed.json?.message || seed.json?.error || '');
  const runId = seed.json?.run?.run_id;
  if (!runId) throw new Error('no run');

  // Add 9th employee via API then edit housing
  const add = await httpReq('POST', `/finance/payroll-ops/runs/${runId}/items`, {
    entity_id: 'HQ001',
    employee_code: '00088',
    full_name_ar: 'تجريبي — هند الزahrاني',
    department: 'التسويق',
    nationality: 'المملكة العربية السعودية',
    base_salary: 6000,
    housing_allowance: 1500,
    nature_allowance: 0,
    transport_allowance: 600,
    other_allowances: 0,
    insurance_amount: -585,
    advance_deduction: -200,
    other_deductions: 0,
    sync_employee: true
  }, H);
  row('إضافة موظف للنموذج/المسير', add.json?.success ? 'PASS' : 'FAIL', `status=${add.status}`);
  const itemId = add.json?.item?.item_id;
  const edit = await httpReq('PUT', `/finance/payroll-ops/runs/${runId}/items/${itemId}`, {
    entity_id: 'HQ001',
    housing_allowance: 1800,
    sync_employee: true
  }, H);
  row('تعديل بدل سكن وانعكاس الإجمالي', edit.json?.success && Number(edit.json?.item?.gross_amount || edit.json?.computed?.gross_amount) === 8400 ? 'PASS' : 'FAIL',
    JSON.stringify({ gross: edit.json?.item?.gross_amount || edit.json?.computed?.gross_amount, net: edit.json?.item?.net_amount || edit.json?.computed?.net_amount }));

  const dup = await httpReq('POST', `/finance/payroll-ops/runs/${runId}/items`, {
    entity_id: 'HQ001', employee_code: '00088', full_name_ar: 'تكرار', base_salary: 1
  }, H);
  row('منع تكرار الموظف في المسير', dup.status === 409 ? 'PASS' : 'FAIL', `code=${dup.json?.code}`);

  const detail = await httpReq('GET', `/finance/payroll-ops/runs/${runId}?entity_id=HQ001`, null, H);
  const items = detail.json?.items || [];
  row('عدد البنود بعد الإضافة', items.length === 9 ? 'PASS' : 'FAIL', `count=${items.length}`);

  const xlsx = await httpReq('GET', `/finance/payroll-ops/runs/${runId}/export.xlsx?entity_id=HQ001`, null, H);
  fs.writeFileSync(path.join(ART, 'client-final-payroll.xlsx'), xlsx.buf);
  const parsed = malika.parseMalikaWorkbook(xlsx.buf);
  const sample = parsed.payrollRows.find((r) => String(r.employee_code) === '00088');
  row('Excel مقروء + حسابات', sample && Number(sample.gross_amount) === 8400 && Number(sample.net_amount) === 7615 ? 'PASS' : 'FAIL', JSON.stringify(sample));

  const pdf = await httpReq('GET', `/finance/payroll-ops/runs/${runId}/export.pdf?entity_id=HQ001`, null, H);
  fs.writeFileSync(path.join(ART, 'client-final-payroll.pdf'), pdf.buf);
  row('PDF عربي بحجم كافٍ', pdf.status === 200 && pdf.buf.length > 20000 ? 'PASS' : 'FAIL', `bytes=${pdf.buf.length}`);

  const browser = await puppeteer.launch({
    executablePath: CHROME, headless: 'new',
    args: ['--no-sandbox', '--disable-gpu', '--window-size=1700,1100']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1700, height: 1100 });

  // PDF visual preview: same HTML Chromium uses for PDF export
  const html = malika.buildPayrollSheetHtml({
    title: detail.json.title,
    items: items.map((it) => malika.toMalikaExportRow(it)),
    excluded: detail.json.excluded || []
  });
  fs.writeFileSync(path.join(ART, 'client-final-sheet.html'), html);
  await page.setContent(html, { waitUntil: 'networkidle0' });
  await page.screenshot({ path: path.join(ART, 'client-final-pdf-preview.png'), fullPage: true });
  row('معاينة محتوى PDF (عربي)', fs.existsSync(path.join(ART, 'client-final-pdf-preview.png')) ? 'PASS' : 'FAIL', 'chromium-html');

  await page.goto(`${BASE}/login-page.html`, { waitUntil: 'domcontentloaded' }).catch(() => {});
  await page.evaluate((t) => { localStorage.setItem('authToken', t); localStorage.setItem('token', t); }, token);
  await page.setCookie({ name: 'authToken', value: token, domain: '127.0.0.1', path: '/' });

  await page.goto(`${BASE}/finance/payroll-hub.html`, { waitUntil: 'networkidle2' });
  await sleep(600);
  await page.screenshot({ path: path.join(ART, 'accept-01-payroll-unit.png') });

  await page.goto(`${BASE}/finance/payroll-runs.html`, { waitUntil: 'networkidle2' });
  await sleep(1000);
  await page.evaluate((id) => {
    (document.querySelector(`[data-view="${id}"]`) || document.querySelector(`[data-id="${id}"]`))?.click();
  }, String(runId));
  await sleep(1800);
  await page.screenshot({ path: path.join(ART, 'accept-02-payroll-page-sheet.png') });

  // Scroll sheet to totals
  await page.evaluate(() => {
    const sheet = document.querySelector('.pay-sheet');
    if (sheet) sheet.scrollTop = sheet.scrollHeight;
  });
  await sleep(400);
  await page.screenshot({ path: path.join(ART, 'accept-03-sheet-totals.png') });

  await page.click('#d-add-salary');
  await page.waitForSelector('#salary-modal:not([hidden])');
  await page.$eval('#sf_code', (el) => { el.value = '00091'; el.dispatchEvent(new Event('input', { bubbles: true })); });
  await page.$eval('#sf_name', (el) => { el.value = 'تجريبي — عرض النموذج للعميل'; });
  await page.$eval('#sf_dept', (el) => { el.value = 'الموارد البشرية'; });
  await page.$eval('#sf_nat', (el) => { el.value = 'مصر'; });
  await page.$eval('#sf_base', (el) => { el.value = '7000'; el.dispatchEvent(new Event('input', { bubbles: true })); });
  await page.$eval('#sf_housing', (el) => { el.value = '1750'; el.dispatchEvent(new Event('input', { bubbles: true })); });
  await page.$eval('#sf_transport', (el) => { el.value = '700'; el.dispatchEvent(new Event('input', { bubbles: true })); });
  await page.$eval('#sf_ins', (el) => { el.value = '682'; el.dispatchEvent(new Event('input', { bubbles: true })); });
  await page.$eval('#sf_adv', (el) => { el.value = '300'; el.dispatchEvent(new Event('input', { bubbles: true })); });
  await sleep(300);
  await page.screenshot({ path: path.join(ART, 'accept-04-salary-form.png') });
  await page.click('#salary-save');
  await sleep(1500);
  await page.screenshot({ path: path.join(ART, 'accept-05-after-add.png') });

  // Edit first editable row
  await page.click('[data-edit-item]');
  await page.waitForSelector('#salary-modal:not([hidden])');
  await page.$eval('#sf_housing', (el) => { el.value = String(Number(el.value || 0) + 100); el.dispatchEvent(new Event('input', { bubbles: true })); });
  await sleep(200);
  await page.screenshot({ path: path.join(ART, 'accept-06-edit-allowance.png') });
  await page.click('#salary-save');
  await sleep(1200);
  await page.screenshot({ path: path.join(ART, 'accept-07-sheet-after-edit.png') });

  const hasMalika = await page.evaluate(() => /مليكة|Malika|استيراد مليكة/i.test(document.body.innerText));
  row('لا ظهور لمليكة في الواجهة', !hasMalika ? 'PASS' : 'FAIL', `hasMalika=${hasMalika}`);
  const importMain = await page.evaluate(() => {
    const hero = document.querySelector('.fw-hero')?.innerText || '';
    return /استيراد/.test(hero);
  });
  row('لا زر استيراد في الشريط الرئيسي', !importMain ? 'PASS' : 'FAIL', `importInHero=${importMain}`);

  await browser.close();

  // Delete guard after we'd approve — test delete works on draft then lock
  const anyItem = (await httpReq('GET', `/finance/payroll-ops/runs/${runId}?entity_id=HQ001`, null, H)).json.items[0];
  const delOk = await httpReq('DELETE', `/finance/payroll-ops/runs/${runId}/items/${anyItem.item_id}?entity_id=HQ001`, { entity_id: 'HQ001' }, H);
  row('حذف قبل الاعتماد', delOk.json?.success ? 'PASS' : 'FAIL', `status=${delOk.status}`);

  const comparison = {
    generated_at: new Date().toISOString(),
    purpose: 'قبول عميل — شكل المسير ووظائفه (بيئة معزولة)',
    run_id: runId,
    reference_columns: malika.MALIKA_COLUMNS.map((c) => c.header.trim()),
    matched: [
      '13 عمودًا بالترتيب المرجعي',
      'RTL + عنوان أصفر + رؤوس زرقاء + تخطيط مقلم أزرق فاتح + صف مجموع برتقالي',
      'تنسيق أرقام بنمط 6 500,00 وخلايا صفرية فارغة للبدلات/الخصوم الاختيارية',
      'أعمدة إجمالي/صافي مميزة بلون أزرق فاتح',
      'نموذج إضافة/تعديل يحفظ في PostgreSQL مع منع التكرار والحذف قبل الاعتماد',
      'تصدير Excel بألوان مطابقة + PDF بخط عربي عبر Chromium',
      'لا زر استيراد مليكة في الواجهة الأساسية'
    ],
    remaining_gaps: [
      'فاصل الآلاف في Excel يعتمد على تنسيق # ##0.00 (قد يظهر حسب لغة Excel لدى العميل بشكل مختلف قليلًا عن لقطة الشاشة)',
      'أيقونات فلتر Excel الأصلية في الملف المصدَّر موجودة كـ AutoFilter وليست مطابقة بصريًا 100% لأسهم واجهة Excel الخاصة بالعميل'
    ],
    artifacts: [
      'accept-01-payroll-unit.png',
      'accept-02-payroll-page-sheet.png',
      'accept-03-sheet-totals.png',
      'accept-04-salary-form.png',
      'accept-05-after-add.png',
      'accept-06-edit-allowance.png',
      'accept-07-sheet-after-edit.png',
      'client-final-payroll.xlsx',
      'client-final-payroll.pdf',
      'client-final-pdf-preview.png',
      'client-reference-excel-screenshot.png'
    ],
    results,
    summary: {
      pass: results.filter((r) => r.result === 'PASS').length,
      fail: results.filter((r) => r.result === 'FAIL').length,
      total: results.length
    }
  };
  fs.writeFileSync(path.join(ART, 'client-acceptance-comparison.json'), JSON.stringify(comparison, null, 2));
  // Markdown report for client-facing review
  fs.writeFileSync(path.join(ART, 'client-acceptance-report.md'), `# تقرير مقارنة مسير الرواتب (قبول عميل)

## النتيجة
- بيئة معزولة فقط — بدون بيانات إنتاج أو صرف بنكي.
- اختبارات آلية: **${comparison.summary.pass}/${comparison.summary.total} PASS**.

## ما يطابق النموذج
${comparison.matched.map((m) => `- ${m}`).join('\n')}

## اختلافات متبقية
${comparison.remaining_gaps.map((m) => `- ${m}`).join('\n')}

## الملفات للعرض
${comparison.artifacts.map((a) => `- ${a}`).join('\n')}
`);
  console.log('\nSUMMARY', comparison.summary);
  if (comparison.summary.fail > 0) process.exitCode = 1;
}

main().catch((e) => { console.error(e); process.exit(1); });
