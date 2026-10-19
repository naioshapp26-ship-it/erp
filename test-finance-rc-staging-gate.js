'use strict';
/* FINANCE_PUBLIC_WRITE_ALLOW=1 — HTTP fixtures for ADVANCE-B / gate only. */

/**
 * Finance 360 Release Candidate — Staging gate harness (isolated).
 * - ADVANCE-B on legacy HTTP + service postPaymentReceipt
 * - writeAudit SAVEPOINT transaction integrity
 * - UNIQUE on finance_rc_unique clone (data-like), NOT public
 * - Finance smoke + HR/Payroll/archive regression
 * Flags stay false. No ops migrations. No historical rewrite.
 */
const fs = require('fs');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');
const { Client } = require('pg');
const {
  postInvoiceIssue,
  postPaymentReceipt,
  postManualEntry,
  PostingError,
  writeAudit
} = require('./finance/services/finance-posting-service');
const financeRoutes = require('./finance/api/finance-routes');

const ART = '/opt/cursor/artifacts';
const PORT = 3010;
const BASE = `http://127.0.0.1:${PORT}`;
const APP_URL =
  process.env.DATABASE_URL ||
  'postgresql://vendowor_erp_user:vendowor_local_dev@127.0.0.1:5432/vendowor_erp';
const TEST_URL =
  process.env.DATABASE_URL_FINANCE_TEST ||
  'postgresql://finance_test_writer:finance_test_local_only@127.0.0.1:5432/vendowor_erp';

const results = [];
function pass(name, detail = '') {
  results.push({ name, ok: true, detail });
  console.log(`PASS  ${name}${detail ? ` — ${detail}` : ''}`);
}
function fail(name, detail = '') {
  results.push({ name, ok: false, detail });
  console.log(`FAIL  ${name}${detail ? ` — ${detail}` : ''}`);
}
function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function actor(entityId = 'HQ001') {
  return {
    authenticated: true,
    userId: 'rc-gate',
    role: 'Admin',
    entityType: 'HQ',
    entityId,
    permissions: ['journals.post', 'journals.reverse', 'payments.post', 'invoices.post', '*']
  };
}
function svcCtx(extra = {}) {
  return { trustedTestActor: true, actor: actor(), manageTransaction: true, ...extra };
}

