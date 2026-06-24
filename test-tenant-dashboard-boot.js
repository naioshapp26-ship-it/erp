const fs = require('fs');
const path = require('path');

const script = fs.readFileSync(path.join(__dirname, 'script.js'), 'utf8');
const dashboard = fs.readFileSync(path.join(__dirname, 'dashboard.html'), 'utf8');
const server = fs.readFileSync(path.join(__dirname, 'server.js'), 'utf8');

const checks = [
  ['boot loader', dashboard.includes('dashboard-boot-loader')],
  ['tenant essential loader', script.includes('loadTenantEssentialData')],
  ['fetch abort timeout', script.includes('AbortController')],
  ['verify timeout', script.includes('controller.abort(), 10000')],
  ['strip tenant scripts', server.includes('optionalTenantScripts')]
];

const failed = checks.filter(([, ok]) => !ok).map(([name]) => name);
if (failed.length) {
  console.error('❌ Missing tenant dashboard boot optimizations:', failed.join(', '));
  process.exit(1);
}

console.log('✅ Tenant dashboard boot optimizations are present.');
