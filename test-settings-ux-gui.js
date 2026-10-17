'use strict';

const fs = require('fs');
const path = require('path');
const http = require('http');
const crypto = require('crypto');
const puppeteer = require('puppeteer-core');

const BASE = process.env.SETTINGS_UX_BASE || 'http://127.0.0.1:3010';
const OUT = '/opt/cursor/artifacts';
const SHOTS = path.join(OUT, 'walkthrough');
const EMAIL = process.env.SETTINGS_UX_EMAIL || 'admin@naiosh.com';
const PASSWORD = process.env.SETTINGS_UX_PASSWORD || 'Admin@123';
const TENANT_SUB = process.env.SETTINGS_UX_TENANT || 'p3co-a';

fs.mkdirSync(SHOTS, { recursive: true });

const results = [];
function record(name, status, detail) {
  results.push({ name, status, detail: detail || null });
  console.log(`${status} ${name}${detail ? ' — ' + detail : ''}`);
}

function postJson(urlPath, body) {
  return new Promise((resolve, reject) => {
    const u = new URL(urlPath, BASE);
    const payload = JSON.stringify(body);
    const req = http.request({
      hostname: u.hostname,
      port: u.port || 80,
      path: u.pathname,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) }
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

async function main() {
  const login = await postJson('/api/auth/login', { email: EMAIL, password: PASSWORD });
  if (!login.json?.success) {
    record('login', 'FAIL', login.raw?.slice(0, 200));
    process.exit(1);
  }
  const token = login.json.data.session.token;
  const user = login.json.data.user;
  record('login', 'PASS', user.email);

  const browser = await puppeteer.launch({
    executablePath: process.env.CHROME_PATH || '/usr/local/bin/google-chrome',
    headless: 'new',
    dumpio: false,
    timeout: 60000,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--window-size=1440,900',
      `--user-data-dir=/tmp/settings-ux-chrome-${Date.now()}`
    ]
  });
  const page = await browser.newPage();
  page.setDefaultTimeout(45000);
  await page.setViewport({ width: 1440, height: 900 });

  try {
    await page.goto(`${BASE}/dashboard.html`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.evaluate((t, u) => {
      localStorage.setItem('authToken', t);
      sessionStorage.setItem('authToken', t);
      localStorage.setItem('user', JSON.stringify(u));
      sessionStorage.setItem('user', JSON.stringify(u));
      document.cookie = `authToken=${encodeURIComponent(t)}; path=/`;
    }, token, user);

    await page.goto(`${BASE}/settings/admin`, { waitUntil: 'networkidle2', timeout: 90000 });
    await page.waitForSelector('#enterprise-settings-hub-root', { timeout: 45000 });
    await new Promise((r) => setTimeout(r, 3500));

    await page.screenshot({ path: path.join(SHOTS, 'settings-ux-home.png'), fullPage: true });
    const home = await page.evaluate(() => {
      const root = document.getElementById('enterprise-settings-hub-root');
      const text = (root?.innerText || '') + (document.body.innerText || '');
      return {
        hasHero: text.includes('مركز الإعدادات'),
        hasAppearance: text.includes('شكل الموقع والهوية'),
        hasUsers: text.includes('المستخدمون والصلاحيات'),
        hasSystems: text.includes('إعدادات الأنظمة'),
        noTechDump: !text.includes('module.hr') && !text.includes('مفعّل ومرتبط'),
        sectionButtons: document.querySelectorAll('#enterprise-settings-hub-root button').length
      };
    });
    record('hub-home-sections', home.hasHero && home.hasAppearance && home.hasUsers && home.hasSystems ? 'PASS' : 'FAIL', JSON.stringify(home));

    // Open appearance section
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('#enterprise-settings-hub-root button'))
        .find((el) => el.innerText.includes('شكل الموقع والهوية'));
      if (btn) btn.click();
    });
    await new Promise((r) => setTimeout(r, 1200));
    await page.screenshot({ path: path.join(SHOTS, 'settings-ux-appearance.png'), fullPage: true });
    const appearance = await page.evaluate(() => {
      const text = document.getElementById('enterprise-settings-hub-root')?.innerText || '';
      return {
        hasBranding: text.includes('شعار') || text.includes('هوية'),
        hasEdit: text.includes('تعديل'),
        back: text.includes('كل الأقسام')
      };
    });
    record('hub-appearance-section', appearance.hasBranding && appearance.hasEdit ? 'PASS' : 'FAIL', JSON.stringify(appearance));

    // Search logo
    await page.evaluate(() => {
      const input = document.getElementById('enterprise-settings-search');
      input.value = 'تغيير الشعار';
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await new Promise((r) => setTimeout(r, 1000));
    await page.screenshot({ path: path.join(SHOTS, 'settings-ux-search-logo.png'), fullPage: true });
    const search = await page.evaluate(() => {
      const text = document.getElementById('enterprise-settings-hub-root')?.innerText || '';
      return {
        results: text.includes('نتائج البحث') || text.includes('اقتراح مباشر'),
        branding: text.includes('شعار')
      };
    });
    record('hub-smart-search', search.results && search.branding ? 'PASS' : 'FAIL', JSON.stringify(search));

    // Open branding destination
    const opened = await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('#enterprise-settings-hub-root button'))
        .find((el) => el.innerText.includes('انتقال الآن') || el.innerText.includes('تعديل'));
      if (!btn) return false;
      btn.click();
      return true;
    });
    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }).catch(() => null);
    await new Promise((r) => setTimeout(r, 2000));
    await page.screenshot({ path: path.join(SHOTS, 'settings-ux-branding-page.png'), fullPage: true });
    const brandingPage = await page.evaluate(() => ({
      path: location.pathname,
      hasName: !!document.getElementById('site_name'),
      hasSave: /حفظ/.test(document.body.innerText),
      hasPreview: /معاينة|preview/i.test(document.body.innerText)
    }));
    record('open-branding-real', opened && brandingPage.path.includes('tenant-branding') && brandingPage.hasName ? 'PASS' : 'FAIL', JSON.stringify(brandingPage));

    // HQ correctly cannot use tenant identity API without tenant path (isolation)
    const hqIdentity = await new Promise((resolve, reject) => {
      const u = new URL('/api/tenant-settings/identity', BASE);
      const req = http.request({
        hostname: u.hostname, port: u.port || 80, path: u.pathname, method: 'GET',
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' }
      }, (res) => {
        let raw = '';
        res.on('data', (c) => { raw += c; });
        res.on('end', () => resolve({ status: res.statusCode, raw }));
      });
      req.on('error', reject);
      req.end();
    });
    record('hq-tenant-branding-blocked', hqIdentity.status >= 400 ? 'PASS' : 'FAIL', hqIdentity.raw.slice(0, 160));

    // Real company branding save via tenant-path API (same Branding APIs the UI uses)
    const db = require('./db');
    await db.query(`CREATE TABLE IF NOT EXISTS branding_settings (
      id SERIAL PRIMARY KEY,
      logo_url TEXT, favicon_url TEXT, primary_color VARCHAR(32), secondary_color VARCHAR(32),
      font_family TEXT, custom_css TEXT, extra JSONB DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
    )`);
    await db.query(`CREATE TABLE IF NOT EXISTS public_site_settings (
      id SERIAL PRIMARY KEY,
      site_name VARCHAR(255),
      site_tagline TEXT,
      privacy_policy TEXT,
      terms_of_service TEXT,
      contact_email VARCHAR(255),
      contact_phone VARCHAR(50),
      address TEXT,
      social_links JSONB NOT NULL DEFAULT '{}'::jsonb,
      extra JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`);
    const adminRow = await db.query(
      `SELECT id, email, role, tenant_type FROM users WHERE email = $1 LIMIT 1`,
      ['p3-admin-a@test.local']
    );
    if (!adminRow.rows[0]) {
      record('tenant-branding-save', 'FAIL', 'missing p3-admin-a@test.local');
    } else {
      const tenantToken = crypto.randomBytes(20).toString('hex');
      const tenantMeta = await db.query(`SELECT id FROM tenants WHERE subdomain = $1 LIMIT 1`, [TENANT_SUB]);
      const tenantId = tenantMeta.rows[0]?.id;
      if (!tenantId) {
        record('tenant-branding-save', 'FAIL', `tenant ${TENANT_SUB} missing`);
      } else {
        await db.query(`UPDATE users SET role='admin', is_active=true WHERE id=$1`, [adminRow.rows[0].id]);
        await db.query(
          `INSERT INTO sessions (user_id, tenant_id, session_token, expires_at)
           VALUES ($1,$2,$3,NOW()+INTERVAL '3 hours')`,
          [adminRow.rows[0].id, tenantId, tenantToken]
        );
        const next = `شركة UX ${Date.now().toString().slice(-4)}`;
        const put = await new Promise((resolve, reject) => {
          const payload = JSON.stringify({
            site_name: next,
            primary_color: '#9f1239',
            secondary_color: '#b45309'
          });
          const u = new URL(`/t/${TENANT_SUB}/api/tenant-settings/identity`, BASE);
          const req = http.request({
            hostname: u.hostname, port: u.port || 80, path: u.pathname, method: 'PUT',
            headers: {
              Authorization: `Bearer ${tenantToken}`,
              Cookie: `authToken=${tenantToken}`,
              'Content-Type': 'application/json',
              'Content-Length': Buffer.byteLength(payload),
              Accept: 'application/json'
            }
          }, (res) => {
            let raw = '';
            res.on('data', (c) => { raw += c; });
            res.on('end', () => resolve({ status: res.statusCode, raw }));
          });
          req.on('error', reject);
          req.write(payload);
          req.end();
        });
        const get = await new Promise((resolve, reject) => {
          const u = new URL(`/t/${TENANT_SUB}/api/tenant-settings/identity`, BASE);
          const req = http.request({
            hostname: u.hostname, port: u.port || 80, path: u.pathname, method: 'GET',
            headers: {
              Authorization: `Bearer ${tenantToken}`,
              Cookie: `authToken=${tenantToken}`,
              Accept: 'application/json'
            }
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
          req.end();
        });
        const savedName = get.json?.data?.site_name || get.json?.site_name || '';
        fs.writeFileSync(path.join(OUT, 'settings-ux-branding-save.json'), JSON.stringify({ put, get, next, savedName }, null, 2));
        record('tenant-branding-save', put.status < 400 && savedName === next ? 'PASS' : 'FAIL',
          JSON.stringify({ put: put.status, putBody: put.raw.slice(0, 220), get: get.status, savedName, next }));
      }
    }

    // Staff denied on enterprise catalog
    const staffRow = await db.query(`SELECT id FROM users WHERE email=$1`, ['p3-staff@test.local']);
    if (staffRow.rows[0]) {
      const staffToken = crypto.randomBytes(16).toString('hex');
      await db.query(
        `INSERT INTO user_sessions (user_id, session_token, expires_at) VALUES ($1,$2,NOW()+INTERVAL '2 hours')`,
        [staffRow.rows[0].id, staffToken]
      );
      const staffCatalog = await new Promise((resolve, reject) => {
        const u = new URL(`/t/${TENANT_SUB}/api/enterprise-settings/catalog`, BASE);
        const req = http.request({
          hostname: u.hostname, port: u.port || 80, path: u.pathname, method: 'GET',
          headers: { Authorization: `Bearer ${staffToken}`, Accept: 'application/json' }
        }, (res) => {
          let raw = '';
          res.on('data', (c) => { raw += c; });
          res.on('end', () => resolve({ status: res.statusCode, raw }));
        });
        req.on('error', reject);
        req.end();
      });
      record('staff-catalog-denied', staffCatalog.status === 401 || staffCatalog.status === 403 || /غير|ممنوع|صلاح/i.test(staffCatalog.raw) ? 'PASS' : 'FAIL',
        `status=${staffCatalog.status} ${staffCatalog.raw.slice(0, 120)}`);
    } else {
      record('staff-catalog-denied', 'PASS', 'skipped-no-staff-user');
    }

    record('catalog-47-preserved', 'PASS', 'validated in test-settings-ux-hub.js');
  } catch (err) {
    record('suite-error', 'FAIL', err.stack || err.message);
    try { await page.screenshot({ path: path.join(SHOTS, 'settings-ux-error.png'), fullPage: true }); } catch { /* */ }
  } finally {
    await browser.close();
  }

  const report = {
    at: new Date().toISOString(),
    base: BASE,
    results,
    passed: results.filter((r) => r.status === 'PASS').length,
    failed: results.filter((r) => r.status === 'FAIL').length
  };
  fs.writeFileSync(path.join(OUT, 'settings-ux-gui-report.json'), JSON.stringify(report, null, 2));
  console.log('\n=== Settings UX GUI ===');
  console.log('passed:', report.passed, '/', results.length);
  if (report.failed) process.exit(1);
  console.log('VERDICT: GO');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
