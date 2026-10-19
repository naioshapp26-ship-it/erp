# تقرير B1.d.1 — دوال ترحيل الفواتير/المدفوعات + ملكية الكيان (خدمة فقط)

**النتيجة:** PASS — 39 / 0  
**الانحدار:** B1.b PASS 26/0 · B1.c PASS 24/0  
**النطاق:** Draft PR لتنفيذ **B1.d.1 فقط** — بلا ربط مسارات · بلا migrations · بلا دمج/Staging/Production · بلا تعديل Payroll.

---

## 1) الدوال التي أُضيفت للخدمة

الملف: `finance/services/finance-posting-service.js`

| الدالة | الغرض |
|--------|--------|
| `normalizeEntityIdList` | تطبيع قائمة كيانات التفويض من الجلسة |
| `assertEntityOwns` | رفض الوصول العابر للكيانات؛ Admin/HQ لا يتجاوزان |
| `findActivePostedByReference` | بحث قيد مرحّل نشط بـ `(reference_type, reference_id)` |
| `resolveAccountByCode` | جلب حساب قابل للترحيل بالرمز |
| `postInvoiceIssue` | ترحيل فاتورة → قيد AUTO (1130 / 4100 / 2140) داخل معاملة + قفل |
| `postPaymentReceipt` | ترحيل دفعة + تخصيصات في معاملة واحدة (1110\|1120 / 1130) وتحديث أرصدة الفاتورة |

تحديثات على دوال سابقة (ضمن d.1):
- `resolveActor` يقرأ `entityId` / `allowCrossEntity` / `allowedEntityIds` من الجلسة فقط.
- `assertPermission` يدعم `invoice_post` / `payment_post`.
- `postManualEntry` / `reverseEntry` يستدعيان `assertEntityOwns` على `entry.entity_id`.

**غير مربوط:** لا استدعاء لـ `postInvoiceIssue` / `postPaymentReceipt` من `finance-routes.js`. الترحيل التلقائي الحالي عند إنشاء فاتورة/دفعة **لم يُغيَّر**.

---

## 2) كيف يُحدَّد الكيان من جلسة موثوقة

| المصدر | موثوق؟ |
|--------|--------|
| `req.authUser` من middleware الجلسة | نعم |
| `req.authenticatedEntityContext` / `req.userEntity` → `actor.entityId` | نعم |
| `authUser.allow_cross_entity` + `allowed_entity_ids` | نعم — التفويض العابر الوحيد |
| `x-entity-id` / `x-user-role` / `x-finance-permissions` | **مرفوض** (يُتجاهل للتفويض) |
| `body.entity_id` لتحديد الملكية | **لا** |

قواعد `assertEntityOwns`:
1. بلا `actor.entityId` → `403 ENTITY_SCOPE_REQUIRED`
2. نفس الكيان → مسموح (`same_entity`)
3. كيان مختلف + `allowCrossEntity===true` + المعرف في `allowedEntityIds` → مسموح (`explicit_cross_entity_grant`)
4. غير ذلك (بما فيه Admin / مسؤول النظام / HQ) → `403 CROSS_ENTITY_DENIED`

---

## 3) نتائج اختبارات منع الوصول العابر للكيانات

ملف: `test-finance-p3-b1d1-posting-helpers.js` على مخطط معزول `b1a_test`.

| الحالة | النتيجة |
|--------|---------|
| Admin لكيان BR001 يحاول ترحيل فاتورة BR002 (معرف صحيح) | PASS `CROSS_ENTITY_DENIED` — بلا أثر جانبي |
| HQ/مسؤول النظام بلا `allowCrossEntity` على فاتورة BR002 | PASS مرفوض |
| HQ مع `allowCrossEntity` + `allowedEntityIds=['BR002']` | PASS `explicit_cross_entity_grant` |
| دفعة BR002 بممثل BR001 | PASS `CROSS_ENTITY_DENIED` |
| تخصيص دفعة BR001 على فاتورة BR002 | PASS `ALLOCATION_ENTITY_MISMATCH` |
| ترويسات مزيفة بلا جلسة | PASS غير مصادق |
| كيان من `authenticatedEntityContext` وليس من `x-entity-id` | PASS |

---

## 4) حدود الحماية التطبيقية قبل UNIQUE

| الآلية | الفاتورة | الدفعة |
|--------|----------|--------|
| `pg_advisory_xact_lock` | namespace `11011` | `11012` |
| `SELECT … FOR UPDATE` | الفاتورة | الدفعة + التخصيصات + الفواتير المرتبطة |
| بحث مرجع مرحّل قبل الإدراج | `INVOICE` + id | `PAYMENT` + id |
| إعادة قراءة بعد الإدراج | نعم (`POST_RACE`) | يعتمد على قفل الدفعة + `journal_entry_id` |

**لا يُدَّعى اكتمال الحماية على مستوى DB.**  
بدون فهرس UNIQUE جزئي على القيود المرحّلة لنوع المرجع، أي مسار يتجاوز طبقة الخدمة (SQL مباشر، عميل آخر) يمكن نظريًا إدخال قيد مكرر.  
**لم تُنفَّذ أي migration** — تتطلب فحص بيانات تاريخية + موافقة مستقلة (القرار 3).

