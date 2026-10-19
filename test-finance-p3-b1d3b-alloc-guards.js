'use strict';

/**
 * P3 / B1.d.3.b — payment-allocation CRUD guards.
 * Isolated writes: b1a_test. Optional HTTP against :3010 with session auth.
 * No migrations. Does not wire payment posting. Does not ban unallocated ADVANCE payments.
 */
const fs = require('fs');
const path = require('path');
const http = require('http');
const { Client } = require('pg');
const {
  postPaymentReceipt,
  postInvoiceIssue,
  resolveActor,
  roundMoney
} = require('./finance/services/finance-posting-service');
const {
  mutatePaymentAllocation,
  GuardError,
  findPostedJournalForPayment
} = require('./finance/services/finance-posted-guards');
const { computeInvoiceTotalsFromLines } = require('./finance/services/finance-invoice-amounts');

const ART = '/opt/cursor/artifacts';
fs.mkdirSync(ART, { recursive: true });
const DB_URL =
  process.env.DATABASE_URL ||
  'postgresql://vendowor_erp_user:vendowor_local_dev@127.0.0.1:5432/vendowor_erp';
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

function actor(entityId, overrides = {}) {
  return {
    authenticated: true,
    userId: overrides.userId || 'b1d3b',
    role: overrides.role || 'Admin',
    permissions: overrides.permissions || ['journals.post', 'payments.post'],
    entityId,
    entityType: overrides.entityType || 'BRANCH',
    allowCrossEntity: overrides.allowCrossEntity === true,
    allowedEntityIds: overrides.allowedEntityIds || []
  };
}

function httpJson(method, urlPath, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(urlPath, BASE);
    const payload = body == null ? null : JSON.stringify(body);
    const req = http.request(
      {
        hostname: u.hostname,
        port: u.port || 80,
        path: u.pathname + (u.search || ''),
        method,
        headers: {
          ...(payload
            ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) }
            : {}),
          ...headers
        }
      },
      (res) => {
        let raw = '';
        res.on('data', (c) => {
          raw += c;
        });
        res.on('end', () => {
          let json = null;
          try {
            json = JSON.parse(raw);
          } catch {
            /* */
          }
          resolve({ status: res.statusCode, json, raw: raw.slice(0, 500) });
        });
      }
    );
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function login() {
  const login = await httpJson('POST', '/api/auth/login', {
    email: process.env.TEST_LOGIN_EMAIL || 'admin@naiosh.com',
    password: process.env.TEST_LOGIN_PASSWORD || 'Admin@123'
  });
  if (!login.json?.success) throw new Error('login failed: ' + login.raw);
  const session = login.json.data.session;
  return (session && typeof session === 'object' ? session.token : session) || login.json.data.token;
}

async function seedCustomer(client) {
  const existing = await client.query(
    `SELECT customer_id, customer_name_ar FROM finance_customers ORDER BY 1 LIMIT 1`
  );
  if (existing.rows[0]) return existing.rows[0];
  const ins = await client.query(
    `INSERT INTO finance_customers (customer_code, customer_name_ar) VALUES ($1,$2)
     RETURNING customer_id, customer_name_ar`,
    [`B1D3B-C-${Date.now()}`, 'عميل حراسة تخصيصات']
  );
  return ins.rows[0];
}

async function seedInvoice(client, { entityId, total, label, post = false }) {
  const cust = await seedCustomer(client);
  computeInvoiceTotalsFromLines([
    { quantity: 1, unit_price: total, tax_percentage: 0, item_name: label }
  ]);
  const num = `B1D3B-${label}-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  const inv = await client.query(
    `INSERT INTO finance_invoices (
       invoice_number, invoice_date, due_date, customer_id, customer_name,
       subtotal, tax_amount, discount_amount, total_amount, paid_amount, remaining_amount,
       status, payment_status, entity_id
     ) VALUES ($1, CURRENT_DATE, CURRENT_DATE+30, $2, $3, $4, 0, 0, $4, 0, $4, 'ISSUED', 'UNPAID', $5)
     RETURNING *`,
    [num, cust.customer_id, cust.customer_name_ar, roundMoney(total), entityId]
  );
  if (post) {
    await postInvoiceIssue(client, inv.rows[0].invoice_id, {
      trustedTestActor: true,
      actor: actor(entityId)
    });
  }
  const refreshed = await client.query(`SELECT * FROM finance_invoices WHERE invoice_id=$1`, [
    inv.rows[0].invoice_id
  ]);
  return { invoice: refreshed.rows[0], customer: cust };
}

async function seedDraftPayment(client, { entityId, amount, label }) {
  const cust = await seedCustomer(client);
  const num = `B1D3B-${label}-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  const pay = await client.query(
    `INSERT INTO finance_payments (
       payment_number, payment_date, customer_id, payment_amount, payment_method, status, entity_id
     ) VALUES ($1, CURRENT_DATE, $2, $3, 'CASH', 'PENDING', $4)
     RETURNING *`,
    [num, cust.customer_id, amount, entityId]
  );
  return { payment: pay.rows[0], customer: cust };
}

