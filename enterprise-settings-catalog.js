'use strict';

/**
 * Enterprise Settings Catalog — Phase 1 inventory + hub navigation map.
 *
 * status:
 *   live      → real page + API/backend already exist
 *   partial   → page/API exist but incomplete vs commercial settings depth
 *   planned   → module exists in product navigation but no dedicated settings surface yet
 *   mock      → UI shell / toast-only (must not pretend success)
 *
 * level: platform | company | module
 */

function entry(partial) {
  return {
    searchable: true,
    actions: [],
    ...partial,
    id: partial.id,
    level: partial.level,
    moduleKey: partial.moduleKey || partial.id,
    status: partial.status || 'planned'
  };
}

const PLATFORM_ENTRIES = [
  entry({
    id: 'platform-tenants',
    level: 'platform',
    titleAr: 'إدارة الشركات والمستأجرين',
    titleEn: 'Tenants & Companies',
    descriptionAr: 'إنشاء وتفعيل وتعليق الشركات عبر مركز مالك المنصة.',
    href: '/platform/owner',
    status: 'live',
    owner: 'Platform Owner',
    icon: 'fa-building',
    notes: 'Phase 2 Owner Console + legacy /tenant-admin.html'
  }),
  entry({
    id: 'platform-super-admin',
    level: 'platform',
    titleAr: 'الأدوار والصلاحيات المركزية',
    titleEn: 'Central RBAC',
    descriptionAr: 'إدارة الأدوار، مصفوفة الصلاحيات، صلاحيات المكاتب والمستأجرين.',
    href: '/super-admin-page.html',
    status: 'live',
    owner: 'Platform Owner',
    icon: 'fa-user-shield'
  }),
  entry({
    id: 'platform-homepage',
    level: 'platform',
    titleAr: 'هوية الصفحة الرئيسية للمنصة',
    titleEn: 'Platform Homepage Identity',
    descriptionAr: 'شعار، ألوان، وسائط الهوية للصفحة العامة.',
    href: '/settings',
    status: 'live',
    owner: 'Platform Owner',
    icon: 'fa-palette'
  }),
  entry({
    id: 'platform-payment',
    level: 'platform',
    titleAr: 'بوابات دفع المنصة',
    titleEn: 'Platform Payment Gateways',
    descriptionAr: 'Stripe / PayPal / Paymob على مستوى المنصة.',
    href: '/platform-payment-settings.html',
    status: 'live',
    owner: 'Platform Operator',
    icon: 'fa-credit-card'
  }),
  entry({
    id: 'platform-saas-signup',
    level: 'platform',
    titleAr: 'كتالوج أنظمة الاشتراك',
    titleEn: 'SaaS Systems Catalog',
    descriptionAr: 'باقات ووحدات قابلة للتعديل في مركز مالك المنصة.',
    href: '/platform/owner',
    status: 'live',
    owner: 'Platform Operator',
    icon: 'fa-layer-group',
    notes: 'Phase 2: /api/platform-owner/plans + console. Public catalog remains /api/saas/systems-catalog.'
  }),
  entry({
    id: 'platform-subscriptions',
    level: 'platform',
    titleAr: 'الباقات والاشتراكات',
    titleEn: 'Plans & Subscriptions',
    descriptionAr: 'تعديل الباقات وحدود المستخدمين والتخزين والوحدات.',
    href: '/platform/owner',
    status: 'live',
    owner: 'Platform Owner',
    icon: 'fa-gem',
    notes: 'Phase 2 Owner Console — plans/subscriptions/licenses APIs live.'
  }),
  entry({
    id: 'platform-ops-health',
    level: 'platform',
    titleAr: 'تشغيل المنصة والمراقبة',
    titleEn: 'Platform Ops & Health',
    descriptionAr: 'صحة الخدمات، Feature Flags، تنبيهات تشغيلية.',
    href: '/platform/owner',
    status: 'live',
    owner: 'SRE',
    icon: 'fa-heartbeat',
    notes: 'Phase 2: /api/platform-owner/ops/health + flags.'
  })
];

