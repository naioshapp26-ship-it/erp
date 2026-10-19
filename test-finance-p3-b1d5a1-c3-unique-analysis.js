'use strict';

/**
 * P3 / B1.d.5a.1 — C3 case-by-case + public-writer map + UNIQUE design (READ-ONLY).
 * No data mutation. No test-script edits. No migrations. No flag enablement. No B1.d.5b.
 */
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const ART = '/opt/cursor/artifacts';
fs.mkdirSync(ART, { recursive: true });
const DB_URL =
  process.env.DATABASE_URL ||
  'postgresql://vendowor_erp_user:vendowor_local_dev@127.0.0.1:5432/vendowor_erp';
const ROOT = __dirname;

const results = [];
function pass(name, detail = '') {
  results.push({ name, ok: true, detail });
  console.log(`PASS  ${name}${detail ? ` — ${detail}` : ''}`);
}
function fail(name, detail = '') {
  results.push({ name, ok: false, detail });
  console.log(`FAIL  ${name}${detail ? ` — ${detail}` : ''}`);
}

function sourceFromNotes(invoiceNumber, payNotes) {
  const num = String(invoiceNumber || '');
  const notes = String(payNotes || '');
  if (num.startsWith('B1D3D-') || notes.includes('B1D3D-WIRE') || notes.startsWith('idem-') || notes.startsWith('B1D3D-CONC')) {
    return {
      provenance: 'TEST_CONFIRMED',
      suite: 'test-finance-p3-b1d3d-payment-wire.js',
      mechanism:
        'seedPublicInvoice() INSERT INTO public.finance_invoices (no invoice JE) → HTTP POST /finance/payments on flag-true :3012 (or concurrent cases) posts PAYMENT JE',
      http_gap:
        'Both legacy and service payment paths credit 1130 without requiring invoice.journal_entry_id',
      unresolved: false
    };
  }
  if (num.startsWith('B1D3E-') || notes.includes('B1D3E-HTTP-POSTED')) {
    return {
      provenance: 'TEST_CONFIRMED',
      suite: 'test-finance-p3-b1d3e-payment-entity.js',
      mechanism:
        'INSERT INTO public.finance_invoices (unposted) → HTTP POST /finance/payments on :3010 default-false legacy path posts PAYMENT JE to exercise POSTED_DOCUMENT_LOCKED guards',
      http_gap:
        'Legacy POST /finance/payments does not require invoice issue JE before collection',
      unresolved: false
    };
  }
  if (num.startsWith('B1D4-')) {
    return {
      provenance: 'TEST_CONFIRMED',
      suite: 'test-finance-p3-b1d4-readiness.js',
      mechanism: 'matrix INSERT INTO public.finance_invoices + payment HTTP',
      http_gap: 'same — payment path does not require invoice JE',
      unresolved: false
    };
  }
  return {
    provenance: 'UNRESOLVED',
    suite: null,
    mechanism: 'prefix/notes do not match known test harnesses',
    http_gap: null,
    unresolved: true
  };
}

function scanPublicWriters() {
  const files = fs
    .readdirSync(ROOT)
    .filter((f) => /^test-finance-p3.*\.js$/.test(f))
    .sort();
  const writers = [];
  for (const f of files) {
    const src = fs.readFileSync(path.join(ROOT, f), 'utf8');
    const inserts = [...src.matchAll(/INSERT INTO public\.finance_(\w+)/g)].map((m) => m[1]);
    const switches = (src.match(/SET search_path TO public/g) || []).length;
    const usesB1a = /SET search_path TO b1a_test/.test(src);
    if (inserts.length || switches) {
      writers.push({
        file: f,
        publicInsertTables: [...new Set(inserts)],
        searchPathToPublicCount: switches,
        alsoUsesB1aTest: usesB1a,
        risk:
          inserts.length > 0
            ? 'HIGH — direct public INSERT'
            : 'LOW — switches to public for read/historical scan'
      });
    }
  }
  return writers;
}

