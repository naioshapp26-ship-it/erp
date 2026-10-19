# P3 / B1 — وثيقة تنفيذ تفصيلية
## خدمة الترحيل المحاسبي الموحّدة (Posting Service)

**الحالة:** تصميم للتنفيذ — **بانتظار موافقة صريحة قبل أي كود أو migration.**  
**النطاق:** B1 فقط. لا B2–B6. لا دمج. لا نشر Staging/Production.

---

## 0) قرارات التصميم المعتمدة (مُجمَّدة لهذه الوثيقة)

| # | القرار | الأثر على B1 |
|---|--------|-------------|
| 1 | الاعتماد والترحيل منفصلان؛ إنشاء الفاتورة لا يُنشئ قيدًا تلقائيًا | B1 يجهّز فصل المسار؛ تفعيل «إنشاء بلا ترحيل» كامل في B2 — في B1 نوقف/نوحّد الترحيل الفوري خلف feature flag |
| 2 | تحويل عرض السعر → فاتورة `DRAFT` بلا ترحيل | خارج B1 (B3)؛ B1 لا يلمس عروض الأسعار |
| 3 | B1 أول دفعة مرشحة — **هذه ليست موافقة تنفيذ** | هذه الوثيقة فقط |
| 4 | SAR فقط في P3؛ التصميم لا يمنع عملات لاحقًا | مبالغ JE بـ DECIMAL؛ حقل `currency_code` اختياري لاحقًا على المستند؛ القيد يسجّل بمبلغ الأساس |
| 5 | لا عتبات 10k/50k في B2؛ تصميم قابل للضبط لاحقًا | B1 لا يطبّق عتبات مبالغ؛ يخزّن هيكل صلاحيات `post`/`reverse` جاهزًا للعتبات |

---

## 1) حصر مسارات الإنشاء/الترحيل الحالية (مصدر الحقيقة التشغيلي)

### 1.1 ترتيب التسجيل في `server.js` (مهم للظلّ)

1. `app.use('/finance', financeRoutes)` ← **يفوز** على مسارات متطابقة لاحقًا  
2. مسارات `journal.js` تحت `/finance/journal/entries…`  
3. مسارات `payments.js` تحت `/finance/payments…` ← **مظلّلة** لـ POST/PUT/DELETE  
4. `payroll` تحت `/finance/payroll`  
5. `journal-lines` تحت `/finance/journal-lines`  
6. `payment-allocations` تحت `/finance/payment-allocations`  
7. `ar-aging` تحت `/finance/ar-aging/invoices…`

### 1.2 جدول المسارات الحية التي تكتب الدفاتر

| Method + Path | الملف | يكتب | قيد تلقائي؟ | حالة القيد | حسابات | ملاحظات مخاطر |
|---|---|---|---|---|---|---|
| `POST /finance/invoices` | `finance-routes.js` | invoices + lines + **JE+lines** | **نعم فور الإنشاء** | POSTED | Dr 1130 / Cr 4100 / Cr 2140 | يكسر قرار فصل الاعتماد/الترحيل |
| `PUT /finance/invoices/:id` | `finance-routes.js` | invoice | لا | — | — | لا يمنع تعديل فاتورة لها JE |
| `DELETE /finance/invoices/:id` | `finance-routes.js` | DELETE invoice (+lines/plans/allocs) | — | — | — | **لا فحص ترحيل**؛ يترك JE يتيمًا |
| `POST /finance/payments` | `finance-routes.js` **(يفوز)** | payment + allocs? + invoice paid + **JE** | **نعم** | POSTED | Dr 1110\|1120 / Cr 1130 | يعتمد على `allocations[]` |
| `PUT/DELETE /finance/payments/:id` | `finance-routes.js` | update/delete | لا | — | — | حذف بلا فحص ترحيل |
| `POST /finance/journal-entries` | `finance-routes.js` | JE+lines | يدوي | **DRAFT** | من الجسم | مسار صحيح للفصل |
| `POST /finance/journal-entries/:id/post` | `finance-routes.js` | status→POSTED | ترحيل | POSTED | — | بلا idempotency قوية / بلا reverse |
| `POST /finance/journal/entries` | `journal.js` | JE+lines | يدوي | DRAFT افتراضي | من الجسم | مسار موازٍ للواجهة |
| `PUT /finance/journal/entries/:id` | `journal.js` | يعيد كتابة الأسطر | — | — | — | **يسمح بتعديل مرحّل** |
| `DELETE /finance/journal/entries/:id` | `journal.js` | DELETE JE+lines | — | — | — | **يحذف حتى POSTED** |
| `POST/PUT/DELETE /finance/journal-lines…` | `journal-lines.js` | أسطر منفردة | — | — | — | بلا حراسة POSTED |
| `POST /finance/ar-aging/invoices` | `ar-aging.js` | invoice فقط | **لا** | — | — | مسار إنشاء ثانٍ بلا قيد |
| `DELETE /finance/ar-aging/invoices/:id` | `ar-aging.js` | DELETE إن بلا allocs/plans | — | — | — | بلا فحص JE |
| `POST/PUT/DELETE /finance/payment-allocations` | `payment-plans.js` | allocations | لا | — | — | يمكن كسر تطابق السند/الفاتورة |
| `POST /finance/payroll/runs/:id/post` | `payroll-routes.js` | JE+lines + ربط run | نعم | POSTED | 5100/2150 | **نمط مرجعي** لإعادة الاستخدام (خارج نطاق تعديل payroll في B1) |

