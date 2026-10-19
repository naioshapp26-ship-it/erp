# تقرير جاهزية B1.d.2 — D1/D2/D3 (بدون ربط)

**الاختبارات:** PASS — 78 / 0
**الجاهزية التقنية للربط:** نعم
**موافقة تنفيذ الربط:** لا — تتطلب موافقة صريحة منفصلة

## القرارات المنفّذة
- **D1:** `roundMoney` + `computeInvoiceTotalsFromLines` + ترحيل من القيم المخزّنة فقط
- **D2:** وصف/ترقيم/`reference_number`/`posted_at` (null كالمسار الحالي)/علاقات الكيان على رأس القيد متوافقة مع الصيغ القديمة
- **D3/G3:** `assertInvoiceDeletable(..., {req})` + فلتر `entity_id` في DELETE (`finance-routes` و`ar-aging`)

## تطابق المبالغ
- بعد التقريب الموحّد، مدين القيد = `invoice.total_amount` في كل الحالات المختبرة بما فيها 0.01 والبنود المتعددة.

## توافق metadata
- `JE-####` · `قيد آلي - فاتورة رقم …` · `reference_number` · `ذمم مدينة - …` · `ضريبة القيمة المضافة` · بلا `posted_at/posted_by` كالمسار الحالي

## إغلاق G3
- رفض حذف عابر للكيانات (Admin وHQ بلا تفويض)
- السماح لـ HQ مع `allowCrossEntity` + قائمة
- رفض حذف فاتورة مرحّلة

## فروق متبقية
- **create-path-unrounded-js**: POST /finance/invoices الحالي ما زال يحسب بـ JS غير مقرب قبل التخزين؛ الخدمة تستخدم المخزّن بعد roundMoney. عند الربط يجب اعتماد computeInvoiceTotalsFromLines قبل INSERT لتوحيد الفاتورة والقيد. لم يُغيَّر المسار التشغيلي في هذه الجولة.

