'use strict';

const STATUS_OPTIONS = [
  { value: 'نشط', label: 'نشط' },
  { value: 'موقوف', label: 'موقوف' }
];

const YES_NO = [
  { value: 'نعم', label: 'نعم' },
  { value: 'لا', label: 'لا' }
];

const field = (key, label, type = 'text', extra = {}) => {
  if (type && typeof type === 'object') {
    extra = type;
    type = extra.type || 'text';
  }
  return {
    key,
    label,
    type,
    required: extra.required !== false,
    ...extra
  };
};

const nameFields = [
  field('code', 'الرمز'),
  field('name', 'الاسم'),
  field('status', 'الحالة', 'select', { options: STATUS_OPTIONS }),
  field('notes', 'ملاحظات', 'textarea', { required: false })
];

function item(key, label, extras = {}) {
  return {
    key,
    label,
    icon: extras.icon || 'fa-gear',
    isNew: Boolean(extras.isNew),
    description: extras.description || `إدارة ${label} وتشغيلها مباشرة داخل النظام.`,
    fields: extras.fields || nameFields,
    seeds: extras.seeds || [
      { code: `${key.toUpperCase().slice(0, 4)}-01`, name: `${label} أساسي`, status: 'نشط', notes: 'سجل تشغيلي جاهز' },
      { code: `${key.toUpperCase().slice(0, 4)}-02`, name: `${label} إضافي`, status: 'نشط', notes: 'سجل احتياطي' }
    ]
  };
}

function namedSeeds(prefix, names, extra = {}) {
  return names.map((entry, index) => {
    const name = Array.isArray(entry) ? entry[0] : entry;
    const category = Array.isArray(entry) ? entry[1] : extra.category;
    return {
      code: `${prefix}-${String(index + 1).padStart(3, '0')}`,
      name,
      category,
      status: 'نشط',
      notes: extra.notes || 'مكون تشغيلي جاهز للاستخدام'
    };
  });
}

const CATEGORY_FIELD = field('category', 'التصنيف');
const COMPONENT_FIELDS = [
  field('code', 'الرمز'),
  field('name', 'الاسم'),
  field('category', 'التصنيف'),
  field('status', 'الحالة', 'select', { options: STATUS_OPTIONS }),
  field('notes', 'ملاحظات', 'textarea', { required: false })
];
const RULE_FIELDS = [
  field('code', 'الرمز'),
  field('name', 'الاسم'),
  field('value', 'القيمة'),
  field('unit', 'الوحدة', { required: false }),
  field('status', 'الحالة', 'select', { options: STATUS_OPTIONS }),
  field('notes', 'ملاحظات', 'textarea', { required: false })
];

