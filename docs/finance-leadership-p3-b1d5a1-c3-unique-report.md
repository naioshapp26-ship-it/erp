# تقرير B1.d.5a.1 — تحليل C3 + ضوابط public + تصميم UNIQUE (قراءة فقط)

**النتيجة:** PASS — 9 / 0
**النطاق:** تحليل وتقرير فقط. لا تعديل بيانات · لا تنظيف · لا تغيير سكربتات اختبار · لا migrations · لا قيود/عكس · لا HTTP · لا أعلام · لا B1.d.5b · لا دمج/Staging/Production.

## الحكم
كل حالات C3 **اختبارية مؤكدة** (0 غير محسوم). سبب الثقب: إدراج فاتورة في `public` بلا قيد إصدار ثم `POST /finance/payments` (قديم أو خدمة) الذي لا يشترط `invoice.journal_entry_id`. UNIQUE مقترح وجاهز تقنيًا لكن **غير منفّذ**. التشغيل غير معتمد؛ الأعلام false.

## قرارات مبدئية مُعتمدة في هذه الشريحة
- **D1:** Keep INV-FIN-* seeds unchanged; classify as experimental in reports only
- **D2:** Do not clean public test artifacts now; map ingress + propose prevention
- **D3:** Inspect each C3 case individually; no JE create/reverse
- **D4:** Design UNIQUE only — do not apply
- **D5:** Ops not approved; flags false

## 1) حالات C3 — ملخص
```
{
  "distinct_invoices": 12,
  "allocation_rows": 13,
  "test_confirmed": 12,
  "unresolved": 0,
  "attributed_1130_credit_hole": 525.25,
  "root_cause_common": "Tests insert unposted invoices into public, then POST /finance/payments (legacy or service). Neither path requires invoice.journal_entry_id before collecting. Result: Cr 1130 without prior Dr 1130 for that invoice."
}
```

## 2) فحص فردي لحالات C3
### B1D3D-cash-1792439446254-5014 (invoice_id=39) — TEST_ONLY
- الكيان: فاتورة `HQ001` · الحالة PAID/PAID · total=120 paid=120 remaining=0
- قيد الفاتورة: `null` · orphan_ref=false
- المصدر: **TEST_CONFIRMED** · test-finance-p3-b1d3d-payment-wire.js
- الآلية: seedPublicInvoice() INSERT INTO public.finance_invoices (no invoice JE) → HTTP POST /finance/payments on flag-true :3012 (or concurrent cases) posts PAYMENT JE
- فجوة HTTP/خدمة: Both legacy and service payment paths credit 1130 without requiring invoice.journal_entry_id
- أثر الأستاذ: ينقص Dr 1130 للإصدار ≈ 120؛ Cr 1130 منسوب للتحصيل عبر التخصيص ≈ 120 → ثقب AR ≈ 120
  - دفعة PAY-0001 (id=6) كيان=HQ001 مبلغ=120 تخصيص=120 طريقة=CASH notes=`B1D3D-WIRE` → قيد JE-0024 (entry_id=42)
    - أسطر القيد: `[{"line_number":1,"account_code":"1110","debit":120,"credit":0},{"line_number":2,"account_code":"1130","debit":0,"credit":120}]`

### B1D3D-bank-1792439446274-6981 (invoice_id=40) — TEST_ONLY
- الكيان: فاتورة `HQ001` · الحالة PARTIAL/PARTIAL · total=200 paid=55.25 remaining=144.75
- قيد الفاتورة: `null` · orphan_ref=false
- المصدر: **TEST_CONFIRMED** · test-finance-p3-b1d3d-payment-wire.js
- الآلية: seedPublicInvoice() INSERT INTO public.finance_invoices (no invoice JE) → HTTP POST /finance/payments on flag-true :3012 (or concurrent cases) posts PAYMENT JE
- فجوة HTTP/خدمة: Both legacy and service payment paths credit 1130 without requiring invoice.journal_entry_id
- أثر الأستاذ: ينقص Dr 1130 للإصدار ≈ 200؛ Cr 1130 منسوب للتحصيل عبر التخصيص ≈ 55.25 → ثقب AR ≈ 55.25
  - دفعة PAY-0002 (id=7) كيان=HQ001 مبلغ=55.25 تخصيص=55.25 طريقة=BANK notes=`B1D3D-WIRE` → قيد JE-0025 (entry_id=43)
    - أسطر القيد: `[{"line_number":1,"account_code":"1120","debit":55.25,"credit":0},{"line_number":2,"account_code":"1130","debit":0,"credit":55.25}]`

