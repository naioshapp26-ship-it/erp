/**
 * Central registry for tenant/office page permissions.
 * Builds system → pages hierarchy from route parent mappings.
 */

const fs = require('fs');
const path = require('path');

const PRIMARY_TENANT_SYSTEM_KEYS = [
  'dashboard',
  'records-archive-home',
  'hr',
  'finance',
  'strategic-management',
  'employee-menu',
  'payment-menu',
  'tasks-management',
  'requests',
  'hierarchy',
  'saas',
  'facilities',
  'e-offices',
  'platforms',
  'branches-hub',
  'incubators-hub',
  'settings',
  'audit-logs',
  'marketing-campaigns-studio'
];

const FINANCE_FILE_LABELS = {
  index: 'لوحة المالية',
  customers: 'العملاء',
  invoices: 'الفواتير',
  payments: 'المدفوعات',
  budgets: 'الميزانيات',
  'chart-of-accounts': 'دليل الحسابات',
  'ai-forecasts': 'توقعات الذكاء الاصطناعي',
  'cashflow-summary': 'ملخص التدفقات النقدية',
  journal: 'قيود اليومية',
  expenses: 'المصروفات',
  contracts: 'العقود',
  'hr-home': 'الموارد البشرية - الرئيسية',
  'inbound-outbound-mail': 'الوارد والصادر',
  'admin-circulars': 'التعاميم الإدارية',
  'operational-policies': 'السياسات التشغيلية',
  'events-studio-main': 'استوديو الفعاليات',
  'marketing-campaigns-studio': 'استديو الحملات التسويقية'
};