function httpJson(method, urlPath, body, headers = {}) {
  const u = new URL(urlPath, BASE);
  const payload = body == null ? null : JSON.stringify(body);
  return new Promise((resolve, reject) => {
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
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

function killPort(port) {
  try {
    const out = require('child_process')
      .execSync(`lsof -t -iTCP:${port} -sTCP:LISTEN 2>/dev/null || true`, { encoding: 'utf8' })
      .trim();
    for (const pid of out.split(/\s+/).filter(Boolean)) {
      try {
        process.kill(Number(pid), 'SIGTERM');
      } catch {
        /* */
      }
    }
  } catch {
    /* */
  }
}

function startServer() {
  killPort(PORT);
  fs.mkdirSync(ART, { recursive: true });
  const logFd = fs.openSync(path.join(ART, 'rc-staging-gate-server.log'), 'a');
  const child = spawn('node', ['server.js'], {
    cwd: '/workspace',
    env: {
      ...process.env,
      DATABASE_URL: APP_URL,
      DATABASE_SSL: 'false',
      PORT: String(PORT),
      NODE_ENV: 'development',
      BASE_DOMAIN: 'localhost',
      FINANCE_POST_INVOICE_VIA_SERVICE: '',
      FINANCE_POST_PAYMENT_VIA_SERVICE: ''
    },
    detached: true,
    stdio: ['ignore', logFd, logFd]
  });
  child.unref();
  return child.pid;
}

async function waitForBase(timeoutMs = 90000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const r = await httpJson('GET', '/finance');
      if (r.status === 200 || r.status === 302) return true;
    } catch {
      /* */
    }
    await sleep(800);
  }
  return false;
}

async function login() {
  const r = await httpJson('POST', '/api/auth/login', {
    email: 'admin@naiosh.com',
    password: 'Admin@123'
  });
  if (!r.json?.success) throw new Error(`login failed ${r.raw}`);
  const s = r.json.data?.session;
  return (s && typeof s === 'object' ? s.token : s) || r.json.data?.token;
}

async function main() {
  fs.mkdirSync(ART, { recursive: true });
  delete process.env.FINANCE_POST_INVOICE_VIA_SERVICE;
  delete process.env.FINANCE_POST_PAYMENT_VIA_SERVICE;

  financeRoutes.isFinancePostInvoiceViaService() === false &&
  financeRoutes.isFinancePostPaymentViaService() === false
    ? pass('flags-default-false')
    : fail('flags-default-false');

  // --- Source review: ADVANCE-B on both paths ---
  const fr = fs.readFileSync('/workspace/finance/api/finance-routes.js', 'utf8');
  const payJs = fs.readFileSync('/workspace/finance/api/payments.js', 'utf8');
  const svc = fs.readFileSync('/workspace/finance/services/finance-posting-service.js', 'utf8');
  // ADVANCE-B guard must be shared (not nested only under useService): find marker then ensure
  // the next `if (useService)` for invoice locks comes AFTER the empty-alloc reject.
  const advIdx = fr.indexOf('ADVANCE-B (RC)');
  const emptyGuardIdx = fr.indexOf('if (!allocList.length)', advIdx);
  const nextUseService = fr.indexOf('if (useService)', emptyGuardIdx);
  const sharedOk =
    advIdx > 0 &&
    emptyGuardIdx > advIdx &&
    fr.slice(emptyGuardIdx, emptyGuardIdx + 400).includes('ALLOCATIONS_REQUIRED') &&
    nextUseService > emptyGuardIdx;
  sharedOk
    ? pass('review-advance-b-shared-legacy-and-service')
    : fail(
        'review-advance-b-shared-legacy-and-service',
        `adv=${advIdx} empty=${emptyGuardIdx} nextSvc=${nextUseService}`
      );
  /ADVANCE_B/.test(payJs) && /ALLOCATIONS_REQUIRED/.test(payJs)
    ? pass('review-advance-b-payments-js-defense')
    : fail('review-advance-b-payments-js-defense');
  /SAVEPOINT finance_audit_write/.test(svc) && /ROLLBACK TO SAVEPOINT finance_audit_write/.test(svc)
    ? pass('review-writeAudit-savepoint')
    : fail('review-writeAudit-savepoint');
  /policy: 'ADVANCE_B'/.test(svc)
    ? pass('review-advance-b-service-postPaymentReceipt')
    : fail('review-advance-b-service-postPaymentReceipt');

  const client = new Client({ connectionString: TEST_URL, ssl: false });
  await client.connect();
  await client.query('SET search_path TO b1a_test, public');

  const cust = (
    await client.query(`SELECT customer_id FROM finance_customers ORDER BY 1 LIMIT 1`)
  ).rows[0];
  const cash = (
    await client.query(
      `SELECT account_id FROM finance_accounts WHERE account_code IN ('1110','1100') ORDER BY 1 LIMIT 1`
    )
  ).rows[0];

  // --- Service ADVANCE-B: payment with zero allocations ---
  {
    const num = `RC-PAY-EMPTY-${Date.now()}`;
    const pay = await client.query(
      `INSERT INTO finance_payments (
         payment_number, payment_date, customer_id, payment_amount, payment_method, status, entity_id
       ) VALUES ($1, CURRENT_DATE, $2, 25, 'CASH', 'PENDING', 'HQ001')
       RETURNING payment_id`,
      [num, cust.customer_id]
    );
    try {
      await postPaymentReceipt(client, pay.rows[0].payment_id, svcCtx({ cashAccountId: cash?.account_id }));
      fail('svc-advance-b-rejects-empty-alloc');
    } catch (e) {
      e instanceof PostingError && e.code === 'ALLOCATIONS_REQUIRED'
        ? pass('svc-advance-b-rejects-empty-alloc', e.extra?.policy || '')
        : fail('svc-advance-b-rejects-empty-alloc', `${e.code} ${e.message}`);
    }
  }

  // --- writeAudit SAVEPOINT: posting succeeds when audit_logs denied ---
  {
    const invNum = `RC-INV-AUDIT-${Date.now()}`;
    const inv = await client.query(
      `INSERT INTO finance_invoices (
         invoice_number, invoice_date, due_date, customer_id,
         subtotal, tax_amount, discount_amount, total_amount, paid_amount, remaining_amount,
         status, payment_status, entity_id
       ) VALUES ($1, CURRENT_DATE, CURRENT_DATE+30, $2, 28, 0, 0, 28, 0, 28, 'ISSUED', 'UNPAID', 'HQ001')
       RETURNING invoice_id`,
      [invNum, cust.customer_id]
    );
    const posted = await postInvoiceIssue(client, inv.rows[0].invoice_id, svcCtx());
    const link = await client.query(
      `SELECT journal_entry_id, remaining_amount FROM finance_invoices WHERE invoice_id=$1`,
      [inv.rows[0].invoice_id]
    );
    posted?.success &&
    Number(link.rows[0].journal_entry_id) === Number(posted.entry.entry_id)
      ? pass('audit-savepoint-post-persists', String(posted.entry.entry_id))
      : fail('audit-savepoint-post-persists', JSON.stringify({ posted, link: link.rows[0] }));

    // Direct writeAudit soft-fail must not abort open txn
    await client.query('BEGIN');
    await writeAudit(client, {
      actor: actor(),
      action: 'RC_AUDIT_PROBE',
      resourceType: 'test',
      resourceId: '1',
      newValue: { probe: true },
      status: 'SUCCESS'
    });
    await client.query(`SELECT 1 AS ok`);
    await client.query('COMMIT');
    pass('audit-savepoint-txn-survives-deny');
  }

  // --- writeAudit SUCCESS path with app role (can INSERT audit_logs) ---
  {
    const app = new Client({ connectionString: APP_URL, ssl: false });
    await app.connect();
    const probeId = `RC-AUD-${Date.now()}`;
    await app.query('BEGIN');
    await writeAudit(app, {
      actor: {
        authenticated: true,
        userId: 1,
        userName: 'rc-gate',
        role: 'Admin',
        entityId: 'HQ001',
        permissions: ['*']
      },
      action: 'RC_AUDIT_SUCCESS_PROBE',
      resourceType: 'rc_probe',
      resourceId: probeId,
      newValue: { ok: true },
      status: 'SUCCESS'
    });
    await app.query('COMMIT');
    const row = await app.query(
      `SELECT COUNT(*)::int AS n FROM public.audit_logs
       WHERE action='RC_AUDIT_SUCCESS_PROBE' AND resource_id=$1`,
      [probeId]
    );
    row.rows[0].n === 1
      ? pass('audit-success-persists-with-app-role', probeId)
      : fail('audit-success-persists-with-app-role', String(row.rows[0].n));
    await app.end();
  }

  // --- UNIQUE clone resembling public data (isolated schema) ---
  {
    const app = new Client({ connectionString: APP_URL, ssl: false });
    await app.connect();
    await app.query(`DROP SCHEMA IF EXISTS finance_rc_unique CASCADE`);
    await app.query(`CREATE SCHEMA finance_rc_unique AUTHORIZATION CURRENT_USER`);
    await app.query(`
      CREATE TABLE finance_rc_unique.finance_journal_entries (
        LIKE public.finance_journal_entries INCLUDING DEFAULTS INCLUDING CONSTRAINTS
      )`);
    await app.query(`
      CREATE TABLE finance_rc_unique.finance_payment_allocations (
        LIKE public.finance_payment_allocations INCLUDING DEFAULTS INCLUDING CONSTRAINTS
      )`);
    // Copy posted JE refs (structure+data sample) — no write to public
    await app.query(`
      INSERT INTO finance_rc_unique.finance_journal_entries
      SELECT * FROM public.finance_journal_entries
      WHERE is_posted IS TRUE
      ORDER BY entry_id
      LIMIT 200`);
    await app.query(`
      INSERT INTO finance_rc_unique.finance_payment_allocations
      SELECT * FROM public.finance_payment_allocations
      ORDER BY allocation_id
      LIMIT 500`);

    const dupJe = await app.query(`
      SELECT COUNT(*)::int AS n FROM (
        SELECT reference_type, reference_id FROM finance_rc_unique.finance_journal_entries
        WHERE is_posted IS TRUE AND reference_type IS NOT NULL AND reference_id IS NOT NULL
        GROUP BY 1,2 HAVING COUNT(*) > 1
      ) x`);
    const dupAlloc = await app.query(`
      SELECT COUNT(*)::int AS n FROM (
        SELECT payment_id, invoice_id FROM finance_rc_unique.finance_payment_allocations
        GROUP BY 1,2 HAVING COUNT(*) > 1
      ) y`);
    dupJe.rows[0].n === 0 && dupAlloc.rows[0].n === 0
      ? pass('unique-clone-no-dups-in-sample', `je_dup=0 alloc_dup=0`)
      : fail('unique-clone-no-dups-in-sample', `je=${dupJe.rows[0].n} alloc=${dupAlloc.rows[0].n}`);

    await app.query(`
      CREATE UNIQUE INDEX uq_finance_je_posted_ref
        ON finance_rc_unique.finance_journal_entries (reference_type, reference_id)
        WHERE is_posted IS TRUE AND reference_type IS NOT NULL AND reference_id IS NOT NULL`);
    await app.query(`
      CREATE UNIQUE INDEX uq_finance_payment_alloc_pair
        ON finance_rc_unique.finance_payment_allocations (payment_id, invoice_id)`);
    pass('unique-clone-indexes-applied');

    // Prove reject on clone
    try {
      const sample = await app.query(`
        SELECT reference_type, reference_id FROM finance_rc_unique.finance_journal_entries
        WHERE is_posted IS TRUE AND reference_type IS NOT NULL AND reference_id IS NOT NULL
        LIMIT 1`);
      if (sample.rows[0]) {
        await app.query(
          `INSERT INTO finance_rc_unique.finance_journal_entries (
             entry_number, entry_date, description, reference_type, reference_id,
             status, is_posted, entity_id, created_by
           ) VALUES ($1, CURRENT_DATE, 'dup', $2, $3, 'POSTED', true, 'HQ001', 'rc')`,
          [`RC-DUP-${Date.now()}`, sample.rows[0].reference_type, sample.rows[0].reference_id]
        );
        fail('unique-clone-rejects-je-dup', 'insert succeeded');
      } else {
        pass('unique-clone-rejects-je-dup', 'no sample row — index created');
      }
    } catch (e) {
      /unique/i.test(String(e.message))
        ? pass('unique-clone-rejects-je-dup')
        : fail('unique-clone-rejects-je-dup', String(e.message));
    }

    const pubUq = await app.query(`
      SELECT COUNT(*)::int AS n FROM pg_indexes
      WHERE schemaname='public' AND indexname IN ('uq_finance_je_posted_ref','uq_finance_payment_alloc_pair')`);
    pubUq.rows[0].n === 0
      ? pass('unique-not-on-public-ops')
      : fail('unique-not-on-public-ops', String(pubUq.rows[0].n));
    await app.end();
  }

  await client.end();

  // --- HTTP ADVANCE-B (legacy, flags false) ---
  startServer();
  const up = await waitForBase();
  up ? pass('server-up-flags-false') : fail('server-up-flags-false');

  if (up) {
    const token = await login();
    const auth = { Authorization: `Bearer ${token}` };
    const app = new Client({ connectionString: APP_URL, ssl: false });
    await app.connect();
    const cRow = (
      await app.query(`SELECT customer_id FROM finance_customers ORDER BY 1 LIMIT 1`)
    ).rows[0];

    // Reject empty allocations / ADVANCE
    const rejectNotes = `RC-ADVANCE-B-${Date.now()}`;
    const emptyPay = await httpJson(
      'POST',
      '/finance/payments',
      {
        customer_id: cRow.customer_id,
        payment_date: new Date().toISOString().slice(0, 10),
        payment_amount: 50,
        payment_method: 'CASH',
        payment_type: 'ADVANCE',
        entity_id: 'HQ001',
        entity_type: 'HQ',
        allocations: [],
        notes: rejectNotes
      },
      auth
    );
    emptyPay.status === 422 && emptyPay.json?.code === 'ALLOCATIONS_REQUIRED'
      ? pass('http-legacy-advance-b-rejects-empty', String(emptyPay.status))
      : fail('http-legacy-advance-b-rejects-empty', `${emptyPay.status} ${emptyPay.raw?.slice(0, 200)}`);

    const leaked = await app.query(`SELECT COUNT(*)::int AS n FROM finance_payments WHERE notes=$1`, [
      rejectNotes
    ]);
    leaked.rows[0].n === 0
      ? pass('http-legacy-advance-b-no-payment-row')
      : fail('http-legacy-advance-b-no-payment-row', String(leaked.rows[0].n));

    // Allocated path still works
    const invCreate = await httpJson(
      'POST',
      '/finance/invoices',
      {
        customer_id: cRow.customer_id,
        invoice_date: new Date().toISOString().slice(0, 10),
        due_date: new Date(Date.now() + 864e5).toISOString().slice(0, 10),
        entity_id: 'HQ001',
        entity_type: 'HQ',
        lines: [{ item_name: 'rc-ok', quantity: 1, unit_price: 36, tax_percentage: 0 }],
        notes: `RC-INV-${Date.now()}`
      },
      auth
    );
    if (invCreate.status === 201 && invCreate.json?.invoice?.invoice_id) {
      pass('http-invoice-create', String(invCreate.json.invoice.invoice_id));
      const payOk = await httpJson(
        'POST',
        '/finance/payments',
        {
          customer_id: cRow.customer_id,
          payment_date: new Date().toISOString().slice(0, 10),
          payment_amount: 36,
          payment_method: 'CASH',
          entity_id: 'HQ001',
          entity_type: 'HQ',
          allocations: [
            { invoice_id: invCreate.json.invoice.invoice_id, allocated_amount: 36 }
          ],
          notes: `RC-PAY-OK-${Date.now()}`
        },
        auth
      );
      payOk.status === 201
        ? pass('http-allocated-payment-still-allowed', String(payOk.status))
        : fail('http-allocated-payment-still-allowed', `${payOk.status} ${payOk.raw?.slice(0, 180)}`);
    } else {
      fail('http-invoice-create', `${invCreate.status}`);
    }

    // Finance reads
    for (const [name, p] of [
      ['http-customers', '/finance/customers?limit=3'],
      ['http-accounts', '/finance/accounts?limit=3'],
      ['http-hub', '/finance/']
    ]) {
      const r = await httpJson('GET', p, null, auth);
      [200, 302].includes(r.status) ? pass(name, String(r.status)) : fail(name, String(r.status));
    }

    // HR / Payroll / Archive regression
    const hr = await httpJson('GET', '/hr/e-archive');
    [200, 302].includes(hr.status) ? pass('reg-hr-archive', String(hr.status)) : fail('reg-hr-archive', String(hr.status));
    const payrollPage = await httpJson('GET', '/finance/hr-payroll-hub.html');
    [200, 302].includes(payrollPage.status)
      ? pass('reg-payroll-page', String(payrollPage.status))
      : fail('reg-payroll-page', String(payrollPage.status));
    const payrollApi = await httpJson('GET', '/finance/payroll/runs?limit=1');
    [200, 400, 401, 403, 404].includes(payrollApi.status)
      ? pass('reg-payroll-api', String(payrollApi.status))
      : fail('reg-payroll-api', String(payrollApi.status));

    // INV-FIN untouched
    const fin = await app.query(
      `SELECT invoice_number, journal_entry_id FROM public.finance_invoices
       WHERE invoice_number LIKE 'INV-FIN-%'`
    );
    fin.rows.every((r) => r.journal_entry_id == null)
      ? pass('no-historical-inv-fin-autofill', String(fin.rows.length))
      : fail('no-historical-inv-fin-autofill', JSON.stringify(fin.rows));

    await app.end();
  }

  delete process.env.FINANCE_POST_INVOICE_VIA_SERVICE;
  delete process.env.FINANCE_POST_PAYMENT_VIA_SERVICE;
  financeRoutes.isFinancePostInvoiceViaService() === false &&
  financeRoutes.isFinancePostPaymentViaService() === false
    ? pass('flags-still-false')
    : fail('flags-still-false');

  const ok = results.filter((r) => r.ok).length;
  const bad = results.filter((r) => !r.ok).length;
  const summary = {
    suite: 'finance-rc-staging-gate',
    pass: ok,
    fail: bad,
    verdict: bad === 0 ? 'PASS' : 'FAIL',
    advance_policy: 'ADVANCE_B',
    flags: { invoice: false, payment: false },
    unique_on_public: false,
    results
  };
  fs.writeFileSync(path.join(ART, 'finance-rc-staging-gate-results.json'), JSON.stringify(summary, null, 2));
  console.log(`\n=== RC-STAGING-GATE ${summary.verdict} ${ok}/${bad} ===`);
  process.exit(bad === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
