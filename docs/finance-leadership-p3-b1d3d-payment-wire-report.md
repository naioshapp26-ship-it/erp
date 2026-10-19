# تقرير B1.d.3.d — ربط POST /payments خلف علم افتراضي false

**الاختبارات:** PASS — 29 / 0
**النطاق:** ربط `postPaymentReceipt` خلف `FINANCE_POST_PAYMENT_VIA_SERVICE` (default false). لا migrations · لا Staging/Production · لا تفعيل تشغيلي.

## 1) الملفات المعدلة
- finance/api/finance-routes.js
- finance/services/finance-posting-service.js (sorted invoice locks)
- test-finance-p3-b1d3d-payment-wire.js
- docs/finance-leadership-p3-b1d3d-payment-wire-report.md
- test-finance-p3-b1d2-wire.js / test-finance-p3-b1d3c-payment-meta.js (static assert updates)

## 2) فصل المسارين
- `false` → كتلة الترحيل القديمة فقط (`posting_path: legacy`)
- `true` → `postPaymentReceipt` فقط (`posting_path: service`) — لا تشغيل متزامن للمسارين
- العلم افتراضيًا false ولم يُفعَّل خارج عملية الاختبار على :3012

## 3) ADVANCE / غير المخصص
```
{
  "flag_true": "ALLOCATIONS_REQUIRED 422 — لا ترحيل بلا تخصيصات ولا حساب عربون جديد",
  "flag_false": "السلوك القديم كما هو: allocations=[] ما زال يُنشئ قيد Cr 1130 — مخاطر متبقية موثّقة",
  "accounting_decision": "لم يُنشأ حساب دفعات مقدمة؛ يلزم قرار منفصل قبل دعم ADVANCE"
}
```

## 4) نتائج الاختبارات
- PASS flag-default-false
- PASS source-has-flagged-service-path
- PASS source-exclusive-if-else-paths
- PASS payments-js-still-shadowed-order-untouched
- PASS advance-policy-documented
- PASS iso-rollback-no-alloc-throws: ALLOCATIONS_REQUIRED
- PASS iso-no-orphan-je
- PASS spoofed-headers-ignored-actor
- PASS server-false-up: pid=215215
- PASS server-true-up: pid=215230
- PASS http-login-both
- PASS false-legacy-empty-alloc-still-posts: je=41
- PASS true-cash-full: JE-0024
- PASS true-bank-partial: {"p":55.25,"payment_status":"PARTIAL"}
- PASS true-multi-invoice
- PASS reject-over-allocation: 422
- PASS reject-cross-entity: CROSS_ENTITY_DENIED
- PASS spoofed-entity-rejected-or-session-bound: 201
- PASS true-reject-unallocated: ALLOCATIONS_REQUIRED
- PASS reject-repost-same-payment: ALREADY_POSTED
- PASS no-double-je-same-payment: n=1
- PASS concurrent-same-invoice-one-wins: oks=1 fails=1
- PASS idempotency-two-distinct-requests-two-payments: منع إعادة ترحيل نفس payment_id ≠ منع دفعتين مختلفتين
- PASS rollback-full-on-balance-failure
- PASS historical-baseline-recorded: je_before=34 pay_before=0
- PASS b1d3b-reg-reject-delete-posted
- PASS b1d3c-reg-legacy-meta: JE-0031
- PASS b1d2-reg-invoice-flag-default-false
- PASS payroll-hr-unaffected: pr=200 hr=200

## 5) فجوات قبل التشغيل الفعلي
- **G-LEGACY-EMPTY:** عند العلم false ما زال المسار القديم يرحّل بلا تخصيصات (مخاطر ذمم)
- **G-NO-IDEMPOTENCY-KEY:** لا Idempotency-Key لطلب إنشاء مكرر منطقيًا — دفعتان مختلفتان مسموحتان إن بقي رصيد
- **G-NO-UNIQUE-PAYMENT-REF:** UNIQUE جزئي على مرجع PAYMENT ما زال غير مُطبَّق (migrations ممنوعة)
- **G-D3E:** كيان G3-style على PUT/DELETE payments لم يُنفَّذ (d.3.e)

**Production:** لم يُعدَّل. **علم الفواتير:** يبقى false. لا d.3.e · لا d.4+ · لا Payroll تغيّر · لا دمج.
