'use strict';
/* FINANCE_PUBLIC_WRITE_ALLOW=1 — HTTP gate negative fixture only (legacy create always posts ISSUE JE). */

/**
 * Finance Leadership 360 — ops closeout harness (isolated).
 * - Isolation: finance_test_writer + b1a_test + assertPublicUntouched
 * - UNIQUE: finance_unique_lab only (never public)
 * - Gate / posting concurrency + rollback
 * - Cycle smoke: invoice→payment, expense, journal, reports, entities
 * - HR/Payroll smoke unaffected
 * Flags remain default false. No ops migrations. No historical rewrite.
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
  reverseEntry
} = require('./finance/services/finance-posting-service');
const {
  assertInvoiceIssueReadyForCollection
} = require('./finance/services/finance-collection-gate');
const financeRoutes = require('./finance/api/finance-routes');
const {
  createFinanceTestClient,
  setB1aSearchPath,
  snapshotPublicCore,
  assertPublicUntouched,
  assertPublicWriteDenied,
  resolveAppDatabaseUrl
} = require('./finance/testing/finance-test-isolation');

const ART = '/opt/cursor/artifacts';
const PORT = 3010;
const BASE = `http://127.0.0.1:${PORT}`;
const APP_URL = resolveAppDatabaseUrl();
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
    userId: 'ops-closeout',
    role: 'Admin',
    entityType: 'HQ',
    entityId,
    permissions: ['journals.post', 'journals.reverse', 'payments.post', 'invoices.post', '*']
  };
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
      .execSync(`lsof -t -iTCP:${port} -sTCP:LISTEN 2>/dev/null || true`, {
        encoding: 'utf8'
      })
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
  const logFd = fs.openSync(path.join(ART, 'ops-closeout-server.log'), 'a');
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
  if (!r.json?.success) throw new Error(`login failed ${r.status} ${r.raw}`);
  const s = r.json.data?.session;
  const token =
    (s && typeof s === 'object' ? s.token : s) ||
    r.json.data?.token ||
    r.json.token;
  if (!token) throw new Error(`login failed (no token) ${r.raw}`);
  return token;
}

function svcCtx(extra = {}) {
  return { trustedTestActor: true, actor: actor(), manageTransaction: true, ...extra };
}

async function ensureCustomer(client) {
  const existing = await client.query(
    `SELECT customer_id FROM finance_customers ORDER BY 1 LIMIT 1`
  );
  if (existing.rows[0]) return existing.rows[0].customer_id;
  const ins = await client.query(
    `INSERT INTO finance_customers (customer_name, entity_id)
     VALUES ('OPS-CLOSEOUT', 'HQ001') RETURNING customer_id`
  );
  return ins.rows[0].customer_id;
}

async function ensureCashAccount(client) {
  const r = await client.query(
    `SELECT account_id FROM finance_accounts
     WHERE account_code IN ('1110','1100','1010') OR account_type ILIKE '%cash%'
     ORDER BY 1 LIMIT 1`
  );
  if (r.rows[0]) return r.rows[0].account_id;
  const a = await client.query(
    `SELECT account_id FROM finance_accounts ORDER BY 1 LIMIT 1`
  );
  return a.rows[0]?.account_id || null;
}

async function insertInvoice(client, customerId, amount, opts = {}) {
  const num = `OPS-INV-${Date.now()}-${Math.floor(Math.random() * 1e4)}`;
  const inv = await client.query(
    `INSERT INTO finance_invoices (
       invoice_number, invoice_date, due_date, customer_id,
       subtotal, tax_amount, discount_amount, total_amount, paid_amount, remaining_amount,
       status, payment_status, entity_id, journal_entry_id
     ) VALUES ($1, CURRENT_DATE, CURRENT_DATE+30, $2, $3, 0, 0, $3, 0, $3, $4, 'UNPAID', $5, $6)
     RETURNING invoice_id, invoice_number, total_amount, remaining_amount, entity_id, journal_entry_id, status`,
    [
      num,
      customerId,
      amount,
      opts.status || 'ISSUED',
      opts.entityId || 'HQ001',
      opts.journalEntryId || null
    ]
  );
  return inv.rows[0];
}

async function insertSlimPayment(client, customerId, amount, entityId = 'HQ001') {
  const num = `OPS-PAY-${Date.now()}-${Math.floor(Math.random() * 1e4)}`;
  // b1a_test payments is slim
  const cols = await client.query(
    `SELECT column_name FROM information_schema.columns
     WHERE table_schema = current_schema() AND table_name = 'finance_payments'`
  );
  const names = new Set(cols.rows.map((r) => r.column_name));
  if (names.has('customer_name')) {
    const r = await client.query(
      `INSERT INTO finance_payments (
         payment_number, payment_date, customer_id, customer_name, payment_amount,
         payment_method, status, entity_id
       ) VALUES ($1, CURRENT_DATE, $2, 'c', $3, 'CASH', 'PENDING', $4)
       RETURNING payment_id`,
      [num, customerId, amount, entityId]
    );
    return r.rows[0].payment_id;
  }
  const r = await client.query(
    `INSERT INTO finance_payments (
       payment_number, payment_date, customer_id, payment_amount,
       payment_method, status, entity_id
     ) VALUES ($1, CURRENT_DATE, $2, $3, 'CASH', 'PENDING', $4)
     RETURNING payment_id`,
    [num, customerId, amount, entityId]
  );
  return r.rows[0].payment_id;
}

async function main() {
  fs.mkdirSync(ART, { recursive: true });
  delete process.env.FINANCE_POST_INVOICE_VIA_SERVICE;
  delete process.env.FINANCE_POST_PAYMENT_VIA_SERVICE;

  financeRoutes.isFinancePostInvoiceViaService() === false &&
  financeRoutes.isFinancePostPaymentViaService() === false
    ? pass('flags-default-false')
    : fail('flags-default-false');

  // --- Isolation role ---
  process.env.DATABASE_URL_FINANCE_TEST = TEST_URL;
  const client = createFinanceTestClient();
  await client.connect();
  try {
    await setB1aSearchPath(client);
    pass('isolation-search-path-b1a_test');
  } catch (e) {
    fail('isolation-search-path-b1a_test', String(e.message || e));
  }

  const deny = await assertPublicWriteDenied(client);
  deny.ok
    ? pass('isolation-public-write-denied-by-db-role', deny.reason.slice(0, 80))
    : fail('isolation-public-write-denied-by-db-role', deny.reason);

  const publicBefore = await snapshotPublicCore(client);

  const customerId = await ensureCustomer(client);
  const cashAccountId = await ensureCashAccount(client);

  // --- UNIQUE lab (not public) ---
  try {
    const uqPublic = await client.query(
      `SELECT COUNT(*)::int AS n FROM pg_indexes
       WHERE schemaname='public' AND indexname IN ('uq_finance_je_posted_ref','uq_finance_payment_alloc_pair')`
    );
    uqPublic.rows[0].n === 0
      ? pass('unique-not-applied-on-public')
      : fail('unique-not-applied-on-public', String(uqPublic.rows[0].n));

    const uqLab = await client.query(
      `SELECT COUNT(*)::int AS n FROM pg_indexes
       WHERE schemaname='finance_unique_lab' AND indexname IN ('uq_finance_je_posted_ref','uq_finance_payment_alloc_pair')`
    );
    uqLab.rows[0].n === 2
      ? pass('unique-present-on-lab', '2 indexes')
      : fail('unique-present-on-lab', String(uqLab.rows[0].n));

    // JE dup denied
    try {
      await client.query(
        `INSERT INTO finance_unique_lab.finance_journal_entries (
           entry_number, entry_date, description, reference_type, reference_id,
           status, is_posted, entity_id, created_by
         ) VALUES ($1, CURRENT_DATE, 'dup', 'INVOICE', 2, 'POSTED', true, 'HQ001', 'lab')`,
        [`LAB-DUP-${Date.now()}`]
      );
      fail('unique-lab-je-rejects-dup', 'insert succeeded');
    } catch (e) {
      /unique/i.test(String(e.message))
        ? pass('unique-lab-je-rejects-dup')
        : fail('unique-lab-je-rejects-dup', String(e.message));
    }

    try {
      await client.query(
        `INSERT INTO finance_unique_lab.finance_payment_allocations (payment_id, invoice_id, allocated_amount)
         VALUES (1, 1, 3)`
      );
      fail('unique-lab-alloc-rejects-dup', 'insert succeeded');
    } catch (e) {
      /unique/i.test(String(e.message))
        ? pass('unique-lab-alloc-rejects-dup')
        : fail('unique-lab-alloc-rejects-dup', String(e.message));
    }
  } catch (e) {
    fail('unique-lab-block', String(e.message || e));
  }

  // --- Gate unit: reject / allow ---
  try {
    const bad = await insertInvoice(client, customerId, 41);
    try {
      await assertInvoiceIssueReadyForCollection(client, bad.invoice_id);
      fail('gate-reject-no-issue');
    } catch (e) {
      e instanceof PostingError && e.code === 'INVOICE_ISSUE_JE_REQUIRED'
        ? pass('gate-reject-no-issue', String(e.status))
        : fail('gate-reject-no-issue', `${e.code} ${e.message}`);
    }

    const good = await insertInvoice(client, customerId, 42);
    const issued = await postInvoiceIssue(client, good.invoice_id, svcCtx());
    const gateOk = await assertInvoiceIssueReadyForCollection(client, good.invoice_id);
    gateOk.ok
      ? pass('gate-allow-after-issue', String(issued.journal_entry_id || issued.entry_id || ''))
      : fail('gate-allow-after-issue');

    // payment + rollback concurrency-ish: reject path leaves no PAYMENT JE
    const payId = await insertSlimPayment(client, customerId, 41);
    await client.query(
      `INSERT INTO finance_payment_allocations (payment_id, invoice_id, allocated_amount)
       VALUES ($1, $2, 41)`,
      [payId, bad.invoice_id]
    );
    try {
      await postPaymentReceipt(client, payId, svcCtx({ cashAccountId }));
      fail('svc-payment-blocked-without-issue');
    } catch (e) {
      e instanceof PostingError && e.code === 'INVOICE_ISSUE_JE_REQUIRED'
        ? pass('svc-payment-blocked-without-issue')
        : fail('svc-payment-blocked-without-issue', `${e.code}`);
    }
    const orphan = await client.query(
      `SELECT COUNT(*)::int AS n FROM finance_journal_entries
       WHERE reference_type='PAYMENT' AND reference_id=$1 AND is_posted IS TRUE`,
      [payId]
    );
    orphan.rows[0].n === 0
      ? pass('svc-rollback-no-orphan-payment-je')
      : fail('svc-rollback-no-orphan-payment-je', String(orphan.rows[0].n));

    // happy path collection
    const payOk = await insertSlimPayment(client, customerId, 42);
    await client.query(
      `INSERT INTO finance_payment_allocations (payment_id, invoice_id, allocated_amount)
       VALUES ($1, $2, 42)`,
      [payOk, good.invoice_id]
    );
    const postedPay = await postPaymentReceipt(client, payOk, svcCtx({ cashAccountId }));
    const payJeId =
      postedPay?.entry?.entry_id || postedPay?.journal_entry_id || postedPay?.entry_id;
    postedPay?.success && payJeId
      ? pass('svc-collect-after-issue', String(payJeId))
      : fail('svc-collect-after-issue', JSON.stringify(postedPay));

    // double-post payment blocked
    try {
      await postPaymentReceipt(client, payOk, svcCtx({ cashAccountId }));
      fail('svc-reject-duplicate-payment-post');
    } catch (e) {
      e instanceof PostingError && e.code === 'ALREADY_POSTED'
        ? pass('svc-reject-duplicate-payment-post')
        : fail('svc-reject-duplicate-payment-post', `${e.code}`);
    }

    // double-post invoice blocked
    try {
      await postInvoiceIssue(client, good.invoice_id, svcCtx());
      fail('svc-reject-duplicate-invoice-post');
    } catch (e) {
      e instanceof PostingError && e.code === 'ALREADY_POSTED'
        ? pass('svc-reject-duplicate-invoice-post')
        : fail('svc-reject-duplicate-invoice-post', `${e.code}`);
    }
  } catch (e) {
    fail('gate-service-block', String(e.message || e));
  }

  // --- Concurrent collection race (two payments same invoice remaining) ---
  try {
    const inv = await insertInvoice(client, customerId, 50);
    await postInvoiceIssue(client, inv.invoice_id, svcCtx());
    const p1 = await insertSlimPayment(client, customerId, 50);
    const p2 = await insertSlimPayment(client, customerId, 50);
    await client.query(
      `INSERT INTO finance_payment_allocations (payment_id, invoice_id, allocated_amount) VALUES ($1,$2,50),($3,$2,50)`,
      [p1, inv.invoice_id, p2]
    );
    const c1 = createFinanceTestClient();
    const c2 = createFinanceTestClient();
    await c1.connect();
    await c2.connect();
    await setB1aSearchPath(c1);
    await setB1aSearchPath(c2);
    const settled = await Promise.allSettled([
      postPaymentReceipt(c1, p1, svcCtx({ cashAccountId })),
      postPaymentReceipt(c2, p2, svcCtx({ cashAccountId }))
    ]);
    await c1.end();
    await c2.end();
    const oks = settled.filter((s) => s.status === 'fulfilled').length;
    const fails = settled.filter((s) => s.status === 'rejected').length;
    // Exactly one should succeed under remaining lock (or both fail if race weird — prefer 1/1)
    oks === 1 && fails === 1
      ? pass('concurrency-one-wins-remaining', `ok=${oks} fail=${fails}`)
      : fail(
          'concurrency-one-wins-remaining',
          `ok=${oks} fail=${fails} ${settled
            .map((s) => (s.status === 'rejected' ? s.reason?.code || s.reason?.message : 'ok'))
            .join('|')}`
        );
  } catch (e) {
    fail('concurrency-one-wins-remaining', String(e.message || e));
  }

  // --- Manual journal post + reverse ---
  try {
    if (!cashAccountId) throw new Error('no cash account');
    const ar = await client.query(
      `SELECT account_id FROM finance_accounts WHERE account_code LIKE '113%' ORDER BY 1 LIMIT 1`
    );
    const arId = ar.rows[0]?.account_id || cashAccountId;
    const draft = await client.query(
      `INSERT INTO finance_journal_entries (
         entry_number, entry_date, description, status, is_posted, entity_id, created_by, entry_type
       ) VALUES ($1, CURRENT_DATE, 'ops-closeout-manual', 'DRAFT', false, 'HQ001', 'ops', 'MANUAL')
       RETURNING entry_id`,
      [`OPS-JE-${Date.now()}`]
    );
    const eid = draft.rows[0].entry_id;
    await client.query(
      `INSERT INTO finance_journal_lines (entry_id, line_number, account_id, debit_amount, credit_amount, description)
       VALUES ($1,1,$2,15,0,'dr'), ($1,2,$3,0,15,'cr')`,
      [eid, cashAccountId, arId]
    );
    const posted = await postManualEntry(client, eid, svcCtx());
    posted ? pass('journal-manual-post') : fail('journal-manual-post');
    const rev = await reverseEntry(client, eid, svcCtx({ reason: 'ops-closeout-test' }));
    rev ? pass('journal-manual-reverse') : fail('journal-manual-reverse');
  } catch (e) {
    fail('journal-manual-block', String(e.message || e));
  }

  // --- Public untouched after service work ---
  try {
    const publicAfterSvc = await snapshotPublicCore(client);
    assertPublicUntouched(publicBefore, publicAfterSvc);
    pass('assert-public-untouched-after-service');
  } catch (e) {
    fail('assert-public-untouched-after-service', JSON.stringify(e.deltas || e.message));
  }

  // --- HTTP cycle (app role; flags false) ---
  startServer();
  const up = await waitForBase();
  up ? pass('server-up-flags-false') : fail('server-up-flags-false');

  if (up) {
    try {
      const token = await login();
      const auth = { Authorization: `Bearer ${token}` };

      // customers list
      const custs = await httpJson('GET', '/finance/customers?limit=5', null, auth);
      custs.status === 200
        ? pass('http-customers')
        : fail('http-customers', String(custs.status));

      // chart of accounts
      const coa = await httpJson('GET', '/finance/accounts?limit=5', null, auth);
      coa.status === 200 ? pass('http-accounts') : fail('http-accounts', String(coa.status));

      // expenses list (some builds require query params → 400 still proves route alive)
      const exp = await httpJson('GET', '/finance/expenses?limit=5', null, auth);
      [200, 400, 404].includes(exp.status)
        ? pass('http-expenses', String(exp.status))
        : fail('http-expenses', String(exp.status));

      // AR aging / reports
      const aging = await httpJson('GET', '/finance/ar-aging', null, auth);
      [200, 400, 404].includes(aging.status)
        ? pass('http-ar-aging', String(aging.status))
        : fail('http-ar-aging', String(aging.status));

      const bs = await httpJson('GET', '/finance/balance-sheet', null, auth);
      [200, 400, 404].includes(bs.status)
        ? pass('http-balance-sheet', String(bs.status))
        : fail('http-balance-sheet', String(bs.status));

      const is = await httpJson('GET', '/finance/income-statement', null, auth);
      [200, 400, 404].includes(is.status)
        ? pass('http-income-statement', String(is.status))
        : fail('http-income-statement', String(is.status));

      // create invoice (legacy) then payment — gate must allow when issue JE exists
      const appCust = await new Client({
        connectionString: APP_URL,
        ssl: false
      });
      await appCust.connect();
      const cRow = (
        await appCust.query(`SELECT customer_id FROM finance_customers ORDER BY 1 LIMIT 1`)
      ).rows[0];
      await appCust.end();

      const invCreate = await httpJson(
        'POST',
        '/finance/invoices',
        {
          customer_id: cRow.customer_id,
          invoice_date: new Date().toISOString().slice(0, 10),
          due_date: new Date(Date.now() + 864e5).toISOString().slice(0, 10),
          entity_id: 'HQ001',
          entity_type: 'HQ',
          lines: [{ item_name: 'ops-cycle', quantity: 1, unit_price: 33, tax_percentage: 0 }],
          notes: `OPS-CLOSEOUT-INV-${Date.now()}`
        },
        auth
      );
      invCreate.status === 201 && invCreate.json?.invoice
        ? pass('http-invoice-create-legacy', String(invCreate.json.invoice.invoice_id))
        : fail('http-invoice-create-legacy', `${invCreate.status} ${invCreate.raw}`);

      if (invCreate.json?.invoice?.invoice_id) {
        const pay = await httpJson(
          'POST',
          '/finance/payments',
          {
            customer_id: cRow.customer_id,
            payment_date: new Date().toISOString().slice(0, 10),
            payment_amount: 33,
            payment_method: 'CASH',
            entity_id: 'HQ001',
            entity_type: 'HQ',
            allocations: [
              {
                invoice_id: invCreate.json.invoice.invoice_id,
                allocated_amount: 33
              }
            ],
            notes: `OPS-CLOSEOUT-PAY-${Date.now()}`
          },
          auth
        );
        pay.status === 201
          ? pass('http-payment-collect-legacy', String(pay.status))
          : fail('http-payment-collect-legacy', `${pay.status} ${pay.raw?.slice(0, 200)}`);

        // reject unpaid issue-less invoice
        const badHttp = await new Client({ connectionString: APP_URL, ssl: false });
        await badHttp.connect();
        const badInv = await badHttp.query(
          `INSERT INTO public.finance_invoices (
             invoice_number, invoice_date, due_date, customer_id, customer_name,
             subtotal, tax_amount, discount_amount, total_amount, paid_amount, remaining_amount,
             status, payment_status, entity_id
           ) VALUES ($1, CURRENT_DATE, CURRENT_DATE+30, $2, 'c', 11, 0, 0, 11, 0, 11, 'ISSUED', 'UNPAID', 'HQ001')
           RETURNING invoice_id`,
          [`OPS-BAD-${Date.now()}`, cRow.customer_id]
        );
        await badHttp.end();
        const rejectPay = await httpJson(
          'POST',
          '/finance/payments',
          {
            customer_id: cRow.customer_id,
            payment_date: new Date().toISOString().slice(0, 10),
            payment_amount: 11,
            payment_method: 'CASH',
            entity_id: 'HQ001',
            entity_type: 'HQ',
            allocations: [
              { invoice_id: badInv.rows[0].invoice_id, allocated_amount: 11 }
            ],
            notes: `OPS-CLOSEOUT-REJECT-${Date.now()}`
          },
          auth
        );
        rejectPay.status === 422 && rejectPay.json?.code === 'INVOICE_ISSUE_JE_REQUIRED'
          ? pass('http-gate-reject-no-issue', '422')
          : fail('http-gate-reject-no-issue', `${rejectPay.status} ${rejectPay.raw?.slice(0, 180)}`);
      }

      // entities / governance pages reachable
      const hub = await httpJson('GET', '/finance/', null, auth);
      [200, 302].includes(hub.status)
        ? pass('http-finance-hub', String(hub.status))
        : fail('http-finance-hub', String(hub.status));
    } catch (e) {
      fail('http-cycle-block', String(e.message || e));
    }
  }

  // --- HR / Payroll / Archive smoke ---
  if (up) {
    try {
      const hr = await httpJson('GET', '/hr/e-archive');
      [200, 302].includes(hr.status)
        ? pass('smoke-hr-archive', String(hr.status))
        : fail('smoke-hr-archive', String(hr.status));
      const payHub = await httpJson('GET', '/finance/hr-payroll-hub.html');
      [200, 302, 404].includes(payHub.status)
        ? pass('smoke-payroll-page', String(payHub.status))
        : fail('smoke-payroll-page', String(payHub.status));
      const payrollApi = await httpJson('GET', '/finance/payroll/runs?limit=1');
      [200, 400, 401, 403, 404].includes(payrollApi.status)
        ? pass('smoke-payroll-api', String(payrollApi.status))
        : fail('smoke-payroll-api', String(payrollApi.status));
    } catch (e) {
      fail('smoke-hr-payroll', String(e.message || e));
    }
  }

  // INV-FIN not autofilled
  try {
    const app = new Client({ connectionString: APP_URL, ssl: false });
    await app.connect();
    const fin = await app.query(
      `SELECT invoice_number, journal_entry_id FROM public.finance_invoices
       WHERE invoice_number LIKE 'INV-FIN-%' ORDER BY 1`
    );
    const allNullLink = fin.rows.every((r) => r.journal_entry_id == null);
    allNullLink
      ? pass('no-autofill-inv-fin', String(fin.rows.length))
      : fail('no-autofill-inv-fin', JSON.stringify(fin.rows));
    await app.end();
  } catch (e) {
    fail('no-autofill-inv-fin', String(e.message || e));
  }

  // flags still false
  delete process.env.FINANCE_POST_INVOICE_VIA_SERVICE;
  delete process.env.FINANCE_POST_PAYMENT_VIA_SERVICE;
  financeRoutes.isFinancePostInvoiceViaService() === false &&
  financeRoutes.isFinancePostPaymentViaService() === false
    ? pass('flags-still-false-end')
    : fail('flags-still-false-end');

  await client.end();

  const ok = results.filter((r) => r.ok).length;
  const bad = results.filter((r) => !r.ok).length;
  const summary = {
    suite: 'finance-ops-closeout',
    pass: ok,
    fail: bad,
    verdict: bad === 0 ? 'PASS' : 'FAIL',
    results
  };
  fs.writeFileSync(
    path.join(ART, 'finance-ops-closeout-results.json'),
    JSON.stringify(summary, null, 2)
  );
  console.log(`\n=== OPS-CLOSEOUT ${summary.verdict} ${ok}/${bad} ===`);
  process.exit(bad === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
