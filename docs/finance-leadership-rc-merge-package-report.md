# حزمة دمج Finance RC النهائية — مراجعة ما قبل الموافقة

**الفرع المرشح للدمج:** `cursor/finance-leadership-rc-merge-package-421d`  
**القاعدة:** `origin/main`  
**الحالة:** جاهزة لطلب موافقة الدمج + نشر Staging فقط — **لم يُنفَّذ دمج ولا نشر.**

## 1) Commits التي ستُدمج (23) — Finance فقط

من `origin/main` بعد استبعاد P1/UI:

1. `3cfd0ae` / `2b3101a` — P3 sales-to-ledger design  
2. `ea911f7` / `332ab56` — B1 posting-service design  
3. `9d39298` — B1.a baseline  
4. `3d68c3d` — B1.b FinancePostingService  
5. `31b1b1a` — B1.c posted guards  
6. `a2f6c3e` — B1.d.1 posting helpers  
7. `8fea11c` — B1.d.2 parity analysis  
8. `aca381d` — B1.d.2 readiness  
9. `1348d43` — B1.d.2 invoice wire (flag default false)  
10. `862a1a6` — B1.d.3 payments analysis  
11. `39983d2` — B1.d.3.b allocation guards  
12. `c0e5a05` — B1.d.3.c payment JE meta  
13. `0d8fb57` — B1.d.3.d payment wire (flag default false)  
14. `e523bef` — B1.d.3.e payment entity  
15. `522072b` — B1.d.4 readiness analysis  
16. `69e801a` — B1.d.4 PASS report  
17. `f9a1d3a` — B1.d.5a historical audit (RO)  
18. `8b64ca1` — B1.d.5a.1 UNIQUE design  
19. `5757882` — B1.d.5a.2 gate/isolation design  
20. `308e250` — B1.d.5a.3 collection gate  
21. `5804992` — ops closeout  
22. `120d605` — closeout report PASS  
23. `b8c305a` — RC ADVANCE-B + Staging gate  

**مُستبعَد عمدًا (P1/UI):**  
`6b3c5d9` command panel · `25acf7a` mobile sidebar test · `177ebca` catalog statuses  

## 2) الملفات (60) — خالية من P1 UI

**خارج finance/docs/tests/scripts/migrations:**  
- `server.js` فقط — تعليق + تسجيل DELETE واحد لتخصيصات الدفع (B1.d.3.b)، بلا UI.

**غائب عن الحزمة:**  
`finance-leadership-360-catalog.js` · `leadership-coming-soon.html` · `leadership-page-settings.html` · اختبارات P1 banner/cards/home.

**لا يُطبَّق تلقائيًا:**  
`migrations/pending/20261019_finance_unique_*.sql` (ملفات معلّقة فقط).

## 3) اختبارات ما قبل الدمج (معزولة · ليس Production)

| حرث | نتيجة |
|-----|--------|
| RC staging gate | **PASS 26/0** |
| Ops closeout | **PASS 34/0** |
| Collection gate 5a.3 | **PASS 19/0** |
| HR e-archive / payroll hub / finance hub | **200** |
| أعلام FINANCE_POST_* | **false** |
| UNIQUE على public | **غير موجود** |

## 4) نشر Staging دون migrations أو أعلام؟

**نعم** — الحزمة كود تطبيق + وثائق + اختبارات + ملفات pending غير مفعّلة.  
شروط النشر عند الموافقة:  
`FINANCE_POST_INVOICE_VIA_SERVICE=false` · `FINANCE_POST_PAYMENT_VIA_SERVICE=false` · بلا تطبيق UNIQUE · بلا تعديل بيانات تاريخية.

## 5) التراجع إن فشل النشر

1. **إيقاف فوري:** أعد نشر بناء `main` السابق (نفس متغيرات البيئة، أعلام false).  
2. **لا عكس قيود محاسبية تلقائيًا.**  
3. إن لزم عزل المسار: أبقِ الأعلام false (الوضع الافتراضي؛ ADVANCE-ب وبوابة التحصيل في الكود المدموج — التراجع = رجوع البناء).  
4. UNIQUE غير مطبّق → لا حاجة لـ `DROP INDEX`.

## طلب الموافقة

هل توافق صراحةً على:
1. **دمج** `cursor/finance-leadership-rc-merge-package-421d` → `main`؟  
2. **نشر Staging** بعدها بالشروط أعلاه؟

**لا دمج ولا نشر حتى ردّك الصريح.**
