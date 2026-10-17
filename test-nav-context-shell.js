'use strict';

const fs = require('fs');
const path = require('path');
const http = require('http');
const {
  resolveNavigationContext,
  getNavigationPayload
} = require('./gai-hub-navigation');

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
    req.setTimeout(20000, () => { req.destroy(new Error('timeout')); });
  });
}

function extractNavPayload(html) {
  const m = html.match(/window\.__NAIOSH_NAV_PAYLOAD__\s*=\s*(\{[\s\S]*?\});/);
  if (!m) return null;
  try { return JSON.parse(m[1]); } catch { return null; }
}

async function main() {
  const shell = fs.readFileSync(path.join(__dirname, 'finance/hr-portal-shell.js'), 'utf8');
  ok('shell-reads-payload', shell.includes('__NAIOSH_NAV_PAYLOAD__') && shell.includes('getNavPayload'));
  ok('shell-no-css-hide-hack', !/display\s*:\s*none\s*!important[\s\S]{0,40}hr-sidebar/.test(shell));
  ok('ctx-archive', resolveNavigationContext('/hr/e-archive') === 'archive');
  ok('ctx-mail', resolveNavigationContext('/hr/inbound-outbound-mail') === 'archive');
  ok('ctx-ocr', resolveNavigationContext('/hr/ocr-suite') === 'gai-docs');
  ok('ctx-hr-keep', resolveNavigationContext('/hr/employee-360') === 'hr');
  ok('ctx-hr-home', resolveNavigationContext('/hr') === 'hr');
  ok('ctx-hr-manager', resolveNavigationContext('/hr/manager') === 'hr');
  ok('ctx-finance-keep', resolveNavigationContext('/hr/assets-custodies') === 'finance-keep');
  ok('ctx-finance-moved', resolveNavigationContext('/finance/payment-terms.html') === 'gai-finance');
  ok('ctx-hr-moved', resolveNavigationContext('/hr/employees') === 'gai-hr');
  ok('ctx-my-requests-moved', resolveNavigationContext('/hr/my-requests') === 'gai-hr');

  const archivePayload = getNavigationPayload('/hr/e-archive');
  ok('archive-not-hr-nav', archivePayload.usesHrDefaultNav === false);
  ok('archive-has-two-entries', (archivePayload.links || []).some((l) => l.href === '/hr/e-archive')
    && (archivePayload.links || []).some((l) => l.href === '/hr/inbound-outbound-mail'));
  ok('archive-brand', archivePayload.brandTitle.includes('الأرشفة') || archivePayload.brandSubtitle.includes('أرشفة'));

  try {
    for (const [href, expectCtx] of [
      ['/hr/e-archive', 'archive'],
      ['/hr/inbound-outbound-mail', 'archive'],
      ['/hr/ocr-suite', 'gai-docs'],
      ['/hr/employee-360', 'hr'],
      ['/finance/payment-terms.html', 'gai-finance']
    ]) {
      const res = await get(href);
      ok(`http-${href}`, res.status === 200 || res.status === 302, 'status=' + res.status);
      if (res.status === 200) {
        const payload = extractNavPayload(res.body);
        ok(`payload-${href}`, payload && payload.context === expectCtx, JSON.stringify(payload && payload.context));
        if (expectCtx === 'archive' || expectCtx === 'gai-docs' || expectCtx === 'gai-finance') {
          ok(`no-hr-brand-${href}`, payload && !String(payload.brandSubtitle || '').includes('نظام الموارد البشرية'));
        }
        if (expectCtx === 'hr') {
          ok(`hr-default-${href}`, payload && payload.usesHrDefaultNav === true);
        }
      }
    }
  } catch (err) {
    ok('http-suite', false, err.message);
  }

  const failed = results.filter((r) => !r.pass);
  console.log('\n=== Navigation Context Shell ===');
  console.log('passed:', results.length - failed.length, '/', results.length);
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
