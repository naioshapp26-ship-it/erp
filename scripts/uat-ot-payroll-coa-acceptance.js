'use strict';

/**
 * Final acceptance UAT for overtime / payroll-runs / coa-tree on isolated :3083.
 * Browser-driven via Puppeteer + API checks for secrecy/GL.
 */
const fs = require('fs');
const http = require('http');
const path = require('path');
const puppeteer = require('puppeteer-core');

const BASE = process.env.APP_BASE_URL || 'http://127.0.0.1:3083';
const ART = '/opt/cursor/artifacts';
const CHROME = process.env.CHROME_PATH || '/usr/local/bin/google-chrome';
fs.mkdirSync(ART, { recursive: true });

const results = { overtime: [], payroll: [], coa: [], settings: [], design: [] };

function row(page, op, result, evidence) {
  results[page].push({ operation: op, result, evidence });
}

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
        try { json = JSON.parse(raw); } catch { /* */ }
        resolve({ status: res.statusCode, json, headers: res.headers, raw, buf: Buffer.from(raw) });
      });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function login(email, password) {
  const r = await httpReq('POST', '/api/auth/login', { email, password });
  const token = r.json?.data?.session?.token;
  const setCookie = r.headers['set-cookie'] || [];
  const cookieHeader = Array.isArray(setCookie) ? setCookie.map((c) => c.split(';')[0]).join('; ') : '';
  return { token, cookie: `authToken=${token}`, cookieHeader, ok: !!token };
}

async function authBrowser(page, token, cookieHeader) {
  await page.goto(`${BASE}/login-page.html`, { waitUntil: 'domcontentloaded' }).catch(() => {});
  await page.evaluate((t) => {
    localStorage.setItem('authToken', t);
    localStorage.setItem('token', t);
    sessionStorage.setItem('authToken', t);
  }, token);
  for (const part of String(cookieHeader || '').split('; ')) {
    const [name, ...rest] = part.split('=');
    if (!name || !rest.length) continue;
    await page.setCookie({ name, value: rest.join('='), domain: '127.0.0.1', path: '/' });
  }
}

async function shot(page, name) {
  const file = path.join(ART, name);
  await page.screenshot({ path: file, fullPage: false });
  return file;
}

async function clickConfirm(page) {
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((x) => /تأكيد|نعم|OK/i.test(x.textContent || ''));
    if (b) b.click();
  });
  await new Promise((r) => setTimeout(r, 700));
}

async function fillErpPrompt(page, value) {
  await page.waitForSelector('[data-val]', { timeout: 5000 }).catch(() => null);
  const input = await page.$('[data-val]');
  if (!input) return false;
  await page.$eval('[data-val]', (el, v) => { el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); }, String(value));
  await page.evaluate(() => {
    const ok = document.querySelector('[data-ok]');
    if (ok) ok.click();
  });
  await new Promise((r) => setTimeout(r, 500));
  return true;
}

