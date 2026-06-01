# 📖 دليل استخدام نظام سجل المراجعات
## Audit Log System Usage Guide

---

## 🎯 المقدمة

نظام سجل المراجعات هو نظام شامل لتتبع جميع العمليات في النظام بهدف:
- توفير تتبع كامل لجميع التغييرات
- توفير معلومات شاملة عن من قام بماذا ومتى وسبب التغيير
- توفير سلسلة موافقات كاملة
- توفير تقارير تفصيلية للإدارة

---

## 📊 بنية البيانات

### جدول `audit_log` - السجل الرئيسي

يحتوي على 22 عمود:

```sql
-- معلومات الكيان (Entity Information)
entity_type          -- نوع الكيان (INVOICE, PAYMENT, CLIENT, etc)
entity_id            -- معرف الكيان
entity_reference_id  -- معرف المرجع (رقم الفاتورة)
entity_reference_name-- اسم المرجع (اسم الفاتورة)

-- معلومات المستخدم (User Information)
user_id              -- معرف المستخدم
user_name            -- اسم المستخدم
user_role            -- دور المستخدم

-- معلومات التوقيت (Timing Information)
action_timestamp     -- التاريخ والوقت الكاملة
action_date          -- التاريخ فقط

-- معلومات العملية (Action Information)
action_type          -- نوع العملية (CREATE, UPDATE, DELETE, PAYMENT, etc)
field_changed        -- الحقل الذي تغير
old_value            -- القيمة القديمة
new_value            -- القيمة الجديدة

-- معلومات السبب (Reason Information)
reason               -- السبب التفصيلي
reason_category      -- تصنيف السبب

-- معلومات الموافقة (Approval Information)
requires_approval    -- هل تحتاج موافقة
approval_status      -- حالة الموافقة
approved_by_user_id  -- معرف الموافق
approved_by_name     -- اسم الموافق
approval_timestamp   -- وقت الموافقة
approval_reason      -- سبب الموافقة/الرفض

-- معلومات مالية (Financial Information)
financial_impact     -- هل هناك تأثير مالي
amount_affected      -- المبلغ المتأثر
currency             -- العملة

-- معلومات تقنية (Technical Information)
ip_address           -- عنوان IP
session_id           -- معرف الجلسة
source_system        -- النظام المصدر
description          -- وصف العملية
error_message        -- رسالة الخطأ (إن وجدت)
success              -- هل نجحت العملية
```

---

## 🔍 أمثلة على الاستعلامات

### 1. الحصول على سجل فاتورة معينة

```sql
SELECT 
    id,
    user_name,
    action_timestamp,
    action_type,
    field_changed,
    old_value,
    new_value,
    reason,
    approval_status
FROM audit_log 
WHERE entity_reference_id = 'INV-2026-001'
ORDER BY action_timestamp DESC;
```

**النتيجة:** جميع العمليات المسجلة على فاتورة معينة مع التفاصيل الكاملة.

---

### 2. تقرير جميع الخصومات المطبقة

```sql
SELECT 
    id,
    user_name,
    action_timestamp,
    entity_reference_name,
    old_value as "القيمة_القديمة",
    new_value as "القيمة_الجديدة",
    reason as "سبب_الخصم",
    approval_status
FROM audit_log
WHERE action_type = 'APPLY_DISCOUNT'
  AND reason_category = 'DISCOUNT_REASON'
ORDER BY action_timestamp DESC;
```

**النتيجة:** قائمة بجميع الخصومات المطبقة مع الأسباب والموافقات.

---

### 3. تقرير الرفضات

```sql
SELECT 
    id,
    user_name,
    action_timestamp,
    entity_reference_name,
    reason as "سبب_الرفض",
    approved_by_name,
    approval_reason
FROM audit_log
WHERE reason_category = 'REJECTION_REASON'
  AND approval_status = 'REJECTED'
ORDER BY action_timestamp DESC;
```

**النتيجة:** قائمة بجميع الفواتير أو العمليات المرفوضة مع الأسباب.

---

### 4. تقرير العمليات المالية

```sql
SELECT * FROM audit_log_financial
WHERE action_date = CURRENT_DATE
ORDER BY amount_affected DESC;
```

**النتيجة:** جميع العمليات المالية لليوم الحالي مع الترتيب حسب المبلغ.

---

### 5. سلسلة الموافقات لفاتورة معينة

```sql
SELECT * FROM audit_log_approvals_chain
WHERE entity_reference_id = 'INV-2026-002'
ORDER BY approval_level, approval_timestamp;
```

**النتيجة:** سلسلة الموافقات الكاملة مع مستويات المراجعة.

---

### 6. نشاط مستخدم معين

```sql
SELECT 
    activity_date,
    user_name,
    user_role,
    action_count,
    entity_types_touched,
    successful_actions
FROM audit_user_activity
WHERE user_name = 'سارة محمد'
  AND activity_date = CURRENT_DATE;
```

**النتيجة:** ملخص نشاط المستخدم لليوم.

---

### 7. ملخص العمليات حسب النوع

```sql
SELECT 
    entity_type,
    action_type,
    COUNT(*) as عدد_العمليات,
    COUNT(CASE WHEN success THEN 1 END) as العمليات_الناجحة,
    COUNT(CASE WHEN success = FALSE THEN 1 END) as العمليات_الفاشلة
FROM audit_log
WHERE action_date = CURRENT_DATE
GROUP BY entity_type, action_type
ORDER BY عدد_العمليات DESC;
```

