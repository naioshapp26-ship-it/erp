'use strict';

/**
 * P3 / B1.d.5a.2 — Collection safety-gate + test isolation + UNIQUE design review (READ-ONLY).
 * No service/route/test edits. No migrations. No data mutation. No flag enablement. No B1.d.5b.
 */
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const ART = '/opt/cursor/artifacts';
fs.mkdirSync(ART, { recursive: true });
const DB_URL =
  process.env.DATABASE_URL ||
  'postgresql://vendowor_erp_user:vendowor_local_dev@127.0.0.1:5432/vendowor_erp';

const results = [];
function pass(name, detail = '') {
  results.push({ name, ok: true, detail });
  console.log(`PASS  ${name}${detail ? ` — ${detail}` : ''}`);
}
function fail(name, detail = '') {
  results.push({ name, ok: false, detail });
  console.log(`FAIL  ${name}${detail ? ` — ${detail}` : ''}`);
}

function truthy(v) {
  return v === true || v === 't' || v === 'true' || v === 1 || v === '1';
}

function classifyBucket(row) {
  const num = String(row.invoice_number || '');
  const active = Number(row.active_issue_je_count) || 0;
  if (num.startsWith('INV-FIN-')) return 'SEED_INV_FIN';
  if (/^B1D(3D|3E|4)-/.test(num)) {
    if (truthy(row.has_posted_payment_alloc)) return 'TEST_C3_OR_COLLECTED';
    return 'TEST_C2_UNPOSTED';
  }
  if (active === 1 && truthy(row.amount_ok) && truthy(row.entity_ok) && !truthy(row.issue_reversed)) {
    return 'HEALTHY_POSTED_ISSUE';
  }
  if (active === 0) return 'HIST_OR_OTHER_NO_ISSUE_JE';
  return 'ANOMALY_NEEDS_HUMAN';
}

/** Simulated gate outcome — design only, no writes */
function gateDecision(row) {
  const active = Number(row.active_issue_je_count) || 0;
  if (row.invoice_status && ['CANCELLED', 'DRAFT', 'VOID'].includes(String(row.invoice_status).toUpperCase())) {
    return {
      outcome: 'REJECT',
      code: 'INVOICE_NOT_COLLECTABLE',
      reason: 'فاتورة ملغاة/مسودة/باطلة'
    };
  }
  if (active === 0) {
    return {
      outcome: 'REJECT',
      code: 'INVOICE_ISSUE_JE_REQUIRED',
      reason: 'لا يوجد قيد إصدار مرحّل نشط (رابط مباشر أو reference INVOICE)'
    };
  }
  if (active > 1) {
    return {
      outcome: 'HUMAN_REVIEW',
      code: 'INVOICE_ISSUE_JE_AMBIGUOUS',
      reason: 'أكثر من قيد إصدار مرشّح نشط لنفس الفاتورة'
    };
  }
  if (truthy(row.issue_reversed)) {
    return {
      outcome: 'REJECT',
      code: 'INVOICE_ISSUE_JE_REVERSED',
      reason: 'قيد الإصدار معكوس بـ JOURNAL_REVERSAL مرحّل'
    };
  }
  if (!truthy(row.entity_ok)) {
    return {
      outcome: 'REJECT',
      code: 'INVOICE_ISSUE_JE_ENTITY_MISMATCH',
      reason: 'كيان القيد ≠ كيان الفاتورة'
    };
  }
  if (!truthy(row.amount_ok)) {
    return {
      outcome: 'HUMAN_REVIEW',
      code: 'INVOICE_ISSUE_JE_AMOUNT_MISMATCH',
      reason: 'مجموع مدين 1130 للقيد لا يطابق total_amount ضمن ±0.05'
    };
  }
  if (truthy(row.link_vs_ref_conflict)) {
    return {
      outcome: 'HUMAN_REVIEW',
      code: 'INVOICE_ISSUE_JE_LINK_CONFLICT',
      reason: 'journal_entry_id يشير لقيد مختلف عن مرجع INVOICE الوحيد'
    };
  }
  return {
    outcome: 'ALLOW',
    code: 'INVOICE_ISSUE_JE_OK',
    reason: 'قيد إصدار وحيد مرحّل غير معكوس، كيان متوافق، مبلغ 1130 متوافق'
  };
}

