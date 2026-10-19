# تقرير تحليل B1.d.3 — المدفوعات والتخصيصات (بلا تنفيذ)

**الاختبارات:** PASS — 27 / 0
**النطاق:** تحليل + اختبارات معزولة فقط. لا تعديل HTTP · لا ترحيل · لا migrations · لا دمج.

## 1) خريطة المسارات والجداول

| Method | Path | الملف | حي؟ | قيد؟ | أرصدة فاتورة؟ | ملاحظات |
|---|---|---|---|---|---|---|
| POST | `/finance/payments` | finance-routes.js | true | true | yes if allocations provided | Mounted via app.use(/finance) BEFORE payments.js — live winner |
| POST | `/finance/payments` | payments.js | false | false | false | Shadowed by finance-routes (latent risk if mount order changes) |
| PUT/DELETE | `/finance/payments/:id` | finance-routes.js | true | - | - | assertPaymentMutable (posted JE lock) — no entity ownership gate like G3 invoices |
| PUT/DELETE | `/finance/payments/:payment_id` | payments.js | false | - | - | Shadowed; weak header entity_id check only; no posted JE guard |
| POST/PUT/DELETE | `/finance/payment-allocations` | payment-plans.js via server.js | true | false | false | CRITICAL: can mutate allocations without touching balances or checking posted payment |
| PUT | `/finance/invoices/:id` | finance-routes.js | true | - | can set paid_amount/remaining/payment_status if assertInvoiceMutable passes | Blocked when JE linked; still balance path for unposted |
| PUT | `/finance/ar-aging/invoices/:id` | ar-aging.js | true | - | yes paid/remaining/status | assertInvoiceMutable |
| POST | `/finance/payment-plans` | payment-plans.js | true | - | plan paid/remaining only (not invoice AR directly in create) |  |
| service | `postPaymentReceipt (unwired)` | finance-posting-service.js | false | true | - |  |

**جداول:** `finance_payments`, `finance_payment_allocations`, `finance_invoices` (paid/remaining/status), `finance_journal_entries/lines`.

## 2) مقارنة التحصيل الحالي × postPaymentReceipt

| الجانب | الحالي | الخدمة | التكافؤ |
|---|---|---|---|
| الحسابات | Dr 1110|1120 / Cr 1130 | نفس الحسابات | MATCH |
| مبلغ القيد | payment_amount من الطلب (JS) | roundMoney(payment.payment_amount) المخزّن | CONDITIONAL |
| الضريبة في قيد التحصيل | غير مستخدمة | غير مستخدمة | MATCH (N/A) |
| التخصيصات | اختيارية؛ إن وُجدت تحدّث الأرصدة قبل JE | إلزامية ومجموعها = مبلغ الدفعة | DIFF سلوكي |
| تجاوز المتبقي | لا فحص OVER_ALLOCATION | OVER_ALLOCATION 422 | DIFF (خدمة أضبط) |
| كيان التخصيص | لا فحص | ALLOCATION_ENTITY_MISMATCH + assertEntityOwns | DIFF |
| ترقيم القيد | JE-#### | JE-PAY-#### | DIFF metadata |
| الوصف / reference_number | قيد آلي - دفعة رقم … + reference_number | تحصيل … بلا reference_number | DIFF metadata |
| حالة الفاتورة بعد التحصيل | PAID/PARTIAL عبر remaining_amount - alloc (تعبير SQL يعتمد قيمة الصف قبل التحديث في CASE) | PAID/PARTIAL عبر total - (paid+alloc) | CONDITIONAL — صيغتان مختلفتان |

## 3) نتائج PASS/FAIL
- PASS mount-finance-routes-wins-post-payments
- PASS allocations-crud-live-unprotected-source
- PASS spec-accounts-amount-match-simple
- PASS spec-metadata-prefix-diff-noted: JE vs JE-PAY
- PASS svc-partial-alloc-balances: {"paid":80,"rem":120,"payment_status":"PARTIAL","status":"PARTIAL"}
- PASS svc-je-cash-ar-match
- PASS svc-multi-invoice-bank-debit
- PASS svc-multi-invoice-fully-paid
- PASS svc-cross-entity-alloc-denied: ALLOCATION_ENTITY_MISMATCH
- PASS svc-hq-without-grant-denied
- PASS spoofed-headers-ignored
- PASS svc-over-allocation
- PASS svc-duplicate-payment-post: ALREADY_POSTED
- PASS svc-allocations-required
- PASS gap-alloc-mutable-after-post-demonstrated: تخصيص مرحّل قابل للتعديل SQL/CRUD — فجوة
- PASS tx-rollback-payment-je-and-balances
- PASS concurrent-same-payment-one-je: refs=1
- PASS two-different-payments-same-invoice-allowed: منع إعادة ترحيل نفس payment_id ≠ منع دفعتين مختلفتين لنفس التحصيل المنطقي
- PASS gap-posted-invoice-balance-mutable-via-payment-style-update: محاكاة مسار التحصيل الحي
- PASS public-payments-unchanged
- PASS public-je-note: before=34 after=34
- PASS gnn-side-review-documented: match=16 other=2 scope=global
- PASS payments-route-not-wired-to-service
- PASS http-login
- PASS smoke:/finance
- PASS smoke:/finance/receivables-collections.html
- PASS smoke:/finance/payroll-runs.html

