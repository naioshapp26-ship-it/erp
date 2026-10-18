'use strict';

/**
 * HR portal personas, ESS / admin card maps, and RBAC helpers.
 * KEEP/MOVE organization stays in gai-hub-navigation.js — this module only
 * surfaces existing routes in role-appropriate UIs (no duplicate pages).
 *
 * Manager home is organized into clear Arabic groups without deleting routes.
 */

const { HR_KEEP, FINANCE_KEEP, listHrKeepAsHomeModules } = require('./gai-hub-navigation');

/**
 * Finance home cards relocated into HR UI (navigation only — routes unchanged).
 * Duplicates that already exist in HR with the same href are skipped below.
 */
const FINANCE_HOME_MOVED_TO_HR = [
  {
    key: 'fin-moved-expenses',
    catalogKey: 'fin-expenses',
    href: '/finance/expenses.html',
    label: 'إدارة المصروفات',
    icon: 'fa-receipt',
    category: 'الصفحات المنقولة من المالية',
    manager: true,
    description: 'منقول من المالية — المصروفات والموردون'
  },
  {
    key: 'fin-moved-journal',
    catalogKey: 'fin-journal',
    href: '/finance/journal.html',
    label: 'مركز القيود المحاسبية',
    icon: 'fa-book',
    category: 'الصفحات المنقولة من المالية',
    manager: true,
    description: 'منقول من المالية — دفتر اليومية والأستاذ'
  },
  {
    key: 'fin-moved-accounting',
    catalogKey: 'fin-accounting',
    href: '/finance/unified-accounting-overview.html',
    label: 'التكامل المحاسبي',
    icon: 'fa-network-wired',
    category: 'الصفحات المنقولة من المالية',
    manager: true,
    description: 'منقول من المالية — النظام المحاسبي الشمولي'
  },
  {
    key: 'fin-moved-payments',
    catalogKey: 'fin-payments',
    href: '/finance/payments.html',
    label: 'المدفوعات',
    icon: 'fa-money-check-dollar',
    category: 'الصفحات المنقولة من المالية',
    manager: true,
    description: 'منقول من المالية — المدفوعات'
  },
  {
    key: 'fin-moved-invoices',
    catalogKey: 'fin-invoices',
    href: '/finance/invoices-budgets-master.html',
    label: 'إدارة الفواتير',
    icon: 'fa-file-invoice-dollar',
    category: 'الصفحات المنقولة من المالية',
    manager: true,
    description: 'منقول من المالية — الفواتير والتحصيل والميزانيات'
  },
  {
    key: 'fin-moved-workforce',
    catalogKey: 'fin-workforce',
    href: '/hr/workforce-planning',
    label: 'تخطيط القوى العاملة',
    icon: 'fa-people-group',
    category: 'الصفحات المنقولة من المالية',
    manager: false,
    description: 'منقول من المالية — تخطيط القوى العاملة'
  }
];

/** Same-href cards already present in HR — listed for audit, not rendered again. */
const FINANCE_HOME_SKIPPED_AS_HR_DUPES = [
  {
    href: '/hr/assets-custodies',
    financeLabel: 'العهد المالية',
    existingHrKey: 'custody',
    existingHrLabel: 'العهد',
    reason: 'نفس المسار موجود في مجموعة الخدمات التشغيلية'
  },
  {
    href: '/hr/operations',
    financeLabel: 'رحلات العمل',
    existingHrKey: 'operations',
    existingHrLabel: 'بوابة العمليات',
    reason: 'نفس المسار موجود في مجموعة الطلبات والموافقات'
  }
];

const EMPLOYEE_ROLE_TOKENS = new Set([
  'employee',
  'emp',
  'staff',
  'موظف',
  'موظف عادي',
  'مستخدم'
]);

const MANAGER_ROLE_TOKENS = new Set([
  'manager',
  'مدير',
  'مدير مباشر',
  'branch_manager',
  'incubator_manager',
  'platform_manager',
  'executive_office_manager'
]);

const HR_ADMIN_ROLE_TOKENS = new Set([
  'hr_admin',
  'hr_manager',
  'hr-manager',
  'مدير موارد بشرية',
  'مسؤول موارد بشرية'
]);

const COMPANY_ADMIN_ROLE_TOKENS = new Set([
  'admin',
  'tenant_admin',
  'company_admin',
  'مسؤول النظام',
  'مسؤول الشركة',
  'مدير النظام'
]);