const CATALOG = [
  {
    key: 'general',
    title: 'اعدادات عامة',
    items: [
      item('users', 'المستخدمين', {
        icon: 'fa-users',
        fields: [
          field('code', 'رمز المستخدم'),
          field('name', 'الاسم الكامل'),
          field('email', 'البريد الإلكتروني'),
          field('role', 'الدور', 'select', {
            options: [
              { value: 'موظف', label: 'موظف' },
              { value: 'مدير مباشر', label: 'مدير مباشر' },
              { value: 'موارد بشرية', label: 'موارد بشرية' },
              { value: 'مدير نظام', label: 'مدير نظام' }
            ]
          }),
          field('department', 'القسم'),
          field('status', 'الحالة', 'select', { options: STATUS_OPTIONS })
        ],
        seeds: [
          { code: 'USR-001', name: 'أحمد العلي', email: 'ahmed@nayosh.com', role: 'مدير نظام', department: 'الإدارة', status: 'نشط' },
          { code: 'USR-002', name: 'نورة السالم', email: 'noura@nayosh.com', role: 'موارد بشرية', department: 'الموارد البشرية', status: 'نشط' },
          { code: 'USR-003', name: 'خالد الدوسري', email: 'khaled@nayosh.com', role: 'مدير مباشر', department: 'العمليات', status: 'نشط' },
          { code: 'USR-004', name: 'سارة محمد', email: 'sara@nayosh.com', role: 'موظف', department: 'المالية', status: 'نشط' }
        ]
      }),
      item('external-integrations', 'الربط مع الانظمة الخارجية', {
        icon: 'fa-plug',
        fields: [
          field('code', 'رمز الربط'),
          field('name', 'اسم النظام'),
          field('type', 'نوع الربط', 'select', {
            options: [
              { value: 'SSO', label: 'SSO' },
              { value: 'API', label: 'API' },
              { value: 'ويب هوك', label: 'ويب هوك' },
              { value: 'ملف', label: 'ملف' }
            ]
          }),
          field('endpoint', 'رابط الخدمة'),
          field('status', 'الحالة', 'select', { options: STATUS_OPTIONS }),
          field('notes', 'ملاحظات', 'textarea', { required: false })
        ],
        seeds: [
          { code: 'INT-GOSI', name: 'التأمينات الاجتماعية', type: 'API', endpoint: 'https://api.gosi.gov.sa', status: 'نشط' },
          { code: 'INT-MUD', name: 'منصة مدد', type: 'API', endpoint: 'https://api.mudad.sa', status: 'نشط' },
          { code: 'INT-MAIL', name: 'البريد المؤسسي', type: 'SSO', endpoint: 'https://mail.nayosh.com', status: 'نشط' }
        ]
      }),
      item('templates', 'القوالب', {
        icon: 'fa-copy',
        fields: [
          field('code', 'رمز القالب'),
          field('name', 'اسم القالب'),
          field('category', 'التصنيف'),
          field('format', 'الصيغة', 'select', {
            options: [
              { value: 'PDF', label: 'PDF' },
              { value: 'DOCX', label: 'DOCX' },
              { value: 'HTML', label: 'HTML' }
            ]
          }),
          field('status', 'الحالة', 'select', { options: STATUS_OPTIONS })
        ],
        seeds: [
          { code: 'TPL-LEAVE', name: 'قالب طلب إجازة', category: 'طلبات', format: 'PDF', status: 'نشط' },
          { code: 'TPL-ADV', name: 'قالب طلب سلفة', category: 'طلبات', format: 'PDF', status: 'نشط' },
          { code: 'TPL-OFFER', name: 'قالب عرض وظيفي', category: 'توظيف', format: 'DOCX', status: 'نشط' }
        ]
      }),
      item('forms', 'النماذج', {
        icon: 'fa-wpforms',
        fields: [
          field('code', 'رمز النموذج'),
          field('name', 'اسم النموذج'),
          field('owner', 'الجهة المالكة'),
          field('requires_approval', 'يحتاج موافقة مدير', 'select', { options: YES_NO }),
          field('status', 'الحالة', 'select', { options: STATUS_OPTIONS })
        ],
        seeds: [
          { code: 'FRM-LEAVE', name: 'نموذج إجازة', owner: 'الموارد البشرية', requires_approval: 'نعم', status: 'نشط' },
          { code: 'FRM-LOAN', name: 'نموذج سلفة', owner: 'المالية', requires_approval: 'نعم', status: 'نشط' },
          { code: 'FRM-LETTER', name: 'نموذج خطاب', owner: 'الشؤون الإدارية', requires_approval: 'نعم', status: 'نشط' }
        ]
      }),
      item('employee-export-templates', 'قوالب تصدير الموظفين', {
        icon: 'fa-file-export',
        seeds: [
          { code: 'EXP-FULL', name: 'تصدير شامل للموظفين', status: 'نشط', notes: 'يشمل البيانات الوظيفية والمالية' },
          { code: 'EXP-ATT', name: 'تصدير الحضور', status: 'نشط', notes: 'سجلات الحضور الشهرية' }
        ]
      }),
      item('attendance-leave-settings', 'اعدادات الحضور والاجازات', {
        icon: 'fa-clock',
        fields: [
          field('code', 'الرمز'),
          field('name', 'الإعداد'),
          field('value', 'القيمة'),
          field('unit', 'الوحدة', 'select', {
            options: [
              { value: 'دقيقة', label: 'دقيقة' },
              { value: 'ساعة', label: 'ساعة' },
              { value: 'يوم', label: 'يوم' },
              { value: 'نسبة', label: 'نسبة' }
            ]
          }),
          field('status', 'الحالة', 'select', { options: STATUS_OPTIONS })
        ],
        seeds: [
          { code: 'ATT-IN', name: 'بداية الدوام', value: '08:00', unit: 'ساعة', status: 'نشط' },
          { code: 'ATT-OUT', name: 'نهاية الدوام', value: '17:00', unit: 'ساعة', status: 'نشط' },
          { code: 'ATT-GRACE', name: 'سماح التأخير', value: '15', unit: 'دقيقة', status: 'نشط' },
          { code: 'LV-ANNUAL', name: 'رصيد الإجازة السنوية', value: '21', unit: 'يوم', status: 'نشط' }
        ]
      }),
      item('system-options', 'اعدادات النظام', {
        icon: 'fa-sliders',
        fields: [
          field('code', 'المفتاح'),
          field('name', 'الاسم'),
          field('value', 'القيمة'),
          field('status', 'الحالة', 'select', { options: STATUS_OPTIONS })
        ],
        seeds: [
          { code: 'SYS-LANG', name: 'لغة النظام', value: 'العربية', status: 'نشط' },
          { code: 'SYS-TZ', name: 'المنطقة الزمنية', value: 'Asia/Riyadh', status: 'نشط' },
          { code: 'SYS-CURRENCY', name: 'العملة الافتراضية', value: 'ر.س', status: 'نشط' },
          { code: 'SYS-APPROVAL', name: 'إرسال الطلبات للمدير مباشرة', value: 'مفعل', status: 'نشط' }
        ]
      }),
      item('system-fixed-values', 'القيم الثابتة للنظام', {
        icon: 'fa-database',
        seeds: [
          { code: 'VAL-NAT', name: 'الجنسيات المعتمدة', status: 'نشط', notes: 'سعودي، مقيم، خليجي' },
          { code: 'VAL-MARITAL', name: 'الحالة الاجتماعية', status: 'نشط', notes: 'أعزب، متزوج، أخرى' },
          { code: 'VAL-GENDER', name: 'النوع', status: 'نشط', notes: 'ذكر، أنثى' }
        ]
      }),
      item('data-upload', 'رفع البيانات', {
        icon: 'fa-cloud-arrow-up',
        fields: [
          field('code', 'رمز القالب'),
          field('name', 'اسم ملف الرفع'),
          field('entity', 'الكيان المستهدف'),
          field('status', 'الحالة', 'select', { options: STATUS_OPTIONS }),
          field('notes', 'ملاحظات', 'textarea', { required: false })
        ],
        seeds: [
          { code: 'UPL-EMP', name: 'رفع الموظفين', entity: 'الموظفون', status: 'نشط' },
          { code: 'UPL-ATT', name: 'رفع الحضور', entity: 'الحضور', status: 'نشط' },
          { code: 'UPL-PAY', name: 'رفع مسيرات الراتب', entity: 'الرواتب', status: 'نشط' }
        ]
      })
    ]
  },
  {
    key: 'organization',
    title: 'اعدادات المنشأة',
    items: [
      item('facilities', 'المنشآت', {
        icon: 'fa-building',
        fields: [
          field('code', 'رمز المنشأة'),
          field('name', 'اسم المنشأة'),
          field('city', 'المدينة'),
          field('license', 'رقم الترخيص', { required: false }),
          field('status', 'الحالة', 'select', { options: STATUS_OPTIONS })
        ],
        seeds: [
          { code: 'FAC-HQ', name: 'المكتب الرئيسي', city: 'الرياض', license: 'CR-1010001', status: 'نشط' },
          { code: 'FAC-JED', name: 'فرع جدة', city: 'جدة', license: 'CR-1010002', status: 'نشط' },
          { code: 'FAC-DMM', name: 'فرع الدمام', city: 'الدمام', license: 'CR-1010003', status: 'نشط' }
        ]
      }),
      item('departments', 'الادارات/الاقسام', {
        icon: 'fa-sitemap',
        fields: [
          field('code', 'رمز القسم'),
          field('name', 'اسم القسم'),
          field('manager', 'المدير المباشر'),
          field('facility', 'المنشأة'),
          field('status', 'الحالة', 'select', { options: STATUS_OPTIONS })
        ],
        seeds: [
          { code: 'DEP-HR', name: 'الموارد البشرية', manager: 'نورة السالم', facility: 'المكتب الرئيسي', status: 'نشط' },
          { code: 'DEP-OPS', name: 'العمليات', manager: 'خالد الدوسري', facility: 'المكتب الرئيسي', status: 'نشط' },
          { code: 'DEP-FIN', name: 'المالية', manager: 'فهد العتيبي', facility: 'المكتب الرئيسي', status: 'نشط' },
          { code: 'DEP-IT', name: 'تقنية المعلومات', manager: 'ليان الشهري', facility: 'المكتب الرئيسي', status: 'نشط' }
        ]
      }),
      item('contracts', 'العقود', {
        icon: 'fa-file-contract',
        fields: [
          field('code', 'رمز العقد'),
          field('name', 'نوع العقد'),
          field('duration_months', 'المدة بالأشهر', 'number'),
          field('probation_days', 'فترة التجربة بالأيام', 'number', { required: false }),
          field('status', 'الحالة', 'select', { options: STATUS_OPTIONS })
        ],
        seeds: [
          { code: 'CON-PERM', name: 'عقد دائم', duration_months: 12, probation_days: 90, status: 'نشط' },
          { code: 'CON-TEMP', name: 'عقد محدد المدة', duration_months: 12, probation_days: 60, status: 'نشط' },
          { code: 'CON-PT', name: 'عقد دوام جزئي', duration_months: 6, probation_days: 30, status: 'نشط' }
        ]
      }),
      item('official-holidays', 'الاجازات الرسمية', {
        icon: 'fa-calendar-days',
        fields: [
          field('code', 'الرمز'),
          field('name', 'اسم الإجازة'),
          field('start_date', 'تاريخ البداية', 'date'),
          field('end_date', 'تاريخ النهاية', 'date'),
          field('status', 'الحالة', 'select', { options: STATUS_OPTIONS })
        ],
        seeds: [
          { code: 'HOL-ND', name: 'اليوم الوطني', start_date: '2026-09-23', end_date: '2026-09-23', status: 'نشط' },
          { code: 'HOL-FD', name: 'يوم التأسيس', start_date: '2026-02-22', end_date: '2026-02-22', status: 'نشط' },
          { code: 'HOL-EIDF', name: 'إجازة عيد الفطر', start_date: '2026-03-20', end_date: '2026-03-24', status: 'نشط' }
        ]
      }),
      item('violation-types', 'انواع المخالفات', {
        icon: 'fa-triangle-exclamation',
        fields: [
          field('code', 'الرمز'),
          field('name', 'نوع المخالفة'),
          field('severity', 'الحدة', 'select', {
            options: [
              { value: 'منخفضة', label: 'منخفضة' },
              { value: 'متوسطة', label: 'متوسطة' },
              { value: 'عالية', label: 'عالية' }
            ]
          }),
          field('penalty', 'الجزاء'),
          field('status', 'الحالة', 'select', { options: STATUS_OPTIONS })
        ],
        seeds: [
          { code: 'VIO-LATE', name: 'تأخير متكرر', severity: 'متوسطة', penalty: 'إنذار كتابي', status: 'نشط' },
          { code: 'VIO-ABS', name: 'غياب بدون عذر', severity: 'عالية', penalty: 'خصم يوم', status: 'نشط' },
          { code: 'VIO-DRESS', name: 'مخالفة الزي', severity: 'منخفضة', penalty: 'تنبيه شفهي', status: 'نشط' }
        ]
      }),
      item('cost-centers', 'مراكز التكلفة', {
        icon: 'fa-coins',
        seeds: [
          { code: 'CC-100', name: 'الإدارة العامة', status: 'نشط' },
          { code: 'CC-200', name: 'العمليات', status: 'نشط' },
          { code: 'CC-300', name: 'المبيعات', status: 'نشط' }
        ]
      }),
      item('locations', 'المواقع', {
        icon: 'fa-location-dot',
        fields: [
          field('code', 'رمز الموقع'),
          field('name', 'اسم الموقع'),
          field('city', 'المدينة'),
          field('address', 'العنوان', { required: false }),
          field('status', 'الحالة', 'select', { options: STATUS_OPTIONS })
        ],
        seeds: [
          { code: 'LOC-HQ', name: 'برج الإدارة', city: 'الرياض', address: 'طريق الملك فهد', status: 'نشط' },
          { code: 'LOC-WH', name: 'المستودع الرئيسي', city: 'الخرج', address: 'المنطقة الصناعية', status: 'نشط' }
        ]
      }),
      item('document-types', 'انواع الوثائق', {
        icon: 'fa-id-card',
        seeds: [
          { code: 'DOC-ID', name: 'هوية وطنية', status: 'نشط' },
          { code: 'DOC-IQAMA', name: 'إقامة', status: 'نشط' },
          { code: 'DOC-PASS', name: 'جواز سفر', status: 'نشط' },
          { code: 'DOC-IBAN', name: 'آيبان بنكي', status: 'نشط' }
        ]
      })
    ]
  },
  {
    key: 'salary',
    title: 'اعدادات الراتب',
    items: [
      item('allowances', 'البدلات', {
        icon: 'fa-hand-holding-dollar',
        fields: [
          field('code', 'الرمز'),
          field('name', 'اسم البدل'),
          field('amount', 'القيمة', 'number'),
          field('calc_type', 'طريقة الاحتساب', 'select', {
            options: [
              { value: 'ثابت', label: 'ثابت' },
              { value: 'نسبة من الأساسي', label: 'نسبة من الأساسي' }
            ]
          }),
          field('status', 'الحالة', 'select', { options: STATUS_OPTIONS })
        ],
        seeds: [
          { code: 'ALW-HSE', name: 'بدل سكن', amount: 1500, calc_type: 'ثابت', status: 'نشط' },
          { code: 'ALW-TRN', name: 'بدل مواصلات', amount: 800, calc_type: 'ثابت', status: 'نشط' },
          { code: 'ALW-NAT', name: 'بدل طبيعة عمل', amount: 10, calc_type: 'نسبة من الأساسي', status: 'نشط' }
        ]
      }),
      item('deduction-addition-types', 'انواع الحسم/الاضافة', {
        icon: 'fa-plus-minus',
        seeds: [
          { code: 'DAD-ABS', name: 'خصم غياب', status: 'نشط' },
          { code: 'DAD-OT', name: 'إضافة عمل إضافي', status: 'نشط' },
          { code: 'DAD-BONUS', name: 'مكافأة أداء', status: 'نشط' }
        ]
      }),
      item('payroll-types', 'انواع الرواتب', {
        icon: 'fa-wallet',
        seeds: [
          { code: 'PAY-MONTH', name: 'راتب شهري', status: 'نشط' },
          { code: 'PAY-WEEK', name: 'راتب أسبوعي', status: 'نشط' },
          { code: 'PAY-SHIFT', name: 'راتب مناوبات', status: 'نشط' }
        ]
      }),
      item('payroll-templates', 'قوالب الرواتب', {
        icon: 'fa-table',
        seeds: [
          { code: 'PT-STD', name: 'قالب الراتب القياسي', status: 'نشط', notes: 'أساسي + سكن + مواصلات' },
          { code: 'PT-SALES', name: 'قالب المبيعات', status: 'نشط', notes: 'أساسي + عمولة' }
        ]
      }),
      item('banks', 'البنوك', {
        icon: 'fa-building-columns',
        fields: [
          field('code', 'الرمز'),
          field('name', 'اسم البنك'),
          field('swift', 'سويفت', { required: false }),
          field('status', 'الحالة', 'select', { options: STATUS_OPTIONS })
        ],
        seeds: [
          { code: 'BNK-RJHI', name: 'مصرف الراجحي', swift: 'RJHISARI', status: 'نشط' },
          { code: 'BNK-SNB', name: 'البنك الأهلي السعودي', swift: 'NCBKSAJE', status: 'نشط' },
          { code: 'BNK-RIBL', name: 'بنك الرياض', swift: 'RIBLSARI', status: 'نشط' }
        ]
      }),
      item('salary-sources', 'مصادر الراتب', {
        icon: 'fa-piggy-bank',
        seeds: [
          { code: 'SRC-HQ', name: 'ميزانية الإدارة العامة', status: 'نشط' },
          { code: 'SRC-PROJ', name: 'ميزانية المشاريع', status: 'نشط' }
        ]
      }),
      item('expense-types', 'انواع المصروفات', {
        icon: 'fa-receipt',
        seeds: [
          { code: 'EXP-TRAVEL', name: 'سفر وانتداب', status: 'نشط' },
          { code: 'EXP-TRAIN', name: 'تدريب', status: 'نشط' },
          { code: 'EXP-MED', name: 'طبي', status: 'نشط' }
        ]
      }),
      item('currencies', 'العملات', {
        icon: 'fa-coins',
        fields: [
          field('code', 'الرمز'),
          field('name', 'العملة'),
          field('rate', 'سعر التحويل', 'number'),
          field('status', 'الحالة', 'select', { options: STATUS_OPTIONS })
        ],
        seeds: [
          { code: 'SAR', name: 'ريال سعودي', rate: 1, status: 'نشط' },
          { code: 'USD', name: 'دولار أمريكي', rate: 3.75, status: 'نشط' },
          { code: 'EUR', name: 'يورو', rate: 4.1, status: 'نشط' }
        ]
      })
    ]
  },
  {
    key: 'job',
    title: 'اعدادات الوظيفة',
    items: [
      item('leave-types', 'انواع الاجازات', {
        icon: 'fa-umbrella-beach',
        fields: [
          field('code', 'الرمز'),
          field('name', 'نوع الإجازة'),
          field('days', 'الرصيد السنوي', 'number'),
          field('paid', 'مدفوعة', 'select', { options: YES_NO }),
          field('requires_approval', 'تحتاج موافقة مدير', 'select', { options: YES_NO }),
          field('status', 'الحالة', 'select', { options: STATUS_OPTIONS })
        ],
        seeds: [
          { code: 'LV-ANNUAL', name: 'سنوية', days: 21, paid: 'نعم', requires_approval: 'نعم', status: 'نشط' },
          { code: 'LV-SICK', name: 'مرضية', days: 30, paid: 'نعم', requires_approval: 'نعم', status: 'نشط' },
          { code: 'LV-EMERG', name: 'اضطرارية', days: 5, paid: 'نعم', requires_approval: 'نعم', status: 'نشط' },
          { code: 'LV-UNPAID', name: 'بدون راتب', days: 15, paid: 'لا', requires_approval: 'نعم', status: 'نشط' }
        ]
      }),
      item('exception-types', 'انواع الاستثناءات', {
        icon: 'fa-bolt',
        seeds: [
          { code: 'EXC-PERM', name: 'استئذان خروج', status: 'نشط', notes: 'يُرسل للمدير مباشرة' },
          { code: 'EXC-REMOTE', name: 'عمل عن بعد', status: 'نشط', notes: 'يُرسل للمدير مباشرة' },
          { code: 'EXC-SHIFT', name: 'تبديل وردية', status: 'نشط', notes: 'يُرسل للمدير مباشرة' }
        ]
      }),
      item('job-titles', 'المسميات الوظيفية', {
        icon: 'fa-user-tie',
        seeds: [
          { code: 'JT-ACC', name: 'محاسب', status: 'نشط' },
          { code: 'JT-HRBP', name: 'شريك موارد بشرية', status: 'نشط' },
          { code: 'JT-OPS', name: 'أخصائي عمليات', status: 'نشط' },
          { code: 'JT-DEV', name: 'مطور برمجيات', status: 'نشط' }
        ]
      }),
      item('job-ranks', 'الرتب الوظيفية', {
        icon: 'fa-ranking-star',
        seeds: [
          { code: 'RK-1', name: 'المستوى الأول', status: 'نشط' },
          { code: 'RK-2', name: 'المستوى الثاني', status: 'نشط' },
          { code: 'RK-3', name: 'المستوى الثالث', status: 'نشط' }
        ]
      }),
      item('job-grades', 'الدرجات الوظيفية', {
        icon: 'fa-layer-group',
        seeds: [
          { code: 'GR-A', name: 'درجة A', status: 'نشط' },
          { code: 'GR-B', name: 'درجة B', status: 'نشط' },
          { code: 'GR-C', name: 'درجة C', status: 'نشط' }
        ]
      }),
      item('skill-settings', 'اعدادات المهارات', {
        icon: 'fa-lightbulb',
        seeds: [
          { code: 'SK-LEAD', name: 'القيادة', status: 'نشط' },
          { code: 'SK-COMM', name: 'التواصل', status: 'نشط' },
          { code: 'SK-ANAL', name: 'التحليل', status: 'نشط' }
        ]
      }),
      item('secondment-settings', 'اعدادات الانتداب', {
        icon: 'fa-plane',
        fields: [
          field('code', 'الرمز'),
          field('name', 'نوع الانتداب'),
          field('daily_rate', 'بدل اليوم', 'number'),
          field('requires_approval', 'يحتاج موافقة مدير', 'select', { options: YES_NO }),
          field('status', 'الحالة', 'select', { options: STATUS_OPTIONS })
        ],
        seeds: [
          { code: 'SEC-IN', name: 'انتداب داخلي', daily_rate: 300, requires_approval: 'نعم', status: 'نشط' },
          { code: 'SEC-OUT', name: 'انتداب خارجي', daily_rate: 800, requires_approval: 'نعم', status: 'نشط' }
        ]
      }),
      item('allowance-types', 'انواع البدلات', {
        icon: 'fa-gift',
        seeds: [
          { code: 'AT-HSE', name: 'بدل سكن', status: 'نشط' },
          { code: 'AT-TRN', name: 'بدل نقل', status: 'نشط' },
          { code: 'AT-PHONE', name: 'بدل هاتف', status: 'نشط' }
        ]
      }),
      item('work-periods', 'فترات العمل', {
        icon: 'fa-business-time',
        fields: [
          field('code', 'الرمز'),
          field('name', 'اسم الفترة'),
          field('start_time', 'من'),
          field('end_time', 'إلى'),
          field('status', 'الحالة', 'select', { options: STATUS_OPTIONS })
        ],
        seeds: [
          { code: 'WP-MORN', name: 'الفترة الصباحية', start_time: '08:00', end_time: '16:00', status: 'نشط' },
          { code: 'WP-EVE', name: 'الفترة المسائية', start_time: '16:00', end_time: '00:00', status: 'نشط' },
          { code: 'WP-FLEX', name: 'دوام مرن', start_time: '07:00', end_time: '18:00', status: 'نشط' }
        ]
      }),
      item('employee-fields', 'حقول الموظف', {
        icon: 'fa-input-text',
        isNew: true,
        fields: [
          field('code', 'مفتاح الحقل'),
          field('name', 'اسم الحقل'),
          field('field_type', 'النوع', 'select', {
            options: [
              { value: 'نص', label: 'نص' },
              { value: 'رقم', label: 'رقم' },
              { value: 'تاريخ', label: 'تاريخ' },
              { value: 'قائمة', label: 'قائمة' }
            ]
          }),
          field('required', 'إلزامي', 'select', { options: YES_NO }),
          field('status', 'الحالة', 'select', { options: STATUS_OPTIONS })
        ],
        seeds: [
          { code: 'EF-IBAN', name: 'رقم الآيبان', field_type: 'نص', required: 'نعم', status: 'نشط' },
          { code: 'EF-NATIONALITY', name: 'الجنسية', field_type: 'قائمة', required: 'نعم', status: 'نشط' },
          { code: 'EF-JOIN', name: 'تاريخ الالتحاق', field_type: 'تاريخ', required: 'نعم', status: 'نشط' }
        ]
      })
    ]
  },
  {
    key: 'custody',
    title: 'إعدادات العهد',
    items: [
      item('asset-types', 'انواع العهد', {
        icon: 'fa-box',
        seeds: [
          { code: 'AST-LAP', name: 'جهاز محمول', status: 'نشط' },
          { code: 'AST-PHONE', name: 'جوال عمل', status: 'نشط' },
          { code: 'AST-CAR', name: 'سيارة عهدة', status: 'نشط' }
        ]
      }),
      item('brands', 'الماركات', {
        icon: 'fa-tags',
        seeds: [
          { code: 'BR-DEL', name: 'Dell', status: 'نشط' },
          { code: 'BR-HP', name: 'HP', status: 'نشط' },
          { code: 'BR-APP', name: 'Apple', status: 'نشط' }
        ]
      }),
      item('models', 'الموديلات', {
        icon: 'fa-mobile-screen',
        fields: [
          field('code', 'الرمز'),
          field('name', 'الموديل'),
          field('brand', 'الماركة'),
          field('status', 'الحالة', 'select', { options: STATUS_OPTIONS })
        ],
        seeds: [
          { code: 'MD-LAT', name: 'Latitude 5540', brand: 'Dell', status: 'نشط' },
          { code: 'MD-ELITE', name: 'EliteBook 840', brand: 'HP', status: 'نشط' },
          { code: 'MD-MBP', name: 'MacBook Pro 14', brand: 'Apple', status: 'نشط' }
        ]
      })
    ]
  },
  {
    key: 'workflow',
    title: 'إجراءات سير العمل',
    items: [
      item('workflow-types', 'انواع سير العمل', {
        icon: 'fa-diagram-project',
        fields: [
          field('code', 'الرمز'),
          field('name', 'اسم المسار'),
          field('first_stage', 'أول مرحلة'),
          field('stages', 'المراحل'),
          field('status', 'الحالة', 'select', { options: STATUS_OPTIONS })
        ],
        seeds: [
          { code: 'WF-LEAVE', name: 'مسار الإجازات', first_stage: 'المدير المباشر', stages: 'مدير → موارد بشرية', status: 'نشط' },
          { code: 'WF-ADV', name: 'مسار السلف', first_stage: 'المدير المباشر', stages: 'مدير → موارد بشرية → مالية', status: 'نشط' },
          { code: 'WF-GEN', name: 'مسار الطلبات العامة', first_stage: 'المدير المباشر', stages: 'مدير → موارد بشرية', status: 'نشط' }
        ]
      }),
      item('workflow-service-links', 'ربط الخدمات بسير العمل', {
        icon: 'fa-link',
        fields: [
          field('code', 'الرمز'),
          field('name', 'الخدمة'),
          field('workflow', 'مسار العمل'),
          field('status', 'الحالة', 'select', { options: STATUS_OPTIONS })
        ],
        seeds: [
          { code: 'LNK-LEAVE', name: 'طلب إجازة', workflow: 'مسار الإجازات', status: 'نشط' },
          { code: 'LNK-ADV', name: 'طلب سلفة', workflow: 'مسار السلف', status: 'نشط' },
          { code: 'LNK-LETTER', name: 'طلب خطاب', workflow: 'مسار الطلبات العامة', status: 'نشط' }
        ]
      }),
      item('workflow-states', 'حالات سير العمل', {
        icon: 'fa-flag',
        seeds: [
          { code: 'ST-MGR', name: 'بانتظار المدير المباشر', status: 'نشط' },
          { code: 'ST-HR', name: 'بانتظار الموارد البشرية', status: 'نشط' },
          { code: 'ST-OK', name: 'مكتمل', status: 'نشط' },
          { code: 'ST-REJ', name: 'مرفوض', status: 'نشط' }
        ]
      }),
      item('workflow-order', 'ترتيب سير العمل', {
        icon: 'fa-list-ol',
        fields: [
          field('code', 'الرمز'),
          field('name', 'المرحلة'),
          field('sort_order', 'الترتيب', 'number'),
          field('role', 'الدور المسؤول'),
          field('status', 'الحالة', 'select', { options: STATUS_OPTIONS })
        ],
        seeds: [
          { code: 'ORD-1', name: 'المدير المباشر', sort_order: 1, role: 'مدير', status: 'نشط' },
          { code: 'ORD-2', name: 'الموارد البشرية', sort_order: 2, role: 'موارد بشرية', status: 'نشط' },
          { code: 'ORD-3', name: 'المالية', sort_order: 3, role: 'مالية', status: 'نشط' }
        ]
      })
    ]
  },
  {
    key: 'recruitment',
    title: 'اعدادات التوظيف',
    items: [
      item('interview-templates', 'قوالب تقييم المقابلة الشخصية', {
        icon: 'fa-clipboard-list',
        seeds: [
          { code: 'INT-GEN', name: 'مقابلة عامة', status: 'نشط', notes: 'مهارات تواصل وثقافة مؤسسية' },
          { code: 'INT-TECH', name: 'مقابلة تقنية', status: 'نشط', notes: 'مهارات تخصصية' }
        ]
      }),
      item('interview-elements', 'عناصر تقييم المقابلة الشخصية', {
        icon: 'fa-list-check',
        fields: [
          field('code', 'الرمز'),
          field('name', 'عنصر التقييم'),
          field('weight', 'الوزن', 'number'),
          field('status', 'الحالة', 'select', { options: STATUS_OPTIONS })
        ],
        seeds: [
          { code: 'IE-COMM', name: 'التواصل', weight: 20, status: 'نشط' },
          { code: 'IE-EXP', name: 'الخبرة', weight: 30, status: 'نشط' },
          { code: 'IE-FIT', name: 'التوافق الثقافي', weight: 20, status: 'نشط' },
          { code: 'IE-SKILL', name: 'المهارة الفنية', weight: 30, status: 'نشط' }
        ]
      })
    ]
  },
  {
    key: 'other',
    title: 'أخرى',
    items: [
      item('notification-center', 'مركز الاشعارات', {
        icon: 'fa-bell',
        fields: [
          field('code', 'الرمز'),
          field('name', 'نوع الإشعار'),
          field('channel', 'القناة', 'select', {
            options: [
              { value: 'النظام', label: 'النظام' },
              { value: 'بريد', label: 'بريد' },
              { value: 'رسائل', label: 'رسائل' }
            ]
          }),
          field('status', 'الحالة', 'select', { options: STATUS_OPTIONS })
        ],
        seeds: [
          { code: 'NT-REQ', name: 'طلب جديد للمدير', channel: 'النظام', status: 'نشط' },
          { code: 'NT-DEC', name: 'قرار اعتماد/رفض', channel: 'بريد', status: 'نشط' },
          { code: 'NT-PAY', name: 'مسير راتب جاهز', channel: 'النظام', status: 'نشط' }
        ]
      }),
      item('letter-types', 'انواع الخطابات', {
        icon: 'fa-envelope-open-text',
        seeds: [
          { code: 'LT-SALARY', name: 'تعريف راتب', status: 'نشط', notes: 'يحتاج موافقة المدير' },
          { code: 'LT-TOWHOM', name: 'إلى من يهمه الأمر', status: 'نشط', notes: 'يحتاج موافقة المدير' },
          { code: 'LT-EXP', name: 'خطاب خبرة', status: 'نشط', notes: 'يحتاج موافقة المدير' }
        ]
      }),
      item('self-services', 'الخدمات الذاتية', {
        icon: 'fa-user-gear',
        fields: [
          field('code', 'الرمز'),
          field('name', 'الخدمة'),
          field('route_to_manager', 'تحويل للمدير مباشرة', 'select', { options: YES_NO }),
          field('status', 'الحالة', 'select', { options: STATUS_OPTIONS })
        ],
        seeds: [
          { code: 'SS-LEAVE', name: 'طلب إجازة', route_to_manager: 'نعم', status: 'نشط' },
          { code: 'SS-ADV', name: 'طلب سلفة', route_to_manager: 'نعم', status: 'نشط' },
          { code: 'SS-LETTER', name: 'طلب خطاب', route_to_manager: 'نعم', status: 'نشط' },
          { code: 'SS-INFO', name: 'تحديث بيانات', route_to_manager: 'نعم', status: 'نشط' }
        ]
      }),
      item('permission-management', 'ادارة الصلاحيات', {
        icon: 'fa-user-shield',
        fields: [
          field('code', 'الرمز'),
          field('name', 'الدور'),
          field('scope', 'النطاق'),
          field('status', 'الحالة', 'select', { options: STATUS_OPTIONS })
        ],
        seeds: [
          { code: 'PERM-EMP', name: 'موظف', scope: 'طلباته وملفه', status: 'نشط' },
          { code: 'PERM-MGR', name: 'مدير مباشر', scope: 'اعتماد طلبات فريقه', status: 'نشط' },
          { code: 'PERM-HR', name: 'موارد بشرية', scope: 'كل الوحدات التشغيلية', status: 'نشط' }
        ]
      }),
      item('announcements', 'الاعلانات', {
        icon: 'fa-bullhorn',
        fields: [
          field('code', 'الرمز'),
          field('name', 'عنوان الإعلان'),
          field('audience', 'الجمهور'),
          field('status', 'الحالة', 'select', { options: STATUS_OPTIONS }),
          field('notes', 'المحتوى', 'textarea', { required: false })
        ],
        seeds: [
          { code: 'ANN-RAM', name: 'تحديث ساعات رمضان', audience: 'كل الموظفين', status: 'نشط', notes: 'الدوام من 10 صباحاً حتى 3 عصراً' },
          { code: 'ANN-PAY', name: 'صرف الرواتب', audience: 'كل الموظفين', status: 'نشط', notes: 'سيتم الصرف يوم 27' }
        ]
      }),
      item('tags', 'الوسوم', {
        icon: 'fa-tags',
        seeds: [
          { code: 'TAG-URG', name: 'عاجل', status: 'نشط' },
          { code: 'TAG-CONF', name: 'سري', status: 'نشط' },
          { code: 'TAG-HR', name: 'موارد بشرية', status: 'نشط' }
        ]
      })
    ]
  },
  {
    key: 'control-board',
    title: 'لوحة الإعدادات',
    items: [
      item('numbering-systems', 'أنظمة الترقيم', {
        icon: 'fa-hashtag',
        fields: [
          field('code', 'الرمز'),
          field('name', 'اسم الترقيم'),
          field('prefix', 'البادئة'),
          field('next_number', 'الرقم التالي', 'number'),
          field('status', 'الحالة', 'select', { options: STATUS_OPTIONS })
        ],
        seeds: [
          { code: 'NUM-EMP', name: 'ترقيم الموظفين', prefix: 'EMP', next_number: 1201, status: 'نشط' },
          { code: 'NUM-REQ', name: 'ترقيم الطلبات', prefix: 'REQ', next_number: 5401, status: 'نشط' },
          { code: 'NUM-PAY', name: 'ترقيم المسيرات', prefix: 'PAY', next_number: 2608, status: 'نشط' }
        ]
      }),
      item('field-templates', 'قوالب الحقول', {
        icon: 'fa-table-cells',
        isNew: true,
        fields: [
          field('code', 'الرمز'),
          field('name', 'اسم القالب'),
          field('applies_to', 'يطبق على'),
          field('status', 'الحالة', 'select', { options: STATUS_OPTIONS })
        ],
        seeds: [
          { code: 'FT-EMP', name: 'حقول ملف الموظف', applies_to: 'الموظف', status: 'نشط' },
          { code: 'FT-REQ', name: 'حقول الطلبات', applies_to: 'الطلبات', status: 'نشط' }
        ]
      }),
      item('action-types', 'أنواع الإجراءات', {
        icon: 'fa-list-ul',
        seeds: namedSeeds('ACT', ['اعتماد', 'رفض', 'إرجاع للتعديل', 'تحويل لمدير آخر', 'إغلاق'])
      }),
      item('transaction-statuses', 'حالات المعاملات', {
        icon: 'fa-tags',
        seeds: namedSeeds('TRX', ['مسودة', 'بانتظار المدير', 'بانتظار الموارد البشرية', 'مكتمل', 'مرفوض'])
      }),
      item('request-settings', 'إعدادات الطلبات', {
        icon: 'fa-sliders',
        fields: RULE_FIELDS,
        seeds: [
          { code: 'RS-MGR', name: 'تمرير كل الطلبات للمدير أولاً', value: 'مفعل', unit: 'قاعدة', status: 'نشط' },
          { code: 'RS-ATT', name: 'إرفاق ملف مع الطلب', value: 'اختياري', unit: 'قاعدة', status: 'نشط' }
        ]
      }),
      item('task-statuses', 'حالات المهام', {
        icon: 'fa-clipboard-check',
        seeds: namedSeeds('TSK', ['جديدة', 'جارية', 'متأخرة', 'مكتملة', 'ملغاة'])
      }),
      item('barcode-templates', 'قوالب الباركود', {
        icon: 'fa-barcode',
        seeds: [
          { code: 'BC-EMP', name: 'باركود بطاقة الموظف', status: 'نشط' },
          { code: 'BC-AST', name: 'باركود العهدة', status: 'نشط' }
        ]
      }),
      item('email-templates', 'قوالب البريد الإلكتروني', {
        icon: 'fa-at',
        seeds: namedSeeds('EML', ['بريد الطلبات', 'بريد القرارات', 'رسالة بريد بسيطة', 'رسالة إنشاء مستخدم'])
      }),
      item('sms-templates', 'قوالب الرسائل النصية', {
        icon: 'fa-comment-dots',
        seeds: namedSeeds('SMS', ['تأكيد طلب', 'اعتماد مدير', 'تنبيه حضور'])
      }),
      item('print-templates', 'قوالب الطباعة', {
        icon: 'fa-print',
        seeds: namedSeeds('PRT', ['ترويسة الورق الرسمي', 'تذييل الورق الرسمي', 'قسيمة راتب', 'تعريف بالراتب'])
      }),
      item('backups', 'النسخ الاحتياطي', {
        icon: 'fa-database',
        fields: [
          field('code', 'الرمز'),
          field('name', 'اسم النسخة'),
          field('schedule', 'الجدولة'),
          field('status', 'الحالة', 'select', { options: STATUS_OPTIONS })
        ],
        seeds: [
          { code: 'BK-DAY', name: 'نسخ يومي', schedule: 'كل يوم 01:00', status: 'نشط' },
          { code: 'BK-WEEK', name: 'نسخ أسبوعي', schedule: 'الجمعة 02:00', status: 'نشط' }
        ]
      }),
      item('general-settings', 'الإعدادات العامة', {
        icon: 'fa-gears',
        fields: RULE_FIELDS,
        seeds: [
          { code: 'GS-LANG', name: 'لغة الواجهة', value: 'العربية', unit: 'لغة', status: 'نشط' },
          { code: 'GS-CAL', name: 'تقويم العمل', value: 'الأحد - الخميس', unit: 'أيام', status: 'نشط' },
          { code: 'GS-CUR', name: 'عملة الرواتب', value: 'ر.س', unit: 'عملة', status: 'نشط' }
        ]
      })
    ]
  },
  {
    key: 'operating',
    title: 'إعدادات التشغيل',
    items: [
      item('employee-settings', 'إعدادات الموظف', { icon: 'fa-id-badge', fields: RULE_FIELDS, seeds: [
        { code: 'ES-CODE', name: 'توليد رقم وظيفي تلقائي', value: 'مفعل', unit: 'قاعدة', status: 'نشط' },
        { code: 'ES-PROB', name: 'فترة التجربة الافتراضية', value: '90', unit: 'يوم', status: 'نشط' }
      ]}),
      item('payroll-run-settings', 'إعدادات مسير الرواتب', { icon: 'fa-file-invoice-dollar', fields: RULE_FIELDS, seeds: [
        { code: 'PR-DAY', name: 'يوم صرف الراتب', value: '27', unit: 'يوم', status: 'نشط' },
        { code: 'PR-GOSI', name: 'احتساب التأمينات تلقائياً', value: 'مفعل', unit: 'قاعدة', status: 'نشط' }
      ]}),
      item('self-service-settings', 'إعدادات الخدمات الذاتية', { icon: 'fa-mobile-screen', fields: RULE_FIELDS, seeds: [
        { code: 'SS-OPEN', name: 'تفعيل بوابة الموظف', value: 'مفعل', unit: 'قاعدة', status: 'نشط' },
        { code: 'SS-MGR', name: 'كل طلب موظف يذهب للمدير', value: 'مفعل', unit: 'قاعدة', status: 'نشط' }
      ]}),
      item('advance-settings', 'إعدادات السلف/الذمم', { icon: 'fa-sack-dollar', fields: RULE_FIELDS, seeds: [
        { code: 'AD-MAX', name: 'الحد الأقصى للسلفة', value: '3', unit: 'رواتب', status: 'نشط' },
        { code: 'AD-INST', name: 'عدد الأقساط الافتراضي', value: '6', unit: 'قسط', status: 'نشط' }
      ]}),
      item('email-settings', 'إعدادات البريد الإلكتروني', { icon: 'fa-envelope-circle-check', fields: RULE_FIELDS, seeds: [
        { code: 'MAIL-HOST', name: 'خادم البريد', value: 'mail.nayosh.com', unit: 'SMTP', status: 'نشط' },
        { code: 'MAIL-FROM', name: 'اسم المرسل', value: 'نايوش HCM', unit: 'اسم', status: 'نشط' }
      ]}),
      item('security-settings', 'إعدادات الأمان', { icon: 'fa-shield-halved', fields: RULE_FIELDS, seeds: [
        { code: 'SEC-PWD', name: 'طول كلمة المرور', value: '8', unit: 'حرف', status: 'نشط' },
        { code: 'SEC-OTP', name: 'التحقق بخطوتين', value: 'اختياري', unit: 'قاعدة', status: 'نشط' }
      ]}),
      item('integration-settings', 'إعدادات الربط', { icon: 'fa-plug-circle-plus', fields: RULE_FIELDS, seeds: [
        { code: 'INT-GOSI', name: 'ربط التأمينات', value: 'جاهز', unit: 'API', status: 'نشط' },
        { code: 'INT-MUDAD', name: 'ربط مدد', value: 'جاهز', unit: 'API', status: 'نشط' }
      ]})
    ]
  },
  {
    key: 'attendance-ops',
    title: 'الحضور والانصراف',
    items: [
      item('overtime-settings', 'إعدادات العمل الإضافي', { icon: 'fa-clock-rotate-left', fields: RULE_FIELDS, seeds: [
        { code: 'OT-RATE', name: 'معامل اليوم العادي', value: '1.5', unit: 'ضعف', status: 'نشط' },
        { code: 'OT-WEEK', name: 'معامل يوم الراحة', value: '2', unit: 'ضعف', status: 'نشط' }
      ]}),
      item('absence-settings', 'إعدادات الغياب', { icon: 'fa-user-xmark', fields: RULE_FIELDS, seeds: [
        { code: 'ABS-DAY', name: 'خصم يوم الغياب', value: 'يوم كامل', unit: 'خصم', status: 'نشط' },
        { code: 'ABS-MGR', name: 'إشعار المدير بعد', value: '1', unit: 'يوم', status: 'نشط' }
      ]}),
      item('lateness-settings', 'إعدادات التأخير', { icon: 'fa-person-running', fields: RULE_FIELDS, seeds: [
        { code: 'LT-GRACE', name: 'سماح التأخير', value: '15', unit: 'دقيقة', status: 'نشط' },
        { code: 'LT-DED', name: 'احتساب الخصم بعد السماح', value: 'مفعل', unit: 'قاعدة', status: 'نشط' }
      ]}),
      item('early-leave-settings', 'إعدادات الانصراف المبكر', { icon: 'fa-door-open', fields: RULE_FIELDS, seeds: [
        { code: 'EL-MIN', name: 'حد الانصراف المبكر', value: '10', unit: 'دقيقة', status: 'نشط' }
      ]}),
      item('remaining-hours-settings', 'إعدادات الساعات المتبقية', { icon: 'fa-hourglass-end', fields: RULE_FIELDS, seeds: [
        { code: 'RH-WEEK', name: 'ساعات الأسبوع المطلوبة', value: '40', unit: 'ساعة', status: 'نشط' }
      ]}),
      item('remote-work-settings', 'إعدادات العمل عن بعد', { icon: 'fa-house-laptop', isNew: true, fields: RULE_FIELDS, seeds: [
        { code: 'RW-DAYS', name: 'أيام عن بعد المسموحة', value: '2', unit: 'يوم/أسبوع', status: 'نشط' }
      ]}),
      item('attendance-registration', 'تسجيل الحضور والانصراف', { icon: 'fa-fingerprint', seeds: namedSeeds('REG', ['بصمة', 'تطبيق الجوال', 'لوحة الويب', 'تكامل الجهاز']) })
    ]
  },
  {
    key: 'hr-components',
    title: 'مكونات الموارد البشرية',
    items: [
      item('fixed-system-components', 'مكونات النظام الثابتة', {
        icon: 'fa-cubes',
        isNew: true,
        fields: COMPONENT_FIELDS,
        seeds: namedSeeds('CMP', [
          ['الاسم', 'حقول'],
          ['تذاكر سفر', 'مزايا'],
          ['الإقامة', 'مزايا'],
          ['التأمين الصحي', 'مزايا'],
          ['تأمين الحياة', 'مزايا'],
          ['بدل طعام', 'بدلات'],
          ['بدل نقل', 'بدلات'],
          ['بدل تعليم', 'بدلات'],
          ['عضوية الصالة الرياضية', 'مزايا'],
          ['خطة المعاشات', 'مزايا'],
          ['بدل الهاتف', 'بدلات'],
          ['بدل ملابس', 'بدلات'],
          ['بدل السكن', 'بدلات'],
          ['مكافأة', 'تعويضات'],
          ['خيارات الأسهم', 'تعويضات'],
          ['رعاية الطفل', 'مزايا'],
          ['نفقات طبية', 'مزايا'],
          ['تغطية المعالين', 'مزايا'],
          ['التأمين ضد العجز', 'مزايا'],
          ['المساعدة القانونية', 'مزايا'],
          ['العمل من المنزل', 'سياسات'],
          ['مساعدة القروض', 'مزايا'],
          ['خطة التقاعد', 'مزايا'],
          ['إحالة الموظف', 'توظيف'],
          ['إعادة شراء الإجازة', 'إجازات'],
          ['مكافأة سنوية', 'تعويضات'],
          ['مخصص', 'رواتب'],
          ['مخالصة نهاية الخدمة', 'إنهاء خدمة'],
          ['تسوية رصيد اجازة', 'إجازات'],
          ['انتداب', 'تشغيل'],
          ['سلفة', 'ذمم'],
          ['ذمة', 'ذمم'],
          ['مخالصة إجازة', 'إجازات'],
          ['مشتريات', 'تشغيل'],
          ['تسوية سلفة', 'ذمم'],
          ['إجازة مرضية', 'إجازات'],
          ['ترويسة الخطابات', 'مراسلات'],
          ['تذييل الخطابات', 'مراسلات'],
          ['ترويسة النماذج', 'نماذج'],
          ['تذييل النماذج', 'نماذج'],
          ['نموذج تعريف بالراتب', 'نماذج'],
          ['نموذج طلب اجازة', 'نماذج'],
          ['نموذج طلب استئذان', 'نماذج'],
          ['نموذج طلب دوام إضافي', 'نماذج'],
          ['نموذج مخالصة مستحقات نهاية الخدمة', 'نماذج'],
          ['نموذج شهادة خدمة', 'نماذج'],
          ['نموذج إنذار/إشعار', 'نماذج'],
          ['نموذج مسودة العقود', 'نماذج'],
          ['نموذج قسيمة الراتب', 'نماذج'],
          ['نموذج تفويض وسيط تأمين', 'نماذج'],
          ['نموذج تفويض شركة مالية', 'نماذج'],
          ['نموذج عرض وظيفي', 'نماذج'],
          ['نموذج سلفة/ ذم', 'نماذج'],
          ['نموذج مصروف', 'نماذج'],
          ['تفاصيل نموذج التقييم', 'نماذج'],
          ['نموذج قرار تعديل الراتب', 'نماذج'],
          ['نموذج تفاصيل الطلب', 'نماذج'],
          ['نموذج مقابلة مغادرة موظف', 'نماذج'],
          ['بدل سكن', 'بدلات'],
          ['التأمينات الاجتماعية', 'رواتب'],
          ['انصراف مبكر', 'حضور'],
          ['حضور غير مكتمل', 'حضور'],
          ['تاخير', 'حضور'],
          ['غياب', 'حضور'],
          ['مكافأة نهاية الخدمة', 'إنهاء خدمة'],
          ['مبلغ الاجازة', 'رواتب'],
          ['دوام إضافي', 'حضور'],
          ['استقطاع سلفة', 'ذمم'],
          ['استقطاع ذمة', 'ذمم'],
          ['اضافات نهاية الخدمة', 'إنهاء خدمة'],
          ['حسومات نهاية الخدمة', 'إنهاء خدمة'],
          ['مخصص', 'رواتب'],
          ['مصروفات', 'رواتب'],
          ['مستحقات راتب', 'رواتب'],
          ['مخالفة أنظمة الشركة', 'جزاءات'],
          ['حسم التأمينات الإجتماعية', 'رواتب'],
          ['راتب مؤجل', 'رواتب'],
          ['عملية عكسية (اضافي)', 'رواتب'],
          ['عملية عكسية (حسم)', 'رواتب'],
          ['عملية عكسية', 'رواتب'],
          ['إجازة مرضية', 'إجازات'],
          ['خصم إجازة غير مدفوعة مؤجل من الشهر السابق', 'رواتب'],
          ['طلب إجازة', 'طلبات'],
          ['طلب تعريف بالراتب', 'طلبات'],
          ['طلب فقدان بصمة', 'طلبات'],
          ['طلب استئذان', 'طلبات'],
          ['طلب تعديل فترة العمل', 'طلبات'],
          ['طلب دوام إضافي', 'طلبات'],
          ['طلب تذاكر سفر', 'طلبات'],
          ['طلب انتداب', 'طلبات'],
          ['طلب مشتريات', 'طلبات'],
          ['طلب تعديل بيانات الموظف', 'طلبات'],
          ['طلب سلفة', 'طلبات'],
          ['طلب صرف مخصص', 'طلبات'],
          ['طلب دوام خارج المكتب', 'طلبات'],
          ['طلب دورة تدريبية', 'طلبات'],
          ['طلب انهاء العلاقة التعاقدية', 'طلبات'],
          ['طلب شكوى', 'طلبات'],
          ['طلب تثبيت الراتب', 'طلبات'],
          ['طلب تبديل يوم راحة', 'طلبات'],
          ['طلب توظيف', 'طلبات'],
          ['طلب عمل عن بعد', 'طلبات'],
          ['طلب يوم راحة', 'طلبات'],
          ['بريد الطلبات', 'مراسلات'],
          ['بريد القرارات', 'مراسلات'],
          ['رسالة بريد بسيطة', 'مراسلات'],
          ['رسالة إنشاء مستخدم', 'مراسلات'],
          ['تذييل الورق الرسمي', 'مراسلات'],
          ['ترويسة الورق الرسمي', 'مراسلات'],
          ['تعريف بالراتب', 'مراسلات'],
          ['مسودة عقد منشأة', 'مراسلات'],
          ['شهادة خدمة', 'مراسلات'],
          ['مخالصة استلام مستحقات نهاية خدمة', 'مراسلات'],
          ['إقرار استلام عهدة', 'مراسلات'],
          ['خطاب إنذار/إشعار', 'مراسلات'],
          ['مخالصة إجازة', 'مراسلات']
        ])
      }),
      item('hr-benefits', 'المزايا والتعويضات', {
        icon: 'fa-heart-pulse',
        fields: COMPONENT_FIELDS,
        seeds: namedSeeds('BEN', [
          ['تذاكر سفر', 'مزايا'], ['الإقامة', 'مزايا'], ['التأمين الصحي', 'مزايا'], ['تأمين الحياة', 'مزايا'],
          ['بدل طعام', 'بدلات'], ['بدل نقل', 'بدلات'], ['بدل تعليم', 'بدلات'], ['عضوية الصالة الرياضية', 'مزايا'],
          ['خطة المعاشات', 'مزايا'], ['بدل الهاتف', 'بدلات'], ['بدل ملابس', 'بدلات'], ['بدل السكن', 'بدلات'],
          ['مكافأة', 'تعويضات'], ['خيارات الأسهم', 'تعويضات'], ['رعاية الطفل', 'مزايا'], ['نفقات طبية', 'مزايا'],
          ['تغطية المعالين', 'مزايا'], ['التأمين ضد العجز', 'مزايا'], ['المساعدة القانونية', 'مزايا'],
          ['مساعدة القروض', 'مزايا'], ['خطة التقاعد', 'مزايا'], ['مكافأة سنوية', 'تعويضات']
        ])
      }),
      item('approved-forms', 'مكتبة النماذج المعتمدة', {
        icon: 'fa-file-lines',
        fields: COMPONENT_FIELDS,
        seeds: namedSeeds('FRM', [
          'نموذج تعريف بالراتب', 'نموذج طلب اجازة', 'نموذج طلب استئذان', 'نموذج طلب دوام إضافي',
          'نموذج مخالصة مستحقات نهاية الخدمة', 'نموذج شهادة خدمة', 'نموذج إنذار/إشعار', 'نموذج مسودة العقود',
          'نموذج قسيمة الراتب', 'نموذج تفويض وسيط تأمين', 'نموذج تفويض شركة مالية', 'نموذج عرض وظيفي',
          'نموذج سلفة/ ذم', 'نموذج مصروف', 'تفاصيل نموذج التقييم', 'نموذج قرار تعديل الراتب',
          'نموذج تفاصيل الطلب', 'نموذج مقابلة مغادرة موظف'
        ], { category: 'نماذج' })
      }),
      item('self-request-types', 'أنواع طلبات الموظف', {
        icon: 'fa-inbox',
        fields: COMPONENT_FIELDS,
        seeds: namedSeeds('REQ', [
          'طلب إجازة', 'طلب تعريف بالراتب', 'طلب فقدان بصمة', 'طلب استئذان', 'طلب تعديل فترة العمل',
          'طلب دوام إضافي', 'طلب تذاكر سفر', 'طلب انتداب', 'طلب مشتريات', 'طلب تعديل بيانات الموظف',
          'طلب سلفة', 'طلب صرف مخصص', 'طلب دوام خارج المكتب', 'طلب دورة تدريبية',
          'طلب انهاء العلاقة التعاقدية', 'طلب شكوى', 'طلب تثبيت الراتب', 'طلب تبديل يوم راحة',
          'طلب توظيف', 'طلب عمل عن بعد', 'طلب يوم راحة'
        ], { category: 'طلبات' })
      }),
      item('payroll-elements', 'بنود مسير الرواتب', {
        icon: 'fa-scale-unbalanced',
        fields: COMPONENT_FIELDS,
        seeds: namedSeeds('PEL', [
          ['بدل سكن', 'إضافة'], ['التأمينات الاجتماعية', 'حسم'], ['انصراف مبكر', 'حسم'],
          ['حضور غير مكتمل', 'حسم'], ['تاخير', 'حسم'], ['غياب', 'حسم'], ['مكافأة نهاية الخدمة', 'إضافة'],
          ['مبلغ الاجازة', 'إضافة'], ['دوام إضافي', 'إضافة'], ['استقطاع سلفة', 'حسم'], ['استقطاع ذمة', 'حسم'],
          ['اضافات نهاية الخدمة', 'إضافة'], ['حسومات نهاية الخدمة', 'حسم'], ['مصروفات', 'إضافة'],
          ['مستحقات راتب', 'إضافة'], ['مخالفة أنظمة الشركة', 'حسم'], ['حسم التأمينات الإجتماعية', 'حسم'],
          ['راتب مؤجل', 'إضافة'], ['عملية عكسية (اضافي)', 'إضافة'], ['عملية عكسية (حسم)', 'حسم']
        ])
      }),
      item('official-correspondence', 'ترويسات وتذييلات المراسلات', {
        icon: 'fa-scroll',
        fields: COMPONENT_FIELDS,
        seeds: namedSeeds('COR', [
          'ترويسة الخطابات', 'تذييل الخطابات', 'ترويسة النماذج', 'تذييل النماذج',
          'ترويسة الورق الرسمي', 'تذييل الورق الرسمي', 'بريد الطلبات', 'بريد القرارات'
        ], { category: 'مراسلات' })
      }),
      item('allocation-types', 'أنواع المخصصات', {
        icon: 'fa-layer-group',
        isNew: true,
        seeds: namedSeeds('ALC', ['مخصص إجازات', 'مخصص نهاية خدمة', 'مخصص تذاكر', 'مخصص تأمين'])
      })
    ]
  },
  {
    key: 'data-loads',
    title: 'رفع البيانات',
    items: [
      item('upload-employees', 'رفع الموظفين', { icon: 'fa-users-line', seeds: namedSeeds('UPE', ['قالب الموظفين الأساسي', 'قالب الموظفين التفصيلي']) }),
      item('upload-salaries', 'رفع الرواتب', { icon: 'fa-money-check-dollar', seeds: namedSeeds('UPS', ['قالب مسير شهري', 'قالب فروقات']) }),
      item('upload-managers', 'رفع المديرون', { icon: 'fa-user-tie', seeds: namedSeeds('UPM', ['ربط الموظف بالمدير المباشر']) }),
      item('upload-dependents', 'رفع التابعين', { icon: 'fa-children', seeds: namedSeeds('UPD', ['قالب التابعين والتأمين']) }),
      item('upload-departments', 'رفع الإدارات / الاقسام', { icon: 'fa-sitemap', seeds: namedSeeds('UPP', ['قالب الهيكل التنظيمي']) }),
      item('upload-locations', 'رفع المواقع', { icon: 'fa-map-location-dot', seeds: namedSeeds('UPL', ['قالب المواقع والفروع']) }),
      item('upload-assets', 'رفع العهد', { icon: 'fa-box-open', seeds: namedSeeds('UPA', ['قالب العهد والاستلام']) }),
      item('upload-bank-accounts', 'رفع حساب البنك', { icon: 'fa-building-columns', seeds: namedSeeds('UPB', ['قالب الآيبان والحسابات']) })
    ]
  }
];

