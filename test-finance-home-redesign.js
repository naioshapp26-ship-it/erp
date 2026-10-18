const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'finance', 'index.html');
const html = fs.readFileSync(filePath, 'utf8');

const requiredSnippets = [
  'class="hero-section',
  'href="#finance-cards"',
  'class="floating-actions"',
  'aria-label="أزرار جانبية عائمة"',
  'id="scroll-top-button"',
  'id="finance-cards" class="finance-links"',
  'سيتم إضافة أنظمة وخدمات المالية 360 قريبًا.',
  'prefers-reduced-motion: reduce',
  'window.scrollTo({ top: 0, behavior: prefersReducedMotion ? \'auto\' : \'smooth\' })'
];

const missing = requiredSnippets.filter((snippet) => !html.includes(snippet));

if (missing.length > 0) {
  console.error('❌ Missing redesigned finance homepage snippets:');
  missing.forEach((snippet) => console.error(`   - ${snippet}`));
  process.exit(1);
}

console.log('✅ Finance homepage redesign markers are present.');
