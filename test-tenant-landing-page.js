const fs = require('fs');
const path = require('path');
const {
  injectTenantLandingSystemLinks,
  injectTenantBrandingHtml,
  resolveAllowedLandingSystems,
  buildBootIdentity
} = require('./tenant-branding-html-injector');

const landing = fs.readFileSync(path.join(__dirname, 'tenant-landing.html'), 'utf8');
const login = fs.readFileSync(path.join(__dirname, 'login-page.html'), 'utf8');
const resolver = fs.readFileSync(path.join(__dirname, 'tenant-resolver.js'), 'utf8');
const server = fs.readFileSync(path.join(__dirname, 'server.js'), 'utf8');

if (!fs.existsSync(path.join(__dirname, 'tenant-landing.html'))) {
  console.error('❌ tenant-landing.html is missing');
  process.exit(1);
}

const sampleHtml = `
<nav class="hero-sidebar">
  <a class="hero-sidebar-item" href="/hr" data-tenant-system-link="hr">نظام HR</a>
  <a class="hero-sidebar-item" href="/finance" data-tenant-system-link="finance">نظام المالية</a>
  <a class="hero-sidebar-item" href="/archive" data-tenant-system-link="archive">نظام الارشيف</a>
</nav>
<section id="main-sections-grid">
  <a class="card" href="/hr"><h3>نظام HR</h3></a>
  <a class="card" href="/finance"><h3>نظام المالية</h3></a>
  <a class="card" href="/archive"><h3>نظام الارشيف</h3></a>
</section>
`;

const checks = [
  ['landing hero', landing.includes('hero-content') || landing.includes('tenant-landing-hero')],
  ['landing brand name lock', landing.includes('data-landing-brand="name"')],
  ['branding logo', landing.includes('data-tenant-brand="logo"')],
  ['fouc lock script', landing.includes('tenant-landing-fouc-lock')],
  ['fouc critical css', landing.includes('tenant-landing-fouc-critical')],
  ['erp brand theme defaults', landing.includes('--tenant-primary') && landing.includes("DEFAULT_PRIMARY = '#11165a'")],
  ['hero light→navy gradient', landing.includes('buildHeroGradient') && landing.includes('--landing-hero-gradient') && landing.includes("mixHex(primary, '#9ec5ff'")],
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
  ['hero sidebar explicit nav', landing.includes('data-tenant-system-link="finance"') && landing.includes('window.location.href = url')],
  ['server injects scoped system links', (() => {
    const injected = injectTenantLandingSystemLinks(
      '<a class="hero-sidebar-item" href="/finance" data-tenant-system-link="finance">x</a>',
      { subdomain: 'mam' },
      ['finance']
    );
    return injected.includes('href="/t/mam/finance"');
  })()],
  ['module filter removes archive', (() => {
    const injected = injectTenantLandingSystemLinks(
      sampleHtml,
      { subdomain: 'tast' },
      ['dashboard', 'hr', 'finance']
    );
    return injected.includes('data-tenant-system-link="hr"')
      && injected.includes('data-tenant-system-link="finance"')
      && !injected.includes('data-tenant-system-link="archive"')
      && !injected.includes('href="/t/tast/archive"');
  })()],
  ['tenant name injection replaces placeholder', (() => {
    const html = injectTenantBrandingHtml(
      '<html><head><meta charset="utf-8"><title>poshahub360</title></head><body><h1 data-landing-brand="name">poshahub360</h1></body></html>',
      { site_name: 'تست', primary_color: '#11165a', secondary_color: '#0c1048', allowed_pages: ['hr', 'finance'] },
      { subdomain: 'tast', company_name: 'تست' },
      { allowedPages: ['hr', 'finance'] }
    );
    return html.includes('تست') && !/site_name":"poshahub360"/.test(html) && html.includes('"allowed_systems":["hr","finance"]');
  })()],
  ['no hardcode brand lock in server', !server.includes("site_name: 'poshahub360'")],
  ['no force core systems on boot', server.includes('Do NOT call ensureTenantCoreSystemPages on boot')],
  ['landing uses tenant display name helpers', landing.includes('resolveDisplayName') && landing.includes('applyTenantDisplayName') && landing.includes('filterLandingSystemsBySubscription')],
  ['no forceMamName lock', !landing.includes('forceMamName') && !landing.includes("identity.site_name = 'poshahub360'")],
  ['form CTA black labels', landing.includes('.tour-form button.btn-primary') && landing.includes('color: #000000 !important') && landing.includes('.registration-form .registration-submit') && landing.includes('.newsletter-form .btn-primary')],
  ['tenant announcement ticker', landing.includes('id="announcement-bar"') && landing.includes('Tenant announcement ticker') && !landing.includes('display: none !important;\n    }\n    body.homepage {\n      padding-top: 0 !important;')],
  ['tenant announcement settings helper', landing.includes('__tenantLandingApplyAnnouncementBar') && fs.readFileSync(path.join(__dirname, 'tenant-branding-settings.html'), 'utf8').includes('id="announcement_text"')],
  ['landing CTA', landing.includes('login-page.html?login=1')],
  ['login gate', login.includes("params.get('login')")],
  ['server route', server.includes("path.join(__dirname, 'tenant-landing.html')")],
  ['tenant root redirect', resolver.includes('/t/${pathSubdomain}/`')],
  ['allowed systems resolver', (() => {
    const systems = resolveAllowedLandingSystems(['dashboard', 'hr', 'finance']);
    return systems.map((s) => s.key).join(',') === 'hr,finance';
  })()],
  ['boot identity carries allowed systems', (() => {
    const boot = buildBootIdentity(
      { site_name: 'Tenant A', allowed_pages: ['hr', 'finance'] },
      { subdomain: 'tenant-a', company_name: 'Tenant A' }
    );
    return boot.site_name === 'Tenant A' && boot.allowed_systems.join(',') === 'hr,finance';
  })()]
];

const failed = checks.filter(([, ok]) => !ok).map(([name]) => name);
if (failed.length) {
  console.error('❌ Missing tenant landing page pieces:', failed.join(', '));
  process.exit(1);
}

console.log('✅ Tenant landing page wiring is present.');
