# تقرير B1.a — PASS/FAIL

**النتيجة:** PASS — 27 نجاح / 0 فشل

## الحدود الملتزَم بها
- لا migrations على جداول finance العامة
- لا تغيير منطق إنشاء/ترحيل الفواتير أو المدفوعات
- لا feature flags
- لا حذف/تعديل بيانات مالية في `public`
- كتابات الاختبار فقط داخل مخطط معزول `b1a_test` على قاعدة VM المحلية (ليست Production)

## حصر مسارات الترحيل الحية
| Method | Path | Auto JE | ملاحظة |
|--------|------|---------|--------|
| POST | `/finance/invoices` | نعم | finance/api/finance-routes.js |
| PUT | `/finance/invoices/:id` | لا | finance-routes.js |
| DELETE | `/finance/invoices/:id` | لا | deletes invoice; orphans JE |
| POST | `/finance/payments` | نعم | finance-routes.js (wins) |
| PUT/DELETE | `/finance/payments/:id` | لا | finance-routes.js |
| POST | `/finance/journal-entries` | لا | finance-routes.js |
| POST | `/finance/journal-entries/:id/post` | نعم | finance-routes.js |
| POST | `/finance/journal/entries` | لا | finance/api/journal.js |
| PUT/DELETE | `/finance/journal/entries/:id` | لا | DELETE allowed even if POSTED |
| POST/PUT/DELETE | `/finance/journal-lines` | لا | journal-lines.js |
| POST | `/finance/ar-aging/invoices` | لا | second invoice create path |
| DELETE | `/finance/ar-aging/invoices/:id` | لا | ar-aging.js |
| POST/PUT/DELETE | `/finance/payment-allocations` | لا | payment-plans.js |
| POST | `/finance/payroll/runs/:id/post` | نعم | out of mutate-scope; must not break |

## قيود DB لمنع التكرار
- UNIQUE على `(reference_type, reference_id)` للمرحّل: **غير موجود — فجوة مؤكدة**
- UNIQUE الحالي: `entry_number` فقط
- أُثبت في `b1a_test` أن إدراج قيدين POSTED لنفس المرجع **ينجح**

## البيانات التاريخية (قراءة فقط على public)
```json
{
  "invoices": "2",
  "invoices_with_je": "0",
  "invoices_without_je": "2",
  "issued_like_no_je": "2",
  "payments": "0",
  "payments_with_je": "0",
  "journal_entries": "0",
  "posted_jes": "0",
  "duplicatePostedRefs": []
}
```
- السياسة: لا إعادة ترحيل تلقائي للصفوف الحالية.

## المخاطر المكتشفة
### R-DB-001 [high] لا يوجد UNIQUE على (reference_type, reference_id) للقيود المرحّلة
- pg_indexes shows only entry_id PK + entry_number UNIQUE

### R-HIST-001 [medium] فواتير بحالة صادرة/مشابهة بلا journal_entry_id
- issued_like_no_je=2
- سياسة: لا إعادة ترحيل تلقائي في B1 — تُعلَّم كـ unposted legacy؛ الترحيل الصريح لاحقًا في B2

### R-DEL-001 [critical] DELETE /finance/invoices/:id بلا فحص ترحيل
- finance-routes.js deletes allocations/plans/lines/invoice; does not delete or reverse JE
- إجراء B1.a: توثيق فقط — لم يُنفَّذ أي حذف

### R-DEL-002 [critical] DELETE قيد مرحّل مسموح في journal.js
- deleteJournalEntry selects status but deletes without rejecting POSTED; clears payment FK then deletes lines+entry
- إجراء B1.a: توثيق فقط

## defer_invoice_posting=false
Flag not implemented in runtime — equivalent to defer_invoice_posting=false; create invoice still auto-posts. B1.a made no code changes ⇒ behavior unchanged.

## نقاط دمج FinancePostingService
- **POST /finance/invoices**: اليوم=inline JE in handler → B1.b: wrap JE insert; B1.a: no change
- **POST /finance/payments**: اليوم=inline JE → B1.b: wrap JE insert behind flag=off first
- **POST /finance/journal-entries/:id/post**: اليوم=status flip only → B1.b primary adapter
- **POST /finance/journal/entries + DELETE**: اليوم=unprotected → B1.b/c guards
- **journal-lines mutations**: اليوم=unprotected → B1.c assertMutable
- **ar-aging invoice create**: اليوم=invoice only → B1.d document; no auto JE
- **payroll runs/:id/post**: اليوم=separate POSTED insert → B1.a: observe only — do not break
- **payments.js**: اليوم=dead writes → keep shadowed; do not remount

