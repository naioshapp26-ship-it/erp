# تقرير B1.c — حماية المستندات المرحّلة وصلاحيات الترحيل

**النتيجة:** PASS — 24 / 0

## الملفات والمسارات
- finance/services/finance-posted-guards.js (new)
- finance/services/finance-posting-service.js (remove legacy_unscoped; session-only actor)
- finance/api/finance-routes.js (invoice/payment PUT/DELETE guards)
- finance/api/journal.js (PUT/DELETE guards)
- finance/api/journal-lines.js (create/update/delete guards)
- finance/api/ar-aging.js (invoice update/delete guards)
- test-finance-p3-b1c-posted-guards.js
- docs/finance-leadership-p3-b1c-report.md

## محمي فعليًا
- DELETE/PUT قيود POSTED عبر journal.js
- create/update/delete أسطر قيود مرحّلة عبر journal-lines.js
- DELETE/PUT فواتير مرتبطة بقيد مرحّل (journal_entry_id أو reference INVOICE)
- DELETE/PUT مدفوعات مرتبطة بقيد مرحّل
- ar-aging update/delete بنفس الحراسة
- ترحيل/عكس يدوي يتطلب جلسة موثوقة (لا legacy_unscoped)

## ما زال خطرًا
- ترحيل تلقائي عند إنشاء فاتورة/دفعة (خارج B1.c)
- بدون UNIQUE migration لمسار العكس (كما في B1.b)
- مسارات payroll post غير مغطاة بحراسة الحذف هنا (لا حذف JE payroll في هذا النطاق)

## إغلاق legacy_unscoped
{
  "removed": "legacy_unscoped",
  "trust": "req.authUser from session middleware only",
  "ignored": [
    "x-user-role",
    "x-finance-permissions",
    "x-user-id as sole auth"
  ],
  "affectedIntegrations": [
    "أي استدعاء لـ POST /finance/journal-entries/:id/post بدون Bearer/cookie جلسة صالحة → 401",
    "استدعاءات كانت تعتمد على ترويسة x-user-role فقط ← لم تعد كافية",
    "واجهة journal.html التي ترسل التوكن مع الطلبات تبقى تعمل لدور Admin/Manager"
  ],
  "note": "إغلاق الفجوة ضمن نطاق B1.c (منع افتراضي). لا مسار مفتوح متبقٍ."
}

## الترحيل التلقائي للفواتير/المدفوعات
**لم يُغيَّر.**

## هل نحتاج migration؟
لا لتنفيذ حراسة الحذف/التعديل في B1.c. UNIQUE للعكس يبقى مقترح B1.b غير منفَّذ.

## نتائج الاختبارات
- PASS auth-default-deny-401
- PASS auth-admin-ok
- PASS auth-ignores-spoofed-headers
- PASS auth-uses-session-authUser
- PASS draft-mutable-allowed
- PASS posted-je-delete-blocked: لا يمكن حذف قيد مرحّل. استخدم مسار العكس المحاسبي المخصص.
- PASS posted-je-update-blocked
- PASS invoice-delete-via-reference-blocked: reference_type:INVOICE
- PASS payment-delete-posted-blocked
- PASS legitimate-reverse-still-works
- PASS draft-invoice-deletable
- PASS auto-post-untouched
- PASS public-business-counts-unchanged-by-isolated-tests
- PASS http-create-draft: B1C-HTTP-1792432328897-main
- PASS http-post-with-session
- PASS http-delete-posted-je-409: لا يمكن حذف قيد مرحّل. استخدم مسار العكس المحاسبي المخصص.
- PASS http-put-posted-je-409
- PASS http-add-line-posted-409
- PASS http-post-without-auth-401: AUTH_REQUIRED
- PASS http-spoof-headers-401
- PASS http-legitimate-reverse
- PASS smoke:/hr: 200
- PASS smoke:/finance: 200
- PASS smoke:/finance/payroll-runs.html: 200

لا دمج / لا Staging / لا Production. بانتظار موافقة قبل أي مرحلة تالية.