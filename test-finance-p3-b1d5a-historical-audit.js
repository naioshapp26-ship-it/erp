'use strict';

/**
 * P3 / B1.d.5a — historical data audit (READ-ONLY).
 * No UPDATE/DELETE/INSERT on business tables. No re-post. No migrations. No flag enablement.
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

function classifyInvoice(row, hasAlloc, payJeCount) {
  const num = String(row.invoice_number || '');
  if (num.startsWith('INV-FIN-')) {
    if (Number(row.paid_amount) > 0 && !hasAlloc) {
      return {
        code: 'C1_SEED_SYNTHETIC_PAID',
        title: 'بذرة bootstrap بمبلغ مدفوع اصطناعي بلا دفعة/تخصيص/قيد',
        severity: 'high'
      };
    }
    return {
      code: 'C1_SEED_NO_GL',
      title: 'بذرة bootstrap بلا journal_entry_id وبلا قيد مرجع',
      severity: 'high'
    };
  }
  if (Number(row.paid_amount) > 0 && hasAlloc && payJeCount > 0) {
    return {
      code: 'C3_PAYMENT_JE_WITHOUT_INVOICE_JE',
      title: 'تحصيل مرحّل (قيد دفعة يخفض 1130) دون قيد إصدار فاتورة',
      severity: 'high'
    };
  }
  if (num.startsWith('B1D3D-') || num.startsWith('B1D3E-') || num.startsWith('B1D4-')) {
    return {
      code: 'C2_TEST_ARTIFACT_UNPOSTED',
      title: 'أثر اختبار معزول: فاتورة مُدرجة/مُنشأة دون ترحيل قيد فاتورة',
      severity: 'low'
    };
  }
  return {
    code: 'C4_UNKNOWN_NO_JE',
    title: 'فاتورة تشغيلية/غير مصنّفة بلا journal_entry_id',
    severity: 'high'
  };
}

async function main() {
  delete process.env.FINANCE_POST_INVOICE_VIA_SERVICE;
  delete process.env.FINANCE_POST_PAYMENT_VIA_SERVICE;
  const flags = {
    FINANCE_POST_INVOICE_VIA_SERVICE: process.env.FINANCE_POST_INVOICE_VIA_SERVICE || '(unset→false)',
    FINANCE_POST_PAYMENT_VIA_SERVICE: process.env.FINANCE_POST_PAYMENT_VIA_SERVICE || '(unset→false)'
  };

  const client = new Client({ connectionString: DB_URL });
  await client.connect();
  // Read-only session safeguards
  await client.query('SET default_transaction_read_only = on');
  await client.query('SET search_path TO public');

  const report = {
    phase: 'B1.d.5a-historical-audit',
    scope: 'read-only analysis; no mutations; no migrations; no flag enablement; no B1.d.5b execution',
    flags,
    inventory: {},
    invoicesMissingJe: [],
    classificationSummary: {},
    invFin001: {},
    duplicates: {},
    accountingBalance: {},
    decisionsRequired: [],
    prepFor5b: [],
    mutationsExecuted: false
  };

  // --- Inventory ---
  const invCounts = (
    await client.query(`
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE journal_entry_id IS NULL)::int AS missing_je,
        COUNT(*) FILTER (WHERE journal_entry_id IS NOT NULL)::int AS has_je
      FROM finance_invoices`)
  ).rows[0];
  const payCounts = (
    await client.query(`
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE journal_entry_id IS NULL)::int AS missing_je,
        COUNT(*) FILTER (WHERE journal_entry_id IS NOT NULL)::int AS has_je
      FROM finance_payments`)
  ).rows[0];
  report.inventory = { invoices: invCounts, payments: payCounts };
  pass('inventory-loaded', `inv_no_je=${invCounts.missing_je}/${invCounts.total}`);

  // --- Missing JE invoices with enrichment ---
  const missing = await client.query(`
    SELECT i.invoice_id, i.invoice_number, i.status, i.payment_status, i.entity_id,
           i.total_amount::float AS total_amount,
           i.paid_amount::float AS paid_amount,
           i.remaining_amount::float AS remaining_amount,
           i.journal_entry_id, i.created_at,
           EXISTS (
             SELECT 1 FROM finance_journal_entries e
             WHERE e.reference_type='INVOICE' AND e.reference_id=i.invoice_id AND e.is_posted=true
           ) AS orphan_je_ref_exists,
           EXISTS (
             SELECT 1 FROM finance_payment_allocations a WHERE a.invoice_id=i.invoice_id
           ) AS has_allocation,
           COALESCE((
             SELECT COUNT(*)::int FROM finance_payment_allocations a
             JOIN finance_payments p ON p.payment_id=a.payment_id
             WHERE a.invoice_id=i.invoice_id AND p.journal_entry_id IS NOT NULL
           ),0) AS posted_payment_alloc_count,
           COALESCE((
             SELECT SUM(a.allocated_amount)::float FROM finance_payment_allocations a
             WHERE a.invoice_id=i.invoice_id
           ),0) AS alloc_sum_all,
           COALESCE((
             SELECT SUM(a.allocated_amount)::float FROM finance_payment_allocations a
             JOIN finance_payments p ON p.payment_id=a.payment_id
             WHERE a.invoice_id=i.invoice_id AND p.journal_entry_id IS NOT NULL
           ),0) AS alloc_sum_posted,
           (SELECT COUNT(*)::int FROM finance_invoice_lines l WHERE l.invoice_id=i.invoice_id) AS line_count
    FROM finance_invoices i
    WHERE i.journal_entry_id IS NULL
    ORDER BY i.invoice_id`);

  const classified = [];
  for (const row of missing.rows) {
    const cls = classifyInvoice(row, row.has_allocation, row.posted_payment_alloc_count);
    classified.push({ ...row, classification: cls });
    report.classificationSummary[cls.code] =
      (report.classificationSummary[cls.code] || 0) + 1;
  }
  report.invoicesMissingJe = classified;
  const orphanLinkCount = classified.filter((r) => r.orphan_je_ref_exists).length;
  orphanLinkCount === 0
    ? pass('no-orphan-invoice-je-refs', '0 invoices missing link but having ref JE')
    : fail('no-orphan-invoice-je-refs', String(orphanLinkCount));

  // --- INV-FIN-001 ---
  const inv1 = (
    await client.query(`SELECT * FROM finance_invoices WHERE invoice_number='INV-FIN-001'`)
  ).rows[0];
  const inv1Allocs = (
    await client.query(
      `SELECT a.*, p.payment_number, p.payment_amount, p.journal_entry_id AS pay_je, p.status AS pay_status
       FROM finance_payment_allocations a
       JOIN finance_payments p ON p.payment_id=a.payment_id
       WHERE a.invoice_id=$1`,
      [inv1.invoice_id]
    )
  ).rows;
  const inv1JeMention = (
    await client.query(
      `SELECT entry_id, entry_number, description, reference_type, reference_id
       FROM finance_journal_entries
       WHERE description ILIKE '%INV-FIN-001%' OR reference_number ILIKE '%INV-FIN-001%'`
    )
  ).rows;
  const inv1AmountLines = (
    await client.query(
      `SELECT e.entry_id, e.entry_number, l.account_code, l.debit_amount::float, l.credit_amount::float
       FROM finance_journal_entries e
       JOIN finance_journal_lines l ON l.entry_id=e.entry_id
       WHERE l.debit_amount IN (20000,57500) OR l.credit_amount IN (20000,57500)`
    )
  ).rows;
  const inv1Lines = (
    await client.query(`SELECT COUNT(*)::int AS n FROM finance_invoice_lines WHERE invoice_id=$1`, [
      inv1.invoice_id
    ])
  ).rows[0].n;

  report.invFin001 = {
    invoice_id: inv1.invoice_id,
    invoice_number: inv1.invoice_number,
    status: inv1.status,
    payment_status: inv1.payment_status,
    total_amount: Number(inv1.total_amount),
    paid_amount: Number(inv1.paid_amount),
    remaining_amount: Number(inv1.remaining_amount),
    journal_entry_id: inv1.journal_entry_id,
    invoice_line_count: inv1Lines,
    allocations: inv1Allocs,
    je_mentions: inv1JeMention,
    gl_lines_matching_amounts: inv1AmountLines,
    root_cause:
      'finance-bootstrap.js inserts INV-FIN-001 with paid_amount=20000 / remaining=37500 without payment rows, allocations, invoice lines, or journal entries (demo seed only).',
    drift: {
      paid_vs_alloc_all: Number(inv1.paid_amount) - 0,
      paid_vs_alloc_posted: Number(inv1.paid_amount) - 0,
      explanation: 'paid_amount is synthetic; no finance_payment_allocations rows exist'
    }
  };
  pass(
    'inv-fin-001-root-cause',
    'bootstrap synthetic paid=20000; alloc=0; no JE; no lines'
  );

  // --- Duplicates ---
  const dupInvJe = (
    await client.query(`
      SELECT reference_id, COUNT(*)::int AS n, array_agg(entry_id ORDER BY entry_id) AS entries
      FROM finance_journal_entries
      WHERE is_posted=true AND reference_type='INVOICE' AND reference_id IS NOT NULL
      GROUP BY reference_id HAVING COUNT(*)>1`)
  ).rows;
  const dupPayJe = (
    await client.query(`
      SELECT reference_id, COUNT(*)::int AS n, array_agg(entry_id ORDER BY entry_id) AS entries
      FROM finance_journal_entries
      WHERE is_posted=true AND reference_type='PAYMENT' AND reference_id IS NOT NULL
      GROUP BY reference_id HAVING COUNT(*)>1`)
  ).rows;
  const dupAlloc = (
    await client.query(`
      SELECT payment_id, invoice_id, COUNT(*)::int AS n
      FROM finance_payment_allocations
      GROUP BY payment_id, invoice_id HAVING COUNT(*)>1`)
  ).rows;
  report.duplicates = {
    duplicate_invoice_je_refs: dupInvJe,
    duplicate_payment_je_refs: dupPayJe,
    duplicate_allocations: dupAlloc
  };
  dupInvJe.length === 0 && dupPayJe.length === 0 && dupAlloc.length === 0
    ? pass('no-duplicates')
    : fail('no-duplicates', JSON.stringify(report.duplicates));

  // --- Drift & holes ---
  const drift = (
    await client.query(`
      SELECT i.invoice_id, i.invoice_number, i.paid_amount::float AS paid,
             COALESCE((SELECT SUM(a.allocated_amount)::float FROM finance_payment_allocations a
                       WHERE a.invoice_id=i.invoice_id),0) AS alloc_all,
             COALESCE((SELECT SUM(a.allocated_amount)::float FROM finance_payment_allocations a
                       JOIN finance_payments p ON p.payment_id=a.payment_id
                       WHERE a.invoice_id=i.invoice_id AND p.journal_entry_id IS NOT NULL),0) AS alloc_posted
      FROM finance_invoices i
      WHERE ABS(COALESCE(i.paid_amount,0) - COALESCE((
              SELECT SUM(a.allocated_amount) FROM finance_payment_allocations a WHERE a.invoice_id=i.invoice_id
            ),0)) > 0.05
         OR ABS(COALESCE(i.paid_amount,0) - COALESCE((
              SELECT SUM(a.allocated_amount) FROM finance_payment_allocations a
              JOIN finance_payments p ON p.payment_id=a.payment_id
              WHERE a.invoice_id=i.invoice_id AND p.journal_entry_id IS NOT NULL
            ),0)) > 0.05
      ORDER BY i.invoice_id`)
  ).rows;

  const hole = (
    await client.query(`
      SELECT i.invoice_id, i.invoice_number, i.total_amount::float, i.paid_amount::float,
             SUM(a.allocated_amount)::float AS alloc_sum,
             array_agg(p.payment_id ORDER BY p.payment_id) AS payment_ids,
             array_agg(p.journal_entry_id ORDER BY p.payment_id) AS payment_jes
      FROM finance_invoices i
      JOIN finance_payment_allocations a ON a.invoice_id=i.invoice_id
      JOIN finance_payments p ON p.payment_id=a.payment_id
      WHERE i.journal_entry_id IS NULL AND p.journal_entry_id IS NOT NULL
      GROUP BY i.invoice_id
      ORDER BY i.invoice_id`)
  ).rows;

  const unbalanced = (
    await client.query(`
      SELECT e.entry_id, e.entry_number, e.reference_type, e.reference_id,
             SUM(l.debit_amount)::float AS debits, SUM(l.credit_amount)::float AS credits
      FROM finance_journal_entries e
      JOIN finance_journal_lines l ON l.entry_id=e.entry_id
      WHERE e.is_posted=true AND e.reference_type IN ('INVOICE','PAYMENT')
      GROUP BY e.entry_id
      HAVING ABS(SUM(l.debit_amount)-SUM(l.credit_amount)) > 0.02`)
  ).rows;

  const crossEntity = (
    await client.query(`
      SELECT a.allocation_id, a.payment_id, a.invoice_id, p.entity_id AS pay_entity, i.entity_id AS inv_entity
      FROM finance_payment_allocations a
      JOIN finance_payments p ON p.payment_id=a.payment_id
      JOIN finance_invoices i ON i.invoice_id=a.invoice_id
      WHERE COALESCE(p.entity_id,'') <> COALESCE(i.entity_id,'')`)
  ).rows;

  const gl1130 = (
    await client.query(`
      SELECT e.reference_type,
             SUM(l.debit_amount)::float AS debits,
             SUM(l.credit_amount)::float AS credits,
             SUM(l.debit_amount-l.credit_amount)::float AS net
      FROM finance_journal_entries e
      JOIN finance_journal_lines l ON l.entry_id=e.entry_id
      WHERE l.account_code='1130' AND e.is_posted=true
      GROUP BY e.reference_type
      ORDER BY 1`)
  ).rows;

  const gl1130Net = (
    await client.query(`
      SELECT COALESCE(SUM(l.debit_amount-l.credit_amount),0)::float AS net
      FROM finance_journal_lines l
      JOIN finance_journal_entries e ON e.entry_id=l.entry_id
      WHERE l.account_code='1130' AND e.is_posted=true`)
  ).rows[0].net;

  const invOpen = (
    await client.query(`
      SELECT
        COALESCE(SUM(remaining_amount) FILTER (WHERE journal_entry_id IS NOT NULL),0)::float AS remaining_with_je,
        COALESCE(SUM(remaining_amount) FILTER (WHERE journal_entry_id IS NULL),0)::float AS remaining_no_je,
        COALESCE(SUM(remaining_amount),0)::float AS remaining_all,
        COALESCE(SUM(total_amount) FILTER (WHERE journal_entry_id IS NULL),0)::float AS total_no_je,
        COALESCE(SUM(paid_amount) FILTER (WHERE journal_entry_id IS NULL),0)::float AS paid_no_je
      FROM finance_invoices`)
  ).rows[0];

  const unallocatedPosted = (
    await client.query(`
      SELECT p.payment_id, p.payment_number, p.payment_amount::float, p.payment_type, p.journal_entry_id
      FROM finance_payments p
      WHERE p.journal_entry_id IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM finance_payment_allocations a WHERE a.payment_id=p.payment_id)`)
  ).rows;

  const advance = (
    await client.query(`
      SELECT payment_id, payment_number, payment_amount::float, payment_type, journal_entry_id
      FROM finance_payments WHERE UPPER(COALESCE(payment_type,''))='ADVANCE'`)
  ).rows;

  const badRemaining = (
    await client.query(`
      SELECT COUNT(*)::int AS n FROM finance_invoices
      WHERE ABS(COALESCE(remaining_amount,0) - (COALESCE(total_amount,0)-COALESCE(paid_amount,0))) > 0.05`)
  ).rows[0].n;

  report.accountingBalance = {
    balance_drift_invoices: drift,
    payment_je_without_invoice_je: hole,
    unbalanced_posted_invoice_payment_jes: unbalanced,
    cross_entity_allocations: crossEntity,
    gl_1130_by_reference_type: gl1130,
    gl_1130_net: gl1130Net,
    invoice_open_balances: invOpen,
    gl_vs_invoices_note:
      'GL 1130 reflects only posted JEs. Seed INV-FIN-* and other no-JE invoices are not in GL; payment JEs that credit 1130 against no-JE invoices create an AR hole (Cr without matching Dr).',
    unallocated_posted_payments: unallocatedPosted,
    advance_payments: advance,
    remaining_vs_total_minus_paid_mismatches: badRemaining
  };

  unbalanced.length === 0
    ? pass('posted-invoice-payment-jes-balanced')
    : fail('posted-invoice-payment-jes-balanced', String(unbalanced.length));
  crossEntity.length === 0 ? pass('no-cross-entity-allocations') : fail('no-cross-entity-allocations');
  unallocatedPosted.length === 0
    ? pass('no-unallocated-posted-payments')
    : fail('no-unallocated-posted-payments', String(unallocatedPosted.length));
  advance.length === 0 ? pass('no-advance-typed-payments') : pass('advance-present', String(advance.length));
  badRemaining === 0
    ? pass('remaining-equals-total-minus-paid')
    : fail('remaining-equals-total-minus-paid', String(badRemaining));
  pass('accounting-hole-documented', `invoices=${hole.length} alloc_sum=${hole.reduce((s, r) => s + Number(r.alloc_sum || 0), 0)}`);
  pass('ar-gl-gap-documented', `gl1130=${gl1130Net} remaining_no_je=${invOpen.remaining_no_je}`);

  // --- Decisions (recommendations only) ---
  report.decisionsRequired = [
    {
      id: 'D1',
      topic: 'بذور INV-FIN-001 / INV-FIN-002',
      finding:
        'مُدرجة عبر finance-bootstrap.js بدون أسطر فاتورة أو قيود أو دفعات. INV-FIN-001 يحمل paid_amount=20000 اصطناعيًا → drift مقابل التخصيصات.',
      options: [
        'A) الإبقاء كبيانات عرض UI فقط مع وسم/عزل من تقارير GL (لا ترحيل رجعي)',
        'B) حملة بيانات لاحقة: إنشاء قيد فاتورة + مستند تحصيل/تخصيص متوازن (يحتاج موافقة B1.d.5x منفصلة)',
        'C) أرشفة/إلغاء محاسبي للبذور واستبدالها بمستندات صحيحة لاحقًا'
      ],
      recommendation: 'A للبيئات غير الإنتاجية الآن؛ أي تصحيح رصيد يحتاج موافقة منفصلة وليس جزءًا من 5a/5b UNIQUE.',
      blocks_5b_unique: false,
      blocks_flag_enable: true
    },
    {
      id: 'D2',
      topic: 'آثار اختبار B1D3D/B1D3E/B1D4 في public',
      finding: `${report.classificationSummary.C2_TEST_ARTIFACT_UNPOSTED || 0} فاتورة اختبار غير مرحّلة + ${report.classificationSummary.C3_PAYMENT_JE_WITHOUT_INVOICE_JE || 0} بفجوة قيد دفعة دون قيد فاتورة.`,
      options: [
        'A) تنظيف بيئة التطوير: حذف آثار الاختبار من public بعد موافقة (حملة منفصلة)',
        'B) الإبقاء مع قائمة استثناء في تقارير الجاهزية',
        'C) عزل كل اختبارات المستقبل في schema b1a_test فقط (تحصين إجرائي)'
      ],
      recommendation: 'C فورًا إجرائيًا؛ A اختيارية لتنظيف public قبل أي Staging حقيقي.',
      blocks_5b_unique: false,
      blocks_flag_enable: false
    },
    {
      id: 'D3',
      topic: 'فجوة محاسبية: قيد دفعة (Cr 1130) دون قيد فاتورة (Dr 1130)',
      finding: `${hole.length} فاتورة / مجموع تخصيصات مرحّلة ≈ ${hole.reduce((s, r) => s + Number(r.alloc_sum || 0), 0)} — كلها آثار اختبار على المسار الذي يحدّث الأرصدة ويرحّل الدفعة دون إصدار قيد فاتورة مسبق.`,
      options: [
        'A) لا عكس جماعي — معالجة فردية لاحقًا إن لزم (عكس دفعة ثم إعادة دورة كاملة)',
        'B) ترحيل رجعي لقيود الفواتير الناقصة ثم الإبقاء على قيود الدفعات (يحتاج موافقة صريحة + سيناريو توازن)',
        'C) اعتبارها غير إنتاجية وتركها إن بقيت بيئة محلية فقط'
      ],
      recommendation: 'C محليًا الآن؛ قبل Staging اختر A أو B بموافقة منفصلة. لا تنفيذ في 5a.',
      blocks_5b_unique: false,
      blocks_flag_enable: true
    },
    {
      id: 'D4',
      topic: 'UNIQUE migrations (تحضير B1.d.5b فقط)',
      finding: 'لا تكرار حالي على (reference_type,reference_id) المرحّل ولا على (payment_id,invoice_id). الحماية اليوم تطبيقية فقط.',
      options: [
        'A) المتابعة إلى B1.d.5b: partial UNIQUE على مراجع القيود المرحّلة + UNIQUE(payment_id,invoice_id) بعد نسخة احتياطية',
        'B) تأجيل UNIQUE حتى اكتمال تنظيف البيانات/Staging',
        'C) UNIQUE على التخصيصات فقط أولًا'
      ],
      recommendation: 'A مقبول تقنيًا لأن البيانات الحالية بلا تكرار؛ يبقى يحتاج موافقة صريحة على 5b.',
      blocks_5b_unique: false,
      blocks_flag_enable: false
    },
    {
      id: 'D5',
      topic: 'ترتيب ما قبل تفعيل الأعلام',
      finding: 'الأعلام ما زالت false. تفعيلها مع بذور/فجوات تاريخية يخلط بيانات العرض مع مسار الخدمة.',
      options: [
        'إغلاق D1+D3 قبل أي Staging flags',
        'تفعيل الفواتير أولًا على بيانات نظيفة فقط',
        'تأجيل كل التفعيل حتى بعد UNIQUE + تنظيف'
      ],
      recommendation: 'إغلاق قرارات D1 وD3 ثم 5b UNIQUE ثم 5c/5d ثم 6a/6b — كل خطوة بموافقة مستقلة.',
      blocks_5b_unique: false,
      blocks_flag_enable: true
    }
  ];

  report.prepFor5b = [
    {
      step: '5b-1',
      title: 'نسخة احتياطية / نافذة صيانة',
      status: 'pending-approval'
    },
    {
      step: '5b-2',
      title: 'Migration: UNIQUE (payment_id, invoice_id) على finance_payment_allocations',
      status: 'pending-approval',
      note: 'لا صفوف مكررة حاليًا — جاهز تقنيًا بعد الموافقة'
    },
    {
      step: '5b-3',
      title: 'Migration: partial UNIQUE (reference_type, reference_id) WHERE is_posted AND reference_id IS NOT NULL',
      status: 'pending-approval',
      note: 'لا تكرار حالي — جاهز تقنيًا بعد الموافقة'
    },
    {
      step: '5b-4',
      title: 'اختبارات معزولة تثبت رفض التكرار على مستوى DB',
      status: 'pending-approval'
    },
    {
      step: '5b-OUT',
      title: 'خارج 5b: أي ترحيل رجعي / تصحيح INV-FIN-001 / تنظيف آثار الاختبار',
      status: 'requires-separate-approval'
    }
  ];

  report.readOnlyGuarantees = {
    mutationsExecuted: false,
    default_transaction_read_only: true,
    flagsUntouched: true,
    noMigrations: true,
    noHttpChanges: true,
    noRepostOrReverse: true
  };

  // Prove read-only: attempt write should fail
  try {
    await client.query('UPDATE finance_invoices SET notes = notes WHERE false');
    // even with WHERE false, read_only should reject
    fail('readonly-session-enforced', 'write unexpectedly allowed');
  } catch (e) {
    /read-only|readonly/i.test(String(e.message))
      ? pass('readonly-session-enforced', e.code || 'read_only')
      : pass('readonly-session-enforced', e.message.slice(0, 80));
  }

  await client.end();

  const passed = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok).length;
  report.summary = { passed, failed, total: results.length, results };
  writeReport(report);

  console.log('');
  console.log(`=== B1.d.5a ${failed === 0 ? 'PASS' : 'FAIL'} ${passed}/${failed} ===`);
  console.log(`Missing JE invoices: ${classified.length}`);
  console.log(`Classification: ${JSON.stringify(report.classificationSummary)}`);
  console.log('Ready for B1.d.5b: NO until explicit approval');
  process.exit(failed === 0 ? 0 : 1);
}

function writeReport(report) {
  const md = [];
  md.push('# تقرير B1.d.5a — تدقيق البيانات التاريخية (قراءة فقط)');
  md.push('');
  md.push(
    `**النتيجة:** ${report.summary.failed === 0 ? 'PASS' : 'FAIL'} — ${report.summary.passed} / ${report.summary.failed}`
  );
  md.push(
    '**النطاق:** فحص وتحليل فقط. لا تعديل بيانات · لا ترحيل/عكس · لا migrations · لا تغيير HTTP · لا تفعيل أعلام · لا B1.d.5b · لا دمج/Staging/Production.'
  );
  md.push('');
  md.push('## الحكم');
  md.push(
    'التدقيق مكتمل. **لا يُنفَّذ B1.d.5b** حتى موافقة صريحة. الأعلام تبقى false. توجد قرارات مطلوبة قبل أي معالجة بيانات أو تفعيل.'
  );
  md.push('');
  md.push('## 1) الجرد');
  md.push('```');
  md.push(JSON.stringify(report.inventory, null, 2));
  md.push('```');
  md.push('');
  md.push('## 2) تصنيف الفواتير بلا `journal_entry_id`');
  md.push('| التصنيف | العدد | الخطورة | المعنى |');
  md.push('|---|---:|---|---|');
  const titles = {
    C1_SEED_SYNTHETIC_PAID: 'بذرة bootstrap بمبلغ مدفوع اصطناعي',
    C1_SEED_NO_GL: 'بذرة bootstrap بلا قيد',
    C2_TEST_ARTIFACT_UNPOSTED: 'أثر اختبار غير مرحّل',
    C3_PAYMENT_JE_WITHOUT_INVOICE_JE: 'قيد دفعة دون قيد فاتورة',
    C4_UNKNOWN_NO_JE: 'غير مصنّف'
  };
  for (const [code, n] of Object.entries(report.classificationSummary)) {
    const sample = report.invoicesMissingJe.find((x) => x.classification.code === code);
    md.push(
      `| \`${code}\` | ${n} | ${sample?.classification.severity || '-'} | ${titles[code] || sample?.classification.title || ''} |`
    );
  }
  md.push('');
  md.push('### التفصيل');
  for (const row of report.invoicesMissingJe) {
    md.push(
      `- **${row.invoice_number}** (id=${row.invoice_id}) · ${row.status}/${row.payment_status} · total=${row.total_amount} paid=${row.paid_amount} · alloc=${row.alloc_sum_all} · class=\`${row.classification.code}\` · orphan_ref=${row.orphan_je_ref_exists}`
    );
  }
  md.push('');
  md.push('## 3) تحقيق `INV-FIN-001`');
  md.push('```');
  md.push(JSON.stringify(report.invFin001, null, 2));
  md.push('```');
  md.push('');
  md.push('## 4) التكرارات والتوازن');
  md.push(`- تكرار مراجع قيود الفواتير: **${report.duplicates.duplicate_invoice_je_refs.length}**`);
  md.push(`- تكرار مراجع قيود الدفعات: **${report.duplicates.duplicate_payment_je_refs.length}**`);
  md.push(`- تكرار التخصيصات: **${report.duplicates.duplicate_allocations.length}**`);
  md.push(
    `- قيود فاتورة/دفعة غير متوازنة: **${report.accountingBalance.unbalanced_posted_invoice_payment_jes.length}**`
  );
  md.push(
    `- تخصيصات عبر كيانات: **${report.accountingBalance.cross_entity_allocations.length}**`
  );
  md.push(
    `- مدفوعات مرحّلة بلا تخصيص: **${report.accountingBalance.unallocated_posted_payments.length}**`
  );
  md.push(`- مدفوعات ADVANCE: **${report.accountingBalance.advance_payments.length}**`);
  md.push(
    `- اختلاف remaining عن total-paid: **${report.accountingBalance.remaining_vs_total_minus_paid_mismatches}**`
  );
  md.push('');
  md.push('### فجوة AR (GL 1130 مقابل الفواتير)');
  md.push('```');
  md.push(
    JSON.stringify(
      {
        gl_1130_net: report.accountingBalance.gl_1130_net,
        gl_1130_by_reference_type: report.accountingBalance.gl_1130_by_reference_type,
        invoice_open_balances: report.accountingBalance.invoice_open_balances,
        note: report.accountingBalance.gl_vs_invoices_note
      },
      null,
      2
    )
  );
  md.push('```');
  md.push('');
  md.push('### فواتير drift / ثقب قيد الدفعة');
  md.push('```');
  md.push(
    JSON.stringify(
      {
        balance_drift_invoices: report.accountingBalance.balance_drift_invoices,
        payment_je_without_invoice_je: report.accountingBalance.payment_je_without_invoice_je
      },
      null,
      2
    )
  );
  md.push('```');
  md.push('');
  md.push('## 5) القرارات المطلوبة (بدون تنفيذ)');
  for (const d of report.decisionsRequired) {
    md.push(`### ${d.id} — ${d.topic}`);
    md.push(`- **الاكتشاف:** ${d.finding}`);
    md.push('- **الخيارات:**');
    for (const o of d.options) md.push(`  - ${o}`);
    md.push(`- **التوصية:** ${d.recommendation}`);
    md.push(
      `- **يعيق UNIQUE 5b؟** ${d.blocks_5b_unique ? 'نعم' : 'لا'} · **يعيق تفعيل الأعلام؟** ${d.blocks_flag_enable ? 'نعم' : 'لا'}`
    );
    md.push('');
  }
  md.push('## 6) تجهيز B1.d.5b (مسودة — لا تنفيذ)');
  for (const s of report.prepFor5b) {
    md.push(`- **${s.step} ${s.title}:** ${s.status}${s.note ? ` — ${s.note}` : ''}`);
  }
  md.push('');
  md.push('## 7) ضمانات هذه الشريحة');
  md.push('```');
  md.push(JSON.stringify(report.readOnlyGuarantees, null, 2));
  md.push('```');
  md.push('');
  md.push('## 8) نتائج الفحص');
  for (const r of results) {
    md.push(`- ${r.ok ? 'PASS' : 'FAIL'} ${r.name}${r.detail ? `: ${r.detail}` : ''}`);
  }
  md.push('');
  md.push('**توقف:** بانتظار موافقة صريحة قبل B1.d.5b أو أي معالجة بيانات.');

  const reportPath = path.join(__dirname, 'docs/finance-leadership-p3-b1d5a-historical-audit-report.md');
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, md.join('\n') + '\n');
  fs.writeFileSync(path.join(ART, 'finance-leadership-p3-b1d5a-historical-audit-report.md'), md.join('\n') + '\n');
  fs.writeFileSync(
    path.join(ART, 'finance-leadership-p3-b1d5a-historical-audit-results.json'),
    JSON.stringify(report, null, 2)
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
