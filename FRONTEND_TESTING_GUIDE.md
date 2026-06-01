# دليل اختبار نظام الصلاحيات من الواجهة الأمامية

## 📋 نظرة عامة

هذا الدليل يشرح كيفية اختبار نظام الصلاحيات الذي تم تطبيقه من خلال الواجهة الأمامية.

---

## 🎯 المكونات الرئيسية

### 1. API Endpoints
تم إنشاء 5 نقاط نهاية رئيسية في `api-permissions-endpoints.js`:

| Endpoint | الوصف | الاستخدام |
|----------|-------|-----------|
| `GET /api/permissions/my-permissions` | جلب جميع صلاحيات المستخدم | عرض الصلاحيات في لوحة التحكم |
| `POST /api/permissions/check` | التحقق من صلاحية محددة | إخفاء/إظهار الأزرار |
| `POST /api/permissions/check-approval` | التحقق من حد الموافقة المالية | التحقق قبل الموافقة المالية |
| `GET /api/permissions/available-systems` | قائمة الأنظمة المتاحة | بناء القائمة الجانبية |
| `GET /api/permissions/my-role` | معلومات دور المستخدم | عرض معلومات المستخدم |

### 2. React Hook
`usePermissions()` في `frontend-permissions-hook.jsx`:
- إدارة حالة الصلاحيات
- التحقق من الصلاحيات
- التحقق من حدود الموافقة المالية

### 3. React Components
في `frontend-examples.jsx`:
- `<PermissionGuard>` - إخفاء/إظهار العناصر
- `<UserRoleDisplay>` - عرض معلومات الدور
- أمثلة عملية كاملة

---

## 🔧 خطوات الإعداد

### 1. إضافة الـ API إلى التطبيق

```javascript
// server.js أو app.js
const express = require('express');
const app = express();

// إضافة middleware للمصادقة (Authentication)
app.use(async (req, res, next) => {
    // هنا يجب أن تضع كود المصادقة الخاص بك
    // مثال:
    const userId = req.session?.userId || req.headers['x-user-id'];
    req.userId = userId;
    next();
});

// استيراد routes الصلاحيات
const permissionsRouter = require('./api-permissions-endpoints');
app.use('/api/permissions', permissionsRouter);

app.listen(3000, () => {
    console.log('Server running on port 3000');
});
```

### 2. تثبيت المكتبات المطلوبة

```bash
npm install axios react
```

### 3. إعداد Axios في React

```javascript
// src/api/axios.js
import axios from 'axios';

const api = axios.create({
    baseURL: 'http://localhost:3000',
    headers: {
        'Content-Type': 'application/json'
    }
});

// إضافة token للمصادقة
api.interceptors.request.use(config => {
    const token = localStorage.getItem('token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

export default api;
```

---

## 🧪 سيناريوهات الاختبار

### السيناريو 1: اختبار صلاحيات المدير العام

**الدور:** CEO (المدير العام)  
**المتوقع:** صلاحيات كاملة على جميع الأنظمة

#### الاختبار عبر API:

```bash
# 1. جلب صلاحيات المدير العام (افترض user_id = 1)
curl -X GET http://localhost:3000/api/permissions/my-permissions \
  -H "x-user-id: 1"

# النتيجة المتوقعة:
{
  "success": true,
  "user_role": "CEO",
  "permissions": {
    "HR": {
      "can_view": true,
      "can_create": true,
      "can_edit": true,
      "can_delete": true,
      "can_approve": true
    },
    "FINANCE": { /* نفس الصلاحيات الكاملة */ },
    "PROCUREMENT": { /* نفس الصلاحيات الكاملة */ },
    // ... باقي الأنظمة
  }
}

# 2. التحقق من صلاحية محددة
curl -X POST http://localhost:3000/api/permissions/check \
  -H "Content-Type: application/json" \
  -H "x-user-id: 1" \
  -d '{
    "system_code": "FINANCE",
    "action": "delete"
  }'

# النتيجة المتوقعة:
{
  "success": true,
  "has_permission": true,
  "permission_level": "FULL"
}

# 3. التحقق من حد الموافقة المالية
curl -X POST http://localhost:3000/api/permissions/check-approval \
  -H "Content-Type: application/json" \
  -H "x-user-id: 1" \
  -d '{ "amount": 1000000 }'

# النتيجة المتوقعة:
{
  "success": true,
  "can_approve": true,
  "user_limit": "unlimited",
  "amount": 1000000
}
```

