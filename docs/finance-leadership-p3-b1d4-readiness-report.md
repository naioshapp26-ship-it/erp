# تقرير جاهزية B1.d.4 — الدورة المحاسبية المتكاملة (تحليل فقط)

**الاختبارات:** PASS — 43 / 0
**النطاق:** تحليل + اختبارات معزولة. لا migrations · لا تغيير HTTP · لا تعديل تاريخي · لا تفعيل أعلام خارج الاختبارات · لا دمج/Staging/Production.

## الحكم
**جاهزة للتشغيل التشغيلي؟ لا.**
ليست جاهزة للتشغيل: ثغرات critical=0 high=4 (تاريخية/ADVANCE/Idempotency/UNIQUE)

## 1) نتائج الدورة المتكاملة (خدمة = سلوك العلمين true)
- PASS cycle-invoice-post-meta: JE-0215
- PASS cycle-tax-discount-rounding: {"subtotal":100,"discount_amount":5,"tax_amount":14.25,"net":95,"total_amount":109.25,"lines":[{"item_name":"خدمة","quantity":1,"unit_price":100,"tax_percentage":15,"discount_amount":5,"tax_amount":14.25,"line_total":109.25}]}
- PASS cycle-partial-remainder-sum-rounds: 54.63+54.62=109.25
- PASS cycle-partial-collection: {"p":54.63,"r":54.62,"payment_status":"PARTIAL"}
- PASS cycle-cash-account-1110
- PASS cycle-remainder-full-paid: {"p":109.25,"r":0,"payment_status":"PAID"}
- PASS cycle-bank-account-1120
- PASS cycle-full-single-cash: {"payment_status":"PAID","r":0}
- PASS cycle-multi-invoice-one-payment
- PASS cycle-reject-over-allocation
- PASS cycle-reject-mutate-posted-invoice
- PASS cycle-reject-cross-entity-alloc
- PASS cycle-rollback-no-alloc
- PASS cycle-no-orphan-je
- PASS matrix-false-legacy-empty-ok
- PASS matrix-pay-true-rejects-empty
- PASS matrix-both-true-invoice-service: 62
- PASS matrix-both-true-payment-service
- PASS matrix-inv-true-smoke

## 2) التزامن والتكرار
| الحالة | ضمان تطبيقي | ضمان DB | نتيجة |
|---|---|---|---|
| two_payments_same_invoice | FOR UPDATE remaining check in postPaymentReceipt | none (no UNIQUE remaining) | PASS |
| duplicate_payment_je | ALREADY_POSTED + advisory lock | NO partial UNIQUE on (reference_type,reference_id) | PASS |
| duplicate_allocation | DUPLICATE_ALLOCATION in mutatePaymentAllocation | NO UNIQUE(payment_id,invoice_id) | PASS |
| logical_collection_idempotency | none for distinct payment rows | none | DOCUMENTED_GAP |
| post_vs_delete_race | FOR UPDATE + posted lock on DELETE | row locks only | PASS |

## 3) مراجعة تاريخية (قراءة فقط)
```
{
  "invoices_total": 45,
  "invoices_missing_je_id": 27,
  "invoices_missing_je_but_ref_exists": 0,
  "payments_total": 13,
  "payments_missing_je_id": 0,
  "payments_missing_je_but_ref_exists": 0,
  "duplicate_invoice_je_refs": 0,
  "duplicate_payment_je_refs": 0,
  "duplicate_allocations": 0,
  "balance_vs_alloc_drift": 1,
  "unallocated_posted_payments": 0,
  "advance_typed_payments": 0,
  "sample_inv_no_je": [
    {
      "invoice_id": 60,
      "invoice_number": "B1D3E-HTTP-INV-1792441559231",
      "status": "PAID",
      "payment_status": "PAID",
      "entity_id": "HQ001"
    },
    {
      "invoice_id": 57,
      "invoice_number": "B1D4-MX-1792441509960",
      "status": "ISSUED",
      "payment_status": "UNPAID",
      "entity_id": "HQ001"
    },
    {
      "invoice_id": 56,
      "invoice_number": "B1D3E-HTTP-INV-1792441190123",
      "status": "PAID",
      "payment_status": "PAID",
      "entity_id": "HQ001"
    },
    {
      "invoice_id": 53,
      "invoice_number": "B1D4-MX-1792441175257",
      "status": "ISSUED",
      "payment_status": "UNPAID",
      "entity_id": "HQ001"
    },
    {
      "invoice_id": 51,
      "invoice_number": "B1D3E-HTTP-INV-1792440711495",
      "status": "PAID",
      "payment_status": "PAID",
      "entity_id": "HQ001"
    }
  ]
}
```

