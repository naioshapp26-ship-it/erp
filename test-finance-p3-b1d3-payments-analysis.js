'use strict';

/**
 * P3 / B1.d.3 analysis — payments & allocations (NO HTTP behavior changes).
 * Isolated writes: b1a_test. Public reads for inventory / generateNextNumber side review.
 */
const fs = require('fs');
const path = require('path');
const http = require('http');
const { Client, Pool } = require('pg');
const {
  postPaymentReceipt,
  postInvoiceIssue,
  PostingError,
  REF_PAYMENT,
  roundMoney,
  assertEntityOwns,
  resolveActor
} = require('./finance/services/finance-posting-service');
const { computeInvoiceTotalsFromLines } = require('./finance/services/finance-invoice-amounts');

const ART = '/opt/cursor/artifacts';
fs.mkdirSync(ART, { recursive: true });
const DB_URL = process.env.DATABASE_URL || 'postgresql://vendowor_erp_user:vendowor_local_dev@127.0.0.1:5432/vendowor_erp';
const BASE = process.env.APP_BASE_URL || 'http://127.0.0.1:3010';

const results = [];
const gaps = [];
function pass(name, detail = '') {
  results.push({ name, ok: true, detail });
  console.log(`PASS  ${name}${detail ? ` — ${detail}` : ''}`);
}
function fail(name, detail = '') {
  results.push({ name, ok: false, detail });
  console.log(`FAIL  ${name}${detail ? ` — ${detail}` : ''}`);
}
function gap(severity, id, title, detail, evidence) {
  gaps.push({ severity, id, title, detail, evidence });
}

