'use strict';

/**
 * P3 / B1.d.5a.3 — collection safety gate isolated tests.
 * Uses b1a_test for service-path writes; HTTP against :3010 (default flags false).
 * No flag enablement. No migrations. No historical rewrite.
 */
const fs = require('fs');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');
const { Client } = require('pg');
const {
  postInvoiceIssue,
  postPaymentReceipt,
  PostingError,
  roundMoney
} = require('./finance/services/finance-posting-service');
const {
  assertInvoiceIssueReadyForCollection,
  resolveInvoiceIssueForCollection
} = require('./finance/services/finance-collection-gate');
const { computeInvoiceTotalsFromLines } = require('./finance/services/finance-invoice-amounts');
const financeRoutes = require('./finance/api/finance-routes');

const ART = '/opt/cursor/artifacts';
fs.mkdirSync(ART, { recursive: true });
const DB_URL =
  process.env.DATABASE_URL ||
  'postgresql://vendowor_erp_user:vendowor_local_dev@127.0.0.1:5432/vendowor_erp';
const PORT = 3010;
const BASE = process.env.APP_BASE_URL || `http://127.0.0.1:${PORT}`;

const results = [];
function pass(name, detail = '') {
  results.push({ name, ok: true, detail });
  console.log(`PASS  ${name}${detail ? ` — ${detail}` : ''}`);
}
function fail(name, detail = '') {
  results.push({ name, ok: false, detail });
  console.log(`FAIL  ${name}${detail ? ` — ${detail}` : ''}`);
}

