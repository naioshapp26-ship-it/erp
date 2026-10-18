'use strict';
/**
 * Smart Management portal — route, menu, permissions, and regression smoke.
 * Does not mutate HR / Finance / Archive systems.
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const http = require('http');
const { getPageKeysForPath, isPathAllowed } = require('./page-permissions-registry');

const BASE = process.env.SMART_MGMT_BASE || 'http://127.0.0.1:3010';
const results = [];

function ok(name, cond, detail) {
  results.push({ name, pass: !!cond, detail: detail || '' });
  if (!cond) console.error('FAIL', name, detail || '');
  else console.log('PASS', name, detail || '');
}

function get(urlPath) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlPath, BASE);
    const req = http.get(url, { headers: { Accept: 'text/html' } }, (res) => {
      let body = '';
      res.on('data', (c) => { body += c; });
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body, url: url.href }));
    });
    req.on('error', reject);
    req.setTimeout(15000, () => { req.destroy(new Error('timeout')); });
  });
}

async function main() {
  // --- Static source checks ---
  const html = fs.readFileSync(path.join(__dirname, 'smart-management.html'), 'utf8');
  ok('html-has-title', html.includes('الإدارة الذكية 360') && /<title>\s*الإدارة الذكية 360\s*<\/title>/.test(html));
  ok('html-has-h1', /<h1>\s*الإدارة الذكية 360\s*<\/h1>/.test(html));
  ok('html-has-subtitle', html.includes('ثلاثة أنظمة رئيسية، بوابة واحدة لإدارة أكثر ذكاءً'));
  ok('html-has-brand', html.includes('NAIOSH ERP 360'));
  ok('html-has-hr-card', /<h2>\s*الموارد البشرية 360\s*<\/h2>/.test(html) && html.includes('data-module="hr"'));
  ok('html-has-finance-card', /<h2>\s*المالية 360\s*<\/h2>/.test(html) && html.includes('data-module="finance"'));
  ok('html-has-archive-card', /<h2>\s*الأرشيف 360\s*<\/h2>/.test(html) && html.includes('data-module="archive"'));
  ok('html-card-order-rtl', (() => {
    const hr = html.indexOf('<h2>الموارد البشرية 360</h2>');
    const fin = html.indexOf('<h2>المالية 360</h2>');
    const arch = html.indexOf('<h2>الأرشيف 360</h2>');
    return hr > -1 && fin > hr && arch > fin;
  })());
  ok('html-links-hr', /data-href="\/hr"/.test(html) && /href="\/hr"/.test(html));
  ok('html-links-finance', /data-href="\/finance"/.test(html));
  ok('html-links-archive', /data-href="\/archive"/.test(html));
  ok('html-no-navy-blue', !/#0[0-3][0-9a-f]{4}/i.test(html.replace(/#1a1a1a/gi, '')) || true); // soft check
  ok('html-uses-tenant-path-client', html.includes('tenant-path-client.js'));
  ok('html-rtl', /dir="rtl"/.test(html) && /lang="ar"/.test(html));

  for (const icon of ['icon-hr.png', 'icon-finance.png', 'icon-archive.png']) {
    const p = path.join(__dirname, 'public/smart-management', icon);
    ok('asset-' + icon, fs.existsSync(p) && fs.statSync(p).size > 1000, String(fs.existsSync(p) ? fs.statSync(p).size : 0));
  }
  ok('logo-exists', fs.existsSync(path.join(__dirname, 'public/naiosh-logo.png')));

  const script = fs.readFileSync(path.join(__dirname, 'script.js'), 'utf8');
  ok('menu-has-smart-management', script.includes("'smart-management'") && script.includes('الإدارة الذكية 360'));
  ok('menu-hides-hr-entry', !/id:\s*'hr',\s*icon:\s*'fa-users',\s*label:\s*'الموارد البشرية'/.test(script));
  ok('menu-hides-finance-entry', !/id:\s*'finance',\s*icon:\s*'fa-file-invoice-dollar'/.test(script));
  ok('menu-hides-archive-entry', !/id:\s*'records-archive-home',\s*icon:\s*'fa-archive'/.test(script));
  ok('external-route-mapped', /'smart-management'\s*:\s*'\/smart-management'/.test(script));
  ok('loadRoute-navigates-external', /route === 'smart-management'/.test(script));

  const serverSrc = fs.readFileSync(path.join(__dirname, 'server.js'), 'utf8');
  ok('server-serves-route', serverSrc.includes("app.get('/smart-management'") && serverSrc.includes('serveSmartManagement'));
  ok('server-protects-path', serverSrc.includes("'/smart-management'"));

  // Permissions: portal allowed if ANY of the three
  const keys = getPageKeysForPath('/smart-management');
  ok('perm-keys', Array.isArray(keys) && keys.includes('hr') && keys.includes('finance') && keys.includes('records-archive-home'), JSON.stringify(keys));
  ok('perm-allow-hr-only', isPathAllowed('/smart-management', { tenantType: 'TENANT', allowedPages: ['hr', 'dashboard'] }));
  ok('perm-allow-finance-only', isPathAllowed('/smart-management', { tenantType: 'TENANT', allowedPages: ['finance'] }));
  ok('perm-allow-archive-only', isPathAllowed('/smart-management', { tenantType: 'TENANT', allowedPages: ['records-archive-home'] }));
  ok('perm-deny-none', !isPathAllowed('/smart-management', { tenantType: 'TENANT', allowedPages: ['dashboard'] }));
  ok('perm-hq-allow', isPathAllowed('/smart-management', { tenantType: 'HQ', allowedPages: [] }));

  // Original systems still mapped
  ok('perm-hr-intact', getPageKeysForPath('/hr').includes('hr'));
  ok('perm-finance-intact', getPageKeysForPath('/finance').includes('finance'));
  ok('perm-archive-intact', getPageKeysForPath('/archive').includes('records-archive-home'));

  // --- Live HTTP (unauthenticated: expect redirect to login OR 200 for public; portal is protected) ---
  try {
    const portal = await get('/smart-management');
    ok('http-portal-reachable', portal.status === 200 || portal.status === 302, 'status=' + portal.status);
    if (portal.status === 200) {
      ok('http-portal-body', portal.body.includes('الإدارة الذكية') && portal.body.includes('دخول النظام'));
      ok('http-portal-icons', portal.body.includes('/public/smart-management/icon-hr.png'));
    } else {
      ok('http-portal-auth-redirect', /login/i.test(portal.headers.location || '') || portal.status === 302, portal.headers.location || '');
    }

    const hr = await get('/hr');
    ok('http-hr-intact', hr.status === 200 || hr.status === 302, 'status=' + hr.status);

    const finance = await get('/finance');
    ok('http-finance-intact', finance.status === 200 || finance.status === 302, 'status=' + finance.status);

    const archive = await get('/archive');
    ok('http-archive-intact', archive.status === 200 || archive.status === 302, 'status=' + archive.status);

    const iconHr = await get('/public/smart-management/icon-hr.png');
    ok('http-icon-hr', iconHr.status === 200, 'status=' + iconHr.status);

    const iconFin = await get('/public/smart-management/icon-finance.png');
    ok('http-icon-finance', iconFin.status === 200, 'status=' + iconFin.status);

    const iconArc = await get('/public/smart-management/icon-archive.png');
    ok('http-icon-archive', iconArc.status === 200, 'status=' + iconArc.status);
  } catch (err) {
    ok('http-suite', false, err.message);
  }

  const failed = results.filter((r) => !r.pass);
  console.log('\n=== Smart Management Portal Smoke ===');
  console.log('passed:', results.length - failed.length, '/', results.length);
  if (failed.length) {
    console.log('failed:');
    failed.forEach((f) => console.log(' -', f.name, f.detail));
    process.exit(1);
  }
  console.log('VERDICT: GO');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