### 1.3 مسارات مظلّلة / ميتة للكتابة

| Path | المقصود | الواقع |
|------|---------|--------|
| `POST/PUT/DELETE /finance/payments` عبر `payments.js` | إنشاء دفعة بلا JE (`COMPLETED`) | **لا تُستدعى**؛ `finance-routes` يفوز |
| `GET /finance/payments/test` | health لـ payments.js | ما زال يصل |

**استنتاج توافق الصفحات:** واجهات تستدعي `POST /finance/payments` تحصل اليوم على مسار الترحيل الفوري في `finance-routes` — ليس مسار `payments.js` الميت. خطة B1 يجب ألا تكسر هذا الاستدعاء الشكلي؛ تغيّر **سلوك** الترحيل خلف نفس الـ URL عبر خدمة موحّدة + flag.

### 1.4 خارج النطاق (لا تُخلط مع دفتر finance_*)

- `POST /api/invoices` → جدول `invoices` القديم  
- `finance_quick_offers`، expenses، fixed-assets (تخزين `journal_entry_id` اختياري بلا إنشاء قيد)  
- schemas موازية (`tenant-migrations/002`, smart-collection)

---

## 2) مصدر الحقيقة المحاسبي ومنع ازدواج القيود

### 2.1 مصدر الحقيقة

| الطبقة | المصدر |
|--------|--------|
| دفتر الأستاذ | **فقط** `finance_journal_entries` + `finance_journal_lines` حيث `status='POSTED'` و`is_posted=true` |
| مستندات التشغيل | `finance_invoices` / `finance_payments` تشير إلى القيد عبر `journal_entry_id` |
| الأرصدة | مشتقة من القيود المرحّلة (views موجودة مثل `finance_account_balances`) — لا يُعاد بناء الرصيد من حذف صفوف |

### 2.2 قاعدة الذهب لمنع الازدواج

لكل زوج `(reference_type, reference_id, posting_kind)` يوجد **على الأكثر قيد مرحّل فعّال واحد** غير معكوس.

- `posting_kind` أمثلة: `INVOICE_ISSUE`, `PAYMENT_RECEIPT`, `MANUAL`, `REVERSAL`  
- قيد `REVERSAL` يشير إلى الأصل عبر `reversal_of_entry_id` ولا يُعدّ تكرارًا لنفس `posting_kind` للمستند  
- بعد العكس: المستند يفقد «الترحيل الفعّال» (`journal_entry_id` يُصفَّر أو يُؤشَّر `posted_state=REVERSED`) ويُسمح بترحيل جديد صريح فقط بسياسة منفصلة (في B1: **لا إعادة ترحيل تلقائية بعد العكس** إلا عبر عملية `repost` مستقبلية خارج B1)

### 2.3 آليات منع الازدواج (طبقات)

1. **قيود DB:** فهرس فريد جزئي على القيود المرحّلة غير المعكوسة  
2. **قفل صف المستند:** `SELECT … FOR UPDATE` داخل المعاملة قبل الترحيل  
3. **Idempotency-Key** على طلبات `POST …/post` و`POST …/reverse`  
4. **رفض التطبيق:** إن وُجد `journal_entry_id` فعّال → `409 Conflict`

---