### B1D3D-m1-1792439446283-7238 (invoice_id=41) — TEST_ONLY
- الكيان: فاتورة `HQ001` · الحالة PAID/PAID · total=30 paid=30 remaining=0
- قيد الفاتورة: `null` · orphan_ref=false
- المصدر: **TEST_CONFIRMED** · test-finance-p3-b1d3d-payment-wire.js
- الآلية: seedPublicInvoice() INSERT INTO public.finance_invoices (no invoice JE) → HTTP POST /finance/payments on flag-true :3012 (or concurrent cases) posts PAYMENT JE
- فجوة HTTP/خدمة: Both legacy and service payment paths credit 1130 without requiring invoice.journal_entry_id
- أثر الأستاذ: ينقص Dr 1130 للإصدار ≈ 30؛ Cr 1130 منسوب للتحصيل عبر التخصيص ≈ 30 → ثقب AR ≈ 30
  - دفعة PAY-0003 (id=8) كيان=HQ001 مبلغ=100 تخصيص=30 طريقة=CASH notes=`B1D3D-WIRE` → قيد JE-0026 (entry_id=44)
    - أسطر القيد: `[{"line_number":1,"account_code":"1110","debit":100,"credit":0},{"line_number":2,"account_code":"1130","debit":0,"credit":100}]`

### B1D3D-m2-1792439446284-5428 (invoice_id=42) — TEST_ONLY
- الكيان: فاتورة `HQ001` · الحالة PAID/PAID · total=70 paid=70 remaining=0
- قيد الفاتورة: `null` · orphan_ref=false
- المصدر: **TEST_CONFIRMED** · test-finance-p3-b1d3d-payment-wire.js
- الآلية: seedPublicInvoice() INSERT INTO public.finance_invoices (no invoice JE) → HTTP POST /finance/payments on flag-true :3012 (or concurrent cases) posts PAYMENT JE
- فجوة HTTP/خدمة: Both legacy and service payment paths credit 1130 without requiring invoice.journal_entry_id
- أثر الأستاذ: ينقص Dr 1130 للإصدار ≈ 70؛ Cr 1130 منسوب للتحصيل عبر التخصيص ≈ 70 → ثقب AR ≈ 70
  - دفعة PAY-0003 (id=8) كيان=HQ001 مبلغ=100 تخصيص=70 طريقة=CASH notes=`B1D3D-WIRE` → قيد JE-0026 (entry_id=44)
    - أسطر القيد: `[{"line_number":1,"account_code":"1110","debit":100,"credit":0},{"line_number":2,"account_code":"1130","debit":0,"credit":100}]`

### B1D3D-spoof-1792439446302-6694 (invoice_id=45) — TEST_ONLY
- الكيان: فاتورة `HQ001` · الحالة PAID/PAID · total=22 paid=22 remaining=0
- قيد الفاتورة: `null` · orphan_ref=false
- المصدر: **TEST_CONFIRMED** · test-finance-p3-b1d3d-payment-wire.js
- الآلية: seedPublicInvoice() INSERT INTO public.finance_invoices (no invoice JE) → HTTP POST /finance/payments on flag-true :3012 (or concurrent cases) posts PAYMENT JE
- فجوة HTTP/خدمة: Both legacy and service payment paths credit 1130 without requiring invoice.journal_entry_id
- أثر الأستاذ: ينقص Dr 1130 للإصدار ≈ 22؛ Cr 1130 منسوب للتحصيل عبر التخصيص ≈ 22 → ثقب AR ≈ 22
  - دفعة PAY-0004 (id=9) كيان=HQ001 مبلغ=22 تخصيص=22 طريقة=CASH notes=`B1D3D-WIRE` → قيد JE-0027 (entry_id=45)
    - أسطر القيد: `[{"line_number":1,"account_code":"1110","debit":22,"credit":0},{"line_number":2,"account_code":"1130","debit":0,"credit":22}]`

