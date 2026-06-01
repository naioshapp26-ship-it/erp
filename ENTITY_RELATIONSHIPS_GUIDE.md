# ربط العناصر بالكيانات الهرمية 🔗
## Entity Relationship Integration

## 📋 نظرة عامة

تم ربط جميع عناصر النظام بالكيانات الهرمية الجديدة (HQ → Branch → Incubator → Platform → Office) لتحقيق عزل كامل للبيانات وإدارة محكمة.

---

## 🎯 العلاقات المُنفذة

### 1️⃣ العملاء/المستخدمين (Users) 👥

**يتبعون**: Office / Platform / Incubator / Branch

**الحقول الجديدة**:
- `branch_id` - ربط بفرع معين
- `incubator_id` - ربط بحاضنة معينة
- `platform_id` - ربط بمنصة معينة
- `office_id` - ربط بمكتب معين
- `linked_entity_type` - نوع الكيان المرتبط

**API Endpoints**:
```http
GET  /api/users-with-entity
PUT  /api/users/:id/link-entity
```

**مثال ربط مستخدم**:
```javascript
PUT /api/users/5/link-entity
{
  "entity_type": "BRANCH",
  "branch_id": 2,
  "incubator_id": null,
  "platform_id": null,
  "office_id": null
}
```

---

### 2️⃣ الفواتير (Invoices) 📄

**تتبع**: العميل + Office / Branch / Incubator

**الحقول الجديدة**:
- `user_id` - العميل المرتبط بالفاتورة
- `branch_id` - الفرع الذي أصدر الفاتورة
- `office_id` - المكتب الذي أصدر الفاتورة
- `incubator_id` - الحاضنة التي أصدرت الفاتورة
- `issuer_entity_type` - نوع الكيان المُصدر

**API Endpoints**:
```http
GET  /api/invoices-with-details
PUT  /api/invoices/:id/link
```

**مثال ربط فاتورة**:
```javascript
PUT /api/invoices/INV-1005/link
{
  "user_id": 5,
  "branch_id": 2,
  "office_id": null,
  "incubator_id": null,
  "issuer_entity_type": "BRANCH"
}
```

---

### 3️⃣ الموظفين (Employees) 👨‍💼

**يتبعون**: HQ / Branch / Incubator / Platform / Office

**جدول جديد كامل**: `employees`

**الحقول الأساسية**:
- `employee_number` - رقم الموظف (فريد)
- `full_name` - الاسم الكامل
- `email` - البريد الإلكتروني
- `phone` - رقم الهاتف
- `national_id` - رقم الهوية الوطنية
- `position` - المسمى الوظيفي
- `department` - القسم

**حقول الربط بالكيانات**:
- `hq_id` - ربط بالمقر الرئيسي
- `branch_id` - ربط بفرع
- `incubator_id` - ربط بحاضنة
- `platform_id` - ربط بمنصة
- `office_id` - ربط بمكتب
- `assigned_entity_type` - نوع الكيان المعين له

**معلومات التوظيف**:
- `hire_date` - تاريخ التوظيف
- `salary` - الراتب
- `employment_type` - نوع التوظيف (دوام كامل/جزئي/عقد/متدرب)
- `is_active` - نشط/غير نشط
- `termination_date` - تاريخ إنهاء الخدمة

**API Endpoints**:
```http
GET    /api/employees
GET    /api/employees/:id
POST   /api/employees
PUT    /api/employees/:id
DELETE /api/employees/:id
GET    /api/entities/:entity_type/:entity_id/employees
```

**مثال إنشاء موظف**:
```javascript
POST /api/employees
{
  "employee_number": "EMP-004",
  "full_name": "سارة أحمد العتيبي",
  "email": "sara.otaibi@nayosh.com",
  "phone": "+966504567890",
  "national_id": "4567890123",
  "position": "محاسب",
  "department": "المالية",
  "branch_id": 2,
  "assigned_entity_type": "BRANCH",
  "hire_date": "2024-01-01",
  "salary": 10000.00,
  "employment_type": "FULL_TIME"
}
```

**مثال جلب موظفي فرع**:
```http
GET /api/entities/BRANCH/2/employees
```

---

### 4️⃣ الإعلانات (Ads) 📢

**تتبع**: HQ / Branch / Incubator / Platform / Office (حسب المستوى)

**الحقول الجديدة**:
- `hq_id` - إعلان من المقر الرئيسي
- `new_branch_id` - إعلان من فرع معين
- `new_incubator_id` - إعلان من حاضنة معينة
- `new_platform_id` - إعلان من منصة معينة
- `new_office_id` - إعلان من مكتب معين
- `ad_source_entity_type` - نوع الكيان المصدر

**API Endpoints**:
```http
GET  /api/ads-with-source
PUT  /api/ads/:id/link-source
```

**مثال ربط إعلان**:
```javascript
PUT /api/ads/5/link-source
{
  "entity_type": "BRANCH",
  "hq_id": null,
  "branch_id": 2,
  "incubator_id": null,
  "platform_id": null,
  "office_id": null
}
```

---

## 📊 Views الجديدة

تم إنشاء 4 views لتسهيل الاستعلام:

### 1. `users_with_entity`
عرض المستخدمين مع معلومات الكيان المرتبط كاملة.

```sql
SELECT * FROM users_with_entity WHERE linked_entity_type = 'BRANCH';
```

### 2. `employees_with_entity`
عرض الموظفين مع معلومات الكيان المعين لهم.

```sql
SELECT * FROM employees_with_entity WHERE assigned_entity_type = 'INCUBATOR';
```

### 3. `invoices_with_details`
عرض الفواتير مع معلومات العميل والكيان المُصدر.

