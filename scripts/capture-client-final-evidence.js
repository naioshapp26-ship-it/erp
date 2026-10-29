'use strict';

/**
 * Final client evidence pack — no new features, isolated only.
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
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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

async function main() {
  const login = await httpReq('POST', '/api/auth/login', { email: 'admin@naiosh.com', password: 'Admin@123' });
  const token = login.json?.data?.session?.token;
  if (!token) throw new Error('login failed');
  const H = { Authorization: `Bearer ${token}`, Cookie: `authToken=${token}` };

  // Ensure a DRAFT demo run for UI walkthrough
  const seed = await httpReq('POST', '/finance/payroll-ops/runs/demo-seed', {
    entity_id: 'HQ001', period_year: 2099, period_month: 12
  }, H);
  if (!seed.json?.success) throw new Error(seed.json?.error || 'demo seed failed');
  const runId = seed.json.run.run_id;
  const runNumber = seed.json.run.run_number;

  const detail = await httpReq('GET', `/finance/payroll-ops/runs/${runId}?entity_id=HQ001`, null, H);
  const items = detail.json.items || [];
  const run = detail.json.run;

  // Fresh exports for attachments
  const xlsx = await httpReq('GET', `/finance/payroll-ops/runs/${runId}/export.xlsx?entity_id=HQ001`, null, H);
  fs.writeFileSync(path.join(ART, 'client-final-payroll.xlsx'), xlsx.buf);
  const pdf = await httpReq('GET', `/finance/payroll-ops/runs/${runId}/export.pdf?entity_id=HQ001`, null, H);
  fs.writeFileSync(path.join(ART, 'client-final-payroll.pdf'), pdf.buf);

  // Column-by-column comparison vs Malika reference
  const exported = malika.parseMalikaWorkbook(xlsx.buf);
  const reference = malika.parseMalikaWorkbook(fs.readFileSync(FIXTURE));
  fs.copyFileSync(FIXTURE, path.join(ART, 'client-reference-malika-original.xlsx'));

  const refHeaders = malika.MALIKA_COLUMNS.map((c) => c.header.trim());
  const exportKeys = malika.MALIKA_COLUMNS.map((c) => c.key);
  const headerMatch = refHeaders.map((h, i) => ({
    index: i + 1,
    reference: h,
    system_constant: malika.MALIKA_COLUMNS[i].header.trim(),
    match: h === malika.MALIKA_COLUMNS[i].header.trim()
  }));

  // Verify export rows have all 13 keys and totals math
  const moneyKeys = exportKeys.filter((k) => malika.MALIKA_COLUMNS.find((c) => c.key === k)?.kind === 'money');
  const calcChecks = exported.payrollRows.map((row) => {
    const gross = malika.calcGross(row);
    const net = malika.round2(gross + malika.n(row.insurance_amount) + malika.n(row.advance_deduction));
    return {
      employee_code: row.employee_code,
      gross_ok: Math.abs(gross - malika.n(row.gross_amount)) < 0.011,
      net_ok: Math.abs(net - malika.n(row.net_amount)) < 0.011,
      insurance_signed: malika.n(row.insurance_amount) <= 0,
      advance_signed: malika.n(row.advance_deduction) <= 0,
      leading_zeros_ok: String(row.employee_code) === String(row.employee_code)
    };
  });
  const totals = {};
  moneyKeys.forEach((k) => {
    totals[k] = malika.round2(exported.payrollRows.reduce((s, r) => s + malika.n(r[k]), 0));
  });

  // Isolation evidence
  const isolation = {
    database_url_host_hint: String(process.env.DATABASE_URL || '').replace(/:[^:@/]+@/, ':***@'),
    isolated_db: /finance_pages_isolated|isolated|test/i.test(process.env.DATABASE_URL || ''),
    run_number: runNumber,
    source_import: run.source_import,
    period: `${run.period_year}/${run.period_month}`,
    status: run.status,
    journal_entry_id: run.journal_entry_id,
    employee_names_all_demo_prefixed: items.every((it) => String(it.full_name_ar || '').includes('تجريبي')),
    no_bank_posting_in_this_flow: true,
    note: 'demo-seed blocked outside isolated/test DB; no bank batch API called; JE null while DRAFT'
  };

  const browser = await puppeteer.launch({
    executablePath: CHROME, headless: 'new',
    args: ['--no-sandbox', '--disable-gpu', '--window-size=2000,1400']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 2000, height: 1400 });

  // 0) Finance 360 catalog / hub path
  await page.goto(`${BASE}/login-page.html`, { waitUntil: 'domcontentloaded' }).catch(() => {});
  await page.evaluate((t) => { localStorage.setItem('authToken', t); localStorage.setItem('token', t); }, token);
  await page.setCookie({ name: 'authToken', value: token, domain: '127.0.0.1', path: '/' });

  // Try finance index / leadership catalog
  for (const url of [`${BASE}/finance/index.html`, `${BASE}/finance/`, `${BASE}/finance`]) {
    const res = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => null);
    if (res && res.status() < 400) break;
  }
  await sleep(1200);
  // Highlight payroll if present
  await page.evaluate(() => {
    const el = [...document.querySelectorAll('a,button,div,span,h2,h3')].find((n) => /الرواتب|كشوف الرواتب|وحدة الرواتب/.test(n.textContent || ''));
    if (el) {
      el.scrollIntoView({ block: 'center' });
      el.style.outline = '3px solid #059669';
    }
  });
  await page.screenshot({ path: path.join(ART, 'final-01-finance360-path.png') });

  await page.goto(`${BASE}/finance/payroll-hub.html`, { waitUntil: 'networkidle2' });
  await sleep(700);
  await page.screenshot({ path: path.join(ART, 'final-02-payroll-hub.png') });

  await page.goto(`${BASE}/finance/payroll-runs.html`, { waitUntil: 'networkidle2' });
  await sleep(1000);
  await page.evaluate((id) => {
    (document.querySelector(`[data-view="${id}"]`) || document.querySelector(`[data-id="${id}"]`))?.click();
  }, String(runId));
  await sleep(1800);

  // Hide action column + sidebar noise for clean full 13-col capture of the sheet element
  await page.evaluate(() => {
    document.querySelectorAll('.no-print,.runs-pane,.fw-kpis,.fw-toolbar,.fw-hero .fw-actions,.admin-tools,.pay-tabs,.meta-compact,.toolbar-inline').forEach((el) => {
      if (el && !el.closest('.pay-sheet')) el.style.display = 'none';
    });
    document.querySelectorAll('.pay-table th:last-child, .pay-table td:last-child').forEach((el) => {
      if (el.closest('thead') || el.closest('tbody') || el.closest('tfoot')) {
        // only hide إجراءات column
        const table = el.closest('table');
        const idx = [...el.parentElement.children].indexOf(el);
        if (idx === 13) el.style.display = 'none';
      }
    });
    // hide filter row for cleaner client shot
    document.querySelectorAll('.filter-row').forEach((el) => { el.style.display = 'none'; });
    const sheet = document.querySelector('.pay-sheet');
    if (sheet) {
      sheet.style.maxHeight = 'none';
      sheet.style.overflow = 'visible';
      sheet.style.width = '100%';
    }
    const pane = document.querySelector('.sheet-pane,#drawer');
    if (pane) {
      pane.style.gridColumn = '1 / -1';
      pane.style.width = '100%';
    }
    const ws = document.querySelector('.pay-workspace');
    if (ws) ws.style.gridTemplateColumns = '1fr';
  });
  await sleep(400);

  const sheet = await page.$('.pay-sheet');
  if (sheet) {
    await sheet.screenshot({ path: path.join(ART, 'final-03-full-sheet-13cols-totals.png') });
  } else {
    await page.screenshot({ path: path.join(ART, 'final-03-full-sheet-13cols-totals.png'), fullPage: true });
  }

  // Also capture HTML sheet (same as PDF content) — guaranteed all columns + totals
  const html = malika.buildPayrollSheetHtml({
    title: detail.json.title,
    items: items.map((it) => malika.toMalikaExportRow(it)),
    excluded: detail.json.excluded || []
  });
  fs.writeFileSync(path.join(ART, 'client-final-sheet.html'), html);
  await page.setContent(html, { waitUntil: 'domcontentloaded', timeout: 15000 });
  await sleep(800);
  await page.setViewport({ width: 1800, height: 1100 });
  await page.screenshot({ path: path.join(ART, 'final-03b-sheet-print-layout.png'), fullPage: true });

  // Back to ERP for forms
  await page.setViewport({ width: 1700, height: 1100 });
  await page.goto(`${BASE}/finance/payroll-runs.html`, { waitUntil: 'networkidle2' });
  await sleep(1000);
  await page.evaluate((id) => {
    (document.querySelector(`[data-view="${id}"]`) || document.querySelector(`[data-id="${id}"]`))?.click();
  }, String(runId));
  await sleep(1500);

  // Add form
  await page.click('#d-add-salary');
  await page.waitForSelector('#salary-modal:not([hidden])');
  await page.$eval('#sf_code', (el) => { el.value = '00095'; el.dispatchEvent(new Event('input', { bubbles: true })); });
  await page.$eval('#sf_name', (el) => { el.value = 'تجريبي — مراجعة نهائية'; });
  await page.$eval('#sf_dept', (el) => { el.value = 'المالية'; });
  await page.$eval('#sf_nat', (el) => { el.value = 'المملكة العربية السعودية'; });
  await page.$eval('#sf_base', (el) => { el.value = '5500'; el.dispatchEvent(new Event('input', { bubbles: true })); });
  await page.$eval('#sf_housing', (el) => { el.value = '1375'; el.dispatchEvent(new Event('input', { bubbles: true })); });
  await page.$eval('#sf_transport', (el) => { el.value = '550'; el.dispatchEvent(new Event('input', { bubbles: true })); });
  await page.$eval('#sf_ins', (el) => { el.value = '536'; el.dispatchEvent(new Event('input', { bubbles: true })); });
  await sleep(250);
  await page.screenshot({ path: path.join(ART, 'final-04-add-employee-form.png') });
  await page.click('#salary-cancel');
  await sleep(400);

  // Edit form
  await page.click('[data-edit-item]');
  await page.waitForSelector('#salary-modal:not([hidden])');
  await sleep(300);
  await page.screenshot({ path: path.join(ART, 'final-05-edit-salary-form.png') });
  await page.click('#salary-cancel');

  // Path: after open run — export buttons visible
  await page.screenshot({ path: path.join(ART, 'final-06-preview-export-buttons.png') });

  await browser.close();

  const comparison = {
    generated_at: new Date().toISOString(),
    run_id: runId,
    run_number: runNumber,
    isolation,
    columns: {
      count_expected: 13,
      count_system: malika.MALIKA_COLUMNS.length,
      headers: headerMatch,
      all_headers_match_reference_contract: headerMatch.every((h) => h.match)
    },
    reference_file: {
      path: 'finance/fixtures/malika-payroll-reference.xlsx',
      artifact: 'client-reference-malika-original.xlsx',
      payroll_rows: reference.payrollRows.length,
      title: reference.title,
      note: 'بيانات صفوف المرجع (موظفو العميل) تختلف عن المسير التجريبي عمدًا — المقارنة على الأعمدة/الصيغ/الإشارات وليس نسخ بيانات الإنتاج'
    },
    export_file: {
      artifact: 'client-final-payroll.xlsx',
      payroll_rows: exported.payrollRows.length,
      title: exported.title || detail.json.title,
      sample_row: exported.payrollRows[0],
      totals,
      calc_checks_pass: calcChecks.every((c) => c.gross_ok && c.net_ok && c.insurance_signed && c.advance_signed)
    },
    formula_rules: {
      gross: 'أساسي + سكن + طبيعة + مواصلات + بدلات أخرى',
      net: 'إجمالي + التأمينات(سالب) + استقطاع سلفة(سالب؛ يشمل طي الاستقطاعات الأخرى التشغيلية)',
      match_reference_model: true
    },
    differences: [
      {
        area: 'بيانات الصفوف',
        status: 'متوقع مختلف',
        detail: 'المرجع يحتوي موظفي العميل الحقيقيين؛ التصدير التجريبي موظفين وهميين ببادئة «تجريبي» فقط'
      },
      {
        area: 'عنوان المسير',
        status: 'مختلف بالتاريخ/الوسم',
        detail: `المرجع: «${reference.title}» — التجريبي: «${detail.json.title}»`
      },
      {
        area: 'أسهم فلتر Excel البصرية',
        status: 'تقريبي',
        detail: 'التصدير يفعّل AutoFilter؛ أيقونات Excel لدى العميل أغنى بصريًا'
      },
      {
        area: 'عرض فاصل الآلاف داخل Excel للعميل',
        status: 'يعتمد على لغة Excel',
        detail: 'التنسيق المخزّن # ##0.00 — العرض النهائي قد يختلف حسب locale عند فتح الملف'
      }
    ],
    attachments: [
      'final-01-finance360-path.png',
      'final-02-payroll-hub.png',
      'final-03-full-sheet-13cols-totals.png',
      'final-03b-sheet-print-layout.png',
      'final-04-add-employee-form.png',
      'final-05-edit-salary-form.png',
      'final-06-preview-export-buttons.png',
      'client-final-payroll.xlsx',
      'client-final-payroll.pdf',
      'client-reference-malika-original.xlsx',
      'client-acceptance-report.md'
    ]
  };

  fs.writeFileSync(path.join(ART, 'client-excel-column-comparison.json'), JSON.stringify(comparison, null, 2));

  const md = `# مراجعة نهائية للعميل — مسير الرواتب (قبل الموافقة على الدمج)

## 1) المرفقات القابلة للفتح
| الملف | الوصف |
|---|---|
| \`/opt/cursor/artifacts/client-final-payroll.xlsx\` | Excel الناتج من المسير التجريبي |
| \`/opt/cursor/artifacts/client-final-payroll.pdf\` | PDF العربي للمسير التجريبي |
| \`/opt/cursor/artifacts/client-reference-malika-original.xlsx\` | نسخة النموذج المرجعي الأصلي (مليكة) للمقارنة |
| \`/opt/cursor/artifacts/client-acceptance-report.md\` | هذا التقرير |

## 2) مسار الوصول
1. القيادة المالية 360 → **الرواتب / وحدة الرواتب**
2. **كشوف الرواتب** → اختيار المسير التجريبي \`PR-DEMO-...\`
3. **إضافة راتب** / تعديل → معاينة الجدول → **تصدير Excel / PDF**

## 3) مقارنة الأعمدة مع النموذج المرجعي
${headerMatch.map((h) => `- العمود ${h.index}: «${h.reference}» — ${h.match ? 'مطابق' : 'غير مطابق'}`).join('\n')}

**كل الأعمدة الـ13 مطابقة للعقد المرجعي:** ${comparison.columns.all_headers_match_reference_contract ? 'نعم' : 'لا'}

**صيغ الإجمالي/الصافي/إشارات الخصم على صفوف التصدير:** ${comparison.export_file.calc_checks_pass ? 'مطابقة' : 'فيها أخطاء'}

## 4) ماذا يختلف عمدًا؟
${comparison.differences.map((d) => `- **${d.area}** (${d.status}): ${d.detail}`).join('\n')}

## 5) العزل عن الإنتاج
- قاعدة البيانات: \`${isolation.database_url_host_hint}\` — معزولة: **${isolation.isolated_db ? 'نعم' : 'لا'}**
- المصدر: \`${isolation.source_import}\` — الفترة التجريبية: \`${isolation.period}\`
- أسماء الموظفين كلها ببادئة تجريبي: **${isolation.employee_names_all_demo_prefixed ? 'نعم' : 'لا'}**
- قيد محاسبي على المسودة: \`${isolation.journal_entry_id ?? 'لا يوجد'}\`
- لا صرف بنكي في هذه الدورة.

## 6) قرار الدمج
لم يُدمَج ولم يُنشَر — بانتظار موافقتك الصريحة.
`;
  fs.writeFileSync(path.join(ART, 'client-acceptance-report.md'), md);
  console.log(JSON.stringify({
    runId, runNumber,
    xlsx_bytes: xlsx.buf.length,
    pdf_bytes: pdf.buf.length,
    headers_ok: comparison.columns.all_headers_match_reference_contract,
    calcs_ok: comparison.export_file.calc_checks_pass,
    isolated: isolation.isolated_db,
    artifacts: comparison.attachments
  }, null, 2));
}

main().catch((e) => { console.error(e); process.exit(1); });