## صلاحيات / تدقيق
```json
{
  "frontendMock": "rbac-system.js exposes invoices.approve / invoices.* (browser mock)",
  "backendEnforcementOnPost": "NOT verified as dedicated journals.post middleware on finance-routes create/post",
  "auditTable": "no finance_audit_log in init-finance-system.sql; employee audit_logs exists elsewhere",
  "requiredForB1b": [
    "journals.post",
    "journals.reverse",
    "invoices.cancel",
    "payments.cancel",
    "finance_audit_log"
  ],
  "tables": {
    "finance_audit": null,
    "audit_logs": "audit_logs"
  }
}
```

## خطة اختبار مستقبلية (B1.b+)
- T-CONC-01: ترحيلان متوازيان لنفس الفاتورة → واحد ينجح؛ الآخر 409
- T-IDEM-01: إعادة Idempotency-Key بعد نجاح → نفس entry_id بلا صف ثانٍ
- T-IDEM-02: نفس المفتاح بجسم مختلف → 409
- T-TX-01: فشل بعد إدراج JE قبل تحديث الفاتورة (محاكاة) → ROLLBACK كامل
- T-BAL-01: أسطر غير متوازنة → 422؛ لا قيد
- T-REV-01: عكس قيد مرحّل → قيد REVERSAL؛ الأصل باقٍ
- T-DEL-01: DELETE فاتورة لها JE → 403/409 بعد B1.c
- T-DEL-02: DELETE قيد POSTED → مرفوض
- T-REG-01: انحدار receivables-collections / journal UI → PASS بلا كسر

## خطة B1.b الدقيقة
### B1.b.1 — إضافة وحدة FinancePostingService (ملف جديد) بدون ربط المسارات
كود جديد خلف require غير مستدعى من routes؛ أو مستدعى فقط من اختبار وحدة
**قبول:** لا تغيير سلوك HTTP؛ اختبار وحدة للتوازن/idempotency in-memory أو b1a_test

### B1.b.2 — Adapter على POST /finance/journal-entries/:id/post فقط
استبدال تحديث الحالة بنداء service.postManualEntry؛ الإبقاء على نفس الاستجابة
**قبول:** ترحيل مسودة يدوية متوازنة ينجح؛ غير المتوازنة 422؛ إعادة الترحيل 409

### B1.b.3 — إضافة POST /finance/journal-entries/:id/reverse
قيد عكسي جديد + روابط؛ بلا حذف الأصل؛ صلاحية journals.reverse
**قبول:** S2/F7/F8 من وثيقة B1

### B1.b.4 — idempotency جدول أو مخزن — يتطلب migration → يحتاج موافقة منفصلة إن لزم M3
إن رُفضت migration: idempotency في الذاكرة/Redis اختياريًا مع الإبقاء على فحص journal_entry_id
**قبول:** T-IDEM-01 يمر على الأقل عبر فحص المرجع

### B1.b.5 — لا تلمس POST invoices/payments بعد في B1.b
تأجيل التوجيه الكامل إلى B1.d بعد موافقة
**قبول:** اختبار انحدار: إنشاء فاتورة ما زال كما قبل (إن بقي السلوك)

### B1.b.out — خارج B1.b
block_posted_mutation (B1.c)، فهارس فريدة (B1.f)، defer_invoice_posting، B2–B6

## نتائج الاختبارات المرجعية
- PASS inventory-paths-count: 15
- PASS inventory-live-auto-post-paths: invoices, payments, payroll(+manual post)
- PASS inventory-payments-js-shadowed
- PASS db-no-unique-on-reference-pair: CONFIRMED GAP: duplicate posts not blocked by DB
- PASS db-unique-entry-number-only
- PASS historical-no-duplicate-posted-refs
- PASS historical-issued-like-without-je: 2
- PASS historical-policy-no-repost: documented: never auto-repost historical rows
- PASS delete-handler-exists
- PASS delete-no-posted-guard-confirmed: risk documented; no data deleted in this run
- PASS journal-delete-risk-documented: no POSTED reject in deleteJournalEntry
- PASS defer-flag-absent-behavior-unchanged
- PASS audit-finance-table-absent-gap
- PASS permissions-matrix-documented
- PASS isolated-invoice-post-balanced: debit=credit=1150.00
- PASS isolated-duplicate-post-possible-without-db-unique: count=2
- PASS isolated-payment-post-balanced
- PASS unbalanced-detectable-before-insert: B1.b must 422 before INSERT
- PASS isolated-schema-commit-only-b1a-test
- PASS public-journal-unchanged: 0
- PASS http-get-invoices: 200
- PASS http-get-payments: 200
- PASS http-get-journals: routes=200/400
- PASS http-delete-not-invoked: DELETE /finance/invoices/:id intentionally not called
- PASS posting-service-integration-map
- PASS future-test-plan-documented: 9
- PASS b1b-plan-documented

**لا دمج / لا Staging / لا Production. بانتظار موافقة صريحة قبل B1.b.**