## 3) تصميم خدمة الترحيل الموحّدة `FinancePostingService`

### 3.1 المسؤولية الوحيدة

كل إنشاء قيد مرحّل أو عكسه يمر عبر هذه الخدمة. المسارات الحالية تصبح adapters رفيعة.

```
HTTP handlers (finance-routes / journal / payments / …)
        │
        ▼
FinancePostingService
  · postInvoice(invoiceId, ctx)
  · postPayment(paymentId, ctx)      // B1: يغلف السلوك الحالي خلف flag
  · postManualEntry(entryId, ctx)
  · reverseEntry(entryId, ctx)
  · assertMutable(document)          // حراسة التعديل/الحذف
        │
        ▼
PostgreSQL transaction (BEGIN…COMMIT)
```

**خارج B1:** `postQuote` لا يوجد. تحويل العرض في B3 يستدعي إنشاء فاتورة DRAFT فقط.

### 3.2 عقد `post*(…)` — سلوك مطلوب

مدخلات السياق `ctx`:
- `userId`, `entityId`, `idempotencyKey?`, `requestId`, `reason?`

خطوات داخل معاملة واحدة:

1. التحقق من الصلاحية (`journals.post` أو صلاحية المستند المكافئة).  
2. `SELECT … FOR UPDATE` للمستند (فاتورة/دفعة/قيد مسودة).  
3. التحقق من الحالة المسموح ترحيلها:
   - B1 للفواتير الحالية: إن كان flag `defer_invoice_posting=false` (توافق): الإبقاء على سلوك الإنشاء+ترحيل مؤقتًا **عبر الخدمة**.  
   - عند تفعيل الفصل (B2): الترحيل فقط من `APPROVED` عبر endpoint مستقل.  
4. فحص idempotency:
   - إن وُجدت استجابة مخزّنة لنفس المفتاح خلال نافذة TTL → إعادة نفس النتيجة.  
   - إن وُجد قيد فعّال لنفس المرجع → `409` أو إعادة نفس `journal_entry_id` إن كان المفتاح مطابقًا.  
5. بناء الأسطر والتحقق: `Σ debit = Σ credit` و`> 0`؛ وإلا `422 Unbalanced`.  
6. `INSERT` قيد `POSTED` + أسطر + ربط `journal_entry_id` + تحديث حالة المستند.  
7. كتابة `finance_audit_log`.  
8. `COMMIT`.  
9. تخزين نتيجة idempotency.

### 3.3 Idempotency — تصميم قابل لإعادة المحاولة دون تكرار

**جدول مقترح:** `finance_idempotency_keys`

| عمود | وصف |
|------|-----|
| `idempotency_key` | PK (نص من العميل أو مُشتق) |
| `scope` | مثل `post:invoice:123` |
| `request_hash` | hash للجسم؛ تعارض الجسم مع نفس المفتاح → `409` |
| `response_status` / `response_body` | لإعادة الرد |
| `created_at` / `expires_at` | TTL مقترح 24–72 ساعة |
| `user_id` / `entity_id` | عزل |

**قواعد:**
- إعادة نفس المفتاح + نفس الجسم بعد نجاح → نفس `journal_entry_id` (200/201).  
- نفس المفتاح + جسم مختلف → 409.  
- انقطاع بعد COMMIT وقبل الرد → إعادة المحاولة بنفس المفتاح تُرجع النتيجة المخزّنة دون قيد ثانٍ.  
- انقطاع قبل COMMIT → لا قيد؛ إعادة المحاولة تنشئ مرة واحدة.

**رأس HTTP:** `Idempotency-Key` (اختياري في B1 للمسارات القديمة؛ **إلزامي** على `/post` و`/reverse` الجديدين).

### 3.4 قوالب الأسطر (SAR — مع قابلية توسع لاحقة)

| العملية | مدين | دائن |
|---------|------|------|
| إصدار فاتورة | 1130 = total | 4100 = net؛ 2140 = tax |
| قبض | 1110 أو 1120 = amount | 1130 = amount |
| عكس | عكس كل سطر للأصل | — |

الحسابات تُحل عبر `account_code` مع إمكانية تجاوز من إعدادات الصفحة لاحقًا (B5). لا تُرمَّز العملة في القيد في P3؛ المبلغ واحد بـ SAR.

### 3.5 Feature flags (B1)

