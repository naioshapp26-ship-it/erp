# نظام نايوش ERP - توثيق API

## Base URL
```
http://localhost:3000/api
```

## Endpoints

### 1. Health Check
```http
GET /health
```

**الاستجابة:**
```json
{
  "status": "OK",
  "database": "Connected",
  "time": "2024-01-07T12:00:00.000Z"
}
```

---

### 2. Entities (الكيانات)

#### الحصول على جميع الكيانات
```http
GET /entities
```

**الاستجابة:**
```json
[
  {
    "id": "HQ001",
    "name": "المكتب الرئيسي",
    "type": "HQ",
    "status": "Active",
    "balance": "2500000.00",
    "location": "الرياض",
    "users_count": 15,
    "plan": "ENTERPRISE",
    "expiry_date": "2030-12-31",
    "theme": "BLUE"
  }
]
```

#### الحصول على كيان محدد
```http
GET /entities/:id
```

---

### 3. Users (المستخدمون)

#### الحصول على جميع المستخدمين
```http
GET /users
```

**Query Parameters:**
- `entity_id` (اختياري) - تصفية حسب الكيان

**مثال:**
```http
GET /users?entity_id=BR015
```

**الاستجابة:**
```json
[
  {
    "id": 1,
    "name": "م. أحمد العلي",
    "email": "ahmed@nayosh.com",
    "role": "مسؤول النظام",
    "tenant_type": "HQ",
    "entity_id": "HQ001",
    "entity_name": "المكتب الرئيسي",
    "is_active": true
  }
]
```

#### الحصول على مستخدم محدد
```http
GET /users/:id
```

---

### 4. Invoices (الفواتير)

#### الحصول على جميع الفواتير
```http
GET /invoices
```

**Query Parameters:**
- `entity_id` (اختياري) - تصفية حسب الكيان
- `status` (اختياري) - تصفية حسب الحالة (PAID, PARTIAL, UNPAID, OVERDUE)

**مثال:**
```http
GET /invoices?entity_id=BR015&status=UNPAID
```

**الاستجابة:**
```json
[
  {
    "id": "INV-1001",
    "entity_id": "BR015",
    "type": "SUBSCRIPTION",
    "title": "اشتراك باقة المحترفين - أكتوبر",
    "amount": "2499.00",
    "paid_amount": "2499.00",
    "status": "PAID",
    "issue_date": "2023-10-01",
    "due_date": "2023-10-07"
  }
]
```

---

### 5. Transactions (المعاملات)

#### الحصول على جميع المعاملات
```http
GET /transactions
```

**Query Parameters:**
- `entity_id` (اختياري) - تصفية حسب الكيان

**الاستجابة:**
```json
[
  {
    "id": "TRX-501",
    "invoice_id": "INV-1001",
    "entity_id": "BR015",
    "type": "PAYMENT",
    "amount": "2499.00",
    "payment_method": "Bank Transfer",
    "transaction_date": "2023-10-05",
    "reference_code": "REF123",
    "user_name": "سارة محمد"
  }
]
```

---

### 6. Ledger (دفتر الأستاذ)

#### الحصول على سجلات دفتر الأستاذ
```http
GET /ledger
```

**Query Parameters:**
- `entity_id` (اختياري) - تصفية حسب الكيان

**الاستجابة:**
```json
[
  {
    "id": 1,
    "entity_id": "BR015",
    "transaction_id": "TRX-501",
    "transaction_date": "2023-10-05",
    "description": "سداد فاتورة INV-1001",
    "debit": "0.00",
    "credit": "2499.00",
    "balance": "2499.00",
    "type": "Credit"
  }
]
```

---

### 7. Ads (الإعلانات)

#### الحصول على جميع الإعلانات
```http
GET /ads
```

**Query Parameters:**
- `entity_id` (اختياري) - تصفية حسب الكيان
- `status` (اختياري) - تصفية حسب الحالة (PENDING, ACTIVE, PAUSED, COMPLETED, REJECTED)
- `level` (اختياري) - تصفية حسب المستوى (L1_LOCAL, L2_MULTI, L3_INC_INT, L4_PLT_INT, L5_CROSS_INC)

**الاستجابة:**
```json
[
  {
    "id": 1,
    "title": "تحديث سياسات SaaS 2024",
    "content": "نلفت انتباه جميع المستأجرين لتحديث السياسات.",
    "level": "L5_CROSS_INC",
    "scope": "GLOBAL",
    "status": "ACTIVE",
    "source_entity_id": "HQ001",
    "source_type": "HQ",
    "target_ids": [],
    "cost": "0.00",
    "budget": "0.00",
    "spent": "0.00",
    "impressions": 12050,
    "clicks": 450,
    "start_date": "2023-11-20",
    "end_date": "2023-12-31"
  }
]
```

#### إنشاء إعلان جديد
```http
POST /ads
Content-Type: application/json
```

**Body:**
```json
{
  "title": "عنوان الإعلان",
  "content": "محتوى الإعلان",
  "level": "L1_LOCAL",
  "scope": "LOCAL",
  "status": "PENDING",
  "source_entity_id": "BR015",
  "source_type": "BRANCH",
  "target_ids": ["BR015"],
  "cost": 0,
  "budget": 1000,
  "start_date": "2024-01-01",
  "end_date": "2024-01-31"
}
```

#### تحديث إعلان
```http
PUT /ads/:id
Content-Type: application/json
```

**Body:**
```json
{
  "status": "ACTIVE",
  "impressions": 150,
  "clicks": 25
}
```

---

### 8. Stats (الإحصائيات)

#### الحصول على إحصائيات النظام
```http
GET /stats
```

**Query Parameters:**
- `entity_id` (اختياري) - إحصائيات كيان محدد

**الاستجابة:**
```json
{
  "totalEntities": 7,
  "totalUsers": 10,
  "totalRevenue": 5998.00,
  "activeAds": 5,
  "outstandingAmount": 1999.00
}
```

---

## أنواع البيانات

### Entity Types
- `HQ` - المكتب الرئيسي
- `BRANCH` - فرع تجزئة
- `INCUBATOR` - حاضنة أعمال
- `PLATFORM` - منصة رقمية
- `OFFICE` - مكتب إداري

### Subscription Plans
- `BASIC` - أساسي
- `PRO` - احترافي
- `ENTERPRISE` - مؤسسات

### Invoice Status
- `PAID` - مدفوعة
- `PARTIAL` - دفع جزئي
- `UNPAID` - غير مدفوعة
- `OVERDUE` - متأخرة

### Ad Levels
- `L1_LOCAL` - محلي (Tenant Only)
- `L2_MULTI` - متعدد الفروع
- `L3_INC_INT` - داخل الحاضنة
- `L4_PLT_INT` - داخل المنصة
- `L5_CROSS_INC` - شبكة SaaS العالمية

---

## معالجة الأخطاء

جميع الـ endpoints تُرجع أكواد HTTP المناسبة:

- `200 OK` - نجح الطلب
- `201 Created` - تم إنشاء المورد بنجاح
- `404 Not Found` - المورد غير موجود
- `500 Internal Server Error` - خطأ في السيرفر

**مثال على رسالة خطأ:**
```json
{
  "error": "Entity not found"
}
```