### B1D3D-dup-1792439446312-4177 (invoice_id=46) — TEST_ONLY
- الكيان: فاتورة `HQ001` · الحالة PAID/PAID · total=18 paid=18 remaining=0
- قيد الفاتورة: `null` · orphan_ref=false
- المصدر: **TEST_CONFIRMED** · test-finance-p3-b1d3d-payment-wire.js
- الآلية: seedPublicInvoice() INSERT INTO public.finance_invoices (no invoice JE) → HTTP POST /finance/payments on flag-true :3012 (or concurrent cases) posts PAYMENT JE
- فجوة HTTP/خدمة: Both legacy and service payment paths credit 1130 without requiring invoice.journal_entry_id
- أثر الأستاذ: ينقص Dr 1130 للإصدار ≈ 18؛ Cr 1130 منسوب للتحصيل عبر التخصيص ≈ 18 → ثقب AR ≈ 18
  - دفعة PAY-0005 (id=10) كيان=HQ001 مبلغ=18 تخصيص=18 طريقة=CASH notes=`B1D3D-WIRE` → قيد JE-0028 (entry_id=46)
    - أسطر القيد: `[{"line_number":1,"account_code":"1110","debit":18,"credit":0},{"line_number":2,"account_code":"1130","debit":0,"credit":18}]`

### B1D3D-conc-1792439446323-7822 (invoice_id=47) — TEST_ONLY
- الكيان: فاتورة `HQ001` · الحالة PAID/PAID · total=50 paid=50 remaining=0
- قيد الفاتورة: `null` · orphan_ref=false
- المصدر: **TEST_CONFIRMED** · test-finance-p3-b1d3d-payment-wire.js
- الآلية: seedPublicInvoice() INSERT INTO public.finance_invoices (no invoice JE) → HTTP POST /finance/payments on flag-true :3012 (or concurrent cases) posts PAYMENT JE
- فجوة HTTP/خدمة: Both legacy and service payment paths credit 1130 without requiring invoice.journal_entry_id
- أثر الأستاذ: ينقص Dr 1130 للإصدار ≈ 50؛ Cr 1130 منسوب للتحصيل عبر التخصيص ≈ 50 → ثقب AR ≈ 50
  - دفعة PAY-0006 (id=11) كيان=HQ001 مبلغ=50 تخصيص=50 طريقة=CASH notes=`B1D3D-CONC-1792439446323-a` → قيد JE-0029 (entry_id=47)
    - أسطر القيد: `[{"line_number":1,"account_code":"1110","debit":50,"credit":0},{"line_number":2,"account_code":"1130","debit":0,"credit":50}]`

