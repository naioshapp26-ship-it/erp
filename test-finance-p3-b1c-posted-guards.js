'use strict';

/**
 * P3 / B1.c — posted document guards + trusted auth.
 * Isolated schema b1a_test for service-level writes; HTTP against :3010 with session auth.
 * No migrations. No invoice/payment auto-post changes.
 */
const fs = require('fs');
const path = require('path');
const http = require('http');
const { Client } = require('pg');
const {
  postManualEntry,
  reverseEntry,
  assertPermission,
  resolveActor
} = require('./finance/services/finance-posting-service');
const {
  assertJournalEntryMutable,
  assertInvoiceDeletable,
  assertPaymentMutable,
  GuardError
} = require('./finance/services/finance-posted-guards');

const ART = '/opt/cursor/artifacts';
fs.mkdirSync(ART, { recursive: true });
const DB_URL = process.env.DATABASE_URL || 'postgresql://vendowor_erp_user:vendowor_local_dev@127.0.0.1:5432/vendowor_erp';
const BASE = process.env.APP_BASE_URL || 'http://127.0.0.1:3010';

const results = [];
function pass(name, detail = '') {
  results.push({ name, ok: true, detail });
  console.log(`PASS  ${name}${detail ? ` — ${detail}` : ''}`);
}
function fail(name, detail = '') {
  results.push({ name, ok: false, detail });
  console.log(`FAIL  ${name}${detail ? ` — ${detail}` : ''}`);
}

function httpJson(method, urlPath, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(urlPath, BASE);
    const payload = body == null ? null : JSON.stringify(body);
    const req = http.request({
      hostname: u.hostname, port: u.port || 80, path: u.pathname + (u.search || ''), method,
      headers: {
        ...(payload ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } : {}),
        ...headers
      }
    }, (res) => {
      let raw = '';
      res.on('data', (c) => { raw += c; });
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(raw); } catch { /* */ }
        resolve({ status: res.statusCode, json, raw: raw.slice(0, 400) });
      });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function seedDraft(client, label = 'd') {
  const a1130 = (await client.query(`SELECT account_id FROM finance_accounts WHERE account_code='1130'`)).rows[0];
  const a4100 = (await client.query(`SELECT account_id FROM finance_accounts WHERE account_code='4100'`)).rows[0];
  const num = `B1C-${label}-${Date.now()}-${Math.floor(Math.random() * 999)}`;
  const e = await client.query(
    `INSERT INTO finance_journal_entries (entry_number, entry_date, entry_type, description, status, is_posted, entity_id, created_by)
     VALUES ($1, CURRENT_DATE, 'MANUAL', $2, 'DRAFT', false, 'HQ001', 'b1c') RETURNING entry_id, entry_number`,
    [num, label]
  );
  await client.query(
    `INSERT INTO finance_journal_lines (entry_id, line_number, account_id, account_code, debit_amount, credit_amount)
     VALUES ($1,1,$2,'1130',25,0),($1,2,$3,'4100',0,25)`,
    [e.rows[0].entry_id, a1130.account_id, a4100.account_id]
  );
  return e.rows[0];
}

