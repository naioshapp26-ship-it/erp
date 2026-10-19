# مراجعة تغطية B1.c + تصميم B1.d
## القيادة المالية 360 — تحليل وتصميم فقط (بلا تنفيذ)

**الحالة:** مراجعة وتصميم للموافقة.  
**غير مسموح في هذه الجولة:** كود B1.d · migrations · تعديل ترحيل تلقائي · دمج · Staging/Production.

---

## أ) حصر مسارات التعديل/الحذف

### أ.1 عائلتان للقيود (مهم)

| العائلة | المسارات | PUT | DELETE | post/reverse |
|---------|----------|-----|--------|--------------|
| A — finance-routes | `/finance/journal-entries` | **لا يوجد** | **لا يوجد** | `POST …/:id/post` · `POST …/:id/reverse` |
| B — journal.js | `/finance/journal/entries` | `PUT …/:entry_id` | `DELETE …/:entry_id` | لا |

لا يوجد `PUT/DELETE` على `/finance/journal-entries/:id`. الحراسة على الحذف/التعديل تقع على عائلة B + `journal-lines`.

### أ.2 جدول التغطية بعد B1.c

| Method + Path | الملف | حراسة B1.c؟ | الحكم |
|---|---|---|---|
| `PUT /finance/journal/entries/:id` | journal.js | نعم `assertJournalEntryMutable` | **محمي** |
| `DELETE /finance/journal/entries/:id` | journal.js | نعم | **محمي** |
| `POST/PUT/DELETE /finance/journal-lines…` | journal-lines.js | نعم (عبر الأب) | **محمي** |
| `PUT/DELETE /finance/invoices/:id` | finance-routes | نعم | **محمي** |
| `PUT/DELETE /finance/ar-aging/invoices/:id` | ar-aging.js | نعم | **محمي** |
| `PUT/DELETE /finance/payments/:id` | finance-routes (يفوز) | نعم | **محمي** |
| `POST /finance/journal-entries` | finance-routes | إنشاء مسودة فقط | مقبول |
| `POST /finance/journal/entries` | journal.js | إنشاء مسودة | مقبول |
| `POST /finance/journal-entries/:id/post\|reverse` | posting-service | صلاحية جلسة + قفل | **محمي للترحيل اليدوي** |
| `POST /finance/invoices` | finance-routes | **لا** — ينشئ قيد POSTED فورًا | **خارج B1.c / هدف B1.d** |
| `POST /finance/payments` | finance-routes | **لا** — قيد POSTED + يحدّث فاتورة بلا assertInvoiceMutable | **فجوة + هدف B1.d** |
| `POST/PUT/DELETE /finance/payment-allocations` | payment-plans.js | **لا** | **غير محمي** |
| `PUT/DELETE /finance/payments` عبر payments.js | payments.js | **لا** لكن **مظلّل** | خطر كامن إن تغيّر ترتيب mount |
| `POST /finance/payroll/runs/:id/post` | payroll-routes | **لا** (إنشاء قيد رواتب) | خارج نطاق AR؛ يُراجع أثر B1.d |
| `POST /finance/ar-aging/invoices` | ar-aging | إنشاء بلا قيد | مقبول |

### أ.3 مسارات بديلة تتجاوز حراسة «المرحّل»؟

| المسار البديل | يتجاوز حذف/تعديل المرحّل؟ | التفاصيل |
|---------------|---------------------------|----------|
| `POST /finance/payments` | **جزئيًا نعم** | لا يحذف القيد، لكنه يحدّث `paid_amount/remaining/status` لفاتورة قد تكون لها قيد مرحّل — بلا `assertInvoiceMutable` |
| `payment-allocations` CRUD | **نعم للتخصيص** | يغيّر توزيعات دون لمس حالة القيد؛ يكسر تطابق السند/الفاتورة تشغيليًا |
| `payments.js` PUT/DELETE | نظريًا نعم | حاليًا غير واصل بسبب ظلّ finance-routes |
| Raw SQL / seeds / tests | نعم | خارج API الإنتاج؛ ليست مسارات مستخدم |
| لا يوجد PUT على journal-entries عائلة A | — | لا ثغرة PUT بديلة هناك |

**خلاصة:** حراسة DELETE/PUT للمستندات المرحّلة على المسارات المستهدفة في B1.c **قائمة**. تبقى فجوات **إنشاء قيد مرحّل تلقائي** وتعديل آثار التحصيل عبر `POST payments` وتخصيصات بلا حراسة.

---

## ب) صلاحيات `req.authUser` والكيان/الشركة

### ب.1 مصدر الثقة (بعد B1.c)