const OFFICE_ROUTE_PARENTS = {
  'executive-management': 'strategic-management',
  'employee-management': 'strategic-management',
  'smart-systems': 'strategic-management',
  'subscription-management': 'strategic-management',
  'operations-management': 'strategic-management',
  'financial-approvals': 'strategic-management',
  tenants: 'strategic-management',
  'advertisers-center': 'strategic-management',
  'training-development': 'strategic-management',
  'quality-audit': 'strategic-management',
  evaluation: 'strategic-management',
  'tasks-strategic': 'strategic-management',
  'information-center': 'strategic-management',
  'identity-settings': 'strategic-management',
  'system-log': 'strategic-management',
  reports: 'strategic-management',
  'records-master-register': 'records-archive-home',
  'records-students': 'records-archive-home',
  'records-financial-collection': 'records-archive-home',
  'records-financial-affairs': 'records-archive-home',
  'records-academic-admin': 'records-archive-home',
  'records-quality': 'records-archive-home',
  'records-executive': 'records-archive-home',
  'records-facilities': 'records-archive-home',
  'records-confidential': 'records-archive-home',
  'records-reports': 'records-archive-home',
  'records-user-guide': 'records-archive-home',
  'records-system-analysis': 'records-archive-home',
  'records-secure-access': 'records-archive-home',
  'records-security-log': 'records-archive-home',
  'invoices-enhanced': 'payment-menu',
  'payment-methods': 'payment-menu',
  'installment-plans': 'payment-menu',
  'payment-tracking': 'payment-menu',
  'tax-settings': 'payment-menu',
  'collection-rules': 'payment-menu',
  'payment-reminders': 'payment-menu',
  'overdue-management': 'payment-menu',
  'payment-analytics': 'payment-menu',
  'gateway-payments': 'payment-menu',
  'credit-topup': 'payment-menu',
  'online-store': 'payment-menu',
  'attendance-departure': 'employee-menu',
  'emp-requests': 'employee-menu',
  'emp-leaves': 'employee-menu',
  'leave-balance': 'employee-menu',
  'notifications-warnings': 'employee-menu',
  'emp-decisions': 'employee-menu',
  'company-violations': 'employee-menu',
  'evaluation-forms': 'employee-menu',
  circulars: 'employee-menu',
  'advances-receivables': 'employee-menu',
  surveys: 'employee-menu',
  'business-activities': 'employee-menu',
  'emp-letters': 'employee-menu',
  custodies: 'employee-menu',
  'assets-custodies': 'employee-menu',
  'salary-slips': 'employee-menu',
  'flexible-salary': 'employee-menu',
  resignations: 'employee-menu',
  'employee-settlement': 'employee-menu',
  'attendance-register': 'employee-menu',
  'attendance-table': 'employee-menu',
  purchases: 'supply-chain',
  logistics: 'supply-chain',
  inventory: 'supply-chain',
  suppliers: 'supply-chain',
  'orders-delivery': 'supply-chain',
  'smart-procurement': 'supply-chain',
  manufacturing: 'supply-chain',
  'product-lifecycle': 'supply-chain',
  maintenance: 'supply-chain',
  'quality-control': 'supply-chain',
  safety: 'supply-chain',
  'specs-estimates': 'supply-chain',
  'customs-clearance': 'supply-chain',
  crm: 'sales',
  'sales-operations': 'sales',
  pos: 'sales',
  'quotes-contracts': 'sales',
  commissions: 'sales',
  'order-tracking': 'sales',
  'ai-integration': 'internet-automation',
  governance: 'internet-automation',
  compliance: 'internet-automation',
  iot: 'internet-automation',
  elearning: 'internet-automation',
  forum: 'internet-automation',
  etiquette: 'internet-automation',
  knowledge: 'internet-automation',
  'intellectual-property': 'internet-automation',
  'visitor-chat': 'internet-automation',
  'dispute-settlements': 'internet-automation',
  'records-archiving': 'internet-automation',
  'occupational-safety': 'occupational-health',
  'international-standards': 'occupational-health',
  'iso-standards': 'occupational-health',
  'risk-management': 'occupational-health',
  consulting: 'occupational-health',
  'specialized-courses': 'occupational-health',
  'ohs-evaluation': 'occupational-health',
  'data-analysis': 'occupational-health',
  'project-management-office': 'services',
  'institutional-performance': 'services',
  'operations-monitoring': 'services',
  'ai-market-research': 'services',
  'customer-service': 'services',
  'client-admin-services': 'services',
  'virtual-halls': 'services',
  'feasibility-studies': 'services',
  research: 'services',
  'consulting-training': 'services',
  'facilities-events': 'facilities',
  'facilities-real-estate': 'facilities',
  'facilities-assets': 'facilities',
  'facilities-projects': 'facilities',
  'facilities-projects-maintenance': 'facilities',
  'facilities-projects-contracts': 'facilities',
  'facilities-projects-vendors': 'facilities',
  'facilities-projects-energy': 'facilities',
  'facilities-projects-crowd': 'facilities',
  'main-menu': 'tasks-management',
  'control-panel': 'tasks-management',
  'my-tasks': 'tasks-management',
  procedures: 'tasks-management',
  'all-procedures': 'tasks-management',
  'general-tasks': 'tasks-management',
  customers: 'tasks-management',
  delegations: 'tasks-management',
  'task-reports': 'tasks-management',
  'task-settings': 'tasks-management',
  'settings-admin': 'settings',
  'settings-branches-sections': 'settings',
  'settings-field-templates': 'settings',
  'settings-numbering-systems': 'settings',
  'settings-procedure-types': 'settings',
  'settings-letter-types': 'settings',
  'settings-letter-templates': 'settings',
  'settings-transaction-statuses': 'settings',
  'settings-request-config': 'settings',
  'settings-task-statuses': 'settings',
  'settings-barcode-templates': 'settings',
  'settings-email-templates': 'settings',
  'settings-sms-templates': 'settings',
  'settings-print-templates': 'settings',
  'settings-permissions': 'settings',
  'settings-backup': 'settings',
  'settings-general': 'settings',
  'eo-daily-operations': 'e-offices',
  'eo-sales': 'e-offices',
  'eo-subscriptions': 'e-offices',
  'eo-training': 'e-offices',
  'eo-customer-service': 'e-offices',
  'eo-operational-reports': 'e-offices',
  'eo-local-hr': 'e-offices',
  'eo-operational-finance': 'e-offices',
  'eo-files': 'e-offices',
  'eo-archive': 'e-offices',
  'eo-tasks': 'e-offices',
  'eo-meetings': 'e-offices',
  'eo-consultations': 'e-offices',
  'eo-latest-news': 'e-offices',
  'eo-users': 'e-offices',
  'pl-daily-operations': 'platforms',
  'pl-sales': 'platforms',
  'pl-subscriptions': 'platforms',
  'pl-training': 'platforms',
  'pl-customer-service': 'platforms',
  'pl-operational-reports': 'platforms',
  'pl-local-hr': 'platforms',
  'pl-operational-finance': 'platforms',
  'br-daily-operations': 'branches-hub',
  'br-sales': 'branches-hub',
  'br-subscriptions': 'branches-hub',
  'br-training': 'branches-hub',
  'br-customer-service': 'branches-hub',
  'br-operational-reports': 'branches-hub',
  'br-local-hr': 'branches-hub',
  'br-operational-finance': 'branches-hub',
  'ic-daily-operations': 'incubators-hub',
  'ic-sales': 'incubators-hub',
  'ic-subscriptions': 'incubators-hub',
  'ic-training': 'incubators-hub',
  'ic-customer-service': 'incubators-hub',
  'ic-operational-reports': 'incubators-hub',
  'ic-local-hr': 'incubators-hub',
  'ic-operational-finance': 'incubators-hub',
  'sc-member-management': 'naiosh-sectors',
  'sc-governance': 'naiosh-sectors',
  'sc-automation': 'naiosh-sectors',
  'sc-sustainability': 'naiosh-sectors',
  'sc-legal': 'naiosh-sectors',
  'sc-skills-innovation': 'naiosh-sectors',
  'sc-initiatives': 'naiosh-sectors',
  'sc-beta-club': 'naiosh-sectors',
  'eti-ohs': 'education-training-incubators',
  'eti-supply-chain': 'education-training-incubators',
  'eti-facilities': 'education-training-incubators',
  'eti-logistics': 'education-training-incubators',
  'eti-project-management': 'education-training-incubators',
  'eti-hr': 'education-training-incubators'
};

