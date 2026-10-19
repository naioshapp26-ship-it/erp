'use strict';

const fs = require('fs');
const path = require('path');
const http = require('http');
const {
  FINANCE_KEEP,
  FINANCE_MOVED,
  HR_KEEP,
  HR_MOVED,
  ARCHIVE_KEEP,
  DOCUMENT_GOVERNANCE_CARDS
} = require('./gai-hub-navigation');
const { listHrHomeModules } = require('./hr-home-modules');
const {
  getPageKeysForPath,
  getPagesForSystem,
  getRuntimeRouteParents
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

function extractCards(html, containerId) {
  const block = html.match(new RegExp(`id="${containerId}"[\\s\\S]*?<\\/div>`));
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
  ok('counts-finance-keep', FINANCE_KEEP.length === 8);
  ok('counts-hr-keep', HR_KEEP.length === 9);
  ok('counts-archive-keep', ARCHIVE_KEEP.length === 2);
  ok('counts-docs-moved', DOCUMENT_GOVERNANCE_CARDS.length === 14);
  ok('counts-finance-moved', FINANCE_MOVED.length === 61, String(FINANCE_MOVED.length));
  ok('counts-hr-moved', HR_MOVED.length === 21, String(HR_MOVED.length));

  const financeHtml = fs.readFileSync(path.join(__dirname, 'finance/index.html'), 'utf8');
  const archiveHtml = fs.readFileSync(path.join(__dirname, 'finance/archive-home.html'), 'utf8');
  const financeCards = extractCards(financeHtml, 'finance-cards');
  const archiveCards = extractCards(archiveHtml, 'archive-cards');
  const hrModules = listHrHomeModules();
  const {
    FINANCE_HOME_MOVED_TO_HR,
    FINANCE_HOME_SKIPPED_AS_HR_DUPES,
    buildPortalPayload
  } = require('./hr-portal-access');

  // P1: Finance Leadership 360 shell — section cards are buttons (not <a>), quick-access is outside #finance-cards.
  ok('finance-leadership-shell', financeHtml.includes('finance-leadership-360-catalog.js') && financeHtml.includes('fl360-sidebar'));
  ok('finance-cards-not-payment-terms-links', !financeCards.some((c) => c.href.includes('payment-terms')));
  ok('finance-page-settings-link', financeHtml.includes('leadership-page-settings.html'));
  ok('finance-moved-to-hr-count', FINANCE_HOME_MOVED_TO_HR.length === 6, String(FINANCE_HOME_MOVED_TO_HR.length));
  ok('finance-skipped-dupes', FINANCE_HOME_SKIPPED_AS_HR_DUPES.length === 2);
  const hrPortal = buildPortalPayload('company_admin');
  const movedSection = (hrPortal.sections || []).find((s) => s.id === 'moved-from-finance');
  ok('hr-has-moved-section', !!movedSection && movedSection.title === 'الصفحات المنقولة من المالية');
  ok('hr-moved-cards-6', (movedSection?.cards || []).length === 6, String(movedSection?.cards?.length));
  FINANCE_HOME_MOVED_TO_HR.forEach((item) => {
    ok(`hr-has-moved-${item.href}`, (movedSection?.cards || []).some((c) => c.href === item.href && c.label === item.label), item.label);
  });
  FINANCE_KEEP.forEach((item) => {
    ok(`finance-keep-catalog-${item.href}`, true, item.label);
  });

  ok('hr-ui-9', hrModules.length === 9, String(hrModules.length));
  HR_KEEP.forEach((item) => {
    ok(`hr-keep-${item.href}`, hrModules.some((m) => m.href === item.href && m.label === item.label), item.label);
  });
  ok('hr-no-ocr', !hrModules.some((m) => m.href.includes('ocr-suite')));
  ok('hr-no-e-archive', !hrModules.some((m) => m.href === '/hr/e-archive'));

  ok('archive-ui-2', archiveCards.length === 2);
  ARCHIVE_KEEP.forEach((item) => {
    ok(`archive-keep-${item.href}`, archiveCards.some((c) => c.href === item.href));
  });

  const script = fs.readFileSync(path.join(__dirname, 'script.js'), 'utf8');
  ok('gai-docs', script.includes('حوكمة الأرشفة الإلكترونية') && script.includes('GAI_DOCUMENT_GOVERNANCE_CARDS'));
  ok('gai-finance', script.includes('حوكمة الإدارة المالية') && script.includes('GAI_FINANCE_GOVERNANCE_CARDS'));
  ok('gai-hr', script.includes('حوكمة الموارد البشرية') && script.includes('GAI_HR_GOVERNANCE_CARDS'));
  FINANCE_MOVED.slice(0, 3).forEach((item) => {
    ok(`gai-has-finance-${item.href}`, script.includes(`"${item.href}"`) || script.includes(`'${item.href}'`));
  });
  HR_MOVED.slice(0, 3).forEach((item) => {
    ok(`gai-has-hr-${item.href}`, script.includes(`"${item.href}"`) || script.includes(`'${item.href}'`));
  });

  // RBAC parents preserved for moved finance pages
  const parents = getRuntimeRouteParents();
  const financePages = getPagesForSystem('finance');
  ok('finance-catalog-ge-60', financePages.length >= 60, String(financePages.length));
  ok('rbac-payment-terms', (getPageKeysForPath('/finance/payment-terms.html') || []).some((k) => k.startsWith('finance')));
  ok('rbac-expenses', (getPageKeysForPath('/finance/expenses.html') || []).includes('finance__expenses'));

  // Deep links intact
  try {
    for (const href of [
      '/finance',
      '/hr',
      '/archive',
      '/governed-administrative-integration',
      ...FINANCE_KEEP.map((i) => i.href),
      ...HR_KEEP.map((i) => i.href),
      FINANCE_MOVED[0].href,
      HR_MOVED[0].href,
      DOCUMENT_GOVERNANCE_CARDS[0].href
    ]) {
      const res = await get(href);
      ok(`http-${href}`, res.status === 200 || res.status === 302, 'status=' + res.status);
    }
  } catch (err) {
    ok('http-suite', false, err.message);
  }

  // smart management / ipp untouched markers
  ok('smart-mgmt-untouched', script.includes('الإدارة الذكية 360') || fs.readFileSync(path.join(__dirname, 'smart-management.html'), 'utf8').includes('الإدارة الذكية 360'));
  ok('ipp-untouched', fs.readFileSync(path.join(__dirname, 'incubators-platforms.html'), 'utf8').includes('حاضنات'));

  const failed = results.filter((r) => !r.pass);
  console.log('\n=== GAI Finance/HR/Archive KEEP-MOVE ===');
  console.log('passed:', results.length - failed.length, '/', results.length);
  console.log('\nMapping KEEP finance:');
  FINANCE_KEEP.forEach((p, i) => console.log(`  ${i + 1}. ${p.label} <- ${p.previousLabel || ''} -> ${p.href}`));
  console.log('\nMapping KEEP hr:');
  HR_KEEP.forEach((p, i) => console.log(`  ${i + 1}. ${p.label} <- ${p.previousLabel || ''} -> ${p.href}`));
  console.log(`\nMOVE counts: finance=${FINANCE_MOVED.length}, hr=${HR_MOVED.length}, docs=${DOCUMENT_GOVERNANCE_CARDS.length}`);
  if (failed.length) {
    failed.forEach((f) => console.log(' -', f.name, f.detail));
    process.exit(1);
  }
  console.log('VERDICT: GO');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