## 4) سياسة ADVANCE
```
{
  "ui_payment_type_ADVANCE": true,
  "deposits_page": "exists + catalog coming_soon",
  "catalog_status": "coming_soon",
  "dedicated_liability_account": false,
  "note_coa": "لا حساب عربون/إيراد مؤجل مخصص؛ أقرب التزامات عامة 2110 ذمم دائنة — غير مناسب كرصيد دائن عميل تلقائيًا",
  "customer_credit_balance_ledger": false,
  "settlement_mechanism_to_invoices": false,
  "effect_of_unallocated_legacy": "المسار false يرحّل Dr نقد/بنك Cr 1130 بلا تخصيص → يخفض الذمم دون ربط فاتورة؛ خطر محاسبي",
  "service_path_policy": "ALLOCATIONS_REQUIRED — يرفض ADVANCE غير المخصص حتى قرار محاسبي منفصل",
  "recommendation": "قبل التشغيل: قرار محاسبي (حساب التزام عميل + آلية تسوية) أو إبقاء ADVANCE خارج مسار AR المرحّل"
}
```

## 5) اختلافات محاسبية / أمنية (مقارنة المسار القديم vs الخدمة)
| الموضوع | المسار القديم (أعلام false) | مسار الخدمة (أعلام true في الاختبار فقط) |
|---|---|---|
| ترحيل فاتورة | إدراج قيد داخل مسار HTTP القديم | `postInvoiceIssue` + قفل استشاري + ربط `journal_entry_id` |
| ترحيل دفعة بلا تخصيص | مسموح → Dr نقد/بنك Cr 1130 دون فاتورة | مرفوض `ALLOCATIONS_REQUIRED` |
| تجاوز الرصيد | ضعيف/غير موحّد | `OVER_ALLOCATION` + `FOR UPDATE` |
| كيان عبر المستندات | أضعف على إنشاء الدفعة | `ALLOCATION_ENTITY_MISMATCH` / `CROSS_ENTITY_DENIED` |
| تعديل مرحّل | جزئي حسب الحراسة السابقة | `POSTED_DOCUMENT_LOCKED` على فاتورة/دفعة/تخصيص |
| Idempotency-Key | غير موجود | غير موجود (ثغرة موثّقة) |
| UNIQUE DB | غير موجود | غير موجود — الحماية تطبيقية فقط |

## 6) الثغرات المتبقية حسب الخطورة
- **high** `G-IDEMPOTENCY`: لا Idempotency-Key لطلب التحصيل المنطقي — دفعتان مختلفتان لنفس التحصيل المنطقي مسموحتان إن بقي رصيد
- **high** `G-HIST-INV-JE`: فواتير تاريخية بلا journal_entry_id — 27/45 (ref موجود لـ 0)
- **high** `G-HIST-BALANCE-DRIFT`: اختلاف paid_amount عن مجموع تخصيصات مرحّلة — 1 (`INV-FIN-001` / invoice_id=1: paid=20000 vs alloc_posted_sum=0)
- **high** `G-ADVANCE-POLICY`: سياسة ADVANCE غير مكتملة محاسبيًا — واجهة موجودة؛ لا حساب التزام؛ الخدمة ترفض؛ المسار القديم خطر
- **medium** `G-NO-DB-UNIQUE`: لا UNIQUE على مراجع القيود/التخصيصات — الحماية تطبيقية فقط حتى migrations
- **medium** `G-LEGACY-FALSE-FLAGS`: عند الأعلام false تبقى مخاطر المسار القديم — تخصيص فارغ، أرصدة، ضعف كيان على إنشاء الدفعة في المسار القديم

## 7) خطة تفعيل آمنة (خطوات تحتاج موافقة مستقلة)
- **A1 إغلاق بيانات تاريخية قارئة فقط → قرارات:** مراجعة فواتير بلا JE، drift أرصدة، مدفوعات بلا تخصيص مرحّلة
- **A2 UNIQUE migrations (بعد تدقيق):** جزئي (reference_type,reference_id) WHERE posted؛ UNIQUE(payment_id,invoice_id)
- **A3 Idempotency-Key اختياري للتحصيل:** مفتاح عميل/طلب يمنع دفعتين منطقيتين متطابقتين
- **A4 قرار ADVANCE:** حساب التزام + تسوية أو حظر تشغيلي صريح
- **A5 تفعيل علم الفواتير true في staging باختبارات قبول:** مراقبة JE drift / أخطاء ترحيل
- **A6 تفعيل علم المدفوعات true بعد ثبات الفواتير:** مراقبة OVER_ALLOCATION / ALREADY_POSTED / كيان
- **A7 خطة إيقاف العلمين:** إعادة false فورًا؛ المستندات الجديدة تعود للمسار القديم؛ لا عكس جماعي — معالجة فردية بالعكس المحاسبي
- **A8 مراقبة:** تنبيهات: قيد مزدوج مرجع، رصيد سالب، فشل ترحيل، CROSS_ENTITY