const ROUTE_TO_PATH = {
  dashboard: '/home',
  'records-archive-home': '/archive',
  'records-master-register': '/archive/general-admin-files',
  'records-students': '/archive/student-affairs',
  'records-financial-collection': '/archive/marketing-sales',
  'records-financial-affairs': '/archive/finance-accounting',
  'records-academic-admin': '/archive/academic-admin',
  'records-quality': '/archive/training-education',
  'records-executive': '/archive/human-resources',
  'records-facilities': '/archive/projects',
  'records-confidential': '/archive/confidential',
  'records-reports': '/archive/outgoing',
  'records-user-guide': '/archive/user-guide',
  'records-system-analysis': '/archive/it',
  'records-secure-access': '/archive/access-control',
  'records-security-log': '/archive/audit-log',
  hr: '/hr',
  finance: '/finance',
  'strategic-management': '/strategic',
  hierarchy: '/hierarchy',
  saas: '/saas',
  incubator: '/incubator',
  requests: '/requests',
  'tasks-management': '/tasks',
  facilities: '/facilities',
  settings: '/settings',
  'audit-logs': '/audit-logs',
  ads: '/ads',
  'e-offices': '/e-offices',
  platforms: '/platforms',
  'incubators-hub': '/incubators-hub',
  'branches-hub': '/branches',
  'naiosh-sectors': '/sectors',
  'employee-menu': '/employee',
  entities: '/tenants',
  'events-studio-main': '/finance/events-studio-main.html',
  'marketing-campaigns-studio': '/marketing-campaigns-studio',
  marketing: '/marketing-campaigns-studio',
  'operational-policies': '/operational-policies',
  'payment-menu': '/payment',
  'supply-chain': '/supply-chain',
  sales: '/sales',
  'internet-automation': '/internet-automation',
  'occupational-health': '/occupational-health',
  services: '/services',
  'education-training-incubators': '/education-training-incubators',
  'collections-strategic': '/strategic/collections',
  approvals: '/approvals',
  employees: '/hr/employees',
  'attendance-departure': '/hr/attendance-departure',
  'emp-requests': '/hr/requests',
  'emp-leaves': '/hr/leaves',
  'leave-balance': '/hr/leave-balance',
  'notifications-warnings': '/hr/notifications-warnings',
  'emp-decisions': '/hr/decisions',
  'company-violations': '/hr/company-violations',
  'evaluation-forms': '/hr/evaluation-forms',
  circulars: '/hr/circulars',
  'advances-receivables': '/hr/advances-receivables',
  surveys: '/hr/surveys',
  'business-activities': '/hr/business-activities',
  'emp-letters': '/hr/letters',
  custodies: '/hr/custodies',
  'assets-custodies': '/hr/assets-custodies',
  'salary-slips': '/hr/salary-slips',
  'attendance-register': '/hr/attendance-register',
  'attendance-table': '/hr/attendance-table',
  'hr-policies': '/hr/policies',
  'hr-tasks-management': '/hr/tasks-management',
  'executive-management': '/strategic/executive',
  'information-center': '/strategic/information'
};

