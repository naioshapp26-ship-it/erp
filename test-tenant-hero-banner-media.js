const fs = require('fs');
const path = require('path');

const {
  sanitizeHeroMode,
  HERO_IMAGE_API_PATH,
  HERO_VIDEO_API_PATH,
  NAIOSH_DEFAULT_HERO_IMAGE
} = require('./tenant-branding-service');
const { buildBootIdentity, injectTenantBrandingHtml } = require('./tenant-branding-html-injector');

const settingsHtml = fs.readFileSync(path.join(__dirname, 'tenant-branding-settings.html'), 'utf8');
const landing = fs.readFileSync(path.join(__dirname, 'tenant-landing.html'), 'utf8');
const settingsApi = fs.readFileSync(path.join(__dirname, 'tenant-settings-api.js'), 'utf8');
const publicApi = fs.readFileSync(path.join(__dirname, 'tenant-public-api.js'), 'utf8');

const sampleIdentity = {
  site_name: 'poshahub360',
  site_tagline: 'test',
  primary_color: '#1e3a8a',
  secondary_color: '#0c1048',
  hero_mode: 'video',
  hero_banner_image_url: HERO_IMAGE_API_PATH,
  hero_banner_video_url: HERO_VIDEO_API_PATH,
  setup_completed: true
};
const sampleTenant = { subdomain: 'mam', company_name: 'poshahub360' };
const bootOnce = buildBootIdentity(sampleIdentity, sampleTenant);
const bootTwice = buildBootIdentity(bootOnce, sampleTenant);
const injected = injectTenantBrandingHtml(
  '<!DOCTYPE html><html><head><meta charset="utf-8"></head><body></body></html>',
  sampleIdentity,
  sampleTenant
);

const checks = [
  ['hero mode sanitizer', sanitizeHeroMode('image') === 'image' && sanitizeHeroMode('nope') === 'gradient'],
  ['hero api constants', HERO_IMAGE_API_PATH.includes('hero-image') && HERO_VIDEO_API_PATH.includes('hero-video')],
  ['settings hero UI', settingsHtml.includes('id="hero_mode"') && settingsHtml.includes('بنر الهيرو')],
  ['settings upload image', settingsHtml.includes('branding/hero-image') && settingsApi.includes("'/branding/hero-image'")],
  ['settings upload video', settingsHtml.includes('branding/hero-video') && settingsApi.includes("'/branding/hero-video'")],
  ['public hero media routes', publicApi.includes('hero-image') && publicApi.includes('hero-video')],
  ['landing apply banner helper', landing.includes('__tenantLandingApplyHeroBanner') && landing.includes("mode === 'video'")],
  ['landing hero face media css', landing.includes('hero-face-media') && landing.includes('hero-bg-img')],
  ['landing hero black overlay', landing.includes('--hero-overlay-strength') && landing.includes('rgba(0, 0, 0, 0.72)') && landing.includes(':not(.hero-face-media)')],
  ['naiosh default hero asset', fs.existsSync(path.join(__dirname, 'newhome/naiosh-hero-default.jpg'))],
  ['naiosh default hero constant', NAIOSH_DEFAULT_HERO_IMAGE === '/newhome/naiosh-hero-default.jpg'],
  ['settings no naiosh hero btn', !settingsHtml.includes('use-naiosh-hero-btn') && !settingsHtml.includes('استخدام صورة نايس')],
  ['landing hero face video bg', landing.includes('hero-bg-video-bg') && landing.includes('applyHeroFaceVideo')],
  ['identity saves hero_mode', /hero_mode:\s*document\.getElementById\('hero_mode'\)/.test(settingsHtml)],
  ['boot scopes hero urls once', bootOnce.hero_banner_image_url === '/t/mam/api/tenant-public/hero-image'
    && bootOnce.hero_banner_video_url === '/t/mam/api/tenant-public/hero-video'],
  ['boot scope is idempotent', bootTwice.hero_banner_image_url === bootOnce.hero_banner_image_url
    && bootTwice.hero_banner_video_url === bootOnce.hero_banner_video_url],
  ['inject html has no double tenant prefix', !injected.includes('/t/mam/t/mam/')
    && injected.includes('/t/mam/api/tenant-public/hero-video')]
];

const failed = checks.filter(([, ok]) => !ok).map(([name]) => name);
if (failed.length) {
  console.error('❌ Tenant hero banner media missing:', failed.join(', '));
  process.exit(1);
}

console.log('✅ Tenant hero banner media (settings + landing) wiring is present.');