| Flag | افتراضي مقترح عند الإطلاق التدريجي | المعنى |
|------|-----------------------------------|--------|
| `finance.posting_service.enabled` | false → true تدريجيًا | توجيه الكتابة عبر الخدمة |
| `finance.defer_invoice_posting` | **false في B1** (توافق) → true في B2 | إنشاء فاتورة بلا JE |
| `finance.block_posted_mutation` | true مع تفعيل الخدمة | منع DELETE/PUT للمرحّل |
| `finance.allow_legacy_payment_shadow` | false | لا تُفعَّل `payments.js` للكتابة |

---

## 4) العكس المحاسبي (Reverse) — بلا حذف/تعديل للقيد المرحّل

### 4.1 قواعد

1. القيد `POSTED` **غير قابل للتعديل** وغير قابل للحذف.  
2. العكس = قيد جديد `entry_type='REVERSAL'`:
   - `reversal_of_entry_id = original.entry_id`
   - أسطر معكوسة (مدين↔دائن بنفس المبالغ والحسابات)  
3. على الأصل: `reversed_by_entry_id = new.entry_id` (أو status فرعي `REVERSED` إن أُضيف).  
4. المستند التشغيلي:
   - فاتورة: `status='CANCELLED'` + `cancelled_*`؛ لا حذف.  
   - دفعة: `status='CANCELLED'`؛ إعادة احتساب `paid_amount`/`remaining` للفواتير المخصصة داخل **نفس المعاملة**.  
5. لا يُسمح بعكس العكس في B1 (منع سلاسل معقدة)؛ التصحيح = قيد يدوي لاحقًا أو عملية `repost` في دفعة لاحقة.

### 4.2 Endpoint مقترح

`POST /finance/journal-entries/:id/reverse`  
Body: `{ reason: string }` + رأس Idempotency-Key  
صلاحية: `journals.reverse`

### 4.3 ما يُستبدل

- `DELETE /finance/journal/entries/:id` للمرحّل → **403/409** مع رسالة تطلب reverse.  
- المسودات `DRAFT` فقط يمكن حذفها إن بلا تأثير تشغيلي.

---

## 5) التزامن والذرّية

### 5.1 معاملة واحدة لكل ترحيل/عكس

يجب أن تشمل المعاملة:

| الترحيل | العكس |
|---------|-------|
| قفل المستند | قفل القيد الأصلي + المستند |
| إدراج JE+lines | إدراج JE عكسي+lines |
| تحديث `journal_entry_id` وحالة المستند | تحديث روابط العكس + حالة المستند + أرصدة مدفوعة |
| audit + idempotency row | audit + idempotency |

فشل أي خطوة → `ROLLBACK` كامل. لا حالة «مستند مرحّل بلا قيد» ولا «قيد بلا تحديث مستند».

### 5.2 سباقات متزامنة

- طلبان متوازيان لترحيل نفس الفاتورة: الأول ينجح؛ الثاني بعد `FOR UPDATE` يرى `journal_entry_id` → 409.  
- ترحيل + حذف متزامن: الحذف يُرفض إن `block_posted_mutation` أو إن بدأت معاملة الترحيل.  
- تعديل تخصيصات أثناء ترحيل دفعة: قفل الدفعة يمنع؛ allocations تُقرأ داخل المعاملة.

### 5.3 عدم توازن المدين/الدائن

التحقق قبل الإدراج؛ عند الفشل لا يُكتب شيء → `422` + audit فشل اختياري.

---

## 6) حماية المستندات المرحّلة

### 6.1 مصفوفة الحراسة (بعد تفعيل `block_posted_mutation`)

| العملية | مسودة بلا JE | لها JE فعّال / POSTED |
|---------|--------------|------------------------|
| تعديل بنود فاتورة | مسموح (B2 يضيّق أكثر) | **مرفوض** |
| حذف فاتورة | مسموح في B1 بحذر* | **مرفوض** — استخدم cancel+reverse |
| تعديل/حذف قيد | DRAFT فقط | **مرفوض** |
| تعديل/حذف أسطر قيد | DRAFT فقط | **مرفوض** |
| حذف دفعة | بلا JE | **مرفوض** إن مرحّلة |

\* سياسة B1 الموصى بها: حتى المسودة المرتبطة بسياق إنتاج تُفضّل soft-cancel؛ الحذف الصلب يبقى للمسودات الاختبارية فقط خلف صلاحية `invoices.delete` + شرط `journal_entry_id IS NULL`.