let cachedRegistry = null;

function normalizePageKey(key) {
  if (key === 'records-archive') return 'records-archive-home';
  return key;
}

function getPageLabel(key) {
  return PAGE_LABELS[key] || key;
}

const PAGE_LABELS = {
  dashboard: 'الرئيسية',
  'records-archive-home': 'نظام السجلات والأرشفة',
  'records-master-register': 'قسم ملفات عامة و إدارية',
  'records-students': 'شؤون الطلاب',
  'records-financial-collection': 'قسم التسويق و المبيعات',
  'records-financial-affairs': 'قسم المالية و المحاسبة',
  'records-academic-admin': 'الادارة الاكاديمية',
  'records-quality': 'قسم التدريب و التعليم',
  'records-executive': 'قسم الموارد البشرية',
  'records-facilities': 'قسم المشاريع',
  'records-confidential': 'المستندات السرية',
  'records-reports': 'قسم الصادر',
  'records-user-guide': 'دليل الاستخدام',
  'records-system-analysis': 'قسم IT',
  'records-secure-access': 'نظام الوصول الآمن',
  'records-security-log': 'سجل النشاطات الأمنية',
  hr: 'الموارد البشرية',
  'strategic-management': 'الإدارة الاستراتيجية',
  hierarchy: 'الهيكل الهرمي',
  saas: 'إدارة الاشتراكات',
  incubator: 'حاضنة السلامة',
  'branches-hub': 'الفروع',
  'br-daily-operations': 'العمليات اليومية - الفروع',
  'br-sales': 'المبيعات - الفروع',
  'br-subscriptions': 'الاشتراكات - الفروع',
  'br-training': 'التدريب - الفروع',
  'br-customer-service': 'خدمة العملاء - الفروع',
  'br-operational-reports': 'التقارير التشغيلية - الفروع',
  'br-local-hr': 'الموارد البشرية المحلية - الفروع',
  'br-operational-finance': 'المالية التشغيلية - الفروع',
  'education-training-incubators': 'حاضنات التعليم والتدريب',
  'eti-ohs': 'حاضنة السلامة والصحة المهنية',
  'eti-supply-chain': 'حاضنة سلاسل الإمداد',
  'eti-facilities': 'حضانة إدارة المرافق',
  'eti-logistics': 'حاضنة اللوجستيات والنقل والتوصيل',
  'eti-project-management': 'حاضنة إدارة المشاريع',
  'eti-hr': 'حاضنة HR الموارد البشرية',
  finance: 'المالية',
  'events-studio-main': 'استوديو الفعاليات',
  collections: 'التحصيل',
  approvals: 'الموافقات المالية',
  requests: 'الطلبات',
  'payment-menu': 'نظام الدفع',
  'employee-menu': 'الموظف',
  'supply-chain': 'سلاسل التوريد',
  sales: 'البيع',
  'internet-automation': 'الإنترنت والأتمتة',
  'occupational-health': 'السلامة والصحة المهنية',
  services: 'الخدمات',
  entities: 'المستأجرين',
  employees: 'إدارة الموظفين',
  'hr-policies': 'سياسات الموارد البشرية',
  'hr-tasks-management': 'إدارة مهام الموارد البشرية',
  'emp-leaves': 'إجازات الموظفين',
  'leave-balance': 'رصيد الإجازات',
  'notifications-warnings': 'الإشعارات والتحذيرات',
  'emp-decisions': 'قرارات الموظفين',
  'company-violations': 'مخالفات الشركة',
  'evaluation-forms': 'نماذج التقييم',
  circulars: 'التعاميم',
  'advances-receivables': 'السلف والمستحقات',
  surveys: 'الاستبيانات',
  'business-activities': 'الأنشطة التجارية',
  'emp-letters': 'خطابات الموظفين',
  custodies: 'العهد',
  'assets-custodies': 'عهد الأصول',
  'salary-slips': 'مسيرات الرواتب',
  'attendance-register': 'سجل الحضور',
  'attendance-table': 'جدول الحضور',
  ads: 'الإعلانات',
  'tasks-management': 'المهام',
  facilities: 'إدارة المرافق',
  settings: 'إعدادات الصفحة الرئيسية',
  'audit-logs': 'سجل النظام',
  'executive-management': 'الإدارة التنفيذية',
  'information-center': 'مركز المعلومات',
  'e-offices': 'المكاتب الالكترونيه',
  platforms: 'المنصات',
  'incubators-hub': 'الحاضنات',
  'naiosh-sectors': 'قطاعات نايوش',
  'operational-policies': 'السياسات التشغيلية المعتمدة',
  'invoices-enhanced': 'الفواتير الذكية',
  'payment-methods': 'طرق الدفع',
  'attendance-departure': 'الحضور والانصراف',
  'emp-requests': 'طلبات الموظفين',
  'main-menu': 'القائمة الرئيسية',
  'control-panel': 'لوحة التحكم',
  'my-tasks': 'مهامي',
  'eo-daily-operations': 'العمليات اليومية - المكاتب',
  'pl-daily-operations': 'العمليات اليومية - المنصات',
  'ic-daily-operations': 'العمليات اليومية - الحاضنات',
  'sc-member-management': 'إدارة الأعضاء',
  'settings-admin': 'الاعدادات',
  'collections-strategic': 'التحصيل (استراتيجي)',
  reports: 'التقارير (استراتيجي)',
  'quality-audit': 'الجودة والتدقيق',
  marketing: 'استديو الحملات التسويقية',
  'marketing-campaigns-studio': 'استديو الحملات التسويقية',
  tenants: 'المستأجرين (استراتيجي)'
};