const PLATFORM_OWNER_ROLE_TOKENS = new Set([
  'super_admin',
  'platform_owner',
  'hq_admin',
  'مالك المنصة'
]);

/** Employee self-service — only existing, working routes. */
const ESS_CARDS = [
  {
    key: 'ess-leave',
    href: '/hr/leaves',
    label: 'طلب إجازة',
    icon: 'fa-plane-departure',
    category: 'خدمة ذاتية',
    description: 'تقديم طلب إجازة جديد ومتابعة حالته'
  },
  {
    key: 'ess-advance',
    href: '/hr/advances',
    label: 'طلب سلفة',
    icon: 'fa-hand-holding-usd',
    category: 'خدمة ذاتية',
    description: 'تقديم طلب سلفة عبر المسار المعتمد'
  },
  {
    key: 'ess-letters',
    href: '/hr/my-requests?type=salary-certificate',
    label: 'خطابات وتعريف راتب',
    icon: 'fa-file-alt',
    category: 'خدمة ذاتية',
    description: 'طلب تعريف بالراتب أو خطاب وظيفي'
  },
  {
    key: 'ess-attendance-pay',
    href: '/hr/attendance-departure',
    label: 'الحضور والرواتب الشخصية',
    icon: 'fa-clock',
    category: 'خدمة ذاتية',
    description: 'عرض الحضور والانصراف الشخصي'
  },
  {
    key: 'ess-my-requests',
    href: '/hr/my-requests',
    label: 'طلباتي ومتابعتها',
    icon: 'fa-list-check',
    category: 'خدمة ذاتية',
    description: 'متابعة كل الطلبات وحالات الموافقة والرفض'
  }
];

/**
 * Canonical manager cards (existing routes only).
 * Labels distinguish roster admin vs 360 profile hub to avoid near-duplicate titles.
 */
