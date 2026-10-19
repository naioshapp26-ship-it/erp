# تقرير تنفيذ B1.b — FinancePostingService

**النتيجة:** PASS — 26 / 0

## الملفات التي تغيّرت
- finance/services/finance-posting-service.js (new)
- finance/api/finance-routes.js (post wired + reverse endpoint)
- test-finance-p3-b1b-posting-service.js (new)
- docs/finance-leadership-p3-b1b-report.md (new)

## ما أصبح محميًا
- POST /finance/journal-entries/:id/post عبر FinancePostingService (توازن، حسابات، حالة DRAFT، قفل)
- POST /finance/journal-entries/:id/reverse (قيد جديد مرتبط، منع العكس المكرر داخل المعاملة+advisory lock)
- صلاحيات reverse إلزامية؛ post يدعم Admin/Manager/explicit أو legacy_unscoped
- audit_logs لعمليات JOURNAL_POST / JOURNAL_REVERSE عند توفر الجدول

## ما زال معرضًا للخطر
- POST /finance/invoices و /payments ما زالا يرحّلان تلقائيًا بلا الخدمة
- DELETE قيد/فاتورة مرحّلة ما زال بلا حراسة (B1.c)
- تعديل أسطر قيد مرحّل عبر journal-lines (B1.c)
- بدون migration UNIQUE: حماية العكس تعتمد على القفل التطبيقي وليس قيد DB
- post بوضع legacy_unscoped إن لم يُرسل دور/صلاحية

## هل الترحيل التلقائي الحالي كما هو؟
**نعم** — مسارات `POST /finance/invoices` و`POST /finance/payments` لم تُعدَّل.

## هل نحتاج migration لضمان التفرد؟
**نعم كتحسين لاحق (غير منفَّذ في B1.b).**
- لا تنفَّذ الآن.
- لا UNIQUE عام على (reference_type, reference_id) لكل الأنواع — قد يكون مشروعًا وجود أكثر من قيد لنفس المرجع بأنواع مختلفة (مثل INVOICE issue + لاحقًا تسوية).
- المقترح لاحقًا بموافقة: فهرس فريد جزئي فقط على reference_type IN ('JOURNAL_REVERSAL') AND is_posted — لمنع عكوس مكررة على مستوى DB.
- لفواتير/مدفوعات (B1.d+): فهرس فريد جزئي منفصل على posting_kind/entry_type المناسب بعد إدخال العمود — ليس في B1.b.
- B1.b يعتمد حاليًا: advisory_xact_lock + FOR UPDATE + فحص وجود عكس نشط. حماية قوية داخل المسار؛ بدون UNIQUE تبقى فجوة نظرية إن تُجاوز القفل.

`claimCompleteDbUniqueness: false` — لا نعلن اكتمال حماية DB بدون UNIQUE.

## خطة B1.c (بدون تنفيذ)
- **B1.c.1**: assertMutable على DELETE/PUT journal entries + journal-lines
- **B1.c.2**: منع DELETE فاتورة/دفعة لها journal_entry_id فعّال
- **B1.c.3**: رفض تعديل بنود قيد POSTED
- **B1.c.4**: اختبارات انحدار UI journal/receivables
- **B1.c.out**: لا توجيه invoices/payments بعد؛ لا UNIQUE migration دون موافقة

## نتائج الاختبارات
- PASS perm-admin-post
- PASS perm-viewer-reverse-denied
- PASS perm-legacy-post-allowed
- PASS perm-legacy-reverse-denied
- PASS post-balanced-success: B1B-bal-1792431642617-560
- PASS post-already-posted-404: ALREADY_POSTED
- PASS post-unbalanced-422
- PASS post-unbalanced-no-side-effect
- PASS reverse-perm-403
- PASS reverse-linked-to-original: 7
- PASS reverse-original-not-mutated-status
- PASS reverse-balanced
- PASS reverse-second-409
- PASS concurrent-post-one-winner: ["rejected","fulfilled"]
- PASS concurrent-reverse-one-winner: reversals=1
- PASS post-bad-account-422: ACCOUNT_NOT_FOUND
- PASS post-bad-account-rolled-back
- PASS hist-no-public-dup-refs
- PASS migration-not-executed
- PASS auto-post-paths-untouched
- PASS manual-post-uses-service
- PASS public-je-count-unchanged: 0
- PASS http-create-draft: 1
- PASS http-post-contract: 200
- PASS http-reverse-contract: 2
- PASS http-reverse-repeat-409

لا دمج / لا Staging / لا Production. بانتظار موافقة قبل أي مرحلة تالية.