const COMPANY_ENTRIES = [
  entry({
    id: 'company-branding',
    level: 'company',
    moduleKey: 'branding',
    titleAr: 'الهوية المؤسسية للشركة',
    titleEn: 'Company Branding',
    descriptionAr: 'شعار، ألوان، بانر، حساب دخول الشركة.',
    href: '/tenant-branding-settings.html',
    status: 'live',
    owner: 'Company Admin',
    icon: 'fa-id-badge'
  }),
  entry({
    id: 'company-payment',
    level: 'company',
    moduleKey: 'payments',
    titleAr: 'بوابات دفع الشركة',
    titleEn: 'Company Payment Gateways',
    descriptionAr: 'إعدادات Stripe/PayPal/Paymob للمستأجر.',
    href: '/tenant-payment-settings.html',
    status: 'live',
    owner: 'Company Admin',
    icon: 'fa-wallet'
  }),
  entry({
    id: 'company-email',
    level: 'company',
    moduleKey: 'email',
    titleAr: 'بريد الشركة SMTP',
    titleEn: 'Company Email (SMTP)',
    descriptionAr: 'SMTP عبر /api/tenant-settings/email داخل مركز إعدادات الشركة.',
    href: '/company/settings',
    api: '/api/tenant-settings/email',
    status: 'live',
    owner: 'Company Admin',
    icon: 'fa-envelope',
    notes: 'Phase 3 center integrations tab + existing email API.'
  }),
  entry({
    id: 'company-seo',
    level: 'company',
    moduleKey: 'seo',
    titleAr: 'SEO الموقع العام للشركة',
    titleEn: 'Company Public SEO',
    api: '/api/tenant-settings/seo',
    href: '/company/settings',
    status: 'live',
    owner: 'Company Admin',
    icon: 'fa-search',
    notes: 'Phase 3 center + existing SEO API.'
  }),
  entry({
    id: 'company-ai',
    level: 'company',
    moduleKey: 'ai',
    titleAr: 'ضوابط الذكاء الاصطناعي للشركة',
    titleEn: 'Company AI Controls',
    api: '/api/tenant-settings/ai',
    href: '/company/settings',
    status: 'live',
    owner: 'Company Admin',
    icon: 'fa-robot',
    notes: 'Phase 3 center + existing AI API.'
  }),
  entry({
    id: 'company-org',
    level: 'company',
    moduleKey: 'organization',
    titleAr: 'الفروع والأقسام',
    titleEn: 'Branches & Departments',
    descriptionAr: 'CRUD حقيقي على tenant_branches / tenant_departments / المسميات / المواقع.',
    href: '/company/settings',
    spaRoute: 'settings-branches-sections',
    status: 'live',
    owner: 'Company Admin',
    icon: 'fa-code-branch',
    notes: 'Phase 3: /api/company-settings/org/*'
  }),
  entry({
    id: 'company-users-roles',
    level: 'company',
    moduleKey: 'iam',
    titleAr: 'المستخدمون والأدوار',
    titleEn: 'Users & Roles',
    descriptionAr: 'مستخدمو الشركة والدعوات عبر مركز الإعدادات + /api/tenant-users.',
    href: '/company/settings',
    status: 'live',
    owner: 'Company Admin',
    icon: 'fa-users-cog',
    notes: 'Phase 3 invites + Phase 4 accept at /invite/accept + /api/company-settings/invites/accept.'
  }),
  entry({
    id: 'company-general',
    level: 'company',
    moduleKey: 'general',
    titleAr: 'إعدادات عامة (لغة / منطقة / عملة)',
    titleEn: 'General Company Settings',
    href: '/company/settings',
    spaRoute: 'settings-general',
    status: 'live',
    owner: 'Company Admin',
    icon: 'fa-cogs',
    notes: 'Phase 3: Settings Engine key company.general + tenant_settings mirror.'
  })
];

