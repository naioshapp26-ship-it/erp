'use strict';

const fs = require('fs');
const path = require('path');
const http = require('http');
const {
  SIDEBAR_DEFAULT_ORDER,
  SIDEBAR_DEDUPE_FROM_TOP,
  applySidebarCustomization,
  isProtectedNavId,
  SETTINGS_SIDEBAR_KEY
} = require('./sidebar-navigation-registry');

const results = [];
function ok(name, pass, detail) {
  results.push({ name, pass: !!pass, detail: detail || null });
  console.log(`${pass ? 'PASS' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`);
}

const script = fs.readFileSync(path.join(__dirname, 'script.js'), 'utf8');
const portal = fs.readFileSync(path.join(__dirname, 'services-events-center.html'), 'utf8');
const dashboard = fs.readFileSync(path.join(__dirname, 'dashboard.html'), 'utf8');
const server = fs.readFileSync(path.join(__dirname, 'server.js'), 'utf8');

ok('registry-order-17', SIDEBAR_DEFAULT_ORDER.length === 17, String(SIDEBAR_DEFAULT_ORDER.length));
ok('order-dashboard-first', SIDEBAR_DEFAULT_ORDER[0] === 'dashboard');
ok('order-strategic-second', SIDEBAR_DEFAULT_ORDER[1] === 'strategic-management');
ok('order-smart-third', SIDEBAR_DEFAULT_ORDER[2] === 'smart-management');
ok('order-gai-fourth', SIDEBAR_DEFAULT_ORDER[3] === 'governed-administrative-integration');
ok('order-ipp-fifth', SIDEBAR_DEFAULT_ORDER[4] === 'incubators-platforms');
ok('order-settings-last', SIDEBAR_DEFAULT_ORDER[SIDEBAR_DEFAULT_ORDER.length - 1] === 'settings-admin');

ok('script-uses-registry-order', script.includes("id: 'strategic-management'")
  && script.indexOf("id: 'strategic-management'") < script.indexOf("id: 'smart-management'")
  && script.includes("label: 'التعليم والتدريب'")
  && script.includes("label: 'مركز الخدمات والفعاليات'")
  && script.includes("label: 'إعدادات النظام'"));

ok('script-no-top-supply-chain', !/scopedIppItems \|\| \[[\s\S]*?id: 'supply-chain'[\s\S]*?\];\s*\n\s*items\.forEach/.test(script)
  || !script.includes("id: 'supply-chain',\n                    icon: 'fa-truck-loading',\n                    label: 'سلاسل التوريد',\n                    show:"));

// Top-level dedupe: supply-chain should not appear as a top-level show item in the new array after incubators-platforms block pattern
const mainMenuSlice = script.slice(script.indexOf('Client-approved top-level IA'), script.indexOf('items.forEach(item =>'));
ok('menu-has-services-events', mainMenuSlice.includes("id: 'services-events-center'"));
ok('menu-no-events-studio-top', !mainMenuSlice.includes("id: 'events-studio-main'"));
ok('menu-no-employee-menu-top', !mainMenuSlice.includes("id: 'employee-menu'"));
ok('gai-top-level', /id:\s*'governed-administrative-integration'[\s\S]*?show:\s*isOfficeRouteAllowed\('governed-administrative-integration'\)/.test(mainMenuSlice));
ok('gai-not-under-strategic', !/strategic-management[\s\S]*?governed-administrative-integration[\s\S]*?smart-management/.test(mainMenuSlice)
  || mainMenuSlice.indexOf("id: 'governed-administrative-integration'")
    > mainMenuSlice.indexOf("id: 'smart-management'"));
ok('education-tests-eval-label', mainMenuSlice.includes("label: 'الاختبارات والتقييم'")
  && !mainMenuSlice.includes("label: 'الاختبارات',"));
ok('incubators-related-in-ipp', script.includes("label: 'سلاسل التوريد'")
  && script.includes("INCUBATORS_SCOPED_ROUTES"));

ok('portal-file', portal.includes('مركز الخدمات والفعاليات')
  && portal.includes('/finance/events-studio-main.html')
  && portal.includes('/marketing-campaigns-studio.html'));
ok('dashboard-loads-registry', dashboard.includes('sidebar-navigation-registry.js'));
ok('server-route', server.includes("/services-events-center") && server.includes('serveServicesEventsCenter'));
ok('settings-key', SETTINGS_SIDEBAR_KEY === 'company.sidebar.navigation');
ok('settings-ui', script.includes('renderSidebarNavSettings') && script.includes('إدارة أيقونات القائمة الجانبية'));

const customized = applySidebarCustomization(
  SIDEBAR_DEFAULT_ORDER.map((id) => ({ id, show: true })),
  { orderIds: ['smart-management', 'dashboard'], hiddenIds: ['services', 'dashboard'] }
);
ok('custom-order', customized[0].id === 'smart-management');
ok('protect-dashboard-hide', customized.some((i) => i.id === 'dashboard'));
ok('hide-services', !customized.some((i) => i.id === 'services'));
ok('protected-admin', isProtectedNavId('settings-admin') && isProtectedNavId('super-admin'));
ok('dedupe-list', SIDEBAR_DEDUPE_FROM_TOP.length >= 10);

function get(pathName) {
  return new Promise((resolve) => {
    http.get({ hostname: '127.0.0.1', port: 3010, path: pathName }, (res) => {
      resolve(res.statusCode);
    }).on('error', () => resolve(0));
  });
}

(async () => {
  const codes = await Promise.all([
    get('/services-events-center'),
    get('/sidebar-navigation-registry.js'),
    get('/smart-management'),
    get('/incubators-platforms')
  ]);
  ok('http-services-events', codes[0] === 200 || codes[0] === 302, String(codes[0]));
  ok('http-registry-js', codes[1] === 200, String(codes[1]));
  ok('http-smart', codes[2] === 200 || codes[2] === 302, String(codes[2]));
  ok('http-ipp', codes[3] === 200 || codes[3] === 302, String(codes[3]));

  const failed = results.filter((r) => !r.pass);
  console.log(`\npassed: ${results.length - failed.length} / ${results.length}`);
  if (failed.length) {
    failed.forEach((f) => console.log(' -', f.name, f.detail));
    process.exit(1);
  }
  console.log('VERDICT: GO');
})();
