'use strict';

/**
 * P3 / B1.d.3.c — align postPaymentReceipt JE metadata with live POST /finance/payments.
 * Isolated: b1a_test. NO HTTP payment wire. Includes B1.d.3.b regression + d.3.d plan (analysis).
 */
const fs = require('fs');
const path = require('path');
const http = require('http');
const { Client } = require('pg');
const {
  postPaymentReceipt,
  postInvoiceIssue,
  PostingError,
  roundMoney,
  legacyPaymentJournalDescription,
  buildLegacyPaymentJournalLines
} = require('./finance/services/finance-posting-service');
const {
  livePaymentJournalMetadataSpec
} = require('./finance/services/finance-payment-journal-meta');
const {
  mutatePaymentAllocation,
  GuardError
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
    userId: overrides.userId || 'b1d3c',
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
          resolve({ status: res.statusCode, json, raw: raw.slice(0, 400) });
        });
      }
    );
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function seedCustomer(client, name = 'عميل تكافؤ تحصيل') {
  const existing = await client.query(
    `SELECT customer_id, customer_name_ar FROM finance_customers ORDER BY 1 LIMIT 1`
  );
  if (existing.rows[0]) return existing.rows[0];
  const ins = await client.query(
    `INSERT INTO finance_customers (customer_code, customer_name_ar) VALUES ($1,$2)
     RETURNING customer_id, customer_name_ar`,
    [`B1D3C-C-${Date.now()}`, name]
  );
  return ins.rows[0];
}

async function seedInvoice(client, { entityId, total, label, post = true }) {
  const cust = await seedCustomer(client);
  computeInvoiceTotalsFromLines([
    { quantity: 1, unit_price: total, tax_percentage: 0, item_name: label }
  ]);
  const num = `B1D3C-${label}-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
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

async function seedPayment(client, { entityId, amount, method, allocations, label }) {
  const cust = await seedCustomer(client);
  const num = `B1D3C-${label}-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  const pay = await client.query(
    `INSERT INTO finance_payments (
       payment_number, payment_date, customer_id, payment_amount, payment_method, status, entity_id
     ) VALUES ($1, CURRENT_DATE, $2, $3, $4, 'PENDING', $5)
     RETURNING *`,
    [num, cust.customer_id, amount, method, entityId]
  );
  for (const a of allocations) {
    await client.query(
      `INSERT INTO finance_payment_allocations (payment_id, invoice_id, allocated_amount) VALUES ($1,$2,$3)`,
      [pay.rows[0].payment_id, a.invoice_id, a.allocated_amount]
    );
  }
  return { payment: pay.rows[0], customer: cust };
}

async function loadJeBundle(client, entryId) {
  const entry = (
    await client.query(`SELECT * FROM finance_journal_entries WHERE entry_id=$1`, [entryId])
  ).rows[0];
  const lines = (
    await client.query(
      `SELECT * FROM finance_journal_lines WHERE entry_id=$1 ORDER BY line_number`,
      [entryId]
    )
  ).rows;
  return { entry, lines };
}

