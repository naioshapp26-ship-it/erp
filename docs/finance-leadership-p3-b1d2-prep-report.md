# تقرير تحضير B1.d.2 — تكافؤ ترحيل الفواتير (تحليل فقط)

**نتيجة الاختبارات:** PASS — 63 / 0
**جاهزية الربط:** غير جاهزة — تحتاج قرارات قبل التنفيذ

> حدود هذه الجولة: اختبارات وتحليل فقط. لا تعديل HTTP · لا ترحيل تلقائي جديد · لا migrations · لا بيانات تاريخية · لا d.3+ · لا دمج/نشر.

## جدول المقارنة: المسار الحالي × الخدمة

| الجانب | المسار الحالي `POST /finance/invoices` | `postInvoiceIssue` | التكافؤ |
|---|---|---|---|
| حسابات القيد | Dr 1130 / Cr 4100 / Cr 2140(إن وُجدت ضريبة) | نفس الحسابات | MATCH |
| مبلغ المدين (الذمم) | total_amount من حساب JS للبنود (قبل تقريب DB) | round2(invoice.total_amount) من صف الفاتورة | CONDITIONAL — يتفقان بعد التخزين؛ قد يختلفان عن قيد المسار الحالي إن بقي JS غير مقرب |
| صافي الإيراد | subtotal - discount_amount (JS) | round2(subtotal - discount) | CONDITIONAL |
| الضريبة | مجموع ضريبة البنود (افتراضي 15%) | round2(invoice.tax_amount)؛ لا بند ضريبة إن ≤0 | MATCH على القيم المخزنة؛ وصف البند يختلف |
| تقريب الأرقام | لا round2 في الحلقة؛ الاعتماد على numeric DB للفاتورة فقط | round2 صريح على كل مبالغ القيد | DIFF (إصلاحي محتمل) |
| reference_type / reference_id | INVOICE + invoice_id | INVOICE + invoice_id | MATCH |
| reference_number | رقم الفاتورة | غير مُعيَّن | DIFF metadata |
| entry_number | generateNextNumber(JE-…) | generateEntryNumber(JE-INV-…) | DIFF metadata |
| وصف القيد | قيد آلي - فاتورة رقم {num} | إصدار فاتورة {num} | DIFF metadata |
| وصف ذمم | ذمم مدينة - {اسم العميل} | ذمم - {رقم الفاتورة} | DIFF metadata |
| وصف ضريبة | ضريبة القيمة المضافة | ضريبة | DIFF metadata |
| posted_at / posted_by | غير مُعيَّنين صراحة | NOW() + actor.userId | DIFF metadata (تحسين خدمة) |
| entity_id على أسطر القيد | NULL | invoice.entity_id | DIFF metadata (تحسين عزل) |
| حالة الفاتورة عند الإنشاء | ISSUED / UNPAID + journal_entry_id | لا ينشئ الفاتورة — يرحّل فقط ويربط journal_entry_id | N/A (تقسيم مسؤولية) |
| ملكية الكيان | يقبل entity_id من body | assertEntityOwns من الجلسة | DIFF أمني (مطلوب عند الربط) |

## الاختلافات المكتشفة

### محاسبية / تقريب
- **amount_rounding_source**: الحالي=`JS floats للقيد vs numeric للفاتورة` ← الخدمة=`round2 من صف الفاتورة فقط`
- **مثال حدي `edge-small` (كمية 1 × 0.01 ضريبة 15%)**:
  - المسار الحالي (JS): ضريبة `0.0015`، إجمالي قيد `0.0115`، وثلاثة أسطر (1130/4100/2140) حتى لو خُزّنت الفاتورة مقربّة.
  - بعد تخزين numeric(15,2): ضريبة `0.00`، إجمالي `0.01` — الخدمة ترحّل سطرين فقط (1130/4100) بمبلغ `0.01`.
  - **هذا فرق محاسبي حقيقي عند القيم الحدية**؛ اعتماد مصدر الحقيقة (قرار D1) إلزامي قبل الربط.

