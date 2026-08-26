const fs = require('fs');
const path = require('path');

const {
  DEFAULT_ANNOUNCEMENT_TEXT,
  mapAnnouncementFields,
  mergeAnnouncementIntoExtra,
  sanitizeAnnouncementText
} = require('./tenant-branding-service');
const { buildBootIdentity } = require('./tenant-branding-html-injector');

const settingsHtml = fs.readFileSync(path.join(__dirname, 'tenant-branding-settings.html'), 'utf8');
const landing = fs.readFileSync(path.join(__dirname, 'tenant-landing.html'), 'utf8');

const defaults = mapAnnouncementFields({}, {});
const custom = mapAnnouncementFields({ announcementBar: {
  enabled: true,
  text: '📢 عرض خاص للمستأجر',
  speed: 40,
  textColor: '#ffeeaa'
}}, {});
const hidden = mapAnnouncementFields({ announcementBar: {
  enabled: false,
  text: '',
  speed: 28
}}, {});

const merged = mergeAnnouncementIntoExtra({}, {
  announcement_enabled: false,
  announcement_text: '',
  announcement_clear: true
});

const boot = buildBootIdentity({
  site_name: 'poshahub360',
  announcement_enabled: true,
  announcement_text: '📢 عرض خاص',
  announcement_speed: 35,
  announcement_text_color: '#ffffff'
}, { subdomain: 'mam' });

const checks = [
  ['default announcement text constant', DEFAULT_ANNOUNCEMENT_TEXT.includes('عروض محدودة')],
  ['default identity announcement', defaults.announcement_enabled === true && defaults.announcement_text === DEFAULT_ANNOUNCEMENT_TEXT],
  ['custom announcement mapping', custom.announcement_text === '📢 عرض خاص للمستأجر' && custom.announcement_speed === 40],
  ['hidden announcement mapping', hidden.announcement_enabled === false && hidden.announcement_text === ''],
  ['merge clear announcement', merged.announcementBar.enabled === false && merged.announcementBar.text === ''],
  ['sanitize announcement text', sanitizeAnnouncementText('  hello  ') === 'hello'],
  ['settings announcement UI', settingsHtml.includes('id="announcement_text"') && settingsHtml.includes('البنر المتحرك')],
  ['settings delete button', settingsHtml.includes('announcement-clear-btn') && settingsHtml.includes('حذف البنر')],
  ['settings save payload', settingsHtml.includes('announcement_enabled:') && settingsHtml.includes('announcement_text:')],
  ['landing apply announcement helper', landing.includes('__tenantLandingApplyAnnouncementBar') && landing.includes('announcement-hidden')],
  ['boot includes announcement', boot.announcement_text === '📢 عرض خاص' && boot.announcement_speed === 35]
];

const failed = checks.filter(([, ok]) => !ok).map(([name]) => name);
if (failed.length) {
  console.error('❌ Tenant banner settings missing:', failed.join(', '));
  process.exit(1);
}

console.log('✅ Tenant banner settings wiring is present.');