### 6.2 نقاط الحقن

- `assertInvoiceMutable(id)` في PUT/DELETE invoices + ar-aging delete  
- `assertPaymentMutable` في PUT/DELETE payments  
- `assertJournalMutable` في journal.js + journal-lines.js  
- تُرفض الطلبات بـ `403` أو `409` مع رمز خطأ ثابت: `POSTED_DOCUMENT_LOCKED`

---

## 7) سياسة البيانات التاريخية

| فئة البيانات | السياسة في B1 |
|--------------|----------------|
| فاتورة موجودة + `journal_entry_id` + قيد POSTED | **مرحّلة تاريخيًا** — لا إعادة ترحيل؛ تُعامل كمصدر حقيقة |
| فاتورة بلا قيد (مثل من ar-aging) | تبقى كما هي؛ الترحيل لاحقًا عبر endpoint صريح (B2) بعد الاعتماد |
| قيد POSTED يتيم (فاتورة محذوفة قديمًا) | لا حذف تلقائي؛ تقرير كشف orphans في اختبارات B1؛ إصلاح يدوي/سكريبت اختياري لاحقًا بموافقة |
| قيد DRAFT قديم | قابل للترحيل عبر `/post` الموحّد أو الحذف إن مسموح |
| محاولات «إصلاح» بإعادة تشغيل create | **ممنوعة** |

**لا backfill ترحيل جماعي في B1.**

---

## 8) توافق مسارات المدفوعات والصفحات الحالية

### 8.1 الواقع

- الصفحات تستدعي غالبًا `/finance/payments` و`/finance/invoices` عبر `finance-routes` (الرابح).  
- `payments.js` مظلّل للكتابة — الإبقاء عليه كملف دون إعادة تفعيله يمنع سلوكين متضاربين.

### 8.2 خطة التوافق في B1

1. **لا تغيير لعقود الـ URL** العامة التي تستخدمها الصفحات.  
2. داخليًا: `POST /finance/payments` و`POST /finance/invoices` يستدعيان `FinancePostingService` عند تفعيل العلم.  
3. سلوك مرئي أثناء B1 مع `defer_invoice_posting=false`: إنشاء فاتورة ما زال يرحّل (توافق) لكن عبر خدمة idempotent + حراسة حذف.  
4. توثيق: `payments.js` write handlers تُعلَّم deprecated؛ لا تُرفع أولوية تسجيلها.  
5. صفحات `payments.html` / `receivables-collections.html` / `invoices-budgets-master.html` تبقى تعمل؛ اختبارات انحدار إلزامية.  
6. عند الانتقال لـ B2 وتفعيل `defer_invoice_posting`: إنشاء الفاتورة يعيد المستند بلا `journal_entry_id`؛ زر ترحيل جديد — **يتطلب موافقة B2 منفصلة**.

---

## 9) صلاحيات Backend وسجل التدقيق

### 9.1 صلاحيات خادمية مطلوبة في B1

| صلاحية | الاستخدام |
|--------|-----------|
| `journals.post` | ترحيل قيد يدوي / ترحيل عبر الخدمة |
| `journals.reverse` | عكس قيد مرحّل |
| `journals.read` | عرض |
| `invoices.post` | ترحيل فاتورة (يُفعَّل بقوة في B2؛ في B1 يُربط بالإنشاء إن لم يُؤجَّل) |
| `invoices.cancel` | إلغاء تشغيلي (يستدعي reverse إن لزم) |
| `payments.post` | ترحيل سند |
| `payments.cancel` | إلغاء سند مرحّل |
| `invoices.delete` | فقط إن `journal_entry_id IS NULL` |
| `journals.delete` | فقط DRAFT |

**عتبات المبالغ:** جداول/إعداد `approval_thresholds` تُصمَّم كـ JSON اختياري على الدور — **غير مفعّلة** في B1/B2 حسب القرار؛ الخدمة تقرأ العتبة إن وُجدت لاحقًا ولا تفشل إن غابت.

التحقق: middleware خادمي (لا الاعتماد على `rbac-system.js` للمتصفح وحده). رفض 403 مع audit.

### 9.2 سجل التدقيق

**جدول مقترح:** `finance_audit_log`

