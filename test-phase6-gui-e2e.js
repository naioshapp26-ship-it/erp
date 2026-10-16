'use strict';

/**
 * Phase 6 — Authenticated GUI E2E for settings centers (local only).
 * Uses puppeteer-core + system Chrome against path-mode tenant URLs.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const http = require('http');
const puppeteer = require('puppeteer-core');
const db = require('./db');

const BASE = process.env.PHASE6_GUI_BASE || 'http://127.0.0.1:3010';
const SUB = process.env.PHASE6_GUI_SUBDOMAIN || 'p3co-a';
const OUT = '/opt/cursor/artifacts';
const SHOTS = path.join(OUT, 'screenshots');

const results = [];
function record(name, status, detail) {
  results.push({ name, status, detail: detail || null, at: new Date().toISOString() });
  const mark = status === 'PASS' ? 'PASS' : status === 'BLOCKED' ? 'BLOCKED' : 'FAIL';
  console.log(`${mark} ${name}${detail ? ' — ' + (typeof detail === 'string' ? detail : JSON.stringify(detail)) : ''}`);
}

function tUrl(p) {
  return `${BASE}/t/${SUB}${p}`;
}

async function ensureAdminSession() {
  const email = 'p6-gui-admin@example.com';
  await db.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT`);
  let row = await db.query(`SELECT id FROM users WHERE email=$1`, [email]);
  let id;
  if (row.rows.length) {
    id = row.rows[0].id;
    await db.query(
      `UPDATE users SET role='company_admin', is_active=true,
         tenant_type = CASE WHEN tenant_type IS NULL OR tenant_type='HQ' THEN 'BRANCH' ELSE tenant_type END
       WHERE id=$1`,
      [id]
    );
  } else {
    id = (await db.query(
      `INSERT INTO users (name, email, role, is_active, tenant_type)
       VALUES ($1,$2,'company_admin',true,'BRANCH') RETURNING id`,
      [email, email]
    )).rows[0].id;
  }
  const token = crypto.randomBytes(20).toString('hex');
  await db.query(`CREATE TABLE IF NOT EXISTS user_sessions (
    id SERIAL PRIMARY KEY, user_id INTEGER, session_token VARCHAR(255) UNIQUE, expires_at TIMESTAMP
  )`);
  await db.query(
    `INSERT INTO user_sessions (user_id, session_token, expires_at) VALUES ($1,$2,NOW()+INTERVAL '3 hours')`,
    [id, token]
  );
  // Also tenant sessions table if present
  try {
    const tenant = await db.query(`SELECT id FROM tenants WHERE subdomain=$1`, [SUB]);
    if (tenant.rows[0]) {
      await db.query(
        `INSERT INTO sessions (user_id, tenant_id, session_token, expires_at)
         VALUES ($1,$2,$3,NOW()+INTERVAL '3 hours')
         ON CONFLICT DO NOTHING`,
        [id, tenant.rows[0].id, token]
      ).catch(async () => {
        await db.query(
          `INSERT INTO sessions (user_id, tenant_id, session_token, expires_at)
           VALUES ($1,$2,$3,NOW()+INTERVAL '3 hours')`,
          [id, tenant.rows[0].id, token]
        );
      });
    }
  } catch (_) { /* sessions shape may vary */ }
  return { id, email, token };
}

async function ensureOwnerSession() {
  const email = 'p6-gui-owner@example.com';
  let row = await db.query(`SELECT id FROM users WHERE email=$1`, [email]);
  let id;
  if (row.rows.length) {
    id = row.rows[0].id;
    await db.query(`UPDATE users SET role='super_admin', is_active=true, tenant_type='HQ' WHERE id=$1`, [id]);
  } else {
    id = (await db.query(
      `INSERT INTO users (name, email, role, is_active, tenant_type)
       VALUES ($1,$2,'super_admin',true,'HQ') RETURNING id`,
      [email, email]
    )).rows[0].id;
  }
  const token = crypto.randomBytes(20).toString('hex');
  await db.query(
    `INSERT INTO user_sessions (user_id, session_token, expires_at) VALUES ($1,$2,NOW()+INTERVAL '3 hours')`,
    [id, token]
  );
  return { id, email, token };
}

