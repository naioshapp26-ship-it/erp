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
  ['landing hero', landing.includes('hero-content') || landing.includes('tenant-landing-hero')],
  ['landing brand name lock', landing.includes('data-landing-brand="name"')],
  ['branding logo', landing.includes('data-tenant-brand="logo"')],
  ['fouc lock script', landing.includes('tenant-landing-fouc-lock')],
  ['fouc critical css', landing.includes('tenant-landing-fouc-critical')],
  ['erp brand theme defaults', landing.includes('--tenant-primary') && landing.includes("DEFAULT_PRIMARY = '#11165a'")],
  ['hero soft→navy gradient', landing.includes('buildHeroGradient') && landing.includes('--landing-hero-gradient') && landing.includes("mixHex(primary, '#9ec5ff'")],
  ['hero uses gradient paint', landing.includes("hero.style.setProperty('background-image', heroMesh + ', ' + heroGradient") && !landing.includes('Reject magenta/purple-leaning secondary')],
  ['hero banner media from identity', landing.includes('__tenantLandingApplyHeroBanner') && landing.includes('hero_banner_image_url')],
  ['hero banner artwork', landing.includes('/newhome/tenant-hero-banner.svg') && fs.existsSync(path.join(__dirname, 'newhome', 'tenant-hero-banner.svg'))],
  ['brand FAB frame', landing.includes('html body.homepage.tenant-branded .floating-actions a') && landing.includes('background: var(--tenant-primary')],
  ['branding-driven paint', landing.includes('__tenantLandingPaintBrandColors') && landing.includes('paintLandingFromBranding')],
  ['identity hero label', fs.readFileSync(path.join(__dirname, 'tenant-branding-settings.html'), 'utf8').includes('لون الهيرو / الأساسي')],
  ['nav home', landing.includes('>الرئيسية<')],
  ['nav about', landing.includes('>من نحن<')],
  ['nav login', landing.includes('>تسجيل الدخول<')],
  ['nav contact', landing.includes('تواصل معانا')],
  ['hero sidebar hr link', landing.includes('href="/hr"') && landing.includes('>نظام HR<')],
  ['hero sidebar finance link', landing.includes('href="/finance"') && landing.includes('>نظام المالية<')],
  ['hero sidebar archive link', landing.includes('href="/archive"') && landing.includes('>نظام الارشيف<')],
  ['no broken finance-home link', !landing.includes('finance-home.html')],
  ['poshahub360 title', landing.includes('poshahub360')],
  ['landing CTA', landing.includes('login-page.html?login=1')],
  ['login gate', login.includes("params.get('login')")],
  ['server route', server.includes("path.join(__dirname, 'tenant-landing.html')")],
  ['server landing name lock only', server.includes("fileName === 'tenant-landing.html'") && server.includes("site_name: 'poshahub360'") && !server.includes("primary_color: '#0b1f3a'")],
  ['tenant root redirect', resolver.includes('/t/${pathSubdomain}/`')]
];

const failed = checks.filter(([, ok]) => !ok).map(([name]) => name);
if (failed.length) {
  console.error('❌ Missing tenant landing page pieces:', failed.join(', '));
  process.exit(1);
}

console.log('✅ Tenant landing page wiring is present.');
