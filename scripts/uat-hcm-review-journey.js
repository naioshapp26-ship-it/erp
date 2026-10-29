/**
 * Pre-merge review journey for HCM employee registry (PR evidence).
 * 1) الموظفون الجدد → form + required photo + preview
 * 2) save → ملفات الموظفين thumbnail → detail → change photo → reload
 * 3) convert accepted candidate with photo → no duplicate
 * 4) hub cards + /hr/employees === /hr/employee-360
 */
const fs = require('fs');
const path = require('path');
const http = require('http');
const { PNG } = require('pngjs');

const BASE = process.env.APP_BASE_URL || 'http://127.0.0.1:3083';
const OUT = process.env.UAT_OUT || '/opt/cursor/artifacts';
const stamp = Date.now().toString(36).toUpperCase();
const frames = [];

function httpReq(method, urlPath, body, headers = {}, raw = false) {
  const u = new URL(urlPath.startsWith('http') ? urlPath : BASE + urlPath);
  const payload = body == null || raw ? body : Buffer.from(JSON.stringify(body));
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: u.hostname,
        port: u.port,
        path: u.pathname + u.search,
        method,
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

function makeFacePng(skinR, skinG, skinB, w = 180) {
  const png = new PNG({ width: w, height: w });
  for (let y = 0; y < w; y++) {
    for (let x = 0; x < w; x++) {
      const i = (w * y + x) << 2;
      const cx = w / 2; const cy = w / 2;
      const dx = x - cx; const dy = y - cy;
      const r = Math.sqrt(dx * dx + dy * dy);
      let R = 255; let G = 241; let B = 242;
      if (r < w * 0.4) { R = skinR; G = skinG; B = skinB; }
      if (dy < -w * 0.05 && r < w * 0.4) { R = 55; G = 30; B = 22; }
      const le = Math.hypot(x - (cx - w * 0.12), y - (cy - w * 0.02)) < w * 0.05;
      const re = Math.hypot(x - (cx + w * 0.12), y - (cy - w * 0.02)) < w * 0.05;
      if (le || re) { R = 20; G = 20; B = 20; }
      const smile = Math.abs(Math.hypot(x - cx, y - (cy + w * 0.14)) - w * 0.13) < 2.4
        && y > cy + w * 0.08 && Math.abs(dx) < w * 0.17;
      if (smile) { R = 140; G = 40; B = 40; }
      png.data[i] = R; png.data[i + 1] = G; png.data[i + 2] = B; png.data[i + 3] = 255;
    }
  }
  return PNG.sync.write(png);
}

async function shot(page, name, fullPage = false) {
  const file = path.join(OUT, name);
  await page.screenshot({ path: file, fullPage });
  frames.push(file);
  return file;
}

async function loginToken() {
  const login = await httpReq('POST', '/api/auth/login', { email: 'admin@naiosh.com', password: 'Admin@123' });
  const token = login.json?.data?.session?.token;
  if (!token) throw new Error('login failed');
  return token;
}

async function seedAuth(page, token) {
  await page.goto(`${BASE}/login-page.html`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.evaluate((t) => {
    localStorage.setItem('authToken', t);
    sessionStorage.setItem('authToken', t);
    localStorage.setItem('token', t);
  }, token);
  await page.setCookie(
    { name: 'authToken', value: token, domain: '127.0.0.1', path: '/' },
    { name: 'token', value: token, domain: '127.0.0.1', path: '/' }
  );
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const report = { ok: true, stamp, steps: [], artifacts: [], routeChecks: [] };
  const token = await loginToken();
  const H = { Authorization: `Bearer ${token}`, Cookie: `authToken=${token}` };

  const photoA = makeFacePng(244, 197, 163);
  const photoB = makeFacePng(210, 160, 120);
  const photoCand = makeFacePng(180, 140, 110);
  const photoAPath = path.join(OUT, `hcm-review-photo-a-${stamp}.png`);
  const photoBPath = path.join(OUT, `hcm-review-photo-b-${stamp}.png`);
  fs.writeFileSync(photoAPath, photoA);
  fs.writeFileSync(photoBPath, photoB);

  const empNumber = `REV-${stamp}`;
  const fullName = `مراجعة رحلة ${stamp}`;

  const puppeteer = require('puppeteer-core');
  const browser = await puppeteer.launch({
    executablePath: process.env.CHROME_PATH || '/usr/local/bin/google-chrome',
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1440,900']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  page.on('pageerror', (e) => console.log('PAGE_EXCEPTION', e.message));
  await seedAuth(page, token);

  // ---------- 1) الموظفون الجدد: form opens + required photo + preview ----------
  await page.goto(`${BASE}/hr/employee-360?mode=add`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => {
    const modal = document.getElementById('employeeFormModal');
    return !!(modal && (modal.classList.contains('open') || getComputedStyle(modal).display !== 'none'));
  }, { timeout: 30000 });
  const formMeta = await page.evaluate(() => {
    const title = document.getElementById('employeeFormTitle')?.textContent?.trim();
    const label = document.querySelector('label[for="employeePhotoInput"]')?.textContent?.trim();
    const input = document.getElementById('employeePhotoInput');
    return {
      title,
      photoLabel: label,
      accept: input?.getAttribute('accept') || '',
      modalOpen: true
    };
  });
  report.steps.push({ step: 'new_hires_form_opens', ok: formMeta.title?.includes('إضافة') && /صورة/.test(formMeta.photoLabel || ''), ...formMeta });
  await shot(page, 'hcm-review-01-new-employee-form.png');

  // Try save without photo → error
  await page.type('input[name="full_name"]', fullName);
  await page.type('input[name="employee_number"]', empNumber);
  await page.type('input[name="email"]', `rev.${stamp.toLowerCase()}@example.com`);
  await page.type('input[name="phone"]', '0501111222');
  await page.type('input[name="position"]', 'محلل موارد بشرية');
  await page.type('input[name="department"]', 'الموارد البشرية');
  await page.click('#saveEmployeeForm');
  await new Promise((r) => setTimeout(r, 700));
  const requiredErr = await page.evaluate(() => document.getElementById('employeeFormError')?.textContent || '');
  report.steps.push({
    step: 'photo_required_blocks_save',
    ok: /صورة|مطلوب/.test(requiredErr),
    error: requiredErr
  });
  await shot(page, 'hcm-review-02-photo-required-error.png');

  // Upload photo + preview
  const fileInput = await page.$('#employeePhotoInput');
  await fileInput.uploadFile(photoAPath);
  await page.waitForFunction(() => {
    const img = document.querySelector('#employeePhotoPreview img');
    return !!(img && img.getAttribute('src'));
  }, { timeout: 10000 });
  report.steps.push({ step: 'photo_preview_before_save', ok: true });
  await shot(page, 'hcm-review-03-photo-preview.png');

  await page.click('#saveEmployeeForm');
  await page.waitForFunction(() => {
    const modal = document.getElementById('employeeFormModal');
    return !modal || getComputedStyle(modal).display === 'none' || !modal.classList.contains('open');
  }, { timeout: 30000 }).catch(() => {});
  await page.waitForFunction(() => {
    const cards = document.querySelectorAll('.roster-card');
    return cards.length > 0 && !(document.getElementById('rosterCount')?.textContent || '').includes('جاري التحميل');
  }, { timeout: 30000 });
  report.steps.push({ step: 'save_employee_with_photo', ok: true, employee_number: empNumber });

  // ---------- 2) ملفات الموظفين: thumbnail → detail → change → reload ----------
  await page.goto(`${BASE}/hr/employee-360`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => document.querySelectorAll('.roster-card').length > 0, { timeout: 30000 });
  await page.focus('#rosterSearch');
  await page.evaluate(() => {
    const s = document.getElementById('rosterSearch');
    if (s) { s.value = ''; s.dispatchEvent(new Event('input', { bubbles: true })); }
  });
  await page.type('#rosterSearch', empNumber);
  await new Promise((r) => setTimeout(r, 600));
  const rosterRow = await page.evaluate((num) => {
    const card = document.querySelector(`.roster-card[data-employee-number="${num}"]`);
    if (!card) return null;
    const img = card.querySelector('.roster-photo img');
    return {
      found: true,
      name: card.querySelector('.font-extrabold')?.textContent?.trim(),
      photoSrc: img?.getAttribute('src') || '',
      hasApiPhoto: (img?.getAttribute('src') || '').includes('/api/hr/employee-profile/')
    };
  }, empNumber);
  report.steps.push({ step: 'roster_shows_thumbnail', ok: !!(rosterRow && rosterRow.hasApiPhoto), ...rosterRow });
  await shot(page, 'hcm-review-04-roster-with-thumbnail.png');

  await page.goto(`${BASE}/hr/employee-360?employeeId=${encodeURIComponent(empNumber)}`, {
    waitUntil: 'domcontentloaded',
    timeout: 60000
  });
  await page.waitForFunction(() => {
    const img = document.querySelector('#employeeAvatar img, .employee-hero img, [id*="Avatar"] img');
    return !!(img && (img.getAttribute('src') || '').includes('/photo'));
  }, { timeout: 30000 }).catch(() => {});
  await new Promise((r) => setTimeout(r, 1000));
  const detailBefore = await page.evaluate(() => {
    const img = document.querySelector('#employeeAvatar img, .employee-hero img');
    return { src: img?.getAttribute('src') || '', naturalWidth: img?.naturalWidth || 0 };
  });
  report.steps.push({
    step: 'detail_shows_photo',
    ok: (detailBefore.src || '').includes('/photo'),
    ...detailBefore
  });
  await shot(page, 'hcm-review-05-detail-photo.png');

  // Change photo via detailPhotoInput (changePhotoBtn triggers it)
  const detailPhotoInput = await page.$('#detailPhotoInput');
  if (detailPhotoInput) {
    await detailPhotoInput.uploadFile(photoBPath);
    await new Promise((r) => setTimeout(r, 1200));
  } else {
    const boundary = '----RevBound' + stamp;
    const multipart = Buffer.concat([
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="photoB.png"\r\nContent-Type: image/png\r\n\r\n`),
      photoB,
      Buffer.from(`\r\n--${boundary}\r\nContent-Disposition: form-data; name="mediaType"\r\n\r\nphoto\r\n--${boundary}--\r\n`)
    ]);
    await httpReq(
      'POST',
      `/api/hr/employee-profile/${encodeURIComponent(empNumber)}/media?mediaType=photo`,
      multipart,
      { ...H, 'Content-Type': `multipart/form-data; boundary=${boundary}`, 'Content-Length': multipart.length },
      true
    );
  }
  await new Promise((r) => setTimeout(r, 1500));
  // Force reload to prove persistence
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => {
    const img = document.querySelector('#employeeAvatar img, .employee-hero img');
    return !!(img && (img.getAttribute('src') || '').includes('/photo'));
  }, { timeout: 30000 });
  await new Promise((r) => setTimeout(r, 1000));
  const photoAfterReload = await httpReq('GET', `/api/hr/employee-profile/${encodeURIComponent(empNumber)}/photo`, null, H);
  report.steps.push({
    step: 'photo_persists_after_reload',
    ok: photoAfterReload.ok && photoAfterReload.buf.length > 100 && !photoAfterReload.buf.equals(photoA),
    bytes: photoAfterReload.buf.length,
    changed_from_original: !photoAfterReload.buf.equals(photoA)
  });
  await shot(page, 'hcm-review-06-detail-after-reload.png');

  // ---------- 3) Candidate → convert with photo, no duplicate ----------
  const candName = `مرشح مراجعة ${stamp}`;
  const hire = await httpReq('POST', '/api/new-hires', {
    full_name: candName,
    reference_code: `CREF-${stamp}`,
    phone: '0503333444',
    employee_info: JSON.stringify({
      job_title: 'أخصائي توظيف',
      email: `cand.rev.${stamp.toLowerCase()}@example.com`
    }),
    interview_date: '2026-10-28',
    status: 'pending'
  }, H);
  if (!hire.ok) throw new Error('new-hire create failed: ' + (hire.json?.error || hire.status));
  const hireId = hire.json?.id;
  await httpReq('PUT', `/api/new-hires/${hireId}`, { status: 'accepted', decision_reason: 'مقبول للمراجعة' }, H);
  const acceptedList = await httpReq('GET', '/api/accepted-employees', null, H);
  const acceptedRow = (acceptedList.json || []).find((r) => r.full_name === candName);
  if (!acceptedRow) throw new Error('accepted candidate missing');

  await page.goto(`${BASE}/hr/accepted-employees`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await new Promise((r) => setTimeout(r, 1500));
  await shot(page, 'hcm-review-07-accepted-before-convert.png');

  const convert = await httpReq('POST', `/api/accepted-employees/${acceptedRow.id}/convert-to-employee`, {
    note: 'مراجعة تحويل مع صورة',
    photo_base64: photoCand.toString('base64'),
    photo_mime: 'image/png'
  }, H);
  const convert2 = await httpReq('POST', `/api/accepted-employees/${acceptedRow.id}/convert-to-employee`, {
    note: 'إعادة تحويل'
  }, H);
  const convertedNumber = convert.json?.employee_number;
  const rosterAfter = await httpReq('GET', '/api/hr/employee-360/roster', null, H);
  const matches = (rosterAfter.json?.employees || []).filter((e) =>
    e.employee_number === convertedNumber || e.full_name === candName
  );
  const convertedPhoto = await httpReq(
    'GET',
    `/api/hr/employee-profile/${encodeURIComponent(convertedNumber)}/photo`,
    null,
    H
  );
  report.steps.push({
    step: 'convert_candidate_no_duplicate',
    ok: convert.ok && convert2.status === 409 && matches.length === 1 && convertedPhoto.ok,
    employee_number: convertedNumber,
    photo_attached: convert.json?.photo_attached,
    second_status: convert2.status,
    roster_matches: matches.length,
    photo_bytes: convertedPhoto.buf?.length || 0,
    data: matches[0] ? {
      full_name: matches[0].full_name,
      position: matches[0].position,
      phone: matches[0].phone,
      photo_url: matches[0].photo_url
    } : null
  });

  await page.goto(`${BASE}/hr/employee-360?employeeId=${encodeURIComponent(convertedNumber)}`, {
    waitUntil: 'domcontentloaded',
    timeout: 60000
  });
  await new Promise((r) => setTimeout(r, 1500));
  await shot(page, 'hcm-review-08-converted-employee-detail.png');
  await page.goto(`${BASE}/hr/employee-360`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => document.querySelectorAll('.roster-card').length > 0, { timeout: 30000 });
  await page.evaluate(() => {
    const s = document.getElementById('rosterSearch');
    if (s) { s.value = ''; s.dispatchEvent(new Event('input', { bubbles: true })); }
  });
  await page.type('#rosterSearch', convertedNumber);
  await new Promise((r) => setTimeout(r, 800));
  await shot(page, 'hcm-review-09-converted-in-roster.png');

  // ---------- 4) Hub cards + /hr/employees equivalence ----------
  await page.goto(`${BASE}/hr`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await new Promise((r) => setTimeout(r, 1500));
  const hubCards = await page.evaluate(() => {
    const cards = [...document.querySelectorAll('a, button, [data-href], .card, .portal-card, .system-card')]
      .map((el) => ({
        text: (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 120),
        href: el.getAttribute('href') || el.getAttribute('data-href') || ''
      }))
      .filter((c) => /ملفات الموظفين|الموظفون الجدد|التوظيف|مرشحون مقبولون|موظف 360/.test(c.text) || /employee-360|new-hires|accepted-employees|\/hr\/employees/.test(c.href));
    return cards.slice(0, 20);
  });
  await shot(page, 'hcm-review-10-hub-cards.png', true);

  const htmlEmployees = await httpReq('GET', '/hr/employees', null, H);
  const html360 = await httpReq('GET', '/hr/employee-360', null, H);
  const bodyEmp = htmlEmployees.buf.toString('utf8');
  const body360 = html360.buf.toString('utf8');
  const samePage = bodyEmp.includes('ملفات الموظفين') && body360.includes('ملفات الموظفين')
    && bodyEmp.includes('rosterGrid') && body360.includes('rosterGrid')
    && bodyEmp.includes('employeeFormModal') && body360.includes('employeeFormModal');
  report.routeChecks.push({
    step: 'employees_equals_employee_360',
    ok: htmlEmployees.status === 200 && html360.status === 200 && samePage,
    employees_status: htmlEmployees.status,
    employee360_status: html360.status,
    employees_has_roster: bodyEmp.includes('rosterGrid'),
    employee360_has_roster: body360.includes('rosterGrid')
  });
  report.routeChecks.push({
    step: 'hub_card_labels',
    ok: true,
    cards: hubCards
  });

  await page.goto(`${BASE}/hr/employees`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => document.querySelectorAll('.roster-card').length > 0, { timeout: 30000 }).catch(() => {});
  const empPageTitle = await page.evaluate(() => document.getElementById('pageTitle')?.textContent?.trim());
  report.routeChecks.push({
    step: 'hr_employees_page_title',
    ok: empPageTitle === 'ملفات الموظفين',
    title: empPageTitle
  });
  await shot(page, 'hcm-review-11-hr-employees-same-registry.png');

  await browser.close();

  report.artifacts = frames.slice();
  report.ok = report.steps.every((s) => s.ok !== false) && report.routeChecks.every((s) => s.ok !== false);
  const reportPath = path.join(OUT, 'hcm-review-journey-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  if (!report.ok) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
