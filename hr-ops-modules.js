'use strict';

const OPS_MODULES = {
  employee: {
    key: 'employee',
    title: 'الموظف',
    subtitle: 'ملفات الموظفين والطلبات الذاتية',
    icon: 'fa-user',
    requestType: 'تحديث بيانات',
    requestLabel: 'طلب تحديث بيانات موظف',
    href: '/hr/employees',
    fields: [
      { key: 'employee_name', label: 'اسم الموظف', type: 'text' },
      { key: 'employee_id', label: 'الرقم الوظيفي', type: 'text' },
      { key: 'department', label: 'القسم', type: 'text' },
      { key: 'title', label: 'المسمى', type: 'text' }
    ],
    seeds: [
      { name: 'ملف موظف جديد', employee_name: 'عبدالله القحطاني', employee_id: 'EMP-120', department: 'العمليات', title: 'أخصائي عمليات', status: 'نشط' }
    ]
  },
  manager: {
    key: 'manager',
    title: 'المدير',
    subtitle: 'اعتماد الطلبات ومتابعة الفريق',
    icon: 'fa-user-tie',
    href: '/hr/manager',
    requestType: null
  },
  'human-resources': {
    key: 'human-resources',
    title: 'الموارد البشرية',
    subtitle: 'تشغيل كل وحدات الموارد البشرية',
    icon: 'fa-people-group',
    href: '/hr/employees',
    requestType: 'طلب موارد بشرية',
    requestLabel: 'طلب إجراء موارد بشرية',
    fields: [
      { key: 'name', label: 'عنوان الإجراء' },
      { key: 'department', label: 'القسم' },
      { key: 'priority', label: 'الأولوية', type: 'select', options: ['عادي', 'عاجل'] }
    ],
    seeds: [
      { name: 'مراجعة ملفات التعيين', department: 'الموارد البشرية', priority: 'عاجل', status: 'نشط' },
      { name: 'تحديث سياسات الإجازات', department: 'الموارد البشرية', priority: 'عادي', status: 'نشط' }
    ]
  },
  tasks: {
    key: 'tasks',
    title: 'المهام',
    subtitle: 'توزيع ومتابعة مهام الفريق',
    icon: 'fa-list-check',
    href: '/hr/tasks-management',
    requestType: 'مهمة',
    requestLabel: 'طلب اعتماد مهمة',
    fields: [
      { key: 'name', label: 'عنوان المهمة' },
      { key: 'assignee', label: 'المكلف' },
      { key: 'due_date', label: 'تاريخ الاستحقاق', type: 'date' }
    ],
    seeds: [
      { name: 'إعداد مسير مارس', assignee: 'نورة السالم', due_date: '2026-03-25', status: 'نشط' }
    ]
  },
  decisions: {
    key: 'decisions',
    title: 'القرارات',
    subtitle: 'إصدار القرارات الإدارية واعتمادها من المدير',
    icon: 'fa-gavel',
    requestType: 'قرار',
    requestLabel: 'طلب اعتماد قرار',
    fields: [
      { key: 'code', label: 'رقم القرار' },
      { key: 'name', label: 'عنوان القرار' },
      { key: 'employee_name', label: 'الموظف المعني' },
      { key: 'decision_type', label: 'نوع القرار', type: 'select', options: ['ترقية', 'نقل', 'إنذار', 'تكليف'] }
    ],
    seeds: [
      { code: 'DEC-01', name: 'ترقية أخصائي عمليات', employee_name: 'خالد الدوسري', decision_type: 'ترقية', status: 'نشط' }
    ]
  },
  'payroll-expenses': {
    key: 'payroll-expenses',
    title: 'الرواتب والمصروفات',
    subtitle: 'تشغيل الرواتب والسلف والمصروفات',
    icon: 'fa-sack-dollar',
    href: '/hr/payroll',
    requestType: 'سلفة',
    requestLabel: 'طلب سلفة / مصروف',
    fields: [
      { key: 'name', label: 'البيان' },
      { key: 'amount', label: 'المبلغ', type: 'number' },
      { key: 'employee_name', label: 'الموظف' }
    ],
    seeds: [
      { name: 'سلفة طارئة', amount: 2500, employee_name: 'سارة محمد', status: 'نشط' }
    ]
  },
  'government-services': {
    key: 'government-services',
    title: 'الخدمات الحكومية',
    subtitle: 'تأشيرات، تجديد إقامة، معاملات حكومية',
    icon: 'fa-landmark',
    requestType: 'خدمة حكومية',
    requestLabel: 'طلب خدمة حكومية',
    fields: [
      { key: 'name', label: 'نوع المعاملة' },
      { key: 'employee_name', label: 'الموظف' },
      { key: 'agency', label: 'الجهة' }
    ],
    seeds: [
      { name: 'تجديد إقامة', employee_name: 'محمد حسن', agency: 'الجوازات', status: 'نشط' },
      { name: 'إصدار تأشيرة خروج وعودة', employee_name: 'ليان الشهري', agency: 'أبشر أعمال', status: 'نشط' }
    ]
  },
  'third-party-services': {
    key: 'third-party-services',
    title: 'خدمات الطرف الثالث',
    subtitle: 'التأمين الطبي، التوظيف الخارجي، مزودو الخدمات',
    icon: 'fa-handshake',
    isNew: true,
    requestType: 'خدمة طرف ثالث',
    requestLabel: 'طلب خدمة طرف ثالث',
    fields: [
      { key: 'name', label: 'الخدمة' },
      { key: 'provider', label: 'المزود' },
      { key: 'employee_name', label: 'المستفيد' }
    ],
    seeds: [
      { name: 'إضافة تابع للتأمين', provider: 'بوبا', employee_name: 'نورة السالم', status: 'نشط' }
    ]
  },
  'training-development': {
    key: 'training-development',
    title: 'التدريب والتطوير',
    subtitle: 'البرامج التدريبية وطلبات التطوير',
    icon: 'fa-graduation-cap',
    href: '/hr/learning',
    requestType: 'تدريب',
    requestLabel: 'طلب برنامج تدريبي',
    fields: [
      { key: 'name', label: 'اسم البرنامج' },
      { key: 'employee_name', label: 'الموظف' },
      { key: 'hours', label: 'عدد الساعات', type: 'number' }
    ],
    seeds: [
      { name: 'مهارات القيادة', employee_name: 'خالد الدوسري', hours: 16, status: 'نشط' }
    ]
  },
  circulars: {
    key: 'circulars',
    title: 'التعاميم والإشعارات',
    subtitle: 'التعاميم الداخلية وإشعارات الموظفين',
    icon: 'fa-bullhorn',
    href: '/hr/admin-circulars',
    requestType: 'تعميم',
    requestLabel: 'طلب نشر تعميم',
    fields: [
      { key: 'name', label: 'عنوان التعميم' },
      { key: 'audience', label: 'الجهة المستهدفة' }
    ],
    seeds: [
      { name: 'تنظيم الحضور في رمضان', audience: 'جميع الموظفين', status: 'نشط' }
    ]
  },
  policies: {
    key: 'policies',
    title: 'السياسات',
    subtitle: 'سياسات وإجراءات الموارد البشرية',
    icon: 'fa-scale-balanced',
    href: '/hr/policies',
    requestType: null
  },
  letters: {
    key: 'letters',
    title: 'الخطابات',
    subtitle: 'خطابات التعريف والخبرة والجهات الخارجية',
    icon: 'fa-envelope-open-text',
    requestType: 'خطاب',
    requestLabel: 'طلب خطاب',
    fields: [
      { key: 'name', label: 'نوع الخطاب' },
      { key: 'employee_name', label: 'الموظف' },
      { key: 'destination', label: 'الجهة' }
    ],
    seeds: [
      { name: 'تعريف راتب', employee_name: 'سارة محمد', destination: 'بنك الرياض', status: 'نشط' },
      { name: 'إلى من يهمه الأمر', employee_name: 'فهد العتيبي', destination: 'سفارة', status: 'نشط' }
    ]
  },
  recruitment: {
    key: 'recruitment',
    title: 'التوظيف',
    subtitle: 'طلبات التوظيف والمقابلات والعروض',
    icon: 'fa-user-plus',
    href: '/hr/new-hires',
    requestType: 'توظيف',
    requestLabel: 'طلب توظيف',
    fields: [
      { key: 'name', label: 'المسمى المطلوب' },
      { key: 'department', label: 'القسم' },
      { key: 'headcount', label: 'العدد', type: 'number' }
    ],
    seeds: [
      { name: 'محاسب رواتب', department: 'المالية', headcount: 1, status: 'نشط' }
    ]
  },
  'offers-benefits': {
    key: 'offers-benefits',
    title: 'العروض والمزايا',
    subtitle: 'العروض الوظيفية والمزايا المعتمدة',
    icon: 'fa-gift',
    isNew: true,
    requestType: 'عرض وظيفي',
    requestLabel: 'طلب اعتماد عرض / ميزة',
    fields: [
      { key: 'name', label: 'العرض أو الميزة' },
      { key: 'employee_name', label: 'المستفيد' },
      { key: 'amount', label: 'القيمة', type: 'number' }
    ],
    seeds: [
      { name: 'عرض توظيف محاسب', employee_name: 'مرشح جديد', amount: 9000, status: 'نشط' }
    ]
  },
  custody: {
    key: 'custody',
    title: 'العهد',
    subtitle: 'عهد الأجهزة والأصول لدى الموظفين',
    icon: 'fa-box-open',
    href: '/hr/assets-custodies',
    requestType: 'عهدة',
    requestLabel: 'طلب صرف عهدة',
    fields: [
      { key: 'name', label: 'الصنف' },
      { key: 'employee_name', label: 'الموظف' },
      { key: 'serial', label: 'الرقم التسلسلي' }
    ],
    seeds: [
      { name: 'جهاز محمول', employee_name: 'ليان الشهري', serial: 'NB-3341', status: 'نشط' }
    ]
  },
  surveys: {
    key: 'surveys',
    title: 'الاستبيانات',
    subtitle: 'استبيانات الرضا وقياس المشاركة',
    icon: 'fa-square-poll-vertical',
    requestType: 'استبيان',
    requestLabel: 'طلب إطلاق استبيان',
    fields: [
      { key: 'name', label: 'عنوان الاستبيان' },
      { key: 'audience', label: 'الجمهور' },
      { key: 'close_date', label: 'تاريخ الإغلاق', type: 'date' }
    ],
    seeds: [
      { name: 'رضا الموظفين Q1', audience: 'جميع الموظفين', close_date: '2026-03-31', status: 'نشط' }
    ]
  },
  reports: {
    key: 'reports',
    title: 'التقارير',
    subtitle: 'تقارير الموارد البشرية الجاهزة للتشغيل',
    icon: 'fa-chart-column',
    requestType: null,
    fields: [
      { key: 'name', label: 'اسم التقرير' },
      { key: 'period', label: 'الفترة' }
    ],
    seeds: [
      { name: 'تقرير الحضور الشهري', period: 'مارس 2026', status: 'نشط' },
      { name: 'تقرير السلف المعلقة', period: 'مارس 2026', status: 'نشط' },
      { name: 'تقرير الإجازات', period: '2026', status: 'نشط' }
    ]
  }
};

function listOpsModules() {
  return Object.values(OPS_MODULES).map((mod) => ({
    key: mod.key,
    title: mod.title,
    subtitle: mod.subtitle,
    icon: mod.icon,
    isNew: Boolean(mod.isNew),
    href: `/hr/${mod.key}`,
    canRequest: Boolean(mod.requestType)
  }));
}

function getOpsModule(key) {
  return OPS_MODULES[key] || null;
}

module.exports = {
  OPS_MODULES,
  listOpsModules,
  getOpsModule
};
