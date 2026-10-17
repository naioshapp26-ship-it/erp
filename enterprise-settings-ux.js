'use strict';

/**
 * User-facing organization for the Enterprise Settings Hub.
 * Does NOT replace the catalog engine — only groups and labels the existing 47 entries.
 */

const UX_SECTIONS = [
  {
    id: 'appearance',
    titleAr: 'شكل الموقع والهوية',
    descriptionAr: 'الشعار، الاسم، الألوان، وصورة الهوية — غيّرها ثم عاين واحفظ.',
    icon: 'fa-palette',
    accent: 'from-rose-700 to-red-800'
  },
  {
    id: 'pages-nav',
    titleAr: 'الصفحات والقوائم',
    descriptionAr: 'الصفحات العامة والقوالب والترقيم — دون كسر مسارات النظام.',
    icon: 'fa-sitemap',
    accent: 'from-red-800 to-rose-900'
  },
  {
    id: 'org',
    titleAr: 'الشركات والفروع',
    descriptionAr: 'إضافة الشركات والفروع والأقسام وتنظيم الهيكل.',
    icon: 'fa-building',
    accent: 'from-amber-600 to-yellow-700'
  },
  {
    id: 'users',
    titleAr: 'المستخدمون والصلاحيات',
    descriptionAr: 'الموظفون والأدوار ومن يمكنه رؤية ماذا.',
    icon: 'fa-users-gear',
    accent: 'from-slate-700 to-slate-900'
  },
  {
    id: 'systems',
    titleAr: 'إعدادات الأنظمة',
    descriptionAr: 'الموارد البشرية، المالية، المبيعات، المخزون، والمرافق.',
    icon: 'fa-cubes',
    accent: 'from-rose-800 to-red-900'
  },
  {
    id: 'subscriptions',
    titleAr: 'الاشتراكات والباقات',
    descriptionAr: 'الباقات وحدود المستخدمين والتخزين ووحدات الاشتراك.',
    icon: 'fa-gem',
    accent: 'from-yellow-600 to-amber-700'
  },
  {
    id: 'notifications',
    titleAr: 'الإشعارات والرسائل',
    descriptionAr: 'البريد، الرسائل النصية، وقوالب التنبيه.',
    icon: 'fa-bell',
    accent: 'from-red-700 to-rose-800'
  },
  {
    id: 'security',
    titleAr: 'الأمان والنسخ الاحتياطي',
    descriptionAr: 'النسخ الاحتياطي، سجل التدقيق، ومراقبة التشغيل.',
    icon: 'fa-shield-halved',
    accent: 'from-slate-800 to-zinc-900'
  }
];

/** Primary section for each catalog entry id (exactly one — covers all 47). */
const ENTRY_SECTION = {
  'platform-homepage': 'appearance',
  'company-branding': 'appearance',
  'company-seo': 'appearance',
  'company-general': 'appearance',

  'module-templates-print': 'pages-nav',
  'module-numbering': 'pages-nav',
  'module-contracts': 'pages-nav',

  'platform-tenants': 'org',
  'company-org': 'org',

  'platform-super-admin': 'users',
  'company-users-roles': 'users',
  'module-permissions-tile': 'users',
  'module-approvals-governance': 'users',

  'platform-payment': 'systems',
  'company-payment': 'systems',
  'company-ai': 'systems',
  'module-hr-settings': 'systems',
  'module-hr-home': 'systems',
  'module-hr-payroll': 'systems',
  'module-hr-attendance': 'systems',
  'module-hr-workflow': 'systems',
  'module-finance-home': 'systems',
  'module-finance-coa': 'systems',
  'module-finance-tax': 'systems',
  'module-finance-plans': 'systems',
  'module-finance-policies': 'systems',
  'module-finance-fiscal': 'systems',
  'module-sales-crm': 'systems',
  'module-sales-pos': 'systems',
  'module-finance-customers': 'systems',
  'module-inventory': 'systems',
  'module-purchases': 'systems',
  'module-suppliers': 'systems',
  'module-tasks': 'systems',
  'module-task-settings': 'systems',
  'module-facilities': 'systems',
  'module-fixed-assets': 'systems',
  'module-hr-custodies': 'systems',

  'platform-saas-signup': 'subscriptions',
  'platform-subscriptions': 'subscriptions',

  'company-email': 'notifications',
  'module-notifications': 'notifications',
  'module-templates-email': 'notifications',
  'module-templates-sms': 'notifications',

  'module-backup': 'security',
  'module-audit': 'security',
  'platform-ops-health': 'security'
};

