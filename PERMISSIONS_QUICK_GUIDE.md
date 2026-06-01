# 🚀 دليل الاستخدام السريع - نظام الصلاحيات

## كيفية التحقق من صلاحيات المستخدم

### 1. استخدام API Endpoint
```javascript
// من الواجهة الأمامية
fetch('/api/permissions/my-permissions', {
    headers: {
        'Authorization': `Bearer ${token}`
    }
})
.then(res => res.json())
.then(data => {
    console.log('صلاحياتي:', data.permissions);
    console.log('وظيفتي:', data.user_role);
    console.log('حد الموافقة المالية:', data.max_approval_limit);
});
```

### 2. استخدام الدوال في SQL
```sql
-- التحقق من صلاحية نظام معين
SELECT check_user_system_permission(123, 'FINANCE', 'FULL');

-- التحقق من حد الموافقة المالية
SELECT check_user_approval_limit(123, 150000);

-- عرض جميع صلاحيات المستخدم
SELECT * FROM get_user_permissions_summary(123);
```

### 3. استخدام في Node.js
```javascript
const { Pool } = require('pg');
const pool = new Pool({ connectionString: DATABASE_URL });

// التحقق من الصلاحية
async function checkPermission(userId, systemCode, level) {
    const result = await pool.query(
        'SELECT check_user_system_permission($1, $2, $3)',
        [userId, systemCode, level]
    );
    return result.rows[0].check_user_system_permission;
}

// مثال
const canEdit = await checkPermission(123, 'FINANCE', 'FULL');
if (canEdit) {
    // السماح بالتعديل
}
```

## أمثلة حسب الوظيفة

### مدير فرع
```javascript
// يمكنه:
- إدارة الموارد البشرية في فرعه (FULL)
- الموافقة على المصروفات حتى 2,000,000
- عرض والموافقة على المبيعات والمشتريات
- عرض التقارير المالية
```

### تنفيذي مبيعات
```javascript
// يمكنه:
- إدخال عروض الأسعار والفواتير (EXECUTIVE)
- عرض التقارير التسويقية (VIEW)
- عرض التقارير المالية (VIEW)
- الموافقة على مبالغ حتى 2,000
```

### موظف عادي
```javascript
// يمكنه:
- عرض بياناته الشخصية فقط (LIMITED)
- لا يمكنه الوصول لأي نظام آخر
```

## أكواد الأنظمة
- `HR_ADMIN` - الإداري والموارد البشرية
- `FINANCE` - المالي والمحاسبي
- `PROCUREMENT` - المشتريات
- `SALES` - المبيعات
- `MARKETING` - التسويق
- `SUPPLY_CHAIN` - سلاسل الإمداد
- `SAFETY` - السلامة
- `WAREHOUSE` - المخازن

## أكواد المستويات
- `FULL` - صلاحيات كاملة
- `VIEW_APPROVE` - عرض وموافقة
- `EXECUTIVE` - تنفيذي
- `VIEW` - عرض فقط
- `LIMITED` - محدود جداً
- `NONE` - لا يوجد

## للمزيد من التفاصيل
راجع: [PERMISSIONS_IMPLEMENTATION_REPORT.md](PERMISSIONS_IMPLEMENTATION_REPORT.md)