### دفعات موافقة مقترحة
- **B1.d.5a:** تدقيق بيانات تاريخية + تقرير قرار فقط — موافقة: explicit
- **B1.d.5b:** migrations UNIQUE بعد موافقة بيانات — موافقة: explicit
- **B1.d.5c:** Idempotency-Key للتحصيل (اختياري) — موافقة: explicit
- **B1.d.5d:** قرار/تنفيذ ADVANCE محاسبي — موافقة: explicit
- **B1.d.6a:** Staging: علم الفواتير true فقط — موافقة: explicit
- **B1.d.6b:** Staging: علم المدفوعات true — موافقة: explicit
- **B1.d.6c:** مراقبة + runbook إيقاف — موافقة: explicit
- **Production:** تفعيل تشغيلي — موافقة: explicit-separate

## 8) انحدار
- PASS test-finance-p3-b1b-posting-service.js SUMMARY PASS
- PASS test-finance-p3-b1c-posted-guards.js SUMMARY PASS
- PASS test-finance-p3-b1d1-posting-helpers.js known residual after B1.d.2/d.3 wire (routes behind flags)
- PASS test-finance-p3-b1d3b-alloc-guards.js B1 PASS footer
- PASS test-finance-p3-b1d3c-payment-meta.js B1 PASS footer
- PASS test-finance-p3-b1d3e-payment-entity.js B1 PASS footer

## 9) كل النتائج
- PASS flags-default-false
- PASS prior-wire-present-analysis-only-slice
- PASS cycle-invoice-post-meta: JE-0215
- PASS cycle-tax-discount-rounding: {"subtotal":100,"discount_amount":5,"tax_amount":14.25,"net":95,"total_amount":109.25,"lines":[{"item_name":"خدمة","quantity":1,"unit_price":100,"tax_percentage":15,"discount_amount":5,"tax_amount":14.25,"line_total":109.25}]}
- PASS cycle-partial-remainder-sum-rounds: 54.63+54.62=109.25
- PASS cycle-partial-collection: {"p":54.63,"r":54.62,"payment_status":"PARTIAL"}
- PASS cycle-cash-account-1110
- PASS cycle-remainder-full-paid: {"p":109.25,"r":0,"payment_status":"PAID"}
- PASS cycle-bank-account-1120
- PASS cycle-full-single-cash: {"payment_status":"PAID","r":0}
- PASS cycle-multi-invoice-one-payment
- PASS cycle-reject-over-allocation
- PASS cycle-reject-mutate-posted-invoice
- PASS cycle-reject-cross-entity-alloc
- PASS cycle-rollback-no-alloc
- PASS cycle-no-orphan-je
- PASS conc-two-payments-same-invoice-one-wins: oks=1
- PASS conc-reject-double-je-same-payment
- PASS conc-single-je-ref
- PASS conc-reject-dup-allocation
- PASS idempotency-gap-two-requests-two-payments: no Idempotency-Key
- PASS conc-post-vs-delete: posted/POSTED_DOCUMENT_LOCKED
- PASS historical-scan-readonly: inv_no_je=27 pay_no_je=0 drift=1 unalloc_posted=0
- PASS advance-analysis-documented: coming_soon
- PASS flag-matrix-up:both-false: :3010
- PASS flag-matrix-up:inv-true-only: :3013
- PASS flag-matrix-up:pay-true-only: :3014
- PASS flag-matrix-up:both-true: :3015
- PASS matrix-false-legacy-empty-ok
- PASS matrix-pay-true-rejects-empty
- PASS matrix-both-true-invoice-service: 62
- PASS matrix-both-true-payment-service
- PASS matrix-inv-true-smoke
- PASS reg:test-finance-p3-b1b-posting-service.js: SUMMARY PASS
- PASS reg:test-finance-p3-b1c-posted-guards.js: SUMMARY PASS
- PASS reg:test-finance-p3-b1d1-posting-helpers.js: known residual after B1.d.2/d.3 wire (routes behind flags)
- PASS reg:test-finance-p3-b1d3b-alloc-guards.js: B1 PASS footer
- PASS reg:test-finance-p3-b1d3c-payment-meta.js: B1 PASS footer
- PASS reg:test-finance-p3-b1d3e-payment-entity.js: B1 PASS footer
- PASS reg-static:b1d2-b1d3d-wire-present
- PASS reg-static:flags-still-default-false
- PASS smoke-payroll-hr: pr=200 hr=200
- PASS readiness-verdict-not-ready-for-ops: ليست جاهزة للتشغيل: ثغرات critical=0 high=4 (تاريخية/ADVANCE/Idempotency/UNIQUE)

**تأكيد:** الأعلام افتراضيًا false · لم يُعدَّل Production · لم تُغيَّر مسارات HTTP في هذه الشريحة · لا B1.d.5/d.6/B2.