#### الاختبار من React:

```javascript
// في أي component
import { usePermissions } from './frontend-permissions-hook';

function TestCEOPermissions() {
    const { permissions, checkPermission, canApprove } = usePermissions();

    useEffect(() => {
        // اختبار 1: هل لديه صلاحية الحذف في الحسابات؟
        console.log('Can delete in Finance:', checkPermission('FINANCE', 'delete'));
        // متوقع: true

        // اختبار 2: هل يمكنه الموافقة على مليون ريال؟
        canApprove(1000000).then(result => {
            console.log('Can approve 1M:', result);
            // متوقع: true
        });
    }, [permissions]);

    return <div>Check console for results</div>;
}
```

---

### السيناريو 2: اختبار صلاحيات موظف المبيعات

**الدور:** SALES_EMPLOYEE (موظف مبيعات)  
**المتوقع:** صلاحيات محدودة فقط على نظام المبيعات

#### الاختبار عبر API:

```bash
# 1. جلب الأنظمة المتاحة (افترض user_id = 15)
curl -X GET http://localhost:3000/api/permissions/available-systems \
  -H "x-user-id: 15"

# النتيجة المتوقعة:
{
  "success": true,
  "systems": [
    {
      "code": "SALES",
      "name_ar": "المبيعات",
      "permission_level": "LIMITED",
      "can_view": true,
      "can_create": true,
      "can_edit": false,
      "can_delete": false,
      "can_approve": false
    }
  ]
}

# 2. محاولة الوصول لنظام الحسابات (يجب أن يفشل)
curl -X POST http://localhost:3000/api/permissions/check \
  -H "Content-Type: application/json" \
  -H "x-user-id: 15" \
  -d '{
    "system_code": "FINANCE",
    "action": "view"
  }'

# النتيجة المتوقعة:
{
  "success": true,
  "has_permission": false,
  "permission_level": "NONE"
}
```

#### الاختبار من React:

```javascript
function TestSalesEmployeePermissions() {
    const { permissions, getAvailableSystems } = usePermissions();

    useEffect(() => {
        // اختبار 1: ما الأنظمة المتاحة؟
        getAvailableSystems().then(systems => {
            console.log('Available systems:', systems);
            // متوقع: فقط SALES
        });

        // اختبار 2: هل يمكنه عرض الحسابات؟
        if (permissions) {
            console.log('Can view Finance:', permissions.FINANCE?.can_view);
            // متوقع: false أو undefined
        }
    }, [permissions]);

    return <div>Check console</div>;
}
```

---

### السيناريو 3: اختبار صلاحيات مدير المالية

**الدور:** FINANCE_MANAGER (مدير المالية)  
**المتوقع:** صلاحيات تنفيذية على الحسابات، محدودة على باقي الأنظمة

#### الاختبار عبر API:

```bash
# جلب معلومات الدور (افترض user_id = 8)
curl -X GET http://localhost:3000/api/permissions/my-role \
  -H "x-user-id: 8"

# النتيجة المتوقعة:
{
  "success": true,
  "role": {
    "code": "FINANCE_MANAGER",
    "title_ar": "مدير المالية",
    "hierarchy_level": 2,
    "hierarchy_name": "الإدارة العليا",
    "approval_limit": {
      "min": 0,
      "max": 100000,
      "is_unlimited": false
    }
  }
}

# التحقق من حد الموافقة
curl -X POST http://localhost:3000/api/permissions/check-approval \
  -H "Content-Type: application/json" \
  -H "x-user-id: 8" \
  -d '{ "amount": 150000 }'

# النتيجة المتوقعة:
{
  "success": true,
  "can_approve": false,
  "user_limit": "100000",
  "amount": 150000,
  "message": "المبلغ يتجاوز حد الموافقة الخاص بك"
}
```