let runtimeRouteParents = null;
let financeRouteEntries = null;

function financeRelativePathToKey(relativePath) {
  const normalized = String(relativePath || '')
    .replace(/\\/g, '/')
    .replace(/\.html$/i, '')
    .replace(/^\/+/, '');
  if (!normalized || normalized === 'index') return 'finance';
  return `finance__${normalized.replace(/\//g, '__')}`;
}

function financeRelativePathToLabel(relativePath) {
  const normalized = String(relativePath || '').replace(/\\/g, '/').replace(/\.html$/i, '');
  const base = path.basename(normalized);
  const parent = path.basename(path.dirname(normalized));
  if (FINANCE_FILE_LABELS[normalized]) return FINANCE_FILE_LABELS[normalized];
  if (FINANCE_FILE_LABELS[base]) return FINANCE_FILE_LABELS[base];
  if (parent && parent !== '.' && base !== parent) {
    return `${parent} / ${base.replace(/-/g, ' ')}`;
  }
  return base.replace(/-/g, ' ');
}

function collectFinanceRouteEntries() {
  if (financeRouteEntries) return financeRouteEntries;
  const financeRoot = path.join(__dirname, 'finance');
  const entries = [{ key: 'finance', label: 'المالية', routePath: '/finance' }];
  const seen = new Set(['finance']);

  const walk = (currentDir, relativeDir = '') => {
    if (!fs.existsSync(currentDir)) return;
    const items = fs.readdirSync(currentDir, { withFileTypes: true });
    items.forEach((item) => {
      const rel = relativeDir ? `${relativeDir}/${item.name}` : item.name;
      const abs = path.join(currentDir, item.name);
      if (item.isDirectory()) {
        walk(abs, rel);
        return;
      }
      if (!item.name.endsWith('.html')) return;
      const key = financeRelativePathToKey(rel);
      if (seen.has(key)) return;
      seen.add(key);
      const routePath = `/finance/${rel.replace(/\\/g, '/')}`;
      entries.push({
        key,
        label: financeRelativePathToLabel(rel),
        routePath
      });
      PAGE_LABELS[key] = financeRelativePathToLabel(rel);
    });
  };

  walk(financeRoot);
  financeRouteEntries = entries.sort((a, b) => a.label.localeCompare(b.label, 'ar'));
  return financeRouteEntries;
}