const MANAGER_CARD_CATALOG = {
  'employee-files': {
    key: 'admin-employee-files',
    href: '/hr/employees',
    label: 'ملفات الموظفين',
    icon: 'fa-briefcase',
    category: 'إدارة الموظفين',
    manager: true,
    description: 'إضافة وتعديل موظفي الشركة والطلبات الإدارية'
  },
  'employee-360': {
    key: 'employee-360',
    href: '/hr/employee-360',
    label: 'موظف 360',
    icon: 'fa-id-card',
    category: 'إدارة الموظفين',
    manager: false,
    description: 'قائمة الموظفين وملف 360 الشامل لكل موظف'
  },
  'new-hires': {
    key: 'new-hires',
    href: '/hr/new-hires',
    label: 'الموظفون الجدد',
    icon: 'fa-user-plus',
    category: 'إدارة الموظفين',
    manager: true,
    description: 'متابعة تعيين الموظفين الجدد'
  },
  recruitment: {
    key: 'sc-recruitment',
    href: '/hr/recruitment',
    label: 'التوظيف والاستقطاب',
    icon: 'fa-magnifying-glass',
    category: 'إدارة الموظفين',
    manager: true,
    description: 'إدارة عمليات التوظيف والاستقطاب'
  },
  'accepted-employees': {
    key: 'accepted-employees',
    href: '/hr/accepted-employees',
    label: 'الموظفون المقبولون',
    icon: 'fa-user-check',
    category: 'إدارة الموظفين',
    manager: true,
    description: 'قائمة الموظفين المقبولين قبل الإكمال'
  },
  'hr-ops': {
    key: 'sc-hr-ops',
    href: '/hr/human-resources',
    label: 'تشغيل الموارد البشرية',
    icon: 'fa-people-group',
    category: 'إدارة الموظفين',
    manager: true,
    description: 'لوحة تشغيل الموارد البشرية'
  },
  attendance: {
    key: 'attendance-departure',
    href: '/hr/attendance-departure',
    label: 'الحضور والانصراف',
    icon: 'fa-clock',
    category: 'الحضور والرواتب',
    manager: false,
    description: 'سجلات الحضور والانصراف'
  },
  'attendance-hub': {
    key: 'attendance-hub',
    href: '/hr/attendance-hub',
    label: 'مركز الحضور والنوبات',
    icon: 'fa-calendar-check',
    category: 'الحضور والرواتب',
    manager: false,
    description: 'الحضور والنوبات الذكية'
  },
  payroll: {
    key: 'payroll',
    href: '/hr/payroll',
    label: 'مسير الرواتب',
    icon: 'fa-sack-dollar',
    category: 'الحضور والرواتب',
    manager: true,
    description: 'إدارة مسير الرواتب'
  },
  'payroll-hub': {
    key: 'payroll-hub',
    href: '/hr/payroll-hub',
    label: 'مقارنة الرواتب',
    icon: 'fa-wallet',
    category: 'الحضور والرواتب',
    manager: false,
    description: 'مركز الرواتب والتعويضات والمقارنات'
  },
  performance: {
    key: 'performance',
    href: '/hr/performance',
    label: 'تقييم الأداء',
    icon: 'fa-chart-line',
    category: 'الأداء والتطوير',
    manager: false,
    description: 'تقييم أداء الموظفين'
  },
  satisfaction: {
    key: 'satisfaction-analytics',
    href: '/hr/satisfaction-analytics',
    label: 'تفاعل الموظفين',
    icon: 'fa-face-smile',
    category: 'الأداء والتطوير',
    manager: false,
    description: 'تحليل رضا وتفاعل الموظفين'
  },
  benefits: {
    key: 'offers-benefits',
    href: '/hr/offers-benefits',
    label: 'مزايا الموظفين',
    icon: 'fa-gift',
    category: 'الأداء والتطوير',
    manager: false,
    description: 'العروض والمزايا'
  },
  learning: {
    key: 'learning',
    href: '/hr/learning',
    label: 'التدريب والتطوير',
    icon: 'fa-graduation-cap',
    category: 'الأداء والتطوير',
    manager: false,
    description: 'أكاديمية التدريب والتطوير'
  },
  surveys: {
    key: 'sc-surveys',
    href: '/hr/surveys',
    label: 'الاستبيانات',
    icon: 'fa-square-poll-vertical',
    category: 'الأداء والتطوير',
    manager: false,
    description: 'استبيانات الموارد البشرية'
  },
  requests: {
    key: 'admin-emp-requests',
    href: '/hr/requests',
    label: 'طلبات الموظفين',
    icon: 'fa-inbox',
    category: 'الطلبات والموافقات',
    manager: true,
    description: 'معالجة طلبات الموظفين'
  },
  approvals: {
    key: 'admin-approvals',
    href: '/hr/pending-actions',
    label: 'الموافقات والرفض',
    icon: 'fa-hourglass-half',
    category: 'الطلبات والموافقات',
    manager: true,
    description: 'عمليات بانتظار إجراء ضمن نطاقك'
  },
  'manager-board': {
    key: 'sc-manager',
    href: '/hr/manager',
    label: 'متابعة الطلبات',
    icon: 'fa-user-tie',
    category: 'الطلبات والموافقات',
    manager: true,
    description: 'لوحة متابعة المدير للطلبات'
  },
  operations: {
    key: 'hr-operations',
    href: '/hr/operations',
    label: 'بوابة العمليات',
    icon: 'fa-diagram-project',
    category: 'الطلبات والموافقات',
    manager: true,
    description: 'عمليات وطلبات الموارد البشرية'
  },
  reports: {
    key: 'admin-reports',
    href: '/hr/reports',
    label: 'تقارير الموارد البشرية',
    icon: 'fa-chart-column',
    category: 'التقارير والإعدادات',
    manager: true,
    description: 'التقارير والإحصائيات'
  },
  settings: {
    key: 'admin-hr-settings',
    href: '/hr/system-settings',
    label: 'إعدادات الموارد البشرية',
    icon: 'fa-gear',
    category: 'التقارير والإعدادات',
    manager: true,
    description: 'إعدادات نظام الموارد البشرية'
  },
  policies: {
    key: 'policies',
    href: '/hr/policies',
    label: 'الامتثال لنظام العمل',
    icon: 'fa-scale-balanced',
    category: 'التقارير والإعدادات',
    manager: false,
    description: 'السياسات والإجراءات'
  },
  tasks: {
    key: 'sc-tasks',
    href: '/hr/tasks-management',
    label: 'المهام',
    icon: 'fa-list-check',
    category: 'خدمات تشغيلية',
    manager: true,
    description: 'إدارة المهام'
  },
  decisions: {
    key: 'sc-decisions',
    href: '/hr/decisions',
    label: 'القرارات',
    icon: 'fa-gavel',
    category: 'خدمات تشغيلية',
    manager: true,
    description: 'القرارات الإدارية'
  },
  letters: {
    key: 'sc-letters',
    href: '/hr/letters',
    label: 'الخطابات',
    icon: 'fa-envelope-open-text',
    category: 'خدمات تشغيلية',
    manager: true,
    description: 'الخطابات الرسمية'
  },
  custody: {
    key: 'sc-custody',
    href: '/hr/assets-custodies',
    label: 'العهد',
    icon: 'fa-box-open',
    category: 'خدمات تشغيلية',
    manager: true,
    description: 'العهد والأصول'
  },
  gov: {
    key: 'sc-gov',
    href: '/hr/government-services',
    label: 'الخدمات الحكومية',
    icon: 'fa-landmark',
    category: 'خدمات تشغيلية',
    manager: false,
    description: 'خدمات حكومية مرتبطة بالموظفين'
  },
  third: {
    key: 'sc-third',
    href: '/hr/third-party-services',
    label: 'خدمات الطرف الثالث',
    icon: 'fa-handshake',
    category: 'خدمات تشغيلية',
    manager: false,
    description: 'خدمات الأطراف الثالثة'
  },
  circulars: {
    key: 'sc-circulars',
    href: '/hr/circulars',
    label: 'التعاميم والإشعارات',
    icon: 'fa-bullhorn',
    category: 'خدمات تشغيلية',
    manager: false,
    description: 'التعاميم وإشعارات الموارد البشرية'
  },
  'fin-expenses': { ...FINANCE_HOME_MOVED_TO_HR[0] },
  'fin-journal': { ...FINANCE_HOME_MOVED_TO_HR[1] },
  'fin-accounting': { ...FINANCE_HOME_MOVED_TO_HR[2] },
  'fin-payments': { ...FINANCE_HOME_MOVED_TO_HR[3] },
  'fin-invoices': { ...FINANCE_HOME_MOVED_TO_HR[4] },
  'fin-workforce': { ...FINANCE_HOME_MOVED_TO_HR[5] }
};