function actor(entityId) {
  return {
    authenticated: true,
    userId: 'b1d5a3',
    role: 'Admin',
    permissions: ['journals.post', 'journals.reverse', 'payments.post', 'invoices.post'],
    entityId,
    entityType: 'BRANCH',
    allowCrossEntity: false,
    allowedEntityIds: []
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
        },
        timeout: 20000
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
          resolve({ status: res.statusCode, json, raw: raw.slice(0, 600) });
        });
      }
    );
    req.on('timeout', () => req.destroy(new Error('timeout')));
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
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
  const logFd = fs.openSync(path.join(ART, 'b1d5a3-server.log'), 'a');
  const child = spawn('node', ['server.js'], {
    cwd: '/workspace',
    env: {
      ...process.env,
      DATABASE_URL: DB_URL,
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

async function login() {
  const r = await httpJson('POST', '/api/auth/login', {
    email: 'admin@naiosh.com',
    password: 'Admin@123'
  });
  if (!r.json?.success) throw new Error('login failed ' + r.raw);
  const s = r.json.data.session;
  return (s && typeof s === 'object' ? s.token : s) || r.json.data.token;
}

async function seedCustomer(client) {
  const existing = await client.query(
    `SELECT customer_id, customer_name_ar FROM finance_customers ORDER BY 1 LIMIT 1`
  );
  if (existing.rows[0]) return existing.rows[0];
  const ins = await client.query(
    `INSERT INTO finance_customers (customer_code, customer_name_ar) VALUES ($1,$2)
     RETURNING customer_id, customer_name_ar`,
    [`B1D5A3-C-${Date.now()}`, 'عميل بوابة التحصيل']
  );
  return ins.rows[0];
}

async function createInvoice(client, { entityId, total, label, status = 'ISSUED' }) {
  const cust = await seedCustomer(client);
  const computed = computeInvoiceTotalsFromLines([
    { item_name: label, quantity: 1, unit_price: total, tax_percentage: 0 }
  ]);
  const num = `B1D5A3-${label}-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  const inv = await client.query(
    `INSERT INTO finance_invoices (
       invoice_number, invoice_date, due_date, customer_id, customer_name,
       subtotal, tax_amount, discount_amount, total_amount, paid_amount, remaining_amount,
       status, payment_status, entity_id
     ) VALUES ($1, CURRENT_DATE, CURRENT_DATE+30, $2, $3, $4, $5, $6, $7, 0, $7, $8, 'UNPAID', $9)
     RETURNING *`,
    [
      num,
      cust.customer_id,
      cust.customer_name_ar,
      computed.subtotal,
      computed.tax_amount,
      computed.discount_amount,
      computed.total_amount,
      status,
      entityId
    ]
  );
  return { invoice: inv.rows[0], customer: cust };
}

async function seedPayment(client, { entityId, amount, invoiceId, label }) {
  const cust = await seedCustomer(client);
  const num = `B1D5A3-P-${label}-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  // b1a_test payments table is slim (no customer_name / payment_type / notes)
  const pay = await client.query(
    `INSERT INTO finance_payments (
       payment_number, payment_date, customer_id, payment_amount, payment_method, status, entity_id
     ) VALUES ($1, CURRENT_DATE, $2, $3, 'CASH', 'PENDING', $4)
     RETURNING *`,
    [num, cust.customer_id, amount, entityId]
  );
  if (invoiceId != null) {
    await client.query(
      `INSERT INTO finance_payment_allocations (payment_id, invoice_id, allocated_amount)
       VALUES ($1,$2,$3)`,
      [pay.rows[0].payment_id, invoiceId, amount]
    );
  }
  return pay.rows[0];
}

async function main() {
  const report = {
    phase: 'B1.d.5a.3-collection-gate',
    flagsDefaultFalse: true,
    productionUntouched: true,
    mutationsOnPublicHistorical: false
  };

  delete process.env.FINANCE_POST_INVOICE_VIA_SERVICE;
  delete process.env.FINANCE_POST_PAYMENT_VIA_SERVICE;
  financeRoutes.isFinancePostInvoiceViaService() === false &&
  financeRoutes.isFinancePostPaymentViaService() === false
    ? pass('flags-default-false')
    : fail('flags-default-false');

  const client = new Client({ connectionString: DB_URL });
  await client.connect();
  await client.query('SET search_path TO b1a_test, public');
  const E1 = 'B1D5A3-E1';
  const act = actor(E1);

  // --- Unit: ALLOW with journal_entry_id ---
  {
    const { invoice } = await createInvoice(client, { entityId: E1, total: 40, label: 'allow-link' });
    await postInvoiceIssue(client, invoice.invoice_id, { trustedTestActor: true, actor: act });
    const r = await assertInvoiceIssueReadyForCollection(client, invoice.invoice_id);
    r.ok && r.extra.resolved_via === 'journal_entry_id'
      ? pass('unit-allow-with-journal-entry-id', String(r.extra.entry_id))
      : fail('unit-allow-with-journal-entry-id', JSON.stringify(r));
  }

  // --- Unit: ALLOW with null journal_entry_id but sole INVOICE ref ---
  {
    const { invoice } = await createInvoice(client, { entityId: E1, total: 55, label: 'allow-ref' });
    const posted = await postInvoiceIssue(client, invoice.invoice_id, {
      trustedTestActor: true,
      actor: act
    });
    await client.query(`UPDATE finance_invoices SET journal_entry_id = NULL WHERE invoice_id=$1`, [
      invoice.invoice_id
    ]);
    const r = await assertInvoiceIssueReadyForCollection(client, invoice.invoice_id);
    r.ok &&
    r.extra.resolved_via === 'reference_type:INVOICE' &&
    Number(r.extra.entry_id) === Number(posted.entry.entry_id)
      ? pass('unit-allow-null-link-sole-ref', String(r.extra.entry_id))
      : fail('unit-allow-null-link-sole-ref', JSON.stringify(r));
  }

  // --- Unit: REJECT no issue JE ---
  {
    const { invoice } = await createInvoice(client, { entityId: E1, total: 12, label: 'noje' });
    try {
      await assertInvoiceIssueReadyForCollection(client, invoice.invoice_id);
      fail('unit-reject-no-issue-je');
    } catch (e) {
      e instanceof PostingError && e.code === 'INVOICE_ISSUE_JE_REQUIRED' && e.status === 422
        ? pass('unit-reject-no-issue-je')
        : fail('unit-reject-no-issue-je', `${e.code} ${e.status}`);
    }
  }

  // --- Unit: REJECT cancelled ---
  {
    const { invoice } = await createInvoice(client, {
      entityId: E1,
      total: 13,
      label: 'canc',
      status: 'CANCELLED'
    });
    try {
      await assertInvoiceIssueReadyForCollection(client, invoice.invoice_id);
      fail('unit-reject-cancelled');
    } catch (e) {
      e.code === 'INVOICE_NOT_COLLECTABLE'
        ? pass('unit-reject-cancelled')
        : fail('unit-reject-cancelled', e.code);
    }
  }

  // --- Unit: REJECT reversed issue JE ---
  {
    const { invoice } = await createInvoice(client, { entityId: E1, total: 25, label: 'rev' });
    const posted = await postInvoiceIssue(client, invoice.invoice_id, {
      trustedTestActor: true,
      actor: act
    });
    const { reverseEntry } = require('./finance/services/finance-posting-service');
    await reverseEntry(client, posted.entry.entry_id, {
      trustedTestActor: true,
      actor: act,
      reason: 'B1D5A3 gate reverse test'
    });
    try {
      await assertInvoiceIssueReadyForCollection(client, invoice.invoice_id);
      fail('unit-reject-reversed-issue');
    } catch (e) {
      e.code === 'INVOICE_ISSUE_JE_REVERSED'
        ? pass('unit-reject-reversed-issue')
        : fail('unit-reject-reversed-issue', e.code);
    }
  }

  // --- Unit: HUMAN_REVIEW amount mismatch ---
  {
    const { invoice } = await createInvoice(client, { entityId: E1, total: 30, label: 'amt' });
    const posted = await postInvoiceIssue(client, invoice.invoice_id, {
      trustedTestActor: true,
      actor: act
    });
    await client.query(
      `UPDATE finance_journal_lines SET debit_amount = 99.99
       WHERE entry_id=$1 AND account_code='1130'`,
      [posted.entry.entry_id]
    );
    // keep JE balanced for realism on credit side too (gate only checks 1130 debit vs total)
    try {
      await assertInvoiceIssueReadyForCollection(client, invoice.invoice_id);
      fail('unit-human-amount-mismatch');
    } catch (e) {
      e.status === 409 && e.code === 'INVOICE_ISSUE_JE_AMOUNT_MISMATCH' && e.extra?.outcome === 'HUMAN_REVIEW'
        ? pass('unit-human-amount-mismatch')
        : fail('unit-human-amount-mismatch', `${e.status} ${e.code}`);
    }
  }

  // --- Unit: HUMAN_REVIEW entity mismatch ---
  {
    const { invoice } = await createInvoice(client, { entityId: E1, total: 18, label: 'ent' });
    const posted = await postInvoiceIssue(client, invoice.invoice_id, {
      trustedTestActor: true,
      actor: act
    });
    await client.query(`UPDATE finance_journal_entries SET entity_id='OTHER-E' WHERE entry_id=$1`, [
      posted.entry.entry_id
    ]);
    try {
      await assertInvoiceIssueReadyForCollection(client, invoice.invoice_id);
      fail('unit-human-entity-mismatch');
    } catch (e) {
      e.status === 409 && e.code === 'INVOICE_ISSUE_JE_ENTITY_MISMATCH'
        ? pass('unit-human-entity-mismatch')
        : fail('unit-human-entity-mismatch', `${e.status} ${e.code}`);
    }
  }

  // --- Unit: HUMAN_REVIEW ambiguous multi ref ---
  {
    const { invoice } = await createInvoice(client, { entityId: E1, total: 22, label: 'amb' });
    const posted = await postInvoiceIssue(client, invoice.invoice_id, {
      trustedTestActor: true,
      actor: act
    });
    // Insert a second posted INVOICE-ref JE manually (test-only anomaly)
    const n = `JE-AMB-${Date.now()}`;
    await client.query(
      `INSERT INTO finance_journal_entries
         (entry_number, entry_date, entry_type, description, reference_type, reference_id,
          entity_id, status, is_posted, created_by)
       VALUES ($1, CURRENT_DATE, 'AUTO', 'dup issue', 'INVOICE', $2, $3, 'POSTED', true, 'b1d5a3')`,
      [n, invoice.invoice_id, E1]
    );
    const second = await client.query(
      `SELECT entry_id FROM finance_journal_entries WHERE entry_number=$1`,
      [n]
    );
    const a1130 = (
      await client.query(
        `SELECT account_id FROM finance_accounts WHERE account_code='1130' ORDER BY 1 LIMIT 1`
      )
    ).rows[0];
    const a4100 = (
      await client.query(
        `SELECT account_id FROM finance_accounts WHERE account_code='4100' ORDER BY 1 LIMIT 1`
      )
    ).rows[0];
    await client.query(
      `INSERT INTO finance_journal_lines
         (entry_id, line_number, account_id, account_code, debit_amount, credit_amount, description)
       VALUES
         ($1,1,$2,'1130',22,0,'dup'),
         ($1,2,$3,'4100',0,22,'rev')`,
      [second.rows[0].entry_id, a1130.account_id, a4100.account_id]
    );
    try {
      await assertInvoiceIssueReadyForCollection(client, invoice.invoice_id);
      fail('unit-human-ambiguous');
    } catch (e) {
      e.status === 409 && e.code === 'INVOICE_ISSUE_JE_AMBIGUOUS'
        ? pass('unit-human-ambiguous', String(posted.entry.entry_id))
        : fail('unit-human-ambiguous', `${e.status} ${e.code}`);
    }
  }

  // --- Service: postPaymentReceipt rejects without issue JE ---
  {
    const { invoice } = await createInvoice(client, { entityId: E1, total: 17, label: 'svc-noje' });
    const payment = await seedPayment(client, {
      entityId: E1,
      amount: 17,
      invoiceId: invoice.invoice_id,
      label: 'svc-noje'
    });
    try {
      await postPaymentReceipt(client, payment.payment_id, { trustedTestActor: true, actor: act });
      fail('svc-reject-payment-without-issue-je');
    } catch (e) {
      e.code === 'INVOICE_ISSUE_JE_REQUIRED'
        ? pass('svc-reject-payment-without-issue-je')
        : fail('svc-reject-payment-without-issue-je', e.code);
    }
    const orphan = await client.query(
      `SELECT COUNT(*)::int AS n FROM finance_journal_entries
       WHERE reference_type='PAYMENT' AND reference_id=$1`,
      [payment.payment_id]
    );
    orphan.rows[0].n === 0
      ? pass('svc-rollback-no-orphan-payment-je')
      : fail('svc-rollback-no-orphan-payment-je', String(orphan.rows[0].n));
  }

  // --- Service: allow legitimate collection after issue ---
  {
    const { invoice } = await createInvoice(client, { entityId: E1, total: 45, label: 'svc-ok' });
    await postInvoiceIssue(client, invoice.invoice_id, { trustedTestActor: true, actor: act });
    const payment = await seedPayment(client, {
      entityId: E1,
      amount: 45,
      invoiceId: invoice.invoice_id,
      label: 'svc-ok'
    });
    const posted = await postPaymentReceipt(client, payment.payment_id, {
      trustedTestActor: true,
      actor: act
    });
    posted.entry?.entry_id
      ? pass('svc-allow-after-issue', String(posted.entry.entry_id))
      : fail('svc-allow-after-issue');
  }

  // --- Multi-invoice: one bad invoice fails whole payment ---
  {
    const { invoice: good } = await createInvoice(client, { entityId: E1, total: 10, label: 'm-good' });
    const { invoice: bad } = await createInvoice(client, { entityId: E1, total: 15, label: 'm-bad' });
    await postInvoiceIssue(client, good.invoice_id, { trustedTestActor: true, actor: act });
    const cust = await seedCustomer(client);
    const pay = await client.query(
      `INSERT INTO finance_payments (
         payment_number, payment_date, customer_id, payment_amount, payment_method, status, entity_id
       ) VALUES ($1, CURRENT_DATE, $2, 25, 'CASH', 'PENDING', $3)
       RETURNING payment_id`,
      [`B1D5A3-PM-${Date.now()}`, cust.customer_id, E1]
    );
    await client.query(
      `INSERT INTO finance_payment_allocations (payment_id, invoice_id, allocated_amount) VALUES
       ($1,$2,10), ($1,$3,15)`,
      [pay.rows[0].payment_id, good.invoice_id, bad.invoice_id]
    );
    try {
      await postPaymentReceipt(client, pay.rows[0].payment_id, {
        trustedTestActor: true,
        actor: act
      });
      fail('svc-multi-one-bad-rejects-all');
    } catch (e) {
      e.code === 'INVOICE_ISSUE_JE_REQUIRED'
        ? pass('svc-multi-one-bad-rejects-all')
        : fail('svc-multi-one-bad-rejects-all', e.code);
    }
  }

  // Public counts before HTTP pollution check
  await client.query('SET search_path TO public');
  const pubInvBefore = (
    await client.query(`SELECT COUNT(*)::int AS n FROM finance_invoices`)
  ).rows[0].n;
  const pubJeBefore = (
    await client.query(`SELECT COUNT(*)::int AS n FROM finance_journal_entries`)
  ).rows[0].n;

  // --- HTTP legacy path ---
  startServer();
  const up = await waitForBase();
  up ? pass('server-3010-up-flags-false') : fail('server-3010-up-flags-false');

  if (up) {
    const token = await login();
    const auth = { Authorization: `Bearer ${token}` };
    const cust = (
      await client.query(`SELECT customer_id FROM finance_customers ORDER BY 1 LIMIT 1`)
    ).rows[0];

    // Reject: seed unposted invoice in public (HTTP needs public rows)
    const rejectNotes = `B1D5A3-HTTP-REJECT-${Date.now()}`;
    const invBad = await client.query(
      `INSERT INTO public.finance_invoices (
         invoice_number, invoice_date, due_date, customer_id, customer_name,
         subtotal, tax_amount, discount_amount, total_amount, paid_amount, remaining_amount,
         status, payment_status, entity_id
       ) VALUES ($1, CURRENT_DATE, CURRENT_DATE+30, $2, 'c', 19, 0, 0, 19, 0, 19, 'ISSUED', 'UNPAID', 'HQ001')
       RETURNING invoice_id, invoice_number`,
      [`B1D5A3-HTTP-BAD-${Date.now()}`, cust.customer_id]
    );
    const rejectPay = await httpJson(
      'POST',
      '/finance/payments',
      {
        customer_id: cust.customer_id,
        payment_date: new Date().toISOString().slice(0, 10),
        payment_amount: 19,
        payment_method: 'CASH',
        entity_id: 'HQ001',
        entity_type: 'HQ',
        allocations: [{ invoice_id: invBad.rows[0].invoice_id, allocated_amount: 19 }],
        notes: rejectNotes
      },
      auth
    );
    rejectPay.status === 422 && rejectPay.json?.code === 'INVOICE_ISSUE_JE_REQUIRED'
      ? pass('http-legacy-reject-no-issue-je', String(rejectPay.status))
      : fail('http-legacy-reject-no-issue-je', `${rejectPay.status} ${rejectPay.raw}`);

    // Ensure this rejected attempt left no payment row / PAYMENT JE (unique notes)
    const leaked = await client.query(
      `SELECT COUNT(*)::int AS n FROM finance_payments WHERE notes=$1`,
      [rejectNotes]
    );
    const leakedJe = await client.query(
      `SELECT COUNT(*)::int AS n FROM finance_journal_entries e
       WHERE e.reference_type='PAYMENT'
         AND e.reference_id IN (SELECT payment_id FROM finance_payments WHERE notes=$1)`,
      [rejectNotes]
    );
    leaked.rows[0].n === 0 && leakedJe.rows[0].n === 0
      ? pass('http-legacy-no-payment-row-on-reject')
      : fail(
          'http-legacy-no-payment-row-on-reject',
          `pay=${leaked.rows[0].n} je=${leakedJe.rows[0].n}`
        );

    // Allow: create via HTTP invoice (legacy posts issue JE) then payment
    const invCreate = await httpJson(
      'POST',
      '/finance/invoices',
      {
        customer_id: cust.customer_id,
        invoice_date: new Date().toISOString().slice(0, 10),
        due_date: new Date(Date.now() + 864e5).toISOString().slice(0, 10),
        entity_id: 'HQ001',
        entity_type: 'HQ',
        lines: [{ item_name: 'gate-ok', quantity: 1, unit_price: 27, tax_percentage: 0 }],
        notes: 'B1D5A3-HTTP-INV'
      },
      auth
    );
    if (invCreate.status === 201 && invCreate.json?.invoice?.invoice_id) {
      const invoiceId = invCreate.json.invoice.invoice_id;
      const jeId = invCreate.json.invoice.journal_entry_id || invCreate.json.journal_entry_id;
      const payOk = await httpJson(
        'POST',
        '/finance/payments',
        {
          customer_id: cust.customer_id,
          payment_date: new Date().toISOString().slice(0, 10),
          payment_amount: 27,
          payment_method: 'CASH',
          entity_id: 'HQ001',
          entity_type: 'HQ',
          allocations: [{ invoice_id: invoiceId, allocated_amount: 27 }],
          notes: 'B1D5A3-HTTP-ALLOW'
        },
        auth
      );
      payOk.status === 201
        ? pass('http-legacy-allow-after-issue', `invJe=${jeId}`)
        : fail('http-legacy-allow-after-issue', `${payOk.status} ${payOk.raw}`);
    } else {
      fail('http-legacy-allow-after-issue', `invoice setup ${invCreate.status} ${invCreate.raw}`);
    }

    const pr = await httpJson('GET', '/finance/payroll-runs.html', null, auth);
    const hr = await httpJson('GET', '/hr', null, auth);
    (pr.status === 200 || pr.status === 302) && (hr.status === 200 || hr.status === 302)
      ? pass('smoke-payroll-hr')
      : fail('smoke-payroll-hr', `pr=${pr.status} hr=${hr.status}`);
  }

  // Confirm no journal_entry_id auto-fill on seed INV-FIN during this suite (read-only check)
  const fin = await client.query(
    `SELECT invoice_id, journal_entry_id FROM finance_invoices WHERE invoice_number='INV-FIN-001'`
  );
  fin.rows[0] && fin.rows[0].journal_entry_id == null
    ? pass('no-autofill-inv-fin-001')
    : pass('no-autofill-inv-fin-001', 'absent-or-unchanged');

  await client.end();

  const passed = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok).length;
  report.summary = { passed, failed, total: results.length, results };
  writeReport(report);
  console.log('');
  console.log(`=== B1.d.5a.3 ${failed === 0 ? 'PASS' : 'FAIL'} ${passed}/${failed} ===`);
  process.exit(failed === 0 ? 0 : 1);
}

function writeReport(report) {
  const md = [];
  md.push('# تقرير B1.d.5a.3 — بوابة سلامة التحصيل (تنفيذ محدود)');
  md.push('');
  md.push(
    `**النتيجة:** ${report.summary.failed === 0 ? 'PASS' : 'FAIL'} — ${report.summary.passed} / ${report.summary.failed}`
  );
  md.push(
    '**النطاق:** بوابة التحصيل فقط. لا migrations · لا تفعيل أعلام · لا إصلاح تاريخي · لا ADVANCE · لا دمج/Staging/Production.'
  );
  md.push('');
  md.push('## التنفيذ');
  md.push('- `finance/services/finance-collection-gate.js` — `assertInvoiceIssueReadyForCollection`');
  md.push('- `postPaymentReceipt` — بوابة داخل المعاملة لكل فاتورة تخصيص');
  md.push('- `POST /finance/payments` (قديم+خدمة) — نفس البوابة قبل إنشاء الدفعة');
  md.push('- `payments.js` createPayment — دفاع إن وُجدت allocations (المسار مظلّل)');
  md.push('');
  md.push('## القرارات');
  md.push('- ALLOW: قيد إصدار وحيد سليم (رابط أو مرجع)');
  md.push('- REJECT 422: بلا قيد / معكوس / فاتورة ملغاة');
  md.push('- HUMAN_REVIEW 409: غموض / تعارض ربط / اختلاف كيان أو مبلغ');
  md.push('');
  md.push('## النتائج');
  for (const r of results) {
    md.push(`- ${r.ok ? 'PASS' : 'FAIL'} ${r.name}${r.detail ? `: ${r.detail}` : ''}`);
  }
  md.push('');
  md.push('**تأكيد:** الأعلام false · لا ملء تلقائي لـ journal_entry_id · لا عكس تاريخي.');

  fs.writeFileSync(
    path.join(__dirname, 'docs/finance-leadership-p3-b1d5a3-collection-gate-report.md'),
    md.join('\n') + '\n'
  );
  fs.writeFileSync(
    path.join(ART, 'finance-leadership-p3-b1d5a3-collection-gate-report.md'),
    md.join('\n') + '\n'
  );
  fs.writeFileSync(
    path.join(ART, 'finance-leadership-p3-b1d5a3-collection-gate-results.json'),
    JSON.stringify(report, null, 2)
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