---

## 🎨 اختبار الواجهة الأمامية

### 1. اختبار القائمة الجانبية

```javascript
// المكون: Sidebar
// الاختبار: هل تظهر فقط الأنظمة المتاحة؟

import { render, screen, waitFor } from '@testing-library/react';
import { Sidebar } from './frontend-examples';

test('يعرض فقط الأنظمة المتاحة', async () => {
    render(<Sidebar />);
    
    await waitFor(() => {
        // بالنسبة لموظف مبيعات، يجب أن يظهر فقط المبيعات
        expect(screen.getByText('المبيعات')).toBeInTheDocument();
        expect(screen.queryByText('الحسابات')).not.toBeInTheDocument();
    });
});
```

### 2. اختبار أزرار الإجراءات

```javascript
// المكون: FinanceTable
// الاختبار: هل تظهر أزرار التعديل/الحذف حسب الصلاحية؟

test('يخفي أزرار التعديل للمستخدمين بدون صلاحية', async () => {
    // mock المستخدم بدون صلاحية التعديل
    render(<FinanceTable />);
    
    await waitFor(() => {
        const editButtons = screen.queryAllByText('تعديل');
        expect(editButtons).toHaveLength(0);
    });
});
```

### 3. اختبار نموذج الموافقة

```javascript
// المكون: ApprovalForm
// الاختبار: هل يتحقق من حد الموافقة بشكل صحيح؟

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ApprovalForm } from './frontend-examples';

test('يتحقق من حد الموافقة المالية', async () => {
    render(<ApprovalForm />);
    
    const input = screen.getByPlaceholderText('أدخل المبلغ');
    fireEvent.change(input, { target: { value: '50000' } });
    
    await waitFor(() => {
        // إذا كان المستخدم له حد 100,000، يجب أن تظهر رسالة النجاح
        expect(screen.getByText(/لديك صلاحية الموافقة/)).toBeInTheDocument();
    });
});
```

---

## 📊 جدول اختبار شامل

| الدور | النظام | عرض | إنشاء | تعديل | حذف | موافقة | حد الموافقة |
|-------|--------|-----|-------|-------|------|---------|--------------|
| CEO | الكل | ✅ | ✅ | ✅ | ✅ | ✅ | غير محدود |
| CFO | FINANCE | ✅ | ✅ | ✅ | ✅ | ✅ | 500,000 |
| CFO | HR | ✅ | ❌ | ❌ | ❌ | ✅ | - |
| FINANCE_MANAGER | FINANCE | ✅ | ✅ | ✅ | ✅ | ✅ | 100,000 |
| SALES_EMPLOYEE | SALES | ✅ | ✅ | ❌ | ❌ | ❌ | 10,000 |
| SALES_EMPLOYEE | FINANCE | ❌ | ❌ | ❌ | ❌ | ❌ | - |
| ACCOUNTANT | FINANCE | ✅ | ✅ | ✅ | ❌ | ❌ | 5,000 |

---

## 🔍 اختبارات Postman

### Collection Setup

1. إنشاء Environment جديد:
```json
{
  "base_url": "http://localhost:3000",
  "user_id_ceo": "1",
  "user_id_finance_manager": "8",
  "user_id_sales_employee": "15"
}
```

2. إنشاء Collection بالـ Requests التالية:

