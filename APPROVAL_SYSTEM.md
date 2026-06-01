# 📋 نظام الموافقات المالية التدريجي

## نظرة عامة

نظام موافقات مالية احترافي بثلاث مستويات (محاسب → مدير مالي → CFO) مع تنبيهات تلقائية وإمكانية الرفض مع ذكر السبب.

---

## 🔄 مسار الموافقة (Approval Workflow)

### المستويات الثلاثة:

```
المستوى 1: محاسب (Accountant)
    ↓
المستوى 2: مدير مالي (Finance Manager)
    ↓
المستوى 3: CFO / الإدارة العليا
```

### القواعد:

1. **تدريجي وتسلسلي**: يجب الموافقة من المستوى الحالي قبل الانتقال للتالي
2. **الرفض يوقف السير**: إذا رفض أي مستوى، ينتهي طلب الموافقة بالكامل
3. **إلزامية سبب الرفض**: يجب كتابة سبب واضح عند الرفض
4. **تعليقات اختيارية**: يمكن إضافة تعليق عند الموافقة (اختياري)

---

## 📊 قاعدة البيانات

### الجداول الجديدة:

#### 1. approval_workflows
```sql
- id (PK)
- entity_id (FK → entities)
- item_type (INVOICE, TRANSACTION, PAYMENT)
- item_id
- item_title
- amount
- current_level (المستوى الحالي)
- status (PENDING, IN_REVIEW, APPROVED, REJECTED)
- created_by (FK → users)
- created_by_name
- created_at
- updated_at
```

#### 2. approval_steps
```sql
- id (PK)
- workflow_id (FK → approval_workflows)
- step_level (1, 2, 3)
- approver_role (ACCOUNTANT, FINANCE_MANAGER, CFO)
- approver_id (FK → users)
- approver_name
- status (PENDING, APPROVED, REJECTED, SKIPPED)
- decision_date
- comments
- rejection_reason
- created_at
```

#### 3. notifications
```sql
- id (PK)
- user_id (FK → users)
- entity_id (FK → entities)
- type (APPROVAL_REQUEST, APPROVAL_APPROVED, APPROVAL_REJECTED, SYSTEM)
- title
- message
- link_type (WORKFLOW, INVOICE, TRANSACTION)
- link_id
- is_read (boolean)
- priority (LOW, NORMAL, HIGH, URGENT)
- created_at
```

---

## 🔌 API Endpoints

### الموافقات

#### الحصول على جميع الموافقات
```http
GET /api/approvals
Query Parameters:
  - entity_id (optional)
  - status (optional): PENDING, IN_REVIEW, APPROVED, REJECTED
  - approver_id (optional): لعرض الموافقات المعلقة على مستخدم معين
```

**مثال:**
```bash
GET /api/approvals?status=PENDING&approver_id=6
```

#### الحصول على موافقة محددة
```http
GET /api/approvals/:id
```

**الاستجابة:**
```json
{
  "id": 1,
  "entity_id": "BR015",
  "item_type": "INVOICE",
  "item_title": "فاتورة خدمات تقنية - ديسمبر",
  "amount": "15000.00",
  "current_level": 2,
  "status": "IN_REVIEW",
  "steps": [
    {
      "step_level": 1,
      "approver_role": "ACCOUNTANT",
      "status": "APPROVED",
      "comments": "تمت المراجعة - البيانات صحيحة"
    },
    {
      "step_level": 2,
      "approver_role": "FINANCE_MANAGER",
      "status": "PENDING"
    }
  ]
}
```

#### إنشاء طلب موافقة جديد
```http
POST /api/approvals
Content-Type: application/json
```

**Body:**
```json
{
  "entity_id": "BR015",
  "item_type": "INVOICE",
  "item_id": "INV-1006",
  "item_title": "فاتورة مشتريات - يناير",
  "amount": 25000,
  "created_by": 2,
  "created_by_name": "سارة محمد",
  "approval_levels": [
    {
      "role": "ACCOUNTANT",
      "approver_id": 6,
      "approver_name": "أ. منى المالية"
    },
    {
      "role": "FINANCE_MANAGER",
      "approver_id": 6,
      "approver_name": "أ. منى المالية"
    },
    {
      "role": "CFO",
      "approver_id": 1,
      "approver_name": "م. أحمد العلي"
    }
  ]
}
```

#### اتخاذ قرار (موافقة أو رفض)
```http
POST /api/approvals/:id/decide
Content-Type: application/json
```

**Body (للموافقة):**
```json
{
  "step_id": 2,
  "decision": "APPROVED",
  "comments": "تمت الموافقة - جميع المستندات سليمة",
  "approver_id": 6
}
```

**Body (للرفض):**
```json
{
  "step_id": 2,
  "decision": "REJECTED",
  "rejection_reason": "البيانات غير مكتملة - يرجى إضافة المستندات الداعمة",
  "approver_id": 6
}
```

---

### التنبيهات

#### الحصول على التنبيهات
```http
GET /api/notifications
Query Parameters:
  - user_id (optional)
  - is_read (optional): true/false
```

**مثال:**
```bash
GET /api/notifications?user_id=6&is_read=false
```

**الاستجابة:**
```json
[
  {
    "id": 1,
    "user_id": 6,
    "type": "APPROVAL_REQUEST",
    "title": "طلب موافقة على فاتورة جديدة",
    "message": "يرجى مراجعة واعتماد فاتورة خدمات تقنية - ديسمبر بقيمة 15,000 ريال",
    "link_type": "WORKFLOW",
    "link_id": "1",
    "is_read": false,
    "priority": "HIGH",
    "created_at": "2024-01-07T..."
  }
]
```