/** Legacy export shape used by older tests — maps to roster + approvals + reports + settings. */
const ADMIN_OPS_CARDS = [
  MANAGER_CARD_CATALOG.requests,
  MANAGER_CARD_CATALOG.approvals,
  MANAGER_CARD_CATALOG['employee-files'],
  MANAGER_CARD_CATALOG.reports,
  MANAGER_CARD_CATALOG.settings
];

/** Extra operational shortcuts (kept for inventory / sidebar parity). */
const ADMIN_SHORTCUT_CARDS = [
  MANAGER_CARD_CATALOG['manager-board'],
  MANAGER_CARD_CATALOG['hr-ops'],
  MANAGER_CARD_CATALOG.tasks,
  MANAGER_CARD_CATALOG.decisions,
  MANAGER_CARD_CATALOG.letters,
  MANAGER_CARD_CATALOG.recruitment,
  MANAGER_CARD_CATALOG.custody,
  MANAGER_CARD_CATALOG.surveys,
  MANAGER_CARD_CATALOG.gov,
  MANAGER_CARD_CATALOG.third,
  MANAGER_CARD_CATALOG.circulars
];

const ESS_NAV = [
  { key: 'home', href: '/hr', icon: 'fa-house', label: 'الخدمة الذاتية' },
  { key: 'leave', href: '/hr/leaves', icon: 'fa-plane-departure', label: 'طلب إجازة' },
  { key: 'advance', href: '/hr/advances', icon: 'fa-hand-holding-usd', label: 'طلب سلفة' },
  { key: 'letters', href: '/hr/my-requests?type=salary-certificate', icon: 'fa-file-alt', label: 'خطابات وتعريف' },
  { key: 'attendance', href: '/hr/attendance-departure', icon: 'fa-clock', label: 'حضوري' },
  { key: 'my-requests', href: '/hr/my-requests', icon: 'fa-inbox', label: 'طلباتي' }
];