#### Request 1: Get CEO Permissions
```
GET {{base_url}}/api/permissions/my-permissions
Headers:
  x-user-id: {{user_id_ceo}}

Test Script:
pm.test("Status is 200", () => {
    pm.response.to.have.status(200);
});

pm.test("Has FINANCE permissions", () => {
    const json = pm.response.json();
    pm.expect(json.permissions.FINANCE).to.exist;
});
```

#### Request 2: Check Finance Manager Approval Limit
```
POST {{base_url}}/api/permissions/check-approval
Headers:
  x-user-id: {{user_id_finance_manager}}
  Content-Type: application/json

Body:
{
  "amount": 150000
}

Test Script:
pm.test("Cannot approve above limit", () => {
    const json = pm.response.json();
    pm.expect(json.can_approve).to.be.false;
});
```

---

## 🐛 استكشاف الأخطاء

### مشكلة: API تُرجع permissions فارغة

**الحل:**
1. تأكد من أن `user_id` موجود في الـ request
2. تأكد من أن المستخدم له دور في جدول `user_roles`
3. تحقق من وجود صلاحيات للدور في `role_permissions`

```sql
-- التحقق من دور المستخدم
SELECT * FROM user_roles WHERE user_id = 1;

-- التحقق من صلاحيات الدور
SELECT * FROM role_permissions WHERE role_code = 'CEO';
```

### مشكلة: PermissionGuard لا يُخفي/يُظهر العناصر

**الحل:**
1. تأكد من أن `usePermissions()` يُستخدم في parent component
2. تحقق من أن system_code صحيح (مثل: "FINANCE" وليس "Finance")
3. تأكد من أن الـ loading state تم التعامل معه

```javascript
// Debug
const { permissions, loading } = usePermissions();
console.log('Permissions:', permissions);
console.log('Loading:', loading);
```

---

## ✅ Checklist النشر

قبل النشر للإنتاج، تأكد من:

- [ ] جميع الـ API endpoints تعمل بشكل صحيح
- [ ] نظام المصادقة (Authentication) مُطبق
- [ ] الـ permissions تُجلب من قاعدة البيانات وليس hardcoded
- [ ] Error handling مناسب في جميع الـ components
- [ ] Loading states معروضة للمستخدم
- [ ] الصلاحيات تُتحقق على الـ backend أيضاً (لا تعتمد فقط على Frontend)
- [ ] تم اختبار جميع السيناريوهات في الجدول أعلاه
- [ ] الـ tokens/sessions آمنة ولا تُسرب معلومات حساسة

---

## 📞 الدعم

إذا واجهت أي مشكلة:

1. تحقق من console.log في المتصفح
2. تحقق من network tab في Developer Tools
3. راجع logs السيرفر
4. تأكد من اتصال قاعدة البيانات

---

## 📝 ملاحظات إضافية

### أمان الصلاحيات

**مهم جداً:** الصلاحيات على الواجهة الأمامية هي فقط لتحسين تجربة المستخدم (UX).  
يجب **دائماً** التحقق من الصلاحيات على الـ Backend قبل تنفيذ أي عملية.

```javascript
// ❌ خطأ - الاعتماد فقط على Frontend
if (checkPermission('FINANCE', 'delete')) {
    deleteEntry(); // مباشرة بدون تحقق من Backend
}

// ✅ صحيح - التحقق من Backend
if (checkPermission('FINANCE', 'delete')) {
    // API call الذي سيتحقق من الصلاحية مرة أخرى في Backend
    fetch('/api/finance/delete', {
        method: 'DELETE',
        // ... Backend سيتحقق من الصلاحية مرة أخرى
    });
}
```

### Performance Optimization

- استخدم caching للصلاحيات (تُجلب مرة واحدة عند تسجيل الدخول)
- استخدم React Context لمشاركة الصلاحيات بين Components
- لا تُكرر API calls للصلاحيات في كل component

---

**تم إنشاء هذا الدليل لنظام الصلاحيات - 33 دور وظيفي عبر 8 أنظمة تشغيلية**
