'use strict';
/**
 * Module-Aware Navigation for Incubators & Platforms portal systems.
 * Ensures Branches / Nurseries / Platforms / E-Library get scoped sidebars
 * without restoring them to the shared global menu.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const results = [];
function ok(name, cond, detail) {
  results.push({ name, pass: !!cond, detail: detail || '' });
  if (!cond) console.error('FAIL', name, detail || '');
  else console.log('PASS', name, detail || '');
}

const script = fs.readFileSync(path.join(__dirname, 'script.js'), 'utf8');

ok('has-ipp-module-nav', /const IPP_MODULE_NAV\s*=/.test(script));
ok('has-active-key-helper', /const getActiveIppModuleKey\s*=/.test(script));
ok('has-scoped-builder', /const buildIppScopedSidebarItems\s*=/.test(script));
ok('has-refresh-hook', script.includes('window.__naioshRefreshIppSidebar'));
ok('loadroute-calls-refresh', script.includes('window.__naioshRefreshIppSidebar(previousAppRoute, route)'));
ok('portal-back-label', script.includes('العودة إلى حاضنات و منصات اعمال'));
ok('tenant-path-strip', /const stripTenantPathPrefix\s*=/.test(script));

// Extract and evaluate IPP helpers in isolation
const navMatch = script.match(/const IPP_MODULE_NAV = \{[\s\S]*?\n    \};\n\n    const stripTenantPathPrefix/);
ok('extract-nav', !!navMatch, 'IPP_MODULE_NAV block');

const helperSrc = `
${navMatch ? navMatch[0].replace(/\n    const stripTenantPathPrefix$/, '') : 'const IPP_MODULE_NAV = {};'}
const stripTenantPathPrefix = (pathname) => {
  const raw = String(pathname || '');
  const match = raw.match(/^\\/t\\/[a-z0-9][a-z0-9-]*(\\/.*)?$/i);
  if (!match) return raw;
  return match[1] || '/';
};
const getActiveIppModuleKey = (route) => {
  const r = String(route || '');
  if (r === 'branches-hub' || r.startsWith('br-')) return 'branches';
  if (r === 'incubators-hub' || r.startsWith('ic-')) return 'incubators';
  if (r === 'platforms' || r.startsWith('pl-')) return 'platforms';
  if (r === 'e-offices' || r.startsWith('eo-')) return 'e-offices';
  return null;
};
({ IPP_MODULE_NAV, stripTenantPathPrefix, getActiveIppModuleKey });
`;

let helpers;
try {
  helpers = vm.runInNewContext(helperSrc, Object.create(null), { timeout: 1000 });
  ok('helpers-eval', !!helpers && !!helpers.IPP_MODULE_NAV);
} catch (err) {
  ok('helpers-eval', false, err.message);
  helpers = null;
}

if (helpers) {
  const { IPP_MODULE_NAV, stripTenantPathPrefix, getActiveIppModuleKey } = helpers;
  ok('nav-branches', !!IPP_MODULE_NAV.branches && IPP_MODULE_NAV.branches.sections.length >= 8);
  ok('nav-incubators', !!IPP_MODULE_NAV.incubators && IPP_MODULE_NAV.incubators.sections.length >= 8);
  ok('nav-platforms', !!IPP_MODULE_NAV.platforms && IPP_MODULE_NAV.platforms.sections.length >= 8);
  ok('nav-eoffices', !!IPP_MODULE_NAV['e-offices'] && IPP_MODULE_NAV['e-offices'].sections.length >= 8);
  ok('key-br', getActiveIppModuleKey('br-sales') === 'branches');
  ok('key-ic', getActiveIppModuleKey('ic-training') === 'incubators');
  ok('key-pl', getActiveIppModuleKey('pl-daily-operations') === 'platforms');
  ok('key-eo', getActiveIppModuleKey('eo-files') === 'e-offices');
  ok('key-dashboard', getActiveIppModuleKey('dashboard') === null);
  ok('key-smart', getActiveIppModuleKey('smart-management') === null);
  ok('strip-tenant', stripTenantPathPrefix('/t/mam/branches/sales') === '/branches/sales');
  ok('strip-plain', stripTenantPathPrefix('/branches') === '/branches');
  ok('branches-has-daily', IPP_MODULE_NAV.branches.sections.some((s) => s.id === 'br-daily-operations'));
  ok('no-hr-in-branches', !IPP_MODULE_NAV.branches.sections.some((s) => s.id === 'hr' || s.label === 'الموارد البشرية'));
  ok('no-archive-in-branches', !IPP_MODULE_NAV.branches.sections.some((s) => String(s.id).includes('archive') && s.id === 'records-archive-home'));
}

// Shared global menu must still expose portal + smart management, not the four hubs as top-level items
ok('global-keeps-portal', /scopedIppItems \|\| \[[\s\S]*?id:\s*'incubators-platforms'/.test(script));
ok('global-keeps-smart', /scopedIppItems \|\| \[[\s\S]*?id:\s*'smart-management'/.test(script));
ok('smart-mgmt-label', script.includes('الإدارة الذكية 360'));

const failed = results.filter((r) => !r.pass);
console.log('\n=== IPP Module Sidebar ===');
console.log('passed:', results.length - failed.length, '/', results.length);
if (failed.length) {
  failed.forEach((f) => console.log(' -', f.name, f.detail));
  process.exit(1);
}
console.log('VERDICT: GO');