---

## 5) تعارض صلاحيات HQ وصلاحيات الكيانات

| الطبقة | السلوك |
|--------|--------|
| الصلاحية (`assertPermission`) | دور Admin/HQ أو `invoices.post` / `payments.post` / `journals.post` قد يكفي للفعل |
| الملكية (`assertEntityOwns`) | **لا تُتجاوز** بدور HQ/Admin أبدًا |
| التعارض المقصود | مشغّل HQ بصلاحية إدارية بلا تفويض خادمي `allow_cross_entity` + قائمة كيانات **لا يستطيع** ترحيل مستند كيان آخر عبر الخدمة |

**فجوة متبقية على المسارات HTTP الحالية (ليست من إصلاح d.1):** وسطاء HQ لا يقفلون `entity_id` في الاستعلام كما تفعل كيانات الفروع — انظر القسم 7 وطلب الموافقة.

---

## 6) ما تحتاجه d.2 قبل ربط الفواتير

1. توجيه `POST /finance/invoices` لاستدعاء `postInvoiceIssue` داخل نفس المعاملة بدل إدراج القيد المضمّن.
2. توجيه `POST /finance/payments` إلى `postPaymentReceipt` مع إلزام التخصيصات وإيقاف تحديث أرصدة الفاتورة خارج الخدمة.
3. حراسة `POST/PUT/DELETE /finance/payment-allocations` ضد المستندات/الأرصدة المرحّلة (نطاق B1.d الإلزامي للallocations؛ لم تُربَط في d.1).
4. ضمان أن middleware يملأ `authenticatedEntityContext` ويمنح HQ صراحةً `allow_cross_entity` عند الحاجة.
5. اختبارات تكافؤ محاسبي مع السلوك الحالي (1130/4100/2140 و 1110|1120/1130).
6. ما زال UNIQUE غير مسموح دون موافقة + تدقيق بيانات.
7. Payroll يبقى خارج النطاق مع اختبار دخان.

---

## 7) مخاطر مسارات قائمة — توثيق بلا توسيع نطاق (بانتظار موافقتك)

> وفق تعليماتك: اكتُشفت مسارات تسمح بسلوك عابر/غير محمي؛ **لم تُصلَح تلقائيًا**. أطلب موافقتك قبل أي إصلاح.

| المسار | الخطر | إجراء مطلوب |
|--------|-------|-------------|
| `POST /finance/payments` (الحالي) | يحدّث `paid_amount`/`remaining` لفاتورة قد تكون لها قيد مرحّل بلا `assertInvoiceMutable` | موافقة لإصلاح ضمن d.2 أو دفعة منفصلة |
| `POST/PUT/DELETE /finance/payment-allocations` (`payment-plans.js` عبر `server.js`) | إنشاء/تعديل/حذف تخصيص بلا تحقق كيان ولا حراسة مرحّل — يكسر تطابق السند/الرصيد | موافقة لحراسة (جزء إلزامي من نطاق B1.d، ليس d.1) |
| `DELETE /finance/invoices/:id` | الحذف بـ `invoice_id` فقط بعد حراسة المرحّل — **بلا فلتر `entity_id`** | موافقة لإضافة ملكية كيان |
| استعلامات HQ بـ `entity_id` في query | وسطاء HQ بلا `lockEntityScope` الصارم — استهداف كيانات أخرى بمعرفة المعرفات | موافقة لسياسة HQ أضيق على المسارات المالية |

---

## 8) نتائج PASS/FAIL والانحدار

### B1.d.1 (39 PASS / 0 FAIL)
- ملكية الكيان (وحدة + فاتورة + دفعة + HQ)
- توازن قيد الفاتورة/الدفعة
- إلزام التخصيصات + تطابق المجموع + منع التجاوز
- منع الترحيل المكرر
- تزامن فاتورة/دفعة (فائز واحد)
- إعادة محاولة بعد فشل (مبلغ صفري → ROLLBACK)
- المسارات غير مربوطة + الترحيل التلقائي لم يُمس
- دخان `/finance` · `/finance/payroll-runs.html` · `/hr`
- عدّادات `public` للفواتير/المدفوعات/القيود لم تتغير بكتابات `b1a_test`

### انحدار
- **B1.b:** PASS 26/0 (ممثلو الاختبار حُدّثوا بـ `entityId` ليتوافقوا مع البوابة الجديدة)
- **B1.c:** PASS 24/0

### Payroll
- لا تعديلات على ملفات الرواتب
- دخان صفحة `payroll-runs.html` → 200

### ملفات التغيير
- `finance/services/finance-posting-service.js`
- `test-finance-p3-b1d1-posting-helpers.js` (جديد)
- `test-finance-p3-b1b-posting-service.js` / `test-finance-p3-b1c-posted-guards.js` (إضافة `entityId` للممثلين فقط)
- `docs/finance-leadership-p3-b1d1-report.md` (هذا التقرير)

---

**لا d.2–d.6 · لا B2 · لا migrations · لا دمج · لا Staging/Production دون موافقة صريحة.**
