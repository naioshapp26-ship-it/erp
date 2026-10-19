# إصلاح صفحة `/finance` الفارغة (placeholder)

## إجابات التشخيص

| # | السؤال | الجواب |
|---|--------|--------|
| 1 | السبب الجذري | في `main`، `finance/index.html` يعرض نصًا ثابتًا «سيتم إضافة… قريبًا» بعد commit نقل البطاقات إلى HR (`746937a`). دمج RC المحاسبي استبعد عمدًا واجهة P1 (الكتالوج) فلم يُعاد بناء قائمة الوحدات. |
| 2 | الـcommit المنشور | الإنتاج يعرض نفس HTML الـplaceholder (بدون `finance-leadership-360-catalog.js`). يتوافق مع `main` بعد دمج RC (`1cf4fbc` وما حوله) — ليست مشكلة أعلام ترحيل. |
| 3 | أين الواجهات الصحيحة | الفرع `cursor/finance-leadership-360-p1-421d`: `finance-leadership-360-catalog.js` + `index.html` يعرض الأقسام ويربط لصفحات HTML موجودة أصلًا. |
| 4 | نوع المشكلة | **Frontend/route template** — ليست صلاحيات ولا API ولا Feature Flag ترحيل. الصفحات الفرعية على الإنتاج ترجع 200. |
| 5 | ملفات الإصلاح | `finance/index.html` · `finance/finance-leadership-360-catalog.js` · `finance/leadership-coming-soon.html` · `finance/leadership-page-settings.html` (+ اختبارات hub) |
| 6 | استعادة بلا مساس بالبيانات؟ | **نعم** — ربط عرض فقط لملفات موجودة؛ لا DB/migrations/أعلام. |
| 7 | خطوات وبوابة موافقة | دمج هذا Draft → نشر بموافقتك الصريحة. تحقق: `/finance` بلا placeholder · روابط المصروفات/القيود/المدفوعات/الفواتير تفتح. |

## ما تم في Draft (هذا الفرع)

- استعادة كتالوج القيادة المالية 360 وعارض الأقسام في `/finance`
- الروابط تشير لصفحات قائمة (38 رابط finance/*.html بدون ملفات ناقصة)
- لا تفعيل `FINANCE_POST_*` · لا migrations · لا تعديل بيانات

## تحقق محلي

- catalog audit **72/0** · P1 hub **66/0**
- `/finance` يحمّل الكتالوج وبدون placeholder
- عيّنة صفحات operational → 200
- الإنتاج ما زال يظهر placeholder حتى يُنشر هذا الإصلاح (بانتظار موافقتك)
