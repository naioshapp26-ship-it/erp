# نظام حاضنة السلامة - دليل شامل
## Safety Incubator Training Management System

تاريخ الإنشاء: 2024
النسخة: 1.0.0
المطور: نظام نايوش - NAIOSH ERP

---

## 📋 جدول المحتويات
1. [نظرة عامة](#نظرة-عامة)
2. [البنية التقنية](#البنية-التقنية)
3. [دورة العمل التدريبية](#دورة-العمل-التدريبية)
4. [جداول قاعدة البيانات](#جداول-قاعدة-البيانات)
5. [API Endpoints](#api-endpoints)
6. [واجهة المستخدم](#واجهة-المستخدم)
7. [نظام الشهادات](#نظام-الشهادات)
8. [أمثلة الاستخدام](#أمثلة-الاستخدام)

---

## 🎯 نظرة عامة

نظام حاضنة السلامة هو منظومة متكاملة لإدارة دورة حياة التدريب والتأهيل الكاملة، من التسجيل حتى الحصول على الشهادات والمتابعة والتجديد.

### المراحل الست للنظام
```
1. التسجيل (Registration)
   ↓
2. التدريب (Training)
   ↓
3. التقييم (Evaluation)
   ↓
4. الاعتماد (Certification)
   ↓
5. إصدار الشهادات (Certificates)
   ↓
6. المتابعة والتجديد (Follow-up & Renewal)
```

### الميزات الرئيسية
- ✅ إدارة البرامج التدريبية
- ✅ تسجيل المستفيدين
- ✅ تنظيم الدفعات التدريبية
- ✅ نظام تقييم شامل
- ✅ إصدار شهادات رسمية مع QR Code
- ✅ سجل تدريبي كامل لكل مستفيد
- ✅ نظام تجديد وتحديث الشهادات
- ✅ لوحة إحصائيات شاملة

---

## 🏗️ البنية التقنية

### التقنيات المستخدمة
- **Backend**: Node.js + Express.js
- **Database**: PostgreSQL
- **Frontend**: HTML5 + TailwindCSS + Vanilla JavaScript
- **QR Generation**: Built-in QR code system

### هيكل المشروع
```
/
├── server.js                    # Backend API Server
├── script.js                    # Frontend Logic
├── add-incubator-system.sql    # Database Schema
├── add-incubator-system.js     # Database Initializer
├── test-incubator.js           # Testing Suite
└── INCUBATOR_SYSTEM.md         # هذا الملف
```

---

## 🔄 دورة العمل التدريبية

### المرحلة 1: التسجيل (Registration)
1. إضافة معلومات المستفيد (الاسم، الهوية، التواصل، المؤهلات)
2. التحقق من الهوية الوطنية
3. إنشاء ملف شخصي للمستفيد
4. الحالة الابتدائية: `ACTIVE`

### المرحلة 2: التدريب (Training)
1. اختيار البرنامج التدريبي المناسب
2. التسجيل في دفعة تدريبية
3. متابعة الحضور والغياب
4. تحديث نسبة الحضور
5. الحالة: `REGISTERED` → `ATTENDING`

### المرحلة 3: التقييم (Evaluation)
1. إجراء الاختبارات (كتابي، عملي، شفهي، مشروع)
2. تسجيل الدرجات
3. حساب المعدل النهائي
4. التحقق من النجاح (70% كحد أدنى)
5. الحالة: `ATTENDING` → `COMPLETED` أو `FAILED`

### المرحلة 4 و 5: الاعتماد وإصدار الشهادات
1. التحقق من اكتمال جميع المتطلبات
2. إنشاء رقم اعتماد فريد
3. حساب مدة الصلاحية
4. إنشاء QR Code للتحقق
5. إصدار الشهادة
6. تحديث السجل التدريبي

### المرحلة 6: المتابعة والتجديد
1. تتبع تواريخ انتهاء الشهادات
2. إرسال تنبيهات قبل الانتهاء
3. إجراءات التجديد
4. ربط الشهادة الجديدة بالأصلية

---

## 📊 جداول قاعدة البيانات

### 1. training_programs (البرامج التدريبية)
```sql
CREATE TABLE training_programs (
    id SERIAL PRIMARY KEY,
    entity_id VARCHAR(20) REFERENCES entities(id),
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(100),              -- SAFETY, TECHNICAL, MANAGEMENT, ENTREPRENEURSHIP
    duration_hours INTEGER NOT NULL,
    max_participants INTEGER DEFAULT 30,
    price DECIMAL(10, 2) DEFAULT 0.00,
    passing_score INTEGER DEFAULT 70,
    certificate_validity_months INTEGER DEFAULT 12,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**الأعمدة المهمة:**
- `code`: رمز البرنامج (مثل: SAF-101)
- `category`: تصنيف البرنامج
- `passing_score`: النسبة المطلوبة للنجاح
- `certificate_validity_months`: مدة صلاحية الشهادة

### 2. beneficiaries (المستفيدون)
```sql
CREATE TABLE beneficiaries (
    id SERIAL PRIMARY KEY,
    entity_id VARCHAR(20) REFERENCES entities(id),
    national_id VARCHAR(20) UNIQUE NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(20),
    date_of_birth DATE,
    gender VARCHAR(10),                 -- MALE, FEMALE
    education_level VARCHAR(50),
    occupation VARCHAR(100),
    status VARCHAR(20) DEFAULT 'ACTIVE', -- ACTIVE, SUSPENDED, GRADUATED
    registration_date DATE DEFAULT CURRENT_DATE,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### 3. training_sessions (الدفعات التدريبية)
```sql
CREATE TABLE training_sessions (
    id SERIAL PRIMARY KEY,
    program_id INTEGER REFERENCES training_programs(id),
    entity_id VARCHAR(20) REFERENCES entities(id),
    session_code VARCHAR(50) UNIQUE NOT NULL,
    session_name VARCHAR(255) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    location VARCHAR(255),
    instructor_name VARCHAR(255),
    max_participants INTEGER DEFAULT 30,
    current_participants INTEGER DEFAULT 0,
    status VARCHAR(20) DEFAULT 'PLANNED', -- PLANNED, IN_PROGRESS, COMPLETED, CANCELLED
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### 4. enrollments (التسجيلات)
```sql
CREATE TABLE enrollments (
    id SERIAL PRIMARY KEY,
    session_id INTEGER REFERENCES training_sessions(id),
    beneficiary_id INTEGER REFERENCES beneficiaries(id),
    enrollment_date DATE DEFAULT CURRENT_DATE,
    status VARCHAR(20) DEFAULT 'REGISTERED', -- REGISTERED, ATTENDING, COMPLETED, WITHDRAWN, FAILED
    attendance_percentage DECIMAL(5, 2) DEFAULT 0.00,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(session_id, beneficiary_id)
);
```

### 5. assessments (التقييمات)
```sql
CREATE TABLE assessments (
    id SERIAL PRIMARY KEY,
    enrollment_id INTEGER REFERENCES enrollments(id),
    assessment_type VARCHAR(50) NOT NULL, -- WRITTEN, PRACTICAL, ORAL, PROJECT
    assessment_date DATE NOT NULL,
    score DECIMAL(5, 2),                 -- الدرجة من 100
    max_score DECIMAL(5, 2) DEFAULT 100.00,
    passed BOOLEAN DEFAULT false,
    assessor_name VARCHAR(255),
    feedback TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### 6. certificates (الشهادات)
```sql
CREATE TABLE certificates (
    id SERIAL PRIMARY KEY,
    enrollment_id INTEGER REFERENCES enrollments(id),
    beneficiary_id INTEGER REFERENCES beneficiaries(id),
    program_id INTEGER REFERENCES training_programs(id),
    certificate_number VARCHAR(100) UNIQUE NOT NULL,
    issue_date DATE DEFAULT CURRENT_DATE,
    expiry_date DATE,
    qr_code TEXT,                        -- QR code data
    final_score DECIMAL(5, 2),
    grade VARCHAR(20),                   -- EXCELLENT, VERY_GOOD, GOOD, PASS
    status VARCHAR(20) DEFAULT 'VALID',  -- VALID, EXPIRED, REVOKED, RENEWED
    issued_by VARCHAR(255),
    verification_url TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**صيغة رقم الشهادة:**
```
{ENTITY_ID}-{PROGRAM_CODE}-{YEAR}-{NUMBER}
مثال: INC03-SAF101-2024-001
```

**صيغة QR Code:**
```
QR:{CERTIFICATE_NUMBER}:{BENEFICIARY_ID}:{ISSUE_DATE}
```

### 7. training_records (السجل التدريبي)
```sql
CREATE TABLE training_records (
    id SERIAL PRIMARY KEY,
    beneficiary_id INTEGER REFERENCES beneficiaries(id),
    program_id INTEGER REFERENCES training_programs(id),
    session_id INTEGER REFERENCES training_sessions(id),
    certificate_id INTEGER REFERENCES certificates(id),
    completion_date DATE,
    total_hours INTEGER,
    final_score DECIMAL(5, 2),
    status VARCHAR(20),                  -- COMPLETED, IN_PROGRESS, WITHDRAWN
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### 8. renewals (التجديدات)
```sql
CREATE TABLE renewals (
    id SERIAL PRIMARY KEY,
    original_certificate_id INTEGER REFERENCES certificates(id),
    new_certificate_id INTEGER REFERENCES certificates(id),
    renewal_date DATE DEFAULT CURRENT_DATE,
    renewal_type VARCHAR(50),            -- STANDARD, REFRESHER, RE_EXAMINATION
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## 🔌 API Endpoints

### البرامج التدريبية

#### GET /api/training-programs
الحصول على جميع البرامج التدريبية
```bash
GET /api/training-programs?entity_id=INC03
```

**Response:**
```json
[
  {
    "id": 1,
    "entity_id": "INC03",
    "code": "SAF-101",
    "name": "السلامة والصحة المهنية - المستوى الأساسي",
    "description": "برنامج تدريبي شامل...",
    "category": "SAFETY",
    "duration_hours": 40,
    "max_participants": 25,
    "price": "1500.00",
    "passing_score": 70,
    "certificate_validity_months": 12,
    "is_active": true
  }
]
```

#### GET /api/training-programs/:id
الحصول على برنامج تدريبي محدد

#### POST /api/training-programs
إنشاء برنامج تدريبي جديد
```json
{
  "entity_id": "INC03",
  "code": "SAF-301",
  "name": "اسم البرنامج",
  "category": "SAFETY",
  "duration_hours": 40,
  "max_participants": 25,
  "price": 1500.00,
  "passing_score": 70,
  "certificate_validity_months": 12
}
```

### المستفيدون

#### GET /api/beneficiaries
الحصول على جميع المستفيدين
```bash
GET /api/beneficiaries?entity_id=INC03
```

#### GET /api/beneficiaries/:id
الحصول على مستفيد محدد مع سجله التدريبي الكامل

**Response:**
```json
{
  "id": 1,
  "full_name": "محمد بن أحمد العتيبي",
  "national_id": "1234567890",
  "email": "mohammed@email.com",
  "phone": "0501234567",
  "training_records": [
    {
      "program_name": "السلامة والصحة المهنية",
      "certificate_number": "INC03-SAF101-2024-001",
      "final_score": 87.50,
      "status": "COMPLETED"
    }
  ]
}
```

#### POST /api/beneficiaries
تسجيل مستفيد جديد
```json
{
  "entity_id": "INC03",
  "national_id": "1234567890",
  "full_name": "محمد بن أحمد",
  "email": "mohammed@email.com",
  "phone": "0501234567",
  "date_of_birth": "1995-03-15",
  "gender": "MALE",
  "education_level": "بكالوريوس",
  "occupation": "مهندس"
}
```

### الدفعات التدريبية

#### GET /api/training-sessions
الحصول على جميع الدفعات
```bash
GET /api/training-sessions?entity_id=INC03&status=IN_PROGRESS
```

#### GET /api/training-sessions/:id
الحصول على دفعة محددة مع قائمة المتدربين

#### POST /api/training-sessions
إنشاء دفعة تدريبية جديدة
```json
{
  "program_id": 1,
  "entity_id": "INC03",
  "session_code": "SAF101-2024-03",
  "session_name": "الدفعة الثالثة",
  "start_date": "2024-04-01",
  "end_date": "2024-04-15",
  "location": "قاعة التدريب",
  "instructor_name": "م. أحمد السلامة",
  "max_participants": 25
}
```

### التسجيلات

#### GET /api/enrollments
الحصول على جميع التسجيلات
```bash
GET /api/enrollments?beneficiary_id=1
GET /api/enrollments?session_id=1
```

#### POST /api/enrollments
تسجيل متدرب في دفعة
```json
{
  "session_id": 1,
  "beneficiary_id": 1,
  "notes": "ملاحظات التسجيل"
}
```

### التقييمات

#### GET /api/assessments
الحصول على جميع التقييمات
```bash
GET /api/assessments?enrollment_id=1
```

#### POST /api/assessments
إضافة تقييم جديد
```json
{
  "enrollment_id": 1,
  "assessment_type": "WRITTEN",
  "assessment_date": "2024-02-14",
  "score": 85.00,
  "max_score": 100.00,
  "assessor_name": "م. أحمد السلامة",
  "feedback": "أداء ممتاز"
}
```

### الشهادات

#### GET /api/certificates
الحصول على جميع الشهادات
```bash
GET /api/certificates?beneficiary_id=1
GET /api/certificates?status=VALID
```

#### GET /api/certificates/:id
الحصول على شهادة محددة مع جميع التفاصيل

#### GET /api/certificates/verify/:certificate_number
التحقق من صحة شهادة
```bash
GET /api/certificates/verify/INC03-SAF101-2024-001
```

**Response:**
```json
{
  "certificate_number": "INC03-SAF101-2024-001",
  "full_name": "محمد بن أحمد العتيبي",
  "national_id": "1234567890",
  "program_name": "السلامة والصحة المهنية",
  "issue_date": "2024-02-16",
  "expiry_date": "2025-02-16",
  "final_score": 87.50,
  "grade": "VERY_GOOD",
  "status": "VALID",
  "valid": true
}
```

#### POST /api/certificates
إصدار شهادة جديدة
```json
{
  "enrollment_id": 1,
  "beneficiary_id": 1,
  "program_id": 1,
  "certificate_number": "INC03-SAF101-2024-001",
  "final_score": 87.50,
  "grade": "VERY_GOOD",
  "issued_by": "حاضنة السلامة"
}
```

### السجل التدريبي

#### GET /api/training-records
الحصول على السجلات التدريبية
```bash
GET /api/training-records?beneficiary_id=1
```

### الإحصائيات

#### GET /api/incubator/stats
لوحة إحصائيات الحاضنة
```bash
GET /api/incubator/stats?entity_id=INC03
```

**Response:**
```json
{
  "total_programs": 4,
  "total_beneficiaries": 4,
  "total_sessions": 4,
  "active_sessions": 1,
  "current_enrollments": 1,
  "active_certificates": 3,
  "expired_certificates": 2
}
```

---

## 💻 واجهة المستخدم

### التنقل
النظام يظهر في القائمة الجانبية بأيقونة 🎓 "حاضنة السلامة"
يظهر فقط للكيانات من نوع `INCUBATOR` أو لإدارة HQ

### الصفحة الرئيسية
تحتوي على:
1. **بطاقات الإحصائيات**
   - البرامج التدريبية
   - المستفيدون
   - الدفعات النشطة
   - الشهادات الصالحة

2. **التبويبات الخمس**
   - 📚 البرامج التدريبية
   - 👥 المستفيدون
   - 📅 الدفعات التدريبية
   - 🏆 الشهادات
   - 📋 السجل التدريبي

### تبويب البرامج التدريبية
- عرض شبكي للبرامج
- معلومات كل برنامج:
  * الاسم والرمز
  * الوصف
  * مدة التدريب
  * عدد المتدربين
  * السعر
  * نسبة النجاح
  * مدة صلاحية الشهادة

### تبويب المستفيدون
- جدول تفاعلي بجميع المستفيدين
- عرض:
  * الصورة الشخصية (avatar)
  * الاسم الكامل
  * الهوية الوطنية
  * رقم الجوال
  * المؤهل التعليمي
  * الحالة (نشط، خريج، متوقف)
- زر عرض تفاصيل: يعرض السجل التدريبي الكامل

### تبويب الدفعات التدريبية
- قائمة الدفعات مع معلومات:
  * اسم الدفعة والبرنامج
  * تاريخ البدء والانتهاء
  * المدرب
  * عدد المتدربين (الحالي/الأقصى)
  * الموقع
  * الحالة (مخططة، جارية، مكتملة)

### تبويب الشهادات
- عرض شبكي للشهادات بتصميم جذاب
- كل شهادة تحتوي على:
  * أيقونة الشهادة
  * اسم المستفيد
  * رقم الهوية
  * اسم البرنامج
  * رقم الشهادة
  * تاريخ الإصدار والانتهاء
  * الدرجة النهائية
  * حالة الصلاحية
- محرك بحث للتحقق من الشهادات

### تبويب السجل التدريبي
- عرض موحد لجميع المستفيدين
- لكل مستفيد:
  * معلوماته الأساسية
  * جدول بكل برامجه التدريبية
  * الحالة والدرجات
  * أرقام الشهادات

---

## 📜 نظام الشهادات

### مكونات الشهادة

#### 1. رقم الاعتماد (Certificate Number)
```
صيغة: {ENTITY_ID}-{PROGRAM_CODE}-{YEAR}-{SEQUENTIAL}
مثال: INC03-SAF101-2024-001
```

#### 2. مدة الصلاحية
- يتم حسابها تلقائياً من إعدادات البرنامج
- تُضاف إلى تاريخ الإصدار
- مثال: 12 شهر (سنة واحدة)

#### 3. QR Code
```javascript
// صيغة QR Code
const qr_code = `QR:${certificate_number}:${beneficiary_id}:${issue_date}`;

// مثال
"QR:INC03-SAF101-2024-001:1:2024-02-16"
```

#### 4. رابط التحقق
```
https://nayosh.sa/verify/{CERTIFICATE_NUMBER}
```

### درجات التقييم
```javascript
const grades = {
  EXCELLENT: 90-100,    // ممتاز
  VERY_GOOD: 80-89,     // جيد جداً
  GOOD: 70-79,          // جيد
  PASS: 60-69           // مقبول
};
```

### حالات الشهادة
- `VALID`: صالحة
- `EXPIRED`: منتهية الصلاحية
- `REVOKED`: ملغاة
- `RENEWED`: تم تجديدها

---

## 📚 أمثلة الاستخدام

### مثال 1: تسجيل مستفيد جديد

```javascript
// 1. إضافة المستفيد
const beneficiary = await fetch('http://localhost:3000/api/beneficiaries', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    entity_id: 'INC03',
    national_id: '1234567890',
    full_name: 'محمد بن أحمد العتيبي',
    email: 'mohammed@email.com',
    phone: '0501234567',
    date_of_birth: '1995-03-15',
    gender: 'MALE',
    education_level: 'بكالوريوس',
    occupation: 'مهندس'
  })
});

console.log('تم التسجيل بنجاح، رقم المستفيد:', beneficiary.id);
```

### مثال 2: تسجيل في دفعة تدريبية

```javascript
// 2. تسجيل المستفيد في دفعة
const enrollment = await fetch('http://localhost:3000/api/enrollments', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    session_id: 1,
    beneficiary_id: beneficiary.id,
    notes: 'تسجيل عادي'
  })
});

console.log('تم التسجيل في الدفعة:', enrollment.id);
```

### مثال 3: إضافة تقييمات

```javascript
// 3. إضافة تقييم كتابي
await fetch('http://localhost:3000/api/assessments', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    enrollment_id: enrollment.id,
    assessment_type: 'WRITTEN',
    assessment_date: '2024-02-14',
    score: 85.00,
    max_score: 100.00,
    assessor_name: 'م. أحمد السلامة',
    feedback: 'أداء ممتاز في الجانب النظري'
  })
});

// 4. إضافة تقييم عملي
await fetch('http://localhost:3000/api/assessments', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    enrollment_id: enrollment.id,
    assessment_type: 'PRACTICAL',
    assessment_date: '2024-02-15',
    score: 90.00,
    max_score: 100.00,
    assessor_name: 'م. أحمد السلامة',
    feedback: 'مهارات عملية متميزة'
  })
});
```

### مثال 4: إصدار شهادة

```javascript
// 5. إصدار الشهادة
const certificate = await fetch('http://localhost:3000/api/certificates', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    enrollment_id: enrollment.id,
    beneficiary_id: beneficiary.id,
    program_id: 1,
    certificate_number: 'INC03-SAF101-2024-001',
    final_score: 87.50,
    grade: 'VERY_GOOD',
    issued_by: 'حاضنة السلامة'
  })
});

