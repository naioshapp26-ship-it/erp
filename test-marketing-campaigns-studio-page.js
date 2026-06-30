const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'marketing-campaigns-studio.html');
const html = fs.readFileSync(filePath, 'utf8');
const scriptPath = path.join(__dirname, 'script.js');
const scriptContent = fs.readFileSync(scriptPath, 'utf8');
const serverPath = path.join(__dirname, 'server.js');
const serverContent = fs.readFileSync(serverPath, 'utf8');
const registryPath = path.join(__dirname, 'page-permissions-registry.js');
const registryContent = fs.readFileSync(registryPath, 'utf8');

const checks = [
  'استوديو الحملات التسويقية',
  'لوحة الاستوديو',
  'إنشاء حملة',
  'إدارة الحملات',
  'تسجيل الحملات',
  'مكتبة الفيديو',
  'صانع المقاطع القصيرة',
  'مكتبة المقاطع القصيرة',
  'النشر على المنصات',
  'تصوير ريلز ذاتي',
  '/api/events-studio/summary',
  '/api/events-studio/events',
  '/api/events-studio/clips',
  '--primary: #b91c1c',
  'viewVideoDetails(',
  'prepareReelFromVideo(',
  'deleteReel(',
  'openAddFlow(',
  'إضافة حملة',
  'رفع فيديو'
];

const missing = checks.filter((item) => !html.includes(item));
const navigationChecks = [
  { description: 'TENANT_EXTERNAL_ROUTE_PATHS marketing studio mapping', pattern: /['"]marketing-campaigns-studio['"]\s*:\s*['"]\/marketing-campaigns-studio\.html['"]/ },
  { description: 'routeToPath mapping for marketing-campaigns-studio', pattern: /['"]marketing-campaigns-studio['"]\s*:\s*['"]\/marketing-campaigns-studio\.html['"]/ },
  { description: 'pathToRoute reverse mapping for marketing studio page', pattern: /['"]\/marketing-campaigns-studio\.html['"]\s*:\s*['"]marketing-campaigns-studio['"]/ },
  { description: 'loadRoute redirect branch for marketing-campaigns-studio', pattern: /route\s*===\s*['"]marketing-campaigns-studio['"]\s*\|\|\s*route\s*===\s*['"]marketing['"]/ },
  { description: 'renderMarketingCampaignsStudio redirect target', pattern: /navigateToExternalRoute\(['"]marketing-campaigns-studio['"]\)/ }
];
const missingNavigation = navigationChecks.filter(({ pattern }) => !pattern.test(scriptContent));
const hasMarketingPrimaryRoute = /app\.get\('\/marketing-campaigns-studio\.html',\s*\(req,\s*res\)\s*=>\s*serveMarketingCampaignsStudio\(req,\s*res\)\);/.test(serverContent);
const hasMarketingShortRedirect = /app\.get\('\/marketing-campaigns-studio',\s*\(req,\s*res\)\s*=>\s*res\.redirect\(301,\s*'\/marketing-campaigns-studio\.html'\)\);/.test(serverContent);
const hasRegistryPath = /['"]marketing-campaigns-studio['"]\s*:\s*['"]\/marketing-campaigns-studio\.html['"]/.test(registryContent);
const hasProtectedPath = /'\/marketing-campaigns-studio\.html'/.test(serverContent);

if (
  missing.length ||
  missingNavigation.length ||
  !hasMarketingPrimaryRoute ||
  !hasMarketingShortRedirect ||
  !hasRegistryPath ||
  !hasProtectedPath
) {
  console.error('❌ Marketing Campaigns Studio page validation failed');
  missing.forEach((item) => console.error(`   Missing in HTML: ${item}`));
  missingNavigation.forEach(({ description }) => console.error(`   Missing navigation check: ${description}`));
  if (!hasMarketingPrimaryRoute) {
    console.error('   Missing: server route should directly serve marketing-campaigns-studio.html');
  }
  if (!hasMarketingShortRedirect) {
    console.error('   Missing: /marketing-campaigns-studio should redirect to /marketing-campaigns-studio.html');
  }
  if (!hasRegistryPath) {
    console.error('   Missing: page-permissions-registry should map marketing-campaigns-studio to .html path');
  }
  if (!hasProtectedPath) {
    console.error('   Missing: marketing-campaigns-studio.html should be in protected HTML paths');
  }
  process.exit(1);
}

console.log('✅ Marketing Campaigns Studio page validation passed');