async function main() {
  delete process.env.FINANCE_POST_INVOICE_VIA_SERVICE;
  delete process.env.FINANCE_POST_PAYMENT_VIA_SERVICE;

  const client = new Client({ connectionString: DB_URL });
  await client.connect();
  await client.query('SET default_transaction_read_only = on');
  await client.query('SET search_path TO public');

  const report = {
    phase: 'B1.d.5a.2-gate-isolation-design',
    scope:
      'design/analysis only — no code changes, no migrations, no data repair, flags stay false, no B1.d.5b',
    gateDesign: {},
    acceptRejectMatrix: [],
    applicationPoints: [],
    historicalCompatibility: {},
    isolationDesign: {},
    uniqueReview: {},
    phasedApprovals: [],
    liveSimulation: {},
    mutationsExecuted: false
  };

  // --- Live simulation inputs ---
  const sim = await client.query(`
    WITH issue_candidates AS (
      SELECT e.entry_id, e.reference_id AS invoice_id, e.entity_id AS je_entity,
             e.is_posted, e.status, e.entry_type, e.reference_type,
             COALESCE((
               SELECT SUM(l.debit_amount)::float FROM finance_journal_lines l
               WHERE l.entry_id=e.entry_id AND l.account_code='1130'
             ),0) AS dr_1130,
             EXISTS (
               SELECT 1 FROM finance_journal_entries r
               WHERE r.reference_type='JOURNAL_REVERSAL'
                 AND r.reference_id=e.entry_id
                 AND r.is_posted=true
                 AND COALESCE(r.status,'') IN ('POSTED','')
             ) AS reversed
      FROM finance_journal_entries e
      WHERE e.reference_type='INVOICE'
        AND e.reference_id IS NOT NULL
        AND e.is_posted=true
        AND UPPER(COALESCE(e.status,''))='POSTED'
        AND COALESCE(e.entry_type,'') <> 'REVERSAL'
        AND COALESCE(e.reference_type,'') <> 'JOURNAL_REVERSAL'
    ),
    per_inv AS (
      SELECT i.invoice_id, i.invoice_number, i.entity_id, i.status AS invoice_status,
             i.total_amount::float AS total_amount,
             i.paid_amount::float AS paid_amount,
             i.journal_entry_id,
             COALESCE((SELECT COUNT(*) FROM issue_candidates c WHERE c.invoice_id=i.invoice_id AND NOT c.reversed),0) AS active_issue_je_count,
             COALESCE((SELECT COUNT(*) FROM issue_candidates c WHERE c.invoice_id=i.invoice_id AND c.reversed),0) AS reversed_issue_je_count,
             (SELECT c.entry_id FROM issue_candidates c WHERE c.invoice_id=i.invoice_id AND NOT c.reversed ORDER BY c.entry_id LIMIT 1) AS sole_active_entry_id,
             (SELECT c.dr_1130 FROM issue_candidates c WHERE c.invoice_id=i.invoice_id AND NOT c.reversed ORDER BY c.entry_id LIMIT 1) AS sole_dr_1130,
             (SELECT c.je_entity FROM issue_candidates c WHERE c.invoice_id=i.invoice_id AND NOT c.reversed ORDER BY c.entry_id LIMIT 1) AS sole_je_entity,
             (SELECT c.reversed FROM issue_candidates c WHERE c.invoice_id=i.invoice_id ORDER BY c.entry_id LIMIT 1) AS first_reversed_flag,
             EXISTS (
               SELECT 1 FROM finance_payment_allocations a
               JOIN finance_payments p ON p.payment_id=a.payment_id
               WHERE a.invoice_id=i.invoice_id AND p.journal_entry_id IS NOT NULL
             ) AS has_posted_payment_alloc
      FROM finance_invoices i
    )
    SELECT *,
      CASE
        WHEN active_issue_je_count=1 AND journal_entry_id IS NOT NULL
             AND journal_entry_id IS DISTINCT FROM sole_active_entry_id THEN true
        ELSE false
      END AS link_vs_ref_conflict,
      CASE
        WHEN active_issue_je_count<>1 THEN false
        WHEN ABS(COALESCE(sole_dr_1130,0) - total_amount) <= 0.05 THEN true
        ELSE false
      END AS amount_ok,
      CASE
        WHEN active_issue_je_count<>1 THEN false
        WHEN COALESCE(entity_id,'') = COALESCE(sole_je_entity,'') THEN true
        ELSE false
      END AS entity_ok,
      CASE WHEN reversed_issue_je_count>0 AND active_issue_je_count=0 THEN true
           WHEN first_reversed_flag AND active_issue_je_count=0 THEN true
           ELSE false
      END AS issue_reversed
    FROM per_inv
    ORDER BY invoice_id`);

  const decisions = { ALLOW: 0, REJECT: 0, HUMAN_REVIEW: 0 };
  const byBucket = {};
  const byCode = {};
  const samples = { ALLOW: [], REJECT: [], HUMAN_REVIEW: [] };

  for (const row of sim.rows) {
    const bucket = classifyBucket(row);
    const gate = gateDecision(row);
    decisions[gate.outcome] += 1;
    byBucket[bucket] = byBucket[bucket] || { ALLOW: 0, REJECT: 0, HUMAN_REVIEW: 0, n: 0 };
    byBucket[bucket][gate.outcome] += 1;
    byBucket[bucket].n += 1;
    byCode[gate.code] = (byCode[gate.code] || 0) + 1;
    if (samples[gate.outcome].length < 5) {
      samples[gate.outcome].push({
        invoice_id: row.invoice_id,
        invoice_number: row.invoice_number,
        bucket,
        code: gate.code,
        journal_entry_id: row.journal_entry_id,
        active_issue_je_count: row.active_issue_je_count
      });
    }
  }

  report.liveSimulation = {
    invoice_total: sim.rows.length,
    decisions,
    byBucket,
    byCode,
    samples,
    note: 'Simulation only — gate not installed; existing posted payments untouched'
  };
  pass('live-gate-simulation', JSON.stringify(decisions));

  // --- Gate design ---
  report.gateDesign = {
    name: 'assertInvoiceIssueReadyForCollection',
    principle:
      'Do not trust journal_entry_id alone. Resolve active issue JE via direct link ∪ reference_type=INVOICE/reference_id, then validate posted/unreversed/entity/amount/uniqueness.',
    resolution_algorithm: [
      'BEGIN / caller txn already open',
      'SELECT invoice FOR UPDATE',
      'pg_advisory_xact_lock(invoice_ns, invoice_id) — same family as postInvoiceIssue (11011)',
      'Load candidates: (A) entry pointed by invoice.journal_entry_id if set; (B) all JE where reference_type=INVOICE AND reference_id=invoice_id',
      'Lock candidate entry rows FOR UPDATE',
      'Filter ACTIVE ISSUE: is_posted=true AND status=POSTED AND entry_type≠REVERSAL AND reference_type≠JOURNAL_REVERSAL AND NOT EXISTS posted JOURNAL_REVERSAL referencing entry_id',
      'If journal_entry_id set but that entry fails ACTIVE filter while another ACTIVE ref exists → HUMAN_REVIEW (link/ref conflict)',
      'Apply accept/reject matrix',
      'On ALLOW continue allocation remaining checks; on REJECT/HUMAN abort payment posting txn'
    ],
    amount_rule:
      'roundMoney(|Σ debit 1130 on issue JE − invoice.total_amount|) ≤ 0.05; do not use credit 1130; do not use payment JE',
    entity_rule:
      'COALESCE(invoice.entity_id,\'\') must equal COALESCE(je.entity_id,\'\'); both empty allowed only if both empty (current data has some empty pairs)',
    multi_invoice_payment:
      'Evaluate gate independently for EVERY allocated invoice_id; first failure fails entire payment txn (no partial collection JE)',
    no_blanket_bypass:
      'No allowlist for INV-FIN-*, B1D*, or unpaid historical. Repair data or leave uncollectable until repaired under separate approval.',
    suggested_error_shape: {
      status: '422 or 409',
      codes: [
        'INVOICE_ISSUE_JE_REQUIRED',
        'INVOICE_ISSUE_JE_REVERSED',
        'INVOICE_ISSUE_JE_ENTITY_MISMATCH',
        'INVOICE_ISSUE_JE_AMBIGUOUS',
        'INVOICE_ISSUE_JE_AMOUNT_MISMATCH',
        'INVOICE_ISSUE_JE_LINK_CONFLICT',
        'INVOICE_NOT_COLLECTABLE'
      ]
    }
  };

  report.acceptRejectMatrix = [
    {
      state: 'قيد إصدار وحيد مرحّل، غير معكوس، كيان متوافق، مبلغ 1130 ≈ total',
      outcome: 'ALLOW',
      code: 'INVOICE_ISSUE_JE_OK'
    },
    {
      state: 'journal_entry_id فارغ لكن يوجد مرجع INVOICE وحيد ACTIVE يستوفي الشروط',
      outcome: 'ALLOW',
      code: 'INVOICE_ISSUE_JE_OK',
      note: 'يُسمح بالتحصيل؛ إصلاح الربط المباشر قرار بيانات منفصل — ليس شرطًا للرفض'
    },
    {
      state: 'لا قيد إصدار ACTIVE (رابط أو مرجع)',
      outcome: 'REJECT',
      code: 'INVOICE_ISSUE_JE_REQUIRED',
      applies_to: 'INV-FIN-* · C2 · C3 · أي تاريخي غير مرحّل'
    },
    {
      state: 'قيد الإصدار معكوس (JOURNAL_REVERSAL مرحّل على entry_id)',
      outcome: 'REJECT',
      code: 'INVOICE_ISSUE_JE_REVERSED'
    },
    {
      state: 'أكثر من قيد ACTIVE لنفس الفاتورة',
      outcome: 'HUMAN_REVIEW',
      code: 'INVOICE_ISSUE_JE_AMBIGUOUS'
    },
    {
      state: 'اختلاف كيان القيد عن الفاتورة',
      outcome: 'REJECT',
      code: 'INVOICE_ISSUE_JE_ENTITY_MISMATCH'
    },
    {
      state: 'اختلاف مبلغ 1130 عن total_amount',
      outcome: 'HUMAN_REVIEW',
      code: 'INVOICE_ISSUE_JE_AMOUNT_MISMATCH'
    },
    {
      state: 'journal_entry_id يشير لقيد غير ACTIVE بينما يوجد مرجع آخر ACTIVE (أو العكس متعارض)',
      outcome: 'HUMAN_REVIEW',
      code: 'INVOICE_ISSUE_JE_LINK_CONFLICT'
    },
    {
      state: 'فاتورة DRAFT/CANCELLED/VOID',
      outcome: 'REJECT',
      code: 'INVOICE_NOT_COLLECTABLE'
    },
    {
      state: 'تحصيلات سابقة موجودة على فاتورة بدون قيد إصدار (C3)',
      outcome: 'REJECT for NEW collection',
      code: 'INVOICE_ISSUE_JE_REQUIRED',
      note: 'لا عكس تلقائي للقديم؛ التحصيل الجديد ممنوع حتى إصلاح منفصل'
    }
  ];
  pass('accept-reject-matrix-documented', String(report.acceptRejectMatrix.length));

  // --- Application points ---
  const serverSrc = fs.readFileSync(path.join(__dirname, 'server.js'), 'utf8');
  const routesSrc = fs.readFileSync(path.join(__dirname, 'finance/api/finance-routes.js'), 'utf8');
  const paymentsSrc = fs.readFileSync(path.join(__dirname, 'finance/api/payments.js'), 'utf8');
  const serviceSrc = fs.readFileSync(
    path.join(__dirname, 'finance/services/finance-posting-service.js'),
    'utf8'
  );

  report.applicationPoints = [
    {
      id: 'AP1',
      path: 'finance/services/finance-posting-service.js → postPaymentReceipt',
      why: 'Single choke for service path and any future callers; already FOR UPDATE invoices inside txn',
      required: true,
      placement:
        'After loading each allocated invoice FOR UPDATE and entity checks; before OVER_ALLOCATION updates / JE insert',
      bypass_risk_if_skipped: 'CRITICAL'
    },
    {
      id: 'AP2',
      path: 'finance/api/finance-routes.js → POST /payments legacy else-branch',
      why: 'Default flags false → live HTTP uses legacy inline JE; must call same helper, not duplicate logic',
      required: true,
      placement: 'Inside allocation loop before paid_amount update / before PAYMENT JE insert',
      bypass_risk_if_skipped: 'CRITICAL — current production-default path'
    },
    {
      id: 'AP3',
      path: 'finance/api/finance-routes.js → POST /payments service branch',
      why: 'Calls postPaymentReceipt — covered if AP1 done; still verify no pre-balance mutations before service',
      required: true,
      placement: 'Rely on AP1; do not add a weaker early check that can be skipped',
      bypass_risk_if_skipped: 'HIGH if AP1 missing'
    },
    {
      id: 'AP4',
      path: 'finance/api/payments.js → createPayment (server.js registers AFTER financeRoutes)',
      why:
        'Currently shadowed for POST by finance-routes mount order, and createPayment inserts payment WITHOUT JE/alloc. Defense-in-depth: if un-shadowed or reused, must not become a silent collection path',
      required: true,
      placement:
        'Either keep non-posting (document) or refuse allocations/JE creation unless AP1 helper used',
      observed:
        /app\.use\('\/finance',\s*financeRoutes\)/.test(serverSrc) &&
        /app\.post\('\/finance\/payments',\s*paymentsAPI\.createPayment\)/.test(serverSrc)
          ? 'financeRoutes mounted before paymentsAPI POST — finance-routes handles live POST today'
          : 'mount order unexpected — re-verify',
      bypass_risk_if_skipped: 'MEDIUM now / CRITICAL if mount order changes'
    },
    {
      id: 'AP5',
      path: 'Multi-invoice allocations on one payment',
      why: 'One bad invoice must fail whole txn',
      required: true,
      placement: 'AP1/AP2 per invoice_id before any JE lines written',
      bypass_risk_if_skipped: 'HIGH — partial AR hole'
    },
    {
      id: 'AP6',
      path: 'Direct SQL / scripts / future helpers calling postPaymentReceipt',
      why: 'Centralizing in AP1 covers trustedTestActor and production callers',
      required: true,
      placement: 'AP1 only — do not add HTTP-only gate',
      bypass_risk_if_skipped: 'HIGH'
    }
  ];

  /postPaymentReceipt/.test(serviceSrc) && /router\.post\('\/payments'/.test(routesSrc)
    ? pass('application-points-sources-present')
    : fail('application-points-sources-present');
  /INSERT INTO finance_payments/.test(paymentsSrc)
    ? pass('payments-js-create-still-present-shadowed')
    : fail('payments-js-create-still-present-shadowed');

  // --- Historical compatibility ---
  report.historicalCompatibility = {
    principle: 'No general bypass. Gate applies to NEW collections only; does not rewrite history.',
    cohorts: [
      {
        cohort: 'فواتير ب قيد إصدار صحيح وjournal_entry_id مملوء',
        gate: 'ALLOW if validations pass',
        live: byBucket.HEALTHY_POSTED_ISSUE || null
      },
      {
        cohort: 'قيد إصدار عبر reference فقط وjournal_entry_id فارغ',
        gate: 'ALLOW if sole ACTIVE ref OK (current DB: 0 such rows)',
        live_null_link_one_ref: 0,
        note: 'Optional later repair to backfill journal_entry_id — separate approval'
      },
      {
        cohort: 'بذور INV-FIN-*',
        gate: 'REJECT INVOICE_ISSUE_JE_REQUIRED on new collection',
        policy: 'D1 keep seeds; they remain display-only / uncollectable under gate'
      },
      {
        cohort: 'اختبارات C2 غير مرحّلة',
        gate: 'REJECT — prevents new C3',
        policy: 'D2 leave in public; isolation plan stops growth'
      },
      {
        cohort: 'اختبارات C3 (تحصيل سابق بلا قيد إصدار)',
        gate: 'REJECT further collection; existing PAYMENT JEs untouched',
        policy: 'No auto-reverse; repair list R3 remains separate'
      },
      {
        cohort: 'تاريخي غير مرحّل غير اختباري',
        gate: 'REJECT until proper issue posting under separate approval',
        policy: 'No silent collect'
      },
      {
        cohort: 'فواتير لديها تحصيلات سابقة وقيد إصدار سليم',
        gate: 'ALLOW additional collection if remaining>0 and issue JE still ACTIVE',
        note: 'Gate does not block legitimate partial→remainder flows'
      }
    ],
    simulation_by_bucket: byBucket
  };
  pass('historical-compatibility-documented');

  // --- Isolation design ---
  report.isolationDesign = {
    status: 'DESIGN_ONLY_NOT_EXECUTED',
    target: 'Finance P3 harnesses must not write public.finance_*',
    layers: [
      {
        id: 'L1-SCHEMA',
        title: 'Schema/DB isolation',
        detail:
          'Prefer dedicated DB (e.g. naiosh_erp_finance_test) OR continue b1a_test schema with search_path=b1a_test only for writers. HTTP wire tests need either schema-aware app config or separate DB URL.'
      },
      {
        id: 'L2-ROLE',
        title: 'DB role permissions',
        detail:
          'Test role: GRANT ALL ON SCHEMA b1a_test; REVOKE INSERT/UPDATE/DELETE ON public.finance_invoices, finance_payments, finance_payment_allocations, finance_journal_entries, finance_journal_lines FROM test_role. App role unchanged for runtime.'
      },
      {
        id: 'L3-CI-GREP',
        title: 'CI reject dangerous SQL in tests',
        detail:
          "Fail if test-finance-p3*.js matches /INSERT INTO public\\.finance_/ or /UPDATE public\\.finance_/ without allowlist file header FINANCE_PUBLIC_WRITE_ALLOW=1 (discouraged)."
      },
      {
        id: 'L4-ASSERT',
        title: 'assertPublicUntouched',
        detail:
          'Snapshot counts+max(id) on public finance tables before/after suite; fail on growth. Detection aid only — not a substitute for L1/L2.'
      },
      {
        id: 'L5-SUITE-REVIEW',
        title: 'Known public writers to remediate under later approval',
        files: [
          'test-finance-p3-b1d3d-payment-wire.js (seedPublicInvoice)',
          'test-finance-p3-b1d3e-payment-entity.js (INSERT public invoices/payments)',
          'test-finance-p3-b1d4-readiness.js (matrix INSERT public)',
          'test-finance-p3-b1d2-readiness.js (INSERT public)'
        ],
        note: 'B1.d.5a.2 does not edit these scripts'
      }
    ],
    verification_that_tests_are_isolated: [
      'Test process env DATABASE_URL points to test DB/schema only',
      'SELECT current_schema() / show search_path asserted == b1a_test at suite start',
      'Attempted INSERT INTO public.finance_invoices must fail with permission denied when L2 enabled',
      'assertPublicUntouched delta == 0',
      'CI grep clean'
    ]
  };
  pass('isolation-design-documented');

  // --- UNIQUE review ---
  const dupScan = {
    invoice: (
      await client.query(`
        SELECT COUNT(*)::int AS n FROM (
          SELECT reference_id FROM finance_journal_entries
          WHERE is_posted=true AND reference_type='INVOICE' AND reference_id IS NOT NULL
          GROUP BY reference_id HAVING COUNT(*)>1) t`)
    ).rows[0].n,
    payment: (
      await client.query(`
        SELECT COUNT(*)::int AS n FROM (
          SELECT reference_id FROM finance_journal_entries
          WHERE is_posted=true AND reference_type='PAYMENT' AND reference_id IS NOT NULL
          GROUP BY reference_id HAVING COUNT(*)>1) t`)
    ).rows[0].n,
    reversal: (
      await client.query(`
        SELECT COUNT(*)::int AS n FROM (
          SELECT reference_id FROM finance_journal_entries
          WHERE is_posted=true AND reference_type='JOURNAL_REVERSAL' AND reference_id IS NOT NULL
          GROUP BY reference_id HAVING COUNT(*)>1) t`)
    ).rows[0].n,
    alloc: (
      await client.query(`
        SELECT COUNT(*)::int AS n FROM (
          SELECT payment_id, invoice_id FROM finance_payment_allocations
          GROUP BY payment_id, invoice_id HAVING COUNT(*)>1) t`)
    ).rows[0].n,
    posted_null_ref: (
      await client.query(`
        SELECT COUNT(*)::int AS n FROM finance_journal_entries
        WHERE is_posted=true AND (reference_type IS NULL OR reference_id IS NULL)`)
    ).rows[0].n
  };

  const cols = (
    await client.query(`
      SELECT table_name, column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_schema='public'
        AND table_name IN ('finance_journal_entries','finance_payment_allocations')
        AND column_name IN ('reference_type','reference_id','is_posted','payment_id','invoice_id')
      ORDER BY table_name, column_name`)
  ).rows;

  report.uniqueReview = {
    status: 'REVIEWED_NOT_APPLIED',
    column_check: cols,
    proposed: {
      je: `CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS uq_finance_je_posted_ref
  ON public.finance_journal_entries (reference_type, reference_id)
  WHERE is_posted IS TRUE
    AND reference_type IS NOT NULL
    AND reference_id IS NOT NULL;`,
      alloc: `CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS uq_finance_payment_alloc_pair
  ON public.finance_payment_allocations (payment_id, invoice_id);`
    },
    validation: {
      columns_exist: cols.length === 5,
      is_posted_nullable: cols.find((c) => c.column_name === 'is_posted')?.is_nullable === 'YES',
      note_is_posted:
        'Predicate uses IS TRUE so NULL is_posted rows are excluded (safe with nullable column)',
      null_refs_allowed: 'Manual/untyped journals with NULL refs remain allowed outside partial index',
      reversals:
        'JOURNAL_REVERSAL stores reference_id=original.entry_id — unique ⇒ at most one posted reverse per original entry (aligns with reverseEntry)',
      legacy_paths: 'Legacy inline INVOICE/PAYMENT inserts also set reference_type/id — protected equally',
      concurrency: 'App advisory locks + FOR UPDATE first; unique is last-line race defense',
      gate_interaction:
        'UNIQUE does not replace collection gate; gate prevents Cr-without-Dr; unique prevents double JE/alloc'
    },
    duplicate_scan_now: dupScan,
    readiness:
      dupScan.invoice + dupScan.payment + dupScan.reversal + dupScan.alloc === 0
        ? 'TECHNICALLY_READY_PENDING_EXPLICIT_5b_APPROVAL'
        : 'BLOCKED_BY_DUPLICATES',
    non_execution: 'No SQL run to create indexes in this phase'
  };

  report.uniqueReview.readiness.startsWith('TECHNICALLY')
    ? pass('unique-technically-ready', JSON.stringify(dupScan))
    : fail('unique-technically-ready', JSON.stringify(dupScan));

  report.phasedApprovals = [
    {
      step: 'B1.d.5a.2',
      scope: 'This design report',
      status: 'in-progress-delivery'
    },
    {
      step: 'B1.d.5a.3-gate-impl',
      scope:
        'Implement assertInvoiceIssueReadyForCollection + wire AP1/AP2 only behind explicit approval (recommend default-deny in service always when approved; optional kill-switch flag default true for safety if required)',
      approval: 'explicit-separate',
      depends_on: '5a.2 acceptance'
    },
    {
      step: 'B1.d.5a.4-isolation',
      scope: 'Remediate b1d2/d3d/d3e/d4 public writers + CI grep + optional test DB role',
      approval: 'explicit-separate',
      depends_on: '5a.2 acceptance'
    },
    {
      step: 'B1.d.5b-unique',
      scope: 'Apply UNIQUE indexes only (backup + CONCURRENTLY + isolated verify)',
      approval: 'explicit-separate',
      depends_on: 'duplicate scan still 0; NOT bundled with gate/isolation/repairs'
    },
    {
      step: 'B1.d.5c-idempotency',
      scope: 'Idempotency-Key for collection (from readiness plan)',
      approval: 'explicit-separate'
    },
    {
      step: 'B1.d.5d-advance',
      scope: 'ADVANCE accounting policy',
      approval: 'explicit-separate'
    },
    {
      step: 'Repair R1–R5',
      scope: 'Historical/seed/C3 repairs or product invoice-JE-required already covered by gate impl',
      approval: 'explicit-separate-each'
    },
    {
      step: 'B1.d.6 flags',
      scope: 'Staging invoice/payment flags',
      approval: 'explicit-separate',
      blocked_until: 'gate live + isolation + UNIQUE decision'
    }
  ];
  pass('phased-approvals-documented');

  try {
    await client.query('UPDATE finance_invoices SET notes = notes WHERE false');
    fail('readonly-enforced', 'write allowed');
  } catch (e) {
    pass('readonly-enforced', e.code || String(e.message).slice(0, 60));
  }

  await client.end();

  const passed = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok).length;
  report.summary = { passed, failed, total: results.length, results };
  writeReport(report);
  console.log('');
  console.log(`=== B1.d.5a.2 ${failed === 0 ? 'PASS' : 'FAIL'} ${passed}/${failed} ===`);
  console.log(`Simulated gate: ${JSON.stringify(decisions)}`);
  console.log('No implementation / no B1.d.5b — awaiting explicit approval');
  process.exit(failed === 0 ? 0 : 1);
}

