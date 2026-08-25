const fs = require('fs');
const path = require('path');

const landing = fs.readFileSync(path.join(__dirname, 'tenant-landing.html'), 'utf8');
const login = fs.readFileSync(path.join(__dirname, 'login-page.html'), 'utf8');
const resolver = fs.readFileSync(path.join(__dirname, 'tenant-resolver.js'), 'utf8');
const server = fs.readFileSync(path.join(__dirname, 'server.js'), 'utf8');

if (!fs.existsSync(path.join(__dirname, 'tenant-landing.html'))) {
  console.error('❌ tenant-landing.html is missing');
  process.exit(1);
}

const checks = [
  ['landing hero', landing.includes('tenant-landing-hero')],
  ['branding name', landing.includes('data-tenant-brand="name"')],
  ['branding logo', landing.includes('data-tenant-brand="logo"')],
  ['erp blue theme', landing.includes('tenant-erp-blue-theme') || landing.includes('--brand-red: #1e3a8a') || landing.includes('--brand-red: #1d4ed8')],
  ['nav home', landing.includes('>الرئيسية<')],
  ['nav about', landing.includes('>من نحن<')],
  ['nav login', landing.includes('>تسجيل الدخول<')],
  ['nav contact', landing.includes('تواصل معانا')],
  ['poshahub360 title', landing.includes('poshahub360')],
  ['landing CTA', landing.includes('login-page.html?login=1')],
  ['login gate', login.includes("params.get('login')")],
  ['server route', server.includes("path.join(__dirname, 'tenant-landing.html')")],
  ['tenant root redirect', resolver.includes('/t/${pathSubdomain}/`')]
];

const failed = checks.filter(([, ok]) => !ok).map(([name]) => name);
if (failed.length) {
  console.error('❌ Missing tenant landing page pieces:', failed.join(', '));
  process.exit(1);
}

console.log('✅ Tenant landing page wiring is present.');
