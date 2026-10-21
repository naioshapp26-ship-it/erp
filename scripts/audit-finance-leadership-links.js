'use strict';

/**
 * Audit Finance Leadership 360 catalog links (isolated local).
 * Classifies: coming_soon, missing_file, localStorage_only, ok_page, wrong_status.
 * Does not mutate Production.
 */

const fs = require('fs');
const http = require('http');
const path = require('path');
const {
  SECTIONS,
  QUICK_ACCESS,
  PAGE_SETTINGS,
  COMING,
  resolveHref,
  STATUS_LABEL
} = require('../finance/finance-leadership-360-catalog.js');

const PORT = Number(process.env.PORT || 3010);
const BASE = `http://127.0.0.1:${PORT}`;
const ART = '/opt/cursor/artifacts';
const ROOT = '/workspace';

function httpGet(urlPath, headers = {}) {
  return new Promise((resolve) => {
    const u = new URL(urlPath, BASE);
    const req = http.request(
      {
        hostname: u.hostname,
        port: u.port,
        path: u.pathname + u.search,
        method: 'GET',
        headers
      },
      (res) => {
        let raw = '';
        res.on('data', (c) => (raw += c));
        res.on('end', () => resolve({ status: res.statusCode, raw, headers: res.headers }));
      }
    );
    req.on('error', (e) => resolve({ status: 0, raw: String(e.message), headers: {} }));
    req.setTimeout(15000, () => {
      req.destroy();
      resolve({ status: 0, raw: 'timeout', headers: {} });
    });
    req.end();
  });
}

function httpJson(method, urlPath, body, headers = {}) {
  const payload = body == null ? null : JSON.stringify(body);
  return new Promise((resolve) => {
    const u = new URL(urlPath, BASE);
    const req = http.request(
      {
        hostname: u.hostname,
        port: u.port,
        path: u.pathname + u.search,
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
          ...headers
        }
      },
      (res) => {
        let raw = '';
        res.on('data', (c) => (raw += c));
        res.on('end', () => {
          let json = null;
          try {
            json = raw ? JSON.parse(raw) : null;
          } catch {
            /* */
          }
          resolve({ status: res.statusCode, json, raw });
        });
      }
    );
    req.on('error', (e) => resolve({ status: 0, json: null, raw: String(e.message) }));
    req.end(payload || undefined);
  });
}

