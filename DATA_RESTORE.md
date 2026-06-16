# استعادة بيانات نظام نايوش ERP

## أين ملف البيانات الكامل؟

| الملف | المسار | المحتوى |
|-------|--------|---------|
| **الملف الرئيسي (الكامل)** | `NaioshERP.sql` | نسخة PostgreSQL كاملة: ~5,300 كيان، ~2,800 حاضنة، ~2,800 منصة، 107 مستخدم، 325 دور، المالية، HR، الاستراتيجية |
| نسخة بديلة | `NaioshERP-fixed.sql` | نفس هيكل `NaioshERP.sql` (نسخة مُصلحة) |
| بيانات المكاتب | `real-offices-data.json` | حسابات المكاتب وكلمات المرور للاختبار |
| بيانات تجريبية للمكاتب | `demo-office-accounts.json` | 3 مكاتب تجريبية |

## لماذا البيانات ناقصة على Railway؟

عند تشغيل السيرفر لأول مرة، يعمل `database-bootstrap.js` تلقائياً وينشئ **الحد الأدنى فقط**:

- 11 كيان (HQ + فروع + حاضنات + منصات + مكاتب)
- مستخدم واحد: `HQ001` / `Admin@123`
- عينة من الفواتير والطلبات والإعلانات
- جداول الإدارة الاستراتيجية ببيانات تجريبية

**البيانات الكاملة موجودة في `NaioshERP.sql` ولا تُحمّل تلقائياً** لأن الملف كبير (~42,000 سطر).

## كيف تستعيد البيانات الكاملة؟

### الطريقة 1: من جهازك (موصى بها)

```bash
# 1. اربط DATABASE_URL بقاعدة Railway
export DATABASE_URL="postgresql://USER:PASS@HOST:PORT/railway"

# 2. استورد الملف الكامل
psql "$DATABASE_URL" -f NaioshERP.sql
```

### الطريقة 2: سكربت المشروع

```bash
node scripts/restore-full-database.js --yes
# أو ملف بديل:
node scripts/restore-full-database.js --file NaioshERP-fixed.sql --yes
```

### الطريقة 3: Bootstrap فقط (بيانات أساسية بدون الملف الكامل)

```bash
node scripts/bootstrap-database.js
```

يعيد إنشاء الجداول المطلوبة + بيانات أولية موسّعة (فروع، ربط حاضنات/منصات، استراتيجية، RBAC).

## بيانات الصفحات في المتصفح (localStorage)

صفحات الفروع/المنصات/الحاضنات/المكاتب تحفظ نسخة محلية في المتصفح:

| البادئة | الملف |
|---------|-------|
| `branches:data:v2:*` | `branches-pages.js` |
| `platforms:data:v2:*` | `platforms-pages.js` |
| `incubators:data:v2:*` | `incubators-pages.js` |
| `eoffices:data:v2:*` | `e-offices-pages.js` |
| `sectors:data:*` | `sector-pages.js` |

بعد استعادة قاعدة البيانات، امسح localStorage أو اعمل Hard Refresh لتجنب عرض بيانات قديمة.

## سكربتات بيانات إضافية (تشغيل يدوي)

| السكربت | الغرض |
|---------|-------|
| `add-multi-tenant-system.js` | هيكل Multi-Tenant |
| `add-100-incubators.js` | إضافة 100 حاضنة |
| `add-95-platforms.js` | إضافة 95 منصة |
| `setup-real-offices-credentials.js` | حسابات المكاتب من `real-offices-data.json` |
| `seed-rbac-data.js` | أدوار وصلاحيات |
| `finance/database/init-finance-system.sql` | نظام المالية |
| `insert-strategic-management-data.sql` | بيانات الإدارة الاستراتيجية |

## تسجيل الدخول الافتراضي (بعد Bootstrap)

- **المستخدم:** `HQ001`
- **كلمة المرور:** `Admin@123`
- **البريد:** `admin@naiosh.com`

## بعد الاستعادة

1. أعد نشر التطبيق على Railway (Redeploy)
2. افتح `/hierarchy` — يجب أن تظهر الإحصائيات والهيكل
3. افتح `/tenants` — يجب أن تظهر قائمة الكيانات
4. امسح كاش المتصفح إذا ظهرت بيانات قديمة