| عمود | مثال |
|------|------|
| `id`, `created_at` | — |
| `actor_user_id`, `entity_id` | من الجلسة |
| `action` | `POST_INVOICE`, `REVERSE_ENTRY`, `BLOCKED_DELETE`, `POST_REJECTED_UNBALANCED`… |
| `resource_type`, `resource_id` | invoice/payment/journal |
| `before_json`, `after_json` | مختصر |
| `idempotency_key`, `request_id` | ربط |
| `ip`, `user_agent` | اختياري |

الكتابة داخل نفس المعاملة عند النجاح؛ عند الرفض المهم (محاولة حذف مرحّل) يمكن الكتابة في معاملة قصيرة منفصلة بعد الرفض.

---

## 10) Migrations المتوقعة لـ B1 (للموافقة — لا تنفيذ الآن)

| # | التغيير | المخاطر | تخفيف |
|---|---------|---------|--------|
| M1 | أعمدة على `finance_journal_entries`: `reversal_of_entry_id`, `reversed_by_entry_id`, `posting_kind` | منخفضة إن nullable | إضافة فقط |
| M2 | فهرس فريد جزئي لمنع ترحيل مكرر لنفس المرجع غير المعكوس | فشل إن وُجدت مكررات حالية | سكربت كشف مكررات قبل الفهرس؛ إصلاح يدوي بموافقة |
| M3 | `finance_idempotency_keys` | منخفضة | جدول جديد |
| M4 | `finance_audit_log` | منخفضة | جدول جديد |
| M5 | اختياري: `finance_feature_flags` أو استخدام إعداد موجود | منخفضة | تجنب إن وُجد مخزن إعدادات |

**لا تغيير** على مبالغ/حالات الفواتير التاريخية في migration.  
**لا** إسقاط أعمدة.  
**لا** ترحيل جماعي.

ترتيب آمن: M3 → M4 → M1 → كشف مكررات → M2 → تفعيل العلم تدريجيًا.

---

## 11) خطة تنفيذ تدريجية داخل B1 (بعد موافقة التنفيذ)

| خطوة | المحتوى | معيار خروج |
|------|---------|------------|
| B1.a | إنشاء الخدمة + جداول idempotency/audit (خلف flag=off) | نشر كود بلا تغيير سلوك |
| B1.b | توجيه `journal-entries/:id/post` عبر الخدمة + reverse endpoint | اختبارات post/reverse تمر |
| B1.c | تفعيل `block_posted_mutation` على DELETE/PUT | محاولات الحذف تُرفض مع audit |
| B1.d | توجيه إنشاء فاتورة/دفعة الحالي عبر الخدمة (ما زال يرحّل) | نفس النتائج المحاسبية + idempotency |
| B1.e | تقرير orphans/مكررات + توثيق | لا فهرس فريد حتى صفر مكررات |
| B1.f | تفعيل الفهرس الفريد إن نظيف | 409 على التكرار |

كل خطوة Draft PR منفصل أو commits واضحة؛ لا Staging بلا موافقة.

---

## 12) خطة التراجع الآمنة

| مستوى | الإجراء |
|-------|---------|
| علم | `finance.posting_service.enabled=false` يعيد المسارات القديمة فورًا |
| حراسة | `block_posted_mutation=false` يعيد السماح السابق (غير مستحسن إلا طوارئ) |
| كود | revert PR؛ الجداول الجديدة تبقى فارغة بلا ضرر |
| فهرس فريد M2 | `DROP INDEX` إن منع عمليات شرعية بسبب بيانات سيئة |
| بيانات | **لا** reverse جماعي تلقائي عند التراجع؛ العكوس اليدوية تبقى في الدفتر |

التراجع لا يحذف `finance_audit_log` ولا القيود التي أُنشئت أثناء التفعيل.

---

## 13) سيناريوهات الاختبار (نجاح / فشل)

### 13.1 نجاح

| ID | السيناريو | التوقع |
|----|-----------|--------|
| S1 | ترحيل قيد يدوي متوازن DRAFT→POSTED | قيد مرحّل؛ أسطر محفوظة؛ audit |
| S2 | عكس قيد مرحّل بسبب صالح | قيد REVERSAL؛ روابط ثنائية؛ الأصل غير محذوف |
| S3 | إنشاء فاتورة عبر المسار الحالي (flag توافق) عبر الخدمة | JE واحد؛ balances؛ نفس الحسابات 1130/4100/2140 |
| S4 | إنشاء دفعة مع allocations | JE قبض؛ تحديث paid/remaining؛ تخصيصات |
| S5 | إعادة نفس Idempotency-Key بعد نجاح | نفس journal_entry_id؛ لا صف قيد إضافي |
| S6 | صفحة receivables-collections تعمل بعد التوجيه | انحدار UI/API |
| S7 | payroll post الحالي ما زال يعمل (غير مكسور) | لا انحدار |