**النتيجة:** إحصائيات العمليات حسب النوع والحالة.

---

### 8. العمليات المعلقة الموافقة

```sql
SELECT 
    id,
    user_name,
    action_timestamp,
    entity_reference_name,
    action_type,
    reason
FROM audit_log
WHERE approval_status = 'PENDING'
  AND requires_approval = TRUE
ORDER BY action_timestamp ASC;
```

**النتيجة:** قائمة بالعمليات المعلقة بانتظار الموافقة.

---

### 9. التغييرات على فاتورة معينة

```sql
SELECT 
    field_changed,
    old_value,
    new_value,
    user_name,
    action_timestamp,
    reason
FROM audit_log
WHERE entity_reference_id = 'INV-2026-001'
  AND field_changed IS NOT NULL
ORDER BY action_timestamp;
```

**النتيجة:** جميع التغييرات التي تمت على فاتورة مع التفاصيل.

---

### 10. تقرير الأخطاء

```sql
SELECT 
    id,
    user_name,
    action_timestamp,
    entity_reference_name,
    action_type,
    error_message
FROM audit_log
WHERE success = FALSE
  AND error_message IS NOT NULL
ORDER BY action_timestamp DESC;
```

**النتيجة:** قائمة بالعمليات التي فشلت مع رسائل الأخطاء.

---

## 📈 التقارير الموصى بها

### 1. تقرير يومي للعمليات

```sql
SELECT * FROM audit_daily_summary
WHERE activity_date = CURRENT_DATE;
```

---

### 2. تقرير شامل للمراجعات

```sql
SELECT * FROM audit_log_summary
WHERE action_date = CURRENT_DATE
ORDER BY action_timestamp DESC;
```

---

### 3. تقرير التأثير المالي

```sql
SELECT * FROM audit_log_financial
WHERE action_date = CURRENT_DATE
ORDER BY amount_affected DESC;
```

---

## 🔐 معايير الأمان والمراقبة

### 1. تتبع جميع التغييرات
- ✅ كل تغيير مسجل
- ✅ لا يمكن حذف السجلات
- ✅ كل سجل يحمل البصمة الكاملة

### 2. تسجيل المستخدم
- ✅ معرف المستخدم
- ✅ اسم المستخدم
- ✅ دور المستخدم
- ✅ عنوان IP
- ✅ معرف الجلسة

### 3. الموافقات
- ✅ تسجيل من وافق
- ✅ متى تمت الموافقة
- ✅ سبب الموافقة أو الرفض
- ✅ سلسلة الموافقات

### 4. الأسباب والتفاصيل
- ✅ السبب التفصيلي
- ✅ التصنيف
- ✅ الوصف الكامل
- ✅ رسائل الأخطاء

---

## 🎓 حالات الاستخدام

### حالة 1: فحص فاتورة معينة
```sql
-- ماذا حدث على هذه الفاتورة؟
SELECT * FROM audit_log 
WHERE entity_reference_id = 'INV-2026-001'
ORDER BY action_timestamp;
```

### حالة 2: معرفة من غيّر ماذا؟
```sql
-- من الذي طبق الخصم؟
SELECT * FROM audit_log 
WHERE action_type = 'APPLY_DISCOUNT'
  AND entity_reference_id = 'INV-2026-001';
```

### حالة 3: التحقق من الموافقات
```sql
-- هل تمت الموافقة على هذه العملية؟
SELECT * FROM audit_log_approvals_chain 
WHERE entity_reference_id = 'INV-2026-001'
ORDER BY approval_level;
```

### حالة 4: تقرير مراقبة المستخدم
```sql
-- ماذا فعل هذا المستخدم اليوم؟
SELECT * FROM audit_user_activity 
WHERE user_name = 'سارة محمد'
  AND activity_date = CURRENT_DATE;
```

### حالة 5: تقرير الأخطاء
```sql
-- ما هي الأخطاء التي حدثت؟
SELECT * FROM audit_log 
WHERE success = FALSE 
  AND action_date = CURRENT_DATE;
```

---

## 🚀 الخطوات التالية

### 1. دمج التسجيل التلقائي
يمكن إضافة `triggers` لتسجيل تلقائي عند:
- إنشاء فاتورة جديدة
- تعديل الفاتورة
- تطبيق دفعة
- تطبيق خصم
- الموافقة/الرفض

### 2. واجهة مستخدم
إنشاء لوحة عرض توضح:
- آخر العمليات
- العمليات المعلقة
- الأخطاء
- التقارير

### 3. التنبيهات
إرسال تنبيهات عند:
- عمليات معينة
- أخطاء
- عمليات معلقة
- تجاوز حد معين

### 4. التقارير المتقدمة
إنشاء تقارير:
- يومية
- أسبوعية
- شهرية
- سنوية

---

## 📞 الدعم والمساعدة

للاستفسارات والدعم:
- اطلع على توثيق النظام
- راجع أمثلة الاستعلامات
- تحقق من السجلات الحالية

---

**آخر تحديث:** 15 يناير 2026  
**الإصدار:** 1.0.0