### B1D3D-idem-1792439446333-2357 (invoice_id=48) — TEST_ONLY
- الكيان: فاتورة `HQ001` · الحالة PAID/PAID · total=80 paid=80 remaining=0
- قيد الفاتورة: `null` · orphan_ref=false
- المصدر: **TEST_CONFIRMED** · test-finance-p3-b1d3d-payment-wire.js
- الآلية: seedPublicInvoice() INSERT INTO public.finance_invoices (no invoice JE) → HTTP POST /finance/payments on flag-true :3012 (or concurrent cases) posts PAYMENT JE
- فجوة HTTP/خدمة: Both legacy and service payment paths credit 1130 without requiring invoice.journal_entry_id
- أثر الأستاذ: ينقص Dr 1130 للإصدار ≈ 80؛ Cr 1130 منسوب للتحصيل عبر التخصيص ≈ 80 → ثقب AR ≈ 80
  - دفعة PAY-0007 (id=12) كيان=HQ001 مبلغ=40 تخصيص=40 طريقة=CASH notes=`idem-1` → قيد JE-0030 (entry_id=48)
    - أسطر القيد: `[{"line_number":1,"account_code":"1110","debit":40,"credit":0},{"line_number":2,"account_code":"1130","debit":0,"credit":40}]`
  - دفعة PAY-0008 (id=13) كيان=HQ001 مبلغ=40 تخصيص=40 طريقة=CASH notes=`idem-2` → قيد JE-0031 (entry_id=49)
    - أسطر القيد: `[{"line_number":1,"account_code":"1110","debit":40,"credit":0},{"line_number":2,"account_code":"1130","debit":0,"credit":40}]`

### B1D3E-HTTP-INV-1792440711495 (invoice_id=51) — TEST_ONLY
- الكيان: فاتورة `HQ001` · الحالة PAID/PAID · total=20 paid=20 remaining=0
- قيد الفاتورة: `null` · orphan_ref=false
- المصدر: **TEST_CONFIRMED** · test-finance-p3-b1d3e-payment-entity.js
- الآلية: INSERT INTO public.finance_invoices (unposted) → HTTP POST /finance/payments on :3010 default-false legacy path posts PAYMENT JE to exercise POSTED_DOCUMENT_LOCKED guards
- فجوة HTTP/خدمة: Legacy POST /finance/payments does not require invoice issue JE before collection
- أثر الأستاذ: ينقص Dr 1130 للإصدار ≈ 20؛ Cr 1130 منسوب للتحصيل عبر التخصيص ≈ 20 → ثقب AR ≈ 20
  - دفعة PAY-0009 (id=17) كيان=HQ001 مبلغ=20 تخصيص=20 طريقة=CASH notes=`B1D3E-HTTP-POSTED` → قيد JE-0032 (entry_id=51)
    - أسطر القيد: `[{"line_number":1,"account_code":"1110","debit":20,"credit":0},{"line_number":2,"account_code":"1130","debit":0,"credit":20}]`

### B1D3E-HTTP-INV-1792441190123 (invoice_id=56) — TEST_ONLY
- الكيان: فاتورة `HQ001` · الحالة PAID/PAID · total=20 paid=20 remaining=0
- قيد الفاتورة: `null` · orphan_ref=false
- المصدر: **TEST_CONFIRMED** · test-finance-p3-b1d3e-payment-entity.js
- الآلية: INSERT INTO public.finance_invoices (unposted) → HTTP POST /finance/payments on :3010 default-false legacy path posts PAYMENT JE to exercise POSTED_DOCUMENT_LOCKED guards
- فجوة HTTP/خدمة: Legacy POST /finance/payments does not require invoice issue JE before collection
- أثر الأستاذ: ينقص Dr 1130 للإصدار ≈ 20؛ Cr 1130 منسوب للتحصيل عبر التخصيص ≈ 20 → ثقب AR ≈ 20
  - دفعة PAY-0011 (id=24) كيان=HQ001 مبلغ=20 تخصيص=20 طريقة=CASH notes=`B1D3E-HTTP-POSTED` → قيد JE-0035 (entry_id=62)
    - أسطر القيد: `[{"line_number":1,"account_code":"1110","debit":20,"credit":0},{"line_number":2,"account_code":"1130","debit":0,"credit":20}]`