### بيانات وصفية (metadata)
- **entry_number_prefix**: الحالي=`JE-` ← الخدمة=`JE-INV-`
- **je_description**: الحالي=`قيد آلي - فاتورة رقم …` ← الخدمة=`إصدار فاتورة …`
- **ar_line_description**: الحالي=`ذمم مدينة - اسم العميل` ← الخدمة=`ذمم - رقم الفاتورة`
- **tax_line_description**: الحالي=`ضريبة القيمة المضافة` ← الخدمة=`ضريبة`
- **reference_number**: الحالي=`يُكتب` ← الخدمة=`لا يُكتب`
- **posted_at_posted_by**: الحالي=`غالبًا null` ← الخدمة=`يُعبأ`
- **journal_line_entity_id**: الحالي=`null` ← الخدمة=`invoice.entity_id`

## نتائج PASS/FAIL (تكافؤ)
- PASS totals-single-line-15pct: total=115.00
- PASS spec-amounts-equal-single-line-15pct
- PASS svc-single-line-15pct-amounts-match
- PASS balance-single-line-15pct: 115=115
- PASS link-status-single-line-15pct
- PASS je-ref-entity-single-line-15pct: JE-INV-0010
- PASS je-lines-entity-single-line-15pct
- PASS totals-multi-line: total=358.23
- PASS spec-amounts-equal-multi-line
- PASS svc-multi-line-amounts-match
- PASS balance-multi-line: 358.23=358.23
- PASS link-status-multi-line
- PASS je-ref-entity-multi-line: JE-INV-0011
- PASS je-lines-entity-multi-line
- PASS totals-with-discount-pct: total=103.50
- PASS spec-amounts-equal-with-discount-pct
- PASS svc-with-discount-pct-amounts-match
- PASS balance-with-discount-pct: 103.5=103.5
- PASS link-status-with-discount-pct
- PASS je-ref-entity-with-discount-pct: JE-INV-0012
- PASS je-lines-entity-with-discount-pct
- PASS totals-zero-tax: total=500.00
- PASS spec-amounts-equal-zero-tax
- PASS svc-zero-tax-amounts-match
- PASS balance-zero-tax: 500=500
- PASS link-status-zero-tax
- PASS je-ref-entity-zero-tax: JE-INV-0013
- PASS je-lines-entity-zero-tax
- PASS zero-tax-no-2140
- PASS totals-fractional-rounding: total=114.98
- PASS spec-amounts-equal-fractional-rounding
- PASS svc-fractional-rounding-amounts-match
- PASS balance-fractional-rounding: 114.98=114.98
- PASS link-status-fractional-rounding
- PASS je-ref-entity-fractional-rounding: JE-INV-0014
- PASS je-lines-entity-fractional-rounding
- PASS totals-edge-small: total=0.01
- PASS spec-drift-noted-edge-small: JS-current vs DB-rounded service may differ; see differences
- PASS svc-edge-small-amounts-match
- PASS balance-edge-small: 0.01=0.01
- PASS link-status-edge-small
- PASS je-ref-entity-edge-small: JE-INV-0015
- PASS je-lines-entity-edge-small
- PASS totals-high-discount: total=1035.00
- PASS spec-amounts-equal-high-discount
- PASS svc-high-discount-amounts-match
- PASS balance-high-discount: 1035=1035
- PASS link-status-high-discount
- PASS je-ref-entity-high-discount: JE-INV-0016
- PASS je-lines-entity-high-discount
- PASS current-path-default-tax-15
- PASS invoice-number-unique-blocks-dup: UNIQUE invoice_number
- PASS semantic-duplicate-invoices-allowed: مساران مختلفان رقماً لنفس المحتوى ممكنان — لا مفتاح idempotency على الإنشاء
- PASS concurrent-invoice-number-race-one-wins: [{"ok":true,"next":"B1D2-RACE-1792435123452-0002"},{"ok":false,"err":"duplicate key value violates unique constraint \"finance_invoices_invoice_number_key\""}]
- PASS midpoint-failure-triggered
- PASS midpoint-full-rollback-invoice-and-je: inv=0
- PASS post-zero-rejected
- PASS post-zero-no-partial-je
- PASS historical-no-je-inventoried: count=2
- PASS historical-not-auto-reposted
- PASS public-counts-unchanged
- PASS routes-still-unwired
- PASS auto-post-still-inline

