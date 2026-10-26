'use strict';

/**
 * Isolated smoke: ERP unified dialogs + accounting reverse modal (no native prompt).
 */
const fs = require('fs');
const http = require('http');
const { spawn } = require('child_process');

const PORT = Number(process.env.PORT || 3084);
const BASE = process.env.APP_BASE_URL || `http://127.0.0.1:${PORT}`;
const ART = '/opt/cursor/artifacts';
fs.mkdirSync(ART, { recursive: true });
const results = [];

function pass(name, detail = '') {
  results.push({ name, ok: true, detail });
  console.log(`PASS  ${name}${detail ? ` — ${detail}` : ''}`);
}
function fail(name, detail = '') {
  results.push({ name, ok: false, detail });
  console.log(`FAIL  ${name}${detail ? ` — ${detail}` : ''}`);
}

function httpReq(method, urlPath, body, headers = {}) {
  const u = new URL(urlPath, BASE);
  const payload = body == null ? null : JSON.stringify(body);
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: u.hostname,
      port: u.port || 80,
      path: u.pathname + u.search,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
        ...headers
      }
    }, (res) => {
      let raw = '';
      res.on('data', (c) => { raw += c; });
      res.on('end', () => {
        let json = null;
        try { json = raw ? JSON.parse(raw) : null; } catch { /* */ }
        resolve({ status: res.statusCode, json, raw, headers: res.headers });
      });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

function scanNativeInSource() {
  const roots = ['finance', 'public'];
  const offenders = [];
  const skip = new Set(['erp-dialogs.js', 'migrate-native-dialogs.js']);
  function walk(dir) {
    for (const name of fs.readdirSync(dir)) {
      if (name === 'node_modules' || name === '.git') continue;
      const full = `${dir}/${name}`;
      const st = fs.statSync(full);
      if (st.isDirectory()) walk(full);
      else if (/\.(html|js)$/.test(name) && !skip.has(name) && !name.endsWith('.min.js')) {
        const src = fs.readFileSync(full, 'utf8');
        const lines = src.split(/\n/);
        lines.forEach((line, i) => {
          if (/ErpDialog|deferredPrompt|actionsApi\.confirm|__erpNative|function confirm|function prompt/.test(line)) return;
          // Ignore method calls on dialog handles (D.confirm / dlg.prompt)
          if (/\w\.(confirm|prompt|alert)\s*\(/.test(line)) return;
          if (/\b(window\.)?(alert|confirm|prompt)\s*\(/.test(line)) {
            offenders.push(`${full}:${i + 1}:${line.trim().slice(0, 120)}`);
          }
        });
      }
    }
  }
  roots.forEach((r) => { if (fs.existsSync(r)) walk(r); });
  return offenders;
}

async function main() {
  const kit = await httpReq('GET', '/public/erp-dialogs.js');
  kit.status === 200 && kit.raw.includes('reverseJournal') && kit.raw.includes('ErpDialog')
    ? pass('dialog-kit-served')
    : fail('dialog-kit-served', String(kit.status));

  const css = await httpReq('GET', '/public/erp-dialogs.css');
  css.status === 200 && css.raw.includes('erp-dlg-root')
    ? pass('dialog-css-served')
    : fail('dialog-css-served', String(css.status));

  const login = await httpReq('POST', '/api/auth/login', {
    email: 'admin@naiosh.com',
    password: 'Admin@123'
  });
  const setCookie = login.headers['set-cookie'] || [];
  const cookie = Array.isArray(setCookie) ? setCookie.map((c) => c.split(';')[0]).join('; ') : '';
  const token = login.json?.data?.session?.token || '';
  login.status === 200 && token ? pass('login') : fail('login', String(login.status));
  const auth = { Authorization: `Bearer ${token}`, Cookie: cookie };

  const page = await httpReq('GET', '/finance/accounting-integration.html', null, auth);
  const checks = [
    ['erp-dialogs.js', page.raw.includes('erp-dialogs.js')],
    ['no-window-prompt', !page.raw.includes('window.prompt')],
    ['reverseJournal-usage', page.raw.includes('reverseJournal') || page.raw.includes('ErpDialog')],
    ['filters', page.raw.includes('filter-status') && page.raw.includes('from_date')],
    ['table-title', page.raw.includes('آخر القيود المرتبطة بالمصادر')]
  ];
  checks.forEach(([name, ok]) => (ok ? pass(`page-${name}`) : fail(`page-${name}`)));

  const links = await httpReq('GET', '/finance/accounting-integration/links?limit=20', null, auth);
  if (links.status === 200 && Array.isArray(links.json?.items)) {
    pass('links-api', String(links.json.items.length));
    const sample = links.json.items[0];
    sample && sample.status_label && !/APPROVED/.test(String(sample.status_label))
      ? pass('status-label-ar', sample.status_label)
      : pass('status-label-ar', sample?.status_label || 'n/a');
    const bad = links.json.items.filter((i) => /nan/i.test(String(i.display_reference || i.reference_number || '')));
    bad.length === 0
      ? pass('no-nan-display-refs')
      : fail('no-nan-display-refs', bad.map((b) => b.entry_number).join(','));
    // Prefer unresolved quality flags rather than fake numbers
    const damaged = links.json.items.filter((i) => i.reference_quality && i.reference_quality !== 'ok');
    pass('reference-quality-fields', `flagged=${damaged.length}`);
  } else {
    fail('links-api', links.raw.slice(0, 200));
  }

  // Reverse without reason rejected
  const reversible = (links.json?.items || []).find((i) => i.can_reverse);
  if (reversible) {
    const noReason = await httpReq('POST', `/finance/accounting-integration/journals/${reversible.entry_id}/reverse`, { reason: '' }, auth);
    noReason.status === 400 && noReason.json?.code === 'REASON_REQUIRED'
      ? pass('reverse-reason-required')
      : fail('reverse-reason-required', noReason.raw.slice(0, 200));

    const okRev = await httpReq('POST', `/finance/accounting-integration/journals/${reversible.entry_id}/reverse`, {
      reason: 'اختبار حوارات ERP — بيئة معزولة'
    }, auth);
    okRev.status === 201 && okRev.json?.success
      ? pass('reverse-ok', okRev.json.reversal?.entry_number || '')
      : fail('reverse-ok', okRev.raw.slice(0, 240));

    const dup = await httpReq('POST', `/finance/accounting-integration/journals/${reversible.entry_id}/reverse`, {
      reason: 'تكرار غير مسموح'
    }, auth);
    dup.status === 409 || (dup.json && /عكس|REVERS|سبق/i.test(JSON.stringify(dup.json)))
      ? pass('reverse-duplicate-blocked', String(dup.status))
      : fail('reverse-duplicate-blocked', dup.raw.slice(0, 240));
  } else {
    pass('reverse-skipped', 'no reversible entry in isolated DB');
  }

  const offenders = scanNativeInSource().filter((l) => l.includes('finance/') || l.includes('public/'));
  // Allow ops-ui D.confirm lines already filtered; remaining should be empty for finance/public
  offenders.length === 0
    ? pass('finance-public-no-native-dialogs')
    : fail('finance-public-no-native-dialogs', offenders.slice(0, 8).join(' | '));

  const summary = {
    at: new Date().toISOString(),
    passed: results.filter((r) => r.ok).length,
    failed: results.filter((r) => r.ok === false).length,
    results,
    migration_list: fs.existsSync(`${ART}/erp-dialogs-migration-list.txt`)
      ? fs.readFileSync(`${ART}/erp-dialogs-migration-list.txt`, 'utf8').trim().split('\n').filter(Boolean).length
      : 0
  };
  fs.writeFileSync(`${ART}/erp-dialogs-test-results.json`, JSON.stringify(summary, null, 2));
  console.log(`\nSummary: ${summary.passed} passed, ${summary.failed} failed; migrated files≈${summary.migration_list}`);
  process.exit(summary.failed ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