function getRuntimeRouteParents() {
  if (runtimeRouteParents) return runtimeRouteParents;
  runtimeRouteParents = { ...OFFICE_ROUTE_PARENTS };

  Object.entries(ROUTE_TO_PATH).forEach(([key, routePath]) => {
    if (routePath === '/hr' || routePath.startsWith('/hr/')) {
      if (key !== 'hr') runtimeRouteParents[key] = 'hr';
    }
  });

  collectFinanceRouteEntries().forEach((entry) => {
    if (entry.key !== 'finance') {
      runtimeRouteParents[entry.key] = 'finance';
      ROUTE_TO_PATH[entry.key] = entry.routePath;
    }
  });

  return runtimeRouteParents;
}

function getChildrenByParent() {
  const map = {};
  const parents = getRuntimeRouteParents();
  Object.entries(parents).forEach(([child, parent]) => {
    if (!map[parent]) map[parent] = [];
    map[parent].push(child);
  });
  Object.values(map).forEach((list) => list.sort());
  return map;
}

function buildHrPages() {
  const pages = [{ key: 'hr', label: getPageLabel('hr') }];
  const seen = new Set(['hr']);
  Object.entries(ROUTE_TO_PATH).forEach(([key, routePath]) => {
    if ((routePath === '/hr' || routePath.startsWith('/hr/')) && !seen.has(key)) {
      pages.push({ key, label: getPageLabel(key) });
      seen.add(key);
    }
  });
  return pages.sort((a, b) => a.label.localeCompare(b.label, 'ar'));
}

function buildFinancePages() {
  return collectFinanceRouteEntries().map(({ key, label }) => ({ key, label }));
}

function getPagesForSystem(systemKey) {
  const normalized = normalizePageKey(systemKey);
  if (normalized === 'hr') return buildHrPages();
  if (normalized === 'finance') return buildFinancePages();

  const children = getChildrenByParent()[normalized] || [];
  const pages = [{ key: normalized, label: getPageLabel(normalized) }];
  children.forEach((child) => {
    pages.push({ key: child, label: getPageLabel(child) });
  });
  return pages;
}

function getSystemRootKeys() {
  getRuntimeRouteParents();
  const childKeys = new Set(Object.keys(getRuntimeRouteParents()));
  const parentKeys = new Set(Object.values(getRuntimeRouteParents()));
  const roots = new Set(parentKeys);
  Object.keys(PAGE_LABELS).forEach((key) => {
    if (!childKeys.has(key)) roots.add(key);
  });
  collectFinanceRouteEntries().forEach((entry) => roots.add(entry.key.split('__')[0]));
  return [...roots];
}

function buildPermissionRegistry() {
  if (cachedRegistry) return cachedRegistry;

  getRuntimeRouteParents();
  const allSystems = getSystemRootKeys()
    .map((key) => ({
      key,
      label: getPageLabel(key),
      pages: getPagesForSystem(key),
      isPrimary: PRIMARY_TENANT_SYSTEM_KEYS.includes(key)
    }))
    .filter((system) => system.pages.length > 0);

  const primaryKeys = new Set(PRIMARY_TENANT_SYSTEM_KEYS);
  const primarySystems = PRIMARY_TENANT_SYSTEM_KEYS
    .map((key) => allSystems.find((system) => system.key === key))
    .filter(Boolean);
  const otherSystems = allSystems
    .filter((system) => !primaryKeys.has(system.key))
    .sort((a, b) => a.label.localeCompare(b.label, 'ar'));

  cachedRegistry = {
    systems: [...primarySystems, ...otherSystems],
    primarySystems,
    otherSystems,
    generatedAt: new Date().toISOString()
  };
  return cachedRegistry;
}

