/**
 * Payroll workflow UX UAT — isolated :3083 only.
 * Journey: hub → add employee → set salary → wizard create run → edit allowance →
 * reopen → approve → export → post-gl once. No bank payout. No production DB.
 */
const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');

const BASE = process.env.APP_BASE_URL || 'http://127.0.0.1:3083';
const OUT = process.env.UAT_OUT || '/opt/cursor/artifacts';
const ENTITY = 'HQ001';
const stamp = Date.now().toString(36).toUpperCase();

function httpReq(method, urlPath, body, headers = {}) {
  const u = new URL(urlPath.startsWith('http') ? urlPath : BASE + urlPath);
  const lib = u.protocol === 'https:' ? https : http;
  const payload = body == null ? null : Buffer.from(JSON.stringify(body));
  return new Promise((resolve, reject) => {
    const req = lib.request(
      {
        hostname: u.hostname,
        port: u.port,
        path: u.pathname + u.search,
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(payload ? { 'Content-Length': payload.length } : {}),
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

async function shot(page, name) {
  const file = path.join(OUT, name);
  await page.screenshot({ path: file, fullPage: true });
  return file;
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const report = { ok: true, steps: [], warnings: [], artifacts: [] };

  const login = await httpReq('POST', '/api/auth/login', { email: 'admin@naiosh.com', password: 'Admin@123' });
  const token = login.json?.data?.session?.token;
  if (!token) throw new Error('login failed');
  const H = { Authorization: `Bearer ${token}`, Cookie: `authToken=${token}` };
  report.steps.push({ step: 'login', ok: true });

  // 1) Add employee + salary to PG
  const empCode = `UX-${stamp}`;
  const empCreate = await httpReq('POST', '/finance/payroll-ops/employees', {
    entity_id: ENTITY,
    employee_code: empCode,
    full_name_ar: `موظف تجربة الواجهة ${stamp}`,
    department: 'مالية',
    nationality: 'سعودي',
    base_salary: 8000,
    housing_allowance: 2000,
    nature_allowance: 500,
    transport_allowance: 600,
    other_allowances: 100,
    insurance_amount: -400,
    advance_deduction: 0,
    other_deductions: 0
  }, H);
  if (!empCreate.ok) throw new Error('employee create failed: ' + (empCreate.json?.error || empCreate.status));
  const employeeId = empCreate.json.employee.employee_id;
  report.steps.push({ step: 'add_employee_pg', ok: true, employee_id: employeeId, employee_code: empCode });

  const empGet = await httpReq('GET', `/finance/payroll-ops/employees/${employeeId}?entity_id=${ENTITY}`, null, H);
  if (!empGet.ok || Number(empGet.json.employee.base_salary) !== 8000) {
    throw new Error('employee not persisted in PostgreSQL');
  }
  report.steps.push({ step: 'verify_employee_pg', ok: true, base_salary: empGet.json.employee.base_salary });

  // 2) Create run for unique future period via wizard payload
  const year = 2098;
  const month = ((Date.now() % 11) + 1);
  const gen = await httpReq('POST', '/finance/payroll-ops/runs/generate', {
    entity_id: ENTITY,
    period_year: year,
    period_month: month,
    payroll_country: 'SA',
    currency: 'SAR',
    run_type_label: 'مسير تجربة الواجهة',
    seed_empty: false,
    employee_ids: [employeeId]
  }, H);
  if (!gen.ok) throw new Error('generate failed: ' + (gen.json?.error || gen.status));
  const runId = gen.json.run.run_id;
  const runNumber = gen.json.run.run_number;
  report.steps.push({ step: 'create_run_draft', ok: true, run_id: runId, run_number: runNumber, status: gen.json.run.status });

  // 3) Edit allowance on line
  const detail0 = await httpReq('GET', `/finance/payroll-ops/runs/${runId}?entity_id=${ENTITY}`, null, H);
  const item = detail0.json.items?.[0];
  if (!item) throw new Error('no payroll item after generate');
  const edit = await httpReq('PUT', `/finance/payroll-ops/runs/${runId}/items/${item.item_id}`, {
    entity_id: ENTITY,
    housing_allowance: 2500,
    sync_employee: true
  }, H);
  if (!edit.ok) throw new Error('edit allowance failed: ' + (edit.json?.error || edit.status));
  report.steps.push({ step: 'edit_housing_allowance', ok: true, housing: 2500 });

  // 4) Re-open
  const detail1 = await httpReq('GET', `/finance/payroll-ops/runs/${runId}?entity_id=${ENTITY}`, null, H);
  const housing = Number(detail1.json.items[0].housing_allowance);
  if (housing !== 2500) throw new Error('reopen did not keep housing edit');
  report.steps.push({ step: 'reopen_verify', ok: true, housing });

  // 5) Approve
  const appr = await httpReq('POST', `/finance/payroll-ops/runs/${runId}/approve`, { entity_id: ENTITY }, H);
  if (!appr.ok) throw new Error('approve failed: ' + (appr.json?.error || appr.status));
  report.steps.push({ step: 'approve', ok: true, status: appr.json.run?.status || 'APPROVED' });

  // 6) Export
  const xlsx = await httpReq('GET', `/finance/payroll-ops/runs/${runId}/export.xlsx?entity_id=${ENTITY}`, null, H);
  const pdf = await httpReq('GET', `/finance/payroll-ops/runs/${runId}/export.pdf?entity_id=${ENTITY}`, null, H);
  const xlsxPath = path.join(OUT, `ux-payroll-${runId}.xlsx`);
  const pdfPath = path.join(OUT, `ux-payroll-${runId}.pdf`);
  fs.writeFileSync(xlsxPath, xlsx.buf);
  fs.writeFileSync(pdfPath, pdf.buf);
  report.steps.push({
    step: 'export',
    ok: xlsx.ok && pdf.ok && xlsx.buf.length > 1000 && pdf.buf.length > 500,
    xlsx_bytes: xlsx.buf.length,
    pdf_bytes: pdf.buf.length
  });
  report.artifacts.push(xlsxPath, pdfPath);

  // 7) Post-GL once (test) — no bank
  const post = await httpReq('POST', `/finance/payroll-ops/runs/${runId}/post-gl`, { entity_id: ENTITY }, H);
  report.steps.push({
    step: 'post_gl_once',
    ok: post.ok,
    status: post.status,
    message: post.json?.message || post.json?.error,
    journal_entry_id: post.json?.journal_entry_id || post.json?.run?.journal_entry_id || null
  });
  if (!post.ok) report.ok = false;

  // Guard: second post should fail or be idempotent without bank
  const post2 = await httpReq('POST', `/finance/payroll-ops/runs/${runId}/post-gl`, { entity_id: ENTITY }, H);
  report.steps.push({
    step: 'post_gl_second_guard',
    ok: !post2.ok || /مرة|سبق|موجود|مرحل/i.test(String(post2.json?.error || post2.json?.message || '')),
    status: post2.status,
    message: post2.json?.error || post2.json?.message
  });

  // Confirm employee still in PG after journey
  const empFinal = await httpReq('GET', `/finance/payroll-ops/employees/${employeeId}?entity_id=${ENTITY}`, null, H);
  report.steps.push({
    step: 'employee_still_in_pg',
    ok: empFinal.ok && empFinal.json.employee?.employee_code === empCode,
    housing_on_card: empFinal.json.employee?.housing_allowance
  });

  // Browser screenshots of new UX
  let puppeteer;
  try {
    puppeteer = require('puppeteer-core');
  } catch {
    try { puppeteer = require('puppeteer'); } catch { puppeteer = null; }
  }
  if (puppeteer) {
    const browser = await puppeteer.launch({
      executablePath: process.env.CHROME_PATH || '/usr/bin/chromium-browser',
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1440,900']
    });
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });
    await page.goto(`${BASE}/login-page.html`, { waitUntil: 'domcontentloaded' }).catch(() => {});
    await page.evaluate((t) => {
      localStorage.setItem('authToken', t);
      localStorage.setItem('token', t);
    }, token);
    await page.setCookie({ name: 'authToken', value: token, domain: '127.0.0.1', path: '/' });

    await page.goto(`${BASE}/finance/payroll-hub.html`, { waitUntil: 'networkidle2', timeout: 60000 });
    report.artifacts.push(await shot(page, 'ux-01-hub-four-cards.png'));

    await page.goto(`${BASE}/finance/payroll-employees.html`, { waitUntil: 'networkidle2', timeout: 60000 });
    await page.waitForSelector('#table-host', { timeout: 20000 }).catch(() => {});
    report.artifacts.push(await shot(page, 'ux-02-employees-master.png'));

    await page.goto(`${BASE}/finance/payroll-runs.html?wizard=1`, { waitUntil: 'networkidle2', timeout: 60000 });
    await page.waitForSelector('#wizard-panel.active', { timeout: 15000 }).catch(() => {});
    report.artifacts.push(await shot(page, 'ux-03-wizard-step1.png'));
    await page.click('#wiz-next-1').catch(() => {});
    await page.waitForTimeout?.(800);
    await new Promise((r) => setTimeout(r, 800));
    report.artifacts.push(await shot(page, 'ux-04-wizard-step2-employees.png'));

    await page.goto(`${BASE}/finance/payroll-runs.html`, { waitUntil: 'networkidle2', timeout: 60000 });
    await page.waitForSelector('#table-host', { timeout: 20000 }).catch(() => {});
    // Ensure drawer empty / no auto open — check empty state text
    const drawerText = await page.$eval('#drawer', (el) => el.innerText).catch(() => '');
    report.steps.push({
      step: 'no_auto_open',
      ok: /لم يُفتح|اختر مسير|افتح|يدوي/i.test(drawerText) || !/مسير الرواتب لـ/.test(drawerText),
      drawer_preview: drawerText.slice(0, 120)
    });
    report.artifacts.push(await shot(page, 'ux-05-runs-list-no-auto.png'));

    await page.goto(`${BASE}/finance/payroll-runs.html?opened=${runId}`, { waitUntil: 'networkidle2', timeout: 60000 });
    await page.waitForSelector('.pay-table', { timeout: 25000 }).catch(() => {});
    report.artifacts.push(await shot(page, 'ux-06-run-detail-13cols.png'));

    await page.goto(`${BASE}/finance/payroll-runs.html?view=exports`, { waitUntil: 'networkidle2', timeout: 60000 });
    report.artifacts.push(await shot(page, 'ux-07-exports-mode.png'));

    await browser.close();
    report.steps.push({ step: 'ui_screenshots', ok: true, count: report.artifacts.filter((a) => String(a).endsWith('.png')).length });
  } else {
    report.warnings.push('puppeteer unavailable — API journey verified without UI shots');
  }

  report.ok = report.ok && report.steps.every((s) => s.ok !== false);
  report.isolation = {
    base: BASE,
    note: 'Isolated finance_pages_isolated :3083 — no production write, no bank payout API called'
  };
  const reportPath = path.join(OUT, 'ux-payroll-workflow-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  if (!report.ok) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