function fileExistsForHref(href) {
  if (!href || href.startsWith(COMING)) return { kind: 'coming_soon_target' };
  const clean = href.split('?')[0];
  if (clean.startsWith('/finance/') && clean.endsWith('.html')) {
    const fp = path.join(ROOT, clean.replace(/^\//, ''));
    return { kind: 'finance_html', exists: fs.existsSync(fp), path: fp };
  }
  if (clean.endsWith('.html')) {
    const fp = path.join(ROOT, clean.replace(/^\//, ''));
    return { kind: 'root_html', exists: fs.existsSync(fp), path: fp };
  }
  // app routes (/hr/..., /settings/...) — existence checked via HTTP
  return { kind: 'app_route', exists: null, path: clean };
}

function detectLocalStorageOnly(html) {
  if (!html) return false;
  const hasLS = /localStorage\.(get|set)Item/.test(html);
  const hasFetchFinance = /fetch\s*\(\s*[`'"][^`'"]*\/finance\//.test(html);
  const hasApi = /\/api\//.test(html) && /fetch\s*\(/.test(html);
  return hasLS && !hasFetchFinance && !hasApi;
}

function collectEntries() {
  const rows = [];
  for (const section of SECTIONS) {
    for (const page of section.pages) {
      rows.push({
        group: 'section',
        sectionId: section.id,
        sectionLabel: section.label,
        id: page.id,
        label: page.label,
        status: page.status,
        statusLabel: STATUS_LABEL[page.status] || page.status,
        catalogHref: page.href,
        resolvedHref: resolveHref(page, section.id),
        note: page.note || ''
      });
    }
  }
  for (const page of QUICK_ACCESS) {
    rows.push({
      group: 'quick_access',
      sectionId: 'qa',
      sectionLabel: 'الوصول السريع',
      id: page.id,
      label: page.label,
      status: page.status,
      statusLabel: STATUS_LABEL[page.status] || page.status,
      catalogHref: page.href,
      resolvedHref: page.href || COMING,
      note: page.note || ''
    });
  }
  for (const page of PAGE_SETTINGS) {
    rows.push({
      group: 'page_settings',
      sectionId: 'pagesettings',
      sectionLabel: 'إعدادات الصفحات',
      id: page.id,
      label: page.label,
      status: page.status,
      statusLabel: STATUS_LABEL[page.status] || page.status,
      catalogHref: page.href,
      resolvedHref: page.href || `${COMING}?section=pagesettings&page=${encodeURIComponent(page.id)}`,
      note: page.note || ''
    });
  }
  return rows;
}

/** Candidate real pages that might match coming_soon labels (manual map candidates). */
const CANDIDATE_REAL_PAGES = {
  'sales.deposits': '/finance/deposits-advance-payments.html', // localStorage only — keep coming_soon
  'accounts.checks': null,
  'reports.report-export': null,
  'pagesettings.purchase-orders': '/finance/purchase-orders.html',
  'pagesettings.journal-entries': '/finance/journal.html',
  'pagesettings.customers': '/finance/customers.html',
  'pagesettings.sales-invoices': '/finance/invoices-budgets-master.html',
  'bank': '/finance/bank-accounts.html'
};

async function login() {
  const r = await httpJson('POST', '/api/auth/login', {
    email: 'admin@naiosh.com',
    password: 'Admin@123'
  });
  if (!r.json || !r.json.success) throw new Error('login failed');
  const s = r.json.data.session;
  return typeof s === 'object' ? s.token : s;
}

async function main() {
  fs.mkdirSync(ART, { recursive: true });
  const token = await login();
  const auth = { Authorization: `Bearer ${token}` };
  const entries = collectEntries();
  const results = [];

  for (const e of entries) {
    const href = e.resolvedHref;
    const isComing = !e.catalogHref || href.includes('leadership-coming-soon');
    const fileInfo = fileExistsForHref(href);
    let httpStatus = null;
    let bodySnippet = '';
    let localStorageOnly = false;
    let emptyShell = false;
    let issues = [];

    if (isComing && e.status === 'coming_soon') {
      // intentional
    } else if (isComing && e.status !== 'coming_soon') {
      issues.push('status_not_coming_but_resolves_to_coming_soon');
    }

    if (fileInfo.kind === 'finance_html' || fileInfo.kind === 'root_html') {
      if (fileInfo.exists === false) issues.push('missing_html_file');
    }

    const probe = await httpGet(href.split('?')[0], auth);
    httpStatus = probe.status;
    bodySnippet = (probe.raw || '').replace(/\s+/g, ' ').slice(0, 180);
    if (httpStatus && httpStatus >= 400) issues.push(`http_${httpStatus}`);
    if (probe.raw && detectLocalStorageOnly(probe.raw)) {
      localStorageOnly = true;
      if (e.status === 'operational') issues.push('operational_but_localStorage_only');
    }
    if (
      probe.raw &&
      /leadership-coming-soon/.test(href) === false &&
      (/قريبًا|قيد التطوير|coming soon/i.test(probe.raw) &&
        !/openAddInvoice|loadCustomers|loadPayments|loadReport|loadJournal/.test(probe.raw))
    ) {
      emptyShell = true;
      issues.push('page_looks_like_placeholder');
    }

    // candidate fix if coming_soon but a real page map exists and is not localStorage
    const key = `${e.sectionId}.${e.id}`;
    const candidate = CANDIDATE_REAL_PAGES[key];
    let suggestedHref = null;
    if (e.status === 'coming_soon' && candidate) {
      suggestedHref = candidate;
    }

    results.push({
      ...e,
      isComingSoonTarget: isComing,
      fileExists: fileInfo.exists,
      httpStatus,
      localStorageOnly,
      emptyShell,
      issues,
      suggestedHref,
      bodySnippet
    });
  }

  // Core API smoke for basic finance backends (isolated)
  const coreApis = [
    ['customers', '/finance/customers?entity_id=HQ001', 'customers'],
    ['invoices', '/finance/invoices?entity_id=HQ001&limit=5', 'invoices'],
    ['payments', '/finance/payments?entity_id=HQ001&limit=5', 'payments'],
    ['expenses', '/finance/expenses?entity_id=HQ001', 'expenses'],
    ['journal', '/finance/journal/entries?entity_id=HQ001', 'entries'],
    ['budgets', '/finance/budgets?entity_id=HQ001', 'budgets'],
    ['purchase-orders', '/finance/purchases/orders?entity_id=HQ001', 'orders'],
    ['item-discounts', '/finance/item-discounts?entity_id=HQ001', 'discounts'],
    ['fixed-assets', '/finance/fixed-assets?entity_id=HQ001', 'assets'],
    ['coa', '/finance/chart-of-accounts?entity_id=HQ001', 'accounts'],
    ['ar-aging', '/finance/ar-aging?entity_id=HQ001', 'rows']
  ];
  const apiSmoke = [];
  for (const [name, p, key] of coreApis) {
    const r = await httpJson('GET', p, null, auth);
    const list = (r.json && (r.json[key] || r.json.data)) || [];
    apiSmoke.push({
      name,
      path: p,
      status: r.status,
      success: !!(r.json && r.json.success !== false),
      n: Array.isArray(list) ? list.length : r.json?.count ?? null,
      error: r.json?.error || null
    });
  }

  // Entity spoof check (office if available)
  let entityGate = { officeSpoof: null };
  const officeLogin = await httpJson('POST', '/api/auth/login', {
    email: 'office-fin-sec-test@naiosh.local',
    password: 'Office@123'
  });
  if (officeLogin.json && officeLogin.json.success) {
    const ot =
      typeof officeLogin.json.data.session === 'object'
        ? officeLogin.json.data.session.token
        : officeLogin.json.data.session;
    const spoof = await httpJson('GET', '/finance/invoices?limit=3', null, {
      Authorization: `Bearer ${ot}`,
      'x-entity-id': 'HQ001',
      'x-entity-type': 'HQ'
    });
    entityGate.officeSpoof = { status: spoof.status, ok: spoof.status === 403 };
  } else {
    entityGate.officeSpoof = { status: 'no_office_user', ok: null };
  }

  const summary = {
    total: results.length,
    coming_soon: results.filter((r) => r.status === 'coming_soon').length,
    operational: results.filter((r) => r.status === 'operational').length,
    partial: results.filter((r) => r.status === 'partial').length,
    with_issues: results.filter((r) => r.issues.length).length,
    coming_soon_targets: results.filter((r) => r.isComingSoonTarget).length,
    localStorage_only: results.filter((r) => r.localStorageOnly).length,
    missing_files: results.filter((r) => r.issues.includes('missing_html_file')).length,
    http_errors: results.filter((r) => r.issues.some((i) => i.startsWith('http_'))).length
  };

  const out = {
    generated_at: new Date().toISOString(),
    summary,
    apiSmoke,
    entityGate,
    issues: results.filter((r) => r.issues.length),
    all: results
  };
  fs.writeFileSync(path.join(ART, 'finance-leadership-links-audit.json'), JSON.stringify(out, null, 2));

  // Markdown table (concise)
  const lines = [
    '# Finance Leadership 360 — Link Audit',
    '',
    `Generated: ${out.generated_at}`,
    '',
    `Total cards: ${summary.total} | operational=${summary.operational} | partial=${summary.partial} | coming_soon=${summary.coming_soon}`,
    `Issues: ${summary.with_issues} | coming-soon targets: ${summary.coming_soon_targets} | localStorage-only: ${summary.localStorage_only}`,
    '',
    '## Cards with issues',
    '',
    '| الوظيفة | الرابط | الحالة | المشاكل |',
    '|---|---|---|---|'
  ];
  for (const r of out.issues) {
    lines.push(
      `| ${r.label} | \`${r.resolvedHref}\` | ${r.statusLabel} | ${r.issues.join(', ') || '—'} |`
    );
  }
  lines.push('', '## Core API smoke', '');
  lines.push('| API | HTTP | success | n |', '|---|---|---|---|');
  for (const a of apiSmoke) {
    lines.push(`| ${a.name} | ${a.status} | ${a.success} | ${a.n} |`);
  }
  fs.writeFileSync(path.join(ART, 'finance-leadership-links-audit.md'), lines.join('\n'));

  console.log(JSON.stringify(summary, null, 2));
  console.log('entityGate', entityGate);
  console.log('issues', out.issues.length);
  out.issues.slice(0, 40).forEach((r) => {
    console.log('-', r.sectionId + '.' + r.id, r.status, r.resolvedHref, '→', r.issues.join('|'));
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