### B1D3E-HTTP-INV-1792441559231 (invoice_id=60) — TEST_ONLY
- الكيان: فاتورة `HQ001` · الحالة PAID/PAID · total=20 paid=20 remaining=0
- قيد الفاتورة: `null` · orphan_ref=false
- المصدر: **TEST_CONFIRMED** · test-finance-p3-b1d3e-payment-entity.js
- الآلية: INSERT INTO public.finance_invoices (unposted) → HTTP POST /finance/payments on :3010 default-false legacy path posts PAYMENT JE to exercise POSTED_DOCUMENT_LOCKED guards
- فجوة HTTP/خدمة: Legacy POST /finance/payments does not require invoice issue JE before collection
- أثر الأستاذ: ينقص Dr 1130 للإصدار ≈ 20؛ Cr 1130 منسوب للتحصيل عبر التخصيص ≈ 20 → ثقب AR ≈ 20
  - دفعة PAY-0013 (id=30) كيان=HQ001 مبلغ=20 تخصيص=20 طريقة=CASH notes=`B1D3E-HTTP-POSTED` → قيد JE-0038 (entry_id=72)
    - أسطر القيد: `[{"line_number":1,"account_code":"1110","debit":20,"credit":0},{"line_number":2,"account_code":"1130","debit":0,"credit":20}]`

### B1D3E-HTTP-INV-1792441681810 (invoice_id=64) — TEST_ONLY
- الكيان: فاتورة `HQ001` · الحالة PAID/PAID · total=20 paid=20 remaining=0
- قيد الفاتورة: `null` · orphan_ref=false
- المصدر: **TEST_CONFIRMED** · test-finance-p3-b1d3e-payment-entity.js
- الآلية: INSERT INTO public.finance_invoices (unposted) → HTTP POST /finance/payments on :3010 default-false legacy path posts PAYMENT JE to exercise POSTED_DOCUMENT_LOCKED guards
- فجوة HTTP/خدمة: Legacy POST /finance/payments does not require invoice issue JE before collection
- أثر الأستاذ: ينقص Dr 1130 للإصدار ≈ 20؛ Cr 1130 منسوب للتحصيل عبر التخصيص ≈ 20 → ثقب AR ≈ 20
  - دفعة PAY-0015 (id=36) كيان=HQ001 مبلغ=20 تخصيص=20 طريقة=CASH notes=`B1D3E-HTTP-POSTED` → قيد JE-0041 (entry_id=84)
    - أسطر القيد: `[{"line_number":1,"account_code":"1110","debit":20,"credit":0},{"line_number":2,"account_code":"1130","debit":0,"credit":20}]`

## 3) لماذا يوجد قيد تحصيل دون قيد إصدار؟
1. **اختبار مستقل (السبب المباشر لكل C3 الحالية):** السكربتات تُدرج الفاتورة في `public` كـ ISSUED بلا استدعاء ترحيل فاتورة، ثم تختبر مسار الدفعة فقط.
2. **فجوة مسار HTTP/خدمة (السبب البنيوي الذي يسمح بذلك):** لا `POST /finance/payments` القديم ولا `postPaymentReceipt` يفرضان وجود `finance_invoices.journal_entry_id` قبل التحصيل. لذلك التحقق من الحراسة على الدفعة ينجح محاسبيًا جزئيًا (نقد/بنك + Cr 1130) دون دورة إصدار كاملة.
3. **ليس بيانات تشغيلية غير محسومة في هذه البيئة:** البادئات `B1D3D-*` / `B1D3E-*` والملاحظات `B1D3D-WIRE` / `B1D3E-HTTP-POSTED` تطابق السكربتات حرفيًا.

## 4) اختبارات تكتب إلى `public`
| الملف | INSERT public | search_path→public | يستخدم b1a_test | الخطر |
|---|---|---:|---|---|
| `test-finance-p3-b1a-baseline.js` | — | 1 | true | LOW — switches to public for read/historical scan |
| `test-finance-p3-b1d2-readiness.js` | invoices | 0 | true | HIGH — direct public INSERT |
| `test-finance-p3-b1d3b-alloc-guards.js` | — | 1 | true | LOW — switches to public for read/historical scan |
| `test-finance-p3-b1d3d-payment-wire.js` | invoices | 2 | true | HIGH — direct public INSERT |
| `test-finance-p3-b1d3e-payment-entity.js` | payments, invoices | 0 | true | HIGH — direct public INSERT |
| `test-finance-p3-b1d4-readiness.js` | invoices | 1 | true | HIGH — direct public INSERT |
| `test-finance-p3-b1d5a-historical-audit.js` | — | 1 | false | LOW — switches to public for read/historical scan |
| `test-finance-p3-b1d5a1-c3-unique-analysis.js` | invoices | 2 | true | HIGH — direct public INSERT |

