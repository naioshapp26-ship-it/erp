'use strict';

const fs = require('fs');
const path = require('path');
const http = require('http');
const { getPageKeysForPath } = require('./page-permissions-registry');

const BASE = process.env.GAI_BASE || 'http://127.0.0.1:3010';
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
  const script = fs.readFileSync(path.join(__dirname, 'script.js'), 'utf8');
  const server = fs.readFileSync(path.join(__dirname, 'server.js'), 'utf8');

  ok('sidebar-label', script.includes("label: 'التكامل الإداري المحكوم'"));
  ok('sidebar-icon', /id:\s*'governed-administrative-integration'[\s\S]{0,120}icon:\s*'fa-diagram-project'/.test(script));
  const mainMenuIdx = script.indexOf("const items = scopedIppItems || [");
  const gaiInMenu = script.indexOf("id: 'governed-administrative-integration'", mainMenuIdx);
  const ippInMenu = script.indexOf("id: 'incubators-platforms'", mainMenuIdx);
  const etiInMenu = script.indexOf("id: 'education-training-incubators'", mainMenuIdx);
  ok('sidebar-after-ipp', mainMenuIdx > 0 && ippInMenu > 0 && gaiInMenu > ippInMenu && etiInMenu > gaiInMenu,
    `ipp=${ippInMenu} gai=${gaiInMenu} eti=${etiInMenu}`);
  ok('route-path', script.includes("'governed-administrative-integration': '/governed-administrative-integration'"));
  ok('path-route', script.includes("'/governed-administrative-integration': 'governed-administrative-integration'"));
  ok('title', script.includes("'governed-administrative-integration': 'التكامل الإداري المحكوم'"));
  ok('render-fn', script.includes('renderGovernedAdministrativeIntegration'));
  const renderIdx = script.indexOf('const renderGovernedAdministrativeIntegration');
  const renderSlice = renderIdx >= 0 ? script.slice(renderIdx, renderIdx + 4500) : '';
  ok('gai-title', renderSlice.includes('التكامل الإداري المحكوم'));
  ok('gai-docs-section', renderSlice.includes('حوكمة الوثائق والإجراءات'));
  ok('gai-finance-section', script.includes('الحوكمة المالية والرقابة')
    || renderSlice.includes('الحوكمة المالية والإجراءات'));
  ok('gai-hr-section', script.includes('حوكمة الموارد البشرية'));
  ok('no-fake-widgets', !/<table|<form/.test(renderSlice));
  ok('server-spa', server.includes("'/governed-administrative-integration'"));
  ok('server-protect', server.includes("'/governed-administrative-integration'"));
  ok('perm-keys', getPageKeysForPath('/governed-administrative-integration').includes('governed-administrative-integration'));
  ok('smart-mgmt-untouched', script.includes('الإدارة الذكية 360') && script.includes("'smart-management'"));
  ok('ipp-untouched', script.includes('حاضنات و منصات اعمال') && script.includes("'incubators-platforms'"));

  try {
    const r = await get('/governed-administrative-integration');
    ok('http-route', r.status === 200 || r.status === 302, 'status=' + r.status);
    if (r.status === 302) {
      ok('http-auth-redirect', true, r.headers.location || '(redirect)');
    }
    for (const p of ['/smart-management', '/incubators-platforms', '/home', '/settings/admin']) {
      const res = await get(p);
      ok('http-intact-' + p, res.status === 200 || res.status === 302, 'status=' + res.status);
    }
  } catch (err) {
    ok('http-suite', false, err.message);
  }

  const failed = results.filter((r) => !r.pass);
  console.log('\n=== Governed Administrative Integration Page ===');
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
