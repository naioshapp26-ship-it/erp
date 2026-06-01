# تعليمات النشر على Railway

## الخطوات المطلوبة بعد النشر

### 1. تعيين دور Super Admin للمستخدم HQ001
بعد النشر على Railway، يجب تشغيل السكريبت التالي لتعيين دور Super Admin:

```bash
node assign-super-admin-role.js
```

أو يمكنك تنفيذ الاستعلام SQL التالي مباشرة:

```sql
-- التحقق من وجود دور SUPER_ADMIN
SELECT id, name, job_title_ar FROM roles WHERE name = 'SUPER_ADMIN';

-- تعيين الدور للمستخدم HQ001 (user_id = 1)
INSERT INTO user_roles (user_id, role_id, is_active, granted_at)
SELECT 1, id, true, NOW()
FROM roles 
WHERE name = 'SUPER_ADMIN'
ON CONFLICT DO NOTHING;

-- التحقق من التعيين
SELECT ur.*, r.job_title_ar 
FROM user_roles ur
JOIN roles r ON ur.role_id = r.id
WHERE ur.user_id = 1 AND ur.is_active = true;
```

### 2. التحقق من عمل API

#### اختبار metadata:
```bash
curl -X GET https://super-cmk2wuy9-production.up.railway.app/api/admin/metadata \
  -H "x-user-id: 1"
```

#### اختبار قائمة الأدوار:
```bash
curl -X GET https://super-cmk2wuy9-production.up.railway.app/api/admin/roles \
  -H "x-user-id: 1"
```

### 3. فتح صفحة Super Admin
بعد التأكد من نجاح الخطوات السابقة، افتح الصفحة:
```
https://super-cmk2wuy9-production.up.railway.app/super-admin-page.html
```

## المشاكل المحتملة وحلولها

### خطأ "غير مصرح - لا يوجد دور نشط"
**السبب:** المستخدم لم يتم تعيين دور Super Admin له
**الحل:** تشغيل سكريبت assign-super-admin-role.js

### خطأ "خطأ في الاتصال بالسيرفر"
**السبب:** السيرفر لم يبدأ بشكل صحيح أو API غير موصول
**الحل:** 
1. التحقق من logs على Railway
2. التأكد من أن server.js يحتوي على:
   ```javascript
   const superAdminRoutes = require('./super-admin-api');
   app.use('/api/admin', superAdminRoutes);
   ```

### قائمة الأدوار فارغة
**السبب:** لا توجد أدوار في قاعدة البيانات
**الحل:** تشغيل سكريبت add-33-roles.sql أو apply-33-roles.js

## بيانات الاتصال المؤقتة
```
Database URL: postgresql://postgres:PddzJpAQYezqknsntSzmCUlQYuYJldcT@crossover.proxy.rlwy.net:44255/railway
Username: postgres
Password: PddzJpAQYezqknsntSzmCUlQYuYJldcT
Host: crossover.proxy.rlwy.net
Port: 44255
Database: railway
```

⚠️ **ملاحظة:** هذه بيانات مؤقتة وقد تتغير

## التحقق من النجاح
✅ صفحة Super Admin تفتح بدون أخطاء
✅ قائمة الأدوار تظهر 33 دور
✅ المستخدم HQ001 له صلاحيات الوصول
✅ جميع الأنظمة (8 أنظمة) تظهر في metadata

## التاريخ
22 يناير 2026
