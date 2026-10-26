'use strict';

/**
 * Smoke + functional checks for finance workbench UI rebuild.
 */
const fs = require('fs');
const http = require('http');

const PORT = Number(process.env.PORT || 3083);
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

async function main() {
  const login = await httpReq('POST', '/api/auth/login', {
    email: 'admin@naiosh.com',
    password: 'Admin@123'
  });
  const setCookie = login.headers['set-cookie'] || [];
  const cookie = Array.isArray(setCookie) ? setCookie.map((c) => c.split(';')[0]).join('; ') : '';
  const token = login.json?.data?.session?.token || '';
  login.status === 200 && token ? pass('login') : fail('login', String(login.status));
  const auth = { Authorization: `Bearer ${token}`, Cookie: cookie };

  const pages = [
    ['/finance/accounting-integration.html', ['finance-workbench.css', 'fw-drawer', 'سجل الترحيل']],
    ['/finance/payments.html', ['finance-workbench.css', 'fw-drawer', 'تحصيل جديد']],
    ['/manage-tax-settings.html', ['finance-workbench.css', 'سجل التدقيق', 'effective_from']],
    ['/finance/quick-offers.html', ['finance-workbench.css', 'fw-drawer', 'سجل العروض', 'تفعيل', '/finance/quick-offers']],
    ['/finance/plan-installments.html', ['finance-workbench.css', 'fw-drawer', 'جدول الاستحقاقات', '/finance/plan-installments']],
    ['/finance/item-invoice-discounts.html', ['finance-workbench.css', 'fw-drawer', 'سجل قواعد الخصم', '/finance/item-discounts']],
    ['/finance/pos.html', ['ops-shell.css', 'ops-ui.js', 'data-kind="pos-tickets"']],
    ['/finance/e-invoice-queue.html', ['ops-shell.css', 'e-invoice-queue']],
    ['/finance/expenses.html', ['التكامل المحاسبي', 'max-width:1680px']],
    ['/finance/finance-workbench.js', ['FinanceWorkbench', 'paginate']],
    ['/finance/finance-workbench.css', ['fw-shell', '1680px']]
  ];

  for (const [path, needles] of pages) {
    const r = await httpReq('GET', path, null, auth);
    if (r.status !== 200) {
      fail(`page ${path}`, `HTTP ${r.status}`);
      continue;
    }
    const missing = needles.filter((n) => !r.raw.includes(n));
    missing.length
      ? fail(`page ${path}`, `missing ${missing.join(', ')}`)
      : pass(`page ${path}`);
  }

  const detail = await httpReq('GET', '/finance/accounting-integration/overview', null, auth);
  detail.status === 200 && detail.json?.success
    ? pass('acct-overview-api')
    : fail('acct-overview-api', detail.raw.slice(0, 200));

  const links = await httpReq('GET', '/finance/accounting-integration/links?limit=5', null, auth);
  if (links.status === 200 && links.json?.items?.length) {
    const id = links.json.items[0].entry_id;
    const je = await httpReq('GET', `/finance/accounting-integration/journals/${id}`, null, auth);
    je.status === 200 && je.json?.entry && Array.isArray(je.json.lines)
      ? pass('acct-journal-detail', je.json.entry.entry_number)
      : fail('acct-journal-detail', je.raw.slice(0, 200));
  } else {
    pass('acct-journal-detail-skipped', 'no journals yet');
  }

  const pays = await httpReq('GET', '/finance/payments?entity_id=HQ001&limit=5', null, auth);
  pays.status === 200 && pays.json?.success
    ? pass('payments-api', String(pays.json.count || 0))
    : fail('payments-api', pays.raw.slice(0, 200));

  const tax = await httpReq('GET', '/api/tax-settings', null, auth);
  Array.isArray(tax.json)
    ? pass('tax-api', String(tax.json.length))
    : fail('tax-api', tax.raw.slice(0, 200));

  const offers = await httpReq('GET', '/finance/quick-offers?entity_id=HQ001', null, auth);
  offers.status === 200 && offers.json?.success && Array.isArray(offers.json.offers)
    ? pass('quick-offers-api', String(offers.json.offers.length))
    : fail('quick-offers-api', offers.raw.slice(0, 200));

  const offerCode = `UI-WB-${Date.now().toString(36).toUpperCase()}`;
  const createOffer = await httpReq('POST', '/finance/quick-offers', {
    entity_id: 'HQ001',
    offer_code: offerCode,
    title: 'عرض اختبار منضدة',
    category: 'اختبار UI',
    discount_type: 'percent',
    discount_value: 7.5,
    max_discount_pct: 15,
    start_at: new Date().toISOString(),
    end_at: new Date(Date.now() + 5 * 86400000).toISOString(),
    channels: 'invoice,pos',
    item_codes: '',
    priority: 'متوسط',
    notes: 'wave-2 workbench smoke'
  }, auth);
  const createdId = createOffer.json?.offer?.id;
  createOffer.status === 200 || createOffer.status === 201
    ? pass('quick-offers-create', String(createdId || createOffer.status))
    : fail('quick-offers-create', createOffer.raw.slice(0, 240));

  if (createdId) {
    const activate = await httpReq('POST', `/finance/quick-offers/${createdId}/activate`, { entity_id: 'HQ001' }, auth);
    activate.status === 200 && (activate.json?.offer?.status === 'active' || activate.json?.success)
      ? pass('quick-offers-activate')
      : fail('quick-offers-activate', activate.raw.slice(0, 240));
    const deactivate = await httpReq('POST', `/finance/quick-offers/${createdId}/deactivate`, { entity_id: 'HQ001' }, auth);
    deactivate.status === 200
      ? pass('quick-offers-deactivate')
      : fail('quick-offers-deactivate', deactivate.raw.slice(0, 240));
  } else {
    fail('quick-offers-activate', 'no id');
    fail('quick-offers-deactivate', 'no id');
  }

  const installments = await httpReq('GET', '/finance/plan-installments?entity_id=HQ001', null, auth);
  installments.status === 200 && installments.json?.success && Array.isArray(installments.json.rows)
    ? pass('plan-installments-api', String(installments.json.rows.length))
    : fail('plan-installments-api', installments.raw.slice(0, 200));

  const discList = await httpReq('GET', '/finance/item-discounts?entity_id=HQ001', null, auth);
  discList.status === 200 && discList.json?.success && Array.isArray(discList.json.discounts)
    ? pass('item-discounts-api', String(discList.json.discounts.length))
    : fail('item-discounts-api', discList.raw.slice(0, 200));

  const discCode = `DS-UI-${Date.now().toString(36).toUpperCase()}`;
  const createDisc = await httpReq('POST', '/finance/item-discounts', {
    entity_id: 'HQ001',
    code: discCode,
    name: 'خصم منضدة اختبار',
    scope: 'فاتورة',
    discount_type: 'نسبة',
    value: 5,
    cap_amount: 200,
    min_qty: 1,
    min_invoice: 50,
    start_date: new Date().toISOString().slice(0, 10),
    end_date: new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10),
    channel: 'invoice',
    approval: 'تلقائي',
    status: 'نشط',
    created_by: 'ui-workbench-test'
  }, auth);
  const discId = createDisc.json?.discount?.id;
  createDisc.status === 200 || createDisc.status === 201
    ? pass('item-discounts-create', String(discId || createDisc.status))
    : fail('item-discounts-create', createDisc.raw.slice(0, 240));
  if (discId) {
    const pause = await httpReq('PUT', `/finance/item-discounts/${discId}`, { status: 'موقوف' }, auth);
    pause.status === 200 ? pass('item-discounts-pause') : fail('item-discounts-pause', pause.raw.slice(0, 200));
  } else {
    fail('item-discounts-pause', 'no id');
  }

  const opsUi = await httpReq('GET', '/finance/ops-ui.js', null, auth);
  opsUi.raw.includes('ops-drawer') && opsUi.raw.includes('status-filter') && opsUi.raw.includes('pg-next')
    ? pass('ops-ui-workbench-features')
    : fail('ops-ui-workbench-features');

  const summary = {
    at: new Date().toISOString(),
    passed: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok).length,
    results
  };
  fs.writeFileSync(`${ART}/finance-ui-workbench-test-results.json`, JSON.stringify(summary, null, 2));
  console.log(`\nSummary: ${summary.passed} passed, ${summary.failed} failed`);
  process.exit(summary.failed ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