## نتائج الاختبارات
- PASS round-edge-0.01-tax-rounds-to-0: {"subtotal":0.01,"discount_amount":0,"tax_amount":0,"net":0.01,"total_amount":0.01,"lines":[{"quantity":1,"unit_price":0.01,"tax_percentage":15,"item_name":"حد","discount_amount":0,"tax_amount":0,"line_total":0.01}]}
- PASS round-multi-line-consistent: 358.22
- PASS round-zero-tax
- PASS round-discount-pct: 103.5
- PASS meta-description-legacy
- PASS meta-line-descriptions-legacy
- PASS amt-match-std-15: inv=115 je=115
- PASS amt-accounts-std-15
- PASS amt-tax-std-15
- PASS meta-tax-desc-std-15
- PASS meta-entry-number-std-15: JE-0007
- PASS meta-je-desc-std-15
- PASS meta-ref-number-std-15
- PASS meta-ref-link-std-15
- PASS meta-entity-std-15
- PASS meta-posted-null-like-legacy-std-15
- PASS meta-ar-desc-std-15: ذمم مدينة - عميل اختبار B1.a
- PASS link-status-std-15
- PASS amt-match-multi: inv=358.22 je=358.22
- PASS amt-accounts-multi
- PASS amt-tax-multi
- PASS meta-tax-desc-multi
- PASS meta-entry-number-multi: JE-0008
- PASS meta-je-desc-multi
- PASS meta-ref-number-multi
- PASS meta-ref-link-multi
- PASS meta-entity-multi
- PASS meta-posted-null-like-legacy-multi
- PASS meta-ar-desc-multi: ذمم مدينة - عميل اختبار B1.a
- PASS link-status-multi
- PASS amt-match-zero-tax: inv=500 je=500
- PASS amt-accounts-zero-tax
- PASS amt-no-tax-line-zero-tax
- PASS meta-entry-number-zero-tax: JE-0009
- PASS meta-je-desc-zero-tax
- PASS meta-ref-number-zero-tax
- PASS meta-ref-link-zero-tax
- PASS meta-entity-zero-tax
- PASS meta-posted-null-like-legacy-zero-tax
- PASS meta-ar-desc-zero-tax: ذمم مدينة - عميل اختبار B1.a
- PASS link-status-zero-tax
- PASS amt-match-edge-0.01: inv=0.01 je=0.01
- PASS amt-accounts-edge-0.01
- PASS amt-no-tax-line-edge-0.01
- PASS meta-entry-number-edge-0.01: JE-0010
- PASS meta-je-desc-edge-0.01
- PASS meta-ref-number-edge-0.01
- PASS meta-ref-link-edge-0.01
- PASS meta-entity-edge-0.01
- PASS meta-posted-null-like-legacy-edge-0.01
- PASS meta-ar-desc-edge-0.01: ذمم مدينة - عميل اختبار B1.a
- PASS link-status-edge-0.01
- PASS amt-match-discount: inv=103.5 je=103.5
- PASS amt-accounts-discount
- PASS amt-tax-discount
- PASS meta-tax-desc-discount
- PASS meta-entry-number-discount: JE-0011
- PASS meta-je-desc-discount
- PASS meta-ref-number-discount
- PASS meta-ref-link-discount
- PASS meta-entity-discount
- PASS meta-posted-null-like-legacy-discount
- PASS meta-ar-desc-discount: ذمم مدينة - عميل اختبار B1.a
- PASS link-status-discount
- PASS g3-owner-can-delete-unposted
- PASS g3-cross-entity-delete-denied: CROSS_ENTITY_DENIED
- PASS g3-hq-without-grant-delete-denied
- PASS g3-hq-with-grant-can-delete-unposted
- PASS g3-posted-delete-blocked
- PASS g3-unauth-delete-denied: ENTITY_SCOPE_REQUIRED
- PASS routes-still-unwired
- PASS auto-post-still-inline
- PASS g3-route-passes-req-context
- PASS public-counts-unchanged
- PASS http-login-ok
- PASS http-g3-cross-entity-403: 403
- PASS smoke:/finance
- PASS smoke:/finance/payroll-runs.html

## خطة الربط (للموافقة المنفصلة فقط)
- 1) في POST /finance/invoices: احسب البنود عبر computeInvoiceTotalsFromLines ثم INSERT الفاتورة/البنود بالقيم المقربة
- 2) داخل نفس BEGIN: postInvoiceIssue(client, invoice_id, { req, manageTransaction:false }) بدل كتلة JE المضمّنة
- 3) COMMIT أو ROLLBACK كامل
- 4) لا مساس بـ payments/allocations/ar-aging create/Payroll
- 5) تفعيل الـ flag بعد قبول معايير القبول على بيئة معزولة فقط
### معايير القبول
- [ ] مبلغ مدين 1130 = invoice.total_amount المخزّن
- [ ] صافي 4100 + ضريبة 2140 = الإجمالي
- [ ] metadata: JE-####، وصف قيد آلي، reference_number، كيان القيد = كيان الفاتورة
- [ ] فشل أي خطوة يلغي الفاتورة والقيد
- [ ] G3 يحمي الحذف
- [ ] لا إعادة ترحيل تاريخي

## خطة التراجع
- إيقاف جديد: تعطيل FINANCE_POST_INVOICE_VIA_SERVICE يعيد كتلة JE المضمّنة للإنشاءات الجديدة فقط — لا يمس قيودًا سابقة
- لا عكس جماعي/تلقائي
- تحديد المستند المتأثر (invoice_id / entry_id / الفترة)
- فحص التحصيل والتخصيصات المرتبطة
- عكس انتقائي عبر reverseEntry بصلاحية journals.reverse + سجل تدقيق
- لا حذف/تعديل مباشر لقيود مرحّلة (B1.c)
- لا تعديل بيانات تاريخية سابقة للربط

**لم يُنفَّذ ربط POST /invoices · لا payments · لا migrations · لا تاريخي · لا Payroll · لا دمج/نشر.**