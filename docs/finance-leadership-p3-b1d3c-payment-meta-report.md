# تقرير B1.d.3.c — محاذاة metadata قيد التحصيل

**الاختبارات:** PASS — 25 / 0
**النطاق:** محاذاة `postPaymentReceipt` مع المسار الحي فقط. لا ربط POST /payments · لا migrations · لا تغيير ADVANCE · لا Production.

## 1) الملفات المعدلة
- finance/services/finance-payment-journal-meta.js (new)
- finance/services/finance-posting-service.js (postPaymentReceipt metadata)
- test-finance-p3-b1d3c-payment-meta.js
- docs/finance-leadership-p3-b1d3c-payment-meta-report.md

## 2) تكافؤ metadata قبل / بعد
| الحقل | قبل | بعد | التكافؤ |
|---|---|---|---|
| entry_number | JE-PAY-#### | JE-#### | MATCH live |
| description | تحصيل {payment_number} | قيد آلي - دفعة رقم {payment_number} | MATCH live |
| reference_number | null | payment_number | MATCH live |
| reference_type / reference_id | PAYMENT / payment_id | PAYMENT / payment_id | MATCH (unchanged) |
| line cash/bank description | قبض {payment_number} | دفعة من {customer_name} | MATCH live |
| line AR description | ذمم مدينة | ذمم مدينة - {customer_name} | MATCH live |
| posted_at / posted_by | NOW() / actor.userId | null / null (live behavior); audit via writeAudit + created_by=trusted actor | MATCH live; audit not weakened |
| accounts / amounts | 1110|1120 / 1130 + roundMoney(stored) | same | UNCHANGED by design |

## 3) اختلافات متبقية
- **created_by:** الحي يستخدم x-user-id أو system؛ الخدمة تستخدم actor.userId من الجلسة الموثوقة — أقوى تدقيقًا، مقصود
- **allocations required:** الخدمة ما زالت ترفض allocations فارغة (422) بينما الحي يسمح [] مع قيد كامل — سلوكي، ليس metadata؛ يُعالَج في خطة d.3.d
- **invoice balance CASE SQL:** صيغتان مختلفتان للـ remaining/status بعد التحصيل — خارج نطاق محاذاة metadata

## 4) ADVANCE / غير المخصص
```
{
  "current": "الحي يسمح POST /payments مع allocations=[] وpayment_type=ADVANCE في الواجهة؛ صفحة العربون coming_soon. الخدمة ترفض الترحيل بلا تخصيصات.",
  "gap": "لا قيد التزام عميل/رصيد دائن منفصل للعربون. لا تغيير في d.3.c.",
  "d3c_change": "none"
}
```

## 5) انحدار B1.d.3.b
- PASS b1d3b-reg-draft-create-no-balance-side-effect
- PASS b1d3b-reg-reject-add-posted: 409/POSTED_DOCUMENT_LOCKED
- PASS b1d3b-reg-reject-update-posted: 409/POSTED_DOCUMENT_LOCKED
- PASS b1d3b-reg-reject-delete-posted: 409/POSTED_DOCUMENT_LOCKED
- PASS b1d3b-reg-cross-entity: 403/ALLOCATION_ENTITY_MISMATCH
- PASS b1d3b-reg-concurrency-one-wins: oks=1
- PASS b1d3b-reg-rollback-on-failure

## 6) خطة ثغرات التحصيل قبل الربط (d.3.d — تحليل فقط)
### d3d.1 — حراسة تخصيصات داخل POST /payments
- إعادة استخدام فحوصات mutatePaymentAllocation (كيان، تكرار، تجاوز متبقي/مبلغ) قبل INSERT
- قفل فواتير FOR UPDATE + advisory على كل invoice_id في allocations
### d3d.2 — حماية أرصدة الفواتير المرحّلة
- assertInvoiceMutable أو مسار خدمة يحدّث الأرصدة فقط داخل ترحيل محكوم
- منع UPDATE paid/remaining عبر مسار جانبي بعد وجود JE مرحّل للفاتورة إلا عبر التحصيل
### d3d.3 — تزامن ومنع تجاوز المستحق
- معاملة واحدة: قفل دفعة+فواتير → تحقق remaining → إدراج تخصيصات → قيد → تحديث أرصدة
- رفض OVER_ALLOCATION عند سباق طلبين
### d3d.4 — ملكية الكيان
- assertEntityOwns على الدفعة وكل فاتورة تخصيص من resolveActor فقط
- رفض ALLOCATION_ENTITY_MISMATCH
### d3d.5 — الدفعات غير المخصصة / ADVANCE
- لا افتراض اكتمال محاسبي للعربون
- قرار صريح قبل الربط: (أ) السماح بقيد بلا تخصيص مع حساب التزام عميل منفصل، أو (ب) رفض الترحيل بلا تخصيصات كما تفعل الخدمة الآن، أو (ج) تأجيل ADVANCE خارج مسار AR
- توثيق الفجوة: الحي يرحّل Cr 1130 حتى بدون تخصيص — قد يُفرّغ ذمم بلا ربط فاتورة
### d3d.6 — منع قيدين لنفس الدفعة + حدود idempotency
- القفل التطبيقي الحالي + ALREADY_POSTED كافٍ قبل UNIQUE جزئي
- منع إعادة ترحيل نفس payment_id ≠ منع دفعتين مختلفتين لنفس طلب التحصيل المنطقي
- idempotency اختياري لاحقًا عبر Idempotency-Key/client_request_id — خارج الحد الأدنى للربط
### d3d.7 — الربط خلف علم
- FINANCE_POST_PAYMENT_VIA_SERVICE default false
- مسار العلم يستدعي postPaymentReceipt بعد إدراج الدفعة+التخصيصات
- مسار false يبقى الحي؛ منع تشغيل المسارين معًا لنفس الطلب

## 7) نتائج الاختبارات
- PASS payments-route-not-wired
- PASS no-payment-flag-yet
- PASS service-uses-JE-legacy-prefix
- PASS advance-policy-unchanged-documented
- PASS meta-cash-full: JE-0050
- PASS meta-profile-flag
- PASS cash-full-balances
- PASS meta-bank-partial: JE-0052
- PASS bank-uses-1120
- PASS meta-multi-invoice: JE-0055
- PASS multi-invoice-balances
- PASS rounding-je-matches-stored: 10.01
- PASS rounding-meta-still-legacy
- PASS reject-repost-same-payment: 409/ALREADY_POSTED
- PASS reject-hq-without-grant: 403/CROSS_ENTITY_DENIED
- PASS helper-line-strings
- PASS b1d3b-reg-draft-create-no-balance-side-effect
- PASS b1d3b-reg-reject-add-posted: 409/POSTED_DOCUMENT_LOCKED
- PASS b1d3b-reg-reject-update-posted: 409/POSTED_DOCUMENT_LOCKED
- PASS b1d3b-reg-reject-delete-posted: 409/POSTED_DOCUMENT_LOCKED
- PASS b1d3b-reg-cross-entity: 403/ALLOCATION_ENTITY_MISMATCH
- PASS b1d3b-reg-concurrency-one-wins: oks=1
- PASS b1d3b-reg-rollback-on-failure
- PASS public-je-unchanged: n=34
- PASS smoke:/finance

**Production:** لم يُعدَّل. **ربط المدفوعات:** false. **علم فاتورة:** لم يُفعَّل.

لا d.3.d/e · لا B2 · لا Payroll · لا دمج/Staging/Production دون موافقة.