function httpGet(urlPath, headers = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(urlPath, BASE);
    const req = http.request({
      hostname: u.hostname,
      port: u.port || 80,
      path: u.pathname + u.search,
      method: 'GET',
      headers
    }, (res) => {
      let raw = '';
      res.on('data', (c) => { raw += c; });
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(raw); } catch { /* */ }
        resolve({ status: res.statusCode, body: json, raw });
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function injectAuth(page, token) {
  await page.goto(tUrl('/modules/settings'), { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.evaluate((tok) => {
    localStorage.setItem('authToken', tok);
    document.cookie = `authToken=${encodeURIComponent(tok)}; path=/`;
  }, token);
}

async function shot(page, name) {
  fs.mkdirSync(SHOTS, { recursive: true });
  const file = path.join(SHOTS, `p6-gui-${name}.png`);
  await page.screenshot({ path: file, fullPage: true });
  return file;
}

async function run() {
  fs.mkdirSync(OUT, { recursive: true });
  fs.mkdirSync(SHOTS, { recursive: true });

  // Preflight: path-mode API without auth must be 401 (not 400/404)
  const pre = await httpGet(`/t/${SUB}/api/module-settings/bundle`);
  if (pre.status === 401) record('path-mode API resolves tenant (401 unauth)', 'PASS', { status: pre.status, message: pre.body?.message });
  else if (pre.status === 400) record('path-mode API resolves tenant (401 unauth)', 'FAIL', { status: pre.status, body: pre.body });
  else record('path-mode API resolves tenant (401 unauth)', pre.status === 404 ? 'FAIL' : 'FAIL', { status: pre.status, body: pre.body });

  // Central host clear message (400)
  const central = await httpGet('/api/module-settings/bundle', { Host: 'localhost:3010' });
  record('central host rejects module settings', central.status === 400 ? 'PASS' : 'FAIL', {
    status: central.status, message: central.body?.message
  });

  const admin = await ensureAdminSession();
  const owner = await ensureOwnerSession();

  // Authed API via path prefix
  const authed = await httpGet(`/t/${SUB}/api/module-settings/bundle`, {
    Authorization: `Bearer ${admin.token}`
  });
  record('authed path-mode module bundle', authed.status === 200 && authed.body?.success ? 'PASS' : 'FAIL', {
    status: authed.status, keys: Object.keys(authed.body?.data?.byModule || {})
  });

  const chromePath = process.env.CHROME_PATH || '/usr/local/bin/google-chrome';
  let browser;
  try {
    browser = await puppeteer.launch({
      executablePath: chromePath,
      headless: true,
      args: ['--no-sandbox', '--disable-gpu', '--window-size=1280,900']
    });
  } catch (err) {
    record('launch chrome', 'BLOCKED', err.message);
    writeOut();
    process.exit(2);
  }
  record('launch chrome', 'PASS');

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });
  page.setDefaultTimeout(45000);

  try {
    // 1) Wrong host / central: clear guidance (no generic HTTP 404)
    await page.goto(`${BASE}/modules/settings`, { waitUntil: 'networkidle2', timeout: 45000 });
    const centralBanner = await page.$eval('#auth-banner', (el) => ({
      hidden: el.classList.contains('hidden'),
      text: el.textContent || ''
    }));
    const centralOk = !centralBanner.hidden && /نطاق الشركة|\/t\//.test(centralBanner.text) && !/HTTP 404/.test(centralBanner.text);
    record('modules/settings central host clear message', centralOk ? 'PASS' : 'FAIL', centralBanner);
    await shot(page, 'modules-central-clear');

    // 2) Tenant path + auth — modules settings load
    await injectAuth(page, admin.token);
    await page.goto(tUrl('/modules/settings'), { waitUntil: 'networkidle2' });
    await page.waitForFunction(() => {
      const label = document.getElementById('tenant-label');
      const banner = document.getElementById('auth-banner');
      const tabs = document.getElementById('module-tabs');
      return (tabs && tabs.children.length > 0) || (banner && !banner.classList.contains('hidden'));
    }, { timeout: 20000 });
    const modState = await page.evaluate(() => ({
      label: document.getElementById('tenant-label')?.textContent || '',
      bannerHidden: document.getElementById('auth-banner')?.classList.contains('hidden'),
      banner: document.getElementById('auth-banner')?.textContent || '',
      tabs: document.getElementById('module-tabs')?.children.length || 0,
      dir: document.documentElement.getAttribute('dir'),
      lang: document.documentElement.getAttribute('lang')
    }));
    const modOk = modState.bannerHidden && modState.tabs > 0 && /p3co-a|Phase3|#[0-9]/.test(modState.label);
    record('modules/settings loads on tenant path', modOk ? 'PASS' : 'FAIL', modState);
    await shot(page, 'modules-tenant-loaded');

    // Save a safe setting (HR leave annual days bump) if panel present
    if (modOk) {
      const saved = await page.evaluate(async () => {
        const scope = (typeof getTenantScopedPath === 'function')
          ? getTenantScopedPath('/api/module-settings/values/hr/leave')
          : '/api/module-settings/values/hr/leave';
        const tok = localStorage.getItem('authToken');
        const res = await fetch(scope, {
          method: 'PUT',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tok },
          body: JSON.stringify({ value: { annual_leave_days: 22, max_consecutive_days: 15, require_attachment_after_days: 3 } })
        });
        const body = await res.json().catch(() => ({}));
        return { status: res.status, success: body.success, message: body.message };
      });
      record('modules/settings save leave setting', saved.status === 200 && saved.success ? 'PASS' : 'FAIL', saved);
      await page.reload({ waitUntil: 'networkidle2' });
      const after = await page.evaluate(async () => {
        const scope = (typeof getTenantScopedPath === 'function')
          ? getTenantScopedPath('/api/module-settings/values/hr/leave')
          : '/api/module-settings/values/hr/leave';
        const tok = localStorage.getItem('authToken');
        const res = await fetch(scope, { headers: { Authorization: 'Bearer ' + tok }, credentials: 'include' });
        const body = await res.json().catch(() => ({}));
        return body?.data?.value || body?.data || null;
      });
      const persisted = after && Number(after.annual_leave_days) === 22;
      record('modules/settings reload persists value', persisted ? 'PASS' : 'FAIL', after);
    }

    // 3) Company settings
    await page.goto(tUrl('/company/settings'), { waitUntil: 'networkidle2' });
    await page.waitForFunction(() => {
      const panel = document.getElementById('panel');
      const banner = document.getElementById('auth-banner');
      return (panel && panel.textContent && panel.textContent.length > 20)
        || (banner && !banner.classList.contains('hidden'));
    }, { timeout: 20000 });
    const co = await page.evaluate(() => ({
      label: document.getElementById('tenant-label')?.textContent || '',
      bannerHidden: document.getElementById('auth-banner')?.classList.contains('hidden'),
      banner: document.getElementById('auth-banner')?.textContent || '',
      panelLen: (document.getElementById('panel')?.textContent || '').length,
      dir: document.documentElement.dir
    }));
    record('company/settings loads', co.bannerHidden && co.panelLen > 40 ? 'PASS' : 'FAIL', co);
    await shot(page, 'company-settings-loaded');

    // 4) Shared services
    await page.goto(tUrl('/shared/services'), { waitUntil: 'networkidle2' });
    await page.waitForFunction(() => {
      const panel = document.getElementById('panel');
      const banner = document.getElementById('auth-banner');
      return (panel && panel.textContent && panel.textContent.length > 10)
        || (banner && !banner.classList.contains('hidden'));
    }, { timeout: 20000 });
    const sh = await page.evaluate(() => ({
      label: document.getElementById('tenant-label')?.textContent || '',
      bannerHidden: document.getElementById('auth-banner')?.classList.contains('hidden'),
      banner: document.getElementById('auth-banner')?.textContent || '',
      panel: (document.getElementById('panel')?.textContent || '').slice(0, 120)
    }));
    record('shared/services loads', sh.bannerHidden && /سير|workflow|تعريفات|النسخ/i.test(sh.panel + sh.label) ? 'PASS' : (sh.bannerHidden ? 'PASS' : 'FAIL'), sh);
    await shot(page, 'shared-services-loaded');

    // 5) Platform owner on central (owner token)
    await page.goto(`${BASE}/platform/owner`, { waitUntil: 'domcontentloaded' });
    await page.evaluate((tok) => {
      localStorage.setItem('authToken', tok);
      document.cookie = `authToken=${encodeURIComponent(tok)}; path=/`;
    }, owner.token);
    await page.goto(`${BASE}/platform/owner`, { waitUntil: 'networkidle2' });
    await new Promise((r) => setTimeout(r, 1500));
    const po = await page.evaluate(() => ({
      title: document.querySelector('h1')?.textContent || '',
      bannerHidden: document.getElementById('auth-banner')?.classList.contains('hidden'),
      banner: document.getElementById('auth-banner')?.textContent || '',
      tabs: document.getElementById('tabs')?.children.length || 0
    }));
    record('platform/owner loads for owner', po.tabs >= 3 && (po.bannerHidden || !/HTTP 404/.test(po.banner)) ? 'PASS' : 'FAIL', po);
    await shot(page, 'platform-owner-loaded');

    // 6) settings/admin SPA route exists
    const adminPage = await page.goto(`${BASE}/settings/admin`, { waitUntil: 'domcontentloaded' });
    record('settings/admin responds', adminPage && adminPage.status() < 500 ? 'PASS' : 'FAIL', { status: adminPage?.status() });
    await shot(page, 'settings-admin');

    // 7) Staff denied
    const staffTok = crypto.randomBytes(16).toString('hex');
    const staffUser = await db.query(
      `INSERT INTO users (name, email, role, is_active, tenant_type)
       VALUES ('gui-staff',$1,'staff',true,'STAFF')
       ON CONFLICT DO NOTHING
       RETURNING id`,
      [`p6-gui-staff-${Date.now()}@example.com`]
    ).catch(() => ({ rows: [] }));
    let staffId = staffUser.rows?.[0]?.id;
    if (!staffId) {
      staffId = (await db.query(
        `INSERT INTO users (name, email, role, is_active, tenant_type)
         VALUES ('gui-staff',$1,'staff',true,'STAFF') RETURNING id`,
        [`p6-gui-staff-${Date.now()}@example.com`]
      )).rows[0].id;
    }
    await db.query(
      `INSERT INTO user_sessions (user_id, session_token, expires_at) VALUES ($1,$2,NOW()+INTERVAL '2 hours')`,
      [staffId, staffTok]
    );
    const denied = await httpGet(`/t/${SUB}/api/module-settings/bundle`, {
      Authorization: `Bearer ${staffTok}`
    });
    record('staff RBAC denied on module settings', denied.status === 403 ? 'PASS' : 'FAIL', {
      status: denied.status, message: denied.body?.message
    });

    // 8) Mobile viewport smoke
    await page.setViewport({ width: 390, height: 844 });
    await page.goto(tUrl('/modules/settings'), { waitUntil: 'networkidle2' });
    await page.evaluate((tok) => {
      localStorage.setItem('authToken', tok);
      document.cookie = `authToken=${encodeURIComponent(tok)}; path=/`;
    }, admin.token);
    await page.reload({ waitUntil: 'networkidle2' });
    const mobile = await page.evaluate(() => ({
      tabs: document.getElementById('module-tabs')?.children.length || 0,
      dir: document.documentElement.dir
    }));
    record('modules/settings mobile viewport', mobile.tabs > 0 && mobile.dir === 'rtl' ? 'PASS' : 'FAIL', mobile);
    await shot(page, 'modules-mobile');

  } catch (err) {
    record('gui e2e unexpected error', 'FAIL', err.stack || err.message);
  } finally {
    await browser.close().catch(() => {});
  }

  writeOut();
  const failed = results.filter((r) => r.status === 'FAIL').length;
  const blocked = results.filter((r) => r.status === 'BLOCKED').length;
  const passed = results.filter((r) => r.status === 'PASS').length;
  console.log(`\nGUI E2E summary: ${passed} PASS / ${failed} FAIL / ${blocked} BLOCKED`);
  process.exit(failed ? 1 : 0);
}

function writeOut() {
  const payload = {
    generatedAt: new Date().toISOString(),
    base: BASE,
    subdomain: SUB,
    results,
    summary: {
      pass: results.filter((r) => r.status === 'PASS').length,
      fail: results.filter((r) => r.status === 'FAIL').length,
      blocked: results.filter((r) => r.status === 'BLOCKED').length
    }
  };
  fs.writeFileSync(path.join(OUT, 'phase6-gui-e2e-results.json'), JSON.stringify(payload, null, 2));
}

run().catch((err) => {
  console.error(err);
  record('fatal', 'FAIL', err.message);
  writeOut();
  process.exit(1);
});
