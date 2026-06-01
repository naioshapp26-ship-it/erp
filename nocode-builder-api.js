/**
 * No-Code Builder API
 * Parses Arabic/English descriptions and creates real database-backed systems
 */

const express = require('express');
const router = express.Router();
const db = require('./db');

// =====================================================================
// INITIALIZATION - Create tables
// =====================================================================
async function initNocodeBuilderTables() {
  try {
    // Master table - stores each created system
    await db.query(`
      CREATE TABLE IF NOT EXISTS nocode_systems (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        icon VARCHAR(100) DEFAULT 'fas fa-layer-group',
        color VARCHAR(50) DEFAULT '#7c3aed',
        tables_config JSONB NOT NULL DEFAULT '[]',
        menu_item_id INTEGER,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Generic records table - stores data for ALL nocode systems
    await db.query(`
      CREATE TABLE IF NOT EXISTS nocode_records (
        id SERIAL PRIMARY KEY,
        system_id INTEGER NOT NULL REFERENCES nocode_systems(id) ON DELETE CASCADE,
        table_key VARCHAR(100) NOT NULL,
        record_data JSONB NOT NULL DEFAULT '{}',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await db.query(`CREATE INDEX IF NOT EXISTS idx_nocode_records_system_table ON nocode_records(system_id, table_key)`);

    console.log('✅ nocode_builder: tables ready');
  } catch (err) {
    console.error('❌ nocode_builder init error:', err.message);
  }
}

// =====================================================================
// SMART AI PARSER  (works 100% offline - no API key needed)
// =====================================================================

const SYSTEM_TEMPLATES = {
  crm: {
    name_ar: 'نظام إدارة العملاء (CRM)',
    icon: 'fas fa-handshake',
    color: '#7c3aed',
    tables: [
      {
        key: 'clients', name_ar: 'العملاء', icon: 'fas fa-users',
        fields: [
          { key: 'name', label_ar: 'اسم العميل', type: 'text', required: true },
          { key: 'phone', label_ar: 'رقم الهاتف', type: 'tel' },
          { key: 'email', label_ar: 'البريد الإلكتروني', type: 'email' },
          { key: 'company', label_ar: 'الشركة', type: 'text' },
          { key: 'city', label_ar: 'المدينة', type: 'text' },
          { key: 'status', label_ar: 'الحالة', type: 'select', options: ['عميل محتمل', 'عميل فعلي', 'عميل غير نشط'] },
          { key: 'notes', label_ar: 'ملاحظات', type: 'textarea' }
        ]
      },
      {
        key: 'deals', name_ar: 'الصفقات', icon: 'fas fa-dollar-sign',
        fields: [
          { key: 'title', label_ar: 'عنوان الصفقة', type: 'text', required: true },
          { key: 'client_name', label_ar: 'اسم العميل', type: 'text' },
          { key: 'value', label_ar: 'القيمة', type: 'number' },
          { key: 'stage', label_ar: 'المرحلة', type: 'select', options: ['اتصال أولي', 'عرض سعر', 'مفاوضة', 'مغلقة فائزة', 'مغلقة خاسرة'] },
          { key: 'close_date', label_ar: 'تاريخ الإغلاق المتوقع', type: 'date' },
          { key: 'notes', label_ar: 'ملاحظات', type: 'textarea' }
        ]
      },
      {
        key: 'activities', name_ar: 'الأنشطة', icon: 'fas fa-calendar-check',
        fields: [
          { key: 'type', label_ar: 'نوع النشاط', type: 'select', options: ['مكالمة', 'اجتماع', 'بريد إلكتروني', 'زيارة'] },
          { key: 'client_name', label_ar: 'اسم العميل', type: 'text' },
          { key: 'date', label_ar: 'التاريخ', type: 'datetime-local' },
          { key: 'status', label_ar: 'الحالة', type: 'select', options: ['مخطط', 'منجز', 'ملغي'] },
          { key: 'notes', label_ar: 'تفاصيل', type: 'textarea' }
        ]
      }
    ]
  },

  inventory: {
    name_ar: 'نظام المخازن والمخزون',
    icon: 'fas fa-boxes',
    color: '#0ea5e9',
    tables: [
      {
        key: 'products', name_ar: 'المنتجات', icon: 'fas fa-box',
        fields: [
          { key: 'name', label_ar: 'اسم المنتج', type: 'text', required: true },
          { key: 'sku', label_ar: 'كود المنتج', type: 'text' },
          { key: 'category', label_ar: 'الفئة', type: 'text' },
          { key: 'quantity', label_ar: 'الكمية المتاحة', type: 'number' },
          { key: 'min_quantity', label_ar: 'الحد الأدنى', type: 'number' },
          { key: 'price', label_ar: 'السعر', type: 'number' },
          { key: 'supplier', label_ar: 'المورد', type: 'text' },
          { key: 'location', label_ar: 'موقع التخزين', type: 'text' }
        ]
      },
      {
        key: 'movements', name_ar: 'حركة المخزون', icon: 'fas fa-exchange-alt',
        fields: [
          { key: 'product_name', label_ar: 'المنتج', type: 'text', required: true },
          { key: 'type', label_ar: 'نوع الحركة', type: 'select', options: ['وارد', 'صادر', 'تحويل', 'إرجاع'] },
          { key: 'quantity', label_ar: 'الكمية', type: 'number', required: true },
          { key: 'date', label_ar: 'التاريخ', type: 'date' },
          { key: 'reference', label_ar: 'المرجع', type: 'text' },
          { key: 'notes', label_ar: 'ملاحظات', type: 'textarea' }
        ]
      },
      {
        key: 'suppliers', name_ar: 'الموردون', icon: 'fas fa-truck',
        fields: [
          { key: 'name', label_ar: 'اسم المورد', type: 'text', required: true },
          { key: 'phone', label_ar: 'الهاتف', type: 'tel' },
          { key: 'email', label_ar: 'البريد الإلكتروني', type: 'email' },
          { key: 'address', label_ar: 'العنوان', type: 'textarea' },
          { key: 'payment_terms', label_ar: 'شروط الدفع', type: 'text' },
          { key: 'rating', label_ar: 'التقييم', type: 'select', options: ['ممتاز', 'جيد', 'مقبول', 'ضعيف'] }
        ]
      }
    ]
  },

  hr: {
    name_ar: 'نظام إدارة الموارد البشرية',
    icon: 'fas fa-users-cog',
    color: '#10b981',
    tables: [
      {
        key: 'employees', name_ar: 'الموظفون', icon: 'fas fa-user-tie',
        fields: [
          { key: 'name', label_ar: 'اسم الموظف', type: 'text', required: true },
          { key: 'job_title', label_ar: 'المسمى الوظيفي', type: 'text' },
          { key: 'department', label_ar: 'القسم', type: 'text' },
          { key: 'phone', label_ar: 'رقم الهاتف', type: 'tel' },
          { key: 'email', label_ar: 'البريد الإلكتروني', type: 'email' },
          { key: 'hire_date', label_ar: 'تاريخ التوظيف', type: 'date' },
          { key: 'salary', label_ar: 'الراتب', type: 'number' },
          { key: 'status', label_ar: 'الحالة', type: 'select', options: ['نشط', 'في إجازة', 'منتهي الخدمة'] }
        ]
      },
      {
        key: 'leaves', name_ar: 'طلبات الإجازة', icon: 'fas fa-calendar-alt',
        fields: [
          { key: 'employee_name', label_ar: 'اسم الموظف', type: 'text', required: true },
          { key: 'leave_type', label_ar: 'نوع الإجازة', type: 'select', options: ['سنوية', 'مرضية', 'طارئة', 'بدون راتب'] },
          { key: 'start_date', label_ar: 'من تاريخ', type: 'date', required: true },
          { key: 'end_date', label_ar: 'إلى تاريخ', type: 'date', required: true },
          { key: 'reason', label_ar: 'السبب', type: 'textarea' },
          { key: 'status', label_ar: 'الحالة', type: 'select', options: ['معلق', 'موافق عليه', 'مرفوض'] }
        ]
      },
      {
        key: 'salaries', name_ar: 'الرواتب', icon: 'fas fa-money-check-alt',
        fields: [
          { key: 'employee_name', label_ar: 'اسم الموظف', type: 'text', required: true },
          { key: 'month', label_ar: 'الشهر', type: 'month' },
          { key: 'basic_salary', label_ar: 'الراتب الأساسي', type: 'number' },
          { key: 'allowances', label_ar: 'البدلات', type: 'number' },
          { key: 'deductions', label_ar: 'الخصومات', type: 'number' },
          { key: 'net_salary', label_ar: 'صافي الراتب', type: 'number' },
          { key: 'status', label_ar: 'الحالة', type: 'select', options: ['مسودة', 'تم الصرف'] }
        ]
      }
    ]
  },

  projects: {
    name_ar: 'نظام إدارة المشاريع',
    icon: 'fas fa-project-diagram',
    color: '#f59e0b',
    tables: [
      {
        key: 'projects', name_ar: 'المشاريع', icon: 'fas fa-briefcase',
        fields: [
          { key: 'name', label_ar: 'اسم المشروع', type: 'text', required: true },
          { key: 'client', label_ar: 'العميل', type: 'text' },
          { key: 'manager', label_ar: 'مدير المشروع', type: 'text' },
          { key: 'start_date', label_ar: 'تاريخ البدء', type: 'date' },
          { key: 'end_date', label_ar: 'تاريخ الانتهاء', type: 'date' },
          { key: 'budget', label_ar: 'الميزانية', type: 'number' },
          { key: 'status', label_ar: 'الحالة', type: 'select', options: ['مخطط', 'قيد التنفيذ', 'متوقف', 'منجز'] },
          { key: 'progress', label_ar: 'نسبة الإنجاز %', type: 'number' }
        ]
      },
      {
        key: 'tasks', name_ar: 'المهام', icon: 'fas fa-tasks',
        fields: [
          { key: 'title', label_ar: 'عنوان المهمة', type: 'text', required: true },
          { key: 'project', label_ar: 'المشروع', type: 'text' },
          { key: 'assignee', label_ar: 'المكلف بها', type: 'text' },
          { key: 'priority', label_ar: 'الأولوية', type: 'select', options: ['عاجل', 'عالي', 'متوسط', 'منخفض'] },
          { key: 'due_date', label_ar: 'الموعد النهائي', type: 'date' },
          { key: 'status', label_ar: 'الحالة', type: 'select', options: ['لم تبدأ', 'قيد التنفيذ', 'منجزة', 'ملغاة'] },
          { key: 'notes', label_ar: 'ملاحظات', type: 'textarea' }
        ]
      },
      {
        key: 'team', name_ar: 'الفريق', icon: 'fas fa-users',
        fields: [
          { key: 'name', label_ar: 'اسم العضو', type: 'text', required: true },
          { key: 'role', label_ar: 'الدور', type: 'text' },
          { key: 'project', label_ar: 'المشروع', type: 'text' },
          { key: 'phone', label_ar: 'الهاتف', type: 'tel' },
          { key: 'email', label_ar: 'البريد', type: 'email' }
        ]
      }
    ]
  },

  booking: {
    name_ar: 'نظام الحجوزات والمواعيد',
    icon: 'fas fa-calendar-check',
    color: '#f43f5e',
    tables: [
      {
        key: 'appointments', name_ar: 'المواعيد', icon: 'fas fa-clock',
        fields: [
          { key: 'client_name', label_ar: 'اسم العميل', type: 'text', required: true },
          { key: 'phone', label_ar: 'رقم الهاتف', type: 'tel' },
          { key: 'service', label_ar: 'الخدمة', type: 'text' },
          { key: 'date', label_ar: 'التاريخ', type: 'date', required: true },
          { key: 'time', label_ar: 'الوقت', type: 'time' },
          { key: 'duration', label_ar: 'المدة (دقيقة)', type: 'number' },
          { key: 'status', label_ar: 'الحالة', type: 'select', options: ['محجوز', 'تأكيد', 'ملغي', 'منجز'] },
          { key: 'notes', label_ar: 'ملاحظات', type: 'textarea' }
        ]
      },
      {
        key: 'services', name_ar: 'الخدمات', icon: 'fas fa-concierge-bell',
        fields: [
          { key: 'name', label_ar: 'اسم الخدمة', type: 'text', required: true },
          { key: 'price', label_ar: 'السعر', type: 'number' },
          { key: 'duration', label_ar: 'المدة (دقيقة)', type: 'number' },
          { key: 'description', label_ar: 'الوصف', type: 'textarea' },
          { key: 'is_active', label_ar: 'نشطة', type: 'select', options: ['نعم', 'لا'] }
        ]
      },
      {
        key: 'clients', name_ar: 'العملاء', icon: 'fas fa-user',
        fields: [
          { key: 'name', label_ar: 'اسم العميل', type: 'text', required: true },
          { key: 'phone', label_ar: 'الهاتف', type: 'tel' },
          { key: 'email', label_ar: 'البريد', type: 'email' },
          { key: 'notes', label_ar: 'ملاحظات', type: 'textarea' }
        ]
      }
    ]
  },

  ecommerce: {
    name_ar: 'نظام المتجر الإلكتروني',
    icon: 'fas fa-shopping-cart',
    color: '#10b981',
    tables: [
      {
        key: 'products', name_ar: 'المنتجات', icon: 'fas fa-box-open',
        fields: [
          { key: 'name', label_ar: 'اسم المنتج', type: 'text', required: true },
          { key: 'price', label_ar: 'السعر', type: 'number', required: true },
          { key: 'stock', label_ar: 'المخزون', type: 'number' },
          { key: 'category', label_ar: 'الفئة', type: 'text' },
          { key: 'description', label_ar: 'الوصف', type: 'textarea' },
          { key: 'status', label_ar: 'الحالة', type: 'select', options: ['نشط', 'غير نشط', 'نفد المخزون'] }
        ]
      },
      {
        key: 'orders', name_ar: 'الطلبات', icon: 'fas fa-shopping-bag',
        fields: [
          { key: 'order_number', label_ar: 'رقم الطلب', type: 'text' },
          { key: 'customer_name', label_ar: 'اسم العميل', type: 'text', required: true },
          { key: 'phone', label_ar: 'الهاتف', type: 'tel' },
          { key: 'total', label_ar: 'الإجمالي', type: 'number' },
          { key: 'payment_method', label_ar: 'طريقة الدفع', type: 'select', options: ['نقدي', 'بطاقة', 'تحويل', 'عند الاستلام'] },
          { key: 'status', label_ar: 'حالة الطلب', type: 'select', options: ['جديد', 'قيد التجهيز', 'تم الشحن', 'تم التسليم', 'ملغي'] },
          { key: 'address', label_ar: 'عنوان التوصيل', type: 'textarea' }
        ]
      },
      {
        key: 'customers', name_ar: 'العملاء', icon: 'fas fa-users',
        fields: [
          { key: 'name', label_ar: 'الاسم', type: 'text', required: true },
          { key: 'phone', label_ar: 'الهاتف', type: 'tel' },
          { key: 'email', label_ar: 'البريد', type: 'email' },
          { key: 'address', label_ar: 'العنوان', type: 'textarea' },
          { key: 'total_orders', label_ar: 'عدد الطلبات', type: 'number' }
        ]
      }
    ]
  },

  support: {
    name_ar: 'نظام دعم العملاء',
    icon: 'fas fa-headset',
    color: '#0ea5e9',
    tables: [
      {
        key: 'tickets', name_ar: 'تذاكر الدعم', icon: 'fas fa-ticket-alt',
        fields: [
          { key: 'title', label_ar: 'عنوان المشكلة', type: 'text', required: true },
          { key: 'client_name', label_ar: 'اسم العميل', type: 'text', required: true },
          { key: 'phone', label_ar: 'الهاتف', type: 'tel' },
          { key: 'email', label_ar: 'البريد', type: 'email' },
          { key: 'category', label_ar: 'الفئة', type: 'select', options: ['تقني', 'فوترة', 'استفسار', 'شكوى'] },
          { key: 'priority', label_ar: 'الأولوية', type: 'select', options: ['عاجل', 'عالي', 'متوسط', 'منخفض'] },
          { key: 'status', label_ar: 'الحالة', type: 'select', options: ['مفتوح', 'قيد المعالجة', 'مغلق'] },
          { key: 'assigned_to', label_ar: 'المكلف', type: 'text' },
          { key: 'description', label_ar: 'تفاصيل المشكلة', type: 'textarea' }
        ]
      },
      {
        key: 'clients', name_ar: 'العملاء', icon: 'fas fa-users',
        fields: [
          { key: 'name', label_ar: 'اسم العميل', type: 'text', required: true },
          { key: 'phone', label_ar: 'الهاتف', type: 'tel' },
          { key: 'email', label_ar: 'البريد', type: 'email' },
          { key: 'account_type', label_ar: 'نوع الحساب', type: 'select', options: ['مجاني', 'أساسي', 'احترافي', 'مؤسسي'] }
        ]
      }
    ]
  },

  clinic: {
    name_ar: 'نظام إدارة العيادة',
    icon: 'fas fa-hospital',
    color: '#ef4444',
    tables: [
      {
        key: 'patients', name_ar: 'المرضى', icon: 'fas fa-procedures',
        fields: [
          { key: 'name', label_ar: 'اسم المريض', type: 'text', required: true },
          { key: 'phone', label_ar: 'الهاتف', type: 'tel' },
          { key: 'birth_date', label_ar: 'تاريخ الميلاد', type: 'date' },
          { key: 'gender', label_ar: 'الجنس', type: 'select', options: ['ذكر', 'أنثى'] },
          { key: 'blood_type', label_ar: 'فصيلة الدم', type: 'select', options: ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'] },
          { key: 'allergies', label_ar: 'الحساسية', type: 'text' },
          { key: 'notes', label_ar: 'ملاحظات', type: 'textarea' }
        ]
      },
      {
        key: 'visits', name_ar: 'الزيارات', icon: 'fas fa-stethoscope',
        fields: [
          { key: 'patient_name', label_ar: 'اسم المريض', type: 'text', required: true },
          { key: 'date', label_ar: 'التاريخ', type: 'date', required: true },
          { key: 'doctor', label_ar: 'الطبيب', type: 'text' },
          { key: 'diagnosis', label_ar: 'التشخيص', type: 'textarea' },
          { key: 'treatment', label_ar: 'خطة العلاج', type: 'textarea' },
          { key: 'fees', label_ar: 'الرسوم', type: 'number' },
          { key: 'next_visit', label_ar: 'الزيارة القادمة', type: 'date' }
        ]
      },
      {
        key: 'appointments', name_ar: 'المواعيد', icon: 'fas fa-calendar',
        fields: [
          { key: 'patient_name', label_ar: 'اسم المريض', type: 'text', required: true },
          { key: 'phone', label_ar: 'الهاتف', type: 'tel' },
          { key: 'date', label_ar: 'التاريخ', type: 'date', required: true },
          { key: 'time', label_ar: 'الوقت', type: 'time' },
          { key: 'type', label_ar: 'نوع الزيارة', type: 'select', options: ['فحص عادي', 'متابعة', 'طارئ'] },
          { key: 'status', label_ar: 'الحالة', type: 'select', options: ['محجوز', 'تأكيد', 'ملغي', 'حضر'] }
        ]
      }
    ]
  },

  school: {
    name_ar: 'نظام إدارة المدرسة',
    icon: 'fas fa-school',
    color: '#8b5cf6',
    tables: [
      {
        key: 'students', name_ar: 'الطلاب', icon: 'fas fa-user-graduate',
        fields: [
          { key: 'name', label_ar: 'اسم الطالب', type: 'text', required: true },
          { key: 'grade', label_ar: 'الصف', type: 'text' },
          { key: 'section', label_ar: 'الفصل', type: 'text' },
          { key: 'phone', label_ar: 'هاتف ولي الأمر', type: 'tel' },
          { key: 'birth_date', label_ar: 'تاريخ الميلاد', type: 'date' },
          { key: 'status', label_ar: 'الحالة', type: 'select', options: ['نشط', 'منسحب', 'موقوف'] }
        ]
      },
      {
        key: 'grades', name_ar: 'الدرجات', icon: 'fas fa-clipboard-list',
        fields: [
          { key: 'student_name', label_ar: 'اسم الطالب', type: 'text', required: true },
          { key: 'subject', label_ar: 'المادة', type: 'text' },
          { key: 'exam_type', label_ar: 'نوع الاختبار', type: 'select', options: ['أولى', 'نهائي', 'أعمال السنة'] },
          { key: 'score', label_ar: 'الدرجة', type: 'number' },
          { key: 'max_score', label_ar: 'الدرجة الكاملة', type: 'number' },
          { key: 'date', label_ar: 'التاريخ', type: 'date' }
        ]
      },
      {
        key: 'attendance', name_ar: 'الحضور والغياب', icon: 'fas fa-check-square',
        fields: [
          { key: 'student_name', label_ar: 'اسم الطالب', type: 'text', required: true },
          { key: 'date', label_ar: 'التاريخ', type: 'date', required: true },
          { key: 'status', label_ar: 'الحالة', type: 'select', options: ['حاضر', 'غائب', 'متأخر', 'إجازة'] },
          { key: 'notes', label_ar: 'ملاحظات', type: 'text' }
        ]
      }
    ]
  },

  restaurant: {
    name_ar: 'نظام إدارة المطعم',
    icon: 'fas fa-utensils',
    color: '#f97316',
    tables: [
      {
        key: 'menu', name_ar: 'قائمة الطعام', icon: 'fas fa-book-open',
        fields: [
          { key: 'name', label_ar: 'اسم الصنف', type: 'text', required: true },
          { key: 'category', label_ar: 'التصنيف', type: 'select', options: ['مقبلات', 'رئيسي', 'حلويات', 'مشروبات'] },
          { key: 'price', label_ar: 'السعر', type: 'number', required: true },
          { key: 'description', label_ar: 'الوصف', type: 'textarea' },
          { key: 'is_available', label_ar: 'متاح', type: 'select', options: ['نعم', 'لا'] }
        ]
      },
      {
        key: 'orders', name_ar: 'الطلبات', icon: 'fas fa-receipt',
        fields: [
          { key: 'table_number', label_ar: 'رقم الطاولة', type: 'text' },
          { key: 'waiter', label_ar: 'النادل', type: 'text' },
          { key: 'items', label_ar: 'الأصناف المطلوبة', type: 'textarea' },
          { key: 'total', label_ar: 'الإجمالي', type: 'number' },
          { key: 'payment_method', label_ar: 'طريقة الدفع', type: 'select', options: ['نقدي', 'بطاقة', 'تحويل'] },
          { key: 'status', label_ar: 'الحالة', type: 'select', options: ['جديد', 'قيد التحضير', 'جاهز', 'تم التسليم'] }
        ]
      },
      {
        key: 'staff', name_ar: 'الموظفون', icon: 'fas fa-users',
        fields: [
          { key: 'name', label_ar: 'الاسم', type: 'text', required: true },
          { key: 'role', label_ar: 'الدور', type: 'select', options: ['طاهي', 'نادل', 'كاشير', 'مدير'] },
          { key: 'phone', label_ar: 'الهاتف', type: 'tel' },
          { key: 'shift', label_ar: 'الوردية', type: 'select', options: ['صباحي', 'مسائي', 'ليلي'] }
        ]
      }
    ]
  },

  realestate: {
    name_ar: 'نظام إدارة العقارات',
    icon: 'fas fa-building',
    color: '#0891b2',
    tables: [
      {
        key: 'properties', name_ar: 'العقارات', icon: 'fas fa-home',
        fields: [
          { key: 'name', label_ar: 'اسم العقار', type: 'text', required: true },
          { key: 'type', label_ar: 'النوع', type: 'select', options: ['شقة', 'فيلا', 'محل تجاري', 'مكتب', 'أرض'] },
          { key: 'address', label_ar: 'العنوان', type: 'textarea' },
          { key: 'area', label_ar: 'المساحة م²', type: 'number' },
          { key: 'price', label_ar: 'السعر', type: 'number' },
          { key: 'status', label_ar: 'الحالة', type: 'select', options: ['للبيع', 'للإيجار', 'مباع', 'مؤجر'] },
          { key: 'owner', label_ar: 'المالك', type: 'text' }
        ]
      },
      {
        key: 'contracts', name_ar: 'العقود', icon: 'fas fa-file-contract',
        fields: [
          { key: 'property_name', label_ar: 'اسم العقار', type: 'text', required: true },
          { key: 'client_name', label_ar: 'اسم العميل', type: 'text' },
          { key: 'type', label_ar: 'نوع العقد', type: 'select', options: ['بيع', 'إيجار', 'تجديد'] },
          { key: 'start_date', label_ar: 'تاريخ البدء', type: 'date' },
          { key: 'end_date', label_ar: 'تاريخ الانتهاء', type: 'date' },
          { key: 'value', label_ar: 'قيمة العقد', type: 'number' },
          { key: 'status', label_ar: 'الحالة', type: 'select', options: ['فعال', 'منتهي', 'ملغي'] }
        ]
      }
    ]
  },

  library: {
    name_ar: 'نظام إدارة المكتبة',
    icon: 'fas fa-book',
    color: '#6d28d9',
    tables: [
      {
        key: 'books', name_ar: 'الكتب', icon: 'fas fa-book',
        fields: [
          { key: 'title', label_ar: 'عنوان الكتاب', type: 'text', required: true },
          { key: 'author', label_ar: 'المؤلف', type: 'text' },
          { key: 'category', label_ar: 'التصنيف', type: 'text' },
          { key: 'isbn', label_ar: 'الرقم الدولي ISBN', type: 'text' },
          { key: 'quantity', label_ar: 'الكمية', type: 'number' },
          { key: 'available', label_ar: 'المتاح', type: 'number' },
          { key: 'location', label_ar: 'الموقع في المكتبة', type: 'text' }
        ]
      },
      {
        key: 'borrowings', name_ar: 'الاستعارات', icon: 'fas fa-hand-holding',
        fields: [
          { key: 'book_title', label_ar: 'الكتاب', type: 'text', required: true },
          { key: 'borrower_name', label_ar: 'اسم المستعير', type: 'text', required: true },
          { key: 'borrow_date', label_ar: 'تاريخ الاستعارة', type: 'date' },
          { key: 'due_date', label_ar: 'تاريخ الإرجاع', type: 'date' },
          { key: 'returned_date', label_ar: 'تاريخ الإرجاع الفعلي', type: 'date' },
          { key: 'status', label_ar: 'الحالة', type: 'select', options: ['مستعار', 'مُرجع', 'متأخر'] }
        ]
      }
    ]
  }
};

// =====================================================================
// KEYWORD DETECTION ENGINE
// =====================================================================
function detectSystemType(description) {
  const text = description.toLowerCase();

  const keywords = {
    crm: ['crm', 'عملاء', 'عميل', 'clients', 'customer', 'مبيعات', 'sales', 'صفقات', 'deal', 'فرص', 'leads', 'علاقات', 'تجارية'],
    inventory: ['مخزن', 'مخزون', 'مستودع', 'inventory', 'warehouse', 'منتجات', 'products', 'stock', 'جرد', 'كمية', 'supplies', 'مورد', 'supplier'],
    hr: ['موارد بشرية', 'hr', 'human resource', 'موظفين', 'موظف', 'employees', 'رواتب', 'salary', 'payroll', 'إجازات', 'leave', 'حضور', 'attendance', 'تقييم'],
    projects: ['مشاريع', 'مشروع', 'project', 'مهام', 'tasks', 'فريق', 'team', 'جدول زمني', 'timeline', 'milestone', 'sprints'],
    booking: ['حجوزات', 'حجز', 'booking', 'appointment', 'مواعيد', 'موعد', 'جدول', 'schedule', 'calendar', 'تقويم', 'غرف', 'rooms'],
    ecommerce: ['متجر', 'store', 'ecommerce', 'e-commerce', 'تجارة إلكترونية', 'شراء', 'cart', 'سلة', 'طلبات الشراء', 'دفع', 'payment', 'shipping'],
    support: ['دعم', 'support', 'help desk', 'helpdesk', 'تذاكر', 'ticket', 'شكاوى', 'شكوى', 'complaints', 'خدمة عملاء'],
    clinic: ['عيادة', 'clinic', 'hospital', 'مستشفى', 'مرضى', 'مريض', 'patient', 'طبية', 'medical', 'طبيب', 'doctor', 'علاج'],
    school: ['مدرسة', 'school', 'طلاب', 'طالب', 'student', 'تعليم', 'education', 'درجات', 'grades', 'فصل', 'صف', 'منهج'],
    restaurant: ['مطعم', 'restaurant', 'cafe', 'كافيه', 'وجبات', 'طعام', 'food', 'قائمة', 'menu', 'طلبات', 'orders', 'طاولة'],
    realstate: ['عقار', 'عقارات', 'real estate', 'property', 'شقق', 'apartment', 'فيلا', 'villa', 'إيجار', 'rent', 'بيع', 'sale', 'عقود'],
    library: ['مكتبة', 'library', 'كتب', 'كتاب', 'book', 'استعارة', 'borrowing', 'قراءة', 'reading']
  };

  const scores = {};
  for (const [type, words] of Object.entries(keywords)) {
    scores[type] = 0;
    for (const word of words) {
      if (text.includes(word)) scores[type]++;
    }
  }

  const best = Object.entries(scores).sort((a, b) => b[1] - a[1])[0];
  return best[1] > 0 ? best[0] : 'crm'; // default to CRM if no match
}

// Extract custom system name from description
function extractSystemName(description, type) {
  const template = SYSTEM_TEMPLATES[type];

  // Try to extract a meaningful title from description
  const lines = description.split(/[.،,\n]/);
  const firstLine = lines[0].trim();

  if (firstLine.includes('نظام')) {
    // If the user mentioned "نظام X" extract it
    const match = firstLine.match(/نظام\s+(.{3,30})/);
    if (match) return `نظام ${match[1].trim()}`;
  }

  if (firstLine.includes('system') || firstLine.includes('System')) {
    return firstLine.substring(0, 50).trim();
  }

  return template ? template.name_ar : 'نظام مخصص';
}

// =====================================================================
// API ROUTES
// =====================================================================

// POST /api/nocode/generate
// Main endpoint: parse description, create system in DB, return config
router.post('/generate', async (req, res) => {
  try {
    const { description } = req.body;

    if (!description || description.trim().length < 10) {
      return res.status(400).json({ error: 'من فضلك اكتب وصفاً كافياً للنظام' });
    }

    // 1. Detect system type
    const systemType = detectSystemType(description);
    const template = SYSTEM_TEMPLATES[systemType] || SYSTEM_TEMPLATES.crm;

    // 2. Build system name from description
    const systemName = extractSystemName(description, systemType);

    // 3. Create and save to DB
    const insertResult = await db.query(`
      INSERT INTO nocode_systems (name, description, icon, color, tables_config)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, name, icon, color, tables_config, created_at
    `, [systemName, description, template.icon, template.color, JSON.stringify(template.tables)]);

    const newSystem = insertResult.rows[0];

    // 4. Add to sidebar menu
    try {
      await db.query(`
        INSERT INTO sidebar_menu (title_ar, title_en, icon, url, is_active, display_order)
        VALUES ($1, $2, $3, $4, true, 999)
      `, [newSystem.name, systemName, template.icon, `/hr/nocode-system/${newSystem.id}`]);
    } catch (menuErr) {
      // Non-critical, sidebar might not have this menu
      console.warn('Could not add to sidebar:', menuErr.message);
    }

    res.json({
      success: true,
      system: {
        id: newSystem.id,
        name: newSystem.name,
        icon: newSystem.icon,
        color: newSystem.color,
        tables: newSystem.tables_config,
        url: `/hr/nocode-system/${newSystem.id}`,
        created_at: newSystem.created_at
      }
    });

  } catch (err) {
    console.error('nocode generate error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/nocode/systems
// List all created systems
router.get('/systems', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT id, name, icon, color, tables_config, created_at
      FROM nocode_systems
      WHERE is_active = true
      ORDER BY created_at DESC
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/nocode/systems/:id
// Get a specific system config
router.get('/systems/:id', async (req, res) => {
  try {
    const result = await db.query(
      'SELECT * FROM nocode_systems WHERE id = $1 AND is_active = true',
      [req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'النظام غير موجود' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/nocode/systems/:id/tables/:tableKey/records
// Get records for a table in a system
router.get('/systems/:id/tables/:tableKey/records', async (req, res) => {
  try {
    const { id, tableKey } = req.params;
    const result = await db.query(`
      SELECT id, record_data, created_at, updated_at
      FROM nocode_records
      WHERE system_id = $1 AND table_key = $2
      ORDER BY created_at DESC
    `, [id, tableKey]);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/nocode/systems/:id/tables/:tableKey/records
// Add a record
router.post('/systems/:id/tables/:tableKey/records', async (req, res) => {
  try {
    const { id, tableKey } = req.params;
    const recordData = req.body;

    const result = await db.query(`
      INSERT INTO nocode_records (system_id, table_key, record_data)
      VALUES ($1, $2, $3)
      RETURNING id, record_data, created_at
    `, [id, tableKey, JSON.stringify(recordData)]);

    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/nocode/systems/:id/tables/:tableKey/records/:recordId
// Update a record
router.put('/systems/:id/tables/:tableKey/records/:recordId', async (req, res) => {
  try {
    const { id, tableKey, recordId } = req.params;
    const recordData = req.body;

    const result = await db.query(`
      UPDATE nocode_records
      SET record_data = $1, updated_at = NOW()
      WHERE id = $2 AND system_id = $3 AND table_key = $4
      RETURNING id, record_data, updated_at
    `, [JSON.stringify(recordData), recordId, id, tableKey]);

    if (!result.rows.length) return res.status(404).json({ error: 'السجل غير موجود' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/nocode/systems/:id/tables/:tableKey/records/:recordId
// Delete a record
router.delete('/systems/:id/tables/:tableKey/records/:recordId', async (req, res) => {
  try {
    const { id, tableKey, recordId } = req.params;
    await db.query(
      'DELETE FROM nocode_records WHERE id = $1 AND system_id = $2 AND table_key = $3',
      [recordId, id, tableKey]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/nocode/systems/:id
// Delete a whole system
router.delete('/systems/:id', async (req, res) => {
  try {
    await db.query('UPDATE nocode_systems SET is_active = false WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = { router, initNocodeBuilderTables };