/** Friendlier Arabic titles for hub cards (catalog titles stay unchanged for API/tests). */
const FRIENDLY_TITLE = {
  'platform-homepage': 'هوية الصفحة الرئيسية',
  'platform-tenants': 'إدارة الشركات',
  'platform-super-admin': 'الأدوار والصلاحيات',
  'platform-payment': 'بوابات الدفع (المنصة)',
  'platform-saas-signup': 'كتالوج أنظمة الاشتراك',
  'platform-subscriptions': 'الباقات وحدود الاشتراك',
  'platform-ops-health': 'مراقبة تشغيل المنصة',
  'company-branding': 'شعار واسم وألوان الشركة',
  'company-payment': 'بوابات الدفع (الشركة)',
  'company-email': 'بريد الشركة والإرسال',
  'company-seo': 'ظهور الموقع في محركات البحث',
  'company-ai': 'ضوابط الذكاء الاصطناعي',
  'company-org': 'الفروع والأقسام',
  'company-users-roles': 'مستخدمو الشركة وأدوارهم',
  'company-general': 'اللغة والمنطقة والعملة',
  'module-hr-settings': 'إعدادات الموارد البشرية',
  'module-hr-home': 'بوابة الموارد البشرية',
  'module-hr-payroll': 'إعدادات الرواتب',
  'module-hr-attendance': 'الحضور والانصراف',
  'module-hr-workflow': 'سير عمل الموارد البشرية',
  'module-finance-home': 'لوحة المالية',
  'module-finance-coa': 'دليل الحسابات',
  'module-finance-tax': 'إعدادات الضرائب',
  'module-finance-plans': 'خطط الدفع والأقساط',
  'module-finance-policies': 'السياسات المالية',
  'module-finance-fiscal': 'السنوات والفترات المالية',
  'module-sales-crm': 'المبيعات وإدارة العملاء',
  'module-sales-pos': 'نقاط البيع',
  'module-finance-customers': 'سجل العملاء',
  'module-inventory': 'المخزون',
  'module-purchases': 'المشتريات',
  'module-suppliers': 'الموردون',
  'module-tasks': 'المهام',
  'module-task-settings': 'إعدادات المهام',
  'module-facilities': 'المرافق',
  'module-fixed-assets': 'الأصول الثابتة',
  'module-hr-custodies': 'العهد',
  'module-approvals-governance': 'الموافقات والحوكمة',
  'module-contracts': 'العقود والخطابات',
  'module-templates-email': 'قوالب رسائل البريد',
  'module-templates-sms': 'قوالب الرسائل النصية',
  'module-templates-print': 'قوالب الطباعة',
  'module-numbering': 'أنظمة الترقيم',
  'module-notifications': 'مركز الإشعارات',
  'module-backup': 'النسخ الاحتياطي',
  'module-audit': 'سجل التدقيق',
  'module-permissions-tile': 'مصفوفة الصلاحيات'
};

const FRIENDLY_DESC = {
  'company-branding': 'غيّر الشعار والاسم والألوان مع معاينة مباشرة قبل الحفظ (داخل مساحة الشركة).',
  'platform-homepage': 'هوية الصفحة العامة للمنصة (شعار وألوان ووسائط) — لمالك المنصة.',
  'company-org': 'أضف فرعاً أو قسماً وعدّل الهيكل التنظيمي للشركة.',
  'company-users-roles': 'أضف مستخدمين وحدّد صلاحياتهم داخل الشركة.',
  'module-hr-payroll': 'إعدادات الرواتب والبدلات وفق ما يدعمه نظام الموارد البشرية.',
  'platform-subscriptions': 'عدّل الباقات وحدود الاستخدام من مركز مالك المنصة.'
};