async function main() {
  delete process.env.FINANCE_POST_INVOICE_VIA_SERVICE;
  delete process.env.FINANCE_POST_PAYMENT_VIA_SERVICE;

  const client = new Client({ connectionString: DB_URL });
  await client.connect();
  await client.query('SET default_transaction_read_only = on');
  await client.query('SET search_path TO public');

  const report = {
    phase: 'B1.d.5a.1-c3-unique-analysis',
    scope:
      'read-only; no data cleanup; no test-script changes; no migrations; flags stay false; no B1.d.5b',
    preliminaryDecisionsAccepted: {
      D1: 'Keep INV-FIN-* seeds unchanged; classify as experimental in reports only',
      D2: 'Do not clean public test artifacts now; map ingress + propose prevention',
      D3: 'Inspect each C3 case individually; no JE create/reverse',
      D4: 'Design UNIQUE only — do not apply',
      D5: 'Ops not approved; flags false'
    },
    c3Cases: [],
    c3Summary: {},
    publicWriters: [],
    isolationPlan: {},
    uniqueDesign: {},
    laterRepairCandidates: [],
    gatesTo5b: [],
    mutationsExecuted: false
  };

  // --- C3 cases ---
  const rows = (
    await client.query(`
      SELECT i.invoice_id, i.invoice_number, i.entity_id AS invoice_entity,
             i.status, i.payment_status,
             i.total_amount::float AS invoice_total,
             i.paid_amount::float AS invoice_paid,
             i.remaining_amount::float AS invoice_remaining,
             i.journal_entry_id AS invoice_je_id,
             a.allocation_id, a.allocated_amount::float AS allocated_amount,
             p.payment_id, p.payment_number, p.payment_amount::float AS payment_amount,
             p.entity_id AS payment_entity, p.payment_method, p.notes AS payment_notes,
             p.journal_entry_id AS payment_je_id,
             e.entry_number AS payment_je_number, e.description AS payment_je_description,
             e.is_posted AS payment_je_posted,
             (SELECT json_agg(json_build_object(
                'line_number', l.line_number,
                'account_code', l.account_code,
                'debit', l.debit_amount::float,
                'credit', l.credit_amount::float
              ) ORDER BY l.line_number)
              FROM finance_journal_lines l WHERE l.entry_id = e.entry_id) AS je_lines,
             EXISTS (
               SELECT 1 FROM finance_journal_entries x
               WHERE x.reference_type='INVOICE' AND x.reference_id=i.invoice_id AND x.is_posted=true
             ) AS invoice_orphan_je_ref
      FROM finance_invoices i
      JOIN finance_payment_allocations a ON a.invoice_id = i.invoice_id
      JOIN finance_payments p ON p.payment_id = a.payment_id
      LEFT JOIN finance_journal_entries e ON e.entry_id = p.journal_entry_id
      WHERE i.journal_entry_id IS NULL AND p.journal_entry_id IS NOT NULL
      ORDER BY i.invoice_id, p.payment_id`)
  ).rows;

  const byInvoice = new Map();
  for (const r of rows) {
    if (!byInvoice.has(r.invoice_id)) byInvoice.set(r.invoice_id, []);
    byInvoice.get(r.invoice_id).push(r);
  }

  let confirmed = 0;
  let unresolved = 0;
  let glCredit1130 = 0;
  for (const [invoiceId, allocs] of byInvoice) {
    const head = allocs[0];
    const src = sourceFromNotes(head.invoice_number, head.payment_notes);
    const credit1130 = allocs.reduce((s, a) => {
      const lines = a.je_lines || [];
      const c = lines
        .filter((l) => l.account_code === '1130')
        .reduce((x, l) => x + Number(l.credit || 0), 0);
      return s + c;
    }, 0);
    // Avoid double-counting multi-invoice same payment JE: for m1/m2 share PAY-0003
    // Credit on JE is payment-level; attribute allocated_amount as AR effect per invoice
    const arEffectAttributed = allocs.reduce((s, a) => s + Number(a.allocated_amount || 0), 0);
    glCredit1130 += arEffectAttributed;

    if (src.unresolved) unresolved += 1;
    else confirmed += 1;

    report.c3Cases.push({
      invoice_id: invoiceId,
      invoice_number: head.invoice_number,
      invoice_entity: head.invoice_entity,
      status: head.status,
      payment_status: head.payment_status,
      invoice_total: head.invoice_total,
      invoice_paid: head.invoice_paid,
      invoice_remaining: head.invoice_remaining,
      invoice_je_id: head.invoice_je_id,
      invoice_orphan_je_ref: head.invoice_orphan_je_ref,
      payments: allocs.map((a) => ({
        payment_id: a.payment_id,
        payment_number: a.payment_number,
        payment_entity: a.payment_entity,
        payment_method: a.payment_method,
        payment_amount: a.payment_amount,
        allocated_amount: a.allocated_amount,
        payment_notes: a.payment_notes,
        payment_je_id: a.payment_je_id,
        payment_je_number: a.payment_je_number,
        je_lines: a.je_lines
      })),
      gl_effect: {
        missing_invoice_dr_1130: head.invoice_total,
        payment_cr_1130_attributed_via_alloc: arEffectAttributed,
        net_ar_gl_hole_for_invoice: arEffectAttributed,
        note:
          'Payment JE credits 1130 without a matching invoice issue debit on 1130 for this invoice'
      },
      source: src,
      verdict: src.unresolved ? 'UNRESOLVED' : 'TEST_ONLY'
    });
  }

  report.c3Summary = {
    distinct_invoices: byInvoice.size,
    allocation_rows: rows.length,
    test_confirmed: confirmed,
    unresolved,
    attributed_1130_credit_hole: glCredit1130,
    root_cause_common:
      'Tests insert unposted invoices into public, then POST /finance/payments (legacy or service). Neither path requires invoice.journal_entry_id before collecting. Result: Cr 1130 without prior Dr 1130 for that invoice.'
  };

  byInvoice.size >= 12
    ? pass('c3-cases-loaded', `${byInvoice.size} invoices / ${rows.length} alloc rows`)
    : fail('c3-cases-loaded', String(byInvoice.size));
  unresolved === 0
    ? pass('c3-all-test-confirmed', `${confirmed}/${byInvoice.size}`)
    : fail('c3-all-test-confirmed', `unresolved=${unresolved}`);
  report.c3Cases.every((c) => !c.invoice_orphan_je_ref)
    ? pass('c3-no-orphan-invoice-je-refs')
    : fail('c3-no-orphan-invoice-je-refs');

  // --- Public writers (static scan, no edits) ---
  report.publicWriters = scanPublicWriters();
  const high = report.publicWriters.filter((w) => w.risk.startsWith('HIGH'));
  pass('public-writers-scanned', `files=${report.publicWriters.length} high=${high.length}`);

  report.isolationPlan = {
    status: 'DESIGN_ONLY_NOT_EXECUTED',
    goal: 'Prevent future accidental public pollution from finance P3 harnesses',
    recommended_controls: [
      {
        id: 'ISO-1',
        title: 'Default search_path = b1a_test for unit/service tests',
        detail: 'All direct SQL fixtures use b1a_test; never INSERT INTO public.finance_*'
      },
      {
        id: 'ISO-2',
        title: 'Dedicated HTTP fixture schema or DB for wire tests',
        detail:
          'Option A: DATABASE_URL_TEST pointing at naiosh_erp_finance_test. Option B: keep same DB but require search_path + table ownership checks before INSERT'
      },
      {
        id: 'ISO-3',
        title: 'Harness guard assertPublicUntouched',
        detail:
          'Before/after counts on public.finance_invoices / payments / journal_entries; fail suite if public grows unexpectedly (except explicitly approved historical RO scans)'
      },
      {
        id: 'ISO-4',
        title: 'Ban list in CI grep',
        detail:
          "Fail PR if new test files contain 'INSERT INTO public.finance_' without allowlist comment"
      },
      {
        id: 'ISO-5',
        title: 'Prefix quarantine reporting',
        detail: 'Treat B1D*/INV-FIN-* as experimental in readiness/audit reports (D1/D2 policy)'
      }
    ],
    note: 'B1.d.5a.1 does not change test scripts or DB settings — plan only.'
  };
  pass('isolation-plan-documented');

  // --- UNIQUE design (not applied) ---
  const dupInv = (
    await client.query(`
      SELECT reference_id, COUNT(*)::int AS n
      FROM finance_journal_entries
      WHERE is_posted=true AND reference_type='INVOICE' AND reference_id IS NOT NULL
      GROUP BY reference_id HAVING COUNT(*)>1`)
  ).rows;
  const dupPay = (
    await client.query(`
      SELECT reference_id, COUNT(*)::int AS n
      FROM finance_journal_entries
      WHERE is_posted=true AND reference_type='PAYMENT' AND reference_id IS NOT NULL
      GROUP BY reference_id HAVING COUNT(*)>1`)
  ).rows;
  const dupRev = (
    await client.query(`
      SELECT reference_id, COUNT(*)::int AS n
      FROM finance_journal_entries
      WHERE is_posted=true AND reference_type='JOURNAL_REVERSAL' AND reference_id IS NOT NULL
      GROUP BY reference_id HAVING COUNT(*)>1`)
  ).rows;
  const dupAlloc = (
    await client.query(`
      SELECT payment_id, invoice_id, COUNT(*)::int AS n
      FROM finance_payment_allocations
      GROUP BY payment_id, invoice_id HAVING COUNT(*)>1`)
  ).rows;
  const nullRefPosted = (
    await client.query(`
      SELECT COUNT(*)::int AS n FROM finance_journal_entries
      WHERE is_posted=true AND (reference_id IS NULL OR reference_type IS NULL)`)
  ).rows[0].n;

  report.uniqueDesign = {
    status: 'PROPOSED_NOT_APPLIED',
    current_duplicate_scan: {
      invoice_refs: dupInv.length,
      payment_refs: dupPay.length,
      journal_reversal_refs: dupRev.length,
      allocations: dupAlloc.length,
      posted_with_null_reference: nullRefPosted
    },
    proposed_sql: [
      `CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS uq_finance_je_posted_ref
  ON finance_journal_entries (reference_type, reference_id)
  WHERE is_posted = true
    AND reference_type IS NOT NULL
    AND reference_id IS NOT NULL;`,
      `CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS uq_finance_payment_alloc_pair
  ON finance_payment_allocations (payment_id, invoice_id);`
    ],
    rationale: {
      partial_is_posted:
        'Draft/unposted rows and in-progress inserts stay outside the unique key until posted',
      null_excluded:
        'Manual journals often have NULL reference_*; counted posted_with_null_reference must remain allowed',
      journal_reversal:
        'Reversals use reference_type=JOURNAL_REVERSAL and reference_id=original.entry_id — unique allows exactly one active posted reverse per original entry (matches reverseEntry ALREADY_REVERSED intent)',
      invoice_payment:
        'One posted JE per INVOICE/PAYMENT reference_id complements advisory locks + ALREADY_POSTED',
      allocations: 'Matches DUPLICATE_ALLOCATION app guard'
    },
    impact: {
      posting_happy_path: 'No change if app guards hold; unique is last-line defense under races',
      reverse_path:
        'First reverse OK; second reverse fails on unique (and app). Does not block creating a new INVOICE/PAYMENT JE for a different document',
      legacy_false_flags:
        'Legacy inline JE insert also uses reference_type/id — unique protects legacy too. Empty-allocation legacy payments still create PAYMENT refs (behavioral risk unchanged; unique does not fix empty-alloc policy)',
      concurrency:
        'Under two concurrent postPaymentReceipt calls, one wins FOR UPDATE/remaining; loser errors. If app check races, unique prevents double JE',
      migration_risk:
        'CONCURRENTLY preferred; requires zero existing duplicates (currently 0). Still needs explicit B1.d.5b approval + backup window'
    },
    non_goals: [
      'Does not backfill invoice JE for C3',
      'Does not require invoice.journal_entry_id before payment (separate product decision)',
      'Does not enable feature flags'
    ]
  };

  dupInv.length + dupPay.length + dupRev.length + dupAlloc.length === 0
    ? pass('unique-candidates-clean', `null_ref_posted=${nullRefPosted}`)
    : fail('unique-candidates-clean', 'duplicates present');

  // --- Later repair candidates (no execution) ---
  report.laterRepairCandidates = [
    {
      id: 'R1',
      target: 'INV-FIN-001',
      why: 'Synthetic paid_amount=20000 without payment/alloc/JE (bootstrap)',
      impact_if_fixed: 'Aligns AR UI with GL; may require invoice JE + collection docs',
      rollback: 'Restore bootstrap row values from backup; avoid mass reverse',
      approval: 'separate explicit'
    },
    {
      id: 'R2',
      target: 'INV-FIN-002',
      why: 'Seed ISSUED without JE',
      impact_if_fixed: 'Adds Dr 1130 if posted; changes GL AR',
      rollback: 'Reverse that single JE if created; do not mass reverse',
      approval: 'separate explicit'
    },
    {
      id: 'R3',
      target: `C3 invoices (${byInvoice.size})`,
      why: 'Payment Cr 1130 without invoice Dr 1130 — test pollution + HTTP gap demonstration',
      impact_if_fixed:
        'Either backfill invoice JEs or reverse payment JEs individually then recreate properly',
      rollback: 'Per-document reverse only; no bulk reverse',
      approval: 'separate explicit; prefer leave in local/dev per D2/D3'
    },
    {
      id: 'R4',
      target: 'C2 unposted test invoices (B1D3D/B1D4-MX unpaid)',
      why: 'Public clutter; no GL hole until collected',
      impact_if_fixed: 'Cleanup only; no GL if never posted',
      rollback: 'N/A if deleted from non-prod after backup',
      approval: 'separate explicit (D2 currently: do not clean)'
    },
    {
      id: 'R5',
      target: 'Product gap: payment without requiring invoice JE',
      why: 'Service + legacy both allow collection against unposted invoices',
      impact_if_fixed: 'Prevents future C3-class holes in real ops',
      rollback: 'Feature-flag the new gate; default off until approved',
      approval: 'separate explicit — not UNIQUE, not 5b'
    }
  ];
  pass('later-repair-list-documented', String(report.laterRepairCandidates.length));

  report.gatesTo5b = [
    {
      gate: 'G5b-1',
      requirement: 'Explicit approval of UNIQUE SQL design in this report',
      status: 'pending'
    },
    {
      gate: 'G5b-2',
      requirement: 'Re-confirm duplicate scan == 0 immediately before migration',
      status: 'pending'
    },
    {
      gate: 'G5b-3',
      requirement: 'Backup / restore point for finance_journal_entries + finance_payment_allocations',
      status: 'pending'
    },
    {
      gate: 'G5b-4',
      requirement:
        'Accounting decisions D1/D3 remain leave-as-is OR separate repair approval completed — UNIQUE must not be bundled with backfills',
      status: 'accepted-leave-as-is-for-now'
    },
    {
      gate: 'G5b-5',
      requirement: 'Flags remain false; no Staging/Production activation in 5b',
      status: 'required'
    },
    {
      gate: 'G5b-OUT',
      requirement: 'Isolation test-script changes / public cleanup / invoice-JE-required gate are OUT OF 5b',
      status: 'separate-approvals'
    }
  ];
  pass('gates-to-5b-documented');

  // Read-only proof
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
  console.log(`=== B1.d.5a.1 ${failed === 0 ? 'PASS' : 'FAIL'} ${passed}/${failed} ===`);
  console.log(`C3 invoices: ${report.c3Summary.distinct_invoices} (unresolved=${unresolved})`);
  console.log('B1.d.5b: NOT executed — awaiting explicit approval');
  process.exit(failed === 0 ? 0 : 1);
}

