# تقرير إصلاح مشكلة ON CONFLICT مع NULL

## المشكلة
المستخدم رقم 8 (كريم) كان يحصل على رسالة نجاح عند تغيير الدور، لكن لم يحدث أي تغيير فعلي في قاعدة البيانات.

## السبب الجذري
**ON CONFLICT لا يعمل مع NULL في PostgreSQL!**

في PostgreSQL، `NULL != NULL`، لذلك الـ UNIQUE constraint `(user_id, role_id, entity_id)` لا يعتبر السجلين متطابقين إذا كان `entity_id = NULL` في كليهما.

### مثال على المشكلة:
```sql
-- المحاولة الأولى
INSERT INTO user_roles (user_id, role_id, entity_id, is_active)
VALUES (8, 114, NULL, true)
ON CONFLICT (user_id, role_id, entity_id) DO UPDATE ...
-- النتيجة: INSERT نجح، تم إنشاء سجل جديد (ID: 8)

-- المحاولة الثانية (نفس البيانات)
INSERT INTO user_roles (user_id, role_id, entity_id, is_active)
VALUES (8, 114, NULL, true)
ON CONFLICT (user_id, role_id, entity_id) DO UPDATE ...
-- النتيجة: INSERT نجح مرة أخرى، تم إنشاء سجل جديد (ID: 9) ❌

-- المشكلة: ON CONFLICT لم يعمل لأن NULL != NULL
```

## الحل
استبدال ON CONFLICT باستراتيجية **SELECT ثم UPDATE أو INSERT**:

### قبل الإصلاح:
```javascript
const result = await pool.query(`
    INSERT INTO user_roles (user_id, role_id, is_active, granted_at)
    VALUES ($1, $2, true, NOW())
    ON CONFLICT (user_id, role_id, entity_id) 
    DO UPDATE SET is_active = true, granted_at = NOW()
    RETURNING *
`, [userId, roleId]);
```

### بعد الإصلاح:
```javascript
// 1. البحث عن سجل موجود
const existingRole = await pool.query(`
    SELECT id FROM user_roles 
    WHERE user_id = $1 AND role_id = $2 
    AND (entity_id IS NULL OR entity_id = '')
    LIMIT 1
`, [userId, roleId]);

let result;
if (existingRole.rows.length > 0) {
    // 2. تحديث السجل الموجود
    result = await pool.query(`
        UPDATE user_roles 
        SET is_active = true, granted_at = NOW()
        WHERE id = $1
        RETURNING *
    `, [existingRole.rows[0].id]);
} else {
    // 3. إنشاء سجل جديد
    result = await pool.query(`
        INSERT INTO user_roles (user_id, role_id, entity_id, is_active, granted_at)
        VALUES ($1, $2, NULL, true, NOW())
        RETURNING *
    `, [userId, roleId]);
}
```

## الاختبارات

### اختبار 1: تعيين دور للمستخدم 8
```
✅ الدور المراد تعيينه: مدير مالي - المكتب الرئيسي
✅ وُجد سجل موجود (ID: 10) - سيتم تحديثه
✅ is_active: true
✅ النتيجة: 1 دور نشط فقط
```

### اختبار 2: تغيير الدور عدة مرات
```
1️⃣ تعيين SALES_MANAGER_HQ
   ✅ تم تحديث الدور
   
2️⃣ إعادة تعيين نفس الدور
   ✅ تم تحديث الدور (نفس السجل)
   
3️⃣ تعيين MARKETING_MANAGER_HQ
   ✅ تم تحديث الدور
   
النتيجة النهائية:
   إجمالي السجلات: 4
   النشطة: 1 ✅
   ✅ ممتاز! دور واحد فقط نشط
```

## الفوائد
1. ✅ لا يتم إنشاء سجلات مكررة
2. ✅ تحديث السجل الموجود بدلاً من إنشاء واحد جديد
3. ✅ دور واحد فقط نشط في كل مرة
4. ✅ يعمل بشكل صحيح مع entity_id = NULL

## الملفات المعدلة
- `super-admin-api.js` (السطور 465-487): إصلاح endpoint POST /users/:userId/role

## التاريخ
22 يناير 2026