### كيف دخلت البيانات
- **B1D3D:** `seedPublicInvoice` → `INSERT INTO public.finance_invoices` ثم HTTP دفعات على خادم الاختبار.
- **B1D3E:** `INSERT INTO public.finance_invoices` داخل اختبار حراسة PUT/DELETE للدفعة المرحّلة.
- **B1D4 matrix:** `INSERT INTO public.finance_invoices` لمسار both-true (بعضها يبقى C2 إن لم يُحصَّل على نفس الصف).
- **INV-FIN-*:** `finance-bootstrap.js` (بذور عرض — D1 الإبقاء).

## 5) خطة عزل مستقبلية (تصميم فقط — بلا تنفيذ)
```
{
  "status": "DESIGN_ONLY_NOT_EXECUTED",
  "goal": "Prevent future accidental public pollution from finance P3 harnesses",
  "recommended_controls": [
    {
      "id": "ISO-1",
      "title": "Default search_path = b1a_test for unit/service tests",
      "detail": "All direct SQL fixtures use b1a_test; never INSERT INTO public.finance_*"
    },
    {
      "id": "ISO-2",
      "title": "Dedicated HTTP fixture schema or DB for wire tests",
      "detail": "Option A: DATABASE_URL_TEST pointing at naiosh_erp_finance_test. Option B: keep same DB but require search_path + table ownership checks before INSERT"
    },
    {
      "id": "ISO-3",
      "title": "Harness guard assertPublicUntouched",
      "detail": "Before/after counts on public.finance_invoices / payments / journal_entries; fail suite if public grows unexpectedly (except explicitly approved historical RO scans)"
    },
    {
      "id": "ISO-4",
      "title": "Ban list in CI grep",
      "detail": "Fail PR if new test files contain 'INSERT INTO public.finance_' without allowlist comment"
    },
    {
      "id": "ISO-5",
      "title": "Prefix quarantine reporting",
      "detail": "Treat B1D*/INV-FIN-* as experimental in readiness/audit reports (D1/D2 policy)"
    }
  ],
  "note": "B1.d.5a.1 does not change test scripts or DB settings — plan only."
}
```

## 6) تصميم UNIQUE المقترح (غير مطبّق)
```
{
  "status": "PROPOSED_NOT_APPLIED",
  "current_duplicate_scan": {
    "invoice_refs": 0,
    "payment_refs": 0,
    "journal_reversal_refs": 0,
    "allocations": 0,
    "posted_with_null_reference": 14
  },
  "proposed_sql": [
    "CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS uq_finance_je_posted_ref\n  ON finance_journal_entries (reference_type, reference_id)\n  WHERE is_posted = true\n    AND reference_type IS NOT NULL\n    AND reference_id IS NOT NULL;",
    "CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS uq_finance_payment_alloc_pair\n  ON finance_payment_allocations (payment_id, invoice_id);"
  ],
  "rationale": {
    "partial_is_posted": "Draft/unposted rows and in-progress inserts stay outside the unique key until posted",
    "null_excluded": "Manual journals often have NULL reference_*; counted posted_with_null_reference must remain allowed",
    "journal_reversal": "Reversals use reference_type=JOURNAL_REVERSAL and reference_id=original.entry_id — unique allows exactly one active posted reverse per original entry (matches reverseEntry ALREADY_REVERSED intent)",
    "invoice_payment": "One posted JE per INVOICE/PAYMENT reference_id complements advisory locks + ALREADY_POSTED",
    "allocations": "Matches DUPLICATE_ALLOCATION app guard"
  },
  "impact": {
    "posting_happy_path": "No change if app guards hold; unique is last-line defense under races",
    "reverse_path": "First reverse OK; second reverse fails on unique (and app). Does not block creating a new INVOICE/PAYMENT JE for a different document",
    "legacy_false_flags": "Legacy inline JE insert also uses reference_type/id — unique protects legacy too. Empty-allocation legacy payments still create PAYMENT refs (behavioral risk unchanged; unique does not fix empty-alloc policy)",
    "concurrency": "Under two concurrent postPaymentReceipt calls, one wins FOR UPDATE/remaining; loser errors. If app check races, unique prevents double JE",
    "migration_risk": "CONCURRENTLY preferred; requires zero existing duplicates (currently 0). Still needs explicit B1.d.5b approval + backup window"
  },
  "non_goals": [
    "Does not backfill invoice JE for C3",
    "Does not require invoice.journal_entry_id before payment (separate product decision)",
    "Does not enable feature flags"
  ]
}
```

