const fs = require('fs');
const path = require('path');

const server = fs.readFileSync(path.join(__dirname, 'server.js'), 'utf8');
const dashboard = fs.readFileSync(path.join(__dirname, 'tenant-dashboard.html'), 'utf8');
const checks = [
  ['tenant dashboard html file', fs.existsSync(path.join(__dirname, 'tenant-dashboard.html'))],
  ['tenant dashboard app js', fs.existsSync(path.join(__dirname, 'tenant-dashboard-app.js'))],
  ['resolve dashboard path', server.includes('resolveDashboardHtmlPath')],
  ['send dashboard html', server.includes('sendDashboardHtml')],
  ['minimal branding inject', server.includes('injectMinimalTenantDashboardBranding')],
  ['server auth redirect', server.includes('explicitTenant') && server.includes('?login=1')],
  ['no external fonts in html', !dashboard.includes('fonts.googleapis.com')],
];

const failed = checks.filter(([, ok]) => !ok).map(([name]) => name);
if (failed.length) {
  console.error('❌ Tenant lite dashboard checks failed:', failed.join(', '));
  process.exit(1);
}

console.log('✅ Tenant lite dashboard wiring is present.');