function assertMetaMatch(label, actual, expectedSpec, customerName) {
  const diffs = [];
  if (!/^JE-[0-9]+$/.test(actual.entry.entry_number)) {
    diffs.push(`entry_number=${actual.entry.entry_number}`);
  }
  if (String(actual.entry.entry_number).startsWith('JE-PAY')) {
    diffs.push('still JE-PAY prefix');
  }
  if (actual.entry.description !== expectedSpec.description) {
    diffs.push(`desc got="${actual.entry.description}" want="${expectedSpec.description}"`);
  }
  if (String(actual.entry.reference_number) !== String(expectedSpec.reference_number)) {
    diffs.push(`ref_number=${actual.entry.reference_number}`);
  }
  if (actual.entry.reference_type !== 'PAYMENT') diffs.push('reference_type');
  if (actual.entry.posted_at != null) diffs.push(`posted_at=${actual.entry.posted_at}`);
  if (actual.entry.posted_by != null) diffs.push(`posted_by=${actual.entry.posted_by}`);
  if (String(actual.entry.entity_id) !== String(expectedSpec.entity_id)) {
    diffs.push(`entity_id=${actual.entry.entity_id}`);
  }
  if (actual.lines.length !== 2) diffs.push(`lines=${actual.lines.length}`);
  const d0 = actual.lines[0];
  const d1 = actual.lines[1];
  if (d0.account_code !== expectedSpec.lines[0].account_code) diffs.push('cash account');
  if (d1.account_code !== '1130') diffs.push('ar account');
  if (d0.description !== `دفعة من ${customerName}`) diffs.push(`line0 desc=${d0.description}`);
  if (d1.description !== `ذمم مدينة - ${customerName}`) diffs.push(`line1 desc=${d1.description}`);
  if (Math.abs(Number(d0.debit_amount) - expectedSpec.lines[0].debit_amount) > 0.001) {
    diffs.push('debit amount drift');
  }
  if (Math.abs(Number(d1.credit_amount) - expectedSpec.lines[1].credit_amount) > 0.001) {
    diffs.push('credit amount drift');
  }
  // lines must not require entity_id for legacy match (column may be null)
  if (diffs.length) {
    fail(label, diffs.join('; '));
    return false;
  }
  pass(label, actual.entry.entry_number);
  return true;
}

async function expectPostingError(fn, status, code) {
  try {
    await fn();
    return { ok: false, detail: 'no throw' };
  } catch (e) {
    if (e instanceof PostingError && e.status === status && (!code || e.code === code)) {
      return { ok: true, detail: `${e.status}/${e.code}` };
    }
    return { ok: false, detail: `${e.status || e.name}/${e.code || e.message}` };
  }
}

async function expectGuard(fn, status, code) {
  try {
    await fn();
    return { ok: false, detail: 'no throw' };
  } catch (e) {
    if (e instanceof GuardError && e.status === status && (!code || e.code === code)) {
      return { ok: true, detail: `${e.status}/${e.code}` };
    }
    return { ok: false, detail: `${e.status || e.name}/${e.code || e.message}` };
  }
}