## 7) مرشحون لإصلاح لاحق (قائمة منفصلة — بلا تنفيذ)
### R1 — INV-FIN-001
- السبب: Synthetic paid_amount=20000 without payment/alloc/JE (bootstrap)
- الأثر إن أُصلح: Aligns AR UI with GL; may require invoice JE + collection docs
- التراجع: Restore bootstrap row values from backup; avoid mass reverse
- موافقة: separate explicit

### R2 — INV-FIN-002
- السبب: Seed ISSUED without JE
- الأثر إن أُصلح: Adds Dr 1130 if posted; changes GL AR
- التراجع: Reverse that single JE if created; do not mass reverse
- موافقة: separate explicit

### R3 — C3 invoices (12)
- السبب: Payment Cr 1130 without invoice Dr 1130 — test pollution + HTTP gap demonstration
- الأثر إن أُصلح: Either backfill invoice JEs or reverse payment JEs individually then recreate properly
- التراجع: Per-document reverse only; no bulk reverse
- موافقة: separate explicit; prefer leave in local/dev per D2/D3

### R4 — C2 unposted test invoices (B1D3D/B1D4-MX unpaid)
- السبب: Public clutter; no GL hole until collected
- الأثر إن أُصلح: Cleanup only; no GL if never posted
- التراجع: N/A if deleted from non-prod after backup
- موافقة: separate explicit (D2 currently: do not clean)

### R5 — Product gap: payment without requiring invoice JE
- السبب: Service + legacy both allow collection against unposted invoices
- الأثر إن أُصلح: Prevents future C3-class holes in real ops
- التراجع: Feature-flag the new gate; default off until approved
- موافقة: separate explicit — not UNIQUE, not 5b

## 8) شروط الانتقال إلى B1.d.5b
- **G5b-1:** Explicit approval of UNIQUE SQL design in this report — _pending_
- **G5b-2:** Re-confirm duplicate scan == 0 immediately before migration — _pending_
- **G5b-3:** Backup / restore point for finance_journal_entries + finance_payment_allocations — _pending_
- **G5b-4:** Accounting decisions D1/D3 remain leave-as-is OR separate repair approval completed — UNIQUE must not be bundled with backfills — _accepted-leave-as-is-for-now_
- **G5b-5:** Flags remain false; no Staging/Production activation in 5b — _required_
- **G5b-OUT:** Isolation test-script changes / public cleanup / invoice-JE-required gate are OUT OF 5b — _separate-approvals_

## 9) نتائج الفحص
- PASS c3-cases-loaded: 12 invoices / 13 alloc rows
- PASS c3-all-test-confirmed: 12/12
- PASS c3-no-orphan-invoice-je-refs
- PASS public-writers-scanned: files=8 high=5
- PASS isolation-plan-documented
- PASS unique-candidates-clean: null_ref_posted=14
- PASS later-repair-list-documented: 5
- PASS gates-to-5b-documented
- PASS readonly-enforced: 25006

**توقف:** بانتظار موافقة صريحة قبل B1.d.5b أو أي إصلاح بيانات أو تغيير سكربتات.
