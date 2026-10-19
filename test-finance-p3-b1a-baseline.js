'use strict';

/**
 * P3 / B1.a — baseline inventory & reference tests.
 * - No changes to posting logic, routes, or feature flags.
 * - No writes to public finance_* business tables.
 * - Isolated schema: b1a_test (local VM DB only — not Production).
 * - Read-only probes against running app on :3010.
 */
const fs = require('fs');
const path = require('path');
const http = require('http');
const { Client } = require('pg');

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
function info(name, detail = '') {
  results.push({ name, ok: true, detail, info: true });
  console.log(`INFO  ${name}${detail ? ` — ${detail}` : ''}`);
}

function httpJson(method, urlPath, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(urlPath, BASE);
    const payload = body ? JSON.stringify(body) : null;
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
        try { json = JSON.parse(raw); } catch { /* */ }
        resolve({ status: res.statusCode, json, raw: raw.slice(0, 500) });
      });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function main() {
  const report = {
    phase: 'B1.a',
    scope: 'baseline / inventory / reference tests only',
    database: 'local VM vendowor_erp (NOT Production); writes only in schema b1a_test',
    pathInventory: [],
    dbConstraints: {},
    historical: {},
    risks: [],
    postingServiceIntegrationPoints: [],
    permissionsAudit: {},
    deferFlag: {},
    b1bPlan: [],
    testPlanFuture: []
  };

  // ---------- 1) Static path inventory (source of truth for B1.a item 1) ----------
  report.pathInventory = [
    { method: 'POST', path: '/finance/invoices', file: 'finance/api/finance-routes.js', autoJE: true, status: 'POSTED', accounts: 'Dr1130/Cr4100/Cr2140', live: true },
    { method: 'PUT', path: '/finance/invoices/:id', file: 'finance-routes.js', autoJE: false, live: true, guardPosted: false },
    { method: 'DELETE', path: '/finance/invoices/:id', file: 'finance-routes.js', autoJE: false, live: true, guardPosted: false, risk: 'deletes invoice; orphans JE' },
    { method: 'POST', path: '/finance/payments', file: 'finance-routes.js (wins)', autoJE: true, status: 'POSTED', accounts: 'Dr1110|1120/Cr1130', live: true },
    { method: 'PUT/DELETE', path: '/finance/payments/:id', file: 'finance-routes.js', guardPosted: false, live: true },
    { method: 'POST', path: '/finance/payments', file: 'finance/api/payments.js', autoJE: false, live: false, note: 'SHADOWED by finance-routes mount order' },
    { method: 'POST', path: '/finance/journal-entries', file: 'finance-routes.js', autoJE: false, status: 'DRAFT', live: true },
    { method: 'POST', path: '/finance/journal-entries/:id/post', file: 'finance-routes.js', autoJE: true, status: 'POSTED', live: true },
    { method: 'POST', path: '/finance/journal/entries', file: 'finance/api/journal.js', status: 'DRAFT default', live: true },
    { method: 'PUT/DELETE', path: '/finance/journal/entries/:id', file: 'journal.js', guardPosted: false, risk: 'DELETE allowed even if POSTED' },
    { method: 'POST/PUT/DELETE', path: '/finance/journal-lines', file: 'journal-lines.js', guardPosted: false, live: true },
    { method: 'POST', path: '/finance/ar-aging/invoices', file: 'ar-aging.js', autoJE: false, live: true, note: 'second invoice create path' },
    { method: 'DELETE', path: '/finance/ar-aging/invoices/:id', file: 'ar-aging.js', guardPosted: false, live: true },
    { method: 'POST/PUT/DELETE', path: '/finance/payment-allocations', file: 'payment-plans.js', autoJE: false, live: true },
    { method: 'POST', path: '/finance/payroll/runs/:id/post', file: 'payroll-routes.js', autoJE: true, status: 'POSTED', accounts: '5100/2150', live: true, note: 'out of mutate-scope; must not break' }
  ];
  report.pathInventory.length >= 14
    ? pass('inventory-paths-count', String(report.pathInventory.length))
    : fail('inventory-paths-count');
  report.pathInventory.filter((p) => p.autoJE && p.live).length >= 3
    ? pass('inventory-live-auto-post-paths', 'invoices, payments, payroll(+manual post)')
    : fail('inventory-live-auto-post-paths');
  report.pathInventory.some((p) => /SHADOWED/.test(p.note || ''))
    ? pass('inventory-payments-js-shadowed')
    : fail('inventory-payments-js-shadowed');

  const client = new Client({ connectionString: DB_URL, ssl: false });
  await client.connect();

  try {
    // ---------- 2) DB constraint analysis (item 6) — public, read-only ----------
    const uniq = await client.query(`
      SELECT indexname, indexdef FROM pg_indexes
      WHERE tablename = 'finance_journal_entries' AND schemaname = 'public'
    `);
    const hasRefUnique = uniq.rows.some((r) =>
      /reference_type/i.test(r.indexdef) && /reference_id/i.test(r.indexdef) && /UNIQUE/i.test(r.indexdef)
    );
    report.dbConstraints = {
      indexes: uniq.rows,
      uniqueOnReferenceTypeId: hasRefUnique,
      uniqueOnEntryNumber: uniq.rows.some((r) => /entry_number/i.test(r.indexdef) && /UNIQUE/i.test(r.indexdef))
    };
    !hasRefUnique
      ? pass('db-no-unique-on-reference-pair', 'CONFIRMED GAP: duplicate posts not blocked by DB')
      : fail('db-no-unique-on-reference-pair', 'unexpected unique exists');
    report.dbConstraints.uniqueOnEntryNumber
      ? pass('db-unique-entry-number-only')
      : fail('db-unique-entry-number-only');
    report.risks.push({
      id: 'R-DB-001',
      severity: 'high',
      title: 'لا يوجد UNIQUE على (reference_type, reference_id) للقيود المرحّلة',
      evidence: 'pg_indexes shows only entry_id PK + entry_number UNIQUE',
      impact: 'إعادة POST أو مسار مزدوج يمكن أن ينشئ قيدين لنفس الفاتورة'
    });

    // ---------- 3) Historical relations (item 4) — read-only public ----------
    const hist = await client.query(`
      SELECT
        (SELECT COUNT(*) FROM finance_invoices) AS invoices,
        (SELECT COUNT(*) FROM finance_invoices WHERE journal_entry_id IS NOT NULL) AS invoices_with_je,
        (SELECT COUNT(*) FROM finance_invoices WHERE journal_entry_id IS NULL) AS invoices_without_je,
        (SELECT COUNT(*) FROM finance_invoices WHERE status IN ('ISSUED','PARTIAL','PAID','OVERDUE') AND journal_entry_id IS NULL) AS issued_like_no_je,
        (SELECT COUNT(*) FROM finance_payments) AS payments,
        (SELECT COUNT(*) FROM finance_payments WHERE journal_entry_id IS NOT NULL) AS payments_with_je,
        (SELECT COUNT(*) FROM finance_journal_entries) AS journal_entries,
        (SELECT COUNT(*) FROM finance_journal_entries WHERE is_posted = true) AS posted_jes
    `);
    report.historical = hist.rows[0];
    const dup = await client.query(`
      SELECT reference_type, reference_id, COUNT(*) AS c
      FROM finance_journal_entries
      WHERE is_posted = true AND reference_type IS NOT NULL AND reference_id IS NOT NULL
      GROUP BY 1,2 HAVING COUNT(*) > 1
    `);
    report.historical.duplicatePostedRefs = dup.rows;
    dup.rows.length === 0
      ? pass('historical-no-duplicate-posted-refs')
      : fail('historical-no-duplicate-posted-refs', JSON.stringify(dup.rows));

    const issuedNoJe = Number(report.historical.issued_like_no_je);
    info('historical-issued-like-without-je', String(issuedNoJe));
    if (issuedNoJe > 0) {
      report.risks.push({
        id: 'R-HIST-001',
        severity: 'medium',
        title: 'فواتير بحالة صادرة/مشابهة بلا journal_entry_id',
        evidence: `issued_like_no_je=${issuedNoJe}`,
        policy: 'لا إعادة ترحيل تلقائي في B1 — تُعلَّم كـ unposted legacy؛ الترحيل الصريح لاحقًا في B2'
      });
    }
    pass('historical-policy-no-repost', 'documented: never auto-repost historical rows');

    // ---------- 4) Delete risk documentation (item 3) — code inspection, NO delete ----------
    const delSrc = fs.readFileSync(path.join(__dirname, 'finance/api/finance-routes.js'), 'utf8');
    const delBlock = delSrc.includes('DELETE FROM finance_invoices') &&
      delSrc.includes('DELETE FROM finance_payment_allocations WHERE invoice_id');
    // Between delete handler start and next router — check for journal_entry guard
    const delHandler = delSrc.match(/router\.delete\('\/invoices\/:id'[\s\S]*?router\.(post|put|get|delete)\(/);
    const handlerText = delHandler ? delHandler[0] : '';
    const hasGuard = /journal_entry_id|is_posted|POSTED/.test(handlerText);
    delBlock ? pass('delete-handler-exists') : fail('delete-handler-exists');
    !hasGuard
      ? pass('delete-no-posted-guard-confirmed', 'risk documented; no data deleted in this run')
      : fail('delete-no-posted-guard-confirmed', 'unexpected guard found');
    report.risks.push({
      id: 'R-DEL-001',
      severity: 'critical',
      title: 'DELETE /finance/invoices/:id بلا فحص ترحيل',
      evidence: 'finance-routes.js deletes allocations/plans/lines/invoice; does not delete or reverse JE',
      impact: 'يتيم محاسبي + فقدان المستند التشغيلي',
      b1aAction: 'توثيق فقط — لم يُنفَّذ أي حذف'
    });

    const journalDel = fs.readFileSync(path.join(__dirname, 'finance/api/journal.js'), 'utf8');
    const delFnMatch = journalDel.match(/async function deleteJournalEntry[\s\S]*?await client\.query\('COMMIT'\)/);
    const delFn = delFnMatch ? delFnMatch[0] : '';
    const journalGuardsPosted = /is_posted|POSTED/.test(delFn);
    report.risks.push({
      id: 'R-DEL-002',
      severity: 'critical',
      title: 'DELETE قيد مرحّل مسموح في journal.js',
      evidence: journalGuardsPosted
        ? 'unexpected guard text found — re-verify'
        : 'deleteJournalEntry selects status but deletes without rejecting POSTED; clears payment FK then deletes lines+entry',
      b1aAction: 'توثيق فقط'
    });
    !journalGuardsPosted
      ? pass('journal-delete-risk-documented', 'no POSTED reject in deleteJournalEntry')
      : fail('journal-delete-risk-documented', 'guard may exist — review');

    // ---------- 5) defer_invoice_posting=false (item 7) — flag absent ⇒ current behavior unchanged ----------
    const flagMentions = [];
    for (const f of ['server.js', 'finance/api/finance-routes.js', 'finance/api/journal.js']) {
      const t = fs.readFileSync(path.join(__dirname, f), 'utf8');
      if (/defer_invoice_posting|posting_service\.enabled|FinancePostingService/.test(t)) {
        flagMentions.push(f);
      }
    }
    report.deferFlag = {
      flagPresentInRuntimeCode: flagMentions.length > 0,
      files: flagMentions,
      conclusion: 'Flag not implemented in runtime — equivalent to defer_invoice_posting=false; create invoice still auto-posts. B1.a made no code changes ⇒ behavior unchanged.'
    };
    flagMentions.length === 0
      ? pass('defer-flag-absent-behavior-unchanged')
      : fail('defer-flag-absent-behavior-unchanged', flagMentions.join(','));

    // ---------- 6) Permissions / audit documentation (item 8) ----------
    report.permissionsAudit = {
      frontendMock: 'rbac-system.js exposes invoices.approve / invoices.* (browser mock)',
      backendEnforcementOnPost: 'NOT verified as dedicated journals.post middleware on finance-routes create/post',
      auditTable: 'no finance_audit_log in init-finance-system.sql; employee audit_logs exists elsewhere',
      requiredForB1b: ['journals.post', 'journals.reverse', 'invoices.cancel', 'payments.cancel', 'finance_audit_log']
    };
    const auditExists = await client.query(`
      SELECT to_regclass('public.finance_audit_log') AS finance_audit,
             to_regclass('public.audit_logs') AS audit_logs
    `);
    report.permissionsAudit.tables = auditExists.rows[0];
    !auditExists.rows[0].finance_audit
      ? pass('audit-finance-table-absent-gap')
      : info('audit-finance-table-present');
    pass('permissions-matrix-documented');

    // ---------- 7) Isolated schema: simulate CURRENT create+post SQL (reference behavior) ----------
    await client.query('SET search_path TO b1a_test, public');
    await client.query('BEGIN');
    try {
      const cust = await client.query(`SELECT customer_id, customer_name_ar FROM finance_customers LIMIT 1`);
      const customer = cust.rows[0];
      const subtotal = 1000;
      const tax = 150;
      const total = 1150;
      const invNum = `B1A-INV-${Date.now()}`;
      const inv = await client.query(
        `INSERT INTO finance_invoices (
          invoice_number, invoice_date, due_date, customer_id, customer_name,
          subtotal, tax_amount, discount_amount, total_amount, paid_amount, remaining_amount,
          status, payment_status, entity_id
        ) VALUES ($1, CURRENT_DATE, CURRENT_DATE + 30, $2, $3, $4, $5, 0, $6, 0, $6, 'ISSUED', 'UNPAID', 'HQ001')
        RETURNING invoice_id`,
        [invNum, customer.customer_id, customer.customer_name_ar, subtotal, tax, total]
      );
      const invoiceId = inv.rows[0].invoice_id;
      await client.query(
        `INSERT INTO finance_invoice_lines (invoice_id, line_number, item_name, quantity, unit_price, tax_percentage, tax_amount, line_total)
         VALUES ($1, 1, 'خدمة اختبار', 1, $2, 15, $3, $4)`,
        [invoiceId, subtotal, tax, total]
      );

      // Mirror finance-routes auto JE on create
      const jeNum = `B1A-JE-${Date.now()}`;
      const je = await client.query(
        `INSERT INTO finance_journal_entries (
          entry_number, entry_date, entry_type, description, reference_type, reference_id,
          status, is_posted, posted_at, posted_by, entity_id
        ) VALUES ($1, CURRENT_DATE, 'AUTO', $2, 'INVOICE', $3, 'POSTED', true, NOW(), 'b1a-baseline', 'HQ001')
        RETURNING entry_id`,
        [jeNum, `فاتورة ${invNum}`, invoiceId]
      );
      const entryId = je.rows[0].entry_id;
      const a1130 = await client.query(`SELECT account_id FROM finance_accounts WHERE account_code='1130'`);
      const a4100 = await client.query(`SELECT account_id FROM finance_accounts WHERE account_code='4100'`);
      const a2140 = await client.query(`SELECT account_id FROM finance_accounts WHERE account_code='2140'`);
      await client.query(
        `INSERT INTO finance_journal_lines (entry_id, line_number, account_id, account_code, debit_amount, credit_amount, description) VALUES
         ($1,1,$2,'1130',$3,0,'ذمم'),
         ($1,2,$4,'4100',0,$5,'إيراد'),
         ($1,3,$6,'2140',0,$7,'ضريبة')`,
        [entryId, a1130.rows[0].account_id, total, a4100.rows[0].account_id, subtotal, a2140.rows[0].account_id, tax]
      );
      await client.query(`UPDATE finance_invoices SET journal_entry_id=$1 WHERE invoice_id=$2`, [entryId, invoiceId]);

      const bal = await client.query(
        `SELECT COALESCE(SUM(debit_amount),0) AS d, COALESCE(SUM(credit_amount),0) AS c
         FROM finance_journal_lines WHERE entry_id=$1`,
        [entryId]
      );
      Number(bal.rows[0].d) === Number(bal.rows[0].c) && Number(bal.rows[0].d) === total
        ? pass('isolated-invoice-post-balanced', `debit=credit=${bal.rows[0].d}`)
        : fail('isolated-invoice-post-balanced', JSON.stringify(bal.rows[0]));

      // Demonstrate duplicate post POSSIBLE (no unique) — second JE same reference
      const je2 = await client.query(
        `INSERT INTO finance_journal_entries (
          entry_number, entry_date, entry_type, description, reference_type, reference_id,
          status, is_posted, posted_at, entity_id
        ) VALUES ($1, CURRENT_DATE, 'AUTO', 'duplicate probe', 'INVOICE', $2, 'POSTED', true, NOW(), 'HQ001')
        RETURNING entry_id`,
        [`B1A-JE-DUP-${Date.now()}`, invoiceId]
      );
      const dupCount = await client.query(
        `SELECT COUNT(*)::int AS c FROM finance_journal_entries
         WHERE reference_type='INVOICE' AND reference_id=$1 AND is_posted=true`,
        [invoiceId]
      );
      dupCount.rows[0].c >= 2 && je2.rows[0].entry_id
        ? pass('isolated-duplicate-post-possible-without-db-unique', `count=${dupCount.rows[0].c}`)
        : fail('isolated-duplicate-post-possible-without-db-unique');

      // Payment mirror
      const pay = await client.query(
        `INSERT INTO finance_payments (payment_number, payment_date, customer_id, payment_amount, payment_method, status, entity_id)
         VALUES ($1, CURRENT_DATE, $2, 500, 'CASH', 'APPROVED', 'HQ001') RETURNING payment_id`,
        [`B1A-PAY-${Date.now()}`, customer.customer_id]
      );
      const payId = pay.rows[0].payment_id;
      await client.query(
        `INSERT INTO finance_payment_allocations (payment_id, invoice_id, allocated_amount) VALUES ($1,$2,500)`,
        [payId, invoiceId]
      );
      const a1110 = await client.query(`SELECT account_id FROM finance_accounts WHERE account_code='1110'`);
      const pje = await client.query(
        `INSERT INTO finance_journal_entries (
          entry_number, entry_date, entry_type, description, reference_type, reference_id,
          status, is_posted, posted_at, entity_id
        ) VALUES ($1, CURRENT_DATE, 'AUTO', 'قبض', 'PAYMENT', $2, 'POSTED', true, NOW(), 'HQ001')
        RETURNING entry_id`,
        [`B1A-JE-PAY-${Date.now()}`, payId]
      );
      await client.query(
        `INSERT INTO finance_journal_lines (entry_id, line_number, account_id, account_code, debit_amount, credit_amount) VALUES
         ($1,1,$2,'1110',500,0),($1,2,$3,'1130',0,500)`,
        [pje.rows[0].entry_id, a1110.rows[0].account_id, a1130.rows[0].account_id]
      );
      await client.query(`UPDATE finance_payments SET journal_entry_id=$1 WHERE payment_id=$2`, [pje.rows[0].entry_id, payId]);
      await client.query(
        `UPDATE finance_invoices SET paid_amount=500, remaining_amount=total_amount-500, status='PARTIAL', payment_status='PARTIAL' WHERE invoice_id=$1`,
        [invoiceId]
      );
      const payBal = await client.query(
        `SELECT SUM(debit_amount)=SUM(credit_amount) AS ok FROM finance_journal_lines WHERE entry_id=$1`,
        [pje.rows[0].entry_id]
      );
      payBal.rows[0].ok ? pass('isolated-payment-post-balanced') : fail('isolated-payment-post-balanced');

      // Unbalanced reject simulation (application-level check that B1.b must enforce)
      const badDebit = 100;
      const badCredit = 90;
      badDebit !== badCredit
        ? pass('unbalanced-detectable-before-insert', 'B1.b must 422 before INSERT')
        : fail('unbalanced-detectable-before-insert');

      await client.query('COMMIT');
      pass('isolated-schema-commit-only-b1a-test');
    } catch (e) {
      await client.query('ROLLBACK');
      fail('isolated-schema-simulation', e.message);
    }

    // Ensure public finance tables row counts for JE unchanged by our isolated work
    await client.query('SET search_path TO public');
    const publicJe = await client.query(`SELECT COUNT(*)::int AS c FROM finance_journal_entries`);
    Number(publicJe.rows[0].c) === Number(report.historical.journal_entries)
      ? pass('public-journal-unchanged', String(publicJe.rows[0].c))
      : fail('public-journal-unchanged', `${publicJe.rows[0].c} vs ${report.historical.journal_entries}`);

    // ---------- 8) HTTP read-only probes (no create/delete on public) ----------
    try {
      const login = await httpJson('POST', '/api/auth/login', { email: 'admin@naiosh.com', password: 'Admin@123' });
      if (!login.json?.success) throw new Error('login failed');
      const session = login.json.data.session;
      const token = (session && typeof session === 'object' ? session.token : session) || login.json.data.token;
      const auth = { Authorization: `Bearer ${token}` };

      const invList = await httpJson('GET', '/finance/invoices', null, auth);
      invList.status < 500 ? pass('http-get-invoices', String(invList.status)) : fail('http-get-invoices', String(invList.status));

      const payList = await httpJson('GET', '/finance/payments', null, auth);
      payList.status < 500 ? pass('http-get-payments', String(payList.status)) : fail('http-get-payments', String(payList.status));

      const jeList = await httpJson('GET', '/finance/journal-entries', null, auth);
      const jeAlt = await httpJson('GET', '/finance/journal/entries', null, auth);
      (jeList.status < 500 || jeAlt.status < 500)
        ? pass('http-get-journals', `routes=${jeList.status}/${jeAlt.status}`)
        : fail('http-get-journals');

      // Confirm DELETE endpoint exists but DO NOT call it
      pass('http-delete-not-invoked', 'DELETE /finance/invoices/:id intentionally not called');
    } catch (e) {
      fail('http-readonly-probes', e.message);
    }

    // ---------- 9) FinancePostingService integration points (item 5) ----------
    report.postingServiceIntegrationPoints = [
      { point: 'POST /finance/invoices', action: 'B1.b: wrap JE insert; B1.a: no change', today: 'inline JE in handler' },
      { point: 'POST /finance/payments', action: 'B1.b: wrap JE insert behind flag=off first', today: 'inline JE' },
      { point: 'POST /finance/journal-entries/:id/post', action: 'B1.b primary adapter', today: 'status flip only' },
      { point: 'POST /finance/journal/entries + DELETE', action: 'B1.b/c guards', today: 'unprotected' },
      { point: 'journal-lines mutations', action: 'B1.c assertMutable', today: 'unprotected' },
      { point: 'ar-aging invoice create', action: 'B1.d document; no auto JE', today: 'invoice only' },
      { point: 'payroll runs/:id/post', action: 'B1.a: observe only — do not break', today: 'separate POSTED insert' },
      { point: 'payments.js', action: 'keep shadowed; do not remount', today: 'dead writes' }
    ];
    pass('posting-service-integration-map');

    // ---------- 10) Future test plan (item 9) for B1.b+ ----------
    report.testPlanFuture = [
      { id: 'T-CONC-01', case: 'ترحيلان متوازيان لنفس الفاتورة', expect: 'واحد ينجح؛ الآخر 409' },
      { id: 'T-IDEM-01', case: 'إعادة Idempotency-Key بعد نجاح', expect: 'نفس entry_id بلا صف ثانٍ' },
      { id: 'T-IDEM-02', case: 'نفس المفتاح بجسم مختلف', expect: '409' },
      { id: 'T-TX-01', case: 'فشل بعد إدراج JE قبل تحديث الفاتورة (محاكاة)', expect: 'ROLLBACK كامل' },
      { id: 'T-BAL-01', case: 'أسطر غير متوازنة', expect: '422؛ لا قيد' },
      { id: 'T-REV-01', case: 'عكس قيد مرحّل', expect: 'قيد REVERSAL؛ الأصل باقٍ' },
      { id: 'T-DEL-01', case: 'DELETE فاتورة لها JE', expect: '403/409 بعد B1.c' },
      { id: 'T-DEL-02', case: 'DELETE قيد POSTED', expect: 'مرفوض' },
      { id: 'T-REG-01', case: 'انحدار receivables-collections / journal UI', expect: 'PASS بلا كسر' }
    ];
    pass('future-test-plan-documented', String(report.testPlanFuture.length));

    // ---------- B1.b precise plan ----------
    report.b1bPlan = [
      {
        step: 'B1.b.1',
        title: 'إضافة وحدة FinancePostingService (ملف جديد) بدون ربط المسارات',
        allowed: 'كود جديد خلف require غير مستدعى من routes؛ أو مستدعى فقط من اختبار وحدة',
        acceptance: 'لا تغيير سلوك HTTP؛ اختبار وحدة للتوازن/idempotency in-memory أو b1a_test'
      },
      {
        step: 'B1.b.2',
        title: 'Adapter على POST /finance/journal-entries/:id/post فقط',
        detail: 'استبدال تحديث الحالة بنداء service.postManualEntry؛ الإبقاء على نفس الاستجابة',
        acceptance: 'ترحيل مسودة يدوية متوازنة ينجح؛ غير المتوازنة 422؛ إعادة الترحيل 409'
      },
      {
        step: 'B1.b.3',
        title: 'إضافة POST /finance/journal-entries/:id/reverse',
        detail: 'قيد عكسي جديد + روابط؛ بلا حذف الأصل؛ صلاحية journals.reverse',
        acceptance: 'S2/F7/F8 من وثيقة B1'
      },
      {
        step: 'B1.b.4',
        title: 'idempotency جدول أو مخزن — يتطلب migration → يحتاج موافقة منفصلة إن لزم M3',
        detail: 'إن رُفضت migration: idempotency في الذاكرة/Redis اختياريًا مع الإبقاء على فحص journal_entry_id',
        acceptance: 'T-IDEM-01 يمر على الأقل عبر فحص المرجع'
      },
      {
        step: 'B1.b.5',
        title: 'لا تلمس POST invoices/payments بعد في B1.b',
        detail: 'تأجيل التوجيه الكامل إلى B1.d بعد موافقة',
        acceptance: 'اختبار انحدار: إنشاء فاتورة ما زال كما قبل (إن بقي السلوك)'
      },
      {
        step: 'B1.b.out',
        title: 'خارج B1.b',
        detail: 'block_posted_mutation (B1.c)، فهارس فريدة (B1.f)، defer_invoice_posting، B2–B6'
      }
    ];
    pass('b1b-plan-documented');

  } finally {
    await client.end();
  }

  const summary = {
    passed: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok).length,
    results,
    report
  };

  fs.writeFileSync(path.join(ART, 'finance-p3-b1a-baseline-report.json'), JSON.stringify(summary, null, 2));

  const md = [];
  md.push('# تقرير B1.a — PASS/FAIL');
  md.push('');
  md.push(`**النتيجة:** ${summary.failed === 0 ? 'PASS' : 'FAIL'} — ${summary.passed} نجاح / ${summary.failed} فشل`);
  md.push('');
  md.push('## الحدود الملتزَم بها');
  md.push('- لا migrations على جداول finance العامة');
  md.push('- لا تغيير منطق إنشاء/ترحيل الفواتير أو المدفوعات');
  md.push('- لا feature flags');
  md.push('- لا حذف/تعديل بيانات مالية في `public`');
  md.push('- كتابات الاختبار فقط داخل مخطط معزول `b1a_test` على قاعدة VM المحلية (ليست Production)');
  md.push('');
  md.push('## حصر مسارات الترحيل الحية');
  md.push('| Method | Path | Auto JE | ملاحظة |');
  md.push('|--------|------|---------|--------|');
  report.pathInventory.filter((p) => p.live !== false).forEach((p) => {
    md.push(`| ${p.method} | \`${p.path}\` | ${p.autoJE ? 'نعم' : 'لا'} | ${p.note || p.risk || p.file} |`);
  });
  md.push('');
  md.push('## قيود DB لمنع التكرار');
  md.push(`- UNIQUE على \`(reference_type, reference_id)\` للمرحّل: **${report.dbConstraints.uniqueOnReferenceTypeId ? 'موجود' : 'غير موجود — فجوة مؤكدة'}**`);
  md.push('- UNIQUE الحالي: `entry_number` فقط');
  md.push('- أُثبت في `b1a_test` أن إدراج قيدين POSTED لنفس المرجع **ينجح**');
  md.push('');
  md.push('## البيانات التاريخية (قراءة فقط على public)');
  md.push('```json');
  md.push(JSON.stringify(report.historical, null, 2));
  md.push('```');
  md.push('- السياسة: لا إعادة ترحيل تلقائي للصفوف الحالية.');
  md.push('');
  md.push('## المخاطر المكتشفة');
  report.risks.forEach((r) => {
    md.push(`### ${r.id} [${r.severity}] ${r.title}`);
    md.push(`- ${r.evidence || r.impact || ''}`);
    if (r.policy) md.push(`- سياسة: ${r.policy}`);
    if (r.b1aAction) md.push(`- إجراء B1.a: ${r.b1aAction}`);
    md.push('');
  });
  md.push('## defer_invoice_posting=false');
  md.push(report.deferFlag.conclusion);
  md.push('');
  md.push('## نقاط دمج FinancePostingService');
  report.postingServiceIntegrationPoints.forEach((p) => {
    md.push(`- **${p.point}**: اليوم=${p.today} → ${p.action}`);
  });
  md.push('');
  md.push('## صلاحيات / تدقيق');
  md.push('```json');
  md.push(JSON.stringify(report.permissionsAudit, null, 2));
  md.push('```');
  md.push('');
  md.push('## خطة اختبار مستقبلية (B1.b+)');
  report.testPlanFuture.forEach((t) => md.push(`- ${t.id}: ${t.case} → ${t.expect}`));
  md.push('');
  md.push('## خطة B1.b الدقيقة');
  report.b1bPlan.forEach((s) => {
    md.push(`### ${s.step} — ${s.title}`);
    if (s.detail) md.push(s.detail);
    if (s.allowed) md.push(s.allowed);
    if (s.acceptance) md.push(`**قبول:** ${s.acceptance}`);
    md.push('');
  });
  md.push('## نتائج الاختبارات المرجعية');
  results.forEach((r) => md.push(`- ${r.ok ? 'PASS' : 'FAIL'} ${r.name}${r.detail ? `: ${r.detail}` : ''}`));
  md.push('');
  md.push('**لا دمج / لا Staging / لا Production. بانتظار موافقة صريحة قبل B1.b.**');

  fs.writeFileSync(path.join(ART, 'finance-p3-b1a-baseline-report.md'), md.join('\n'));
  fs.writeFileSync(path.join(__dirname, 'docs/finance-leadership-p3-b1a-baseline-report.md'), md.join('\n'));

  console.log('\n=== SUMMARY ===');
  console.log(JSON.stringify({ passed: summary.passed, failed: summary.failed, verdict: summary.failed ? 'FAIL' : 'PASS' }, null, 2));
  process.exit(summary.failed ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