## تكرار الفاتورة والتزامن
- `UNIQUE(invoice_number)` يمنع تكرار **رقم** الفاتورة.
- `generateNextNumber` بلا قفل — السباق يُحسم غالبًا بفشل UNIQUE لأحد الطلبين.
- **لا** يوجد مفتاح idempotency لمنع إنشاء فاتورتين مختلفتي الرقم لنفس المحتوى.
- الخدمة تمنع تكرار **القيد** لنفس `invoice_id` (قفل + مرجع)؛ هذا لا يغني عن منع تكرار المستند.

## التراجع داخل معاملة واحدة
- محاكاة إنشاء+ترحيل ثم فشل منتصف الطريق → `ROLLBACK` أزال الفاتورة والقيد معًا: PASS.
- عند الربط: استدعاء الخدمة بـ `manageTransaction:false` داخل معاملة المسار الحالية.

## الفواتير التاريخية بلا `journal_entry_id`
- العدد في public: **2**
  - INV-FIN-001 (id=1) status=PARTIAL total=57500 entity=HQ001 ref_je=false
  - INV-FIN-002 (id=2) status=ISSUED total=36800 entity=HQ001 ref_je=false
- السياسة: B1.d.2 يجب ألا يعيد ترحيل الفواتير التاريخية تلقائيًا. الربط يطبق فقط على إنشاء جديد بعد الموافقة. أي ترحيل رجعي يحتاج موافقة منفصلة وحملة بيانات.
- autoRepostExecuted: false

## أثر الربط على الصفحات والـ APIs
- API الأساسي: POST /finance/invoices (finance-routes.js) — auto JE
- API ثانوي بلا ترحيل: POST /finance/ar-aging/invoices (ar-aging.js) — invoice only, NO JE — خارج ربط d.2 للترحيل
- صفحات تنشئ عبر POST:
  - finance/strategic-financial-reports.html
  - finance/receivables-collections.html
  - finance/operations-sop-finance.html
  - finance/financial-governance-executive.html
  - finance/sales-accounts-operations-mobile.html (POST create / PUT update)
- الأثر: كل صفحات الإنشاء أعلاه تمر عبر نفس POST /finance/invoices — ربط واحد يغطيها. ar-aging create يبقى بلا ترحيل ما لم يُقر نطاق منفصل. لا تغيير متوقع على GET/PUT/DELETE في d.2 إن اقتصر الربط على استبدال كتلة JE داخل POST.

## الفجوات الأربع (من B1.d.1) — ماذا يُغلق قبل الربط؟

| ID | المسار | قبل ربط الفواتير؟ | قبل ربط المدفوعات؟ | توصية |
|---|---|---|---|---|
| G1 | `POST /finance/payments` | false | true | إغلاق إلزامي قبل d.3/ربط المدفوعات — ليس حاجزًا لـ d.2 الفواتير |
| G2 | `POST/PUT/DELETE /finance/payment-allocations` | false | true | إغلاق إلزامي قبل ربط المدفوعات (نطاق B1.d للallocations) |
| G3 | `DELETE /finance/invoices/:id` | recommended | false | يُفضّل إغلاقه مع أو قبل d.2 (حراسة ملكية على الحذف) لكنه ليس جزءًا من كتلة الترحيل؛ يمكن موافقة منفصلة ضيقة |
| G4 | `HQ query entity_id` | partial | partial | عند الربط، postInvoiceIssue يفرض الملكية من الجلسة — يخفف خطر الترحيل العابر. تضييق استعلامات HQ يبقى موافقة منفصلة |

