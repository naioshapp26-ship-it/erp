# تقرير B1.d.3.b — حراسة CRUD تخصيصات المدفوعات

**الاختبارات:** PASS — 29 / 0
**النطاق:** حراسة Backend لمسارات `/finance/payment-allocations` فقط. لا ربط ترحيل مدفوعات · لا migrations · لا حظر مدفوعات غير مخصصة.

## 1) حصر المسارات
| Method | Path | ملف | محروس؟ | ملاحظات |
|---|---|---|---|---|
| POST/PUT/DELETE | /finance/payment-allocations | payment-plans.js | yes | B1.d.3.b target |
| POST | /finance/payments (inline INSERT allocations) | finance-routes.js | no | Out of d.3.b — residual until d.3.d |
| DELETE | /finance/payments/:id | finance-routes.js | yes | Deletes child allocations after payment mutable check |
| DELETE | /finance/invoices/:id | finance-routes.js | - | Deletes allocations by invoice_id after assertInvoiceDeletable |

## 2) قرار العربون / الدفعات المقدمة
```
{
  "payment_type_ADVANCE_in_ui": true,
  "deposits_page_status": "coming_soon",
  "accounting_stance": "عربون/دفعات مقدمة موجودة كـ payment_type=ADVANCE في الواجهة وكصفحة coming_soon. لا يوجد مسار خادمي منفصل لرصيد دائن عميل. مسار POST /payments يسمح allocations=[] مع قيد كامل — خارج d.3.b. حراسة CRUD لا تفرض تخصيصًا كاملًا لمبلغ الدفعة (تسمح بمتبقٍ غير مخصص).",
  "d3b_change": "none — لا حظر على المدفوعات غير المخصصة"
}
```

## 3) الحماية المطبّقة
- رفض create/update/delete إن وُجد قيد PAYMENT مرحّل أو `journal_entry_id` مرحّل → 409 `POSTED_DOCUMENT_LOCKED`
- `assertEntityOwns` على الدفعة والفاتورة من `resolveActor` (جلسة فقط) → 401/403
- رفض كيان مختلف بين دفعة وفاتورة → 403 `ALLOCATION_ENTITY_MISMATCH`
- رفض تجاوز مبلغ الدفعة أو متبقي الفاتورة → 409
- رفض تكرار (payment_id, invoice_id) → 409 `DUPLICATE_ALLOCATION`
- معاملة + `FOR UPDATE` + advisory lock؛ CRUD **لا** يلمس `paid_amount`/`remaining_amount`
- متبقٍ غير مخصص على الدفعة **مسموح** (لا فرض تخصيص كامل)

## 4) نتائج الاختبارات
- PASS server-single-delete-mount
- PASS guards-module-has-mutate
- PASS handlers-use-resolveActor-session
- PASS advance-deposit-documented-not-banned: deposits=coming_soon
- PASS draft-create-ok-no-balance-side-effect: alloc=44
- PASS draft-update-ok
- PASS reject-duplicate-allocation: 409/DUPLICATE_ALLOCATION
- PASS reject-over-payment-amount: 409/OVER_ALLOCATION_PAYMENT
- PASS reject-over-invoice-remaining: 409/OVER_ALLOCATION_INVOICE
- PASS partial-unallocated-payment-allowed: 30/100 remainder intentional
- PASS reject-cross-entity-no-grant: 403/CROSS_ENTITY_DENIED
- PASS reject-cross-entity-alloc-mismatch: 403/ALLOCATION_ENTITY_MISMATCH
- PASS reject-hq-without-grant: 403/CROSS_ENTITY_DENIED
- PASS spoofed-headers-ignored: entity=B1D3B-E1
- PASS reject-unauthenticated: 401/AUTH_REQUIRED
- PASS fixture-payment-posted: links=1
- PASS reject-add-alloc-to-posted: 409/POSTED_DOCUMENT_LOCKED
- PASS reject-update-alloc-posted: 409/POSTED_DOCUMENT_LOCKED
- PASS reject-delete-alloc-posted: 409/POSTED_DOCUMENT_LOCKED
- PASS posted-invoice-balances-stable-after-rejected-crud: {"p":150,"r":0}
- PASS rollback-on-validation-failure: n=0
- PASS concurrent-same-payment-invoice-one-wins: oks=1 fails=1
- PASS draft-delete-ok: 44
- PASS http-login
- PASS http-reject-unauthenticated: 401
- PASS http-draft-create: 4
- PASS http-reject-update-posted: 409
- PASS http-reject-delete-posted: 409
- PASS smoke:/finance

## 5) مخاطر متبقية (خارج d.3.b)
- **R-PAY-CREATE:** POST /finance/payments ما زال يُدرج تخصيصات ويحدّث أرصدة داخل مسار التحصيل الحي — خارج d.3.b
- **R-NO-UNIQUE:** لا UNIQUE(payment_id,invoice_id) في DB — الحماية تطبيقية + قفل

لا d.3.c/d/e · لا d.4+ · لا Payroll · لا دمج/Staging/Production دون موافقة.
