const fs = require('fs');
const path = require('path');

const server = fs.readFileSync(path.join(__dirname, 'server.js'), 'utf8');
const dashboard = fs.readFileSync(path.join(__dirname, 'dashboard.html'), 'utf8');
const landing = fs.readFileSync(path.join(__dirname, 'tenant-landing.html'), 'utf8');

const checks = [
  ['tenant dashboard html file', fs.existsSync(path.join(__dirname, 'tenant-dashboard.html'))],
  ['uses full dashboard shell', server.includes("path.join(__dirname, 'dashboard.html')")],
  ['tenant landing redirect from dashboard', dashboard.includes("'/t/' + tenantMatch[1].toLowerCase() + '/'")],
  ['sidebar home link', dashboard.includes('sidebar-home-link')],
  ['landing login cta', landing.includes('login-page.html?login=1')],
  ['landing dashboard cta for session', landing.includes('دخول لوحة التحكم')],
  ['server landing redirect', server.includes('`/t/${req.tenant.subdomain}/`')],
];

const failed = checks.filter(([, ok]) => !ok).map(([name]) => name);
if (failed.length) {
  console.error('❌ Tenant flow checks failed:', failed.join(', '));
  process.exit(1);
}

console.log('✅ Tenant landing → login → sidebar dashboard flow is wired.');
