const fs = require('fs');
const path = require('path');

const root = __dirname;
const pages = [
  'index.html',
  'blog.html',
  'branches.html',
  'incubators.html',
  'ads.html',
  'services.html',
  'platforms.html',
  'e-offices.html',
  'systems.html',
  'companies.html',
  'members.html'
];

const requiredByPage = {
  'index.html': ['استكشف المساحات', 'احجز جولة', 'floating-actions', 'id="modules"', 'legacyLandingPaths', 'hero-orb', 'hero-glass-search', 'hero-media-caption', 'id="hero-bg-video"', 'id="main-sections-grid"'],
  'blog.html': ['مدونة المنصة', 'floating-actions'],
  'branches.html': ['شبكة الفروع', 'floating-actions'],
  'incubators.html': ['برامج الحاضنات', 'floating-actions'],
  'ads.html': ['إدارة الإعلانات', 'floating-actions'],
  'services.html': ['خدماتنا', 'floating-actions', 'landing-nav.js'],
  'platforms.html': ['منصتي', 'floating-actions', 'landing-nav.js'],
  'e-offices.html': ['مكتبي الإلكتروني', 'floating-actions', 'landing-nav.js'],
  'systems.html': ['أنظمتي', 'floating-actions', 'landing-nav.js'],
  'companies.html': ['شركاتي', 'floating-actions', 'landing-nav.js'],
  'members.html': ['الأعضاء والعضوية', 'floating-actions', 'landing-nav.js']
};

requiredByPage['index.html'].push('hero-dashboard', 'hero-panel-main', 'hero-panel-status');

const sharedCssPath = path.join(root, 'newhome', 'styles.css');
if (!fs.existsSync(sharedCssPath)) {
  console.error('❌ Missing /newhome/styles.css');
  process.exit(1);
}

const sharedCss = fs.readFileSync(sharedCssPath, 'utf8');
const cssChecks = ['.hero', '.cards', '.card', '.floating-actions', '.mobile-nav-toggle', '@keyframes heroGradientShift', '.hero .hero-orb', '.hero-glass-search', '.hero-media-caption', '@keyframes dividerFlow', 'scroll-behavior: smooth', 'grid-template-columns: repeat(3, minmax(0, 1fr))', '.hero-ctas .btn'];
const missingCss = cssChecks.filter((c) => !sharedCss.includes(c));
if (missingCss.length) {
  console.error('❌ Missing required CSS blocks:', missingCss.join(', '));
  process.exit(1);
}

const mobileNavScriptPath = path.join(root, 'newhome', 'mobile-nav.js');
if (!fs.existsSync(mobileNavScriptPath)) {
  console.error('❌ Missing /newhome/mobile-nav.js');
  process.exit(1);
}

const mobileNavScript = fs.readFileSync(mobileNavScriptPath, 'utf8');
const mobileNavChecks = ['mobile-nav-toggle', 'is-mobile-nav-open', 'matchMedia'];
const missingMobileNav = mobileNavChecks.filter((token) => !mobileNavScript.includes(token));
if (missingMobileNav.length) {
  console.error('❌ Missing required mobile nav markers:', missingMobileNav.join(', '));
  process.exit(1);
}

const serverPath = path.join(root, 'server.js');
if (!fs.existsSync(serverPath)) {
  console.error('❌ Missing /server.js');
  process.exit(1);
}

const serverCode = fs.readFileSync(serverPath, 'utf8');
if (!/app\.get\(\s*['"]\/['"]\s*,/.test(serverCode)) {
  console.error('❌ Root route `/` is missing from /server.js.');
  process.exit(1);
}

const expectedLandingPathRegex = /path\.join\(\s*__dirname\s*,\s*(?:'newhome'|"newhome")\s*,\s*(?:'index\.html'|"index\.html")\s*\)/;
if (!expectedLandingPathRegex.test(serverCode)) {
  console.error('❌ Root route `/` does not point to /newhome/index.html.');
  process.exit(1);
}

const newhomeRedirectRouteStart = serverCode.search(/app\.get\(\s*\[\s*['"]\/newhome['"]/);
if (newhomeRedirectRouteStart === -1) {
  console.error('❌ Canonical redirect route aliases for `/newhome` are missing from /server.js.');
  process.exit(1);
}

const REDIRECT_ROUTE_SNIPPET_LENGTH = 600;
const newhomeRedirectRouteSnippet = serverCode.slice(
  newhomeRedirectRouteStart,
  newhomeRedirectRouteStart + REDIRECT_ROUTE_SNIPPET_LENGTH
);
if (!/['"]\/newhome\/index\.html['"]/.test(newhomeRedirectRouteSnippet)) {
  console.error('❌ Canonical `/newhome/index.html` alias is missing from the redirect handler in /server.js.');
  process.exit(1);
}

if (!/res\.redirect\(\s*301\s*,\s*['"]\/['"]\s*\)/.test(newhomeRedirectRouteSnippet)) {
  console.error('❌ Canonical redirect target from `/newhome` aliases to `/` is missing in /server.js.');
  process.exit(1);
}

for (const page of pages) {
  const file = path.join(root, 'newhome', page);
  if (!fs.existsSync(file)) {
    console.error(`❌ Missing /newhome/${page}`);
    process.exit(1);
  }
  const html = fs.readFileSync(file, 'utf8');
  if (!html.includes('/newhome/mobile-nav.js')) {
    console.error(`❌ /newhome/${page} missing mobile nav script include`);
    process.exit(1);
  }
  const missing = (requiredByPage[page] || []).filter((token) => !html.includes(token));
  if (missing.length) {
    console.error(`❌ /newhome/${page} missing: ${missing.join(', ')}`);
    process.exit(1);
  }
}

console.log('✅ /newhome pages and style markers validated successfully.');
