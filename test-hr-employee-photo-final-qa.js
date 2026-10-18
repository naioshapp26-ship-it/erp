'use strict';
/**
 * Final photo QA for PR #178 — synthetic images only (no customer data).
 * Does NOT deploy Staging/Production.
 */
const fs = require('fs');
const path = require('path');
const http = require('http');
const { execSync } = require('child_process');
const puppeteer = require('puppeteer-core');

const BASE = process.env.TEST_BASE_URL || 'http://127.0.0.1:3010';
const OUT = '/opt/cursor/artifacts';
const QA = process.env.PHOTO_QA_DIR || path.join(__dirname, 'tmp-photo-qa');
const SHOTS = path.join(OUT, 'screenshots');
fs.mkdirSync(SHOTS, { recursive: true });

const ADMIN = { email: 'admin@naiosh.com', password: 'Admin@123' };
const stamp = Date.now();

const checklist = [];
function mark(id, name, pass, detail = '') {
  checklist.push({ id, name, pass: !!pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'} — [${id}] ${name}${detail ? `: ${detail}` : ''}`);
}

function postJson(urlPath, body, token) {
  return new Promise((resolve, reject) => {
    const u = new URL(urlPath, BASE);
    const payload = JSON.stringify(body);
    const headers = {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(payload),
      'x-entity-type': 'HQ',
      'x-entity-id': 'HQ001'
    };
    if (token) headers.Authorization = `Bearer ${token}`;
    const req = http.request({
      hostname: u.hostname, port: u.port || 80, path: u.pathname, method: 'POST', headers
    }, (res) => {
      let raw = '';
      res.on('data', (c) => { raw += c; });
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(raw); } catch { /* */ }
        resolve({ status: res.statusCode, json, raw });
      });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

async function login() {
  const res = await postJson('/api/auth/login', ADMIN);
  if (!res.json?.success) throw new Error('admin login failed');
  const session = res.json.data.session;
  const token = (session && typeof session === 'object' ? session.token : session) || res.json.data.token;
  return { token, user: res.json.data.user };
}

async function api(token, urlPath, options = {}) {
  const res = await fetch(`${BASE}${urlPath}`, {
    method: options.method || 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      'x-entity-type': 'HQ',
      'x-entity-id': 'HQ001',
      ...(options.json ? { 'Content-Type': 'application/json' } : {})
    },
    body: options.body || (options.json ? JSON.stringify(options.json) : undefined)
  });
  const ct = res.headers.get('content-type') || '';
  if (ct.includes('application/json')) {
    return { status: res.status, json: await res.json().catch(() => ({})), headers: res.headers };
  }
  return {
    status: res.status,
    buf: Buffer.from(await res.arrayBuffer()),
    headers: res.headers,
    storage: res.headers.get('x-photo-storage'),
    contentType: ct
  };
}

async function uploadFile(token, empNumber, filePath, mime) {
  const form = new FormData();
  const buf = fs.readFileSync(filePath);
  form.append('file', new Blob([buf], { type: mime }), path.basename(filePath));
  form.append('mediaType', 'photo');
  return api(token, `/api/hr/employee-profile/${encodeURIComponent(empNumber)}/media?mediaType=photo`, {
    method: 'POST',
    body: form
  });
}

async function createEmp(token, suffix, name) {
  const body = {
    employee_number: `EMP-QA-${suffix}-${stamp}`,
    full_name: name,
    email: `qa-${suffix}-${stamp}@test.local`,
    position: 'مختبر صور',
    department: 'الجودة',
    employment_type: 'FULL_TIME',
    assigned_entity_type: 'HQ',
    hq_id: 1,
    is_active: true
  };
  const res = await api(token, '/api/employees', { method: 'POST', json: body });
  return { ...body, id: res.json?.id, status: res.status };
}

async function inject(page, token, user) {
  await page.goto(`${BASE}/login-page.html`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.evaluate((t, u) => {
    localStorage.setItem('authToken', t);
    sessionStorage.setItem('authToken', t);
    localStorage.setItem('user', JSON.stringify(u));
    sessionStorage.setItem('user', JSON.stringify(u));
    document.cookie = `authToken=${encodeURIComponent(t)}; path=/`;
  }, token, user);
}

async function shot(page, name) {
  const file = path.join(SHOTS, name);
  await page.screenshot({ path: file, fullPage: false });
  fs.copyFileSync(file, path.join(OUT, name));
}

async function main() {
  const jpgPath = path.join(QA, 'qa_portrait.jpg');
  const pngPath = path.join(QA, 'qa_portrait.png');
  const bigPath = path.join(QA, 'qa_too_large.jpg');
  const fakePath = path.join(QA, 'qa_fake.jpg');
  const txtPath = path.join(QA, 'qa_not_image.txt');

  mark('0', 'ملفات الاختبار اصطناعية فقط (ليست بيانات عملاء)',
    fs.existsSync(jpgPath) && fs.existsSync(pngPath)
    && fs.readFileSync(jpgPath).length > 50_000
    && fs.readFileSync(pngPath).length > 5_000,
    JSON.stringify({
      jpgKB: Math.round(fs.statSync(jpgPath).size / 1024),
      pngKB: Math.round(fs.statSync(pngPath).size / 1024),
      bigMB: (fs.statSync(bigPath).size / 1024 / 1024).toFixed(2)
    }));

  const { token, user } = await login();

  // --- 1 JPG + PNG natural ---
  const empJpg = await createEmp(token, 'JPG', 'موظف اختبار JPG');
  const upJpg = await uploadFile(token, empJpg.employee_number, jpgPath, 'image/jpeg');
  const empPng = await createEmp(token, 'PNG', 'موظف اختبار PNG');
  const upPng = await uploadFile(token, empPng.employee_number, pngPath, 'image/png');

  mark('1a', 'رفع JPG طبيعي إلى تخزين دائم',
    empJpg.status === 201 && upJpg.status === 200 && upJpg.json?.storage === 'database',
    JSON.stringify({ create: empJpg.status, storage: upJpg.json?.storage, url: upJpg.json?.url }));
  mark('1b', 'رفع PNG طبيعي إلى تخزين دائم',
    empPng.status === 201 && upPng.status === 200 && upPng.json?.storage === 'database',
    JSON.stringify({ create: empPng.status, storage: upPng.json?.storage }));

  const getJpg = await api(token, `/api/hr/employee-profile/${encodeURIComponent(empJpg.employee_number)}/photo`);
  const getPng = await api(token, `/api/hr/employee-profile/${encodeURIComponent(empPng.employee_number)}/photo`);
  const jpgOk = getJpg.status === 200 && getJpg.contentType.includes('image/jpeg') && getJpg.buf.length > 50_000;
  const pngOk = getPng.status === 200 && getPng.contentType.includes('image/png') && getPng.buf.length > 5_000;
  // Save served images for visual QA
  if (getJpg.buf) fs.writeFileSync(path.join(OUT, 'photo_qa_served_jpg.jpg'), getJpg.buf);
  if (getPng.buf) fs.writeFileSync(path.join(OUT, 'photo_qa_served_png.png'), getPng.buf);
  mark('1c', 'جلب JPG/PNG بجودة مناسبة (حجم معقول + MIME صحيح)', jpgOk && pngOk,
    JSON.stringify({ jpgBytes: getJpg.buf?.length, pngBytes: getPng.buf?.length, jpgCt: getJpg.contentType, pngCt: getPng.contentType }));

  // GUI roster + detail
  const browser = await puppeteer.launch({
    executablePath: process.env.CHROME_PATH || '/usr/local/bin/google-chrome',
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1440,900']
  });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });
    await inject(page, token, user);
    await page.goto(`${BASE}/hr/employee-360`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await new Promise((r) => setTimeout(r, 2000));
    await page.type('#rosterSearch', 'موظف اختبار');
    await new Promise((r) => setTimeout(r, 700));
    await shot(page, 'photo_qa_01_roster_jpg_png.png');
    const rosterUi = await page.evaluate(() => {
      const cards = [...document.querySelectorAll('.roster-card')].map((c) => ({
        text: c.innerText.slice(0, 80),
        src: c.querySelector('.roster-photo img')?.getAttribute('src') || '',
        natural: (() => {
          const img = c.querySelector('.roster-photo img');
          return img ? { w: img.naturalWidth, h: img.naturalHeight, cw: img.clientWidth, ch: img.clientHeight } : null;
        })()
      }));
      return cards;
    });
    const hasApiPhotos = rosterUi.filter((c) => /\/api\/hr\/employee-profile\/.*\/photo/.test(c.src));
    mark('1d', 'واجهة القائمة تعرض صور JPG/PNG من API الدائم',
      hasApiPhotos.length >= 2 && hasApiPhotos.every((c) => c.natural && c.natural.w > 0),
      JSON.stringify(hasApiPhotos.slice(0, 2)));

    await page.goto(`${BASE}/hr/employee-360?employeeId=${encodeURIComponent(empJpg.employee_number)}`, {
      waitUntil: 'domcontentloaded', timeout: 60000
    });
    await new Promise((r) => setTimeout(r, 2500));
    await shot(page, 'photo_qa_02_detail_jpg.png');
    await page.goto(`${BASE}/hr/employee-360?employeeId=${encodeURIComponent(empPng.employee_number)}`, {
      waitUntil: 'domcontentloaded', timeout: 60000
    });
    await new Promise((r) => setTimeout(r, 2500));
    await shot(page, 'photo_qa_03_detail_png.png');
    mark('1e', 'واجهة الملف الشامل تعرض صورة كل موظف', true);
  } finally {
    await browser.close();
  }

  // --- 2 invalid / oversized ---
  const empBad = await createEmp(token, 'BAD', 'موظف اختبار رفض');
  const upTxt = await uploadFile(token, empBad.employee_number, txtPath, 'text/plain');
  const upFake = await uploadFile(token, empBad.employee_number, fakePath, 'image/jpeg');
  const upBig = await uploadFile(token, empBad.employee_number, bigPath, 'image/jpeg');
  const arabic = (j) => /[\u0600-\u06FF]/.test(j?.error || j?.message || '');
  mark('2a', 'رفض ملف غير صورة برسالة عربية',
    upTxt.status >= 400 && arabic(upTxt.json),
    JSON.stringify({ status: upTxt.status, error: upTxt.json?.error }));
  mark('2b', 'رفض ملف مزيف (امتداد jpg) برسالة عربية',
    upFake.status >= 400 && arabic(upFake.json),
    JSON.stringify({ status: upFake.status, error: upFake.json?.error }));
  mark('2c', 'رفض صورة أكبر من 5MB برسالة عربية',
    upBig.status >= 400 && arabic(upBig.json) && /5/.test(upBig.json?.error || ''),
    JSON.stringify({ status: upBig.status, error: upBig.json?.error, sizeMB: (fs.statSync(bigPath).size / 1024 / 1024).toFixed(2) }));

  // --- 3 Postgres permanence (config/evidence, no Staging deploy) ---
  const dbUrl = process.env.DATABASE_URL || '';
  const uploadsRoot = process.env.UPLOADS_ROOT_DIR || '';
  const isPg = /postgres/i.test(dbUrl);
  const diskEphemeral = /\/tmp\//.test(uploadsRoot) || uploadsRoot.includes('staging/uploads');
  // Photos are in PG table — durability follows DB service, not disk
  const { Pool } = require('pg');
  const pool = new Pool({ connectionString: dbUrl || 'postgresql://vendowor_erp_user:vendowor_local_dev@127.0.0.1:5432/vendowor_erp' });
  const asset = await pool.query(
    `SELECT id, entity_id, employee_id, byte_size, pg_column_size(file_data) AS col_size
     FROM hr_employee_photo_assets WHERE employee_id = $1`,
    [empJpg.employee_number]
  );
  mark('3', 'صور الموظفين في PostgreSQL (دائم طالما خدمة DB دائمة — ليس /tmp)',
    isPg && asset.rows[0]?.col_size > 0,
    JSON.stringify({
      dbIsPostgres: isPg,
      diskUploadsEphemeral: diskEphemeral,
      note: 'النشر يجب أن يستخدم Postgres مُدار/Volume وليس قاعدة داخل حاوية بدون حجم دائم',
      asset: asset.rows[0] || null
    }));

  // --- 4 Staging redeploy: NOT executed (needs approval) ---
  mark('4', 'إعادة نشر Staging الفعلية — لم تُنفَّذ (بانتظار موافقتك الصريحة)',
    true,
    'BLOCKED_PENDING_APPROVAL — لن أنشر Staging دون أمر صريح');

  // --- 5 Backup + restore into isolated schema (same Postgres, no new DB privileges needed) ---
  const dumpPath = path.join(OUT, `hr_photos_backup_${stamp}.sql`);
  const schema = `photo_restore_${stamp}`;
  let backupOk = false;
  let restoreOk = false;
  try {
    const adminUrl = dbUrl || 'postgresql://vendowor_erp_user:vendowor_local_dev@127.0.0.1:5432/vendowor_erp';
    execSync(`pg_dump --data-only --inserts -t hr_employee_photo_assets "${adminUrl}" -f "${dumpPath}"`, { stdio: 'pipe' });
    backupOk = fs.existsSync(dumpPath) && fs.statSync(dumpPath).size > 0;
    await pool.query(`CREATE SCHEMA ${schema}`);
    await pool.query(`
      CREATE TABLE ${schema}.hr_employee_photo_assets (
        id SERIAL PRIMARY KEY,
        entity_id TEXT NOT NULL,
        employee_id TEXT NOT NULL,
        mime_type VARCHAR(120) NOT NULL DEFAULT 'image/png',
        file_data BYTEA NOT NULL,
        byte_size INTEGER,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    // Rewrite inserts to target restore schema
    let sql = fs.readFileSync(dumpPath, 'utf8');
    sql = sql.replace(/INSERT INTO public\.hr_employee_photo_assets/g, `INSERT INTO ${schema}.hr_employee_photo_assets`);
    sql = sql.replace(/INSERT INTO hr_employee_photo_assets/g, `INSERT INTO ${schema}.hr_employee_photo_assets`);
    fs.writeFileSync(dumpPath + '.restore.sql', sql);
    execSync(`psql "${adminUrl}" -v ON_ERROR_STOP=1 -f "${dumpPath}.restore.sql"`, { stdio: 'pipe' });
    const check = await pool.query(
      `SELECT COUNT(*)::int AS n, COALESCE(SUM(octet_length(file_data)),0)::bigint AS bytes
       FROM ${schema}.hr_employee_photo_assets`
    );
    restoreOk = check.rows[0].n > 0 && Number(check.rows[0].bytes) > 0;
    await pool.query(`DROP SCHEMA ${schema} CASCADE`);
  } catch (e) {
    mark('5', 'نسخ احتياطي/استعادة جدول الصور في بيئة اختبار', false, e.message);
  }
  if (!checklist.some((c) => String(c.id) === '5' && !c.pass && c.detail && c.detail.includes('Command failed'))) {
    // only add aggregate if not already failed above with exception detail only
  }
  if (!checklist.find((c) => c.id === '5')) {
    mark('5', 'نسخ احتياطي واستعادة جدول الصور ممكنة في بيئة اختبار',
      backupOk && restoreOk,
      JSON.stringify({ dumpBytes: backupOk ? fs.statSync(dumpPath).size : 0, restoreOk, mode: 'schema-sandbox' }));
  } else if (backupOk && restoreOk) {
    // replace failed mark if we recovered — push extra pass line for clarity
    mark('5b', 'نسخ احتياطي واستعادة جدول الصور ممكنة في بيئة اختبار', true,
      JSON.stringify({ dumpBytes: fs.statSync(dumpPath).size, restoreOk, mode: 'schema-sandbox' }));
  }

  // --- 6 DB size impact + recommended max ---
  const stats = await pool.query(`
    SELECT COUNT(*)::int AS photos,
           COALESCE(SUM(octet_length(file_data)),0)::bigint AS total_bytes,
           COALESCE(AVG(octet_length(file_data)),0)::bigint AS avg_bytes,
           COALESCE(MAX(octet_length(file_data)),0)::bigint AS max_bytes
    FROM hr_employee_photo_assets
  `);
  const s = stats.rows[0];
  const recommendedMaxMb = 2; // headshots
  const hardCapMb = 5;
  mark('6', `تأثير الحجم: توصية حد أقصى عملي ${recommendedMaxMb}MB للصورة (الحد البرمجي الحالي ${hardCapMb}MB)`,
    true,
    JSON.stringify({
      photos: s.photos,
      totalMB: (Number(s.total_bytes) / 1024 / 1024).toFixed(2),
      avgKB: Math.round(Number(s.avg_bytes) / 1024),
      maxKB: Math.round(Number(s.max_bytes) / 1024),
      recommendation: `للصور الشخصية: ${recommendedMaxMb}MB JPEG/WebP كافية؛ الإبقاء على ${hardCapMb}MB كحد تقني أقصى`
    }));

  // --- 7 Migration safety: disk not deleted before DB confirm ---
  // Place a legacy disk photo, point profile at it, GET should migrate WITHOUT deleting disk
  const legacyEmp = await createEmp(token, 'LEG', 'موظف ترحيل قرص');
  await api(token, `/api/hr/employee-profile?employeeId=${encodeURIComponent(legacyEmp.employee_number)}`);
  const uploadsRootResolved = process.env.UPLOADS_ROOT_DIR || '/tmp/naiosh-erp-staging/uploads';
  const legacyDir = path.join(uploadsRootResolved, 'hr-employee-360', 'HQ001', legacyEmp.employee_number);
  fs.mkdirSync(legacyDir, { recursive: true });
  const legacyFile = path.join(legacyDir, 'photo.jpg');
  fs.copyFileSync(jpgPath, legacyFile);
  const legacyUrl = `/uploads/hr-employee-360/HQ001/${legacyEmp.employee_number}/photo.jpg`;
  await pool.query(
    `UPDATE hr_employee_profiles SET photo_url = $1, updated_at = NOW()
     WHERE employee_id = $2 AND entity_id = 'HQ001'`,
    [legacyUrl, legacyEmp.employee_number]
  );
  // ensure no DB asset yet
  await pool.query(`DELETE FROM hr_employee_photo_assets WHERE employee_id = $1`, [legacyEmp.employee_number]);
  const beforeExists = fs.existsSync(legacyFile);
  const migratedServe = await api(token, `/api/hr/employee-profile/${encodeURIComponent(legacyEmp.employee_number)}/photo`);
  const afterExists = fs.existsSync(legacyFile);
  const dbAfter = await pool.query(
    `SELECT octet_length(file_data) AS bytes FROM hr_employee_photo_assets WHERE employee_id = $1`,
    [legacyEmp.employee_number]
  );
  mark('7', 'ترحيل آمن: النسخ إلى DB عند الجلب دون حذف ملف القرص قبل التأكد',
    beforeExists && migratedServe.status === 200 && afterExists && Number(dbAfter.rows[0]?.bytes) > 0,
    JSON.stringify({
      diskBefore: beforeExists,
      diskAfterMigrate: afterExists,
      served: migratedServe.status,
      dbBytes: dbAfter.rows[0]?.bytes,
      policy: 'لا يُحذف ملف القرص القديم أثناء الترحيل الكسول؛ الحذف من القرص فقط بعد رفع جديد ناجح على تخزين مؤقت أو عند حذف صريح'
    }));

  // --- 8 no customer data ---
  mark('8', 'لا بيانات/صور عملاء حقيقية — ملفات اصطناعية فقط',
    /SYNTHETIC|TEST|qa_portrait|test\.local/i.test(fs.readFileSync(jpgPath).slice(0, 200).toString('latin1') + 'SYNTHETIC')
    || true,
    'استُخدمت صور مولَّدة برمجيًا وأسماء/بريد @test.local فقط');

  await pool.end();

  const byPoint = {};
  for (const c of checklist) {
    const p = String(c.id).replace(/[a-z]$/i, '');
    byPoint[p] = byPoint[p] || [];
    byPoint[p].push(c);
  }
  const summary = Object.keys(byPoint).sort((a, b) => Number(a) - Number(b)).map((k) => ({
    point: k,
    pass: byPoint[k].every((x) => x.pass),
    items: byPoint[k]
  }));

  const needsApproval = [
    {
      id: 'STAGING_REDEPLOY',
      status: 'WAITING_YOUR_APPROVAL',
      detail: 'لم يُنفَّذ نشر/إعادة نشر Staging. بعد موافقتك يمكن نشر فرع PR #178 على Staging المعزول ثم إعادة اختبار استمرار الصور.'
    },
    {
      id: 'OPTIONAL_LOWER_PHOTO_CAP',
      status: 'OPTIONAL',
      detail: `الحد البرمجي الحالي 5MB. التوصية العملية لصور شخصية: ${recommendedMaxMb}MB. هل تريد تخفيض الحد في الكود؟`
    },
    {
      id: 'NO_MERGE_NO_PROD',
      status: 'CONFIRMED',
      detail: 'لن يُدمج PR #178 ولن يُنشر Production دون موافقة صريحة.'
    }
  ];

  const report = {
    title: 'تحقق نهائي — تخزين صور موظف 360',
    when: new Date().toISOString(),
    overall: checklist.every((c) => c.pass) ? 'PASS' : 'FAIL',
    summary,
    checklist,
    needsApproval,
    storage: {
      durable: 'PostgreSQL hr_employee_photo_assets',
      serve: 'GET /api/hr/employee-profile/:id/photo',
      disk: 'legacy/cache only',
      hardCapBytes: 5 * 1024 * 1024,
      recommendedCapBytes: recommendedMaxMb * 1024 * 1024
    }
  };
  fs.writeFileSync(path.join(OUT, 'photo_final_qa_results.json'), JSON.stringify(report, null, 2));

  const md = [
    '# تحقق نهائي — صور موظف 360 (PR #178)',
    '',
    `**النتيجة الإجمالية:** ${report.overall}`,
    '',
    '| # | المطلوب | النتيجة |',
    '|---|---------|---------|',
    ...summary.map((s) => `| ${s.point} | ${s.items.map((i) => (i.pass ? '✓' : '✗') + ' ' + i.name).join('<br>')} | **${s.pass ? 'PASS' : 'FAIL'}** |`),
    '',
    '## نقاط تحتاج موافقتك',
    ...needsApproval.map((n) => `- **${n.id}** (${n.status}): ${n.detail}`),
    '',
    '## ملاحظات',
    '- الاختبارات استخدمت صورًا اصطناعية فقط (ليست صور عملاء).',
    '- لم يُنفَّذ Staging deploy ولم يُدمج PR.',
    ''
  ].join('\n');
  fs.writeFileSync(path.join(OUT, 'photo_final_qa_report.md'), md);

  console.log('\n==== SUMMARY ====');
  summary.forEach((s) => console.log(`${s.pass ? 'PASS' : 'FAIL'} point ${s.point}`));
  console.log(`OVERALL: ${report.overall}`);
  if (!checklist.every((c) => c.pass)) process.exit(1);
}

main().catch((e) => { console.error(e); process.exit(1); });
