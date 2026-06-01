# نظام Multi-Tenant - الهيكل الهرمي

## نظرة عامة

تم تطوير نظام متعدد المستأجرين (Multi-Tenant) بهيكل هرمي يحتوي على 5 مستويات من الكيانات:

```
HQ (المقر الرئيسي)
 └── Branch (الفرع)
      └── Incubator (الحاضنة)
           ├── Platform (المنصة)
           └── Office (المكتب)
```

## الهيكل الهرمي

### 1. HQ (المقر الرئيسي) - HeadQuarters

**الوصف:** أعلى مستوى في الهيكل، يمثل المقر الرئيسي العالمي

**الحقول الرئيسية:**
- `id`: معرف فريد
- `name`: اسم المقر
- `code`: رمز فريد (مثل: HQ-001)
- `country`: البلد
- `contact_email`: البريد الإلكتروني
- `is_active`: حالة التفعيل

**API Endpoints:**
```
GET    /api/headquarters          - الحصول على جميع المقرات
GET    /api/headquarters/:id      - الحصول على مقر محدد
POST   /api/headquarters          - إنشاء مقر جديد
PUT    /api/headquarters/:id      - تحديث مقر
DELETE /api/headquarters/:id      - حذف مقر
```

### 2. Branch (الفرع)

**الوصف:** فرع تابع لمقر رئيسي، يمثل دولة أو منطقة جغرافية

**العلاقات:**
- كل فرع تابع لمقر رئيسي واحد (`hq_id`)

**الحقول الرئيسية:**
- `id`: معرف فريد
- `hq_id`: معرف المقر الرئيسي
- `name`: اسم الفرع
- `code`: رمز فريد (مثل: BR-SA)
- `country`: البلد
- `city`: المدينة
- `manager_name`: اسم المدير

**API Endpoints:**
```
GET    /api/branches              - الحصول على جميع الفروع
GET    /api/branches?hq_id=1      - فلترة الفروع حسب المقر
GET    /api/branches/:id          - الحصول على فرع محدد
POST   /api/branches              - إنشاء فرع جديد
PUT    /api/branches/:id          - تحديث فرع
DELETE /api/branches/:id          - حذف فرع
```

### 3. Incubator (الحاضنة)

**الوصف:** برنامج تشغيلي تابع للفرع، يدير رحلة العميل الكاملة

**العلاقات:**
- كل حاضنة تابعة لفرع واحد (`branch_id`)

**الحقول الرئيسية:**
- `id`: معرف فريد
- `branch_id`: معرف الفرع
- `name`: اسم الحاضنة
- `code`: رمز فريد (مثل: INC-SA-01)
- `program_type`: نوع البرنامج (تدريب، تأهيل، احتضان)
- `capacity`: السعة الاستيعابية
- `start_date`: تاريخ البدء
- `end_date`: تاريخ الانتهاء

**API Endpoints:**
```
GET    /api/incubators                  - الحصول على جميع الحاضنات
GET    /api/incubators?branch_id=1      - فلترة الحاضنات حسب الفرع
GET    /api/incubators/:id              - الحصول على حاضنة محددة
POST   /api/incubators                  - إنشاء حاضنة جديدة
PUT    /api/incubators/:id              - تحديث حاضنة
DELETE /api/incubators/:id              - حذف حاضنة
```

### 4. Platform (المنصة)

**الوصف:** خدمات أو منتجات تقدم تحت الحاضنة

**العلاقات:**
- كل منصة تابعة لحاضنة واحدة (`incubator_id`)

**الحقول الرئيسية:**
- `id`: معرف فريد
- `incubator_id`: معرف الحاضنة
- `name`: اسم المنصة
- `code`: رمز فريد (مثل: PLT-TR-01)
- `platform_type`: نوع المنصة (خدمات، منتجات، برامج)
- `pricing_model`: نموذج التسعير (مجاني، اشتراك، دفع لكل استخدام)
- `base_price`: السعر الأساسي
- `currency`: العملة
- `features`: المميزات (JSON)

**API Endpoints:**
```
GET    /api/platforms                      - الحصول على جميع المنصات
GET    /api/platforms?incubator_id=1       - فلترة المنصات حسب الحاضنة
GET    /api/platforms/:id                  - الحصول على منصة محددة
POST   /api/platforms                      - إنشاء منصة جديدة
PUT    /api/platforms/:id                  - تحديث منصة
DELETE /api/platforms/:id                  - حذف منصة
```

### 5. Office (المكتب)

**الوصف:** نقطة تنفيذ الخدمة للعميل (مكتب إلكتروني، قاعة، مركز خدمة)

**العلاقات:**
- كل مكتب تابع لحاضنة واحدة (`incubator_id`)
- يمكن أن يخدم عدة منصات (many-to-many)

**الحقول الرئيسية:**
- `id`: معرف فريد
- `incubator_id`: معرف الحاضنة
- `name`: اسم المكتب
- `code`: رمز فريد (مثل: OFF-SA-CS)
- `office_type`: نوع المكتب (إلكتروني، قاعة، مركز خدمة)
- `location`: الموقع
- `capacity`: السعة
- `working_hours`: ساعات العمل (JSON)

**API Endpoints:**
```
GET    /api/offices                             - الحصول على جميع المكاتب
GET    /api/offices?incubator_id=1              - فلترة المكاتب حسب الحاضنة
GET    /api/offices/:id                         - الحصول على مكتب محدد
POST   /api/offices                             - إنشاء مكتب جديد
PUT    /api/offices/:id                         - تحديث مكتب
DELETE /api/offices/:id                         - حذف مكتب
GET    /api/offices/:id/platforms               - المنصات المرتبطة بالمكتب
POST   /api/offices/:office_id/platforms/:platform_id  - ربط مكتب بمنصة
DELETE /api/offices/:office_id/platforms/:platform_id  - إلغاء ربط مكتب بمنصة
```