```sql
SELECT * FROM invoices_with_details WHERE issuer_entity_type = 'OFFICE';
```

### 4. `ads_with_source`
عرض الإعلانات مع معلومات الكيان المصدر.

```sql
SELECT * FROM ads_with_source WHERE ad_source_entity_type = 'HQ';
```

---

## 🔒 Constraints والقيود

### جدول users
```sql
-- يجب أن يكون للمستخدم ربط واحد على الأقل
CHECK (
  (branch_id IS NOT NULL) OR 
  (incubator_id IS NOT NULL) OR 
  (platform_id IS NOT NULL) OR 
  (office_id IS NOT NULL) OR
  (entity_id IS NOT NULL)
)
```

### جدول employees
```sql
-- يجب أن يكون الموظف مرتبط بكيان واحد فقط
CHECK (
  (CASE WHEN hq_id IS NOT NULL THEN 1 ELSE 0 END +
   CASE WHEN branch_id IS NOT NULL THEN 1 ELSE 0 END +
   CASE WHEN incubator_id IS NOT NULL THEN 1 ELSE 0 END +
   CASE WHEN platform_id IS NOT NULL THEN 1 ELSE 0 END +
   CASE WHEN office_id IS NOT NULL THEN 1 ELSE 0 END) = 1
)
```

---

## 🗂️ Indexes للأداء

تم إنشاء Indexes على جميع حقول الربط:

**جدول users**:
- `idx_users_branch_id`
- `idx_users_incubator_id`
- `idx_users_platform_id`
- `idx_users_office_id`
- `idx_users_linked_entity_type`

**جدول employees**:
- `idx_employees_hq_id`
- `idx_employees_branch_id`
- `idx_employees_incubator_id`
- `idx_employees_platform_id`
- `idx_employees_office_id`
- `idx_employees_assigned_entity_type`
- `idx_employees_employee_number`
- `idx_employees_email`
- `idx_employees_is_active`

**جدول invoices**:
- `idx_invoices_user_id`
- `idx_invoices_branch_id`
- `idx_invoices_office_id`
- `idx_invoices_incubator_id`
- `idx_invoices_issuer_entity_type`

**جدول ads**:
- `idx_ads_hq_id`
- `idx_ads_new_branch_id`
- `idx_ads_new_incubator_id`
- `idx_ads_new_platform_id`
- `idx_ads_new_office_id`
- `idx_ads_ad_source_entity_type`

---

## 🚀 تنفيذ Migration

### الخطوات:

1. **تنفيذ Migration**:
```bash
node add-entity-relationships.js
```

2. **التحقق من النتائج**:
```bash
# عرض عدد الموظفين
curl http://localhost:3000/api/employees

# عرض المستخدمين مع الكيانات
curl http://localhost:3000/api/users-with-entity

# عرض الفواتير مع التفاصيل
curl http://localhost:3000/api/invoices-with-details

# عرض الإعلانات مع المصدر
curl http://localhost:3000/api/ads-with-source
```

---

## 📝 أمثلة الاستخدام

### مثال 1: جلب موظفي فرع معين
```bash
curl "http://localhost:3000/api/employees?entity_type=BRANCH&entity_id=2"
```

### مثال 2: جلب فواتير مكتب معين
```bash
curl "http://localhost:3000/api/invoices-with-details?entity_type=OFFICE"
```

### مثال 3: جلب مستخدمي منصة معينة
```bash
curl "http://localhost:3000/api/users-with-entity?entity_type=PLATFORM"
```

### مثال 4: جلب إعلانات حاضنة معينة
```bash
curl "http://localhost:3000/api/ads-with-source?entity_type=INCUBATOR"
```

---

## 📊 البيانات التجريبية

تم إضافة 3 موظفين تجريبيين:

1. **أحمد محمد السعيد** (EMP-001)
   - مدير فرع
   - مرتبط بـ: فرع المملكة العربية السعودية (BRANCH)

2. **فاطمة خالد الزهراني** (EMP-002)
   - مديرة حاضنة
   - مرتبط بـ: حاضنة الرياض للأعمال (INCUBATOR)

3. **عمر يوسف المالكي** (EMP-003)
   - فني دعم
   - مرتبط بـ: منصة التدريب المهني (PLATFORM)

---

## 🔄 التحديثات التلقائية

### Trigger لجدول employees
```sql
CREATE TRIGGER trigger_update_employee_timestamp
  BEFORE UPDATE ON employees
  FOR EACH ROW
  EXECUTE FUNCTION update_employee_timestamp();
```

يقوم بتحديث `updated_at` تلقائياً عند كل تعديل.

---

## ✅ الحالة النهائية

| العنصر | الربط بـ | الحقول الجديدة | APIs |
|--------|---------|----------------|------|
| **Users** | Office/Platform/Incubator/Branch | 5 | 2 |
| **Invoices** | User + Office/Branch/Incubator | 5 | 2 |
| **Employees** | HQ/Branch/Incubator/Platform/Office | 19 | 6 |
| **Ads** | HQ/Branch/Incubator/Platform/Office | 6 | 2 |

**إجمالي APIs الجديدة**: 12  
**إجمالي Views**: 4  
**إجمالي Indexes**: 25+  
**إجمالي Constraints**: 2

---

## 🎯 الخطوات التالية (اختياري)

- [ ] واجهات UI لإدارة الموظفين
- [ ] واجهات لربط المستخدمين بالكيانات
- [ ] تقارير تحليلية حسب الكيانات
- [ ] Dashboard للموارد البشرية
- [ ] نظام الصلاحيات حسب الكيان

---

**تم التطوير**: 11 يناير 2026  
**الحالة**: ✅ جاهز للإنتاج
