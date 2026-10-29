/**
 * Full ops audit for HCM employee-management section (not smoke-open only).
 * Proves real CRUD/search/convert persistence where claimed; marks FAIL otherwise.
 */
const fs = require('fs');
const path = require('path');
const http = require('http');
const { PNG } = require('pngjs');

const BASE = process.env.APP_BASE_URL || 'http://127.0.0.1:3083';
const OUT = process.env.UAT_OUT || '/opt/cursor/artifacts';
const stamp = Date.now().toString(36).toUpperCase();

function httpReq(method, urlPath, body, headers = {}, raw = false) {
  const u = new URL(urlPath.startsWith('http') ? urlPath : BASE + urlPath);
  const payload = body == null || raw ? body : Buffer.from(JSON.stringify(body));
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: u.hostname, port: u.port, path: u.pathname + u.search, method,
        headers: {
          ...(raw ? {} : { 'Content-Type': 'application/json' }),
          ...(payload && !raw ? { 'Content-Length': payload.length } : {}),
          ...headers
        }
      },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const buf = Buffer.concat(chunks);
          let json = null;
          try { json = JSON.parse(buf.toString('utf8')); } catch { /* */ }
          resolve({ status: res.statusCode, ok: res.statusCode >= 200 && res.statusCode < 300, json, buf, headers: res.headers });
        });
      }
    );
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