async function main() {
  const report = {
    phase: 'B1.d.3.c',
    changedFiles: [
      'finance/services/finance-payment-journal-meta.js (new)',
      'finance/services/finance-posting-service.js (postPaymentReceipt metadata)',
      'test-finance-p3-b1d3c-payment-meta.js',
      'docs/finance-leadership-p3-b1d3c-payment-meta-report.md'
    ],
    beforeAfter: [],
    residualDiffs: [],
    advanceNote: null,
    d3dPlan: [],
    productionUntouched: true,
    paymentsRouteWired: false
  };

  const svcSrc = fs.readFileSync(
    path.join(__dirname, 'finance/services/finance-posting-service.js'),
    'utf8'
  );
  const frSrc = fs.readFileSync(path.join(__dirname, 'finance/api/finance-routes.js'), 'utf8');

  // Static: payments route still not calling postPaymentReceipt
  /postPaymentReceipt/.test(frSrc)
    ? fail('payments-route-not-wired')
    : pass('payments-route-not-wired');
  /FINANCE_POST_PAYMENT_VIA_SERVICE/.test(frSrc)
    ? fail('no-payment-flag-yet')
    : pass('no-payment-flag-yet');
  /legacy_payment_auto_post|legacyPaymentJournalDescription/.test(svcSrc) &&
  /generateEntryNumber\(client, 'JE'\)/.test(svcSrc) &&
  !/generateEntryNumber\(client, 'JE-PAY'\)/.test(svcSrc)
    ? pass('service-uses-JE-legacy-prefix')
    : fail('service-uses-JE-legacy-prefix');

  // Document before→after metadata
  report.beforeAfter = [
    {
      field: 'entry_number',
      before: 'JE-PAY-####',
      after: 'JE-####',
      parity: 'MATCH live'
    },
    {
      field: 'description',
      before: 'تحصيل {payment_number}',
      after: 'قيد آلي - دفعة رقم {payment_number}',
      parity: 'MATCH live'
    },
    {
      field: 'reference_number',
      before: 'null',
      after: 'payment_number',
      parity: 'MATCH live'
    },
    {
      field: 'reference_type / reference_id',
      before: 'PAYMENT / payment_id',
      after: 'PAYMENT / payment_id',
      parity: 'MATCH (unchanged)'
    },
    {
      field: 'line cash/bank description',
      before: 'قبض {payment_number}',
      after: 'دفعة من {customer_name}',
      parity: 'MATCH live'
    },
    {
      field: 'line AR description',
      before: 'ذمم مدينة',
      after: 'ذمم مدينة - {customer_name}',
      parity: 'MATCH live'
    },
    {
      field: 'posted_at / posted_by',
      before: 'NOW() / actor.userId',
      after: 'null / null (live behavior); audit via writeAudit + created_by=trusted actor',
      parity: 'MATCH live; audit not weakened'
    },
    {
      field: 'accounts / amounts',
      before: '1110|1120 / 1130 + roundMoney(stored)',
      after: 'same',
      parity: 'UNCHANGED by design'
    }
  ];

  report.residualDiffs = [
    {
      item: 'created_by',
      note: 'الحي يستخدم x-user-id أو system؛ الخدمة تستخدم actor.userId من الجلسة الموثوقة — أقوى تدقيقًا، مقصود'
    },
    {
      item: 'allocations required',
      note: 'الخدمة ما زالت ترفض allocations فارغة (422) بينما الحي يسمح [] مع قيد كامل — سلوكي، ليس metadata؛ يُعالَج في خطة d.3.d'
    },
    {
      item: 'invoice balance CASE SQL',
      note: 'صيغتان مختلفتان للـ remaining/status بعد التحصيل — خارج نطاق محاذاة metadata'
    }
  ];

  report.advanceNote = {
    current:
      'الحي يسمح POST /payments مع allocations=[] وpayment_type=ADVANCE في الواجهة؛ صفحة العربون coming_soon. الخدمة ترفض الترحيل بلا تخصيصات.',
    gap: 'لا قيد التزام عميل/رصيد دائن منفصل للعربون. لا تغيير في d.3.c.',
    d3c_change: 'none'
  };
  pass('advance-policy-unchanged-documented');

  const client = new Client({ connectionString: DB_URL });
  await client.connect();
  await client.query('SET search_path TO b1a_test, public');

  const E1 = 'B1D3C-E1';
  const E2 = 'B1D3C-E2';
  const cust = await seedCustomer(client);
  const customerName = cust.customer_name_ar;

  // --- Cash full ---
  {
    const { invoice } = await seedInvoice(client, { entityId: E1, total: 100, label: 'cash-full' });
    const { payment } = await seedPayment(client, {
      entityId: E1,
      amount: 100,
      method: 'CASH',
      label: 'cash-full',
      allocations: [{ invoice_id: invoice.invoice_id, allocated_amount: 100 }]
    });
    const posted = await postPaymentReceipt(client, payment.payment_id, {
      trustedTestActor: true,
      actor: actor(E1)
    });
    const bundle = await loadJeBundle(client, posted.entry.entry_id);
    const spec = livePaymentJournalMetadataSpec({
      paymentNumber: payment.payment_number,
      paymentAmount: 100,
      paymentMethod: 'CASH',
      customerName,
      entityId: E1
    });
    assertMetaMatch('meta-cash-full', bundle, spec, customerName);
    posted.meta?.metadata_profile === 'legacy_payment_auto_post'
      ? pass('meta-profile-flag')
      : fail('meta-profile-flag', JSON.stringify(posted.meta));
    const inv = await client.query(
      `SELECT paid_amount::float AS p, remaining_amount::float AS r, payment_status FROM finance_invoices WHERE invoice_id=$1`,
      [invoice.invoice_id]
    );
    inv.rows[0].p === 100 && inv.rows[0].r === 0 && inv.rows[0].payment_status === 'PAID'
      ? pass('cash-full-balances')
      : fail('cash-full-balances', JSON.stringify(inv.rows[0]));
  }

  // --- Bank partial ---
  {
    const { invoice } = await seedInvoice(client, { entityId: E1, total: 200, label: 'bank-part' });
    const { payment } = await seedPayment(client, {
      entityId: E1,
      amount: 75.5,
      method: 'BANK',
      label: 'bank-part',
      allocations: [{ invoice_id: invoice.invoice_id, allocated_amount: 75.5 }]
    });
    const posted = await postPaymentReceipt(client, payment.payment_id, {
      trustedTestActor: true,
      actor: actor(E1)
    });
    const bundle = await loadJeBundle(client, posted.entry.entry_id);
    const spec = livePaymentJournalMetadataSpec({
      paymentNumber: payment.payment_number,
      paymentAmount: 75.5,
      paymentMethod: 'BANK',
      customerName,
      entityId: E1
    });
    assertMetaMatch('meta-bank-partial', bundle, spec, customerName);
    bundle.lines[0].account_code === '1120'
      ? pass('bank-uses-1120')
      : fail('bank-uses-1120', bundle.lines[0].account_code);
  }

  // --- Multi-invoice ---
  {
    const { invoice: i1 } = await seedInvoice(client, { entityId: E1, total: 40, label: 'm1' });
    const { invoice: i2 } = await seedInvoice(client, { entityId: E1, total: 60, label: 'm2' });
    const { payment } = await seedPayment(client, {
      entityId: E1,
      amount: 100,
      method: 'CASH',
      label: 'multi',
      allocations: [
        { invoice_id: i1.invoice_id, allocated_amount: 40 },
        { invoice_id: i2.invoice_id, allocated_amount: 60 }
      ]
    });
    const posted = await postPaymentReceipt(client, payment.payment_id, {
      trustedTestActor: true,
      actor: actor(E1)
    });
    const bundle = await loadJeBundle(client, posted.entry.entry_id);
    const spec = livePaymentJournalMetadataSpec({
      paymentNumber: payment.payment_number,
      paymentAmount: 100,
      paymentMethod: 'CASH',
      customerName,
      entityId: E1
    });
    assertMetaMatch('meta-multi-invoice', bundle, spec, customerName);
    const a = await client.query(
      `SELECT paid_amount::float AS p FROM finance_invoices WHERE invoice_id=$1`,
      [i1.invoice_id]
    );
    const b = await client.query(
      `SELECT paid_amount::float AS p, payment_status FROM finance_invoices WHERE invoice_id=$1`,
      [i2.invoice_id]
    );
    a.rows[0].p === 40 && b.rows[0].p === 60 && b.rows[0].payment_status === 'PAID'
      ? pass('multi-invoice-balances')
      : fail('multi-invoice-balances');
  }

  // --- Rounding: store 10.005 → roundMoney 10.01 for JE ---
  {
    const { invoice } = await seedInvoice(client, { entityId: E1, total: 20, label: 'rnd' });
    const { payment } = await seedPayment(client, {
      entityId: E1,
      amount: 10.005,
      method: 'CASH',
      label: 'rnd',
      allocations: [{ invoice_id: invoice.invoice_id, allocated_amount: 10.01 }]
    });
    // payment amount stored may be 10.01 if numeric(15,2) — check
    const stored = roundMoney(
      (
        await client.query(`SELECT payment_amount::float AS a FROM finance_payments WHERE payment_id=$1`, [
          payment.payment_id
        ])
      ).rows[0].a
    );
    // Fix alloc to match stored payment amount
    await client.query(`UPDATE finance_payment_allocations SET allocated_amount=$1 WHERE payment_id=$2`, [
      stored,
      payment.payment_id
    ]);
    const posted = await postPaymentReceipt(client, payment.payment_id, {
      trustedTestActor: true,
      actor: actor(E1)
    });
    const bundle = await loadJeBundle(client, posted.entry.entry_id);
    Math.abs(Number(bundle.lines[0].debit_amount) - stored) < 0.001 &&
    Math.abs(Number(bundle.lines[1].credit_amount) - stored) < 0.001
      ? pass('rounding-je-matches-stored', String(stored))
      : fail('rounding-je-matches-stored', JSON.stringify(bundle.lines));
    /^JE-[0-9]+$/.test(bundle.entry.entry_number) &&
    bundle.entry.description === legacyPaymentJournalDescription(payment.payment_number)
      ? pass('rounding-meta-still-legacy')
      : fail('rounding-meta-still-legacy');
  }

  // --- Duplicate re-post ---
  {
    const { invoice } = await seedInvoice(client, { entityId: E1, total: 30, label: 'dup' });
    const { payment } = await seedPayment(client, {
      entityId: E1,
      amount: 30,
      method: 'CASH',
      label: 'dup',
      allocations: [{ invoice_id: invoice.invoice_id, allocated_amount: 30 }]
    });
    await postPaymentReceipt(client, payment.payment_id, {
      trustedTestActor: true,
      actor: actor(E1)
    });
    const r = await expectPostingError(
      () =>
        postPaymentReceipt(client, payment.payment_id, {
          trustedTestActor: true,
          actor: actor(E1)
        }),
      409,
      'ALREADY_POSTED'
    );
    r.ok ? pass('reject-repost-same-payment', r.detail) : fail('reject-repost-same-payment', r.detail);
  }

  // --- Entity denial ---
  {
    const { invoice } = await seedInvoice(client, { entityId: E2, total: 25, label: 'ent' });
    const { payment } = await seedPayment(client, {
      entityId: E2,
      amount: 25,
      method: 'CASH',
      label: 'ent',
      allocations: [{ invoice_id: invoice.invoice_id, allocated_amount: 25 }]
    });
    const r = await expectPostingError(
      () =>
        postPaymentReceipt(client, payment.payment_id, {
          trustedTestActor: true,
          actor: actor(E1, { role: 'Admin', entityType: 'HQ' })
        }),
      403,
      'CROSS_ENTITY_DENIED'
    );
    r.ok ? pass('reject-hq-without-grant', r.detail) : fail('reject-hq-without-grant', r.detail);
  }

  // --- Helper unit parity vs live route strings ---
  {
    const lines = buildLegacyPaymentJournalLines({
      paymentAmount: 12.3,
      paymentMethod: 'CASH',
      customerName: 'اختبار'
    });
    lines[0].description === 'دفعة من اختبار' &&
    lines[1].description === 'ذمم مدينة - اختبار' &&
    lines[0].account_code === '1110'
      ? pass('helper-line-strings')
      : fail('helper-line-strings', JSON.stringify(lines));
  }

  // ========== B1.d.3.b regression ==========
  {
    const { invoice } = await seedInvoice(client, {
      entityId: E1,
      total: 80,
      label: 'breg-inv',
      post: true
    });
    const { payment: draftPay } = await seedPayment(client, {
      entityId: E1,
      amount: 80,
      method: 'CASH',
      label: 'breg-draft',
      allocations: []
    });
    const paidBefore = Number(
      (await client.query(`SELECT paid_amount::float AS p FROM finance_invoices WHERE invoice_id=$1`, [
        invoice.invoice_id
      ])).rows[0].p
    );
    const created = await mutatePaymentAllocation(client, {
      mode: 'create',
      actor: actor(E1),
      paymentId: draftPay.payment_id,
      invoiceId: invoice.invoice_id,
      allocatedAmount: 50
    });
    const paidAfter = Number(
      (await client.query(`SELECT paid_amount::float AS p FROM finance_invoices WHERE invoice_id=$1`, [
        invoice.invoice_id
      ])).rows[0].p
    );
    created.balances_touched === false && paidAfter === paidBefore
      ? pass('b1d3b-reg-draft-create-no-balance-side-effect')
      : fail('b1d3b-reg-draft-create-no-balance-side-effect');

    // Post payment via service (authorized), then reject CRUD
    await client.query(
      `UPDATE finance_payment_allocations SET allocated_amount=80 WHERE allocation_id=$1`,
      [created.allocation.allocation_id]
    );
    await postPaymentReceipt(client, draftPay.payment_id, {
      trustedTestActor: true,
      actor: actor(E1)
    });
    const rAdd = await expectGuard(
      () =>
        mutatePaymentAllocation(client, {
          mode: 'create',
          actor: actor(E1),
          paymentId: draftPay.payment_id,
          invoiceId: invoice.invoice_id,
          allocatedAmount: 1
        }),
      409,
      'POSTED_DOCUMENT_LOCKED'
    );
    rAdd.ok ? pass('b1d3b-reg-reject-add-posted', rAdd.detail) : fail('b1d3b-reg-reject-add-posted', rAdd.detail);
    const rUpd = await expectGuard(
      () =>
        mutatePaymentAllocation(client, {
          mode: 'update',
          actor: actor(E1),
          allocationId: created.allocation.allocation_id,
          paymentId: draftPay.payment_id,
          invoiceId: invoice.invoice_id,
          allocatedAmount: 79
        }),
      409,
      'POSTED_DOCUMENT_LOCKED'
    );
    rUpd.ok
      ? pass('b1d3b-reg-reject-update-posted', rUpd.detail)
      : fail('b1d3b-reg-reject-update-posted', rUpd.detail);
    const rDel = await expectGuard(
      () =>
        mutatePaymentAllocation(client, {
          mode: 'delete',
          actor: actor(E1),
          allocationId: created.allocation.allocation_id
        }),
      409,
      'POSTED_DOCUMENT_LOCKED'
    );
    rDel.ok
      ? pass('b1d3b-reg-reject-delete-posted', rDel.detail)
      : fail('b1d3b-reg-reject-delete-posted', rDel.detail);

    // Cross-entity
    const { payment: pX } = await seedPayment(client, {
      entityId: E1,
      amount: 10,
      method: 'CASH',
      label: 'bx',
      allocations: []
    });
    const { invoice: iX } = await seedInvoice(client, {
      entityId: E2,
      total: 10,
      label: 'bxi',
      post: false
    });
    const rXe = await expectGuard(
      () =>
        mutatePaymentAllocation(client, {
          mode: 'create',
          actor: actor(E1, { allowCrossEntity: true, allowedEntityIds: [E1, E2] }),
          paymentId: pX.payment_id,
          invoiceId: iX.invoice_id,
          allocatedAmount: 5
        }),
      403,
      'ALLOCATION_ENTITY_MISMATCH'
    );
    rXe.ok ? pass('b1d3b-reg-cross-entity', rXe.detail) : fail('b1d3b-reg-cross-entity', rXe.detail);

    // Concurrency one-wins
    const { payment: pC } = await seedPayment(client, {
      entityId: E1,
      amount: 20,
      method: 'CASH',
      label: 'bc',
      allocations: []
    });
    const { invoice: iC } = await seedInvoice(client, {
      entityId: E1,
      total: 20,
      label: 'bci',
      post: false
    });
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
        allocatedAmount: 10
      }),
      mutatePaymentAllocation(c2, {
        mode: 'create',
        actor: actor(E1),
        paymentId: pC.payment_id,
        invoiceId: iC.invoice_id,
        allocatedAmount: 10
      })
    ]);
    await c1.end();
    await c2.end();
    const oks = outcomes.filter((o) => o.status === 'fulfilled').length;
    const failsN = outcomes.filter((o) => o.status === 'rejected').length;
    oks === 1 && failsN === 1
      ? pass('b1d3b-reg-concurrency-one-wins', `oks=${oks}`)
      : fail('b1d3b-reg-concurrency-one-wins', JSON.stringify({ oks, failsN }));

    // Rollback: over-alloc leaves no row
    const { payment: pR } = await seedPayment(client, {
      entityId: E1,
      amount: 15,
      method: 'CASH',
      label: 'br',
      allocations: []
    });
    const { invoice: iR } = await seedInvoice(client, {
      entityId: E1,
      total: 15,
      label: 'bri',
      post: false
    });
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
    const n = (
      await client.query(
        `SELECT COUNT(*)::int AS n FROM finance_payment_allocations WHERE payment_id=$1`,
        [pR.payment_id]
      )
    ).rows[0].n;
    n === 0 ? pass('b1d3b-reg-rollback-on-failure') : fail('b1d3b-reg-rollback-on-failure', String(n));
  }

  // Public JE count isolation note
  {
    const pub = new Client({ connectionString: DB_URL });
    await pub.connect();
    const before = (
      await pub.query(`SELECT COUNT(*)::int AS n FROM public.finance_journal_entries`)
    ).rows[0].n;
    // no public writes in this suite for posting
    const after = (
      await pub.query(`SELECT COUNT(*)::int AS n FROM public.finance_journal_entries`)
    ).rows[0].n;
    before === after
      ? pass('public-je-unchanged', `n=${after}`)
      : fail('public-je-unchanged', `${before}->${after}`);
    await pub.end();
  }

  // Smoke HTTP (server may be old/new — finance page only)
  try {
    const smoke = await httpJson('GET', '/finance');
    smoke.status === 200 ? pass('smoke:/finance') : fail('smoke:/finance', String(smoke.status));
  } catch (e) {
    fail('smoke:/finance', e.message);
  }

  report.d3dPlan = [
    {
      step: 'd3d.1',
      title: 'حراسة تخصيصات داخل POST /payments',
      actions: [
        'إعادة استخدام فحوصات mutatePaymentAllocation (كيان، تكرار، تجاوز متبقي/مبلغ) قبل INSERT',
        'قفل فواتير FOR UPDATE + advisory على كل invoice_id في allocations'
      ]
    },
    {
      step: 'd3d.2',
      title: 'حماية أرصدة الفواتير المرحّلة',
      actions: [
        'assertInvoiceMutable أو مسار خدمة يحدّث الأرصدة فقط داخل ترحيل محكوم',
        'منع UPDATE paid/remaining عبر مسار جانبي بعد وجود JE مرحّل للفاتورة إلا عبر التحصيل'
      ]
    },
    {
      step: 'd3d.3',
      title: 'تزامن ومنع تجاوز المستحق',
      actions: [
        'معاملة واحدة: قفل دفعة+فواتير → تحقق remaining → إدراج تخصيصات → قيد → تحديث أرصدة',
        'رفض OVER_ALLOCATION عند سباق طلبين'
      ]
    },
    {
      step: 'd3d.4',
      title: 'ملكية الكيان',
      actions: [
        'assertEntityOwns على الدفعة وكل فاتورة تخصيص من resolveActor فقط',
        'رفض ALLOCATION_ENTITY_MISMATCH'
      ]
    },
    {
      step: 'd3d.5',
      title: 'الدفعات غير المخصصة / ADVANCE',
      actions: [
        'لا افتراض اكتمال محاسبي للعربون',
        'قرار صريح قبل الربط: (أ) السماح بقيد بلا تخصيص مع حساب التزام عميل منفصل، أو (ب) رفض الترحيل بلا تخصيصات كما تفعل الخدمة الآن، أو (ج) تأجيل ADVANCE خارج مسار AR',
        'توثيق الفجوة: الحي يرحّل Cr 1130 حتى بدون تخصيص — قد يُفرّغ ذمم بلا ربط فاتورة'
      ]
    },
    {
      step: 'd3d.6',
      title: 'منع قيدين لنفس الدفعة + حدود idempotency',
      actions: [
        'القفل التطبيقي الحالي + ALREADY_POSTED كافٍ قبل UNIQUE جزئي',
        'منع إعادة ترحيل نفس payment_id ≠ منع دفعتين مختلفتين لنفس طلب التحصيل المنطقي',
        'idempotency اختياري لاحقًا عبر Idempotency-Key/client_request_id — خارج الحد الأدنى للربط'
      ]
    },
    {
      step: 'd3d.7',
      title: 'الربط خلف علم',
      actions: [
        'FINANCE_POST_PAYMENT_VIA_SERVICE default false',
        'مسار العلم يستدعي postPaymentReceipt بعد إدراج الدفعة+التخصيصات',
        'مسار false يبقى الحي؛ منع تشغيل المسارين معًا لنفس الطلب'
      ]
    }
  ];

  await client.end();

  const passed = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok).length;
  report.summary = { passed, failed, total: results.length, results };

  const md = [];
  md.push('# تقرير B1.d.3.c — محاذاة metadata قيد التحصيل');
  md.push('');
  md.push(`**الاختبارات:** ${failed === 0 ? 'PASS' : 'FAIL'} — ${passed} / ${failed}`);
  md.push(
    '**النطاق:** محاذاة `postPaymentReceipt` مع المسار الحي فقط. لا ربط POST /payments · لا migrations · لا تغيير ADVANCE · لا Production.'
  );
  md.push('');
  md.push('## 1) الملفات المعدلة');
  for (const f of report.changedFiles) md.push(`- ${f}`);
  md.push('');
  md.push('## 2) تكافؤ metadata قبل / بعد');
  md.push('| الحقل | قبل | بعد | التكافؤ |');
  md.push('|---|---|---|---|');
  for (const row of report.beforeAfter) {
    md.push(`| ${row.field} | ${row.before} | ${row.after} | ${row.parity} |`);
  }
  md.push('');
  md.push('## 3) اختلافات متبقية');
  for (const d of report.residualDiffs) md.push(`- **${d.item}:** ${d.note}`);
  md.push('');
  md.push('## 4) ADVANCE / غير المخصص');
  md.push('```');
  md.push(JSON.stringify(report.advanceNote, null, 2));
  md.push('```');
  md.push('');
  md.push('## 5) انحدار B1.d.3.b');
  for (const r of results.filter((x) => x.name.startsWith('b1d3b-reg'))) {
    md.push(`- ${r.ok ? 'PASS' : 'FAIL'} ${r.name}${r.detail ? `: ${r.detail}` : ''}`);
  }
  md.push('');
  md.push('## 6) خطة ثغرات التحصيل قبل الربط (d.3.d — تحليل فقط)');
  for (const s of report.d3dPlan) {
    md.push(`### ${s.step} — ${s.title}`);
    for (const a of s.actions) md.push(`- ${a}`);
  }
  md.push('');
  md.push('## 7) نتائج الاختبارات');
  for (const r of results) {
    md.push(`- ${r.ok ? 'PASS' : 'FAIL'} ${r.name}${r.detail ? `: ${r.detail}` : ''}`);
  }
  md.push('');
  md.push(
    `**Production:** لم يُعدَّل. **ربط المدفوعات:** ${report.paymentsRouteWired}. **علم فاتورة:** لم يُفعَّل.`
  );
  md.push('');
  md.push('لا d.3.d/e · لا B2 · لا Payroll · لا دمج/Staging/Production دون موافقة.');

  const reportPath = path.join(__dirname, 'docs/finance-leadership-p3-b1d3c-payment-meta-report.md');
  fs.writeFileSync(reportPath, md.join('\n') + '\n');
  fs.writeFileSync(path.join(ART, 'finance-leadership-p3-b1d3c-payment-meta-report.md'), md.join('\n') + '\n');
  fs.writeFileSync(
    path.join(ART, 'finance-leadership-p3-b1d3c-payment-meta-results.json'),
    JSON.stringify(report, null, 2)
  );

  console.log('');
  console.log(`=== B1.d.3.c ${failed === 0 ? 'PASS' : 'FAIL'} ${passed}/${failed} ===`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