function writeReport(report) {
  const md = [];
  md.push('# تقرير B1.d.5a.2 — تصميم بوابة سلامة التحصيل + عزل الاختبارات + مراجعة UNIQUE');
  md.push('');
  md.push(
    `**النتيجة:** ${report.summary.failed === 0 ? 'PASS' : 'FAIL'} — ${report.summary.passed} / ${report.summary.failed}`
  );
  md.push(
    '**النطاق:** تحليل وتصميم فقط. لا تعديل بيانات/سكربتات/خدمات/مسارات · لا إصلاح تاريخي · لا migrations · لا أعلام · لا B1.d.5b · لا دمج/Staging/Production.'
  );
  md.push('');
  md.push('## الحكم');
  md.push(
    'بوابة التحصيل يجب أن تتحقق من قيد إصدار **نشط** عبر الرابط المباشر **أو** `reference_type/reference_id`، مع فحوصات الكيان/الحالة/العكس/المبلغ/التفرد — **بدون تجاوز عام**. نقاط التطبيق غير القابلة للتجاوز: `postPaymentReceipt` + فرع HTTP القديم. UNIQUE جاهز تقنيًا وغير منفّذ. عزل `public` تصميم فقط.'
  );
  md.push('');
  md.push('## 1) مصفوفة قبول / رفض / مراجعة بشرية');
  md.push('| حالة قيد إصدار الفاتورة | القرار | الرمز |');
  md.push('|---|---|---|');
  for (const row of report.acceptRejectMatrix) {
    md.push(
      `| ${row.state} | **${row.outcome}** | \`${row.code}\`${row.note ? ` — ${row.note}` : ''}${row.applies_to ? ` — يشمل: ${row.applies_to}` : ''} |`
    );
  }
  md.push('');
  md.push('### خوارزمية الحل (تصميم)');
  md.push('```');
  md.push(JSON.stringify(report.gateDesign, null, 2));
  md.push('```');
  md.push('');
  md.push('## 2) نقاط التطبيق التي لا يمكن تجاوزها');
  for (const p of report.applicationPoints) {
    md.push(`### ${p.id} — \`${p.path}\``);
    md.push(`- مطلوب: **${p.required}** · خطر التجاوز: ${p.bypass_risk_if_skipped}`);
    md.push(`- لماذا: ${p.why}`);
    md.push(`- موضع مقترح: ${p.placement}`);
    if (p.observed) md.push(`- ملاحظة رصد: ${p.observed}`);
    md.push('');
  }
  md.push('## 3) التوافق مع البيانات التاريخية');
  md.push('```');
  md.push(JSON.stringify(report.historicalCompatibility, null, 2));
  md.push('```');
  md.push('');
  md.push('### محاكاة حية على القاعدة الحالية (بدون تثبيت البوابة)');
  md.push('```');
  md.push(JSON.stringify(report.liveSimulation, null, 2));
  md.push('```');
  md.push('');
  md.push('## 4) تصميم عزل الاختبارات عن `public`');
  md.push('```');
  md.push(JSON.stringify(report.isolationDesign, null, 2));
  md.push('```');
  md.push('');
  md.push('## 5) مراجعة جاهزية UNIQUE');
  md.push('```');
  md.push(JSON.stringify(report.uniqueReview, null, 2));
  md.push('```');
  md.push('');
  md.push('## 6) ترتيب تنفيذي لاحق (كل خطوة بموافقة مستقلة)');
  for (const s of report.phasedApprovals) {
    md.push(
      `- **${s.step}:** ${s.scope} — موافقة: ${s.approval || s.status}${s.depends_on ? ` · يعتمد على: ${s.depends_on}` : ''}${s.blocked_until ? ` · يُحظر حتى: ${s.blocked_until}` : ''}`
    );
  }
  md.push('');
  md.push('## 7) نتائج الفحص');
  for (const r of results) {
    md.push(`- ${r.ok ? 'PASS' : 'FAIL'} ${r.name}${r.detail ? `: ${r.detail}` : ''}`);
  }
  md.push('');
  md.push('**توقف:** بانتظار موافقة صريحة قبل تنفيذ البوابة أو العزل أو B1.d.5b.');

  const reportPath = path.join(__dirname, 'docs/finance-leadership-p3-b1d5a2-gate-isolation-report.md');
  fs.writeFileSync(reportPath, md.join('\n') + '\n');
  fs.writeFileSync(path.join(ART, 'finance-leadership-p3-b1d5a2-gate-isolation-report.md'), md.join('\n') + '\n');
  fs.writeFileSync(
    path.join(ART, 'finance-leadership-p3-b1d5a2-gate-isolation-results.json'),
    JSON.stringify(report, null, 2)
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