const ADMIN_BLOCKED_FROM_EMPLOYEE = [
  '/hr/employees',
  '/hr/requests',
  '/hr/pending-actions',
  '/hr/manager',
  '/hr/system-settings',
  '/hr/reports',
  '/hr/new-hires',
  '/hr/accepted-employees',
  '/hr/human-resources',
  '/hr/tasks-management',
  '/hr/decisions',
  '/hr/payroll',
  '/hr/recruitment',
  '/hr/workflow-engine',
  '/hr/attendance-hub'
];

const MANAGER_SECTION_PLAN = [
  {
    id: 'employees-mgmt',
    title: 'إدارة الموظفين',
    keys: ['employee-files', 'employee-360', 'new-hires', 'recruitment', 'accepted-employees', 'hr-ops']
  },
  {
    id: 'attendance-payroll',
    title: 'الحضور والرواتب',
    keys: ['attendance', 'attendance-hub', 'payroll', 'payroll-hub']
  },
  {
    id: 'performance-dev',
    title: 'الأداء والتطوير',
    keys: ['performance', 'satisfaction', 'benefits', 'learning', 'surveys']
  },
  {
    id: 'requests-approvals',
    title: 'الطلبات والموافقات',
    keys: ['requests', 'approvals', 'manager-board', 'operations']
  },
  {
    id: 'reports-settings',
    title: 'التقارير والإعدادات',
    keys: ['reports', 'settings', 'policies'],
    settingsOnlyKeys: ['settings']
  },
  {
    id: 'ops-services',
    title: 'خدمات تشغيلية إضافية',
    keys: ['tasks', 'decisions', 'letters', 'custody', 'gov', 'third', 'circulars']
  },
  {
    id: 'moved-from-finance',
    title: 'الصفحات المنقولة من المالية',
    keys: ['fin-expenses', 'fin-journal', 'fin-accounting', 'fin-payments', 'fin-invoices', 'fin-workforce']
  }
];

function normalizeRole(role) {
  return String(role || '').trim().toLowerCase();
}

function classifyPersona(role) {
  const r = normalizeRole(role);
  if (!r) return 'manager'; // HQ anonymous / legacy default = admin ops home (current product behavior)
  if (PLATFORM_OWNER_ROLE_TOKENS.has(r) || r.includes('super_admin') || r.includes('platform')) {
    return 'platform_owner';
  }
  if (COMPANY_ADMIN_ROLE_TOKENS.has(r) || r.includes('admin') || r.includes('مسؤول')) {
    return 'company_admin';
  }
  if (HR_ADMIN_ROLE_TOKENS.has(r) || (r.includes('hr') && r.includes('admin')) || r.includes('موارد')) {
    return 'hr_admin';
  }
  if (MANAGER_ROLE_TOKENS.has(r) || r.includes('manager') || r.includes('مدير')) {
    return 'manager';
  }
  if (EMPLOYEE_ROLE_TOKENS.has(r) || r.includes('employee') || r.includes('staff') || r.includes('موظف')) {
    return 'employee';
  }
  return 'manager';
}

function isEmployeePersona(persona) {
  return persona === 'employee';
}

function isAdminPersona(persona) {
  return !isEmployeePersona(persona);
}

function canApproveRequests(persona) {
  return ['manager', 'hr_admin', 'company_admin', 'platform_owner'].includes(persona);
}

function canManageEmployees(persona) {
  return ['hr_admin', 'company_admin', 'platform_owner', 'manager'].includes(persona);
}

function canAccessHrSettings(persona) {
  return ['hr_admin', 'company_admin', 'platform_owner'].includes(persona);
}

function cloneCards(list) {
  return (list || []).map((item) => ({ ...item }));
}

function cardByKey(key) {
  const card = MANAGER_CARD_CATALOG[key];
  return card ? { ...card } : null;
}

function buildManagerSections(persona) {
  const allowSettings = canAccessHrSettings(persona);
  return MANAGER_SECTION_PLAN.map((section) => {
    const cards = section.keys
      .filter((key) => {
        if ((section.settingsOnlyKeys || []).includes(key) && !allowSettings) return false;
        return true;
      })
      .map((key) => cardByKey(key))
      .filter(Boolean);
    return {
      id: section.id,
      title: section.title,
      cards
    };
  }).filter((section) => section.cards.length > 0);
}