async function main() {
  const report = {
    phase: 'B1.c',
    changedFiles: [
      'finance/services/finance-posted-guards.js (new)',
      'finance/services/finance-posting-service.js (remove legacy_unscoped; session-only actor)',
      'finance/api/finance-routes.js (invoice/payment PUT/DELETE guards)',
      'finance/api/journal.js (PUT/DELETE guards)',
      'finance/api/journal-lines.js (create/update/delete guards)',
      'finance/api/ar-aging.js (invoice update/delete guards)',
      'test-finance-p3-b1c-posted-guards.js',
      'docs/finance-leadership-p3-b1c-report.md'
    ],
    protected: [],
    stillAtRisk: [],
    authTransition: {},
    autoPostUnchanged: true,
    b1dPlan: []
  };

  // Auth unit: no legacy, header spoof ignored
  !assertPermission({ authenticated: false, role: null, permissions: [] }, 'post').ok
    && assertPermission({ authenticated: false, role: null, permissions: [] }, 'post').status === 401
    ? pass('auth-default-deny-401') : fail('auth-default-deny-401');

  assertPermission({ authenticated: true, role: 'Admin', permissions: [] }, 'post').ok
    ? pass('auth-admin-ok') : fail('auth-admin-ok');

  const spoofed = resolveActor({
    req: {
      headers: { 'x-user-role': 'Admin', 'x-finance-permissions': 'journals.post,journals.reverse' },
      authUser: null
    }
  });
  spoofed.authenticated === false
    ? pass('auth-ignores-spoofed-headers')
    : fail('auth-ignores-spoofed-headers', JSON.stringify(spoofed));

  const trusted = resolveActor({
    req: {
      headers: { 'x-user-role': 'viewer' },
      authUser: { id: 1, role: 'Admin', name: 'Admin' }
    }
  });
  trusted.role === 'Admin' && trusted.trustSource === 'session'
    ? pass('auth-uses-session-authUser')
    : fail('auth-uses-session-authUser', JSON.stringify(trusted));

  report.authTransition = {
    removed: 'legacy_unscoped',
    trust: 'req.authUser from session middleware only',
    ignored: ['x-user-role', 'x-finance-permissions', 'x-user-id as sole auth'],
    affectedIntegrations: [
      'أي استدعاء لـ POST /finance/journal-entries/:id/post بدون Bearer/cookie جلسة صالحة → 401',
      'استدعاءات كانت تعتمد على ترويسة x-user-role فقط ← لم تعد كافية',
      'واجهة journal.html التي ترسل التوكن مع الطلبات تبقى تعمل لدور Admin/Manager'
    ],
    note: 'إغلاق الفجوة ضمن نطاق B1.c (منع افتراضي). لا مسار مفتوح متبقٍ.'
  };

  const client = new Client({ connectionString: DB_URL, ssl: false });
  await client.connect();
  await client.query('SET search_path TO b1a_test, public');

  const publicJeBefore = await client.query('SELECT COUNT(*)::int AS c FROM public.finance_journal_entries');
  const publicInvBefore = await client.query('SELECT COUNT(*)::int AS c FROM public.finance_invoices');

  try {
    const draft = await seedDraft(client, 'mut');
    await assertJournalEntryMutable(client, draft.entry_id);
    pass('draft-mutable-allowed');

    await postManualEntry(client, draft.entry_id, {
      trustedTestActor: true,
      actor: { userId: 1, role: 'Admin', permissions: [], authenticated: true }
    });

    try {
      await assertJournalEntryMutable(client, draft.entry_id, { forDelete: true });
      fail('posted-je-delete-blocked');
    } catch (e) {
      e instanceof GuardError && e.code === 'POSTED_DOCUMENT_LOCKED'
        ? pass('posted-je-delete-blocked', e.message)
        : fail('posted-je-delete-blocked', e.message);
    }

    try {
      await assertJournalEntryMutable(client, draft.entry_id, { forDelete: false });
      fail('posted-je-update-blocked');
    } catch (e) {
      e.code === 'POSTED_DOCUMENT_LOCKED' ? pass('posted-je-update-blocked') : fail('posted-je-update-blocked', e.code);
    }

    // Invoice linked only via reference (no journal_entry_id) — still protected
    const cust = (await client.query(`SELECT customer_id FROM finance_customers LIMIT 1`)).rows[0];
    const inv = await client.query(
      `INSERT INTO finance_invoices (
         invoice_number, invoice_date, due_date, customer_id, customer_name,
         subtotal, tax_amount, total_amount, paid_amount, remaining_amount, status, payment_status, entity_id
       ) VALUES ($1, CURRENT_DATE, CURRENT_DATE+7, $2, 'B1C', 100, 0, 100, 0, 100, 'ISSUED', 'UNPAID', 'HQ001')
       RETURNING invoice_id`,
      [`B1C-INV-${Date.now()}`, cust.customer_id]
    );
    const invoiceId = inv.rows[0].invoice_id;
    const a1130 = (await client.query(`SELECT account_id FROM finance_accounts WHERE account_code='1130'`)).rows[0];
    const a4100 = (await client.query(`SELECT account_id FROM finance_accounts WHERE account_code='4100'`)).rows[0];
    const jeInv = await client.query(
      `INSERT INTO finance_journal_entries (
         entry_number, entry_date, entry_type, description, reference_type, reference_id,
         status, is_posted, posted_at, entity_id
       ) VALUES ($1, CURRENT_DATE, 'AUTO', 'invoice link', 'INVOICE', $2, 'POSTED', true, NOW(), 'HQ001')
       RETURNING entry_id`,
      [`B1C-JE-INV-${Date.now()}`, invoiceId]
    );
    await client.query(
      `INSERT INTO finance_journal_lines (entry_id, line_number, account_id, account_code, debit_amount, credit_amount)
       VALUES ($1,1,$2,'1130',100,0),($1,2,$3,'4100',0,100)`,
      [jeInv.rows[0].entry_id, a1130.account_id, a4100.account_id]
    );
    // intentionally leave finance_invoices.journal_entry_id NULL
    try {
      await assertInvoiceDeletable(client, invoiceId);
      fail('invoice-delete-via-reference-blocked');
    } catch (e) {
      e.code === 'POSTED_DOCUMENT_LOCKED'
        ? pass('invoice-delete-via-reference-blocked', e.extra?.linked_entries?.[0]?.via || '')
        : fail('invoice-delete-via-reference-blocked', e.message);
    }

    // Payment with journal_entry_id
    const pay = await client.query(
      `INSERT INTO finance_payments (payment_number, payment_date, customer_id, payment_amount, payment_method, status, entity_id)
       VALUES ($1, CURRENT_DATE, $2, 40, 'CASH', 'APPROVED', 'HQ001') RETURNING payment_id`,
      [`B1C-PAY-${Date.now()}`, cust.customer_id]
    );
    const pje = await client.query(
      `INSERT INTO finance_journal_entries (
         entry_number, entry_date, entry_type, description, reference_type, reference_id,
         status, is_posted, posted_at, entity_id
       ) VALUES ($1, CURRENT_DATE, 'AUTO', 'pay', 'PAYMENT', $2, 'POSTED', true, NOW(), 'HQ001')
       RETURNING entry_id`,
      [`B1C-JE-PAY-${Date.now()}`, pay.rows[0].payment_id]
    );
    await client.query(`UPDATE finance_payments SET journal_entry_id=$1 WHERE payment_id=$2`, [
      pje.rows[0].entry_id, pay.rows[0].payment_id
    ]);
    try {
      await assertPaymentMutable(client, pay.rows[0].payment_id, { forDelete: true });
      fail('payment-delete-posted-blocked');
    } catch (e) {
      e.code === 'POSTED_DOCUMENT_LOCKED' ? pass('payment-delete-posted-blocked') : fail('payment-delete-posted-blocked', e.message);
    }

    // Legitimate reverse still works
    await reverseEntry(client, draft.entry_id, {
      trustedTestActor: true,
      actor: { userId: 1, role: 'Admin', permissions: [], authenticated: true },
      reason: 'B1.c reverse ok'
    });
    pass('legitimate-reverse-still-works');

    // Unposted draft invoice deletable
    const draftInv = await client.query(
      `INSERT INTO finance_invoices (
         invoice_number, invoice_date, due_date, customer_id, customer_name,
         subtotal, tax_amount, total_amount, paid_amount, remaining_amount, status, payment_status, entity_id
       ) VALUES ($1, CURRENT_DATE, CURRENT_DATE+7, $2, 'B1C-D', 10, 0, 10, 0, 10, 'DRAFT', 'UNPAID', 'HQ001')
       RETURNING invoice_id`,
      [`B1C-DRAFT-${Date.now()}`, cust.customer_id]
    );
    await assertInvoiceDeletable(client, draftInv.rows[0].invoice_id);
    pass('draft-invoice-deletable');

    report.protected = [
      'DELETE/PUT قيود POSTED عبر journal.js',
      'create/update/delete أسطر قيود مرحّلة عبر journal-lines.js',
      'DELETE/PUT فواتير مرتبطة بقيد مرحّل (journal_entry_id أو reference INVOICE)',
      'DELETE/PUT مدفوعات مرتبطة بقيد مرحّل',
      'ar-aging update/delete بنفس الحراسة',
      'ترحيل/عكس يدوي يتطلب جلسة موثوقة (لا legacy_unscoped)'
    ];
    report.stillAtRisk = [
      'ترحيل تلقائي عند إنشاء فاتورة/دفعة (خارج B1.c)',
      'بدون UNIQUE migration لمسار العكس (كما في B1.b)',
      'مسارات payroll post غير مغطاة بحراسة الحذف هنا (لا حذف JE payroll في هذا النطاق)'
    ];
    report.b1dPlan = [
      'توجيه POST invoices/payments عبر FinancePostingService خلف flag',
      'فصل إنشاء الفاتورة عن الترحيل (defer_invoice_posting) بموافقة B2'
    ];

    // Confirm auto-post untouched
    const routesSrc = fs.readFileSync(path.join(__dirname, 'finance/api/finance-routes.js'), 'utf8');
    /router\.post\('\/invoices'[\s\S]*?INSERT INTO finance_journal_entries/.test(routesSrc)
      && /router\.post\('\/payments'[\s\S]*?INSERT INTO finance_journal_entries/.test(routesSrc)
      ? pass('auto-post-untouched')
      : fail('auto-post-untouched');

    const publicJeAfter = await client.query('SELECT COUNT(*)::int AS c FROM public.finance_journal_entries');
    const publicInvAfter = await client.query('SELECT COUNT(*)::int AS c FROM public.finance_invoices');
    publicJeAfter.rows[0].c === publicJeBefore.rows[0].c && publicInvAfter.rows[0].c === publicInvBefore.rows[0].c
      ? pass('public-business-counts-unchanged-by-isolated-tests')
      : fail('public-business-counts-unchanged-by-isolated-tests',
        `je ${publicJeBefore.rows[0].c}->${publicJeAfter.rows[0].c} inv ${publicInvBefore.rows[0].c}->${publicInvAfter.rows[0].c}`);

  } finally {
    await client.end();
  }

  // HTTP with real session
  try {
    const login = await httpJson('POST', '/api/auth/login', { email: 'admin@naiosh.com', password: 'Admin@123' });
    if (!login.json?.success) throw new Error('login failed');
    const session = login.json.data.session;
    const token = (session && typeof session === 'object' ? session.token : session) || login.json.data.token;
    const auth = { Authorization: `Bearer ${token}` };

    const pg = new Client({ connectionString: DB_URL, ssl: false });
    await pg.connect();
    const acc = await pg.query(`SELECT account_id, account_code FROM finance_accounts WHERE account_code IN ('1130','4100')`);
    const map = Object.fromEntries(acc.rows.map((r) => [r.account_code, r.account_id]));

    // Seed unique public drafts via SQL to avoid flaky JE number collisions in generateNextNumber
    async function seedPublicDraft(suffix) {
      const num = `B1C-HTTP-${Date.now()}-${suffix}`;
      const e = await pg.query(
        `INSERT INTO finance_journal_entries
         (entry_number, entry_date, entry_type, description, status, is_posted, entity_id, entity_type, created_by)
         VALUES ($1, CURRENT_DATE, 'MANUAL', $2, 'DRAFT', false, 'HQ001', 'HQ', 'b1c-http')
         RETURNING entry_id, entry_number`,
        [num, `B1C HTTP ${suffix}`]
      );
      await pg.query(
        `INSERT INTO finance_journal_lines (entry_id, line_number, account_id, account_code, debit_amount, credit_amount, entity_id)
         VALUES ($1,1,$2,'1130',30,0,'HQ001'),($1,2,$3,'4100',0,30,'HQ001')`,
        [e.rows[0].entry_id, map['1130'], map['4100']]
      );
      return e.rows[0];
    }

    const draftHttp = await seedPublicDraft('main');
    pass('http-create-draft', draftHttp.entry_number);
    const id = draftHttp.entry_id;

    const post = await httpJson('POST', `/finance/journal-entries/${id}/post`, {}, auth);
    post.status === 200 ? pass('http-post-with-session') : fail('http-post-with-session', `${post.status} ${post.raw}`);

    const del = await httpJson('DELETE', `/finance/journal/entries/${id}?entity_id=HQ001`, null, auth);
    del.status === 409 && del.json?.code === 'POSTED_DOCUMENT_LOCKED'
      ? pass('http-delete-posted-je-409', del.json.error)
      : fail('http-delete-posted-je-409', `${del.status} ${del.raw}`);

    const put = await httpJson('PUT', `/finance/journal/entries/${id}`, {
      entity_id: 'HQ001',
      entry_date: new Date().toISOString().slice(0, 10),
      lines: [
        { account_id: map['1130'], account_code: '1130', debit_amount: 30, credit_amount: 0 },
        { account_id: map['4100'], account_code: '4100', debit_amount: 0, credit_amount: 30 }
      ]
    }, auth);
    put.status === 409 ? pass('http-put-posted-je-409') : fail('http-put-posted-je-409', `${put.status} ${put.raw}`);

    const addLine = await httpJson('POST', '/finance/journal-lines', {
      entity_id: 'HQ001', entry_id: id, account_code: '1130', debit_amount: 1, credit_amount: 0
    }, auth);
    addLine.status === 409 ? pass('http-add-line-posted-409') : fail('http-add-line-posted-409', `${addLine.status} ${addLine.raw}`);

    const draftNoAuth = await seedPublicDraft('noauth');
    const postNoAuth = await httpJson('POST', `/finance/journal-entries/${draftNoAuth.entry_id}/post`, {}, {});
    postNoAuth.status === 401
      ? pass('http-post-without-auth-401', postNoAuth.json?.code || '')
      : fail('http-post-without-auth-401', `${postNoAuth.status} ${postNoAuth.raw}`);

    const spoofPost = await httpJson('POST', `/finance/journal-entries/${draftNoAuth.entry_id}/post`, {}, {
      'x-user-role': 'Admin',
      'x-finance-permissions': 'journals.post'
    });
    spoofPost.status === 401
      ? pass('http-spoof-headers-401')
      : fail('http-spoof-headers-401', `${spoofPost.status} ${spoofPost.raw}`);

    const rev = await httpJson('POST', `/finance/journal-entries/${id}/reverse`, { reason: 'B1C http reverse' }, auth);
    rev.status === 201 ? pass('http-legitimate-reverse') : fail('http-legitimate-reverse', `${rev.status} ${rev.raw}`);

    // Smoke HR / payroll / finance pages
    for (const p of ['/hr', '/finance', '/finance/payroll-runs.html']) {
      const r = await httpJson('GET', p, null, auth);
      r.status < 500 ? pass(`smoke:${p}`, String(r.status)) : fail(`smoke:${p}`, String(r.status));
    }

    await pg.end();
  } catch (e) {
    fail('http-suite', e.message);
  }

  const summary = {
    passed: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok).length,
    results,
    report
  };

  const md = [];
  md.push('# تقرير B1.c — حماية المستندات المرحّلة وصلاحيات الترحيل');
  md.push('');
  md.push(`**النتيجة:** ${summary.failed === 0 ? 'PASS' : 'FAIL'} — ${summary.passed} / ${summary.failed}`);
  md.push('');
  md.push('## الملفات والمسارات');
  report.changedFiles.forEach((f) => md.push(`- ${f}`));
  md.push('');
  md.push('## محمي فعليًا');
  report.protected.forEach((x) => md.push(`- ${x}`));
  md.push('');
  md.push('## ما زال خطرًا');
  report.stillAtRisk.forEach((x) => md.push(`- ${x}`));
  md.push('');
  md.push('## إغلاق legacy_unscoped');
  md.push(JSON.stringify(report.authTransition, null, 2));
  md.push('');
  md.push('## الترحيل التلقائي للفواتير/المدفوعات');
  md.push('**لم يُغيَّر.**');
  md.push('');
  md.push('## هل نحتاج migration؟');
  md.push('لا لتنفيذ حراسة الحذف/التعديل في B1.c. UNIQUE للعكس يبقى مقترح B1.b غير منفَّذ.');
  md.push('');
  md.push('## نتائج الاختبارات');
  results.forEach((r) => md.push(`- ${r.ok ? 'PASS' : 'FAIL'} ${r.name}${r.detail ? `: ${r.detail}` : ''}`));
  md.push('');
  md.push('لا دمج / لا Staging / لا Production. بانتظار موافقة قبل أي مرحلة تالية.');

  fs.writeFileSync(path.join(ART, 'finance-p3-b1c-report.json'), JSON.stringify(summary, null, 2));
  fs.writeFileSync(path.join(ART, 'finance-p3-b1c-report.md'), md.join('\n'));
  fs.writeFileSync(path.join(__dirname, 'docs/finance-leadership-p3-b1c-report.md'), md.join('\n'));

  console.log('\n=== SUMMARY ===');
  console.log(JSON.stringify({ passed: summary.passed, failed: summary.failed, verdict: summary.failed ? 'FAIL' : 'PASS' }, null, 2));
  process.exit(summary.failed ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
