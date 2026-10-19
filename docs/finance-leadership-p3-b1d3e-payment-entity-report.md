# تقرير B1.d.3.e — ملكية الكيان وحماية ترحيل المدفوعات (PUT/DELETE)

**الاختبارات:** PASS — 29 / 0
**النطاق:** PUT/DELETE `/finance/payments/:id` (+ hardening payments.js المظلّل). لا تغيير POST · لا أعلام · لا migrations · لا دمج.

## 1) الملفات والمسارات
- finance/services/finance-posted-guards.js (assertPaymentMutable+Deletable + entity)
- finance/api/finance-routes.js (PUT/DELETE payments)
- finance/api/payments.js (shadowed defense-in-depth)
- test-finance-p3-b1d3e-payment-entity.js
- docs/finance-leadership-p3-b1d3e-payment-entity-report.md

## 2) حماية الكيان
- `resolveActor({ req })` فقط — ترويسات/Body غير موثوقة
- `assertEntityOwns` على الدفعة قبل التعديل/الحذف؛ HQ بلا تفويض صريح مرفوض
- SQL `entity_id IS NOT DISTINCT FROM` دفاع إضافي

## 3) حماية المرحّل
- قفل عبر `journal_entry_id` أو `reference_type=PAYMENT` مرحّل → 409
- رفض حقول `journal_entry_id` / `entity_id` في Body → 409 `PROTECTED_FIELD`
- معاملة + `FOR UPDATE` + advisory lock ضد سباق الترحيل

## 4) سلوك المسودات
- تعديل/حذف مسودة داخل الكيان مسموح
- الحذف يزيل تخصيصات المسودة فقط (لا يلمس أرصدة فواتير مرحّلة)

## 5) مخاطر موثّقة دون تنفيذ
- **DOC-IDEMPOTENCY:** غياب Idempotency-Key لمنع تكرار طلب التحصيل المنطقي (دفعتان مختلفتان ما زالتا ممكنتين)
- **DOC-UNIQUE-REF:** غياب UNIQUE جزئي على (reference_type, reference_id) للقيود المرحّلة PAYMENT
- **DOC-ADVANCE:** سياسة ADVANCE: العلم true يرفض بلا تخصيصات؛ false يبقي المخاطر القديمة — بلا حساب عربون
- **DOC-FLAGS-FALSE:** عند الأعلام false تبقى مسارات الترحيل القديمة بثغراتها المعروفة (تخصيص فارغ، أرصدة)
- **DOC-SHADOW-MOUNT:** payments.js مظلّل؛ إذا تغيّر mount يصبح المسار البديل نشطًا — حُصّن في d.3.e دفاعًا

## 6) نتائج
- PASS routes-use-entity-payment-guards
- PASS shadowed-payments-js-hardened
- PASS guards-export-assertPaymentDeletable
- PASS payment-flag-not-hardcoded-true
- PASS residual-docs-recorded: 5
- PASS draft-update-same-entity
- PASS draft-delete-ok
- PASS reject-update-posted: 409/POSTED_DOCUMENT_LOCKED
- PASS reject-delete-posted: 409/POSTED_DOCUMENT_LOCKED
- PASS fixture-ref-only-no-je-id
- PASS reject-mutate-posted-via-reference-only: 409/POSTED_DOCUMENT_LOCKED
- PASS reject-cross-entity-hq-no-grant: 403/CROSS_ENTITY_DENIED
- PASS spoofed-headers-ignored
- PASS reject-unauthenticated: 401/AUTH_REQUIRED
- PASS race-post-vs-delete-one-wins: {"a":{"ok":true,"kind":"post","id":205},"b":{"ok":false,"kind":"del","err":"POSTED_DOCUMENT_LOCKED"}}
- PASS rollback-keeps-draft
- PASS protected-fields-enforced-in-routes
- PASS public-je-unchanged: n=42
- PASS b1d3b-reg-alloc-posted-locked
- PASS b1d3d-b1d2-flags-default-false
- PASS http-server-up
- PASS http-login
- PASS http-draft-update: 200
- PASS http-reject-protected-field
- PASS http-reject-update-posted
- PASS http-reject-delete-posted
- PASS http-draft-delete
- PASS http-reject-other-entity: 403
- PASS payroll-hr-unaffected

**Production/Staging:** لم يُدمج ولم يُنشر. الأعلام تبقى false.