function getPathToPageKeysMap() {
  getRuntimeRouteParents();
  const map = {};
  Object.entries(ROUTE_TO_PATH).forEach(([route, routePath]) => {
    const normalizedPath = routePath.replace(/\/+$/, '') || '/';
    if (!map[normalizedPath]) map[normalizedPath] = [];
    map[normalizedPath].push(normalizePageKey(route));
  });
  return map;
}

function getPageKeysForPath(requestPath) {
  getRuntimeRouteParents();
  const raw = String(requestPath || '').split('?')[0];
  const normalized = raw.replace(/\/+$/, '') || '/';
  const pathMap = getPathToPageKeysMap();

  if (pathMap[normalized]) {
    return [...new Set(pathMap[normalized])];
  }

  const prefixMatches = Object.entries(pathMap)
    .filter(([routePath]) => routePath !== '/' && normalized.startsWith(`${routePath}/`))
    .sort((a, b) => b[0].length - a[0].length);
  if (prefixMatches.length) {
    return [...new Set(prefixMatches[0][1])];
  }

  if (normalized === '/dashboard.html' || normalized === '/home') return ['dashboard'];
  if (normalized === '/archive') return ['records-archive-home'];
  if (normalized.startsWith('/archive/')) {
    const archivePathMap = Object.fromEntries(
      Object.entries(ROUTE_TO_PATH)
        .filter(([, routePath]) => routePath.startsWith('/archive/'))
        .map(([key, routePath]) => [routePath.replace(/\/+$/, ''), key])
    );
    const match = archivePathMap[normalized];
    return match ? [match, 'records-archive-home'] : ['records-archive-home'];
  }
  if (normalized === '/hr') return ['hr'];
  if (normalized.startsWith('/hr/')) {
    const hrMatch = Object.entries(ROUTE_TO_PATH).find(([, routePath]) => routePath.replace(/\/+$/, '') === normalized);
    return hrMatch ? [hrMatch[0], 'hr'] : ['hr'];
  }
  if (normalized === '/finance' || normalized === '/finance/index.html') return ['finance'];
  if (normalized.startsWith('/finance/')) {
    const financeKey = financeRelativePathToKey(normalized.replace(/^\/finance\//, ''));
    return [financeKey, 'finance'];
  }
  if (normalized === '/strategic' || normalized.startsWith('/strategic/')) return ['strategic-management'];
  if (normalized === '/tasks' || normalized.startsWith('/tasks/')) return ['tasks-management'];
  if (normalized === '/settings' || normalized.startsWith('/settings/')) return ['settings'];
  if (normalized === '/e-offices' || normalized.startsWith('/e-offices/')) return ['e-offices'];
  if (normalized === '/platforms' || normalized.startsWith('/platforms/')) return ['platforms'];
  if (normalized === '/branches' || normalized.startsWith('/branches/')) return ['branches-hub'];
  if (normalized === '/incubators-hub' || normalized.startsWith('/incubators-hub/')) return ['incubators-hub'];
  if (normalized === '/sectors' || normalized.startsWith('/sectors/')) return ['naiosh-sectors'];
  if (normalized === '/employee' || normalized.startsWith('/employee/')) return ['employee-menu'];
  return null;
}

function normalizeAllowedPages(pages) {
  if (!Array.isArray(pages)) return [];
  return [...new Set(pages.map(normalizePageKey).filter(Boolean))];
}

function normalizePageRestrictions(pageRestrictions) {
  if (!pageRestrictions || typeof pageRestrictions !== 'object') return {};
  const output = {};
  Object.entries(pageRestrictions).forEach(([systemKey, value]) => {
    if (!value || typeof value !== 'object') return;
    const pages = normalizeAllowedPages(value.pages || []);
    if (!pages.length) return;
    output[normalizePageKey(systemKey)] = {
      restricted: Boolean(value.restricted),
      pages
    };
  });
  return output;
}

function derivePageRestrictionsFromPages(pages) {
  const allowedPages = normalizeAllowedPages(pages);
  const routeParents = getRuntimeRouteParents();
  const childrenByParent = getChildrenByParent();
  const restrictions = {};
  const assignedSystems = new Set();

  allowedPages.forEach((pageKey) => {
    const parent = routeParents[pageKey];
    if (parent) {
      assignedSystems.add(parent);
      if (!restrictions[parent]) {
        restrictions[parent] = { restricted: true, pages: [] };
      }
      restrictions[parent].pages.push(pageKey);
    } else {
      assignedSystems.add(pageKey);
    }
  });

  assignedSystems.forEach((systemKey) => {
    const systemChildren = childrenByParent[systemKey] || [];
    if (!systemChildren.length) return;
    const explicitChildren = allowedPages.filter((pageKey) => routeParents[pageKey] === systemKey);
    if (!explicitChildren.length) return;
    const hasAllChildren = explicitChildren.length >= systemChildren.length
      && systemChildren.every((child) => explicitChildren.includes(child));
    if (hasAllChildren && allowedPages.includes(systemKey)) {
      delete restrictions[systemKey];
      return;
    }
    restrictions[systemKey] = {
      restricted: true,
      pages: [...new Set([systemKey, ...explicitChildren])]
    };
  });

  return restrictions;
}

function mergeRestrictions(storedRestrictions, pages) {
  const normalizedStored = normalizePageRestrictions(storedRestrictions);
  if (Object.keys(normalizedStored).length) {
    return normalizedStored;
  }
  return derivePageRestrictionsFromPages(pages);
}

function buildSavePayload({ pages, pageRestrictions }) {
  const allowedPages = normalizeAllowedPages(pages);
  const restrictions = normalizePageRestrictions(pageRestrictions);
  const outputPages = new Set(allowedPages);
  const outputRestrictions = {};

  Object.entries(restrictions).forEach(([systemKey, value]) => {
    if (!value.restricted) return;
    const systemPages = getPagesForSystem(systemKey).map((page) => page.key);
    const selected = normalizeAllowedPages(value.pages);
    const allSelected = selected.length >= systemPages.length
      && systemPages.every((pageKey) => selected.includes(pageKey));
    outputPages.add(systemKey);
    if (!allSelected) {
      outputRestrictions[systemKey] = {
        restricted: true,
        pages: [...new Set([systemKey, ...selected])]
      };
    }
  });

  return {
    pages: [...outputPages].sort(),
    page_restrictions: outputRestrictions
  };
}

function isRouteAllowed(route, context = {}) {
  const normalizedRoute = normalizePageKey(route);
  if (normalizedRoute === 'download-app') return true;

  const tenantType = context.tenantType || context.tenant_type;
  if (!tenantType || tenantType === 'HQ') return true;
  if (context.entityId === 'HQ001' || context.entity_id === 'HQ001') return true;

  const allowedPages = normalizeAllowedPages(context.allowedPages || context.allowed_pages);
  const pageRestrictions = mergeRestrictions(context.pageRestrictions || context.page_restrictions, allowedPages);

  if (allowedPages.length === 0) {
    return normalizedRoute === 'dashboard';
  }
  if (allowedPages.includes(normalizedRoute)) return true;

  const routeParents = getRuntimeRouteParents();
  const parent = routeParents[normalizedRoute];
  if (parent) {
    const restriction = pageRestrictions[parent];
    if (restriction?.restricted) {
      return restriction.pages.includes(normalizedRoute);
    }
    if (allowedPages.includes(parent)) return true;
  }

  return allowedPages.some((pageKey) => routeParents[pageKey] === normalizedRoute);
}

function isPathAllowed(requestPath, context = {}) {
  const pageKeys = getPageKeysForPath(requestPath);
  if (!pageKeys) return true;
  return pageKeys.some((pageKey) => isRouteAllowed(pageKey, context));
}

module.exports = {
  OFFICE_ROUTE_PARENTS,
  ROUTE_TO_PATH,
  PAGE_LABELS,
  buildPermissionRegistry,
  getPagesForSystem,
  getPageKeysForPath,
  normalizeAllowedPages,
  normalizePageRestrictions,
  derivePageRestrictionsFromPages,
  mergeRestrictions,
  buildSavePayload,
  isRouteAllowed,
  isPathAllowed
};
