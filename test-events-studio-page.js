const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'finance', 'events-studio-main.html');
const html = fs.readFileSync(filePath, 'utf8');
const scriptPath = path.join(__dirname, 'script.js');
const scriptContent = fs.readFileSync(scriptPath, 'utf8');
const financeHomePath = path.join(__dirname, 'finance', 'index.html');
const financeHomeContent = fs.readFileSync(financeHomePath, 'utf8');
const serverPath = path.join(__dirname, 'server.js');
const serverContent = fs.readFileSync(serverPath, 'utf8');
const superAdminPath = path.join(__dirname, 'super-admin-page.html');
const superAdminContent = fs.readFileSync(superAdminPath, 'utf8');

const checks = [
  'لوحة الاستوديو',
  'إنشاء فعالية',
  'إدارة الفعاليات',
  'تسجيل الفعاليات',
  'مكتبة الفيديو',
  'صانع المقاطع القصيرة',
  'مكتبة المقاطع القصيرة',
  'النشر على المنصات',
  'تصوير ريلز ذاتي',
  '/api/events-studio/summary',
  '/api/events-studio/events',
  '/api/events-studio/clips',
  '/api/events-studio/recordings/upload',
  '/api/events-studio/publish',
  'viewVideoDetails(',
  'playVideo(',
  'downloadVideo(',
  'deleteMaterial(',
  'prepareReelFromVideo(',
  'viewReel(',
  'editReel(',
  'downloadReel(',
  'deleteReel(',
  'href="/index.html"'
];

const missing = checks.filter((item) => !html.includes(item));
const navigationChecks = [
  { description: 'sidebar item id for events studio', pattern: /id:\s*['"]events-studio-main['"]/ },
  // routeToPath mapping
  { description: 'routeToPath mapping for events-studio-main', pattern: /['"]events-studio-main['"]\s*:\s*['"]\/finance\/events-studio-main\.html['"]/ },
  // pathToRoute reverse mapping
  { description: 'pathToRoute reverse mapping for events studio page', pattern: /['"]\/finance\/events-studio-main\.html['"]\s*:\s*['"]events-studio-main['"]/ },
  { description: 'route loader branch for events-studio-main', pattern: /route\s*===\s*['"]events-studio-main['"]/ },
  { description: 'renderEventsStudioMain handler declaration', pattern: /const\s+renderEventsStudioMain\s*=/ },
  { description: 'renderEventsStudioMain redirect target', pattern: /window\.location\.href\s*=\s*['"]\/finance\/events-studio-main\.html['"]/ }
];
const missingNavigation = navigationChecks.filter(({ pattern }) => !pattern.test(scriptContent));
const hasEventsStudioLinkInFinanceMenu = /<a[^>]+href=["']\/finance\/events-studio-main\.html["'][^>]*>/.test(financeHomeContent);
const isEventsStudioMappedToFinance = /route === ['"]events-studio['"] \|\| route === ['"]events-studio-main['"]\)\s*\{\s*route = ['"]finance['"];\s*\}/.test(scriptContent);
const hasFinancePrimaryRoute = /app\.get\('\/finance\/events-studio-main\.html',\s*\(req,\s*res,\s*next\)\s*=>\s*serveEventsStudio\(req,\s*res,\s*next\)\);/.test(serverContent);
const hasLegacyRedirectToFinance = /app\.get\('\/events-studio-main\.html',\s*\(req,\s*res\)\s*=>\s*res\.redirect\(301,\s*'\/finance\/events-studio-main\.html'\)\);/.test(serverContent);
const hasShortRedirectToFinance = /app\.get\('\/events-studio',\s*\(req,\s*res\)\s*=>\s*res\.redirect\(301,\s*'\/finance\/events-studio-main\.html'\)\);/.test(serverContent);
const hasOfficePermissionToggle = /key:\s*['"]events-studio-main['"]\s*,\s*label:\s*['"]استوديو الفعاليات['"]/.test(superAdminContent);

if (
  missing.length ||
  missingNavigation.length ||
  hasEventsStudioLinkInFinanceMenu ||
  isEventsStudioMappedToFinance ||
  !hasFinancePrimaryRoute ||
  !hasLegacyRedirectToFinance ||
  !hasShortRedirectToFinance ||
  !hasOfficePermissionToggle
) {
  console.error('❌ Events Studio page validation failed');
  missing.forEach((item) => console.error(`   Missing: ${item}`));
  missingNavigation.forEach(({ description }) => console.error(`   Missing navigation check: ${description}`));
  if (hasEventsStudioLinkInFinanceMenu) {
    console.error('   Unexpected: Events Studio still exists inside finance/index.html menu');
  }
  if (isEventsStudioMappedToFinance) {
    console.error('   Unexpected: Events Studio is still piggybacking on the finance permission');
  }
  if (!hasFinancePrimaryRoute) {
    console.error('   Missing: finance route should directly serve Events Studio');
  }
  if (!hasLegacyRedirectToFinance) {
    console.error('   Missing: legacy /events-studio-main.html should redirect to /finance/events-studio-main.html');
  }
  if (!hasShortRedirectToFinance) {
    console.error('   Missing: legacy /events-studio should redirect to /finance/events-studio-main.html');
  }
  if (!hasOfficePermissionToggle) {
    console.error('   Missing: Super Admin page should expose an Events Studio permission toggle');
  }
  process.exit(1);
}

console.log('✅ Events Studio page validation passed');
