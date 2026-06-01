const fs = require('fs');
const path = require('path');

const root = __dirname;
const superAdminPath = path.join(root, 'super-admin-page.html');
const settingsPath = path.join(root, 'settings.html');
const scriptPath = path.join(root, 'script.js');

if (!fs.existsSync(superAdminPath)) {
  console.error('❌ Missing /super-admin-page.html');
  process.exit(1);
}

if (!fs.existsSync(settingsPath)) {
  console.error('❌ Missing /settings.html');
  process.exit(1);
}

if (!fs.existsSync(scriptPath)) {
  console.error('❌ Missing /script.js');
  process.exit(1);
}

const superAdminHtml = fs.readFileSync(superAdminPath, 'utf8');
const settingsHtml = fs.readFileSync(settingsPath, 'utf8');
const scriptJs = fs.readFileSync(scriptPath, 'utf8');
const MAX_CHARS_BETWEEN_SETTINGS_ID_AND_LABEL = 220;

const hasHomepageTabButton = /onclick=\"switchTab\('homepage',\s*this\)\"/.test(superAdminHtml);
if (hasHomepageTabButton) {
  console.error('❌ Homepage settings tab button is still present in /super-admin-page.html');
  process.exit(1);
}

if (!/window\.location\.href\s*=\s*['"]\/settings['"]/.test(superAdminHtml)) {
  console.error('❌ Direct navigation to /settings is missing in goToHomepageTab()');
  process.exit(1);
}

if (!superAdminHtml.includes('تم نقل "إدارة الصفحة الرئيسية" إلى "إعدادات الصفحة الرئيسية" في القائمة الجانبية')) {
  console.error('❌ Migration notice text is missing in /super-admin-page.html');
  process.exit(1);
}

const settingsLabelPattern = new RegExp(
  `id:\\s*['"]settings['"][^\\n\\r]{0,${MAX_CHARS_BETWEEN_SETTINGS_ID_AND_LABEL}}label:\\s*['"]إعدادات الصفحة الرئيسية['"]`
);
if (!settingsLabelPattern.test(scriptJs)) {
  console.error('❌ Sidebar settings label is not updated to "إعدادات الصفحة الرئيسية" in /script.js');
  process.exit(1);
}

const settingsChecks = [
  { label: 'page title text', pattern: /إعدادات الهوية/ },
  { label: 'save button binding', pattern: /onclick=["']saveHomepageSettings\(\)["']/ },
  { label: 'hero image upload binding', pattern: /onclick=["']uploadHomepageHeroImage\(\)["']/ },
  { label: 'hero video upload binding', pattern: /onclick=["']uploadHomepageHeroVideo\(\)["']/ }
];
const missingBindings = settingsChecks.filter((check) => !check.pattern.test(settingsHtml)).map((check) => check.label);
if (missingBindings.length) {
  console.error(`❌ /settings.html is missing homepage management markers: ${missingBindings.join(', ')}`);
  process.exit(1);
}

console.log('✅ Homepage settings are no longer a super-admin tab and are available via /settings.');