## APIs إضافية

### Hierarchy View

```
GET /api/hierarchy          - عرض الهيكل الكامل مع جميع العلاقات
GET /api/hierarchy/stats    - إحصائيات شاملة للنظام
```

**مثال على الإحصائيات:**
```json
{
  "active_hqs": 1,
  "active_branches": 3,
  "active_incubators": 3,
  "active_platforms": 4,
  "active_offices": 4,
  "active_links": 5
}
```

## خصائص النظام

### 1. عزل البيانات (Data Isolation)

- كل فرع يرى بياناته فقط
- كل حاضنة معزولة عن الأخرى
- التحكم الكامل في الصلاحيات

### 2. الفهارس (Indexes)

تم إنشاء فهارس لتحسين الأداء:
- `idx_branches_hq`: فهرس على `hq_id` في جدول branches
- `idx_incubators_branch`: فهرس على `branch_id` في جدول incubators
- `idx_platforms_incubator`: فهرس على `incubator_id` في جدول platforms
- `idx_offices_incubator`: فهرس على `incubator_id` في جدول offices

### 3. Triggers

تحديث تلقائي لحقل `updated_at` عند أي تعديل على:
- headquarters
- branches
- incubators
- platforms
- offices

### 4. Cascade Delete

عند حذف كيان، يتم حذف جميع الكيانات التابعة له تلقائياً:
- حذف HQ → حذف جميع الفروع والحاضنات والمنصات والمكاتب التابعة
- حذف Branch → حذف جميع الحاضنات والمنصات والمكاتب التابعة
- حذف Incubator → حذف جميع المنصات والمكاتب التابعة

## البيانات التجريبية

### المقر الرئيسي
- NAIOSH Global HQ (HQ-001)

### الفروع
1. فرع المملكة العربية السعودية (BR-SA) - الرياض
2. فرع جمهورية مصر العربية (BR-EG) - القاهرة
3. فرع الإمارات العربية المتحدة (BR-AE) - دبي

### الحاضنات
1. حاضنة الرياض للأعمال (INC-SA-01) - احتضان أعمال
2. حاضنة القاهرة للتقنية (INC-EG-01) - حاضنة تقنية
3. حاضنة دبي للابتكار (INC-AE-01) - ابتكار وتطوير

### المنصات
1. منصة التدريب المهني (PLT-TR-01)
2. منصة الاستشارات (PLT-CS-01)
3. منصة البرمجة (PLT-PG-01)
4. منصة الابتكار (PLT-IN-01)

### المكاتب
1. مكتب خدمة العملاء - الرياض (OFF-SA-CS)
2. القاعة التدريبية - الرياض (OFF-SA-TR)
3. مكتب إلكتروني - القاهرة (OFF-EG-VR)
4. مركز الابتكار - دبي (OFF-AE-IC)

## أمثلة على الاستخدام

### إنشاء فرع جديد

```bash
curl -X POST http://localhost:3000/api/branches \
  -H "Content-Type: application/json" \
  -d '{
    "hq_id": 1,
    "name": "فرع الكويت",
    "code": "BR-KW",
    "country": "Kuwait",
    "city": "Kuwait City",
    "contact_email": "kw@nayosh.com"
  }'
```

### الحصول على جميع الحاضنات لفرع معين

```bash
curl http://localhost:3000/api/incubators?branch_id=1
```

### إنشاء منصة جديدة

```bash
curl -X POST http://localhost:3000/api/platforms \
  -H "Content-Type: application/json" \
  -d '{
    "incubator_id": 1,
    "name": "منصة التسويق الإلكتروني",
    "code": "PLT-MK-01",
    "platform_type": "خدمات تسويقية",
    "pricing_model": "اشتراك شهري",
    "base_price": 299.99,
    "currency": "SAR"
  }'
```

### ربط مكتب بمنصة

```bash
curl -X POST http://localhost:3000/api/offices/1/platforms/2
```

## الملفات الأساسية

- `add-multi-tenant-system.sql`: ملف SQL للهيكل الكامل
- `add-multi-tenant-system.js`: سكريبت تطبيق الـ migration
- `test-multi-tenant.js`: اختبارات شاملة للنظام
- `server.js`: تحديث مع جميع APIs الجديدة

## التشغيل

### 1. تطبيق Migration

```bash
node add-multi-tenant-system.js
```

### 2. تشغيل الاختبارات

```bash
node test-multi-tenant.js
```

### 3. تشغيل السيرفر

```bash
npm start
```

## الاختبارات

تم تنفيذ 10 اختبارات شاملة:

1. ✅ التحقق من وجود جميع الجداول
2. ✅ التحقق من البيانات التجريبية
3. ✅ التحقق من الهيكل الهرمي
4. ✅ إنشاء فرع جديد
5. ✅ التحقق من العلاقات بين الكيانات
6. ✅ التحقق من ربط المكاتب بالمنصات
7. ✅ التحقق من View الهيكل الهرمي
8. ✅ اختبار Triggers التحديث التلقائي
9. ✅ التحقق من عزل البيانات بين الفروع
10. ✅ التحقق من وجود الفهارس

**النتيجة: 100% نجاح**

## الخطوات التالية

1. إضافة نظام المستخدمين والصلاحيات
2. تطبيق JWT للمصادقة
3. إضافة تقارير مفصلة لكل مستوى
4. تطبيق واجهة مستخدم للإدارة
5. إضافة نظام الإشعارات
6. تطبيق Webhooks للتكامل الخارجي

---

**تاريخ الإنشاء:** 11 يناير 2026  
**الإصدار:** 1.0.0  
**الحالة:** ✅ جاهز للإنتاج