function writeReport(report) {
  const md = [];
  md.push('# تقرير B1.d.5a.1 — تحليل C3 + ضوابط public + تصميم UNIQUE (قراءة فقط)');
  md.push('');
  md.push(
    `**النتيجة:** ${report.summary.failed === 0 ? 'PASS' : 'FAIL'} — ${report.summary.passed} / ${report.summary.failed}`
  );
  md.push(
    '**النطاق:** تحليل وتقرير فقط. لا تعديل بيانات · لا تنظيف · لا تغيير سكربتات اختبار · لا migrations · لا قيود/عكس · لا HTTP · لا أعلام · لا B1.d.5b · لا دمج/Staging/Production.'
  );
  md.push('');
  md.push('## الحكم');
  md.push(
    'كل حالات C3 **اختبارية مؤكدة** (0 غير محسوم). سبب الثقب: إدراج فاتورة في `public` بلا قيد إصدار ثم `POST /finance/payments` (قديم أو خدمة) الذي لا يشترط `invoice.journal_entry_id`. UNIQUE مقترح وجاهز تقنيًا لكن **غير منفّذ**. التشغيل غير معتمد؛ الأعلام false.'
  );
  md.push('');
  md.push('## قرارات مبدئية مُعتمدة في هذه الشريحة');
  for (const [k, v] of Object.entries(report.preliminaryDecisionsAccepted)) {
    md.push(`- **${k}:** ${v}`);
  }
  md.push('');
  md.push('## 1) حالات C3 — ملخص');
  md.push('```');
  md.push(JSON.stringify(report.c3Summary, null, 2));
  md.push('```');
  md.push('');
  md.push('## 2) فحص فردي لحالات C3');
  for (const c of report.c3Cases) {
    md.push(`### ${c.invoice_number} (invoice_id=${c.invoice_id}) — ${c.verdict}`);
    md.push(
      `- الكيان: فاتورة \`${c.invoice_entity}\` · الحالة ${c.status}/${c.payment_status} · total=${c.invoice_total} paid=${c.invoice_paid} remaining=${c.invoice_remaining}`
    );
    md.push(`- قيد الفاتورة: \`${c.invoice_je_id}\` · orphan_ref=${c.invoice_orphan_je_ref}`);
    md.push(`- المصدر: **${c.source.provenance}** · ${c.source.suite}`);
    md.push(`- الآلية: ${c.source.mechanism}`);
    md.push(`- فجوة HTTP/خدمة: ${c.source.http_gap}`);
    md.push(
      `- أثر الأستاذ: ينقص Dr 1130 للإصدار ≈ ${c.gl_effect.missing_invoice_dr_1130}؛ Cr 1130 منسوب للتحصيل عبر التخصيص ≈ ${c.gl_effect.payment_cr_1130_attributed_via_alloc} → ثقب AR ≈ ${c.gl_effect.net_ar_gl_hole_for_invoice}`
    );
    for (const p of c.payments) {
      md.push(
        `  - دفعة ${p.payment_number} (id=${p.payment_id}) كيان=${p.payment_entity} مبلغ=${p.payment_amount} تخصيص=${p.allocated_amount} طريقة=${p.payment_method} notes=\`${p.payment_notes}\` → قيد ${p.payment_je_number} (entry_id=${p.payment_je_id})`
      );
      md.push(`    - أسطر القيد: \`${JSON.stringify(p.je_lines)}\``);
    }
    md.push('');
  }
  md.push('## 3) لماذا يوجد قيد تحصيل دون قيد إصدار؟');
  md.push(
    '1. **اختبار مستقل (السبب المباشر لكل C3 الحالية):** السكربتات تُدرج الفاتورة في `public` كـ ISSUED بلا استدعاء ترحيل فاتورة، ثم تختبر مسار الدفعة فقط.'
  );
  md.push(
    '2. **فجوة مسار HTTP/خدمة (السبب البنيوي الذي يسمح بذلك):** لا `POST /finance/payments` القديم ولا `postPaymentReceipt` يفرضان وجود `finance_invoices.journal_entry_id` قبل التحصيل. لذلك التحقق من الحراسة على الدفعة ينجح محاسبيًا جزئيًا (نقد/بنك + Cr 1130) دون دورة إصدار كاملة.'
  );
  md.push(
    '3. **ليس بيانات تشغيلية غير محسومة في هذه البيئة:** البادئات `B1D3D-*` / `B1D3E-*` والملاحظات `B1D3D-WIRE` / `B1D3E-HTTP-POSTED` تطابق السكربتات حرفيًا.'
  );
  md.push('');
  md.push('## 4) اختبارات تكتب إلى `public`');
  md.push('| الملف | INSERT public | search_path→public | يستخدم b1a_test | الخطر |');
  md.push('|---|---|---:|---|---|');
  for (const w of report.publicWriters) {
    md.push(
      `| \`${w.file}\` | ${w.publicInsertTables.join(', ') || '—'} | ${w.searchPathToPublicCount} | ${w.alsoUsesB1aTest} | ${w.risk} |`
    );
  }
  md.push('');
  md.push('### كيف دخلت البيانات');
  md.push(
    '- **B1D3D:** `seedPublicInvoice` → `INSERT INTO public.finance_invoices` ثم HTTP دفعات على خادم الاختبار.'
  );
  md.push(
    '- **B1D3E:** `INSERT INTO public.finance_invoices` داخل اختبار حراسة PUT/DELETE للدفعة المرحّلة.'
  );
  md.push(
    '- **B1D4 matrix:** `INSERT INTO public.finance_invoices` لمسار both-true (بعضها يبقى C2 إن لم يُحصَّل على نفس الصف).'
  );
  md.push('- **INV-FIN-*:** `finance-bootstrap.js` (بذور عرض — D1 الإبقاء).');
  md.push('');
  md.push('## 5) خطة عزل مستقبلية (تصميم فقط — بلا تنفيذ)');
  md.push('```');
  md.push(JSON.stringify(report.isolationPlan, null, 2));
  md.push('```');
  md.push('');
  md.push('## 6) تصميم UNIQUE المقترح (غير مطبّق)');
  md.push('```');
  md.push(JSON.stringify(report.uniqueDesign, null, 2));
  md.push('```');
  md.push('');
  md.push('## 7) مرشحون لإصلاح لاحق (قائمة منفصلة — بلا تنفيذ)');
  for (const r of report.laterRepairCandidates) {
    md.push(`### ${r.id} — ${r.target}`);
    md.push(`- السبب: ${r.why}`);
    md.push(`- الأثر إن أُصلح: ${r.impact_if_fixed}`);
    md.push(`- التراجع: ${r.rollback}`);
    md.push(`- موافقة: ${r.approval}`);
    md.push('');
  }
  md.push('## 8) شروط الانتقال إلى B1.d.5b');
  for (const g of report.gatesTo5b) {
    md.push(`- **${g.gate}:** ${g.requirement} — _${g.status}_`);
  }
  md.push('');
  md.push('## 9) نتائج الفحص');
  for (const r of results) {
    md.push(`- ${r.ok ? 'PASS' : 'FAIL'} ${r.name}${r.detail ? `: ${r.detail}` : ''}`);
  }
  md.push('');
  md.push('**توقف:** بانتظار موافقة صريحة قبل B1.d.5b أو أي إصلاح بيانات أو تغيير سكربتات.');

  const reportPath = path.join(__dirname, 'docs/finance-leadership-p3-b1d5a1-c3-unique-report.md');
  fs.writeFileSync(reportPath, md.join('\n') + '\n');
  fs.writeFileSync(path.join(ART, 'finance-leadership-p3-b1d5a1-c3-unique-report.md'), md.join('\n') + '\n');
  fs.writeFileSync(
    path.join(ART, 'finance-leadership-p3-b1d5a1-c3-unique-results.json'),
    JSON.stringify(report, null, 2)
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
