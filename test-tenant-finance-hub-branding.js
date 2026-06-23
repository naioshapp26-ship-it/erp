const { buildFinanceHubBrandingCss } = require('./tenant-finance-hub-branding-css');

const css = buildFinanceHubBrandingCss('#0e139a', '#1a1a1a');

const required = [
  '.hero-section::before',
  'display: none !important',
  '.floating-actions button',
  'linear-gradient(135deg, #0e139a, #1a1a1a)',
  '.finance-links > a > i:first-child',
  'color: #fff !important',
  '.finance-help-button',
  '.global-back-button'
];

const missing = required.filter((snippet) => !css.includes(snippet));

if (missing.length > 0) {
  console.error('❌ Missing finance hub branding CSS snippets:');
  missing.forEach((snippet) => console.error(`   - ${snippet}`));
  process.exit(1);
}

console.log('✅ Finance hub tenant branding CSS is complete.');