const LEVEL_LABEL = {
  platform: 'إعدادات المنصة',
  company: 'إعدادات الشركة',
  module: 'إعدادات الوحدة'
};

/** Arabic search phrases → preferred entry id (opens a real screen). */
const SEARCH_ALIASES = [
  { q: ['تغيير الشعار', 'الشعار', 'شعار الموقع', 'رفع شعار', 'logo'], entryId: 'company-branding' },
  { q: ['تغيير لون', 'لون الموقع', 'الألوان', 'تغيير الألوان', 'color'], entryId: 'company-branding' },
  { q: ['اسم الموقع', 'اسم الشركة', 'تغيير الاسم'], entryId: 'company-branding' },
  { q: ['هوية', 'branding', 'بانر'], entryId: 'company-branding' },
  { q: ['صفحة رئيسية', 'هوية المنصة'], entryId: 'platform-homepage' },
  { q: ['إضافة موظف', 'موظفين', 'مستخدم جديد'], entryId: 'company-users-roles' },
  { q: ['تعديل الصلاحيات', 'الصلاحيات', 'الأدوار', 'صلاحية'], entryId: 'platform-super-admin' },
  { q: ['إضافة فرع', 'فرع', 'الفروع', 'قسم'], entryId: 'company-org' },
  { q: ['الرواتب', 'إعدادات الرواتب', 'راتب'], entryId: 'module-hr-payroll' },
  { q: ['الاشتراكات', 'تعديل الاشتراكات', 'باقة', 'الباقات'], entryId: 'platform-subscriptions' },
  { q: ['بريد', 'smtp', 'إيميل'], entryId: 'company-email' },
  { q: ['نسخ احتياطي', 'backup'], entryId: 'module-backup' },
  { q: ['ضريبة', 'ضرائب'], entryId: 'module-finance-tax' },
  { q: ['حضور', 'انصراف'], entryId: 'module-hr-attendance' },
  { q: ['إشعار', 'تنبيه'], entryId: 'module-notifications' }
];

function getSectionForEntry(entryId) {
  return ENTRY_SECTION[entryId] || null;
}

function decorateEntry(entry) {
  const sectionId = getSectionForEntry(entry.id);
  return {
    ...entry,
    uxSectionId: sectionId,
    displayTitleAr: FRIENDLY_TITLE[entry.id] || entry.titleAr,
    displayDescriptionAr: FRIENDLY_DESC[entry.id] || entry.descriptionAr || entry.notes || '',
    levelLabelAr: LEVEL_LABEL[entry.level] || entry.level
  };
}

function resolveSearchAlias(query) {
  const q = String(query || '').trim().toLowerCase();
  if (!q) return null;
  for (const row of SEARCH_ALIASES) {
    if (row.q.some((alias) => q.includes(String(alias).toLowerCase()) || String(alias).toLowerCase().includes(q))) {
      return row.entryId;
    }
  }
  return null;
}

function getUxBundle() {
  return {
    version: 'ux-friendly-2026-10-16',
    sections: UX_SECTIONS,
    entrySection: ENTRY_SECTION,
    searchAliases: SEARCH_ALIASES.map((r) => ({ phrases: r.q, entryId: r.entryId }))
  };
}

function assertMappingCovers(entryIds) {
  const missing = entryIds.filter((id) => !ENTRY_SECTION[id]);
  const extras = Object.keys(ENTRY_SECTION).filter((id) => !entryIds.includes(id));
  return { missing, extras, ok: missing.length === 0 && extras.length === 0 };
}

module.exports = {
  UX_SECTIONS,
  ENTRY_SECTION,
  FRIENDLY_TITLE,
  FRIENDLY_DESC,
  LEVEL_LABEL,
  SEARCH_ALIASES,
  getSectionForEntry,
  decorateEntry,
  resolveSearchAlias,
  getUxBundle,
  assertMappingCovers
};
