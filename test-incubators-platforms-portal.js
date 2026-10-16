'use strict';
/**
 * Incubators & Business Platforms portal — route, menu, permissions, regression smoke.
 * Does not mutate Branches / Nurseries / Platforms / E-Library systems.
 */
const fs = require('fs');
const path = require('path');
const http = require('http');
const { getPageKeysForPath, isPathAllowed } = require('./page-permissions-registry');

const BASE = process.env.IPP_BASE || 'http://127.0.0.1:3010';
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
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body }));
    });
    req.on('error', reject);
    req.setTimeout(15000, () => { req.destroy(new Error('timeout')); });
  });
}

async function main() {
  const html = fs.readFileSync(path.join(__dirname, 'incubators-platforms.html'), 'utf8');
  ok('html-title', /<title>\s*حاضنات و منصات اعمال\s*<\/title>/.test(html));
  ok('html-h1', /<h1>\s*حاضنات و منصات اعمال\s*<\/h1>/.test(html));
  ok('html-subtitle', html.includes('منظومة متكاملة لدعم التعليم والابتكار وإدارة الفروع والمنصات'));
  ok('html-brand', html.includes('NAIOSH ERP 360'));
  ok('html-footer', html.includes('نصنع بيئة تعليمية مبتكرة'));
  ok('html-rtl', /dir="rtl"/.test(html) && /lang="ar"/.test(html));
  ok('html-order-branches-first', /data-module="branches"[\s\S]*data-module="nurseries"[\s\S]*data-module="platforms"[\s\S]*data-module="elibrary"/.test(html));
  ok('html-links', html.includes('data-href="/branches"') && html.includes('data-href="/incubators-hub"') && html.includes('data-href="/platforms"') && html.includes('data-href="/e-offices"'));
  ok('html-labels', html.includes('الفروع') && html.includes('الحضانات') && html.includes('المنصات') && html.includes('المكتبة الإلكترونية'));
  ok('html-en', html.includes('Branches') && html.includes('Nurseries') && html.includes('Platforms') && html.includes('E-Library'));
  ok('html-no-navy', !/#0[0-2][0-9a-f]{4}/i.test(html));
  ok('html-tenant-client', html.includes('tenant-path-client.js'));

  for (const icon of ['icon-branches.png', 'icon-nurseries.png', 'icon-platforms.png', 'icon-elibrary.png', 'header-icon.png', 'bg-stage.jpg']) {
    const p = path.join(__dirname, 'public/incubators-platforms', icon);
    ok('asset-' + icon, fs.existsSync(p) && fs.statSync(p).size > 1000, String(fs.existsSync(p) ? fs.statSync(p).size : 0));
  }

  const script = fs.readFileSync(path.join(__dirname, 'script.js'), 'utf8');
  ok('menu-has-portal', script.includes("'incubators-platforms'") && script.includes('حاضنات و منصات اعمال'));
  // Hubs must stay out of the shared global items list (module-scoped IPP_MODULE_NAV is OK)
  ok('menu-hides-e-offices-top', !/const items = \[[\s\S]*?id:\s*'e-offices',\s*icon:\s*'fa-building'[\s\S]*?\];\s*\n\s*items\.forEach/.test(script)
    && !/scopedIppItems \|\| \[[\s\S]*?id:\s*'e-offices',\s*icon:\s*'fa-building'/.test(script));
  ok('menu-hides-platforms-top', !/scopedIppItems \|\| \[[\s\S]*?id:\s*'platforms',\s*icon:\s*'fa-layer-group'/.test(script));
  ok('menu-hides-branches-top', !/scopedIppItems \|\| \[[\s\S]*?id:\s*'branches-hub',\s*icon:\s*'fa-code-branch'/.test(script));
  ok('menu-hides-incubators-top', !/scopedIppItems \|\| \[[\s\S]*?id:\s*'incubators-hub',\s*icon:\s*'fa-seedling'/.test(script));
  ok('menu-module-aware', script.includes('IPP_MODULE_NAV') && script.includes('getActiveIppModuleKey') && script.includes('buildIppScopedSidebarItems'));
  ok('menu-portal-back', script.includes('العودة إلى حاضنات و منصات اعمال'));
  ok('external-route', /'incubators-platforms'\s*:\s*'\/incubators-platforms'/.test(script));
  ok('smart-mgmt-untouched', script.includes('الإدارة الذكية 360') && /'smart-management'\s*:\s*'\/smart-management'/.test(script));

  const serverSrc = fs.readFileSync(path.join(__dirname, 'server.js'), 'utf8');
  ok('server-route', serverSrc.includes("app.get('/incubators-platforms'") && serverSrc.includes('serveIncubatorsPlatforms'));

  const keys = getPageKeysForPath('/incubators-platforms');
  ok('perm-keys', Array.isArray(keys) && keys.includes('branches-hub') && keys.includes('e-offices'), JSON.stringify(keys));
  ok('perm-allow-branches', isPathAllowed('/incubators-platforms', { tenantType: 'TENANT', allowedPages: ['branches-hub'] }));
  ok('perm-allow-platforms', isPathAllowed('/incubators-platforms', { tenantType: 'TENANT', allowedPages: ['platforms'] }));
  ok('perm-deny-none', !isPathAllowed('/incubators-platforms', { tenantType: 'TENANT', allowedPages: ['dashboard'] }));
  ok('perm-hq', isPathAllowed('/incubators-platforms', { tenantType: 'HQ', allowedPages: [] }));
  ok('perm-branches-intact', getPageKeysForPath('/branches').includes('branches-hub'));
  ok('perm-incubators-intact', getPageKeysForPath('/incubators-hub').includes('incubators-hub'));
  ok('perm-platforms-intact', getPageKeysForPath('/platforms').includes('platforms'));
  ok('perm-eoffices-intact', getPageKeysForPath('/e-offices').includes('e-offices'));

  try {
    const portal = await get('/incubators-platforms');
    ok('http-portal', portal.status === 200 || portal.status === 302, 'status=' + portal.status);
    if (portal.status === 302) {
      ok('http-portal-auth', /login/i.test(portal.headers.location || ''), portal.headers.location || '');
    } else {
      ok('http-portal-body', portal.body.includes('حاضنات و منصات اعمال'));
    }
    for (const p of ['/branches', '/incubators-hub', '/platforms', '/e-offices']) {
      const r = await get(p);
      ok('http-intact-' + p, r.status === 200 || r.status === 302, 'status=' + r.status);
    }
    for (const icon of ['icon-branches.png', 'icon-nurseries.png', 'icon-platforms.png', 'icon-elibrary.png']) {
      const r = await get('/public/incubators-platforms/' + icon);
      ok('http-' + icon, r.status === 200, 'status=' + r.status);
    }
  } catch (err) {
    ok('http-suite', false, err.message);
  }

  const failed = results.filter((r) => !r.pass);
  console.log('\n=== Incubators Platforms Portal Smoke ===');
  console.log('passed:', results.length - failed.length, '/', results.length);
  if (failed.length) {
    failed.forEach((f) => console.log(' -', f.name, f.detail));
    process.exit(1);
  }
  console.log('VERDICT: GO');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
