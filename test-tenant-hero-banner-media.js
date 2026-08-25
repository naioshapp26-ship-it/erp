const fs = require('fs');
const path = require('path');

const {
  sanitizeHeroMode,
  HERO_IMAGE_API_PATH,
  HERO_VIDEO_API_PATH
} = require('./tenant-branding-service');

const settingsHtml = fs.readFileSync(path.join(__dirname, 'tenant-branding-settings.html'), 'utf8');
const landing = fs.readFileSync(path.join(__dirname, 'tenant-landing.html'), 'utf8');
const settingsApi = fs.readFileSync(path.join(__dirname, 'tenant-settings-api.js'), 'utf8');
const publicApi = fs.readFileSync(path.join(__dirname, 'tenant-public-api.js'), 'utf8');

const checks = [
  ['hero mode sanitizer', sanitizeHeroMode('image') === 'image' && sanitizeHeroMode('nope') === 'gradient'],
  ['hero api constants', HERO_IMAGE_API_PATH.includes('hero-image') && HERO_VIDEO_API_PATH.includes('hero-video')],
  ['settings hero UI', settingsHtml.includes('id="hero_mode"') && settingsHtml.includes('بنر الهيرو')],
  ['settings upload image', settingsHtml.includes('branding/hero-image') && settingsApi.includes("'/branding/hero-image'")],
  ['settings upload video', settingsHtml.includes('branding/hero-video') && settingsApi.includes("'/branding/hero-video'")],
  ['public hero media routes', publicApi.includes('hero-image') && publicApi.includes('hero-video')],
  ['landing apply banner helper', landing.includes('__tenantLandingApplyHeroBanner') && landing.includes("mode === 'video'")],
  ['identity saves hero_mode', /hero_mode:\s*document\.getElementById\('hero_mode'\)/.test(settingsHtml)]
];

const failed = checks.filter(([, ok]) => !ok).map(([name]) => name);
if (failed.length) {
  console.error('❌ Tenant hero banner media missing:', failed.join(', '));
  process.exit(1);
}

console.log('✅ Tenant hero banner media (settings + landing) wiring is present.');