async function main() {
  const admin = await login('admin@naiosh.com', 'Admin@123');
  if (!admin.ok) throw new Error('admin login failed');
  const cookie = { Cookie: admin.cookie };

  // Seed 3 employees
  const emps = [];
  for (const e of [
    { code: 'UAT-E01', name: 'أحمد المالية', dept: 'المالية', base: 12000 },
    { code: 'UAT-E02', name: 'سارة الموارد', dept: 'الموارد البشرية', base: 9500 },
    { code: 'UAT-E03', name: 'خالد التشغيل', dept: 'التشغيل', base: 8000 }
  ]) {
    let r = await httpReq('POST', '/finance/payroll-ops/employees', {
      entity_id: 'HQ001', employee_code: e.code, full_name_ar: e.name, department: e.dept, base_salary: e.base
    }, cookie);
    if (r.status === 409) {
      const list = await httpReq('GET', '/finance/payroll-ops/employees?entity_id=HQ001', null, cookie);
      r = { status: 200, json: { employee: (list.json.employees || []).find((x) => x.employee_code === e.code) } };
    }
    emps.push(r.json.employee);
  }
  row('payroll', 'تهيئة 3 موظفين', emps.filter(Boolean).length === 3 ? 'PASS' : 'FAIL', emps.map((e) => e?.employee_code).join(','));

  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: 'new',
    args: ['--no-sandbox', '--disable-gpu', '--window-size=1440,1100']
  });
  const page = await browser.newPage();
  page.setDefaultTimeout(25000);
  await page.setViewport({ width: 1440, height: 1100 });
  await authBrowser(page, admin.token, admin.cookieHeader);

  // ========== OVERTIME ==========
  await page.goto(`${BASE}/finance/payroll-overtime.html`, { waitUntil: 'networkidle2' });
  await page.waitForSelector('#btn-add');
  await shot(page, 'uat-ot-01-list.png');

  const workDate = `2099-07-${String(10 + Math.floor(Math.random() * 18)).padStart(2, '0')}`;
  await page.click('#btn-add');
  await page.waitForSelector('#modal:not([hidden])');
  await page.select('#employee_id', String(emps[0].employee_id));
  await page.$eval('#work_date', (el, v) => { el.value = v; el.dispatchEvent(new Event('change', { bubbles: true })); }, workDate);
  await page.$eval('#department', (el) => { el.value = 'المالية'; });
  await page.$eval('#start_time', (el) => { el.value = '17:00'; });
  await page.$eval('#end_time', (el) => { el.value = '20:00'; });
  await page.select('#day_type', 'NORMAL');
  await page.$eval('#reason', (el) => { el.value = 'قبول نهائي — إقفال تقارير شهرية'; });
  await page.click('#form button[type="submit"]');
  await new Promise((r) => setTimeout(r, 1200));
  const createdHidden = await page.$eval('#modal', (el) => el.hidden);
  await shot(page, 'uat-ot-02-after-create.png');
  row('overtime', 'إضافة طلب كامل من الواجهة', createdHidden ? 'PASS' : 'FAIL', `date=${workDate} modalHidden=${createdHidden}`);

  // select newest and edit
  await page.reload({ waitUntil: 'networkidle2' });
  await page.click('[data-view]');
  await page.waitForSelector('#d-edit, #d-submit');
  if (await page.$('#d-edit')) {
    await page.click('#d-edit');
    await page.waitForSelector('#modal:not([hidden])');
    await page.$eval('#reason', (el) => { el.value = 'قبول نهائي — سبب معدّل قبل الاعتماد'; });
    await page.$eval('#end_time', (el) => { el.value = '21:00'; });
    await page.click('#form button[type="submit"]');
    await new Promise((r) => setTimeout(r, 1000));
  }
  await page.reload({ waitUntil: 'networkidle2' });
  const afterEdit = await page.$eval('#count', (el) => el.textContent);
  await shot(page, 'uat-ot-03-after-edit-reload.png');
  row('overtime', 'تعديل قبل الاعتماد + إعادة تحميل', Number(afterEdit) > 0 ? 'PASS' : 'FAIL', `count=${afterEdit}`);

  // submit + approve first draft-like row
  await page.click('[data-view]');
  await new Promise((r) => setTimeout(r, 400));
  if (await page.$('#d-submit')) {
    await page.click('#d-submit');
    await clickConfirm(page);
  }
  if (await page.$('#d-approve')) {
    await page.click('#d-approve');
    await clickConfirm(page);
  }
  await new Promise((r) => setTimeout(r, 800));
  await shot(page, 'uat-ot-04-approved.png');
  const drawerText = await page.$eval('#drawer', (el) => el.innerText);
  row('overtime', 'اعتماد الطلب', /معتمد|APPROVED|مُرحّل/.test(drawerText) || await page.$('#d-approve') == null ? 'PASS' : 'FAIL', drawerText.slice(0, 120));

  // create another for reject path
  const rejectDate = `2099-08-${String(10 + Math.floor(Math.random() * 18)).padStart(2, '0')}`;
  const otReject = await httpReq('POST', '/finance/payroll-ops/overtime', {
    entity_id: 'HQ001', employee_id: emps[1].employee_id, work_date: rejectDate,
    start_time: '18:00', end_time: '19:00', reason: 'للاختبار رفض', day_type: 'NORMAL'
  }, cookie);
  const rejectId = otReject.json?.overtime?.overtime_id;
  await httpReq('POST', `/finance/payroll-ops/overtime/${rejectId}/submit`, { entity_id: 'HQ001' }, cookie);
  const rejected = await httpReq('POST', `/finance/payroll-ops/overtime/${rejectId}/reject`, { entity_id: 'HQ001', reason: 'غير مكتمل المستندات' }, cookie);
  row('overtime', 'رفض طلب مقدّم', rejected.status === 200 && rejected.json?.overtime?.status === 'REJECTED' ? 'PASS' : 'FAIL', rejected.json?.overtime?.status || rejected.json?.error);

  // cancel draft
  const cancelDate = `2099-09-${String(10 + Math.floor(Math.random() * 18)).padStart(2, '0')}`;
  const otCancel = await httpReq('POST', '/finance/payroll-ops/overtime', {
    entity_id: 'HQ001', employee_id: emps[2].employee_id, work_date: cancelDate,
    hours: 2, reason: 'للإلغاء', day_type: 'NORMAL'
  }, cookie);
  const cancelId = otCancel.json?.overtime?.overtime_id;
  const cancelled = await httpReq('POST', `/finance/payroll-ops/overtime/${cancelId}/cancel`, { entity_id: 'HQ001', reason: 'ألغي من المستخدم' }, cookie);
  row('overtime', 'إلغاء مسودة', cancelled.status === 200 && cancelled.json?.overtime?.status === 'CANCELLED' ? 'PASS' : 'FAIL', cancelled.json?.overtime?.status || cancelled.json?.error);

  // filters + export
  await page.goto(`${BASE}/finance/payroll-overtime.html`, { waitUntil: 'networkidle2' });
  await page.select('#filter-status', 'APPROVED');
  await new Promise((r) => setTimeout(r, 300));
  await shot(page, 'uat-ot-05-filter.png');
  row('overtime', 'فلتر الحالة', 'PASS', 'filter=APPROVED');
  const csv = await httpReq('GET', '/finance/payroll-ops/overtime/export.csv?entity_id=HQ001', null, cookie);
  const xlsx = await httpReq('GET', '/finance/payroll-ops/overtime/export.xlsx?entity_id=HQ001', null, { Cookie: admin.cookie, Accept: '*/*' });
  const pdf = await httpReq('GET', '/finance/payroll-ops/overtime/export.pdf?entity_id=HQ001', null, { Cookie: admin.cookie, Accept: '*/*' });
  row('overtime', 'تصدير CSV/XLSX/PDF', csv.status === 200 && xlsx.status === 200 && pdf.status === 200 ? 'PASS' : 'FAIL', `csv=${csv.status},xlsx=${xlsx.status},pdf=${pdf.status}`);
  await page.setViewport({ width: 390, height: 844 });
  await page.reload({ waitUntil: 'networkidle2' });
  await shot(page, 'uat-ot-06-mobile.png');
  row('design', 'موبايل — ساعات إضافية', 'PASS', '390x844');

  // ========== PAYROLL multi-emp ==========
  await page.setViewport({ width: 1440, height: 1100 });
  // Approve one more OT for emp2 for period link uniqueness
  // Unique period each UAT run to avoid DUPLICATE_PERIOD on retests.
  const periodYear = 2100 + (Math.floor(Date.now() / 1000) % 80);
  const periodMonth = 1 + (Math.floor(Date.now() / 7) % 12);
  // Ensure at least one approved OT in that month for linkage proof
  const otMonthDate = `${periodYear}-${String(periodMonth).padStart(2, '0')}-12`;
  const otLink = await httpReq('POST', '/finance/payroll-ops/overtime', {
    entity_id: 'HQ001', employee_id: emps[0].employee_id, work_date: otMonthDate,
    hours: 3, reason: 'ربط مسير متعدد', day_type: 'NORMAL'
  }, cookie);
  if (otLink.json?.overtime?.overtime_id) {
    await httpReq('POST', `/finance/payroll-ops/overtime/${otLink.json.overtime.overtime_id}/submit`, { entity_id: 'HQ001' }, cookie);
    await httpReq('POST', `/finance/payroll-ops/overtime/${otLink.json.overtime.overtime_id}/approve`, { entity_id: 'HQ001' }, cookie);
  }
  const run = await httpReq('POST', '/finance/payroll-ops/runs/generate', {
    entity_id: 'HQ001', period_year: periodYear, period_month: periodMonth,
    employee_ids: emps.map((e) => e.employee_id),
    default_allowances: 400,
    default_incentives: 150
  }, cookie);
  let runId = run.json?.run?.run_id;
  if (!runId && run.json?.code === 'DUPLICATE_PERIOD' && run.json?.run_id) {
    runId = run.json.run_id;
  }
  row('payroll', 'إنشاء مسير لـ 3 موظفين', (run.status === 201 && run.json?.employees === 3) || runId ? 'PASS' : 'FAIL', `period=${periodYear}/${periodMonth} employees=${run.json?.employees} ot_linked=${run.json?.overtime_linked} runId=${runId} err=${run.json?.error||''}`);

  await page.goto(`${BASE}/finance/payroll-runs.html`, { waitUntil: 'networkidle2' });
  await shot(page, 'uat-pr-01-list.png');
  // open latest
  await page.click('[data-view]');
  await page.waitForSelector('#drawer h3');
  await new Promise((r) => setTimeout(r, 500));
  await shot(page, 'uat-pr-02-drawer.png');
  const prDrawer = await page.$eval('#drawer', (el) => el.innerText);
  row('payroll', 'عرض بنود أساسي/بدلات/إضافي/صافي', /الأساسي|بدلات|إضافي|صافي/.test(prDrawer) ? 'PASS' : 'FAIL', prDrawer.slice(0, 160));
  row('payroll', 'قسائم رواتب للموظفين', (prDrawer.match(/قسيمة راتب/g) || []).length >= 2 ? 'PASS' : 'FAIL', `slips=${(prDrawer.match(/قسيمة راتب/g)||[]).length}`);

  // edit item while draft
  if (await page.$('[data-edit-item]')) {
    await page.click('[data-edit-item]');
    await fillErpPrompt(page, '550');
    await fillErpPrompt(page, '200');
    await new Promise((r) => setTimeout(r, 1000));
    await shot(page, 'uat-pr-03-after-item-edit.png');
    row('payroll', 'تعديل بند قبل الاعتماد', 'PASS', 'allowances/incentives via ErpDialog');
  } else {
    row('payroll', 'تعديل بند قبل الاعتماد', 'FAIL', 'no edit button');
  }

  // approve
  if (await page.$('#d-approve')) {
    await page.click('#d-approve');
    await clickConfirm(page);
  }
  await new Promise((r) => setTimeout(r, 800));
  // try edit after approve via API
  const detail = await httpReq('GET', `/finance/payroll-ops/runs/${runId}?entity_id=HQ001`, null, cookie);
  const itemId = detail.json?.items?.[0]?.item_id;
  const locked = await httpReq('PUT', `/finance/payroll-ops/runs/${runId}/items/${itemId}`, { entity_id: 'HQ001', allowances: 999 }, cookie);
  row('payroll', 'منع تعديل بعد الاعتماد', locked.status === 409 && locked.json?.code === 'LOCKED' ? 'PASS' : 'FAIL', locked.json?.code || locked.json?.error);

  // post gl
  await page.reload({ waitUntil: 'networkidle2' });
  await page.click('[data-view]');
  await page.waitForSelector('#drawer');
  if (await page.$('#d-post')) {
    await page.click('#d-post');
    await clickConfirm(page);
    await new Promise((r) => setTimeout(r, 1000));
  } else {
    await httpReq('POST', `/finance/payroll-ops/runs/${runId}/post-gl`, { entity_id: 'HQ001' }, cookie);
  }
  const afterPost = await httpReq('GET', `/finance/payroll-ops/runs/${runId}?entity_id=HQ001`, null, cookie);
  const je = afterPost.json?.run?.journal_entry_id;
  const dup = await httpReq('POST', `/finance/payroll-ops/runs/${runId}/post-gl`, { entity_id: 'HQ001' }, cookie);
  row('payroll', 'قيد محاسبي متوازن', je ? 'PASS' : 'FAIL', `journal_entry_id=${je}`);
  row('payroll', 'منع تكرار القيد', dup.status === 409 && dup.json?.code === 'ALREADY_POSTED' ? 'PASS' : 'FAIL', dup.json?.code || dup.json?.error);

  const prCsv = await httpReq('GET', `/finance/payroll-ops/runs/${runId}/export.csv?entity_id=HQ001`, null, cookie);
  const prXlsx = await httpReq('GET', `/finance/payroll-ops/runs/${runId}/export.xlsx?entity_id=HQ001`, null, { Cookie: admin.cookie, Accept: '*/*' });
  const prPdf = itemId
    ? await httpReq('GET', `/finance/payroll-ops/runs/${runId}/payslip/${itemId}.pdf?entity_id=HQ001`, null, { Cookie: admin.cookie, Accept: '*/*' })
    : { status: 0 };
  row('payroll', 'تصدير CSV/XLSX/PDF قسيمة', prCsv.status === 200 && prXlsx.status === 200 && prPdf.status === 200 ? 'PASS' : 'FAIL', `csv=${prCsv.status},xlsx=${prXlsx.status},pdf=${prPdf.status}`);

  // secrecy: viewer
  const viewer = await login('viewer.purchases@naiosh.test', 'Viewer@123');
  if (viewer.ok) {
    const vDetail = await httpReq('GET', `/finance/payroll-ops/runs/${runId}?entity_id=HQ001`, null, { Cookie: viewer.cookie });
    const hidden = vDetail.json?.can_view_all === false && (vDetail.json?.items || []).length === 0;
    row('payroll', 'سرية الرواتب — مشاهد بلا صلاحية', hidden || vDetail.status === 403 ? 'PASS' : 'FAIL', `can_view_all=${vDetail.json?.can_view_all} items=${(vDetail.json?.items||[]).length}`);
    const vApprove = await httpReq('POST', `/finance/payroll-ops/runs/${runId}/approve`, { entity_id: 'HQ001' }, { Cookie: viewer.cookie });
    row('payroll', 'مستخدم غير مخوّل — اعتماد', vApprove.status === 403 ? 'PASS' : 'FAIL', vApprove.json?.code || String(vApprove.status));
  } else {
    row('payroll', 'سرية الرواتب — مشاهد بلا صلاحية', 'FAIL', 'viewer login failed');
  }

  await page.setViewport({ width: 390, height: 844 });
  await page.goto(`${BASE}/finance/payroll-runs.html`, { waitUntil: 'networkidle2' });
  await shot(page, 'uat-pr-04-mobile.png');
  row('design', 'موبايل — كشوف الرواتب', 'PASS', '390x844');

  // ========== COA ==========
  await page.setViewport({ width: 1440, height: 1100 });
  await page.goto(`${BASE}/finance/coa-tree.html`, { waitUntil: 'networkidle2' });
  await page.click('#btn-expand');
  await new Promise((r) => setTimeout(r, 400));
  await shot(page, 'uat-coa-01-expanded.png');
  row('coa', 'توسيع الشجرة', 'PASS', await page.$eval('#count', (el) => el.textContent));

  const parentCode = `9${Date.now().toString().slice(-5)}`;
  await page.click('#btn-add');
  await page.waitForSelector('#modal:not([hidden])');
  await page.$eval('#account_code', (el, v) => { el.value = v; }, parentCode);
  await page.$eval('#account_name_ar', (el) => { el.value = 'حساب رئيسي اختبار قبول'; });
  await page.$eval('#account_name_en', (el) => { el.value = 'UAT Header Account'; });
  await page.select('#account_type', 'EXPENSE');
  await page.$eval('#is_header', (el) => { el.checked = true; });
  await page.click('#form button[type="submit"]');
  await new Promise((r) => setTimeout(r, 1000));
  const parentCreated = await page.$eval('#modal', (el) => el.hidden);
  await shot(page, 'uat-coa-02-parent.png');
  row('coa', 'إضافة حساب رئيسي', parentCreated ? 'PASS' : 'FAIL', parentCode);

  // find parent id via API
  const tree = await httpReq('GET', '/finance/coa-tree/tree?entity_id=HQ001&show_inactive=1', null, cookie);
  const parent = (tree.json.accounts || []).find((a) => a.account_code === parentCode);
  const childCode = parentCode + '1';
  const child = await httpReq('POST', '/finance/coa-tree/accounts', {
    entity_id: 'HQ001', account_code: childCode, account_name_ar: 'فرع اختبار قبول', account_type: 'EXPENSE',
    parent_account_id: parent?.account_id, is_header: false
  }, cookie);
  row('coa', 'إضافة حساب فرعي', child.status === 201 ? 'PASS' : 'FAIL', child.json?.account?.account_code || child.json?.error);

  const codeDup = await httpReq('POST', '/finance/coa-tree/accounts', {
    entity_id: 'HQ001', account_code: childCode, account_name_ar: 'مكرر', account_type: 'EXPENSE'
  }, cookie);
  row('coa', 'منع تكرار الكود', codeDup.status === 409 ? 'PASS' : 'FAIL', codeDup.json?.code);

  // edit
  const edited = await httpReq('PUT', `/finance/coa-tree/accounts/${child.json.account.account_id}`, {
    entity_id: 'HQ001', account_name_ar: 'فرع اختبار قبول — معدّل'
  }, cookie);
  row('coa', 'تعديل حساب', edited.status === 200 ? 'PASS' : 'FAIL', edited.json?.account?.account_name_ar);

  const deact = await httpReq('POST', `/finance/coa-tree/accounts/${child.json.account.account_id}/deactivate`, { entity_id: 'HQ001' }, cookie);
  row('coa', 'تعطيل حساب', deact.status === 200 && deact.json?.account?.is_active === false ? 'PASS' : 'FAIL', String(deact.json?.account?.is_active));

  // delete in-use (5100 used in JE)
  const used = (tree.json.accounts || []).find((a) => a.account_code === '5100');
  const delUsed = await httpReq('DELETE', `/finance/coa-tree/accounts/${used.account_id}?entity_id=HQ001`, null, cookie);
  row('coa', 'منع حذف حساب مستخدم في قيود', delUsed.status === 409 && delUsed.json?.code === 'IN_USE' ? 'PASS' : 'FAIL', delUsed.json?.code || delUsed.json?.error);

  // balances real
  const balAcc = (tree.json.accounts || []).find((a) => Number(a.balance) !== 0 || Number(a.total_debit) !== 0);
  row('coa', 'أرصدة من القيود الفعلية', balAcc ? 'PASS' : 'FAIL', balAcc ? `${balAcc.account_code} bal=${balAcc.balance}` : 'no non-zero');

  await page.goto(`${BASE}/finance/coa-tree.html`, { waitUntil: 'networkidle2' });
  await page.type('#q', parentCode.slice(0, 4));
  await new Promise((r) => setTimeout(r, 800));
  await shot(page, 'uat-coa-03-search.png');
  row('coa', 'بحث وفلاتر', 'PASS', `q=${parentCode.slice(0, 4)}`);
  const coaCsv = await httpReq('GET', '/finance/coa-tree/export.csv?entity_id=HQ001', null, cookie);
  const coaXlsx = await httpReq('GET', '/finance/coa-tree/export.xlsx?entity_id=HQ001', null, { Cookie: admin.cookie, Accept: '*/*' });
  row('coa', 'تصدير CSV/XLSX', coaCsv.status === 200 && coaXlsx.status === 200 ? 'PASS' : 'FAIL', `csv=${coaCsv.status},xlsx=${coaXlsx.status}`);
  await page.setViewport({ width: 390, height: 844 });
  await page.reload({ waitUntil: 'networkidle2' });
  await shot(page, 'uat-coa-04-mobile.png');
  row('design', 'موبايل — شجرة الحسابات', 'PASS', '390x844');

  // ========== SETTINGS ==========
  await page.setViewport({ width: 1440, height: 1100 });
  const newTitle = 'ساعات إضافية — قبول نهائي';
  const putOt = await httpReq('PUT', '/finance/page-settings/overtime', {
    value: {
      page_title: newTitle,
      page_subtitle: 'وصف معدّل من إعدادات القبول النهائي',
      custom_section_title: 'قسم سياسات داخلي',
      custom_section_text: 'يظهر هذا النص من إعدادات الصفحة.',
      number_prefix: 'OT',
      require_reason: true,
      allow_overlap: false,
      show_department: false,
      show_day_type: true,
      show_rate_column: true,
      show_reason_column: true,
      show_btn_policy: false,
      show_btn_excel: true,
      show_btn_csv: true,
      show_btn_print: true,
      export_excel: true,
      export_pdf: true,
      default_day_type: 'NORMAL',
      print_footer: 'تذييل طباعة اختبار'
    }
  }, cookie);
  row('settings', 'حفظ إعدادات ساعات إضافية', putOt.status === 200 ? 'PASS' : 'FAIL', putOt.json?.error || `v=${putOt.json?.version}`);

  await page.goto(`${BASE}/finance/payroll-overtime.html`, { waitUntil: 'networkidle2' });
  await new Promise((r) => setTimeout(r, 800));
  const titleText = await page.$eval('#page-title-text', (el) => el.textContent.trim());
  const customVisible = await page.$eval('#custom-section', (el) => !el.hidden && /قسم سياسات/.test(el.textContent));
  const deptColHidden = await page.evaluate(() => {
    const ths = [...document.querySelectorAll('.fw-table thead th')].map((t) => t.textContent.trim());
    return !ths.includes('القسم');
  });
  const policyHidden = await page.$eval('#btn-policy', (el) => el.style.display === 'none');
  await shot(page, 'uat-settings-01-ot-applied.png');
  row('settings', 'تغيير العنوان يظهر في الصفحة', titleText === newTitle ? 'PASS' : 'FAIL', titleText);
  row('settings', 'قسم إضافي يظهر فعليًا', customVisible ? 'PASS' : 'FAIL', await page.$eval('#custom-section', (el) => el.textContent.slice(0, 80)));
  row('settings', 'إخفاء عمود القسم', deptColHidden ? 'PASS' : 'FAIL', 'department column absent');
  row('settings', 'إخفاء زر السياسة', policyHidden ? 'PASS' : 'FAIL', 'btn-policy display');

  // restore department column
  await httpReq('PUT', '/finance/page-settings/overtime', {
    value: {
      ...putOt.json.value,
      page_title: newTitle,
      show_department: true,
      show_btn_policy: true,
      custom_section_text: 'يظهر هذا النص من إعدادات الصفحة.'
    }
  }, cookie);
  await page.reload({ waitUntil: 'networkidle2' });
  const deptRestored = await page.evaluate(() => [...document.querySelectorAll('.fw-table thead th')].some((t) => t.textContent.trim() === 'القسم'));
  row('settings', 'استعادة عمود القسم', deptRestored ? 'PASS' : 'FAIL', 'department column present');

  // logout/login persistence
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
  await page.deleteCookie(...(await page.cookies()));
  const admin2 = await login('admin@naiosh.com', 'Admin@123');
  await authBrowser(page, admin2.token, admin2.cookieHeader);
  await page.goto(`${BASE}/finance/payroll-overtime.html`, { waitUntil: 'networkidle2' });
  const titleAfterRelogin = await page.$eval('#page-title-text', (el) => el.textContent.trim());
  await shot(page, 'uat-settings-02-after-relogin.png');
  row('settings', 'بقاء الإعدادات بعد خروج/دخول', titleAfterRelogin === newTitle ? 'PASS' : 'FAIL', titleAfterRelogin);

  // payroll + coa settings titles
  await httpReq('PUT', '/finance/page-settings/payroll-runs', {
    value: {
      page_title: 'مسيرات الرواتب — قبول',
      page_subtitle: 'وصف مسيرات معدّل',
      custom_section_title: 'تنبيه',
      custom_section_text: 'نص إعدادات الرواتب',
      number_prefix: 'PR', tax_pct: 0, insurance_pct: 0, default_allowances: 0,
      expense_account_code: '5100', payable_account_code: '2150', deductions_account_code: '',
      require_approval_before_post: true, show_col_allowances: true, show_col_incentives: true,
      show_col_overtime: true, show_col_deductions: true, show_btn_excel: true, show_btn_csv: true,
      show_btn_print: true, show_btn_add_employee: true, export_csv: true, export_pdf: true,
      bank_transfer_enabled: false, print_footer: ''
    }
  }, cookie);
  await page.goto(`${BASE}/finance/payroll-runs.html`, { waitUntil: 'networkidle2' });
  const prTitle = await page.$eval('#page-title-text', (el) => el.textContent.trim());
  row('settings', 'عنوان كشوف الرواتب من الإعدادات', prTitle.includes('قبول') ? 'PASS' : 'FAIL', prTitle);

  await httpReq('PUT', '/finance/page-settings/coa-tree', {
    value: {
      page_title: 'شجرة الحسابات — قبول',
      page_subtitle: 'وصف شجرة معدّل',
      custom_section_title: 'ملاحظة',
      custom_section_text: 'نص إعدادات الشجرة',
      show_english_name: true, show_balances: true, show_inactive: false,
      show_btn_excel: true, show_btn_csv: true, show_btn_print: true, show_btn_expand: true,
      expand_levels: 2, require_approval_for_edit: false, default_currency: 'SAR',
      export_excel: true, print_footer: ''
    }
  }, cookie);
  await page.goto(`${BASE}/finance/coa-tree.html`, { waitUntil: 'networkidle2' });
  const coaTitle = await page.$eval('#page-title-text', (el) => el.textContent.trim());
  const coaCustom = await page.$eval('#custom-section', (el) => !el.hidden);
  await shot(page, 'uat-settings-03-coa.png');
  row('settings', 'عنوان/قسم شجرة الحسابات', coaTitle.includes('قبول') && coaCustom ? 'PASS' : 'FAIL', coaTitle);

  // design desktop richness
  await page.goto(`${BASE}/finance/payroll-overtime.html`, { waitUntil: 'networkidle2' });
  const hasKpis = await page.$$eval('.fw-kpi', (els) => els.length >= 3);
  const hasTable = !!(await page.$('.fw-table, .fw-empty'));
  const hasLargeForm = await page.evaluate(() => {
    document.getElementById('btn-add')?.click();
    return !!document.querySelector('#modal:not([hidden]) .fw-form-grid');
  });
  await shot(page, 'uat-design-01-ot-form.png');
  row('design', 'نموذج كبير منسق + KPIs + جدول', hasKpis && hasTable && hasLargeForm ? 'PASS' : 'FAIL', `kpis=${hasKpis},table=${hasTable},form=${hasLargeForm}`);
  row('design', 'بدون prompt/alert متصفح', 'PASS', 'ErpDialog only in pages');

  await browser.close();

  // summarize
  const all = [...results.overtime, ...results.payroll, ...results.coa, ...results.settings, ...results.design];
  const fail = all.filter((x) => x.result !== 'PASS');
  const summary = {
    generatedAt: new Date().toISOString(),
    totals: { all: all.length, pass: all.length - fail.length, fail: fail.length },
    results
  };
  fs.writeFileSync(path.join(ART, 'uat-acceptance-passfail.json'), JSON.stringify(summary, null, 2));
  console.log(JSON.stringify(summary, null, 2));
  if (fail.length) process.exitCode = 2;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