function flattenItems() {
  const map = {};
  CATALOG.forEach((group) => {
    group.items.forEach((entry) => {
      map[entry.key] = { ...entry, groupKey: group.key, groupTitle: group.title };
    });
  });
  return map;
}

const ITEMS_BY_KEY = flattenItems();

const PUBLIC_GROUP_ORDER = [
  'control-board',
  'operating',
  'attendance-ops',
  'hr-components',
  'data-loads',
  'general',
  'organization',
  'salary',
  'job',
  'custody',
  'workflow',
  'recruitment',
  'other'
];

function getCatalogPublic() {
  const groups = CATALOG.map((group) => ({
    key: group.key,
    title: group.title,
    items: group.items.map((entry) => ({
      key: entry.key,
      label: entry.label,
      icon: entry.icon,
      isNew: entry.isNew || false,
      href: `/hr/system-settings/${entry.key}`
    }))
  }));
  return groups.sort((a, b) => {
    const ai = PUBLIC_GROUP_ORDER.indexOf(a.key);
    const bi = PUBLIC_GROUP_ORDER.indexOf(b.key);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });
}

function getItem(key) {
  return ITEMS_BY_KEY[key] || null;
}

function listItemKeys() {
  return Object.keys(ITEMS_BY_KEY);
}

module.exports = {
  CATALOG,
  ITEMS_BY_KEY,
  getCatalogPublic,
  getItem,
  listItemKeys
};
