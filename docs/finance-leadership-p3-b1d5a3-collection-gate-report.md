# تقرير B1.d.5a.3 — بوابة سلامة التحصيل (تنفيذ محدود)

**النتيجة:** PASS — 19 / 0  
**النطاق:** بوابة التحصيل فقط. لا migrations · لا تفعيل أعلام · لا إصلاح تاريخي · لا ADVANCE · لا دمج/Staging/Production.

## التنفيذ
- `finance/services/finance-collection-gate.js` — `assertInvoiceIssueReadyForCollection` / `resolveInvoiceIssueForCollection`
- `postPaymentReceipt` — بوابة داخل المعاملة لكل فاتورة تخصيص (بعد قفل 11011)
- `POST /finance/payments` (قديم+خدمة) — نفس البوابة قبل إنشاء الدفعة، بترتيب `invoice_id` ثابت
- `payments.js` createPayment — دفاع إضافي عند وجود allocations (المسار مظلّل؛ ترتيب mount دون تغيير)

## القرارات
- ALLOW: قيد إصدار وحيد سليم ومرحّل (رابط مباشر أو مرجع وحيد عندما يكون `journal_entry_id` فارغًا)
- REJECT 422: بلا قيد / غير مرحّل / معكوس / فاتورة ملغاة
- HUMAN_REVIEW 409: قيود متعددة / تعارض ربط مع مرجع / اختلاف كيان أو مبلغ / حالة غير قابلة للإثبات — إيقاف التحصيل بلا تصحيح تلقائي

## التزامن
- التحقق داخل نفس معاملة إنشاء الدفعة؛ لا BEGIN مستقل داخل البوابة
- `FOR UPDATE` على الفاتورة؛ أي رفض → ROLLBACK كامل
- لا تعديل لقيد إصدار أو فاتورة تاريخية أثناء التحقق

## النتائج
- PASS flags-default-false
- PASS unit-allow-with-journal-entry-id
- PASS unit-allow-null-link-sole-ref
- PASS unit-reject-no-issue-je
- PASS unit-reject-cancelled
- PASS unit-reject-reversed-issue
- PASS unit-human-amount-mismatch
- PASS unit-human-entity-mismatch
- PASS unit-human-ambiguous
- PASS svc-reject-payment-without-issue-je
- PASS svc-rollback-no-orphan-payment-je
- PASS svc-allow-after-issue
- PASS svc-multi-one-bad-rejects-all
- PASS server-3010-up-flags-false
- PASS http-legacy-reject-no-issue-je (422)
- PASS http-legacy-no-payment-row-on-reject
- PASS http-legacy-allow-after-issue
- PASS smoke-payroll-hr
- PASS no-autofill-inv-fin-001

**تأكيد:** الأعلام false · INV-FIN دون ملء `journal_entry_id` · لا عكس تاريخي · لا استثناء عام لبذور C2/C3.

**الحرث:** `test-finance-p3-b1d5a3-collection-gate.js`  
**السجل:** `/opt/cursor/artifacts/finance-leadership-p3-b1d5a3-collection-gate-test.log`
