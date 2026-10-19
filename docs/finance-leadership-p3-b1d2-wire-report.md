# تقرير تنفيذ ربط B1.d.2 (خلف علم افتراضي false)

**النتيجة:** PASS — 33 / 0
**العلم الافتراضي:** `FINANCE_POST_INVOICE_VIA_SERVICE=false`
**اختبار true:** خادم معزول على `:3011` فقط
**Production/Staging:** لم يُفعَّل · لا دمج · لا نشر

## الملفات التي تغيّرت
- `finance/api/finance-routes.js`
- `test-finance-p3-b1d2-wire.js`
- `docs/finance-leadership-p3-b1d2-wire-report.md`

## نتائج العلم
- **false (:3010):** مسار قديم حصري؛ `posting_via_service=false`
- **true (:3011):** `computeInvoiceTotalsFromLines` + `postInvoiceIssue` داخل معاملة واحدة

## منع القيد المزدوج / التراجع / idempotency
- إعادة ترحيل نفس الفاتورة → 409
- ROLLBACK قبل commit يزيل الفاتورة والقيد
- **idempotency:** لا مفتاح idempotency على POST. التكرار المتسلسل ⇒ فواتير بأرقام مختلفة. التزامن على generateNextNumber قد يصطدم بـ UNIQUE(invoice_number) فيفوز طلب ويُرفض الآخر — موثّق كحد حالي بلا migration قفل. منع قيد مزدوج لنفس invoice_id عبر الخدمة.

## نتائج الاختبارات
- PASS flag-default-false
- PASS source-has-flagged-service-path
- PASS source-exclusive-if-else-paths
- PASS payments-not-wired
- PASS tx-full-rollback-invoice-and-je
- PASS isolated-0.01-amount-match: 0.01
- PASS isolated-duplicate-je-blocked: ALREADY_POSTED
- PASS isolated-single-je-per-invoice
- PASS isolated-hq-cross-deny
- PASS isolated-public-counts-stable-during-b1a-writes
- PASS server-3010-up-flag-false
- PASS server-3011-up-flag-true
- PASS polarity-3011-requires-auth: 401
- PASS polarity-3010-legacy-no-auth-gate: 201
- PASS http-flag-false-create-ok: INV-0014
- PASS http-flag-true-create-ok: INV-0015
- PASS http-flag-true-meta-service
- PASS http-flag-true-balanced-matches-invoice: 322
- PASS http-flag-true-accounts: 1130,4100,2140
- PASS http-flag-true-metadata: JE-0020
- PASS http-flag-true-no-second-je: ALREADY_POSTED
- PASS http-flag-true-edge-0.01-total
- PASS http-flag-true-edge-0.01-je
- PASS http-flag-true-concurrent-race-documented: ok=1 dupRace=1 statuses=[201,500]
- PASS page-smoke:/finance/strategic-financial-reports.html: 200
- PASS page-smoke:/finance/receivables-collections.html: 200
- PASS page-smoke:/finance/operations-sop-finance.html: 200
- PASS page-smoke:/finance/financial-governance-executive.html: 200
- PASS page-smoke:/finance/sales-accounts-operations-mobile.html: 200
- PASS page-smoke:/finance/payroll-runs.html: 200
- PASS page-smoke:/hr: 200
- PASS ar-aging-create-untouched
- PASS production-flag-default-false-confirmed: code default false; :3010 runs without flag

لا دمج / لا نشر / لا d.3+ دون موافقة صريحة.