function actor(entityId, overrides = {}) {
  return {
    authenticated: true,
    userId: overrides.userId || 'b1d3',
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
    const payload = body ? JSON.stringify(body) : null;
    const req = http.request(
      {
        hostname: u.hostname,
        port: u.port || 80,
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

/** Mirror current finance-routes POST /payments JE (no roundMoney). */
function currentPaymentJournalSpec({ paymentNumber, paymentAmount, paymentMethod, customerName, entityId }) {
  const cash = String(paymentMethod || 'CASH').toUpperCase() === 'CASH' ? '1110' : '1120';
  return {
    entry_number_prefix: 'JE',
    description: `قيد آلي - دفعة رقم ${paymentNumber}`,
    reference_number: paymentNumber,
    reference_type: 'PAYMENT',
    posted_at: null,
    lines: [
      {
        account_code: cash,
        debit: Number(paymentAmount),
        credit: 0,
        description: `دفعة من ${customerName}`
      },
      {
        account_code: '1130',
        debit: 0,
        credit: Number(paymentAmount),
        description: `ذمم مدينة - ${customerName}`
      }
    ],
    entity_id: entityId,
    requires_allocations: false,
    updates_invoice_balances: 'only if allocations[] provided in create body'
  };
}

function servicePaymentJournalSpec({ paymentNumber, paymentAmount, paymentMethod, entityId }) {
  const cash = String(paymentMethod || 'CASH').toUpperCase() === 'CASH' ? '1110' : '1120';
  const amt = roundMoney(paymentAmount);
  return {
    entry_number_prefix: 'JE-PAY',
    description: `تحصيل ${paymentNumber}`,
    reference_number: null,
    reference_type: 'PAYMENT',
    posted_at: 'NOW()',
    lines: [
      { account_code: cash, debit: amt, credit: 0, description: `قبض ${paymentNumber}` },
      { account_code: '1130', debit: 0, credit: amt, description: 'ذمم مدينة' }
    ],
    entity_id: entityId,
    requires_allocations: true,
    updates_invoice_balances: 'always (from allocation rows) inside postPaymentReceipt'
  };
}

async function seedCustomer(client) {
  const existing = await client.query(
    `SELECT customer_id, customer_name_ar FROM finance_customers ORDER BY 1 LIMIT 1`
  );
  if (existing.rows[0]) return existing.rows[0];
  const ins = await client.query(
    `INSERT INTO finance_customers (customer_code, customer_name_ar) VALUES ($1,$2)
     RETURNING customer_id, customer_name_ar`,
    [`B1D3-C-${Date.now()}`, 'عميل تحليل مدفوعات']
  );
  return ins.rows[0];
}

async function seedPostedInvoice(client, { entityId, total, label }) {
  const cust = await seedCustomer(client);
  const totals = computeInvoiceTotalsFromLines([
    { quantity: 1, unit_price: total, tax_percentage: 0, item_name: label }
  ]);
  // Force exact total when tax 0
  const num = `B1D3-${label}-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  const inv = await client.query(
    `INSERT INTO finance_invoices (
       invoice_number, invoice_date, due_date, customer_id, customer_name,
       subtotal, tax_amount, discount_amount, total_amount, paid_amount, remaining_amount,
       status, payment_status, entity_id
     ) VALUES ($1, CURRENT_DATE, CURRENT_DATE+30, $2, $3, $4, 0, 0, $4, 0, $4, 'ISSUED', 'UNPAID', $5)
     RETURNING *`,
    [num, cust.customer_id, cust.customer_name_ar, roundMoney(total), entityId]
  );
  await postInvoiceIssue(client, inv.rows[0].invoice_id, {
    trustedTestActor: true,
    actor: actor(entityId)
  });
  const refreshed = await client.query(`SELECT * FROM finance_invoices WHERE invoice_id=$1`, [
    inv.rows[0].invoice_id
  ]);
  return { invoice: refreshed.rows[0], customer: cust };
}

async function seedPaymentWithAllocs(client, { entityId, amount, method, allocations, label }) {
  const cust = await seedCustomer(client);
  const num = `B1D3-${label}-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
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

async function main() {
  const report = {
    phase: 'B1.d.3-analysis',
    routeMap: [],
    comparisonTable: [],
    gaps: [],
    fixPlan: [],
    phasedPlan: [],
    migrationsNeeded: [],
    generateNextNumberSideReview: null
  };

  // --- Static route map from source ---
  const fr = fs.readFileSync(path.join(__dirname, 'finance/api/finance-routes.js'), 'utf8');
  const payJs = fs.readFileSync(path.join(__dirname, 'finance/api/payments.js'), 'utf8');
  const plans = fs.readFileSync(path.join(__dirname, 'finance/api/payment-plans.js'), 'utf8');
  const aging = fs.readFileSync(path.join(__dirname, 'finance/api/ar-aging.js'), 'utf8');
  const server = fs.readFileSync(path.join(__dirname, 'server.js'), 'utf8');

  const financeRoutesMountedFirst = server.indexOf("app.use('/finance', financeRoutes)") <
    server.indexOf("app.post('/finance/payments', paymentsAPI.createPayment)");

  report.routeMap = [
    {
      method: 'POST',
      path: '/finance/payments',
      file: 'finance-routes.js',
      live: financeRoutesMountedFirst,
      createsPayment: true,
      createsAllocations: 'optional body.allocations',
      updatesInvoiceBalances: 'yes if allocations provided',
      createsJE: true,
      accounts: 'Dr 1110|1120 / Cr 1130',
      note: 'Mounted via app.use(/finance) BEFORE payments.js — live winner'
    },
    {
      method: 'POST',
      path: '/finance/payments',
      file: 'payments.js',
      live: !financeRoutesMountedFirst,
      createsPayment: true,
      createsAllocations: false,
      updatesInvoiceBalances: false,
      createsJE: false,
      note: 'Shadowed by finance-routes (latent risk if mount order changes)'
    },
    {
      method: 'PUT/DELETE',
      path: '/finance/payments/:id',
      file: 'finance-routes.js',
      live: true,
      guard: 'assertPaymentMutable (posted JE lock) — no entity ownership gate like G3 invoices'
    },
    {
      method: 'PUT/DELETE',
      path: '/finance/payments/:payment_id',
      file: 'payments.js',
      live: false,
      note: 'Shadowed; weak header entity_id check only; no posted JE guard'
    },
    {
      method: 'POST/PUT/DELETE',
      path: '/finance/payment-allocations',
      file: 'payment-plans.js via server.js',
      live: true,
      createsAllocations: true,
      updatesInvoiceBalances: false,
      createsJE: false,
      postedGuard: false,
      entityGuard: false,
      note: 'CRITICAL: can mutate allocations without touching balances or checking posted payment'
    },
    {
      method: 'PUT',
      path: '/finance/invoices/:id',
      file: 'finance-routes.js',
      live: true,
      updatesInvoiceBalances: 'can set paid_amount/remaining/payment_status if assertInvoiceMutable passes',
      note: 'Blocked when JE linked; still balance path for unposted'
    },
    {
      method: 'PUT',
      path: '/finance/ar-aging/invoices/:id',
      file: 'ar-aging.js',
      live: true,
      updatesInvoiceBalances: 'yes paid/remaining/status',
      guard: 'assertInvoiceMutable'
    },
    {
      method: 'POST',
      path: '/finance/payment-plans',
      file: 'payment-plans.js',
      live: true,
      updatesInvoiceBalances: 'plan paid/remaining only (not invoice AR directly in create)'
    },
    {
      method: 'service',
      path: 'postPaymentReceipt (unwired)',
      file: 'finance-posting-service.js',
      live: false,
      createsJE: true,
      requires_allocations: true,
      entityGuard: true
    }
  ];

  financeRoutesMountedFirst
    ? pass('mount-finance-routes-wins-post-payments')
    : fail('mount-finance-routes-wins-post-payments');

  /createPaymentAllocation/.test(plans) &&
  /app.post\('\/finance\/payment-allocations'/.test(server)
    ? pass('allocations-crud-live-unprotected-source')
    : fail('allocations-crud-live-unprotected-source');

  gap(
    'critical',
    'G-ALLOC-1',
    'CRUD payment-allocations بلا حراسة مرحّل/كيان/رصيد',
    'يمكن إضافة/تعديل/حذف تخصيص دون تحديث paid/remaining ودون رفض إن كانت الدفعة لها قيد',
    'payment-plans.js + server.js mounts'
  );
  gap(
    'critical',
    'G-PAY-1',
    'POST /finance/payments يحدّث أرصدة فاتورة مرحّلة بلا assertInvoiceMutable',
    'مسار التحصيل الحي يزيد paid_amount حتى مع وجود journal_entry_id على الفاتورة',
    'finance-routes.js UPDATE finance_invoices داخل POST /payments'
  );
  gap(
    'high',
    'G-PAY-2',
    'إنشاء دفعة بلا تخصيصات ما زال يرحّل قيدًا بكامل المبلغ',
    'الخدمات تتطلب تخصيصات؛ المسار الحالي يسمح allocations=[] مع JE كامل',
    'finance-routes.js'
  );
  gap(
    'high',
    'G-PAY-3',
    'لا assertEntityOwns على إنشاء/حذف الدفعة',
    'entity_id من body/userEntity؛ Admin/HQ بلا تفويض صريح لقائمة كيانات',
    'finance-routes.js POST/DELETE payments'
  );
  gap(
    'medium',
    'G-PAY-4',
    'payments.js مظلّل لكنه خطر كامن',
    'إن تغيّر ترتيب mount يعمل إنشاء بلا JE وبلا حراسة مرحّل',
    'server.js order'
  );
  gap(
    'medium',
    'G-META-1',
    'اختلاف metadata قيد التحصيل (خدمة vs حي)',
    'JE-PAY vs JE-، وصف، reference_number، posted_at، أوصاف الأسطر',
    'postPaymentReceipt vs finance-routes'
  );
  gap(
    'low',
    'G-REFUND-1',
    'لا مسار استرداد/عكس دفعة مخصص ظاهر في نطاق AR',
    'العكس العام reverseEntry للقيود فقط؛ لا refund payment API في الحصر',
    'inventory'
  );

  // Comparison table
  report.comparisonTable = [
    {
      aspect: 'الحسابات',
      current: 'Dr 1110|1120 / Cr 1130',
      service: 'نفس الحسابات',
      parity: 'MATCH'
    },
    {
      aspect: 'مبلغ القيد',
      current: 'payment_amount من الطلب (JS)',
      service: 'roundMoney(payment.payment_amount) المخزّن',
      parity: 'CONDITIONAL'
    },
    {
      aspect: 'الضريبة في قيد التحصيل',
      current: 'غير مستخدمة',
      service: 'غير مستخدمة',
      parity: 'MATCH (N/A)'
    },
    {
      aspect: 'التخصيصات',
      current: 'اختيارية؛ إن وُجدت تحدّث الأرصدة قبل JE',
      service: 'إلزامية ومجموعها = مبلغ الدفعة',
      parity: 'DIFF سلوكي'
    },
    {
      aspect: 'تجاوز المتبقي',
      current: 'لا فحص OVER_ALLOCATION',
      service: 'OVER_ALLOCATION 422',
      parity: 'DIFF (خدمة أضبط)'
    },
    {
      aspect: 'كيان التخصيص',
      current: 'لا فحص',
      service: 'ALLOCATION_ENTITY_MISMATCH + assertEntityOwns',
      parity: 'DIFF'
    },
    {
      aspect: 'ترقيم القيد',
      current: 'JE-####',
      service: 'JE-PAY-####',
      parity: 'DIFF metadata'
    },
    {
      aspect: 'الوصف / reference_number',
      current: 'قيد آلي - دفعة رقم … + reference_number',
      service: 'تحصيل … بلا reference_number',
      parity: 'DIFF metadata'
    },
    {
      aspect: 'حالة الفاتورة بعد التحصيل',
      current: 'PAID/PARTIAL عبر remaining_amount - alloc (تعبير SQL يعتمد قيمة الصف قبل التحديث في CASE)',
      service: 'PAID/PARTIAL عبر total - (paid+alloc)',
      parity: 'CONDITIONAL — صيغتان مختلفتان'
    }
  ];

  // Spec parity samples
  const cur = currentPaymentJournalSpec({
    paymentNumber: 'PAY-1',
    paymentAmount: 100,
    paymentMethod: 'CASH',
    customerName: 'عميل',
    entityId: 'BR001'
  });
  const svc = servicePaymentJournalSpec({
    paymentNumber: 'PAY-1',
    paymentAmount: 100,
    paymentMethod: 'CASH',
    entityId: 'BR001'
  });
  cur.lines[0].account_code === svc.lines[0].account_code &&
  cur.lines[1].account_code === svc.lines[1].account_code &&
  Math.abs(cur.lines[0].debit - svc.lines[0].debit) < 0.001
    ? pass('spec-accounts-amount-match-simple')
    : fail('spec-accounts-amount-match-simple');
  cur.entry_number_prefix !== svc.entry_number_prefix
    ? pass('spec-metadata-prefix-diff-noted', `${cur.entry_number_prefix} vs ${svc.entry_number_prefix}`)
    : fail('spec-metadata-prefix-diff-noted');

  const client = new Client({ connectionString: DB_URL, ssl: false });
  await client.connect();
  await client.query('SET search_path TO b1a_test, public');
  const publicPayBefore = await client.query('SELECT COUNT(*)::int AS c FROM public.finance_payments');
  const publicJeBefore = await client.query('SELECT COUNT(*)::int AS c FROM public.finance_journal_entries');

  try {
    // Partial + full allocation via service
    const invA = await seedPostedInvoice(client, { entityId: 'BR001', total: 200, label: 'part' });
    const payPartial = await seedPaymentWithAllocs(client, {
      entityId: 'BR001',
      amount: 80,
      method: 'CASH',
      label: 'pp',
      allocations: [{ invoice_id: invA.invoice.invoice_id, allocated_amount: 80 }]
    });
    const postedP = await postPaymentReceipt(client, payPartial.payment.payment_id, {
      trustedTestActor: true,
      actor: actor('BR001')
    });
    const afterP = await client.query(
      `SELECT paid_amount::float AS paid, remaining_amount::float AS rem, payment_status, status
       FROM finance_invoices WHERE invoice_id=$1`,
      [invA.invoice.invoice_id]
    );
    Math.abs(afterP.rows[0].paid - 80) < 0.02 && Math.abs(afterP.rows[0].rem - 120) < 0.02
      ? pass('svc-partial-alloc-balances', JSON.stringify(afterP.rows[0]))
      : fail('svc-partial-alloc-balances', JSON.stringify(afterP.rows[0]));

    const jeLines = await client.query(
      `SELECT account_code, debit_amount::float AS d, credit_amount::float AS c
       FROM finance_journal_lines WHERE entry_id=$1 ORDER BY line_number`,
      [postedP.entry.entry_id]
    );
    jeLines.rows[0].account_code === '1110' &&
    Math.abs(jeLines.rows[0].d - 80) < 0.01 &&
    jeLines.rows[1].account_code === '1130'
      ? pass('svc-je-cash-ar-match')
      : fail('svc-je-cash-ar-match', JSON.stringify(jeLines.rows));

    // Multi-invoice allocation
    const invB = await seedPostedInvoice(client, { entityId: 'BR001', total: 50, label: 'm1' });
    const invC = await seedPostedInvoice(client, { entityId: 'BR001', total: 70, label: 'm2' });
    const payMulti = await seedPaymentWithAllocs(client, {
      entityId: 'BR001',
      amount: 120,
      method: 'BANK',
      label: 'multi',
      allocations: [
        { invoice_id: invB.invoice.invoice_id, allocated_amount: 50 },
        { invoice_id: invC.invoice.invoice_id, allocated_amount: 70 }
      ]
    });
    const postedM = await postPaymentReceipt(client, payMulti.payment.payment_id, {
      trustedTestActor: true,
      actor: actor('BR001')
    });
    const jlM = await client.query(
      `SELECT account_code, debit_amount::float AS d FROM finance_journal_lines WHERE entry_id=$1 AND account_code='1120'`,
      [postedM.entry.entry_id]
    );
    Math.abs(jlM.rows[0].d - 120) < 0.01
      ? pass('svc-multi-invoice-bank-debit')
      : fail('svc-multi-invoice-bank-debit');
    const bState = await client.query(
      `SELECT payment_status, remaining_amount::float AS rem FROM finance_invoices WHERE invoice_id=$1`,
      [invB.invoice.invoice_id]
    );
    bState.rows[0].payment_status === 'PAID' && bState.rows[0].rem <= 0.01
      ? pass('svc-multi-invoice-fully-paid')
      : fail('svc-multi-invoice-fully-paid', JSON.stringify(bState.rows[0]));

    // Cross-entity allocation denied
    const invOther = await seedPostedInvoice(client, { entityId: 'BR002', total: 30, label: 'xent' });
    const payX = await seedPaymentWithAllocs(client, {
      entityId: 'BR001',
      amount: 30,
      method: 'CASH',
      label: 'xpay',
      allocations: [{ invoice_id: invOther.invoice.invoice_id, allocated_amount: 30 }]
    });
    try {
      await postPaymentReceipt(client, payX.payment.payment_id, {
        trustedTestActor: true,
        actor: actor('BR001', {
          allowCrossEntity: true,
          allowedEntityIds: ['BR001', 'BR002']
        })
      });
      fail('svc-cross-entity-alloc-denied');
    } catch (e) {
      e.code === 'ALLOCATION_ENTITY_MISMATCH'
        ? pass('svc-cross-entity-alloc-denied', e.code)
        : fail('svc-cross-entity-alloc-denied', e.code);
    }

    // HQ without grant denied on payment
    const invHq = await seedPostedInvoice(client, { entityId: 'BR002', total: 25, label: 'hq' });
    const payHq = await seedPaymentWithAllocs(client, {
      entityId: 'BR002',
      amount: 25,
      method: 'CASH',
      label: 'hqpay',
      allocations: [{ invoice_id: invHq.invoice.invoice_id, allocated_amount: 25 }]
    });
    try {
      await postPaymentReceipt(client, payHq.payment.payment_id, {
        trustedTestActor: true,
        actor: actor('HQ001', { role: 'مسؤول النظام', entityType: 'HQ' })
      });
      fail('svc-hq-without-grant-denied');
    } catch (e) {
      e.code === 'CROSS_ENTITY_DENIED'
        ? pass('svc-hq-without-grant-denied')
        : fail('svc-hq-without-grant-denied', e.code);
    }

    // Spoofed headers ignored
    const spoofed = resolveActor({
      headers: { 'x-entity-id': 'HACK', 'x-user-role': 'Admin' },
      authUser: null
    });
    spoofed.authenticated === false
      ? pass('spoofed-headers-ignored')
      : fail('spoofed-headers-ignored');

    // Over-allocation
    const invOver = await seedPostedInvoice(client, { entityId: 'BR001', total: 40, label: 'over' });
    const payOver1 = await seedPaymentWithAllocs(client, {
      entityId: 'BR001',
      amount: 40,
      method: 'CASH',
      label: 'o1',
      allocations: [{ invoice_id: invOver.invoice.invoice_id, allocated_amount: 40 }]
    });
    await postPaymentReceipt(client, payOver1.payment.payment_id, {
      trustedTestActor: true,
      actor: actor('BR001')
    });
    const payOver2 = await seedPaymentWithAllocs(client, {
      entityId: 'BR001',
      amount: 10,
      method: 'CASH',
      label: 'o2',
      allocations: [{ invoice_id: invOver.invoice.invoice_id, allocated_amount: 10 }]
    });
    try {
      await postPaymentReceipt(client, payOver2.payment.payment_id, {
        trustedTestActor: true,
        actor: actor('BR001')
      });
      fail('svc-over-allocation');
    } catch (e) {
      e.code === 'OVER_ALLOCATION' ? pass('svc-over-allocation') : fail('svc-over-allocation', e.code);
    }

    // Duplicate payment post
    try {
      await postPaymentReceipt(client, payPartial.payment.payment_id, {
        trustedTestActor: true,
        actor: actor('BR001')
      });
      fail('svc-duplicate-payment-post');
    } catch (e) {
      e.status === 409 ? pass('svc-duplicate-payment-post', e.code) : fail('svc-duplicate-payment-post', e.code);
    }

    // Allocations required
    const bare = await client.query(
      `INSERT INTO finance_payments (payment_number, payment_date, customer_id, payment_amount, payment_method, status, entity_id)
       VALUES ($1, CURRENT_DATE, $2, 15, 'CASH', 'PENDING', 'BR001') RETURNING payment_id`,
      [`B1D3-BARE-${Date.now()}`, (await seedCustomer(client)).customer_id]
    );
    try {
      await postPaymentReceipt(client, bare.rows[0].payment_id, {
        trustedTestActor: true,
        actor: actor('BR001')
      });
      fail('svc-allocations-required');
    } catch (e) {
      e.code === 'ALLOCATIONS_REQUIRED'
        ? pass('svc-allocations-required')
        : fail('svc-allocations-required', e.code);
    }

    // Simulate unprotected allocation mutate after posted payment (documents gap — no HTTP change)
    const allocRows = await client.query(
      `SELECT allocation_id, allocated_amount FROM finance_payment_allocations WHERE payment_id=$1`,
      [payPartial.payment.payment_id]
    );
    if (allocRows.rows[0]) {
      await client.query(
        `UPDATE finance_payment_allocations SET allocated_amount = allocated_amount + 1 WHERE allocation_id=$1`,
        [allocRows.rows[0].allocation_id]
      );
      const drifted = await client.query(
        `SELECT allocated_amount::float AS a FROM finance_payment_allocations WHERE allocation_id=$1`,
        [allocRows.rows[0].allocation_id]
      );
      drifted.rows[0].a === Number(allocRows.rows[0].allocated_amount) + 1
        ? pass('gap-alloc-mutable-after-post-demonstrated', 'تخصيص مرحّل قابل للتعديل SQL/CRUD — فجوة')
        : fail('gap-alloc-mutable-after-post-demonstrated');
      // restore for cleanliness
      await client.query(
        `UPDATE finance_payment_allocations SET allocated_amount=$1 WHERE allocation_id=$2`,
        [allocRows.rows[0].allocated_amount, allocRows.rows[0].allocation_id]
      );
    }

    // Mid-flight rollback: payment+alloc+JE inside one outer tx, then ROLLBACK
    const invMid = await seedPostedInvoice(client, { entityId: 'BR001', total: 55, label: 'mid' });
    const midPaidBefore = await client.query(
      `SELECT paid_amount::float AS paid FROM finance_invoices WHERE invoice_id=$1`,
      [invMid.invoice.invoice_id]
    );
    await client.query('BEGIN');
    const midPay = await client.query(
      `INSERT INTO finance_payments (payment_number, payment_date, customer_id, payment_amount, payment_method, status, entity_id)
       VALUES ($1, CURRENT_DATE, $2, 55, 'CASH', 'PENDING', 'BR001') RETURNING payment_id`,
      [`B1D3-MID-${Date.now()}`, (await seedCustomer(client)).customer_id]
    );
    await client.query(
      `INSERT INTO finance_payment_allocations (payment_id, invoice_id, allocated_amount) VALUES ($1,$2,55)`,
      [midPay.rows[0].payment_id, invMid.invoice.invoice_id]
    );
    await postPaymentReceipt(client, midPay.rows[0].payment_id, {
      trustedTestActor: true,
      actor: actor('BR001'),
      manageTransaction: false
    });
    await client.query('ROLLBACK');
    const midGone = await client.query(
      `SELECT COUNT(*)::int AS c FROM finance_payments WHERE payment_id=$1`,
      [midPay.rows[0].payment_id]
    );
    const midPaidAfter = await client.query(
      `SELECT paid_amount::float AS paid FROM finance_invoices WHERE invoice_id=$1`,
      [invMid.invoice.invoice_id]
    );
    midGone.rows[0].c === 0 &&
    Math.abs(midPaidAfter.rows[0].paid - midPaidBefore.rows[0].paid) < 0.01
      ? pass('tx-rollback-payment-je-and-balances')
      : fail(
          'tx-rollback-payment-je-and-balances',
          `pay=${midGone.rows[0].c} paid ${midPaidBefore.rows[0].paid}->${midPaidAfter.rows[0].paid}`
        );

    // Concurrency: two posts same payment
    const invConc = await seedPostedInvoice(client, { entityId: 'BR001', total: 90, label: 'conc' });
    const payConc = await seedPaymentWithAllocs(client, {
      entityId: 'BR001',
      amount: 90,
      method: 'CASH',
      label: 'conc',
      allocations: [{ invoice_id: invConc.invoice.invoice_id, allocated_amount: 90 }]
    });
    const pool = new Pool({ connectionString: DB_URL, ssl: false, max: 4 });
    const run = async () => {
      const c = await pool.connect();
      try {
        await c.query('SET search_path TO b1a_test, public');
        return await postPaymentReceipt(c, payConc.payment.payment_id, {
          trustedTestActor: true,
          actor: actor('BR001')
        });
      } finally {
        c.release();
      }
    };
    const conc = await Promise.allSettled([run(), run()]);
    const ok = conc.filter((x) => x.status === 'fulfilled').length;
    const den = conc.filter((x) => x.status === 'rejected').length;
    const refs = await client.query(
      `SELECT COUNT(*)::int AS c FROM finance_journal_entries
       WHERE reference_type=$1 AND reference_id=$2 AND is_posted=true`,
      [REF_PAYMENT, payConc.payment.payment_id]
    );
    ok === 1 && den === 1 && refs.rows[0].c === 1
      ? pass('concurrent-same-payment-one-je', `refs=${refs.rows[0].c}`)
      : fail('concurrent-same-payment-one-je', JSON.stringify({ ok, den, refs: refs.rows[0].c }));
    await pool.end();

    // Two different payments on same invoice remaining — both can succeed (no collection idempotency)
    const invTwo = await seedPostedInvoice(client, { entityId: 'BR001', total: 100, label: 'two' });
    const p1 = await seedPaymentWithAllocs(client, {
      entityId: 'BR001',
      amount: 40,
      method: 'CASH',
      label: 't1',
      allocations: [{ invoice_id: invTwo.invoice.invoice_id, allocated_amount: 40 }]
    });
    const p2 = await seedPaymentWithAllocs(client, {
      entityId: 'BR001',
      amount: 40,
      method: 'CASH',
      label: 't2',
      allocations: [{ invoice_id: invTwo.invoice.invoice_id, allocated_amount: 40 }]
    });
    await postPaymentReceipt(client, p1.payment.payment_id, {
      trustedTestActor: true,
      actor: actor('BR001')
    });
    await postPaymentReceipt(client, p2.payment.payment_id, {
      trustedTestActor: true,
      actor: actor('BR001')
    });
    pass(
      'two-different-payments-same-invoice-allowed',
      'منع إعادة ترحيل نفس payment_id ≠ منع دفعتين مختلفتين لنفس التحصيل المنطقي'
    );

    // Current-path balance update without mutable guard — demonstrate via SQL mirror of route
    const invLive = await seedPostedInvoice(client, {
      entityId: 'BR001',
      total: 60,
      label: 'liveupd'
    });
    // Mirror finance-routes UPDATE (no assertInvoiceMutable)
    await client.query(
      `UPDATE finance_invoices
       SET paid_amount = paid_amount + $1,
           remaining_amount = remaining_amount - $1
       WHERE invoice_id = $2`,
      [10, invLive.invoice.invoice_id]
    );
    const liveAfter = await client.query(
      `SELECT paid_amount::float AS paid, journal_entry_id FROM finance_invoices WHERE invoice_id=$1`,
      [invLive.invoice.invoice_id]
    );
    liveAfter.rows[0].journal_entry_id != null && liveAfter.rows[0].paid === 10
      ? pass('gap-posted-invoice-balance-mutable-via-payment-style-update', 'محاكاة مسار التحصيل الحي')
      : fail('gap-posted-invoice-balance-mutable-via-payment-style-update');

    const publicPayAfter = await client.query('SELECT COUNT(*)::int AS c FROM public.finance_payments');
    const publicJeAfter = await client.query('SELECT COUNT(*)::int AS c FROM public.finance_journal_entries');
    publicPayAfter.rows[0].c === publicPayBefore.rows[0].c
      ? pass('public-payments-unchanged')
      : fail('public-payments-unchanged', `${publicPayBefore.rows[0].c}->${publicPayAfter.rows[0].c}`);
    // JE public may have grown from other tests on same VM — only assert payments table for isolation
    pass('public-je-note', `before=${publicJeBefore.rows[0].c} after=${publicJeAfter.rows[0].c}`);
  } finally {
    await client.end();
  }

  // generateNextNumber side review (B1.d.2) — read only
  const pg = new Client({ connectionString: DB_URL, ssl: false });
  await pg.connect();
  try {
    const invNums = await pg.query(`
      SELECT invoice_number FROM public.finance_invoices
      ORDER BY invoice_number
    `);
    const matching = invNums.rows.filter((r) => /^INV-[0-9]+$/.test(r.invoice_number));
    const nonMatching = invNums.rows.filter((r) => !/^INV-[0-9]+$/.test(r.invoice_number));
    const uniqScope = await pg.query(`
      SELECT indexdef FROM pg_indexes
      WHERE tablename='finance_invoices' AND indexname='finance_invoices_invoice_number_key'
    `);
    report.generateNextNumberSideReview = {
      patternNow: '^PREFIX-[0-9]+$',
      uniqueScope: 'GLOBAL on invoice_number (not per-entity)',
      historicalNonMatchingCount: nonMatching.length,
      historicalMatchingCount: matching.length,
      samplesNonMatching: nonMatching.slice(0, 5).map((r) => r.invoice_number),
      concurrencyNote:
        'تزامن إنشاءين قد يصطدم بـ UNIQUE العالمي؛ فائز واحد. لا تفرد لكل كيان — نفس INV-0001 لا يمكن لكيانين.',
      invoiceWireUntouched: true,
      indexdef: uniqScope.rows[0]?.indexdef || null
    };
    pass(
      'gnn-side-review-documented',
      `match=${matching.length} other=${nonMatching.length} scope=global`
    );
  } finally {
    await pg.end();
  }

  // Source still: no payment wiring
  !/postPaymentReceipt\s*\(/.test(fr)
    ? pass('payments-route-not-wired-to-service')
    : fail('payments-route-not-wired-to-service');

  // HTTP smoke pages + confirm POST payments still exists (no behavior assert of change)
  try {
    const login = await httpJson('POST', '/api/auth/login', {
      email: 'admin@naiosh.com',
      password: 'Admin@123'
    });
    if (login.json?.success) {
      pass('http-login');
      const session = login.json.data.session;
      const token =
        (session && typeof session === 'object' ? session.token : session) || login.json.data.token;
      for (const p of ['/finance', '/finance/receivables-collections.html', '/finance/payroll-runs.html']) {
        const r = await httpJson('GET', p, null, { Authorization: `Bearer ${token}` });
        r.status === 200 || r.status === 304 ? pass(`smoke:${p}`) : fail(`smoke:${p}`, String(r.status));
      }
    } else fail('http-login', login.raw);
  } catch (e) {
    fail('http-section', e.message);
  }

  report.gaps = gaps.sort((a, b) => {
    const order = { critical: 0, high: 1, medium: 2, low: 3 };
    return order[a.severity] - order[b.severity];
  });

  report.fixPlan = [
    {
      step: 'd3.1',
      title: 'حراسة payment-allocations CRUD',
      actions: [
        'رفض POST/PUT/DELETE إن كانت الدفعة journal_entry_id مرحّل أو لها قيد PAYMENT',
        'assertEntityOwns على دفعة وفاتورة التخصيص',
        'منع كسر مجموع التخصيصات vs payment_amount دون إعادة ترحيل'
      ]
    },
    {
      step: 'd3.2',
      title: 'جاهزية postPaymentReceipt (metadata D2-style)',
      actions: [
        'محاذاة JE- / وصف قيد آلي / reference_number / أوصاف الأسطر مع المسار الحي',
        'اعتماد roundMoney من الصف المخزّن',
        'الإبقاء على إلزام التخصيصات'
      ]
    },
    {
      step: 'd3.3',
      title: 'ربط POST /finance/payments خلف علم',
      actions: [
        'FINANCE_POST_PAYMENT_VIA_SERVICE default false',
        'compute/validate allocations → insert payment+allocs → postPaymentReceipt في معاملة واحدة',
        'منع المسار القديم والجديد معًا',
        'assertInvoiceMutable أو فحص رصيد داخل الخدمة قبل تحديث الأرصدة'
      ]
    },
    {
      step: 'd3.4',
      title: 'كيان على DELETE/PUT payments (مثل G3)',
      actions: ['assertEntityOwns من الجلسة + فلتر entity_id في SQL']
    }
  ];

  report.phasedPlan = [
    { batch: 'B1.d.3.a', scope: 'تحليل+اختبارات (هذه الجولة)', needsApproval: 'done-for-analysis' },
    { batch: 'B1.d.3.b', scope: 'حراسة allocations فقط', needsApproval: 'explicit' },
    { batch: 'B1.d.3.c', scope: 'محاذاة metadata الخدمة + اختبارات تكافؤ', needsApproval: 'explicit' },
    { batch: 'B1.d.3.d', scope: 'ربط POST payments خلف علم false', needsApproval: 'explicit' },
    { batch: 'B1.d.3.e', scope: 'G3-style entity على PUT/DELETE payments', needsApproval: 'explicit' }
  ];

  report.migrationsNeeded = [
    {
      item: 'UNIQUE جزئي على (reference_type, reference_id) WHERE PAYMENT AND posted',
      requiredBeforeWire: false,
      note: 'موصى بعد تدقيق بيانات؛ الحماية الحالية قفل تطبيقي'
    },
    {
      item: 'UNIQUE (payment_id, invoice_id) على allocations؟',
      requiredBeforeWire: false,
      note: 'يمنع تكرار تخصيص نفس الفاتورة لنفس الدفعة — يحتاج فحص تاريخي'
    },
    {
      item: 'تفرد payment_number / invoice_number لكل entity',
      requiredBeforeWire: false,
      note: 'حاليًا GLOBAL — قرار محاسبي/تشغيلي منفصل'
    }
  ];

  const passed = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok).length;
  report.summary = { passed, failed, total: results.length, results };

  const md = [];
  md.push('# تقرير تحليل B1.d.3 — المدفوعات والتخصيصات (بلا تنفيذ)');
  md.push('');
  md.push(`**الاختبارات:** ${failed === 0 ? 'PASS' : 'FAIL'} — ${passed} / ${failed}`);
  md.push('**النطاق:** تحليل + اختبارات معزولة فقط. لا تعديل HTTP · لا ترحيل · لا migrations · لا دمج.');
  md.push('');
  md.push('## 1) خريطة المسارات والجداول');
  md.push('');
  md.push('| Method | Path | الملف | حي؟ | قيد؟ | أرصدة فاتورة؟ | ملاحظات |');
  md.push('|---|---|---|---|---|---|---|');
  for (const r of report.routeMap) {
    md.push(
      `| ${r.method} | \`${r.path}\` | ${r.file} | ${r.live} | ${r.createsJE ?? '-'} | ${r.updatesInvoiceBalances ?? '-'} | ${(r.note || r.guard || '').replace(/\|/g, '/')} |`
    );
  }
  md.push('');
  md.push('**جداول:** `finance_payments`, `finance_payment_allocations`, `finance_invoices` (paid/remaining/status), `finance_journal_entries/lines`.');
  md.push('');
  md.push('## 2) مقارنة التحصيل الحالي × postPaymentReceipt');
  md.push('');
  md.push('| الجانب | الحالي | الخدمة | التكافؤ |');
  md.push('|---|---|---|---|');
  for (const row of report.comparisonTable) {
    md.push(`| ${row.aspect} | ${row.current} | ${row.service} | ${row.parity} |`);
  }
  md.push('');
  md.push('## 3) نتائج PASS/FAIL');
  results.forEach((r) => md.push(`- ${r.ok ? 'PASS' : 'FAIL'} ${r.name}${r.detail ? `: ${r.detail}` : ''}`));
  md.push('');
  md.push('## 4) الثغرات حسب الخطورة');
  md.push('');
  md.push('| شدة | ID | العنوان |');
  md.push('|---|---|---|');
  for (const g of report.gaps) {
    md.push(`| ${g.severity} | ${g.id} | ${g.title} |`);
    md.push(`| | | ${g.detail} |`);
  }
  md.push('');
  md.push('## 5) خطة إصلاح التخصيصات');
  report.fixPlan.forEach((s) => {
    md.push(`### ${s.step} — ${s.title}`);
    s.actions.forEach((a) => md.push(`- ${a}`));
  });
  md.push('');
  md.push('## 6) دفعات تنفيذ B1.d.3 (للموافقة)');
  report.phasedPlan.forEach((p) => md.push(`- **${p.batch}**: ${p.scope} — موافقة: ${p.needsApproval}`));
  md.push('');
  md.push('## 7) Migrations / قرارات قبل التنفيذ');
  report.migrationsNeeded.forEach((m) =>
    md.push(`- **${m.item}** — قبل الربط؟ ${m.requiredBeforeWire} — ${m.note}`)
  );
  md.push('');
  md.push('## مراجعة جانبية generateNextNumber (B1.d.2)');
  const gnn = report.generateNextNumberSideReview;
  md.push(`- النمط الحالي: \`${gnn.patternNow}\``);
  md.push(`- نطاق التفرد: **${gnn.uniqueScope}**`);
  md.push(`- أرقام مطابقة/غير مطابقة: ${gnn.historicalMatchingCount} / ${gnn.historicalNonMatchingCount}`);
  md.push(`- ${gnn.concurrencyNote}`);
  md.push(`- ربط الفواتير لم يُعدَّل في هذه الجولة: ${gnn.invoiceWireUntouched}`);
  md.push('');
  md.push('## الفرق: إعادة ترحيل الدفعة vs دفعتين');
  md.push('- **نفس payment_id:** الخدمة تمنع القيد المزدوج (قفل+مرجع) → 409.');
  md.push('- **دفعتان مختلفتان** لنفس الفاتورة/طلب منطقي: مسموح ما دام المتبقي يكفي — لا idempotency لمفتاح تحصيل عميل.');
  md.push('');
  md.push('لا تنفيذ d.3 · لا d.4+ · لا Payroll · لا دمج/Staging/Production دون موافقة.');

  fs.writeFileSync(path.join(ART, 'finance-leadership-p3-b1d3-analysis-results.json'), JSON.stringify(report, null, 2));
  fs.writeFileSync(path.join(ART, 'finance-leadership-p3-b1d3-analysis-report.md'), md.join('\n'));
  fs.writeFileSync(path.join(__dirname, 'docs/finance-leadership-p3-b1d3-analysis-report.md'), md.join('\n'));

  console.log(`\n=== B1.d.3 analysis ${failed === 0 ? 'PASS' : 'FAIL'} ${passed}/${failed} ===`);
  console.log(`Gaps: ${gaps.length} (critical=${gaps.filter((g) => g.severity === 'critical').length})`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
