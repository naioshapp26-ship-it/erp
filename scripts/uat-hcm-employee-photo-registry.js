/**
 * HCM employee registry + photo persistence UAT on isolated :3083.
 * Add employee with photo → roster → detail → change photo → reload → convert candidate.
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

function makePngBuffer(r, g, b) {
  const png = new PNG({ width: 64, height: 64 });
  for (let y = 0; y < 64; y++) {
    for (let x = 0; x < 64; x++) {
      const i = (64 * y + x) << 2;
      png.data[i] = r; png.data[i + 1] = g; png.data[i + 2] = b; png.data[i + 3] = 255;
    }
  }
  return PNG.sync.write(png);
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const report = { ok: true, steps: [], artifacts: [], inventory: fs.readFileSync('/workspace/docs/hcm-employee-registry-unification.md', 'utf8').slice(0, 1200) };

  const login = await httpReq('POST', '/api/auth/login', { email: 'admin@naiosh.com', password: 'Admin@123' });
  const token = login.json?.data?.session?.token;
  if (!token) throw new Error('login failed');
  const H = { Authorization: `Bearer ${token}`, Cookie: `authToken=${token}` };

  const empNumber = `REG-${stamp}`;
  const fullName = `موظف سجل ${stamp}`;
  const create = await httpReq('POST', '/api/employees', {
    employee_number: empNumber,
    full_name: fullName,
    email: `reg.${stamp.toLowerCase()}@example.com`,
    phone: '0500000001',
    position: 'أخصائي موارد بشرية',
    department: 'الموارد البشرية',
    assigned_entity_type: 'HQ',
    entity_value: 1,
    hire_date: '2026-10-29',
    employment_type: 'FULL_TIME',
    is_active: true
  }, H);
  if (!create.ok) throw new Error('employee create failed: ' + (create.json?.error || create.status));
  report.steps.push({ step: 'create_employee_central', ok: true, employee_number: empNumber });

  // Ensure profile then upload photo via multipart
  await httpReq('GET', `/api/hr/employee-profile?employeeId=${encodeURIComponent(empNumber)}`, null, H);
  const photo1 = makePngBuffer(200, 40, 40);
  const boundary = '----HCMBound' + stamp;
  const multipart = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="photo1.png"\r\nContent-Type: image/png\r\n\r\n`),
    photo1,
    Buffer.from(`\r\n--${boundary}\r\nContent-Disposition: form-data; name="mediaType"\r\n\r\nphoto\r\n--${boundary}--\r\n`)
  ]);
  const up1 = await httpReq(
    'POST',
    `/api/hr/employee-profile/${encodeURIComponent(empNumber)}/media?mediaType=photo`,
    multipart,
    { ...H, 'Content-Type': `multipart/form-data; boundary=${boundary}`, 'Content-Length': multipart.length },
    true
  );
  if (!up1.ok) throw new Error('photo upload failed: ' + (up1.json?.error || up1.status));
  report.steps.push({ step: 'upload_photo_pg', ok: true, bytes: photo1.length });

  const getPhoto1 = await httpReq('GET', `/api/hr/employee-profile/${encodeURIComponent(empNumber)}/photo`, null, H);
  report.steps.push({
    step: 'serve_photo_authorized',
    ok: getPhoto1.ok && getPhoto1.buf.length > 50 && String(getPhoto1.headers['content-type'] || '').includes('image'),
    content_type: getPhoto1.headers['content-type'],
    bytes: getPhoto1.buf.length
  });

  const roster = await httpReq('GET', '/api/hr/employee-360/roster', null, H);
  const row = (roster.json?.employees || roster.json?.roster || roster.json || []).find?.((e) => e.employee_number === empNumber)
    || (Array.isArray(roster.json) ? roster.json.find((e) => e.employee_number === empNumber) : null);
  // roster shape varies
  let found = row;
  if (!found && roster.json?.employees) found = roster.json.employees.find((e) => e.employee_number === empNumber);
  if (!found && Array.isArray(roster.json?.data)) found = roster.json.data.find((e) => e.employee_number === empNumber);
  report.steps.push({
    step: 'roster_has_employee_with_photo',
    ok: !!(found && found.photo_url),
    photo_url: found?.photo_url || null,
    roster_keys: roster.json && typeof roster.json === 'object' ? Object.keys(roster.json).slice(0, 8) : []
  });

  // Change photo
  const photo2 = makePngBuffer(40, 120, 200);
  const boundary2 = '----HCMBound2' + stamp;
  const multipart2 = Buffer.concat([
    Buffer.from(`--${boundary2}\r\nContent-Disposition: form-data; name="file"; filename="photo2.png"\r\nContent-Type: image/png\r\n\r\n`),
    photo2,
    Buffer.from(`\r\n--${boundary2}\r\nContent-Disposition: form-data; name="mediaType"\r\n\r\nphoto\r\n--${boundary2}--\r\n`)
  ]);
  const up2 = await httpReq(
    'POST',
    `/api/hr/employee-profile/${encodeURIComponent(empNumber)}/media?mediaType=photo`,
    multipart2,
    { ...H, 'Content-Type': `multipart/form-data; boundary=${boundary2}`, 'Content-Length': multipart2.length },
    true
  );
  const getPhoto2 = await httpReq('GET', `/api/hr/employee-profile/${encodeURIComponent(empNumber)}/photo`, null, H);
  report.steps.push({
    step: 'replace_photo_persists',
    ok: up2.ok && getPhoto2.ok && !getPhoto1.buf.equals(getPhoto2.buf),
    before: getPhoto1.buf.length,
    after: getPhoto2.buf.length,
    content_changed: !getPhoto1.buf.equals(getPhoto2.buf)
  });

  // Candidate → accepted → convert without duplicate
  const candName = `مرشح ${stamp}`;
  const hire = await httpReq('POST', '/api/new-hires', {
    full_name: candName,
    reference_code: `REF-${stamp}`,
    phone: '0500000099',
    employee_info: JSON.stringify({ job_title: 'محاسب', email: `cand.${stamp.toLowerCase()}@example.com` }),
    interview_date: '2026-10-28',
    status: 'pending'
  }, H);
  if (!hire.ok) throw new Error('new-hire create failed: ' + (hire.json?.error || hire.status));
  const hireId = hire.json?.id;
  const accept = await httpReq('PUT', `/api/new-hires/${hireId}`, {
    status: 'accepted',
    decision_reason: 'مقبول للاختبار'
  }, H);
  const acceptedList = await httpReq('GET', '/api/accepted-employees', null, H);
  const acceptedRow = (acceptedList.json || []).find((r) => r.full_name === candName);
  if (!acceptedRow) throw new Error('accepted candidate not found after accept');
  const convert = await httpReq('POST', `/api/accepted-employees/${acceptedRow.id}/convert-to-employee`, {
    note: 'UAT convert'
  }, H);
  const convert2 = await httpReq('POST', `/api/accepted-employees/${acceptedRow.id}/convert-to-employee`, {
    note: 'UAT convert again'
  }, H);
  report.steps.push({
    step: 'recruit_accept_convert_no_dup',
    ok: accept.ok && convert.ok && convert.json?.employee_number && convert2.status === 409,
    hire_id: hireId,
    accepted_id: acceptedRow?.id,
    employee_number: convert.json?.employee_number,
    second_status: convert2.status,
    created: convert.json?.created,
    convert_error: convert.json?.error || null
  });

  // UI screenshots
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

  await page.goto(`${BASE}/hr/employee-360?mode=add`, { waitUntil: 'networkidle2', timeout: 60000 });
  await page.waitForSelector('#employeeFormModal.open, #employee360Form', { timeout: 20000 }).catch(() => {});
  // force open if portal context delayed
  const opened = await page.$('#employeeFormModal.open');
  if (!opened) {
    await page.evaluate(() => {
      const btn = document.getElementById('addEmployeeBtn');
      if (btn) { btn.classList.remove('hidden'); btn.click(); }
    });
    await page.waitForTimeout?.(800);
    await new Promise((r) => setTimeout(r, 800));
  }
  const formShot = path.join(OUT, 'hcm-01-add-employee-photo-form.png');
  await page.screenshot({ path: formShot, fullPage: true });
  report.artifacts.push(formShot);

  await page.goto(`${BASE}/hr/employee-360`, { waitUntil: 'networkidle2', timeout: 60000 });
  await page.waitForSelector('#rosterGrid', { timeout: 20000 });
  await page.type('#rosterSearch', empNumber).catch(() => {});
  await new Promise((r) => setTimeout(r, 600));
  const listShot = path.join(OUT, 'hcm-02-employee-roster-with-photo.png');
  await page.screenshot({ path: listShot, fullPage: true });
  report.artifacts.push(listShot);

  await page.goto(`${BASE}/hr`, { waitUntil: 'networkidle2', timeout: 60000 });
  const hubShot = path.join(OUT, 'hcm-03-hub-unified-cards.png');
  await page.screenshot({ path: hubShot, fullPage: true });
  report.artifacts.push(hubShot);

  await browser.close();

  report.ok = report.steps.every((s) => s.ok !== false);
  fs.writeFileSync(path.join(OUT, 'hcm-employee-registry-report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  if (!report.ok) process.exit(1);
}

main().catch((e) => { console.error(e); process.exit(1); });
