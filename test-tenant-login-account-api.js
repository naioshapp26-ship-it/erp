const fs = require('fs');
const path = require('path');

const settingsApi = fs.readFileSync(path.join(__dirname, 'tenant-settings-api.js'), 'utf8');
const brandingHtml = fs.readFileSync(path.join(__dirname, 'tenant-branding-settings.html'), 'utf8');
const scriptJs = fs.readFileSync(path.join(__dirname, 'script.js'), 'utf8');

const required = [
  "router.get('/login-account'",
  "router.patch('/login-account'",
  'syncCentralTenantUserDirectoryEntry',
  'directoryContact,adminEmail}',
  'renderTenantWorkspaceDashboard',
  'tenant-workspace-dashboard',
  'saveLoginEmail',
  'login_email'
];

const missing = required.filter((snippet) => {
  if (snippet.includes('renderTenant') || snippet.includes('tenant-workspace')) {
    return !scriptJs.includes(snippet) && !fs.readFileSync(path.join(__dirname, 'style.css'), 'utf8').includes(snippet);
  }
  if (snippet.includes('saveLoginEmail') || snippet.includes('login_email')) {
    return !brandingHtml.includes(snippet);
  }
  return !settingsApi.includes(snippet);
});

if (missing.length) {
  console.error('❌ Missing tenant dashboard/email pieces:');
  missing.forEach((item) => console.error(`   - ${item}`));
  process.exit(1);
}

console.log('✅ Tenant dashboard and login email changes are present.');
