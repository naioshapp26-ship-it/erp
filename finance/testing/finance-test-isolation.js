'use strict';

/**
 * Finance P3 test isolation helpers.
 * Prefer DATABASE_URL_FINANCE_TEST (finance_test_writer) for service/unit suites.
 * Never INSERT/UPDATE/DELETE public.finance_* from harnesses.
 */

const { Client } = require('pg');

const PUBLIC_CORE_TABLES = [
  'finance_invoices',
  'finance_invoice_lines',
  'finance_payments',
  'finance_payment_allocations',
  'finance_journal_entries',
  'finance_journal_lines'
];

function resolveTestDatabaseUrl() {
  return (
    process.env.DATABASE_URL_FINANCE_TEST ||
    process.env.FINANCE_TEST_DATABASE_URL ||
    null
  );
}

function resolveAppDatabaseUrl() {
  return (
    process.env.DATABASE_URL ||
    'postgresql://vendowor_erp_user:vendowor_local_dev@127.0.0.1:5432/vendowor_erp'
  );
}

function createFinanceTestClient(overrides = {}) {
  const url = resolveTestDatabaseUrl() || resolveAppDatabaseUrl();
  return new Client({
    connectionString: url,
    ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false,
    ...overrides
  });
}

async function setB1aSearchPath(client) {
  await client.query('SET search_path TO b1a_test, public');
  const r = await client.query('SELECT current_schema() AS s');
  if (r.rows[0].s !== 'b1a_test') {
    throw new Error(`expected current_schema=b1a_test got ${r.rows[0].s}`);
  }
  return r.rows[0].s;
}

async function snapshotPublicCore(client) {
  const out = {};
  for (const t of PUBLIC_CORE_TABLES) {
    const r = await client.query(
      `SELECT COUNT(*)::bigint AS n,
              COALESCE(MAX(ctid::text), '') AS max_ctid
       FROM public.${t}`
    );
    out[t] = { n: String(r.rows[0].n), max_ctid: r.rows[0].max_ctid };
  }
  return out;
}

function assertPublicUntouched(before, after) {
  const deltas = [];
  for (const t of PUBLIC_CORE_TABLES) {
    if (!before[t] || !after[t]) {
      deltas.push({ table: t, error: 'missing snapshot' });
      continue;
    }
    if (before[t].n !== after[t].n) {
      deltas.push({
        table: t,
        before: before[t].n,
        after: after[t].n,
        kind: 'count'
      });
    }
  }
  if (deltas.length) {
    const err = new Error('public finance core tables changed during isolated test');
    err.deltas = deltas;
    throw err;
  }
  return true;
}

/**
 * Prove DB-level write deny on public (requires finance_test_writer connection).
 */
async function assertPublicWriteDenied(client) {
  try {
    await client.query(
      `INSERT INTO public.finance_invoices (
         invoice_number, invoice_date, due_date, customer_id, customer_name,
         subtotal, tax_amount, discount_amount, total_amount, paid_amount, remaining_amount,
         status, payment_status, entity_id
       ) VALUES (
         'ISOLATION-DENY-' || floor(random()*1e9)::text, CURRENT_DATE, CURRENT_DATE+30,
         1, 'deny', 1, 0, 0, 1, 0, 1, 'ISSUED', 'UNPAID', 'HQ001'
       )`
    );
    return { ok: false, reason: 'INSERT succeeded — role still has public write' };
  } catch (e) {
    const msg = String(e.message || e);
    if (/permission denied/i.test(msg)) {
      return { ok: true, reason: msg };
    }
    return { ok: false, reason: msg };
  }
}

module.exports = {
  PUBLIC_CORE_TABLES,
  resolveTestDatabaseUrl,
  resolveAppDatabaseUrl,
  createFinanceTestClient,
  setB1aSearchPath,
  snapshotPublicCore,
  assertPublicUntouched,
  assertPublicWriteDenied
};