| المصدر | موثوق؟ |
|--------|--------|
| `req.authUser` من جلسة `user_sessions` + `users` عبر middleware | **نعم** |
| `x-user-role` / `x-finance-permissions` | **مرفوض** (يُتجاهل) |
| `legacy_unscoped` | **أُغلق** |

الترحيل/العكس اليدوي: 401 بلا جلسة؛ 403 بلا دور/صلاحية إدارية معتمدة.

### ب.2 عزل الكيان (entity)

آلية `applyResolvedEntityContext` في `server.js`:

| نوع جلسة المستخدم | السلوك |
|-------------------|--------|
| غير HQ (`BRANCH` / …) | `lockEntityScope=true` — يرفض طلبًا بـ `entity_id` مختلف عن كيان الجلسة (403) ويعيد كتابة body/query |
| **HQ** | لا قفل صارم — يمكن تمرير `entity_id` لكيان آخر في query (مسارات journal تشترط entity_id) |
| مستأجر SaaS (`req.tenantPool`) | قاعدة بيانات منفصلة + إلزام توكن للطلبات المالية المقيّدة |

### ب.3 هل «مسؤول شركة» يصل لقيود شركة أخرى؟

| السيناريو | الحكم الحالي |
|-----------|--------------|
| مستخدم غير HQ يحاول `entity_id` لفرع/شركة أخرى على journal PUT/DELETE | **مرفوض** على مستوى middleware (إن وُجدت جلسة صحيحة) + فلتر SQL `entity_id=$2` في journal.js |
| مستخدم HQ | يستطيع استهداف قيود كيانات أخرى بمعرفة `entry_id` + `entity_id` — **مقصود جزئيًا لـ HQ** لكنه خطر إن وُسّع دور HQ لغير المشغّلين |
| `POST …/post` و`…/reverse` عبر FinancePostingService | **لا يتحققان بعد** أن `entry.entity_id === actor.entityId` — فجوة عزل على مستوى الخدمة |
| DELETE فاتورة في finance-routes | **لا فلتر entity_id** في SQL الحذف — يعتمد على معرفة `invoice_id` فقط بعد اجتياز الحراسة المرحّلة |

**قرار مطلوب لاحقًا (ليس تنفيذًا الآن):** فرض مطابقة `entity_id` داخل `FinancePostingService` والحراس حتى لـ HQ الاختياري عبر إعداد، و/أو إضافة فلتر كيان على حذف الفاتورة/الدفعة.

### ب.4 حماية قاعدة البيانات؟

| الطبقة | الواقع |
|--------|--------|
| RLS / سياسات صفوف | **غير موجودة** |
| UNIQUE على `(reference_type, reference_id)` للمرحّل | **غير موجود** |
| CHECK على أسطر المدين/الدائن | موجود على مستوى السطر |
| الحماية الحالية | **تطبيق فقط** (Node guards + posting service + middleware) |

أي تجاوز لطبقة API (SQL مباشر، سكربت، خطأ mount) يتجاوز الحراسة.

---

## ج) المخاطر المتبقية بعد B1.c

| ID | الشدة | الوصف |
|----|-------|--------|
| R-C1 | عالية | `POST /finance/payments` يحدّث فواتير لها قيود مرحّلة بلا حراسة فاتورة |
| R-C2 | عالية | إنشاء JE تلقائي POSTED من invoices/payments خارج الخدمة الموحّدة |
| R-C3 | متوسطة | CRUD `payment-allocations` بلا ربط بحالة الترحيل |
| R-C4 | متوسطة | PostingService بلا فحص ملكية الكيان على القيد |
| R-C5 | متوسطة | حذف فاتورة/دفعة بلا فلتر entity في finance-routes |
| R-C6 | منخفضة | payments.js مظلّل بلا حراسة — خطر إن تغيّر الترتيب |
| R-C7 | منخفضة | لا UNIQUE DB للعكس/الترحيل — حماية تطبيقية فقط (معروفة من B1.b) |
| R-C8 | معلومات | payroll ينشئ قيود POSTED مستقلة — يجب عدم كسره في B1.d |

---

## د) تصميم B1.d — توجيه الترحيل التلقائي إلى FinancePostingService

### د.1 الهدف

جعل **كل** إنشاء قيد من دورة الفاتورة/التحصيل يمر عبر `FinancePostingService` مع:
- توافق سلوك الأعمال الحالي قدر الإمكان في المرحلة الأولى (ما زال الإنشاء يرحّل إن بقي `defer_invoice_posting=false`)
- منع الترحيل المكرر
- توازن القيود
- حماية التخصيصات
- معاملة واحدة للمستند + القيد
- عدم إعادة ترحيل التاريخ
- عدم كسر الرواتب
- تراجع بالأعلام

### د.2 مبدأ التوافق

