'use strict';

/**
 * HR portal personas, ESS / admin card maps, and RBAC helpers.
 * KEEP/MOVE organization stays in gai-hub-navigation.js — this module only
 * surfaces existing routes in role-appropriate UIs (no duplicate pages).
 */

const { HR_KEEP, listHrKeepAsHomeModules } = require('./gai-hub-navigation');

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

/** Manager / admin ops — original routes (some also listed under GAI). */
const ADMIN_OPS_CARDS = [
  {
    key: 'admin-emp-requests',
    href: '/hr/requests',
    label: 'طلبات الموظفين',
    icon: 'fa-inbox',
    category: 'إدارة',
    manager: true,
    description: 'معالجة طلبات الموظفين'
  },
  {
    key: 'admin-approvals',
    href: '/hr/pending-actions',
    label: 'الموافقة والرفض',
    icon: 'fa-hourglass-half',
    category: 'إدارة',
    manager: true,
    description: 'عمليات بانتظار إجراء ضمن نطاقك'
  },
  {
    key: 'admin-employee-files',
    href: '/hr/employees',
    label: 'ملفات الموظفين',
    icon: 'fa-briefcase',
    category: 'إدارة',
    manager: true,
    description: 'النظام الإداري وملفات الموظفين'
  },
  {
    key: 'admin-reports',
    href: '/hr/reports',
    label: 'التقارير والإحصائيات',
    icon: 'fa-chart-column',
    category: 'إدارة',
    manager: true,
    description: 'تقارير الموارد البشرية'
  },
  {
    key: 'admin-hr-settings',
    href: '/hr/system-settings',
    label: 'إعدادات الموارد البشرية',
    icon: 'fa-gear',
    category: 'إدارة',
    manager: true,
    description: 'إعدادات نظام الموارد البشرية'
  }
];

/** Extra operational shortcuts from HCM sidebar that are not KEEP and not in ADMIN_OPS. */
const ADMIN_SHORTCUT_CARDS = [
  { key: 'sc-manager', href: '/hr/manager', label: 'لوحة متابعة المدير', icon: 'fa-user-tie', category: 'تشغيل', manager: true },
  { key: 'sc-hr-ops', href: '/hr/human-resources', label: 'الموارد البشرية (تشغيل)', icon: 'fa-people-group', category: 'تشغيل', manager: true },
  { key: 'sc-tasks', href: '/hr/tasks-management', label: 'المهام', icon: 'fa-list-check', category: 'تشغيل', manager: true },
  { key: 'sc-decisions', href: '/hr/decisions', label: 'القرارات', icon: 'fa-gavel', category: 'تشغيل', manager: true },
  { key: 'sc-letters', href: '/hr/letters', label: 'الخطابات', icon: 'fa-envelope-open-text', category: 'تشغيل', manager: true },
  { key: 'sc-recruitment', href: '/hr/recruitment', label: 'التوظيف', icon: 'fa-user-plus', category: 'تشغيل', manager: true },
  { key: 'sc-custody', href: '/hr/assets-custodies', label: 'العهد', icon: 'fa-box-open', category: 'تشغيل', manager: true },
  { key: 'sc-surveys', href: '/hr/surveys', label: 'الاستبيانات', icon: 'fa-square-poll-vertical', category: 'تشغيل', manager: false },
  { key: 'sc-gov', href: '/hr/government-services', label: 'الخدمات الحكومية', icon: 'fa-landmark', category: 'تشغيل', manager: false },
  { key: 'sc-third', href: '/hr/third-party-services', label: 'خدمات الطرف الثالث', icon: 'fa-handshake', category: 'تشغيل', manager: false },
  { key: 'sc-circulars', href: '/hr/circulars', label: 'التعاميم والإشعارات', icon: 'fa-bullhorn', category: 'تشغيل', manager: false }
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
  '/hr/workflow-engine'
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

function buildPortalPayload(role) {
  const persona = classifyPersona(role);
  const keep = listHrKeepAsHomeModules();

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

  const adminOps = cloneCards(ADMIN_OPS_CARDS).filter((card) => {
    if (card.key === 'admin-hr-settings') return canAccessHrSettings(persona);
    return true;
  });
  const shortcuts = cloneCards(ADMIN_SHORTCUT_CARDS);
  const modules = [...adminOps, ...keep, ...shortcuts];
  const categories = ['الكل', ...new Set(modules.map((m) => m.category).filter(Boolean))];

  return {
    persona,
    title: 'لوحة المدير العام',
    subtitle: 'الوصول إلى وظائف الإدارة والأنظمة المتاحة دون الاعتماد فقط على القائمة الجانبية',
    modules,
    sections: [
      {
        id: 'admin',
        title: 'المدير / الأدمن — لوحة الإدارة والصلاحيات',
        cards: adminOps
      },
      {
        id: 'keep',
        title: 'الأنظمة المتاحة',
        cards: keep
      },
      {
        id: 'shortcuts',
        title: 'اختصارات تشغيلية',
        cards: shortcuts
      }
    ],
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
  ADMIN_OPS_CARDS.forEach((c) => push(c, 'GM admin section + HCM sidebar + GAI (if moved)', 'manager, hr_admin, company_admin', true));
  HR_KEEP.forEach((c) => push(c, 'HR KEEP home + HCM sidebar', 'manager+', true));
  ADMIN_SHORTCUT_CARDS.forEach((c) => push(c, 'GM shortcuts + HCM sidebar', 'manager+', true));

  return rows;
}

function resolveAuthUser(req) {
  if (req?.authUser && (req.authUser.role || req.authUser.id)) {
    return req.authUser;
  }
  const entity = req?.authenticatedEntityContext || req?.userEntity || {};
  return {
    id: entity.userId || entity.user_id || null,
    role: entity.role || null,
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
  ESS_NAV,
  ADMIN_BLOCKED_FROM_EMPLOYEE,
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
  isAdminPathBlockedForEmployee
};