### 13.2 فشل / حماية

| ID | السيناريو | التوقع |
|----|-----------|--------|
| F1 | ترحيل مكرر لنفس الفاتورة (مفتاح مختلف) | 409؛ قيد واحد فقط في DB |
| F2 | طلبان متوازيان لترحيل نفس المستند | واحد 2xx؛ الآخر 409 |
| F3 | أسطر غير متوازنة | 422؛ لا قيد؛ لا تغيير مستند |
| F4 | DELETE فاتورة لها journal_entry_id | 409/403؛ POSTED_DOCUMENT_LOCKED؛ audit |
| F5 | DELETE قيد POSTED | مرفوض؛ يُطلب reverse |
| F6 | PUT أسطر قيد POSTED عبر journal-lines | مرفوض |
| F7 | reverse بلا صلاحية | 403 |
| F8 | reverse مرتين | الثانية 409 |
| F9 | Idempotency-Key مكرر بجسم مختلف | 409 |
| F10 | انقطاع محاكى بعد COMMIT قبل الرد + إعادة المحاولة | لا قيد ثانٍ؛ إعادة نفس الرد |
| F11 | انقطاع قبل COMMIT + إعادة | قيد واحد بعد إعادة ناجحة |
| F12 | مستخدم بلا `journals.post` | 403 |

### 13.3 بيئة الاختبار

- قاعدة محلية/tenant تجريبي على `:3010`  
- لا Staging  
- تحقق SQL مباشر لعدد القيود والأسطر والأرصدة  
- Puppeteer انحدار للصفحات: journal، payments، receivables-collections، invoices-budgets-master  

---

## 14) معايير قبول B1 (Definition of Done)

1. كل ترحيل/عكس لفاتورة/دفعة/قيد يدوي يمر عبر `FinancePostingService` عند تفعيل العلم.  
2. لا حذف/تعديل لقيود POSTED.  
3. لا حذف فاتورة/دفعة لها قيد فعّال.  
4. الترحيل المكرر مرفوض أو idempotent دون صف ثانٍ.  
5. العكس ينشئ قيدًا جديدًا مرتبطًا دون مسح الأصل.  
6. ترحيل المستند وتحديث حالته في معاملة واحدة.  
7. صلاحيات Backend للـ post/reverse/cancel مُتحقَّق منها باختبارات.  
8. audit يُسجَّل للنجاح وللرفض الحرج.  
9. الصفحات الحالية لا تنكسر (اختبارات انحدار خضراء).  
10. سياسة التاريخ: لا إعادة ترحيل جماعي.  
11. وثيقة تشغيل الأعلام وخطوات التراجع مرفقة مع PR التنفيذ.  
12. **لا نشر Staging/Production دون موافقة صريحة مستقلة.**

---

## 15) صراحة ما هو خارج B1

- عروض أسعار / تحويل (B3)  
- حالات DRAFT→APPROVED للفاتورة وUI الإنشاء بلا ترحيل الكامل (B2) — B1 يجهّز الخدمة والأعلام فقط  
- عتبات 10k/50k  
- عملات متعددة  
- توحيد payroll على الخدمة (اختياري لاحقًا؛ عدم كسره كافٍ)  
- إعدادات صفحات المستندات (B5)  
- ZATCA / عربون / خصومات localStorage  

---

## 16) مطلوب منك قبل أي تنفيذ

موافقة صريحة جديدة تنص على:
1. اعتماد هذه الوثيقة (أو تعديلات محددة).  
2. الإذن بتنفيذ B1.a… على Draft PR.  
3. الإذن بتنفيذ migrations M1–M4 (أو مجموعة فرعية) على بيئة التطوير فقط.  

بدون ذلك: **لا كود، لا migrations، لا تعديل ترحيل.**

---

*مراجع الفحص: `finance/api/finance-routes.js`, `journal.js`, `payments.js`, `journal-lines.js`, `ar-aging.js`, `payment-plans.js`, `payroll-routes.js`, `server.js` mount order, `finance/database/init-finance-system.sql`.*