| السلوك اليوم | B1.d المقترح (مرحلة أولى) |
|--------------|---------------------------|
| `POST /finance/invoices` → ISSUED + JE POSTED فورًا | نفس النتيجة الظاهرة عبر `postInvoiceIssue(invoiceId)` داخل نفس المعاملة بعد INSERT المسودة/البيانات |
| `POST /finance/payments` + allocations → JE قبض + تحديث المدفوع | عبر `postPaymentReceipt(paymentId)` داخل نفس المعاملة |
| عقود URL/JSON للصفحات | **بدون كسر** |
| defer_invoice_posting | يبقى **false** في B1.d؛ booleantime لـ B2 |

### د.3 توسيع الخدمة (تصميم)

```
FinancePostingService
  postManualEntry(entryId)          // موجود
  reverseEntry(entryId)             // موجود
  postInvoiceIssue(invoiceId, ctx)  // جديد — B1.d
  postPaymentReceipt(paymentId, ctx)// جديد — B1.d
```

**postInvoiceIssue (تصميم):**
1. صلاحية موثوقة (`invoices.post` أو admin session)
2. BEGIN + advisory lock على invoice_id
3. FOR UPDATE للفاتورة
4. رفض إن وُجد قيد فعّال: عبر `journal_entry_id` **أو** `reference_type='INVOICE' AND reference_id=id AND POSTED`
5. بناء أسطر متوازنة (1130/4100/2140) من مبالغ الفاتورة
6. INSERT JE POSTED + lines + ربط journal_entry_id
7. audit · COMMIT  
لا يُستدعى على صفوف تاريخية لها قيد مسبق.

**postPaymentReceipt:**
1. قفل الدفعة + قراءة allocations
2. التحقق: مجموع التخصيص = مبلغ الدفعة (أو سياسة موثّقة للفائض)
3. لكل فاتورة مخصّصة: لا يتجاوز المتبقي (إلا إعداد لاحق)
4. رفض إن وُجد قيد PAYMENT فعّال لنفس payment_id
5. JE Dr نقد/بنك Cr 1130 · تحديث paid/remaining داخل نفس المعاملة
6. استدعاء مسار تحديث الفاتورة **داخليًا** بعد القفل — لا عبر HTTP PUT العام

### د.4 منع التكرار (طبقات)

1. تطبيق: فحص الروابط قبل الإدراج  
2. قفل: `pg_advisory_xact_lock` + `FOR UPDATE`  
3. **Migration لاحقة (موافقة منفصلة):** فهرس فريد جزئي  
   - `(reference_type, reference_id) WHERE reference_type IN ('INVOICE','PAYMENT') AND is_posted AND entry_type <> 'REVERSAL'`  
   - و/أو UNIQUE على `JOURNAL_REVERSAL` كما في B1.b  
4. إن تعذّر migration: **لا يُدعى اكتمال حماية DB**؛ الإبقاء على الأعلام وقفل تطبيقي فقط

### د.5 التخصيصات والمدفوعات

| القاعدة في B1.d |
|-----------------|
| إنشاء دفعة مع ترحيل يتطلّب allocations صالحة داخل المعاملة |
| تعطيل/حراسة `POST/PUT/DELETE payment-allocations` بعد ترحيل الدفعة (أو جعلها read-only إن `journal_entry_id` موجود) |
| إزالة الاعتماد على payments.js للكتابة أو إضافة نفس الحراس إن أُزيل الظل |

### د.6 التاريخ

- أي فاتورة/دفعة لها قيد فعّال: **لا إعادة ترحيل**  
- فواتير بلا قيد (مثل ar-aging): لا ترحيل تلقائي جماعي؛ الترحيل الصريح لاحقًا (B2)  
- لا backfill في B1.d

### د.7 أثر الرواتب

| البند | القرار التصميمي |
|-------|-----------------|
| `POST /finance/payroll/runs/:id/post` | **لا يُنقل في B1.d** — يبقى كما هو |
| اختبار انحدار إلزامي | ترحيل كشف رواتب تجريبي ما زال ينجح |
| توحيد لاحق اختياري | B1.e+ أو مسار منفصل بموافقة |

### د.8 خطة تراجع

| علم | المعنى |
|-----|--------|
| `finance.posting_service.invoice_payment.enabled` | false → المسارات القديمة inline (إن بقيت خلف فرع كود أو نسخة) |
| نشر Draft فقط | إيقاف الدمج يعيد السلوك عبر revert |
| لا reverse جماعي عند التراجع | القيود التي أُنشئت أثناء التفعيل تبقى |

التراجع الآمن يفضّل الإبقاء على دالّة inline القديمة خلف `if (!flag)` لفترة انتقال قصيرة داخل نفس PR التنفيذي لاحقًا.

### د.9 Migrations المقترحة (عرض فقط — لا تنفيذ)