#### تعليم تنبيه كمقروء
```http
PUT /api/notifications/:id/read
```

#### تعليم جميع التنبيهات كمقروءة
```http
PUT /api/notifications/read-all
Content-Type: application/json
```

**Body:**
```json
{
  "user_id": 6
}
```

#### عدد التنبيهات غير المقروءة
```http
GET /api/notifications/unread-count?user_id=6
```

**الاستجابة:**
```json
{
  "count": 3
}
```

---

## 🎨 الواجهة الأمامية

### 1. صفحة الموافقات (`/approvals`)

#### التبويبات الثلاثة:

1. **المعلقة عليك**: الموافقات التي تحتاج قرارك
2. **طلباتي**: الموافقات التي أنشأتها
3. **جميع الموافقات**: كل الموافقات التي لك علاقة بها

#### الميزات:

- ✅ مسار الموافقة المرئي (Visual Progress)
- ✅ أزرار الموافقة/الرفض المباشرة
- ✅ عرض التعليقات وأسباب الرفض
- ✅ Badge للموافقات المعلقة في القائمة الجانبية
- ✅ حالة كل خطوة (منتظر، موافق، مرفوض)

### 2. أيقونة التنبيهات

- **الموقع**: أعلى يمين الصفحة (Header)
- **العداد**: يظهر عدد التنبيهات غير المقروءة
- **الحركة**: animate-pulse على الأرقام الجديدة
- **الألوان**: أحمر للتنبيهات العاجلة

---

## 🔔 نظام التنبيهات التلقائية

### السيناريوهات:

#### 1. طلب موافقة جديد
- **المرسل إليه**: المستوى الأول (محاسب)
- **النوع**: `APPROVAL_REQUEST`
- **الأولوية**: `HIGH`

#### 2. الموافقة من مستوى
- **المرسل إليه**: المستوى التالي
- **النوع**: `APPROVAL_REQUEST`
- **الأولوية**: `HIGH`

#### 3. الموافقة النهائية
- **المرسل إليه**: منشئ الطلب
- **النوع**: `APPROVAL_APPROVED`
- **الأولوية**: `NORMAL`

#### 4. الرفض
- **المرسل إليه**: منشئ الطلب
- **النوع**: `APPROVAL_REJECTED`
- **الأولوية**: `HIGH`
- **محتوى إضافي**: سبب الرفض

---

## 📝 أمثلة الاستخدام

### مثال 1: إنشاء طلب موافقة على فاتورة

```javascript
// Frontend
const approval = await fetchAPI('/approvals', {
  method: 'POST',
  body: JSON.stringify({
    entity_id: currentUser.entityId,
    item_type: 'INVOICE',
    item_id: 'INV-1007',
    item_title: 'فاتورة إيجار - يناير 2024',
    amount: 35000,
    created_by: currentUser.id,
    created_by_name: currentUser.name,
    approval_levels: [
      { role: 'ACCOUNTANT', approver_id: 6, approver_name: 'أ. منى المالية' },
      { role: 'FINANCE_MANAGER', approver_id: 6, approver_name: 'أ. منى المالية' },
      { role: 'CFO', approver_id: 1, approver_name: 'م. أحمد العلي' }
    ]
  })
});
```

### مثال 2: الموافقة على طلب

```javascript
// عند الضغط على زر "اعتماد"
await fetchAPI(`/approvals/${workflowId}/decide`, {
  method: 'POST',
  body: JSON.stringify({
    step_id: stepId,
    decision: 'APPROVED',
    comments: 'جميع المستندات صحيحة',
    approver_id: currentUser.id
  })
});
```

### مثال 3: رفض طلب مع السبب

```javascript
// عند الضغط على زر "رفض"
const reason = prompt('يرجى إدخال سبب الرفض:');

await fetchAPI(`/approvals/${workflowId}/decide`, {
  method: 'POST',
  body: JSON.stringify({
    step_id: stepId,
    decision: 'REJECTED',
    rejection_reason: reason,
    approver_id: currentUser.id
  })
});
```

---

## 🔒 الصلاحيات

- **عرض الموافقات**: `perms.isFinance()` (المسؤولون الماليون فقط)
- **اتخاذ القرارات**: فقط المعتمدين المحددين في كل خطوة
- **إنشاء طلبات**: أي مستخدم حسب صلاحياته

---

## ✅ البيانات التجريبية

تم إضافة بيانات تجريبية للاختبار:

1. **Workflow 1**: فاتورة خدمات تقنية (15,000 ريال)
   - المستوى 1: موافق
   - المستوى 2: معلق

2. **Workflow 2**: دفعة شراء معدات (50,000 ريال)
   - المستوى 1: موافق
   - المستوى 2: موافق
   - المستوى 3: معلق

3. **3 تنبيهات** موزعة على المستخدمين

---

## 🧪 الاختبار

### اختبار قاعدة البيانات:
```bash
node add-approval-system.js
```

### اختبار API:
```bash
node test-approvals.js
```

### اختبار الواجهة:
1. افتح: `http://localhost:3000`
2. انتقل إلى "الموافقات المالية"
3. بدّل بين المستخدمين لاختبار المستويات المختلفة

---

## 🚀 التشغيل

```bash
# تطبيق نظام الموافقات على قاعدة البيانات
node add-approval-system.js

# تشغيل السيرفر
npm start

# الوصول للنظام
http://localhost:3000
```

---

تم التطوير بواسطة GitHub Copilot
التاريخ: 7 يناير 2026