## خطة التراجع الآمنة
- 1) إيقاف فوري عبر flag/feature أو إعادة كتلة JE المضمّنة السابقة في POST /invoices (revert الـ PR) دون migration عكسية
- 2) عدم عكس جماعي تلقائي — حصر الفواتير المُنشأة بعد وقت الربط عبر created_at / audit
- 3) لكل فاتورة متأثرة: إن وُجد قيد غير متوازن أو حساب خاطئ → reverseEntry المعتمد (B1.b) ثم إصلاح بإعادة ترحيل يدوي بموافقة
- 4) الإبقاء على الفاتورة؛ لا حذف مرحّل (B1.c)
- 5) تقرير فروقات + منع إنشاء جديد حتى الإصلاح
- 6) لا تعديل بيانات تاريخية سابقة للربط
- علم ميزة مقترح: عند التنفيذ الفعلي لـ d.2: لفّ الاستدعاء خلف FINANCE_POST_INVOICE_VIA_SERVICE=true مع افتراضي false حتى اعتماد القبول

## الحكم على جاهزية B1.d.2 للتنفيذ
- **NOT_READY — تحتاج قرارات/إصلاحات تحضيرية قبل التنفيذ**
- قرارات مطلوبة قبل التنفيذ:
  - **D1 مصدر مبلغ القيد**: A) اعتماد صف الفاتورة بعد التخزين + round2 (سلوك الخدمة) — يُفضّل محاسبيًا | B) محاكاة JS غير المقرب حرفيًا (غير موصى) → توصية: A
  - **D2 محاذاة metadata**: A) قبول أوصاف/JE-INV/reference_number كما في الخدمة | B) تعديل الخدمة لتطابق نصوص المسار الحالي قبل الربط → توصية: B للوصف وreference_number إن كانت التقارير تعتمد عليها؛ A مقبول مع توثيق
  - **D3 G3 حذف الفاتورة بدون كيان**: إغلاق مع d.2 | تأجيل بموافقة → توصية: إغلاق ضيق مع d.2 إن أمكن دون توسيع لنطاق المدفوعات

## خطة الربط المقترحة (بعد الموافقة فقط)
- 1. إضافة flag FINANCE_POST_INVOICE_VIA_SERVICE (افتراضي false)
- 2. داخل POST /finance/invoices بعد INSERT الفاتورة والبنود: استدعاء postInvoiceIssue(client, id, {req, manageTransaction:false}) بدل كتلة JE المضمّنة
- 3. الإبقاء على BEGIN/COMMIT الحالي؛ أي خطأ → ROLLBACK كامل
- 4. تمرير الممثل من الجلسة فقط (لا body.entity_id للملكية)
- 5. عدم المساس بـ ar-aging create ولا PUT/DELETE
- 6. اختبارات قبول: التكافؤ المحاسبي للحسابات والمبالغ (بعد D1)، توازن، ربط journal_entry_id، كيان، التزامن، فشل منتصف الطريق
- 7. مراقبة flag=true على عينة ثم تعميم
- 8. خطة التراجع أعلاه جاهزة

### معايير القبول
- [ ] Dr1130 = total المخزّن؛ Cr4100 = net؛ Cr2140 = tax أو غائب إن صفر
- [ ] القيد متوازن ضمن 0.01
- [ ] invoice.journal_entry_id يشير للقيد؛ reference_type=INVOICE و reference_id=invoice_id
- [ ] entity_id القيد = entity_id الفاتورة = كيان الجلسة (أو تفويض صريح)
- [ ] فشل أي خطوة يلغي الفاتورة والقيد معًا
- [ ] لا إعادة ترحيل للفواتير التاريخية
- [ ] Payroll ومسارات المدفوعات دون تغيير
- [ ] flag يمكن تعطيله فورًا للرجوع للمسار المضمّن

لا تنفيذ للربط · لا d.3+ · بانتظار موافقتك الصريحة وقرارات D1–D3.