| # | التغيير | متى |
|---|---------|-----|
| M-D1 | فهرس فريد جزئي لـ INVOICE/PAYMENT المرحّلة غير المعكوسة | بعد كشف صفر مكررات |
| M-D2 | فهرس فريد جزئي لـ JOURNAL_REVERSAL | كما B1.b |
| M-D3 | اختياري: عمود `posting_kind` | إن لزم أكثر من قيد مشروع لنفس المرجع |

**أي migration تتطلب موافقة صريحة منفصلة قبل التنفيذ.**

---

## هـ) تقسيم B1.d إلى خطوات صغيرة + قبول

| خطوة | المحتوى | معيار قبول |
|------|---------|------------|
| **B1.d.0** | موافقة هذه الوثيقة + قرار الأعلام والـ migrations | موافقة مكتوبة |
| **B1.d.1** | إضافة `postInvoiceIssue` / `postPaymentReceipt` في الخدمة **بدون** ربط routes (اختبارات وحدة على `b1a_test`) | توازن + رفض مكرر + معاملة |
| **B1.d.2** | ربط `POST /finance/invoices` بالخدمة خلف flag (افتراضي off ثم on في بيئة اختبار) | نفس شكل الاستجابة؛ قيد واحد؛ انحدار UI |
| **B1.d.3** | ربط `POST /finance/payments` + إلزام تخصيصات + تحديث فاتورة داخل المعاملة | لا تجاوز متبقي؛ قيد واحد؛ حراسة فاتورة مرحّلة |
| **B1.d.4** | حراسة `payment-allocations` بعد الترحيل | 409 على تعديل تخصيص لدفعة مرحّلة |
| **B1.d.5** | انحدار: receivables-collections · payments · invoices-budgets-master · payroll post | PASS بلا كسر أرصدة تاريخية |
| **B1.d.6** | تقرير: محمي vs متبقٍ؛ قرار تفعيل العلم على بيئات أعلى | موافقة قبل Staging |

### اختبارات قبول أفقية لـ B1.d

1. إنشاء فاتورة جديدة → قيد واحد متوازن؛ إعادة الطلب (idempotency) لا يضاعف  
2. دفعتان متوازيتان على نفس الفاتورة → لا تجاوز متبقي  
3. محاولة ترحيل فاتورة لها JE مسبق → 409  
4. تعديل تخصيص بعد ترحيل الدفعة → مرفوض  
5. payroll post → ناجح كما قبل  
6. عدّاد قيود الفواتير التاريخية قبل/بعد التشغيل التجريبي → بلا إعادة ترحيل  
7. 401/403 على ترحيل بلا جلسة/صلاحية  

---

## و) قرارات تحتاج موافقتك قبل أي تنفيذ لـ B1.d

1. **هل نبقي السلوك «إنشاء فاتورة = ترحيل فوري» في B1.d** (عبر الخدمة فقط) أم نبدأ تعطيل الترحيل الفوري مبكرًا؟ (التوصية: الإبقاء على الترحيل الفوري عبر الخدمة في d.2–d.3؛ الفصل لـ B2)  
2. **هل ندرج حراسة `payment-allocations` داخل B1.d.4** أم دفعة فرعية منفصلة؟ (التوصية: داخل B1.d)  
3. **هل نطلب الموافقة على M-D1/M-D2 مع أول PR تنفيذي أم بعد إثبات صفر مكررات؟** (التوصية: كشف أولًا ثم موافقة migration)  
4. **هل نفرض مطابقة الكيان داخل PostingService حتى على مستخدمي HQ؟** (التوصية: فرض لغير HQ فورًا؛ HQ عبر إعداد `finance.strict_entity_scope`)  
5. **تأكيد إبقاء payroll خارج B1.d**  

---

## ز) ملخص تنفيذي

| السؤال | الجواب |
|--------|--------|
| هل B1.c يحمي حذف/تعديل القيود المرحّلة على مسارات journal + lines؟ | **نعم** (عائلة `/finance/journal/entries` و lines) |
| هل `/finance/journal-entries/:id` لديه PUT/DELETE؟ | **لا** |
| هل توجد مسارات بديلة تتجاوز الحراسة؟ | نعم جزئيًا: `POST payments` (تحديث فاتورة)، allocations، إنشاء JE تلقائي |
| حماية DB؟ | **لا** — تطبيق فقط |
| عزل شركة/كيان؟ | قوي لغير HQ عبر middleware؛ فجوات على PostingService وحذف الفاتورة بلا فلتر كيان؛ HQ واسع |
| B1.d؟ | تصميم جاهز للخطوات d.1–d.6 — **بانتظار موافقة صريحة للتنفيذ** |

---

*لا كود، لا migrations، لا تغيير ترحيل تلقائي في هذه الجولة.*