const MODULE_ENTRIES = [
  // HR
  entry({
    id: 'module-hr-settings',
    level: 'module',
    moduleKey: 'hr',
    groupAr: 'الموارد البشرية',
    titleAr: 'مركز إعدادات الموارد البشرية (91 بلاطة)',
    titleEn: 'HR System Settings Hub',
    href: '/hr/system-settings',
    status: 'live',
    owner: 'HR Admin',
    icon: 'fa-user-tie'
  }),
  entry({
    id: 'module-hr-home',
    level: 'module',
    moduleKey: 'hr',
    groupAr: 'الموارد البشرية',
    titleAr: 'بوابة الموارد البشرية',
    href: '/hr',
    status: 'live',
    owner: 'HR Admin',
    icon: 'fa-house-user'
  }),
  entry({
    id: 'module-hr-payroll',
    level: 'module',
    moduleKey: 'hr',
    groupAr: 'الموارد البشرية',
    titleAr: 'مركز الرواتب',
    href: '/modules/settings',
    status: 'live',
    owner: 'HR Admin',
    icon: 'fa-money-check-dollar',
    notes: 'Phase 4: module.hr.payroll + /hr/payroll-hub + HR 91 tiles.'
  }),
  entry({
    id: 'module-hr-attendance',
    level: 'module',
    moduleKey: 'hr',
    groupAr: 'الموارد البشرية',
    titleAr: 'الحضور والانصراف',
    href: '/modules/settings',
    status: 'live',
    owner: 'HR Admin',
    icon: 'fa-clock',
    notes: 'Phase 4: module.hr.attendance + leave policy enforcement on /api/leave-requests.'
  }),
  entry({
    id: 'module-hr-workflow',
    level: 'module',
    moduleKey: 'hr',
    groupAr: 'الموارد البشرية',
    titleAr: 'محرك سير عمل HR',
    href: '/hr/workflow-engine',
    status: 'live',
    owner: 'HR Admin',
    icon: 'fa-diagram-project',
    notes: 'Phase 5: wf_definitions/wf_instances in PostgreSQL; canvas saves via /api/shared-services; bridges employee-requests.'
  }),

  // Finance
  entry({
    id: 'module-finance-home',
    level: 'module',
    moduleKey: 'finance',
    groupAr: 'المالية',
    titleAr: 'لوحة المالية',
    href: '/finance',
    status: 'live',
    owner: 'Finance Admin',
    icon: 'fa-coins'
  }),
  entry({
    id: 'module-finance-coa',
    level: 'module',
    moduleKey: 'finance',
    groupAr: 'المالية',
    titleAr: 'دليل الحسابات',
    href: '/finance/chart-of-accounts.html',
    status: 'live',
    owner: 'Finance Admin',
    icon: 'fa-sitemap'
  }),
  entry({
    id: 'module-finance-tax',
    level: 'module',
    moduleKey: 'finance',
    groupAr: 'المالية',
    titleAr: 'إعدادات الضرائب',
    href: '/manage-tax-settings.html',
    status: 'live',
    owner: 'Finance Admin',
    icon: 'fa-percent'
  }),
  entry({
    id: 'module-finance-plans',
    level: 'module',
    moduleKey: 'finance',
    groupAr: 'المالية',
    titleAr: 'خطط الدفع والأقساط',
    href: '/finance/payment-plans.html',
    status: 'live',
    owner: 'Finance Admin',
    icon: 'fa-file-invoice-dollar'
  }),
  entry({
    id: 'module-finance-policies',
    level: 'module',
    moduleKey: 'finance',
    groupAr: 'المالية',
    titleAr: 'السياسات المالية',
    href: '/modules/settings',
    status: 'live',
    owner: 'Finance Admin',
    icon: 'fa-scale-balanced',
    notes: 'Phase 4: module.finance.* (tax/invoicing/treasury/approvals/cost_centers/assets).'
  }),
  entry({
    id: 'module-finance-fiscal',
    level: 'module',
    moduleKey: 'finance',
    groupAr: 'المالية',
    titleAr: 'الفترات والسنوات المالية',
    href: '/modules/settings',
    status: 'live',
    owner: 'Finance Admin',
    icon: 'fa-calendar-days',
    notes: 'Phase 4: fiscal_years/fiscal_periods + posting gate on invoices.'
  }),

  // Sales / CRM
  entry({
    id: 'module-sales-crm',
    level: 'module',
    moduleKey: 'sales',
    groupAr: 'المبيعات والعملاء',
    titleAr: 'CRM / المبيعات',
    spaRoute: 'crm',
    href: '/modules/settings',
    status: 'live',
    owner: 'Sales Admin',
    icon: 'fa-handshake',
    notes: 'Phase 4: module.sales.crm pipeline settings in Settings Engine.'
  }),
  entry({
    id: 'module-sales-pos',
    level: 'module',
    moduleKey: 'sales',
    groupAr: 'المبيعات والعملاء',
    titleAr: 'نقاط البيع POS',
    spaRoute: 'pos',
    href: '/modules/settings',
    status: 'live',
    owner: 'Sales Admin',
    icon: 'fa-cash-register',
    notes: 'Phase 4: module.sales.pos + /ops/evaluate-pos stock gate.'
  }),
  entry({
    id: 'module-finance-customers',
    level: 'module',
    moduleKey: 'sales',
    groupAr: 'المبيعات والعملاء',
    titleAr: 'العملاء (Finance)',
    href: '/finance/customers.html',
    status: 'live',
    owner: 'Sales/Finance',
    icon: 'fa-user-group'
  }),

  // Supply chain
  entry({
    id: 'module-inventory',
    level: 'module',
    moduleKey: 'supply-chain',
    groupAr: 'المشتريات والمخزون',
    titleAr: 'المخزون',
    spaRoute: 'inventory',
    href: '/modules/settings',
    status: 'live',
    owner: 'Ops',
    icon: 'fa-boxes-stacked',
    notes: 'Phase 4: module.inventory.stock + low/negative stock evaluation.'
  }),
  entry({
    id: 'module-purchases',
    level: 'module',
    moduleKey: 'supply-chain',
    groupAr: 'المشتريات والمخزون',
    titleAr: 'المشتريات',
    spaRoute: 'purchases',
    href: '/modules/settings',
    status: 'live',
    owner: 'Ops',
    icon: 'fa-cart-shopping',
    notes: 'Phase 4: module.purchases.orders approval threshold.'
  }),
  entry({
    id: 'module-suppliers',
    level: 'module',
    moduleKey: 'supply-chain',
    groupAr: 'المشتريات والمخزون',
    titleAr: 'الموردون',
    spaRoute: 'suppliers',
    href: '/modules/settings',
    status: 'live',
    owner: 'Ops',
    icon: 'fa-truck',
    notes: 'Phase 4: module.suppliers.policies.'
  }),

  // Tasks / Projects / Facilities
  entry({
    id: 'module-tasks',
    level: 'module',
    moduleKey: 'tasks-management',
    groupAr: 'المشروعات والمهام',
    titleAr: 'إدارة المهام',
    href: '/modules/settings',
    status: 'live',
    owner: 'PMO',
    icon: 'fa-list-check',
    notes: 'Phase 4: module.tasks.projects + assignee gate.'
  }),
  entry({
    id: 'module-task-settings',
    level: 'module',
    moduleKey: 'tasks-management',
    groupAr: 'المشروعات والمهام',
    titleAr: 'إعدادات المهام',
    spaRoute: 'task-settings',
    href: '/modules/settings',
    status: 'live',
    owner: 'PMO',
    icon: 'fa-sliders',
    notes: 'Phase 4: real Settings Engine persistence (no local-only checkboxes).'
  }),
  entry({
    id: 'module-facilities',
    level: 'module',
    moduleKey: 'facilities',
    groupAr: 'المرافق والأصول',
    titleAr: 'المرافق',
    href: '/modules/settings',
    status: 'live',
    owner: 'Facilities',
    icon: 'fa-building-circle-check',
    notes: 'Phase 4: module.facilities.assets.'
  }),
  entry({
    id: 'module-fixed-assets',
    level: 'module',
    moduleKey: 'finance',
    groupAr: 'المرافق والأصول',
    titleAr: 'الأصول الثابتة',
    href: '/finance/fixed-assets.html',
    status: 'live',
    owner: 'Finance Admin',
    icon: 'fa-landmark'
  }),
  entry({
    id: 'module-hr-custodies',
    level: 'module',
    moduleKey: 'hr',
    groupAr: 'المرافق والأصول',
    titleAr: 'العهد والأملاك',
    href: '/finance/hr-assets-custodies.html',
    status: 'live',
    owner: 'HR Admin',
    icon: 'fa-box-open'
  }),

  // Documents / Approvals / Templates
  entry({
    id: 'module-approvals-governance',
    level: 'module',
    moduleKey: 'workflows',
    groupAr: 'الموافقات والقوالب',
    titleAr: 'الحوكمة والأدوار والموافقات',
    href: '/modules/settings',
    status: 'live',
    owner: 'Auditor',
    icon: 'fa-gavel',
    notes: 'Phase 4: module.workflows.approvals in Settings Engine.'
  }),
  entry({
    id: 'module-contracts',
    level: 'module',
    moduleKey: 'documents',
    groupAr: 'الموافقات والقوالب',
    titleAr: 'العقود',
    href: '/finance/contracts.html',
    status: 'live',
    owner: 'Ops',
    icon: 'fa-file-contract'
  }),
  entry({
    id: 'module-templates-email',
    level: 'module',
    moduleKey: 'templates',
    groupAr: 'الموافقات والقوالب',
    titleAr: 'قوالب البريد (مركز الإعدادات القديم)',
    spaRoute: 'settings-email-templates',
    href: '/modules/settings',
    status: 'live',
    owner: 'Comms',
    icon: 'fa-at',
    notes: 'Phase 4: module_templates table + /api/module-settings/templates.'
  }),
  entry({
    id: 'module-templates-sms',
    level: 'module',
    moduleKey: 'templates',
    groupAr: 'الموافقات والقوالب',
    titleAr: 'قوالب SMS',
    spaRoute: 'settings-sms-templates',
    href: '/modules/settings',
    status: 'live',
    owner: 'Comms',
    icon: 'fa-comments',
    notes: 'Phase 4: persisted module_templates (sms).'
  }),
  entry({
    id: 'module-templates-print',
    level: 'module',
    moduleKey: 'templates',
    groupAr: 'الموافقات والقوالب',
    titleAr: 'قوالب الطباعة',
    spaRoute: 'settings-print-templates',
    href: '/modules/settings',
    status: 'live',
    owner: 'Comms',
    icon: 'fa-print',
    notes: 'Phase 4: persisted module_templates (print).'
  }),
  entry({
    id: 'module-numbering',
    level: 'module',
    moduleKey: 'templates',
    groupAr: 'الموافقات والقوالب',
    titleAr: 'أنظمة الترقيم',
    spaRoute: 'settings-numbering-systems',
    href: '/modules/settings',
    status: 'live',
    owner: 'Quality',
    icon: 'fa-hashtag',
    notes: 'Phase 4: module.templates.numbering + module_numbering_counters.'
  }),

  // Notifications / Backup / Security / AI
  entry({
    id: 'module-notifications',
    level: 'module',
    moduleKey: 'notifications',
    groupAr: 'الإشعارات والأمان والنسخ',
    titleAr: 'مركز إشعارات HR',
    href: '/modules/settings',
    status: 'live',
    owner: 'Ops',
    icon: 'fa-bell',
    notes: 'Phase 4: module.notifications.channels (+ company.notifications).'
  }),
  entry({
    id: 'module-backup',
    level: 'module',
    moduleKey: 'backup',
    groupAr: 'الإشعارات والأمان والنسخ',
    titleAr: 'النسخ الاحتياطي',
    spaRoute: 'settings-backup',
    href: '/shared/services',
    status: 'live',
    owner: 'IT',
    icon: 'fa-database',
    notes: 'Phase 5: backup_jobs/runs + logical dump; restore-test only with CONFIRM_DESTRUCTIVE_RESTORE + TEST_RESTORE_DATABASE_URL (never production).'
  }),
  entry({
    id: 'module-audit',
    level: 'module',
    moduleKey: 'security',
    groupAr: 'الإشعارات والأمان والنسخ',
    titleAr: 'سجل التدقيق',
    spaRoute: 'audit-logs',
    href: '/modules/settings',
    status: 'live',
    owner: 'Auditor',
    icon: 'fa-clipboard-list',
    notes: 'Phase 4: module.audit.retention + setting_audit_events for module.* keys.'
  }),
  entry({
    id: 'module-permissions-tile',
    level: 'module',
    moduleKey: 'iam',
    groupAr: 'الإشعارات والأمان والنسخ',
    titleAr: 'الصلاحيات (من شبكة الإعدادات)',
    href: '/super-admin-page.html',
    status: 'live',
    owner: 'Security',
    icon: 'fa-lock',
    notes: 'كانت بلاطة toast؛ أصبح الرابط الحقيقي لـ Super Admin.'
  })
];