function buildPortalPayload(role) {
  const persona = classifyPersona(role);

  if (isEmployeePersona(persona)) {
    const modules = cloneCards(ESS_CARDS);
    return {
      persona,
      title: 'بوابة الخدمة الذاتية',
      subtitle: 'قدّم طلباتك وتابع حالتها من هنا — دون الوصول إلى أدوات الإدارة',
      modules,
      sections: [
        {
          id: 'ess',
          title: 'الموظف — بوابة الخدمة الذاتية',
          cards: modules
        }
      ],
      nav: cloneCards(ESS_NAV),
      categories: ['الكل', 'خدمة ذاتية'],
      adminHidden: true,
      canApprove: false,
      canManageEmployees: false,
      canAccessSettings: false
    };
  }

  const sections = buildManagerSections(persona);
  const modules = sections.flatMap((section) => section.cards);
  const categories = ['الكل', ...new Set(modules.map((m) => m.category).filter(Boolean))];

  return {
    persona,
    title: 'لوحة الموارد البشرية',
    subtitle: 'وظائف منظمة في مجموعات واضحة — الأحمر والأبيض مع لمسات ذهبية',
    modules,
    sections,
    nav: null, // use default HCM sidebar
    categories,
    adminHidden: false,
    canApprove: canApproveRequests(persona),
    canManageEmployees: canManageEmployees(persona),
    canAccessSettings: canAccessHrSettings(persona)
  };
}

function buildInventoryRows() {
  const rows = [];
  const seen = new Set();

  const push = (fn, appearance, roles, reachable) => {
    const key = `${fn.href}|${fn.label}`;
    if (seen.has(key)) return;
    seen.add(key);
    rows.push({
      name: fn.label,
      href: fn.href,
      appearsIn: appearance,
      roles,
      reachableFromUi: reachable
    });
  };

  ESS_CARDS.forEach((c) => push(c, 'ESS + /hr employee home', 'employee', true));
  Object.values(MANAGER_CARD_CATALOG).forEach((c) => {
    push(c, 'GM grouped home + HCM sidebar / KEEP', 'manager+', true);
  });
  // KEEP originals still reachable via GAI / listHrKeepAsHomeModules
  HR_KEEP.forEach((c) => push(c, 'HR KEEP catalog (GAI/home modules helper)', 'manager+', true));

  return rows;
}

function resolveAuthUser(req) {
  if (req?.authUser && (req.authUser.role || req.authUser.id || req.authUser.email)) {
    return {
      id: req.authUser.id || null,
      role: req.authUser.role || null,
      email: req.authUser.email || null,
      employeeId: req.authUser.employeeId || req.authUser.employee_id || null,
      name: req.authUser.name || null
    };
  }
  const entity = req?.authenticatedEntityContext || req?.userEntity || {};
  return {
    id: entity.userId || entity.user_id || null,
    role: entity.role || null,
    email: entity.email || null,
    employeeId: entity.employeeId || entity.employee_id || null,
    name: entity.name || null
  };
}

function employeeRequestScopeFilter(authUser, persona) {
  if (!isEmployeePersona(persona)) {
    return { scoped: false, employeeId: null };
  }
  const employeeId = authUser?.employeeId
    || (authUser?.id != null ? String(authUser.id) : null);
  return { scoped: true, employeeId };
}

function isAdminPathBlockedForEmployee(pathname) {
  const clean = String(pathname || '').split('?')[0].replace(/\/$/, '') || '/hr';
  return ADMIN_BLOCKED_FROM_EMPLOYEE.some((p) => clean === p || clean.startsWith(`${p}/`));
}

module.exports = {
  ESS_CARDS,
  ADMIN_OPS_CARDS,
  ADMIN_SHORTCUT_CARDS,
  MANAGER_CARD_CATALOG,
  MANAGER_SECTION_PLAN,
  ESS_NAV,
  ADMIN_BLOCKED_FROM_EMPLOYEE,
  FINANCE_HOME_MOVED_TO_HR,
  FINANCE_HOME_SKIPPED_AS_HR_DUPES,
  FINANCE_KEEP,
  classifyPersona,
  isEmployeePersona,
  isAdminPersona,
  canApproveRequests,
  canManageEmployees,
  canAccessHrSettings,
  buildPortalPayload,
  buildInventoryRows,
  resolveAuthUser,
  employeeRequestScopeFilter,
  isAdminPathBlockedForEmployee,
  // re-export for tests that still pull KEEP through portal helpers
  listHrKeepAsHomeModules
};