## 4) الثغرات حسب الخطورة

| شدة | ID | العنوان |
|---|---|---|
| critical | G-ALLOC-1 | CRUD payment-allocations بلا حراسة مرحّل/كيان/رصيد |
| | | يمكن إضافة/تعديل/حذف تخصيص دون تحديث paid/remaining ودون رفض إن كانت الدفعة لها قيد |
| critical | G-PAY-1 | POST /finance/payments يحدّث أرصدة فاتورة مرحّلة بلا assertInvoiceMutable |
| | | مسار التحصيل الحي يزيد paid_amount حتى مع وجود journal_entry_id على الفاتورة |
| high | G-PAY-2 | إنشاء دفعة بلا تخصيصات ما زال يرحّل قيدًا بكامل المبلغ |
| | | الخدمات تتطلب تخصيصات؛ المسار الحالي يسمح allocations=[] مع JE كامل |
| high | G-PAY-3 | لا assertEntityOwns على إنشاء/حذف الدفعة |
| | | entity_id من body/userEntity؛ Admin/HQ بلا تفويض صريح لقائمة كيانات |
| medium | G-PAY-4 | payments.js مظلّل لكنه خطر كامن |
| | | إن تغيّر ترتيب mount يعمل إنشاء بلا JE وبلا حراسة مرحّل |
| medium | G-META-1 | اختلاف metadata قيد التحصيل (خدمة vs حي) |
| | | JE-PAY vs JE-، وصف، reference_number، posted_at، أوصاف الأسطر |
| low | G-REFUND-1 | لا مسار استرداد/عكس دفعة مخصص ظاهر في نطاق AR |
| | | العكس العام reverseEntry للقيود فقط؛ لا refund payment API في الحصر |

## 5) خطة إصلاح التخصيصات
### d3.1 — حراسة payment-allocations CRUD
- رفض POST/PUT/DELETE إن كانت الدفعة journal_entry_id مرحّل أو لها قيد PAYMENT
- assertEntityOwns على دفعة وفاتورة التخصيص
- منع كسر مجموع التخصيصات vs payment_amount دون إعادة ترحيل
### d3.2 — جاهزية postPaymentReceipt (metadata D2-style)
- محاذاة JE- / وصف قيد آلي / reference_number / أوصاف الأسطر مع المسار الحي
- اعتماد roundMoney من الصف المخزّن
- الإبقاء على إلزام التخصيصات
### d3.3 — ربط POST /finance/payments خلف علم
- FINANCE_POST_PAYMENT_VIA_SERVICE default false
- compute/validate allocations → insert payment+allocs → postPaymentReceipt في معاملة واحدة
- منع المسار القديم والجديد معًا
- assertInvoiceMutable أو فحص رصيد داخل الخدمة قبل تحديث الأرصدة
### d3.4 — كيان على DELETE/PUT payments (مثل G3)
- assertEntityOwns من الجلسة + فلتر entity_id في SQL

## 6) دفعات تنفيذ B1.d.3 (للموافقة)
- **B1.d.3.a**: تحليل+اختبارات (هذه الجولة) — موافقة: done-for-analysis
- **B1.d.3.b**: حراسة allocations فقط — موافقة: explicit
- **B1.d.3.c**: محاذاة metadata الخدمة + اختبارات تكافؤ — موافقة: explicit
- **B1.d.3.d**: ربط POST payments خلف علم false — موافقة: explicit
- **B1.d.3.e**: G3-style entity على PUT/DELETE payments — موافقة: explicit

## 7) Migrations / قرارات قبل التنفيذ
- **UNIQUE جزئي على (reference_type, reference_id) WHERE PAYMENT AND posted** — قبل الربط؟ false — موصى بعد تدقيق بيانات؛ الحماية الحالية قفل تطبيقي
- **UNIQUE (payment_id, invoice_id) على allocations؟** — قبل الربط؟ false — يمنع تكرار تخصيص نفس الفاتورة لنفس الدفعة — يحتاج فحص تاريخي
- **تفرد payment_number / invoice_number لكل entity** — قبل الربط؟ false — حاليًا GLOBAL — قرار محاسبي/تشغيلي منفصل

## مراجعة جانبية generateNextNumber (B1.d.2)
- النمط الحالي: `^PREFIX-[0-9]+$`
- نطاق التفرد: **GLOBAL on invoice_number (not per-entity)**
- أرقام مطابقة/غير مطابقة: 16 / 2
- تزامن إنشاءين قد يصطدم بـ UNIQUE العالمي؛ فائز واحد. لا تفرد لكل كيان — نفس INV-0001 لا يمكن لكيانين.
- ربط الفواتير لم يُعدَّل في هذه الجولة: true

## الفرق: إعادة ترحيل الدفعة vs دفعتين
- **نفس payment_id:** الخدمة تمنع القيد المزدوج (قفل+مرجع) → 409.
- **دفعتان مختلفتان** لنفس الفاتورة/طلب منطقي: مسموح ما دام المتبقي يكفي — لا idempotency لمفتاح تحصيل عميل.

لا تنفيذ d.3 · لا d.4+ · لا Payroll · لا دمج/Staging/Production دون موافقة.