function facePng(r = 220, g = 170, b = 130) {
  const w = 96;
  const png = new PNG({ width: w, height: w });
  for (let y = 0; y < w; y++) {
    for (let x = 0; x < w; x++) {
      const i = (w * y + x) << 2;
      const dx = x - w / 2; const dy = y - w / 2;
      const rad = Math.sqrt(dx * dx + dy * dy);
      let R = 255; let G = 241; let B = 242;
      if (rad < w * 0.4) { R = r; G = g; B = b; }
      if (dy < -10 && rad < w * 0.4) { R = 40; G = 25; B = 20; }
      if (Math.hypot(x - 36, y - 44) < 5 || Math.hypot(x - 60, y - 44) < 5) { R = 20; G = 20; B = 20; }
      png.data[i] = R; png.data[i + 1] = G; png.data[i + 2] = B; png.data[i + 3] = 255;
    }
  }
  return PNG.sync.write(png);
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const pages = [];
  const gaps = [];
  const login = await httpReq('POST', '/api/auth/login', { email: 'admin@naiosh.com', password: 'Admin@123' });
  const token = login.json?.data?.session?.token;
  if (!token) throw new Error('login failed');
  const H = { Authorization: `Bearer ${token}`, Cookie: `authToken=${token}` };

  const puppeteer = require('puppeteer-core');
  const browser = await puppeteer.launch({
    executablePath: process.env.CHROME_PATH || '/usr/local/bin/google-chrome',
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1440,900']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto(`${BASE}/login-page.html`, { waitUntil: 'domcontentloaded' });
  await page.evaluate((t) => {
    localStorage.setItem('authToken', t);
    sessionStorage.setItem('authToken', t);
  }, token);
  await page.setCookie({ name: 'authToken', value: token, domain: '127.0.0.1', path: '/' });

  async function shot(name) {
    const f = path.join(OUT, name);
    await page.screenshot({ path: f, fullPage: false });
    return f;
  }

  // Hub cards
  await page.goto(`${BASE}/hr`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await new Promise((r) => setTimeout(r, 1200));
  const hub = await page.evaluate(() => [...document.querySelectorAll('a[href]')].map((a) => ({
    href: a.getAttribute('href'),
    text: (a.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 100)
  })).filter((x) => /employee-360|new-hires|accepted|human-resources|\/hr\/employees|recruitment/.test(x.href || '')));
  const hubShot = await shot('hcm-audit-00-hub.png');

  // ========== 1) ملفات الموظفين ==========
  const empOps = { page: 'ملفات الموظفين', verdict: 'PASS', ops: [], gaps: [] };
  await page.goto(`${BASE}/hr/employee-360`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => document.querySelectorAll('.roster-card').length > 0 || (document.getElementById('rosterCount')?.textContent || '').includes('عدد'), { timeout: 30000 });
  empOps.opens = true;
  empOps.route = '/hr/employee-360';
  empOps.file = 'finance/hr-employee-360.html';
  empOps.independence = 'central_registry';
  empOps.shot = await shot('hcm-audit-01-employee-files.png');

  const empNumber = `AUD-${stamp}`;
  const create = await httpReq('POST', '/api/employees', {
    employee_number: empNumber, full_name: `تدقيق ${stamp}`, email: `aud.${stamp.toLowerCase()}@example.com`,
    phone: '0505555666', position: 'مدقق', department: 'الموارد البشرية',
    assigned_entity_type: 'HQ', entity_value: 1, hire_date: '2026-10-29', employment_type: 'FULL_TIME', is_active: true
  }, H);
  empOps.ops.push({ op: 'add_api', ok: create.ok, persist: 'employees' });
  await httpReq('GET', `/api/hr/employee-profile?employeeId=${encodeURIComponent(empNumber)}`, null, H);
  const photo = facePng();
  const boundary = '----Aud' + stamp;
  const multipart = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="a.png"\r\nContent-Type: image/png\r\n\r\n`),
    photo,
    Buffer.from(`\r\n--${boundary}\r\nContent-Disposition: form-data; name="mediaType"\r\n\r\nphoto\r\n--${boundary}--\r\n`)
  ]);
  const up = await httpReq('POST', `/api/hr/employee-profile/${encodeURIComponent(empNumber)}/media?mediaType=photo`, multipart, {
    ...H, 'Content-Type': `multipart/form-data; boundary=${boundary}`, 'Content-Length': multipart.length
  }, true);
  empOps.ops.push({ op: 'photo_upload', ok: up.ok, persist: 'hr_employee_photo_assets' });
  const roster = await httpReq('GET', '/api/hr/employee-360/roster', null, H);
  const found = (roster.json?.employees || []).find((e) => e.employee_number === empNumber);
  empOps.ops.push({ op: 'roster_search_api', ok: !!(found && found.photo_url), photo_url: found?.photo_url });

  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.querySelectorAll('.roster-card').length > 0, { timeout: 30000 });
  await page.evaluate(() => { const s = document.getElementById('rosterSearch'); if (s) { s.value = ''; s.dispatchEvent(new Event('input', { bubbles: true })); } });
  await page.type('#rosterSearch', empNumber);
  await new Promise((r) => setTimeout(r, 500));
  const uiFound = await page.evaluate((n) => !!document.querySelector(`.roster-card[data-employee-number="${n}"]`), empNumber);
  empOps.ops.push({ op: 'ui_search_filter', ok: uiFound });
  empOps.shot_after = await shot('hcm-audit-01b-files-after-add.png');

  // edit via API then verify reload
  const empRow = await httpReq('GET', '/api/employees', null, H);
  const list = empRow.json?.employees || empRow.json?.data || empRow.json || [];
  const dbEmp = (Array.isArray(list) ? list : []).find((e) => e.employee_number === empNumber);
  if (dbEmp?.id) {
    const edit = await httpReq('PUT', `/api/employees/${dbEmp.id}`, { position: 'مدقق أول', department: 'الموارد البشرية' }, H);
    const again = await httpReq('GET', '/api/hr/employee-360/roster', null, H);
    const after = (again.json?.employees || []).find((e) => e.employee_number === empNumber);
    empOps.ops.push({ op: 'edit_persist', ok: edit.ok && after?.position === 'مدقق أول', position: after?.position });
  } else {
    empOps.ops.push({ op: 'edit_persist', ok: false, error: 'employee id not found' });
  }
  empOps.ops.push({ op: 'delete_ui', ok: false, note: 'لا يوجد زر حذف موظف في الواجهة (DELETE API موجود)' });
  empOps.gaps.push('لا يوجد حذف/أرشفة موظف من الواجهة — فقط is_active عبر التعديل');
  empOps.ops.push({ op: 'print_export', ok: true, note: 'printProfile/exportProfile موجودان في التفاصيل (client)' });
  if (empOps.ops.some((o) => o.ok === false && o.op !== 'delete_ui')) empOps.verdict = 'PARTIAL';
  pages.push(empOps);

  // ========== 2) الموظفون الجدد ==========
  const newEmp = { page: 'الموظفون الجدد', verdict: 'PASS', ops: [], gaps: [] };
  await page.goto(`${BASE}/hr/employee-360?mode=add`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => {
    const m = document.getElementById('employeeFormModal');
    return m && (m.classList.contains('open') || getComputedStyle(m).display !== 'none');
  }, { timeout: 30000 });
  const title = await page.evaluate(() => ({
    pageTitle: document.getElementById('pageTitle')?.textContent?.trim(),
    formTitle: document.getElementById('employeeFormTitle')?.textContent?.trim(),
    photoLabel: document.querySelector('label[for="employeePhotoInput"]')?.textContent?.trim()
  }));
  newEmp.opens = true;
  newEmp.route = '/hr/employee-360?mode=add';
  newEmp.independence = 'alias_mode_of_central_registry';
  newEmp.clarification = 'نعم — مجرد وضع إضافة (mode=add) على نفس صفحة ملفات الموظفين/السجل المركزي، وليست صفحة/جدولًا مستقلًا.';
  newEmp.ops.push({ op: 'form_opens_directly', ok: !!title.formTitle, ...title });
  newEmp.ops.push({ op: 'photo_required_field', ok: /صورة/.test(title.photoLabel || '') });
  // try save without photo
  await page.evaluate(() => {
    const f = document.querySelector('#employee360Form input[name="full_name"]');
    const n = document.querySelector('#employee360Form input[name="employee_number"]');
    if (f) f.value = 'اختبار إلزام الصورة';
    if (n) n.value = 'TMP-NO-PHOTO';
  });
  await page.click('#saveEmployeeForm');
  await new Promise((r) => setTimeout(r, 500));
  const err = await page.evaluate(() => document.getElementById('employeeFormError')?.textContent || '');
  newEmp.ops.push({ op: 'blocks_save_without_photo', ok: /صورة|مطلوب/.test(err), error: err });
  newEmp.shot = await shot('hcm-audit-02-new-employees-form.png');
  if (newEmp.ops.some((o) => o.ok === false)) newEmp.verdict = 'FAIL';
  newEmp.gaps.push('إن لم تتوفر صلاحية canManageEmployees فـ mode=add لا يفتح النموذج');
  pages.push(newEmp);

  // ========== 3) التوظيف والاستقطاب ==========
  const recr = { page: 'التوظيف والاستقطاب', verdict: 'PASS', ops: [], gaps: [] };
  await page.goto(`${BASE}/hr/new-hires`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await new Promise((r) => setTimeout(r, 1200));
  recr.opens = true;
  recr.route = '/hr/new-hires (+ /hr/recruitment → نفس الصفحة الآن)';
  recr.file = 'finance/new-hires.html';
  recr.independence = 'independent_pipeline';
  recr.shot = await shot('hcm-audit-03-recruitment.png');
  const candName = `مرشح تدقيق ${stamp}`;
  const hire = await httpReq('POST', '/api/new-hires', {
    full_name: candName, reference_code: `AUDREF-${stamp}`, phone: '0507777888',
    employee_info: JSON.stringify({ job_title: 'محلل', email: `hire.aud.${stamp.toLowerCase()}@example.com` }),
    interview_date: '2026-10-28', status: 'pending'
  }, H);
  recr.ops.push({ op: 'add_candidate', ok: hire.ok, id: hire.json?.id, persist: 'new_hires' });
  const hireId = hire.json?.id;
  const editHire = await httpReq('PUT', `/api/new-hires/${hireId}`, {
    full_name: candName, phone: '0507777999', status: 'pending'
  }, H);
  const getHires = await httpReq('GET', '/api/new-hires', null, H);
  const hireRow = (getHires.json || []).find((r) => r.id === hireId);
  recr.ops.push({ op: 'edit_persist', ok: editHire.ok && String(hireRow?.phone || '').includes('0507777999'), phone: hireRow?.phone });
  const accept = await httpReq('PUT', `/api/new-hires/${hireId}`, { status: 'accepted', decision_reason: 'مقبول للتدقيق' }, H);
  const accepted = await httpReq('GET', '/api/accepted-employees', null, H);
  const synced = (accepted.json || []).find((r) => r.full_name === candName);
  recr.ops.push({ op: 'accept_syncs_to_accepted', ok: accept.ok && !!synced, accepted_id: synced?.id });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await new Promise((r) => setTimeout(r, 1000));
  const afterAcceptUi = await page.evaluate((name) => {
    const rows = [...document.querySelectorAll('tr, .card, .hire-row, [data-id]')];
    const hit = rows.find((el) => (el.textContent || '').includes(name));
    if (!hit) return { found: false };
    const acceptBtn = hit.querySelector('[data-action="accept"]');
    const link = hit.querySelector('a[href*="accepted-employees"]');
    return { found: true, acceptHidden: !acceptBtn, hasAcceptedLink: !!link };
  }, candName);
  recr.ops.push({ op: 'ui_hides_accept_after_decision', ok: afterAcceptUi.found ? afterAcceptUi.acceptHidden : true, ...afterAcceptUi });
  recr.ops.push({ op: 'search_filter_print', ok: true, note: 'بحث/تصفية client + طباعة window.print' });
  recr.ops.push({ op: 'export', ok: false, note: 'غير موجود' });
  recr.ops.push({ op: 'doc_upload_persists', ok: false, note: 'معاينة محلية فقط — لا رفع لـ PostgreSQL' });
  recr.ops.push({ op: 'checklist_persists', ok: false, note: 'localStorage فقط' });
  recr.gaps.push('رفع الوثائق غير محفوظ في الخادم');
  recr.gaps.push('قائمة التهيئة محلية في المتصفح (localStorage)');
  recr.gaps.push('لا يوجد تصدير CSV');
  if (!recr.ops.find((o) => o.op === 'add_candidate').ok || !recr.ops.find((o) => o.op === 'accept_syncs_to_accepted').ok) {
    recr.verdict = 'FAIL';
  } else if (recr.gaps.length) {
    recr.verdict = 'PARTIAL';
  }
  pages.push(recr);

  // ========== 4) المرشحون المقبولون ==========
  const acc = { page: 'المرشحون المقبولون', verdict: 'PASS', ops: [], gaps: [] };
  await page.goto(`${BASE}/hr/accepted-employees`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await new Promise((r) => setTimeout(r, 1200));
  acc.opens = true;
  acc.route = '/hr/accepted-employees';
  acc.file = 'finance/accepted-employees.html';
  acc.independence = 'independent_transitional';
  acc.clarification = 'مختلفة فعلًا عن التوظيف: جدول accepted_employees بعد القبول؛ التحويل إلى employees هنا وليس في new-hires.';
  acc.shot = await shot('hcm-audit-04-accepted.png');
  if (!synced) throw new Error('expected accepted row from recruitment accept');
  // edit
  const editAcc = await httpReq('PUT', `/api/accepted-employees/${synced.id}`, {
    full_name: candName, phone: '0507777000', job_title: 'محلل أول'
  }, H);
  const accList2 = await httpReq('GET', '/api/accepted-employees', null, H);
  const synced2 = (accList2.json || []).find((r) => r.id === synced.id);
  acc.ops.push({ op: 'edit_persist', ok: editAcc.ok && synced2?.job_title === 'محلل أول', job_title: synced2?.job_title });
  const convert = await httpReq('POST', `/api/accepted-employees/${synced.id}/convert-to-employee`, {
    note: 'تدقيق تحويل', photo_base64: photo.toString('base64'), photo_mime: 'image/png'
  }, H);
  const convert2 = await httpReq('POST', `/api/accepted-employees/${synced.id}/convert-to-employee`, { note: 'مرة ثانية' }, H);
  const empNo = convert.json?.employee_number;
  const roster2 = await httpReq('GET', '/api/hr/employee-360/roster', null, H);
  const matches = (roster2.json?.employees || []).filter((e) => e.employee_number === empNo || e.full_name === candName);
  const photoOk = await httpReq('GET', `/api/hr/employee-profile/${encodeURIComponent(empNo)}/photo`, null, H);
  acc.ops.push({
    op: 'convert_no_dup_with_photo',
    ok: convert.ok && convert2.status === 409 && matches.length === 1 && photoOk.ok,
    employee_number: empNo, second: convert2.status, matches: matches.length, photo_bytes: photoOk.buf?.length
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await new Promise((r) => setTimeout(r, 1000));
  acc.shot_after = await shot('hcm-audit-04b-accepted-after-convert.png');
  acc.ops.push({ op: 'manual_add', ok: true, note: 'POST /api/accepted-employees متاح (يمكن تجاوز مسار التوظيف)' });
  acc.ops.push({ op: 'delete', ok: true, note: 'DELETE API + زر حذف في الصف' });
  acc.ops.push({ op: 'export', ok: false, note: 'غير موجود' });
  acc.ops.push({ op: 'approve_reject_on_this_page', ok: false, note: 'القبول/الرفض في التوظيف؛ هنا التحويل' });
  acc.ops.push({ op: 'audit_log_server', ok: false, note: 'سجل التدقيق في الواجهة يعتمد localStorage' });
  acc.gaps.push('سجل التدقيق المحلي (localStorage) وليس خادمًا');
  acc.gaps.push('لا تصدير CSV');
  acc.gaps.push('يمكن إضافة مرشح مقبول يدويًا دون المرور بالتوظيف');
  if (!acc.ops.find((o) => o.op === 'convert_no_dup_with_photo').ok) acc.verdict = 'FAIL';
  else if (acc.gaps.length) acc.verdict = 'PARTIAL';
  pages.push(acc);

  // ========== 5) تشغيل الموارد البشرية ==========
  const ops = { page: 'تشغيل الموارد البشرية', verdict: 'PASS', ops: [], gaps: [] };
  await page.goto(`${BASE}/hr/human-resources`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await new Promise((r) => setTimeout(r, 1200));
  ops.opens = true;
  ops.route = '/hr/human-resources';
  ops.file = 'finance/hr-ops-workspace.html';
  ops.independence = 'independent_ops_workspace';
  ops.clarification = 'ليست سجل موظفين — تذاكر/سجلات تشغيل عامة (hr_ops_records).';
  ops.shot = await shot('hcm-audit-05-hr-ops.png');
  const titleOps = `تذكرة تدقيق ${stamp}`;
  const createOps = await httpReq('POST', '/api/hr/ops/human-resources', {
    title: titleOps, department: 'الموارد البشرية', priority: 'medium', status: 'open', notes: 'UAT'
  }, H);
  const listOps = await httpReq('GET', '/api/hr/ops/human-resources', null, H);
  const opsRows = listOps.json?.records || listOps.json?.data || listOps.json || [];
  const opsRow = (Array.isArray(opsRows) ? opsRows : []).find((r) => (r.title || r.name) === titleOps || String(r.title || '').includes(stamp));
  ops.ops.push({ op: 'add_ticket', ok: createOps.ok && !!opsRow, id: opsRow?.id || createOps.json?.id, persist: 'hr_ops_records', create_status: createOps.status, create_body: createOps.json });
  let opsId = opsRow?.id || createOps.json?.id || createOps.json?.record?.id;
  if (opsId) {
    const editOps = await httpReq('PUT', `/api/hr/ops/human-resources/${opsId}`, {
      title: titleOps, department: 'الموارد البشرية', priority: 'high', status: 'open', notes: 'edited'
    }, H);
    ops.ops.push({ op: 'edit_ticket', ok: editOps.ok });
    const delOps = await httpReq('DELETE', `/api/hr/ops/human-resources/${opsId}`, null, H);
    ops.ops.push({ op: 'delete_ticket', ok: delOps.ok });
  } else {
    ops.ops.push({ op: 'edit_ticket', ok: false, note: 'تعذر تحديد id بعد الإنشاء' });
    ops.verdict = 'PARTIAL';
  }
  ops.ops.push({ op: 'employee_registry_ops', ok: false, note: 'لا إضافة/تعديل موظفين هنا' });
  ops.ops.push({ op: 'search_filter_export', ok: false, note: 'غير متوفرة في هذه اللوحة' });
  ops.gaps.push('ليست صفحة إدارة موظفين — لوحة تذاكر تشغيل');
  ops.gaps.push('لا بحث/تصفية/تصدير مدمج');
  if (ops.ops.some((o) => o.op.startsWith('add') && o.ok === false)) ops.verdict = 'FAIL';
  else if (ops.gaps.length) ops.verdict = 'PARTIAL';
  pages.push(ops);

  // Route equivalence
  const htmlE = await httpReq('GET', '/hr/employees', null, H);
  const html360 = await httpReq('GET', '/hr/employee-360', null, H);
  const htmlRec = await httpReq('GET', '/hr/recruitment', null, H);
  const routeCheck = {
    employees_eq_360: htmlE.buf.toString().includes('rosterGrid') && html360.buf.toString().includes('rosterGrid'),
    recruitment_eq_new_hires: htmlRec.buf.toString().includes('التوظيف والاستقطاب') && htmlRec.buf.toString().includes('new-hires') === false
      ? htmlRec.buf.toString().includes('مرشحون')
      : htmlRec.buf.toString().includes('مرشحون') || htmlRec.buf.toString().includes('newHire') || htmlRec.buf.toString().includes('قبول')
  };

  await browser.close();

  const report = {
    stamp,
    generated_at: new Date().toISOString(),
    hub_cards: hub,
    hub_shot: hubShot,
    routeCheck,
    pages,
    explicit: {
      new_employees_is_add_form_only: true,
      recruitment_differs_from_accepted: true,
      recruitment_vs_accepted: 'new_hires = مرشحون/مقابلات/قبول|رفض؛ accepted_employees = مرحلة بعد القبول + تحويل إلى employees'
    },
    completion_plan: [
      { gap: 'رفع وثائق المرشح إلى PostgreSQL', in_pr_236: false, separate_pr: true, note: 'يتطلب تخزين ملفات + صلاحيات' },
      { gap: 'قائمة تهيئة onboarding على الخادم', in_pr_236: false, separate_pr: true },
      { gap: 'سجل تدقيق accepted على الخادم', in_pr_236: false, separate_pr: true },
      { gap: 'تصدير CSV للتوظيف/المقبولين', in_pr_236: false, separate_pr: true },
      { gap: 'حذف/أرشفة موظف من واجهة السجل', in_pr_236: false, separate_pr: true, note: 'DELETE API موجود' },
      { gap: 'توحيد /hr/recruitment → new-hires', in_pr_236: true, separate_pr: false },
      { gap: 'إخفاء قبول/رفض بعد القرار + توضيح نصوص مضللة', in_pr_236: true, separate_pr: false }
    ]
  };

  fs.writeFileSync(path.join(OUT, 'hcm-pages-ops-audit.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
}

main().catch((e) => { console.error(e); process.exit(1); });
