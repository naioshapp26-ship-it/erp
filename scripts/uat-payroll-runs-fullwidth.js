/**
 * Full-width payroll runs list + detail navigation UAT on isolated :3083.
 * Opens 6 different runs and asserts correct run_number / no data mix-up.
 */
const fs = require('fs');
const path = require('path');
const http = require('http');

const BASE = process.env.APP_BASE_URL || 'http://127.0.0.1:3083';
const OUT = process.env.UAT_OUT || '/opt/cursor/artifacts';
const ENTITY = 'HQ001';

function httpReq(method, urlPath, body, headers = {}) {
  const u = new URL(urlPath.startsWith('http') ? urlPath : BASE + urlPath);
  const payload = body == null ? null : Buffer.from(JSON.stringify(body));
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: u.hostname, port: u.port, path: u.pathname + u.search, method,
        headers: { 'Content-Type': 'application/json', ...(payload ? { 'Content-Length': payload.length } : {}), ...headers }
      },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const buf = Buffer.concat(chunks);
          let json = null;
          try { json = JSON.parse(buf.toString('utf8')); } catch { /* */ }
          resolve({ status: res.statusCode, ok: res.statusCode >= 200 && res.statusCode < 300, json, buf });
        });
      }
    );
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const report = { ok: true, steps: [], artifacts: [] };

  const login = await httpReq('POST', '/api/auth/login', { email: 'admin@naiosh.com', password: 'Admin@123' });
  const token = login.json?.data?.session?.token;
  if (!token) throw new Error('login failed');
  const H = { Authorization: `Bearer ${token}`, Cookie: `authToken=${token}` };

  const list = await httpReq('GET', `/finance/payroll-ops/runs?entity_id=${ENTITY}`, null, H);
  if (!list.ok || !list.json?.success) throw new Error('runs list failed');
  const runs = list.json.runs || [];
  report.steps.push({
    step: 'list_api',
    ok: runs.length >= 6 && runs.every((r) => r.item_count != null),
    count: runs.length,
    first: runs[0] && { run_id: runs[0].run_id, period: `${runs[0].period_year}/${runs[0].period_month}`, item_count: runs[0].item_count },
    sorted_newest_first: runs.length < 2 || (
      Number(runs[0].period_year) > Number(runs[1].period_year) ||
      (Number(runs[0].period_year) === Number(runs[1].period_year) && Number(runs[0].period_month) >= Number(runs[1].period_month)) ||
      runs[0].run_id >= runs[1].run_id
    )
  });

  const sample = runs.slice(0, 6);
  if (sample.length < 6) throw new Error('need at least 6 runs for navigation test');

  const puppeteer = require('puppeteer-core');
  const browser = await puppeteer.launch({
    executablePath: process.env.CHROME_PATH || '/usr/local/bin/google-chrome',
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1440,900']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto(`${BASE}/login-page.html`, { waitUntil: 'domcontentloaded' }).catch(() => {});
  await page.evaluate((t) => { localStorage.setItem('authToken', t); localStorage.setItem('token', t); }, token);
  await page.setCookie({ name: 'authToken', value: token, domain: '127.0.0.1', path: '/' });

  // Full-width list screenshot
  await page.goto(`${BASE}/finance/payroll-runs.html`, { waitUntil: 'networkidle2', timeout: 60000 });
  await page.waitForSelector('.runs-table', { timeout: 20000 });
  const hasSidebar = await page.$('.pay-workspace, .runs-pane');
  const listTitle = await page.$eval('#page-title-text', (el) => el.textContent.trim());
  const colHeaders = await page.$$eval('.runs-table thead th', (ths) => ths.map((t) => t.textContent.trim()));
  report.steps.push({
    step: 'fullwidth_list_ui',
    ok: !hasSidebar && /جميع مسيرات/.test(listTitle) && colHeaders.includes('عدد الموظفين') && colHeaders.includes('الإجراءات'),
    listTitle,
    colHeaders,
    no_sidebar: !hasSidebar
  });
  const listShot = path.join(OUT, 'fullwidth-01-all-runs-list.png');
  await page.screenshot({ path: listShot, fullPage: true });
  report.artifacts.push(listShot);

  // Navigate 6 runs — verify correct number each time
  const navResults = [];
  for (let i = 0; i < sample.length; i++) {
    const r = sample[i];
    await page.goto(`${BASE}/finance/payroll-runs.html?run=${r.run_id}`, { waitUntil: 'networkidle2', timeout: 60000 });
    await page.waitForSelector('#detail-panel.active', { timeout: 15000 });
    await page.waitForFunction(
      (num) => document.body.innerText.includes(num),
      { timeout: 20000 },
      r.run_number
    );
    const shown = await page.evaluate(() => {
      const meta = document.querySelector('.meta-compact');
      const title = document.getElementById('detail-title')?.textContent || '';
      const chip = document.getElementById('detail-run-chip')?.textContent || '';
      const firstCode = document.querySelector('.pay-table tbody tr .code')?.textContent?.trim() || '';
      const active = document.getElementById('detail-panel')?.classList.contains('active');
      const listHidden = !document.getElementById('list-panel')?.classList.contains('active');
      return { title, chip, meta: meta?.innerText || '', firstCode, active, listHidden };
    });
    const ok =
      shown.active &&
      shown.listHidden &&
      shown.title.includes(r.run_number) &&
      shown.chip.includes(r.run_number) &&
      shown.meta.includes(r.run_number);
    navResults.push({
      run_id: r.run_id,
      expected: r.run_number,
      ok,
      title: shown.title,
      chip: shown.chip,
      first_employee_code: shown.firstCode
    });
    if (i === 0) {
      const detailShot = path.join(OUT, 'fullwidth-02-run-detail.png');
      await page.screenshot({ path: detailShot, fullPage: true });
      report.artifacts.push(detailShot);
      // Back button
      await page.click('#btn-back-list');
      await page.waitForSelector('#list-panel.active', { timeout: 10000 });
      const backOk = await page.$eval('#list-panel', (el) => el.classList.contains('active'));
      report.steps.push({ step: 'back_to_all_runs', ok: backOk });
    }
  }
  report.steps.push({
    step: 'navigate_6_runs',
    ok: navResults.every((x) => x.ok),
    results: navResults
  });

  // Mobile viewport check — actions visible
  await page.setViewport({ width: 390, height: 844 });
  await page.goto(`${BASE}/finance/payroll-runs.html`, { waitUntil: 'networkidle2', timeout: 60000 });
  await page.waitForSelector('.runs-table', { timeout: 20000 });
  const mobileShot = path.join(OUT, 'fullwidth-03-list-mobile.png');
  await page.screenshot({ path: mobileShot, fullPage: true });
  report.artifacts.push(mobileShot);
  const openBtnVisible = await page.$eval('.runs-table [data-view]', (el) => {
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  });
  report.steps.push({ step: 'mobile_open_btn', ok: openBtnVisible });

  await browser.close();
  report.ok = report.steps.every((s) => s.ok !== false);
  const reportPath = path.join(OUT, 'fullwidth-payroll-runs-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  if (!report.ok) process.exit(1);
}

main().catch((e) => { console.error(e); process.exit(1); });
