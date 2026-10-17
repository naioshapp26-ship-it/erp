'use strict';

const fs = require('fs');
const path = require('path');
const http = require('http');
const {
  ARCHIVE_DOCUMENT_GOVERNANCE_PAGES,
  getPageKeysForPath,
  getPagesForSystem
} = require('./page-permissions-registry');

const BASE = process.env.GAI_BASE || 'http://127.0.0.1:3010';
const results = [];
function ok(name, cond, detail) {
  results.push({ name, pass: !!cond, detail: detail || '' });
  if (!cond) console.error('FAIL', name, detail || '');
  else console.log('PASS', name, detail || '');
}

function get(urlPath) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlPath, BASE);
    const req = http.get(url, { headers: { Accept: 'text/html' } }, (res) => {
      let body = '';
      res.on('data', (c) => { body += c; });
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body }));
    });
    req.on('error', reject);
    req.setTimeout(15000, () => { req.destroy(new Error('timeout')); });
  });
}

function extractArchiveCards(html) {
  const block = html.match(/id="archive-cards"[\s\S]*?(?=<\/div>\s*<\/div>|<\/main>|<\/body>)/);
  if (!block) return [];
  const cards = [];
  const re = /href="([^"]+)"[\s\S]*?<span class="flex-1 text-right">([^<]+)<\/span>/g;
  let m;
  while ((m = re.exec(block[0])) !== null) {
    cards.push({ href: m[1].trim(), label: m[2].replace(/\s+/g, ' ').trim() });
  }
  return cards;
}

async function main() {
  const archiveHtml = fs.readFileSync(path.join(__dirname, 'finance/archive-home.html'), 'utf8');
  const script = fs.readFileSync(path.join(__dirname, 'script.js'), 'utf8');
  const cards = extractArchiveCards(archiveHtml);

  ok('archive-card-count', cards.length === 2, `count=${cards.length}`);
  ok('archive-keeps-e-archive', cards.some((c) => c.href === '/hr/e-archive' && c.label.includes('الأرشفة الإلكترونية')));
  ok('archive-keeps-mail', cards.some((c) => c.href === '/hr/inbound-outbound-mail'));
  ok('archive-no-ocr', !cards.some((c) => c.href === '/hr/ocr-suite'));
  ok('archive-no-workflow', !cards.some((c) => c.href === '/hr/workflow-engine'));
  ok('archive-no-text-chat', !cards.some((c) => c.href === '/hr/text-chat'));

  ok('governance-pages-count', ARCHIVE_DOCUMENT_GOVERNANCE_PAGES.length === 14,
    `count=${ARCHIVE_DOCUMENT_GOVERNANCE_PAGES.length}`);

  const renderIdx = script.indexOf('const renderGovernedAdministrativeIntegration');
  const renderSlice = renderIdx >= 0 ? script.slice(renderIdx, renderIdx + 4500) : '';
  ok('gai-docs-section', renderSlice.includes('حوكمة الوثائق والإجراءات') && renderSlice.includes('fa-folder-gear'));
  ok('gai-finance-placeholder', renderSlice.includes('الحوكمة المالية والإجراءات')
    && renderSlice.includes('سيتم تحديد صفحات هذا القسم لاحقًا'));
  ok('gai-hr-placeholder', renderSlice.includes('حوكمة الموارد البشرية'));
  ok('gai-no-fake-finance-cards', !/gai-finance-governance[\s\S]{0,800}href=.*\/finance\//.test(renderSlice));
  ok('gai-cards-const', script.includes('GAI_DOCUMENT_GOVERNANCE_CARDS'));

  for (const page of ARCHIVE_DOCUMENT_GOVERNANCE_PAGES) {
    ok(`gai-card-${page.href}`, script.includes(`href: '${page.href}'`) && script.includes(page.label),
      page.label);
    const keys = getPageKeysForPath(page.href) || [];
    ok(`rbac-key-${page.href}`, keys.includes('records-archive-home')
      && keys.some((k) => k.startsWith('archive-')),
    JSON.stringify(keys));
  }

  const systemPages = getPagesForSystem('records-archive-home');
  const systemKeys = systemPages.map((p) => p.key);
  ok('system-still-has-ocr', systemKeys.includes('archive-ocr-suite'));
  ok('system-still-has-e-archive', systemKeys.includes('archive-e-archive'));
  ok('system-page-count-ge-16', systemPages.length >= 16, `count=${systemPages.length}`);

  // Original deep links still served
  try {
    const archiveRes = await get('/archive');
    ok('http-archive', archiveRes.status === 200 || archiveRes.status === 302, 'status=' + archiveRes.status);
    if (archiveRes.status === 200) {
      const liveCards = extractArchiveCards(archiveRes.body);
      ok('http-archive-two-cards', liveCards.length === 2, `count=${liveCards.length}`);
    }
    for (const page of ARCHIVE_DOCUMENT_GOVERNANCE_PAGES) {
      const res = await get(page.href);
      ok(`http-intact-${page.href}`, res.status === 200 || res.status === 302, 'status=' + res.status);
    }
    const kept = ['/hr/e-archive', '/hr/inbound-outbound-mail'];
    for (const href of kept) {
      const res = await get(href);
      ok(`http-kept-${href}`, res.status === 200 || res.status === 302, 'status=' + res.status);
    }
    const gai = await get('/governed-administrative-integration');
    ok('http-gai', gai.status === 200 || gai.status === 302, 'status=' + gai.status);
  } catch (err) {
    ok('http-suite', false, err.message);
  }

  const failed = results.filter((r) => !r.pass);
  console.log('\n=== GAI Archive Governance Reorg ===');
  console.log('passed:', results.length - failed.length, '/', results.length);
  if (failed.length) {
    failed.forEach((f) => console.log(' -', f.name, f.detail));
    process.exit(1);
  }
  console.log('VERDICT: GO');
  console.log('\nMoved pages:');
  ARCHIVE_DOCUMENT_GOVERNANCE_PAGES.forEach((p, i) => {
    console.log(`  ${i + 1}. ${p.label} -> ${p.href}`);
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