const ALL_ENTRIES = [...PLATFORM_ENTRIES, ...COMPANY_ENTRIES, ...MODULE_ENTRIES];

function getCatalog({ includeMock = true } = {}) {
  const entries = includeMock ? ALL_ENTRIES : ALL_ENTRIES.filter((e) => e.status !== 'mock');
  const byLevel = {
    platform: entries.filter((e) => e.level === 'platform'),
    company: entries.filter((e) => e.level === 'company'),
    module: entries.filter((e) => e.level === 'module')
  };
  const counts = {
    total: entries.length,
    live: entries.filter((e) => e.status === 'live').length,
    partial: entries.filter((e) => e.status === 'partial').length,
    planned: entries.filter((e) => e.status === 'planned').length,
    mock: entries.filter((e) => e.status === 'mock').length
  };
  return {
    version: 'phase6-2026-10-16',
    generatedAt: new Date().toISOString(),
    levels: [
      { id: 'platform', titleAr: 'إعدادات المنصة', titleEn: 'Platform Settings' },
      { id: 'company', titleAr: 'إعدادات الشركة', titleEn: 'Company Settings' },
      { id: 'module', titleAr: 'إعدادات الوحدات', titleEn: 'Module Settings' }
    ],
    counts,
    byLevel,
    entries
  };
}

function getSeedDefinitions() {
  return ALL_ENTRIES
    .filter((e) => e.status === 'live' || e.status === 'partial')
    .map((e) => ({
      key: `nav.${e.id}`,
      scope: e.level === 'platform' ? 'platform' : e.level === 'company' ? 'tenant' : 'module',
      module_key: e.moduleKey,
      data_type: 'json',
      default_value: {
        href: e.href || null,
        spaRoute: e.spaRoute || null,
        enabled: e.status === 'live' || e.status === 'partial'
      },
      label_ar: e.titleAr,
      label_en: e.titleEn || e.titleAr,
      description_ar: e.descriptionAr || e.notes || null,
      is_sensitive: false
    }));
}

module.exports = {
  getCatalog,
  getSeedDefinitions,
  ALL_ENTRIES,
  PLATFORM_ENTRIES,
  COMPANY_ENTRIES,
  MODULE_ENTRIES
};