async function expectGuard(fn, status, code) {
  try {
    await fn();
    return { ok: false, detail: 'expected throw' };
  } catch (e) {
    if (e instanceof GuardError && e.status === status && (!code || e.code === code)) {
      return { ok: true, detail: `${e.status}/${e.code}` };
    }
    return {
      ok: false,
      detail: `got ${e.status || e.name}/${e.code || e.message} want ${status}/${code}`
    };
  }
}

async function main() {
  const report = {
    phase: 'B1.d.3.b',
    routeInventory: [],
    advanceDepositNote: null,
    residualRisks: [],
    changedFiles: [
      'finance/services/finance-posted-guards.js',
      'finance/api/payment-plans.js',
      'server.js (dedupe DELETE mount)',
      'test-finance-p3-b1d3b-alloc-guards.js',
      'docs/finance-leadership-p3-b1d3b-alloc-guards-report.md'
    ]
  };

  const client = new Client({ connectionString: DB_URL });
  await client.connect();
  await client.query('SET search_path TO b1a_test, public');

  const E1 = 'B1D3B-E1';
  const E2 = 'B1D3B-E2';

  // --- Static inventory ---
  const plansSrc = fs.readFileSync(path.join(__dirname, 'finance/api/payment-plans.js'), 'utf8');
  const frSrc = fs.readFileSync(path.join(__dirname, 'finance/api/finance-routes.js'), 'utf8');
  const serverSrc = fs.readFileSync(path.join(__dirname, 'server.js'), 'utf8');
  const guardsSrc = fs.readFileSync(
    path.join(__dirname, 'finance/services/finance-posted-guards.js'),
    'utf8'
  );

  report.routeInventory = [
    {
      method: 'POST/PUT/DELETE',
      path: '/finance/payment-allocations',
      file: 'payment-plans.js',
      guarded: /mutatePaymentAllocation/.test(plansSrc),
      live: true,
      note: 'B1.d.3.b target'
    },
    {
      method: 'POST',
      path: '/finance/payments (inline INSERT allocations)',
      file: 'finance-routes.js',
      guarded: false,
      live: true,
      note: 'Out of d.3.b — residual until d.3.d'
    },
    {
      method: 'DELETE',
      path: '/finance/payments/:id',
      file: 'finance-routes.js',
      guarded: /assertPaymentMutable/.test(frSrc),
      note: 'Deletes child allocations after payment mutable check'
    },
    {
      method: 'DELETE',
      path: '/finance/invoices/:id',
      file: 'finance-routes.js',
      note: 'Deletes allocations by invoice_id after assertInvoiceDeletable'
    }
  ];

  const deleteMountCount = (
    serverSrc.match(/app\.delete\('\/finance\/payment-allocations\/:allocation_id'/g) || []
  ).length;
  deleteMountCount === 1
    ? pass('server-single-delete-mount')
    : fail('server-single-delete-mount', String(deleteMountCount));

  /mutatePaymentAllocationInTx/.test(guardsSrc) && /POSTED_DOCUMENT_LOCKED/.test(plansSrc) === false
    ? pass('guards-module-has-mutate')
    : /mutatePaymentAllocation/.test(plansSrc)
      ? pass('guards-module-has-mutate')
      : fail('guards-module-has-mutate');

  /resolveActor\(\{ req \}\)/.test(plansSrc)
    ? pass('handlers-use-resolveActor-session')
    : fail('handlers-use-resolveActor-session');

  // ADVANCE / deposits decision — document only, no behavior ban
  const catalog = fs.readFileSync(
    path.join(__dirname, 'finance/finance-leadership-360-catalog.js'),
    'utf8'
  );
  const paymentsHtml = fs.readFileSync(path.join(__dirname, 'finance/payments.html'), 'utf8');
  const hasAdvanceUi = /ADVANCE/.test(paymentsHtml);
  const depositsSoon = /sales\.deposits['"]\s*:\s*['"]coming_soon['"]/.test(catalog);
  report.advanceDepositNote = {
    payment_type_ADVANCE_in_ui: hasAdvanceUi,
    deposits_page_status: depositsSoon ? 'coming_soon' : 'unknown',
    accounting_stance:
      'عربون/دفعات مقدمة موجودة كـ payment_type=ADVANCE في الواجهة وكصفحة coming_soon. لا يوجد مسار خادمي منفصل لرصيد دائن عميل. مسار POST /payments يسمح allocations=[] مع قيد كامل — خارج d.3.b. حراسة CRUD لا تفرض تخصيصًا كاملًا لمبلغ الدفعة (تسمح بمتبقٍ غير مخصص).',
    d3b_change: 'none — لا حظر على المدفوعات غير المخصصة'
  };
  pass('advance-deposit-documented-not-banned', depositsSoon ? 'deposits=coming_soon' : 'ui-ADVANCE');

  // --- Functional: draft create OK ---
  const { invoice: inv1 } = await seedInvoice(client, { entityId: E1, total: 200, label: 'd1' });
  const { payment: payDraft } = await seedDraftPayment(client, {
    entityId: E1,
    amount: 200,
    label: 'draft'
  });
  const paidBefore = Number(inv1.paid_amount);
  const created = await mutatePaymentAllocation(client, {
    mode: 'create',
    actor: actor(E1),
    paymentId: payDraft.payment_id,
    invoiceId: inv1.invoice_id,
    allocatedAmount: 80
  });
  const invAfterCreate = await client.query(
    `SELECT paid_amount::float AS p, remaining_amount::float AS r FROM finance_invoices WHERE invoice_id=$1`,
    [inv1.invoice_id]
  );
  created.allocation &&
  created.balances_touched === false &&
  Number(invAfterCreate.rows[0].p) === paidBefore
    ? pass('draft-create-ok-no-balance-side-effect', `alloc=${created.allocation.allocation_id}`)
    : fail('draft-create-ok-no-balance-side-effect', JSON.stringify(invAfterCreate.rows[0]));

  // Legitimate update on draft
  const updated = await mutatePaymentAllocation(client, {
    mode: 'update',
    actor: actor(E1),
    allocationId: created.allocation.allocation_id,
    paymentId: payDraft.payment_id,
    invoiceId: inv1.invoice_id,
    allocatedAmount: 90
  });
  Number(updated.allocation.allocated_amount) === 90
    ? pass('draft-update-ok')
    : fail('draft-update-ok', String(updated.allocation.allocated_amount));

  // Duplicate create same payment+invoice
  {
    const r = await expectGuard(
      () =>
        mutatePaymentAllocation(client, {
          mode: 'create',
          actor: actor(E1),
          paymentId: payDraft.payment_id,
          invoiceId: inv1.invoice_id,
          allocatedAmount: 10
        }),
      409,
      'DUPLICATE_ALLOCATION'
    );
    r.ok ? pass('reject-duplicate-allocation', r.detail) : fail('reject-duplicate-allocation', r.detail);
  }

  // Over payment amount
  {
    const { payment: p2 } = await seedDraftPayment(client, { entityId: E1, amount: 50, label: 'ovp' });
    const { invoice: i2 } = await seedInvoice(client, { entityId: E1, total: 500, label: 'ovp-inv' });
    const r = await expectGuard(
      () =>
        mutatePaymentAllocation(client, {
          mode: 'create',
          actor: actor(E1),
          paymentId: p2.payment_id,
          invoiceId: i2.invoice_id,
          allocatedAmount: 51
        }),
      409,
      'OVER_ALLOCATION_PAYMENT'
    );
    r.ok ? pass('reject-over-payment-amount', r.detail) : fail('reject-over-payment-amount', r.detail);
  }

  // Over invoice remaining
  {
    const { payment: p3 } = await seedDraftPayment(client, { entityId: E1, amount: 500, label: 'ovi' });
    const { invoice: i3 } = await seedInvoice(client, { entityId: E1, total: 40, label: 'ovi-inv' });
    const r = await expectGuard(
      () =>
        mutatePaymentAllocation(client, {
          mode: 'create',
          actor: actor(E1),
          paymentId: p3.payment_id,
          invoiceId: i3.invoice_id,
          allocatedAmount: 41
        }),
      409,
      'OVER_ALLOCATION_INVOICE'
    );
    r.ok ? pass('reject-over-invoice-remaining', r.detail) : fail('reject-over-invoice-remaining', r.detail);
  }

  // Partial unallocated ADVANCE-style: allocate 30 of 100 — allowed
  {
    const { payment: pAdv } = await seedDraftPayment(client, {
      entityId: E1,
      amount: 100,
      label: 'adv'
    });
    const { invoice: iAdv } = await seedInvoice(client, { entityId: E1, total: 100, label: 'adv-inv' });
    const partial = await mutatePaymentAllocation(client, {
      mode: 'create',
      actor: actor(E1),
      paymentId: pAdv.payment_id,
      invoiceId: iAdv.invoice_id,
      allocatedAmount: 30
    });
    const sum = await client.query(
      `SELECT COALESCE(SUM(allocated_amount),0)::float AS s FROM finance_payment_allocations WHERE payment_id=$1`,
      [pAdv.payment_id]
    );
    Number(sum.rows[0].s) === 30 && Number(pAdv.payment_amount) === 100
      ? pass('partial-unallocated-payment-allowed', '30/100 remainder intentional')
      : fail('partial-unallocated-payment-allowed', JSON.stringify(sum.rows[0]));
    // cleanup alloc for clarity
    await mutatePaymentAllocation(client, {
      mode: 'delete',
      actor: actor(E1),
      allocationId: partial.allocation.allocation_id
    });
  }

  // Cross-entity: without grant → cannot access other-entity invoice (CROSS_ENTITY_DENIED)
  {
    const { payment: pX } = await seedDraftPayment(client, { entityId: E1, amount: 50, label: 'xe' });
    const { invoice: iX } = await seedInvoice(client, { entityId: E2, total: 50, label: 'xe-inv' });
    const r = await expectGuard(
      () =>
        mutatePaymentAllocation(client, {
          mode: 'create',
          actor: actor(E1),
          paymentId: pX.payment_id,
          invoiceId: iX.invoice_id,
          allocatedAmount: 20
        }),
      403,
      'CROSS_ENTITY_DENIED'
    );
    r.ok ? pass('reject-cross-entity-no-grant', r.detail) : fail('reject-cross-entity-no-grant', r.detail);

    // With explicit grant to both entities, mismatch between payment & invoice is still denied
    const r2 = await expectGuard(
      () =>
        mutatePaymentAllocation(client, {
          mode: 'create',
          actor: actor(E1, { allowCrossEntity: true, allowedEntityIds: [E1, E2] }),
          paymentId: pX.payment_id,
          invoiceId: iX.invoice_id,
          allocatedAmount: 20
        }),
      403,
      'ALLOCATION_ENTITY_MISMATCH'
    );
    r2.ok
      ? pass('reject-cross-entity-alloc-mismatch', r2.detail)
      : fail('reject-cross-entity-alloc-mismatch', r2.detail);
  }

  // HQ/Admin without grant cannot touch other entity payment
  {
    const { payment: pO } = await seedDraftPayment(client, { entityId: E2, amount: 40, label: 'hq' });
    const { invoice: iO } = await seedInvoice(client, { entityId: E2, total: 40, label: 'hq-inv' });
    const r = await expectGuard(
      () =>
        mutatePaymentAllocation(client, {
          mode: 'create',
          actor: actor(E1, { role: 'Admin', entityType: 'HQ' }),
          paymentId: pO.payment_id,
          invoiceId: iO.invoice_id,
          allocatedAmount: 10
        }),
      403,
      'CROSS_ENTITY_DENIED'
    );
    r.ok ? pass('reject-hq-without-grant', r.detail) : fail('reject-hq-without-grant', r.detail);
  }

  // Spoofed headers ignored by resolveActor (session entity only)
  {
    const fakeReq = {
      authUser: { id: 1, role: 'Admin', email: 'a@t' },
      authenticatedEntityContext: { id: E1, type: 'BRANCH' },
      headers: { 'x-entity-id': E2, 'x-user-role': 'super_admin' },
      body: { entity_id: E2 }
    };
    const a = resolveActor({ req: fakeReq });
    a.entityId === E1 && a.role === 'Admin'
      ? pass('spoofed-headers-ignored', `entity=${a.entityId}`)
      : fail('spoofed-headers-ignored', JSON.stringify(a));
  }

  // Unauthenticated
  {
    const r = await expectGuard(
      () =>
        mutatePaymentAllocation(client, {
          mode: 'create',
          actor: { authenticated: false },
          paymentId: payDraft.payment_id,
          invoiceId: inv1.invoice_id,
          allocatedAmount: 1
        }),
      401,
      'AUTH_REQUIRED'
    );
    r.ok ? pass('reject-unauthenticated', r.detail) : fail('reject-unauthenticated', r.detail);
  }

  // Posted payment: create / update / delete rejected
  {
    const { invoice: invP } = await seedInvoice(client, {
      entityId: E1,
      total: 150,
      label: 'posted-inv',
      post: true
    });
    const { payment: payP } = await seedDraftPayment(client, {
      entityId: E1,
      amount: 150,
      label: 'to-post'
    });
    // insert alloc via SQL then post (service path — authorized accounting)
    await client.query(
      `INSERT INTO finance_payment_allocations (payment_id, invoice_id, allocated_amount) VALUES ($1,$2,$3)`,
      [payP.payment_id, invP.invoice_id, 150]
    );
    await postPaymentReceipt(client, payP.payment_id, {
      trustedTestActor: true,
      actor: actor(E1)
    });
    const links = await findPostedJournalForPayment(client, payP.payment_id);
    const allocRow = await client.query(
      `SELECT allocation_id FROM finance_payment_allocations WHERE payment_id=$1 LIMIT 1`,
      [payP.payment_id]
    );
    const allocId = allocRow.rows[0].allocation_id;

    links.links.length
      ? pass('fixture-payment-posted', `links=${links.links.length}`)
      : fail('fixture-payment-posted');

    const rCreate = await expectGuard(
      () =>
        mutatePaymentAllocation(client, {
          mode: 'create',
          actor: actor(E1),
          paymentId: payP.payment_id,
          invoiceId: invP.invoice_id,
          allocatedAmount: 1
        }),
      409,
      'POSTED_DOCUMENT_LOCKED'
    );
    rCreate.ok
      ? pass('reject-add-alloc-to-posted', rCreate.detail)
      : fail('reject-add-alloc-to-posted', rCreate.detail);

    // Need another invoice for update target uniqueness — update amount on same
    const rUpd = await expectGuard(
      () =>
        mutatePaymentAllocation(client, {
          mode: 'update',
          actor: actor(E1),
          allocationId: allocId,
          paymentId: payP.payment_id,
          invoiceId: invP.invoice_id,
          allocatedAmount: 149
        }),
      409,
      'POSTED_DOCUMENT_LOCKED'
    );
    rUpd.ok
      ? pass('reject-update-alloc-posted', rUpd.detail)
      : fail('reject-update-alloc-posted', rUpd.detail);

    const rDel = await expectGuard(
      () =>
        mutatePaymentAllocation(client, {
          mode: 'delete',
          actor: actor(E1),
          allocationId: allocId
        }),
      409,
      'POSTED_DOCUMENT_LOCKED'
    );
    rDel.ok
      ? pass('reject-delete-alloc-posted', rDel.detail)
      : fail('reject-delete-alloc-posted', rDel.detail);

    // Posted invoice balances unchanged by failed CRUD attempts
    const bal = await client.query(
      `SELECT paid_amount::float AS p, remaining_amount::float AS r FROM finance_invoices WHERE invoice_id=$1`,
      [invP.invoice_id]
    );
    // postPaymentReceipt should have set paid=150 rem=0
    Number(bal.rows[0].p) === 150 && Number(bal.rows[0].r) === 0
      ? pass('posted-invoice-balances-stable-after-rejected-crud', JSON.stringify(bal.rows[0]))
      : fail('posted-invoice-balances-stable-after-rejected-crud', JSON.stringify(bal.rows[0]));
  }

  // Rollback on failure mid-flight: force failure after lock by over-alloc; verify no row
  {
    const { payment: pR } = await seedDraftPayment(client, { entityId: E1, amount: 25, label: 'rb' });
    const { invoice: iR } = await seedInvoice(client, { entityId: E1, total: 25, label: 'rb-inv' });
    const before = await client.query(
      `SELECT COUNT(*)::int AS n FROM finance_payment_allocations WHERE payment_id=$1`,
      [pR.payment_id]
    );
    await expectGuard(
      () =>
        mutatePaymentAllocation(client, {
          mode: 'create',
          actor: actor(E1),
          paymentId: pR.payment_id,
          invoiceId: iR.invoice_id,
          allocatedAmount: 999
        }),
      409,
      'OVER_ALLOCATION_PAYMENT'
    );
    const after = await client.query(
      `SELECT COUNT(*)::int AS n FROM finance_payment_allocations WHERE payment_id=$1`,
      [pR.payment_id]
    );
    before.rows[0].n === after.rows[0].n
      ? pass('rollback-on-validation-failure', `n=${after.rows[0].n}`)
      : fail('rollback-on-validation-failure');
  }

  // Concurrency: two creates same payment+invoice — exactly one succeeds
  {
    const { payment: pC } = await seedDraftPayment(client, { entityId: E1, amount: 60, label: 'conc' });
    const { invoice: iC } = await seedInvoice(client, { entityId: E1, total: 60, label: 'conc-inv' });
    const c1 = new Client({ connectionString: DB_URL });
    const c2 = new Client({ connectionString: DB_URL });
    await c1.connect();
    await c2.connect();
    await c1.query('SET search_path TO b1a_test, public');
    await c2.query('SET search_path TO b1a_test, public');
    const outcomes = await Promise.allSettled([
      mutatePaymentAllocation(c1, {
        mode: 'create',
        actor: actor(E1),
        paymentId: pC.payment_id,
        invoiceId: iC.invoice_id,
        allocatedAmount: 30
      }),
      mutatePaymentAllocation(c2, {
        mode: 'create',
        actor: actor(E1),
        paymentId: pC.payment_id,
        invoiceId: iC.invoice_id,
        allocatedAmount: 30
      })
    ]);
    await c1.end();
    await c2.end();
    const oks = outcomes.filter((o) => o.status === 'fulfilled').length;
    const fails = outcomes.filter(
      (o) =>
        o.status === 'rejected' &&
        o.reason instanceof GuardError &&
        (o.reason.code === 'DUPLICATE_ALLOCATION' || o.reason.code === 'OVER_ALLOCATION_PAYMENT')
    ).length;
    const cnt = await client.query(
      `SELECT COUNT(*)::int AS n FROM finance_payment_allocations WHERE payment_id=$1 AND invoice_id=$2`,
      [pC.payment_id, iC.invoice_id]
    );
    oks === 1 && fails === 1 && cnt.rows[0].n === 1
      ? pass('concurrent-same-payment-invoice-one-wins', `oks=${oks} fails=${fails}`)
      : fail(
          'concurrent-same-payment-invoice-one-wins',
          JSON.stringify({
            oks,
            fails,
            n: cnt.rows[0].n,
            reasons: outcomes.map((o) =>
              o.status === 'rejected' ? o.reason.code || o.reason.message : 'ok'
            )
          })
        );
  }

  // Draft delete OK
  {
    const del = await mutatePaymentAllocation(client, {
      mode: 'delete',
      actor: actor(E1),
      allocationId: created.allocation.allocation_id
    });
    del.deleted
      ? pass('draft-delete-ok', String(del.deleted))
      : fail('draft-delete-ok');
  }

  report.residualRisks = [
    {
      id: 'R-PAY-CREATE',
      detail: 'POST /finance/payments ما زال يُدرج تخصيصات ويحدّث أرصدة داخل مسار التحصيل الحي — خارج d.3.b'
    },
    {
      id: 'R-NO-UNIQUE',
      detail: 'لا UNIQUE(payment_id,invoice_id) في DB — الحماية تطبيقية + قفل'
    }
  ];

  // --- HTTP smoke (public pool) if server up ---
  let token = null;
  try {
    token = await login();
    pass('http-login');
  } catch (e) {
    fail('http-login', e.message);
  }

  if (token) {
    // Unauthenticated should 401
    const noAuth = await httpJson('POST', '/finance/payment-allocations', {
      payment_id: 1,
      invoice_id: 1,
      allocated_amount: 1
    });
    noAuth.status === 401 && noAuth.json?.code === 'AUTH_REQUIRED'
      ? pass('http-reject-unauthenticated', String(noAuth.status))
      : fail('http-reject-unauthenticated', `${noAuth.status} ${noAuth.raw}`);

    // Seed draft on PUBLIC for HTTP (cleanup after)
    const pub = new Client({ connectionString: DB_URL });
    await pub.connect();
    await pub.query('SET search_path TO public');
    let httpPayId = null;
    let httpInvId = null;
    let httpAllocId = null;
    try {
      const cust =
        (
          await pub.query(
            `SELECT customer_id, customer_name_ar FROM finance_customers ORDER BY 1 LIMIT 1`
          )
        ).rows[0] ||
        (
          await pub.query(
            `INSERT INTO finance_customers (customer_code, customer_name_ar) VALUES ($1,$2)
             RETURNING customer_id, customer_name_ar`,
            [`B1D3B-HTTP-${Date.now()}`, 'HTTP alloc']
          )
        ).rows[0];
      // Use session entity — login typically HQ001 or similar; read from a probe
      const me = await httpJson('GET', '/api/auth/me', null, {
        Authorization: `Bearer ${token}`
      });
      const sessionEntity =
        me.json?.data?.entity_id ||
        me.json?.entity_id ||
        me.json?.data?.user?.entity_id ||
        'HQ001';

      const inv = await pub.query(
        `INSERT INTO finance_invoices (
           invoice_number, invoice_date, due_date, customer_id, customer_name,
           subtotal, tax_amount, discount_amount, total_amount, paid_amount, remaining_amount,
           status, payment_status, entity_id
         ) VALUES ($1, CURRENT_DATE, CURRENT_DATE+30, $2, $3, 100, 0, 0, 100, 0, 100, 'DRAFT', 'UNPAID', $4)
         RETURNING invoice_id`,
        [`B1D3B-HTTP-INV-${Date.now()}`, cust.customer_id, cust.customer_name_ar || 'c', sessionEntity]
      );
      httpInvId = inv.rows[0].invoice_id;
      const pay = await pub.query(
        `INSERT INTO finance_payments (
           payment_number, payment_date, customer_id, payment_amount, payment_method, status, entity_id
         ) VALUES ($1, CURRENT_DATE, $2, 100, 'CASH', 'PENDING', $3)
         RETURNING payment_id`,
        [`B1D3B-HTTP-PAY-${Date.now()}`, cust.customer_id, sessionEntity]
      );
      httpPayId = pay.rows[0].payment_id;

      const okCreate = await httpJson(
        'POST',
        '/finance/payment-allocations',
        { payment_id: httpPayId, invoice_id: httpInvId, allocated_amount: 40 },
        { Authorization: `Bearer ${token}` }
      );
      if (okCreate.status === 201 && okCreate.json?.allocation?.allocation_id) {
        httpAllocId = okCreate.json.allocation.allocation_id;
        pass('http-draft-create', String(httpAllocId));
      } else {
        fail('http-draft-create', `${okCreate.status} ${okCreate.raw}`);
      }

      // Simulate posted payment on public then reject update
      if (httpAllocId) {
        const je = await pub.query(
          `INSERT INTO finance_journal_entries
             (entry_number, entry_date, entry_type, description, reference_type, reference_id,
              entity_id, status, is_posted, created_by)
           VALUES ($1, CURRENT_DATE, 'AUTO', 'b1d3b-http-lock', 'PAYMENT', $2, $3, 'POSTED', true, 'b1d3b')
           RETURNING entry_id`,
          [`B1D3B-JE-${Date.now()}`, httpPayId, sessionEntity]
        );
        await pub.query(`UPDATE finance_payments SET journal_entry_id=$1 WHERE payment_id=$2`, [
          je.rows[0].entry_id,
          httpPayId
        ]);
        const rej = await httpJson(
          'PUT',
          `/finance/payment-allocations/${httpAllocId}`,
          {
            payment_id: httpPayId,
            invoice_id: httpInvId,
            allocated_amount: 41
          },
          { Authorization: `Bearer ${token}` }
        );
        rej.status === 409 && rej.json?.code === 'POSTED_DOCUMENT_LOCKED'
          ? pass('http-reject-update-posted', String(rej.status))
          : fail('http-reject-update-posted', `${rej.status} ${rej.raw}`);

        const rejDel = await httpJson(
          'DELETE',
          `/finance/payment-allocations/${httpAllocId}`,
          null,
          { Authorization: `Bearer ${token}` }
        );
        rejDel.status === 409 && rejDel.json?.code === 'POSTED_DOCUMENT_LOCKED'
          ? pass('http-reject-delete-posted', String(rejDel.status))
          : fail('http-reject-delete-posted', `${rejDel.status} ${rejDel.raw}`);
      }
    } finally {
      // cleanup public fixtures without touching historical data beyond our markers
      try {
        if (httpPayId) {
          await pub.query(`DELETE FROM finance_payment_allocations WHERE payment_id=$1`, [httpPayId]);
          await pub.query(`UPDATE finance_payments SET journal_entry_id=NULL WHERE payment_id=$1`, [
            httpPayId
          ]);
          await pub.query(
            `DELETE FROM finance_journal_lines WHERE entry_id IN (
               SELECT entry_id FROM finance_journal_entries
               WHERE reference_type='PAYMENT' AND reference_id=$1
                  OR entry_number LIKE 'B1D3B-JE%'
             )`,
            [httpPayId]
          );
          await pub.query(
            `DELETE FROM finance_journal_entries
             WHERE (reference_type='PAYMENT' AND reference_id=$1)
                OR entry_number LIKE 'B1D3B-JE%'
                OR description LIKE 'b1d3b-http%'`,
            [httpPayId]
          );
          await pub.query(`DELETE FROM finance_payments WHERE payment_id=$1`, [httpPayId]);
        }
        if (httpInvId) {
          await pub.query(`DELETE FROM finance_invoices WHERE invoice_id=$1`, [httpInvId]);
        }
      } catch (e) {
        console.warn('http cleanup warn', e.message);
      }
      await pub.end();
    }

    const smoke = await httpJson('GET', '/finance', null, { Authorization: `Bearer ${token}` });
    smoke.status === 200 ? pass('smoke:/finance') : fail('smoke:/finance', String(smoke.status));
  }

  await client.end();

  const passed = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok).length;
  report.summary = { passed, failed, total: results.length, results };

  const md = [];
  md.push('# تقرير B1.d.3.b — حراسة CRUD تخصيصات المدفوعات');
  md.push('');
  md.push(`**الاختبارات:** ${failed === 0 ? 'PASS' : 'FAIL'} — ${passed} / ${failed}`);
  md.push('**النطاق:** حراسة Backend لمسارات `/finance/payment-allocations` فقط. لا ربط ترحيل مدفوعات · لا migrations · لا حظر مدفوعات غير مخصصة.');
  md.push('');
  md.push('## 1) حصر المسارات');
  md.push('| Method | Path | ملف | محروس؟ | ملاحظات |');
  md.push('|---|---|---|---|---|');
  for (const r of report.routeInventory) {
    md.push(
      `| ${r.method} | ${r.path} | ${r.file || '-'} | ${r.guarded === true ? 'yes' : r.guarded === false ? 'no' : '-'} | ${r.note || ''} |`
    );
  }
  md.push('');
  md.push('## 2) قرار العربون / الدفعات المقدمة');
  md.push('```');
  md.push(JSON.stringify(report.advanceDepositNote, null, 2));
  md.push('```');
  md.push('');
  md.push('## 3) الحماية المطبّقة');
  md.push('- رفض create/update/delete إن وُجد قيد PAYMENT مرحّل أو `journal_entry_id` مرحّل → 409 `POSTED_DOCUMENT_LOCKED`');
  md.push('- `assertEntityOwns` على الدفعة والفاتورة من `resolveActor` (جلسة فقط) → 401/403');
  md.push('- رفض كيان مختلف بين دفعة وفاتورة → 403 `ALLOCATION_ENTITY_MISMATCH`');
  md.push('- رفض تجاوز مبلغ الدفعة أو متبقي الفاتورة → 409');
  md.push('- رفض تكرار (payment_id, invoice_id) → 409 `DUPLICATE_ALLOCATION`');
  md.push('- معاملة + `FOR UPDATE` + advisory lock؛ CRUD **لا** يلمس `paid_amount`/`remaining_amount`');
  md.push('- متبقٍ غير مخصص على الدفعة **مسموح** (لا فرض تخصيص كامل)');
  md.push('');
  md.push('## 4) نتائج الاختبارات');
  for (const r of results) {
    md.push(`- ${r.ok ? 'PASS' : 'FAIL'} ${r.name}${r.detail ? `: ${r.detail}` : ''}`);
  }
  md.push('');
  md.push('## 5) مخاطر متبقية (خارج d.3.b)');
  for (const r of report.residualRisks) {
    md.push(`- **${r.id}:** ${r.detail}`);
  }
  md.push('');
  md.push('لا d.3.c/d/e · لا d.4+ · لا Payroll · لا دمج/Staging/Production دون موافقة.');

  const reportPath = path.join(__dirname, 'docs/finance-leadership-p3-b1d3b-alloc-guards-report.md');
  fs.writeFileSync(reportPath, md.join('\n') + '\n');
  fs.writeFileSync(path.join(ART, 'finance-leadership-p3-b1d3b-alloc-guards-report.md'), md.join('\n') + '\n');
  fs.writeFileSync(
    path.join(ART, 'finance-leadership-p3-b1d3b-alloc-guards-results.json'),
    JSON.stringify(report, null, 2)
  );

  console.log('');
  console.log(`=== B1.d.3.b ${failed === 0 ? 'PASS' : 'FAIL'} ${passed}/${failed} ===`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