console.log('تم إصدار الشهادة:', certificate.certificate_number);
console.log('QR Code:', certificate.qr_code);
console.log('تنتهي في:', certificate.expiry_date);
```

### مثال 5: التحقق من شهادة

```javascript
// 6. التحقق من صحة الشهادة
const verification = await fetch(
  'http://localhost:3000/api/certificates/verify/INC03-SAF101-2024-001'
);

if (verification.valid) {
  console.log('✅ الشهادة صالحة');
  console.log('الاسم:', verification.full_name);
  console.log('البرنامج:', verification.program_name);
  console.log('الدرجة:', verification.final_score);
} else {
  console.log('❌ الشهادة غير صالحة أو منتهية');
}
```

---

## 📊 نموذج بيانات عملي

### برنامج تدريبي
```json
{
  "id": 1,
  "entity_id": "INC03",
  "code": "SAF-101",
  "name": "السلامة والصحة المهنية - المستوى الأساسي",
  "description": "برنامج تدريبي شامل في أساسيات السلامة",
  "category": "SAFETY",
  "duration_hours": 40,
  "max_participants": 25,
  "price": "1500.00",
  "passing_score": 70,
  "certificate_validity_months": 12,
  "is_active": true
}
```

### مستفيد
```json
{
  "id": 1,
  "entity_id": "INC03",
  "national_id": "1234567890",
  "full_name": "محمد بن أحمد العتيبي",
  "email": "mohammed@email.com",
  "phone": "0501234567",
  "date_of_birth": "1995-03-15",
  "gender": "MALE",
  "education_level": "بكالوريوس",
  "occupation": "مهندس",
  "status": "ACTIVE",
  "registration_date": "2024-01-15"
}
```

### شهادة
```json
{
  "id": 1,
  "certificate_number": "INC03-SAF101-2024-001",
  "beneficiary_id": 1,
  "program_id": 1,
  "enrollment_id": 1,
  "issue_date": "2024-02-16",
  "expiry_date": "2025-02-16",
  "qr_code": "QR:INC03-SAF101-2024-001:1:2024-02-16",
  "final_score": "87.50",
  "grade": "VERY_GOOD",
  "status": "VALID",
  "issued_by": "حاضنة السلامة",
  "verification_url": "https://nayosh.sa/verify/INC03-SAF101-2024-001"
}
```

---

## 🔐 الأمان والصلاحيات

### التحكم بالوصول
- الحاضنات (`INCUBATOR`): الوصول الكامل لبياناتها
- الإدارة (`HQ`): الوصول لجميع الحاضنات
- الأدوار المالية: لا وصول (إلا إذا كانت حاضنة)

### التحقق من البيانات
- الهوية الوطنية: يجب أن تكون فريدة
- رقم الشهادة: يجب أن يكون فريداً
- التسجيل المزدوج: منع تسجيل نفس المستفيد في نفس الدفعة مرتين

---

## 🚀 التطوير المستقبلي

### ميزات مخططة
- [ ] تصدير الشهادات PDF
- [ ] إرسال الشهادات عبر البريد الإلكتروني
- [ ] نظام تنبيهات للشهادات القريبة من الانتهاء
- [ ] تقارير تحليلية متقدمة
- [ ] نظام حجز الدورات أونلاين
- [ ] نظام دفع إلكتروني
- [ ] تطبيق جوال للمتدربين
- [ ] لوحة تحكم للمدربين

---

## 📞 الدعم

لأي استفسارات أو مساعدة:
- **المطور**: نظام نايوش ERP
- **الإصدار**: 1.0.0
- **التاريخ**: 2024

---

## 📄 الترخيص

© 2024 NAIOSH ERP System. جميع الحقوق محفوظة.

