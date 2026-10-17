'use strict';

/**
 * KEEP/MOVE navigation map for Finance, HR, and Archive hubs + GAI sections.
 * Display labels may be normalized; routes/APIs/permissions stay unchanged.
 */

const FINANCE_KEEP = [
  { href: '/finance/expenses.html', label: 'إدارة المصروفات', icon: 'fa-receipt', previousLabel: 'المصروفات والموردون' },
  { href: '/hr/assets-custodies', label: 'العهد المالية', icon: 'fa-handshake', previousLabel: 'إدارة العهد والأصول' },
  { href: '/hr/operations', label: 'رحلات العمل', icon: 'fa-plane', previousLabel: 'بوابة العمليات والطلبات (تذاكر سفر / انتداب)' },
  { href: '/finance/journal.html', label: 'مركز القيود المحاسبية', icon: 'fa-book', previousLabel: 'دفتر اليومية والأستاذ' },
  { href: '/finance/unified-accounting-overview.html', label: 'التكامل المحاسبي', icon: 'fa-network-wired', previousLabel: 'النظام المحاسبي الشمولي' },
  { href: '/finance/payments.html', label: 'المدفوعات', icon: 'fa-money-check-dollar', previousLabel: 'المدفوعات' },
  { href: '/finance/invoices-budgets-master.html', label: 'إدارة الفواتير', icon: 'fa-file-invoice-dollar', previousLabel: 'الفواتير والتحصيل والميزانيات' },
  { href: '/hr/workforce-planning', label: 'تخطيط القوى العاملة', icon: 'fa-people-group', previousLabel: 'تخطيط القوى العاملة' }
];

const HR_KEEP = [
  { key: 'employee-360', href: '/hr/employee-360', label: 'إدارة ملفات الموظفين', icon: 'fa-id-card', category: 'موظفون', previousLabel: 'ملف الموظف 360°' },
  { key: 'performance', href: '/hr/performance', label: 'تقييم الأداء', icon: 'fa-chart-line', category: 'تحليلات', previousLabel: 'مختبر الأداء والتقييم' },
  { key: 'payroll-hub', href: '/hr/payroll-hub', label: 'مقارنة الرواتب', icon: 'fa-wallet', category: 'مالية', previousLabel: 'مركز الرواتب والتعويضات' },
  { key: 'attendance-departure', href: '/hr/attendance-departure', label: 'الحضور والانصراف', icon: 'fa-clock', category: 'حضور', previousLabel: 'سجلات الحضور والانصراف' },
  { key: 'satisfaction-analytics', href: '/hr/satisfaction-analytics', label: 'تفاعل الموظفين', icon: 'fa-face-smile', category: 'تحليلات', previousLabel: 'تحليل رضا الموظفين' },
  { key: 'policies', href: '/hr/policies', label: 'الامتثال لنظام العمل', icon: 'fa-scale-balanced', category: 'تشغيل', previousLabel: 'السياسات والاجراءات' },
  { key: 'payroll', href: '/hr/payroll', label: 'مسير الرواتب', icon: 'fa-sack-dollar', category: 'مالية', manager: true, previousLabel: 'تبسيط ادارة الرواتب' },
  { key: 'new-hires', href: '/hr/new-hires', label: 'إدارة التوظيف', icon: 'fa-user-plus', category: 'موظفون', manager: true, previousLabel: 'تعيين الموظفين الجداد' },
  { key: 'offers-benefits', href: '/hr/offers-benefits', label: 'مزايا الموظفين', icon: 'fa-gift', category: 'موظفون', previousLabel: 'العروض والمزايا (بوابة التشغيل)' }
];

const ARCHIVE_KEEP = [
  { href: '/hr/e-archive', label: 'الأرشفة الإلكترونية', icon: 'fa-archive' },
  { href: '/hr/inbound-outbound-mail', label: 'إدارة مراسلات الصادر والوارد', icon: 'fa-envelope-open-text' }
];

const FINANCE_MOVED = [
  {
    "href": "/finance/payment-terms.html",
    "icon": "fa-hand-holding-dollar",
    "label": "شروط الدفع"
  },
  {
    "href": "/finance/terms-and-conditions.html",
    "icon": "fa-gavel",
    "label": "الشروط والأحكام"
  },
  {
    "href": "/finance/quick-offers.html",
    "icon": "fa-bolt",
    "label": "العروض السريعة"
  },
  {
    "href": "/finance/multiple-taxes.html",
    "icon": "fa-percent",
    "label": "ضرائب متعددة"
  },
  {
    "href": "/finance/item-invoice-discounts.html",
    "icon": "fa-tags",
    "label": "خصومات على العناصر والفواتير"
  },
  {
    "href": "/finance/shipping-options-details.html",
    "icon": "fa-truck",
    "label": "خيارات وتفاصيل الشحن"
  },
  {
    "href": "/finance/deposits-advance-payments.html",
    "icon": "fa-sack-dollar",
    "label": "العربون والدفعات المتقدمة"
  },
  {
    "href": "/finance/sales-settlements.html",
    "icon": "fa-scale-balanced",
    "label": "تسويات المبيعات"
  },
  {
    "href": "/finance/return-policy.html",
    "icon": "fa-rotate-left",
    "label": "سياسة الاسترجاع"
  },
  {
    "href": "/finance/exchange-management.html",
    "icon": "fa-rotate",
    "label": "إدارة الاستبدال"
  },
  {
    "href": "/finance/exchange-policy.html",
    "icon": "fa-clipboard-check",
    "label": "سياسة الاستبدال"
  },
  {
    "href": "/finance/partial-full-exchange.html",
    "icon": "fa-right-left",
    "label": "استبدال جزئي / كلي"
  },
  {
    "href": "/finance/value-increase-adjustment.html",
    "icon": "fa-arrow-up",
    "label": "زيادة مبلغ على القيمة"
  },
  {
    "href": "/finance/shipping-fees.html",
    "icon": "fa-truck-fast",
    "label": "أجور شحن"
  },
  {
    "href": "/finance/balance-sheet.html",
    "icon": "fa-balance-scale",
    "label": "الميزانية العمومية"
  },
  {
    "href": "/finance/income-statement.html",
    "icon": "fa-chart-line",
    "label": "قائمة الدخل"
  },
  {
    "href": "/finance/chart-of-accounts.html",
    "icon": "fa-list",
    "label": "دليل الحسابات"
  },
  {
    "href": "/finance/payments/",
    "icon": "fa-coins",
    "label": "نظام الدفع"
  },
  {
    "href": "/finance/payroll-employees.html",
    "icon": "fa-users",
    "label": "موظفو الرواتب"
  },
  {
    "href": "/finance/payroll-components.html",
    "icon": "fa-puzzle-piece",
    "label": "مكونات الرواتب"
  },
  {
    "href": "/finance/payroll-assignments.html",
    "icon": "fa-link",
    "label": "ربط مكونات الرواتب"
  },
  {
    "href": "/finance/payroll-runs.html",
    "icon": "fa-calendar-check",
    "label": "دورات الرواتب"
  },
  {
    "href": "/finance/payroll-payslips.html",
    "icon": "fa-file-invoice",
    "label": "كشوف الرواتب"
  },
  {
    "href": "/finance/payroll-reports.html",
    "icon": "fa-chart-bar",
    "label": "تقارير الرواتب"
  },
  {
    "href": "/finance/payroll-bank-batches.html",
    "icon": "fa-university",
    "label": "دفعات البنوك للرواتب"
  },
  {
    "href": "/finance/payroll-overtime.html",
    "icon": "fa-stopwatch",
    "label": "ساعات العمل الإضافي"
  },
  {
    "href": "/finance/payroll-settlements.html",
    "icon": "fa-file-invoice-dollar",
    "label": "التسويات المالية للرواتب"
  },
  {
    "href": "/finance/customers.html",
    "icon": "fa-user-friends",
    "label": "العملاء"
  },
  {
    "href": "/finance/ai-forecasts.html",
    "icon": "fa-robot",
    "label": "التنبؤات الذكية"
  },
  {
    "href": "/finance/cashflow-summary.html",
    "icon": "fa-water",
    "label": "ملخص التدفقات"
  },
  {
    "href": "/finance/journal-lines.html",
    "icon": "fa-receipt",
    "label": "تفاصيل القيود"
  },
  {
    "href": "/finance/cashflow-transactions.html",
    "icon": "fa-exchange-alt",
    "label": "معاملات التدفق"
  },
  {
    "href": "/finance/cashflow-comprehensive.html",
    "icon": "fa-layer-group",
    "label": "التقرير الشامل للتدفقات"
  },
  {
    "href": "/finance/ai-risk-scores.html",
    "icon": "fa-shield-alt",
    "label": "تقييم المخاطر الذكي"
  },
  {
    "href": "/finance/fixed-assets.html",
    "icon": "fa-industry",
    "label": "الأصول الثابتة والإهلاك"
  },
  {
    "href": "/finance/budgets.html",
    "icon": "fa-file-invoice-dollar",
    "label": "الميزانيات والانحرافات"
  },
  {
    "href": "/finance/payment-plans.html",
    "icon": "fa-calendar-alt",
    "label": "خطط السداد والتوزيعات"
  },
  {
    "href": "/finance/ar-aging.html",
    "icon": "fa-hourglass-start",
    "label": "أعمار الذمم المدينة"
  },
  {
    "href": "/finance/receivables-collections.html",
    "icon": "fa-hand-holding-dollar",
    "label": "الذمم والتحصيل"
  },
  {
    "href": "/finance/cashflow-risk-reports.html",
    "icon": "fa-water",
    "label": "التدفقات والمخاطر والتقارير"
  },
  {
    "href": "/finance/accounting-cycle.html",
    "icon": "fa-rotate",
    "label": "الدورة المحاسبية"
  },
  {
    "href": "/finance/cashflow-budgets-engine.html",
    "icon": "fa-water",
    "label": "التدفقات والميزانيات"
  },
  {
    "href": "/finance/financial-reports-ai-journal.html",
    "icon": "fa-chart-line",
    "label": "تقارير الوضع المالي"
  },
  {
    "href": "/finance/accounting-cycle-impact.html",
    "icon": "fa-sitemap",
    "label": "أثر النظام المحاسبي والدورة"
  },
  {
    "href": "/finance/plan-installments.html",
    "icon": "fa-calendar-check",
    "label": "أقساط خطط السداد"
  },
  {
    "href": "/finance/account-balances.html",
    "icon": "fa-book",
    "label": "أرصدة الحسابات"
  },
  {
    "href": "/finance/bank-accounts.html",
    "icon": "fa-university",
    "label": "حسابات البنوك"
  },
  {
    "href": "/finance/chart-accounts-ui-design.html",
    "icon": "fa-sitemap",
    "label": "تصميم شجرة الحسابات والواجهات"
  },
  {
    "href": "/finance/system-blueprint-execution.html",
    "icon": "fa-network-wired",
    "label": "المخطط التنفيذي للنظام"
  },
  {
    "href": "/finance/financial-governance-executive.html",
    "icon": "fa-shield-halved",
    "label": "الحوكمة المالية والصلاحيات"
  },
  {
    "href": "/finance/strategic-financial-reports.html",
    "icon": "fa-chart-pie",
    "label": "التقارير الاستراتيجية والذكاء المالي"
  },
  {
    "href": "/finance/ai-risk-payment-framework.html",
    "icon": "fa-brain",
    "label": "نماذج المخاطر وخطط الدفع والحوكمة"
  },
  {
    "href": "/finance/financial-policies-framework.html",
    "icon": "fa-clipboard-list",
    "label": "السياسات المالية الأساسية"
  },
  {
    "href": "/finance/operations-sop-finance.html",
    "icon": "fa-diagram-project",
    "label": "إجراءات التشغيل المالي"
  },
  {
    "href": "/finance/approvals-roles-governance.html",
    "icon": "fa-shield-halved",
    "label": "الموافقات والصلاحيات والحوكمة"
  },
  {
    "href": "/finance/admin-erp-hr.html",
    "icon": "fa-sitemap",
    "label": "النظام الإداري والموارد البشرية"
  },
  {
    "href": "/finance/hr-portal-workflows.html",
    "icon": "fa-clipboard-check",
    "label": "بوابة العمليات والطلبات"
  },
  {
    "href": "/finance/sales-accounts-operations-mobile.html",
    "icon": "fa-store",
    "label": "منظومة المبيعات والحسابات"
  },
  {
    "href": "/finance/electronic-signature.html",
    "icon": "fa-file-signature",
    "label": "التوقيع الإلكتروني"
  },
  {
    "href": "/finance/franchise-agencies.html",
    "icon": "fa-store",
    "label": "وكالات فرنشايز"
  },
  {
    "href": "/finance/contracts.html",
    "icon": "fa-file-contract",
    "label": "العقود"
  }
];

const HR_MOVED = [
  {
    "href": "/hr/employees",
    "label": "النظام الإداري والموارد البشرية",
    "icon": "fa-briefcase",
    "key": "employees",
    "category": "تشغيل",
    "manager": true
  },
  {
    "href": "/hr/accepted-employees",
    "label": "الموظفون المقبولون",
    "icon": "fa-user-check",
    "key": "accepted-employees",
    "category": "موظفون",
    "manager": true
  },
  {
    "href": "/hr/requests",
    "label": "معالجة الطلبات",
    "icon": "fa-inbox",
    "key": "requests",
    "category": "طلبات",
    "manager": true
  },
  {
    "href": "/hr/my-requests",
    "label": "تقديم ومتابعة الطلبات",
    "icon": "fa-file-signature",
    "key": "my-requests",
    "category": "طلبات",
    "manager": true
  },
  {
    "href": "/hr/pending-actions",
    "label": "عمليات بانتظار إجراء",
    "icon": "fa-bell",
    "key": "pending-actions",
    "category": "طلبات",
    "manager": true
  },
  {
    "href": "/hr/attendance-hub",
    "label": "مركز الحضور والنوبات الذكي",
    "icon": "fa-stopwatch",
    "key": "attendance-hub",
    "category": "حضور",
    "manager": false
  },
  {
    "href": "/hr/learning",
    "label": "أكاديمية التطوير والتدريب",
    "icon": "fa-graduation-cap",
    "key": "learning",
    "category": "موظفون",
    "manager": true
  },
  {
    "href": "/hr/integrations-erp",
    "label": "تكاملات ERP",
    "icon": "fa-link",
    "key": "integrations-erp",
    "category": "تكامل",
    "manager": false
  },
  {
    "href": "/hr/integrations-comms",
    "label": "تكاملات البريد والتنبيهات",
    "icon": "fa-envelope-open-text",
    "key": "integrations-comms",
    "category": "تكامل",
    "manager": false
  },
  {
    "href": "/hr/integrations-sso",
    "label": "تكاملات SSO والدخول الموحد",
    "icon": "fa-shield-halved",
    "key": "integrations-sso",
    "category": "تكامل",
    "manager": false
  },
  {
    "href": "/hr/strategic-analytics",
    "label": "لوحة التحليلات الاستراتيجية",
    "icon": "fa-chart-pie",
    "key": "strategic-analytics",
    "category": "تحليلات",
    "manager": false
  },
  {
    "href": "/hr/succession-planning",
    "label": "تخطيط التعاقب الإداري",
    "icon": "fa-chess-king",
    "key": "succession-planning",
    "category": "تحليلات",
    "manager": false
  },
  {
    "href": "/hr/talent-management",
    "label": "إدارة المواهب",
    "icon": "fa-star",
    "key": "talent-management",
    "category": "تحليلات",
    "manager": false
  },
  {
    "href": "/hr/human-risk",
    "label": "إدارة المخاطر البشرية",
    "icon": "fa-triangle-exclamation",
    "key": "human-risk",
    "category": "تحليلات",
    "manager": false
  },
  {
    "href": "/hr/skills-management",
    "label": "إدارة المهارات",
    "icon": "fa-layer-group",
    "key": "skills-management",
    "category": "تحليلات",
    "manager": false
  },
  {
    "href": "/hr/innovation-management",
    "label": "إدارة الابتكارات",
    "icon": "fa-lightbulb",
    "key": "innovation-management",
    "category": "تحليلات",
    "manager": false
  },
  {
    "href": "/hr/experience-management",
    "label": "إدارة الخبرات",
    "icon": "fa-book-open",
    "key": "experience-management",
    "category": "تحليلات",
    "manager": false
  },
  {
    "href": "/hr/cost-optimization",
    "label": "إدارة خفض التكاليف التشغيلية",
    "icon": "fa-chart-line",
    "key": "cost-optimization",
    "category": "تحليلات",
    "manager": false
  },
  {
    "href": "/hr/productivity-comparison",
    "label": "مقارنة ساعات العمل بالإنتاجية",
    "icon": "fa-wave-square",
    "key": "productivity-comparison",
    "category": "تحليلات",
    "manager": false
  },
  {
    "href": "/hr/process-automation",
    "label": "أتمتة الإجراءات إلكترونيًا",
    "icon": "fa-gears",
    "key": "process-automation",
    "category": "أدوات",
    "manager": false
  },
  {
    "href": "/hr/admin-circulars",
    "label": "إدارة التعاميم الإدارية واللوائح",
    "icon": "fa-bullhorn",
    "key": "admin-circulars",
    "category": "تشغيل",
    "manager": false
  }
];

const DOCUMENT_GOVERNANCE_CARDS = [
  { href: '/hr/ocr-suite', label: 'حزمة OCR للتعرف على النصوص', icon: 'fa-file-lines' },
  { href: '/hr/scanner-integration', label: 'تكامل مع الماسح الضوئي', icon: 'fa-scanner-gun' },
  { href: '/hr/attachment-merge', label: 'دمج المرفقات عند التحميل', icon: 'fa-paperclip' },
  { href: '/hr/smartsheet-bundle', label: 'حزمة سمارت شيت', icon: 'fa-table' },
  { href: '/hr/workflow-engine', label: 'محرك سير العمل', icon: 'fa-diagram-project' },
  { href: '/hr/reporting-suite', label: 'حزمة بناء التقارير', icon: 'fa-chart-bar' },
  { href: '/hr/tasks-management', label: 'إدارة مهام الأرشفة', icon: 'fa-list-check' },
  { href: '/hr/no-code-builder', label: 'بناء نماذج الأرشفة بدون برمجة', icon: 'fa-puzzle-piece' },
  { href: '/hr/bulk-messaging', label: 'نظام الرسائل الجماعية', icon: 'fa-comments' },
  { href: '/hr/cybersecurity', label: 'الأمن السيبراني وحماية السجلات', icon: 'fa-shield-halved' },
  { href: '/hr/api-library', label: 'مكتبة الربط API', icon: 'fa-code' },
  { href: '/hr/quality-scoring', label: 'محرك تقييم جودة الوثائق', icon: 'fa-star-half-stroke' },
  { href: '/hr/notifications-center', label: 'نظام التنبيهات والإشعارات', icon: 'fa-bell' },
  { href: '/hr/text-chat', label: 'نظام الدردشة الكتابية', icon: 'fa-comment-dots' }
];

function renderHubAnchor(card) {
  return [
    '<a href="' + card.href + '" class="w-full bg-white text-gray-800 px-6 py-4 rounded-xl font-bold shadow-sm hover:shadow-md hover:bg-gray-50 transition flex items-center gap-4 border border-gray-200 hover:border-red-500 group">',
    '    <i class="fas ' + card.icon + ' text-xl w-8 text-center text-red-600 group-hover:text-red-700 transition"></i>',
    '    <span class="flex-1 text-right">' + card.label + '</span>',
    '    <i class="fas fa-chevron-left text-gray-300"></i>',
    '</a>'
  ].join('\n');
}

function listHrKeepAsHomeModules() {
  return HR_KEEP.map((item) => ({
    key: item.key,
    href: item.href,
    label: item.label,
    icon: item.icon,
    category: item.category || 'تشغيل',
    manager: !!item.manager
  }));
}

function normalizeNavPath(pathname) {
  let path = String(pathname || '').split('?')[0];
  const tenant = path.match(/^\/t\/[a-z0-9][a-z0-9-]*(\/.*)?$/i);
  if (tenant) path = path.replace(/^\/t\/[a-z0-9][a-z0-9-]*/i, '') || '/';
  if (path.length > 1) path = path.replace(/\/+$/, '');
  return path || '/';
}

function pathInList(pathname, list) {
  const path = normalizeNavPath(pathname);
  return (list || []).some((item) => normalizeNavPath(item.href) === path);
}

/**
 * Server-trusted navigation context only (not a permission grant).
 * @returns {'hr'|'archive'|'gai-docs'|'gai-hr'|'gai-finance'|'finance-keep'|'finance'|'archive-hub'|'gai-hub'|null}
 */
function resolveNavigationContext(pathname) {
  const path = normalizeNavPath(pathname);
  if (pathInList(path, ARCHIVE_KEEP)) return 'archive';
  if (pathInList(path, DOCUMENT_GOVERNANCE_CARDS)) return 'gai-docs';
  if (pathInList(path, HR_MOVED)) return 'gai-hr';
  if (pathInList(path, FINANCE_MOVED)) return 'gai-finance';
  if (pathInList(path, FINANCE_KEEP)) return 'finance-keep';
  if (pathInList(path, HR_KEEP)) return 'hr';
  if (path === '/hr' || path.startsWith('/hr/')) return 'hr';
  if (path === '/finance' || path.startsWith('/finance/')) return 'finance';
  if (path === '/archive' || path.startsWith('/archive/')) return 'archive-hub';
  if (path === '/governed-administrative-integration'
    || path.startsWith('/governed-administrative-integration/')) {
    return 'gai-hub';
  }
  return null;
}

function buildContextNav(context) {
  const backGai = {
    key: 'gai-home',
    href: '/governed-administrative-integration',
    icon: 'fa-diagram-project',
    label: 'التكامل الإداري المحكوم'
  };
  const backHome = { key: 'home-root', href: '/', icon: 'fa-house', label: 'العودة للرئيسية' };
  const backArchive = {
    key: 'archive-hub',
    href: '/archive',
    icon: 'fa-box-archive',
    label: 'السجلات والأرشفة'
  };
  const backFinance = { key: 'finance-hub', href: '/finance', icon: 'fa-coins', label: 'المالية' };
  const backHr = { key: 'hr-hub', href: '/hr', icon: 'fa-people-group', label: 'الموارد البشرية' };

  if (context === 'archive' || context === 'archive-hub') {
    return {
      brandTitle: 'السجلات والأرشفة',
      brandSubtitle: 'نظام الأرشفة',
      links: [
        backArchive,
        ...ARCHIVE_KEEP.map((item, idx) => ({
          key: `archive-${idx}`,
          href: item.href,
          icon: item.icon,
          label: item.label
        })),
        backHome
      ],
      topbarMode: 'archive'
    };
  }
  if (context === 'gai-docs') {
    return {
      brandTitle: 'حوكمة الأرشفة الإلكترونية',
      brandSubtitle: 'التكامل الإداري المحكوم',
      links: [
        backGai,
        ...DOCUMENT_GOVERNANCE_CARDS.map((item, idx) => ({
          key: `docs-${idx}`,
          href: item.href,
          icon: item.icon,
          label: item.label
        })),
        backArchive,
        backHome
      ],
      topbarMode: 'gai'
    };
  }
  if (context === 'gai-hr') {
    return {
      brandTitle: 'حوكمة الموارد البشرية',
      brandSubtitle: 'التكامل الإداري المحكوم',
      links: [
        backGai,
        ...HR_MOVED.map((item, idx) => ({
          key: `hrg-${idx}`,
          href: item.href,
          icon: item.icon,
          label: item.label
        })),
        backHr,
        backHome
      ],
      topbarMode: 'gai'
    };
  }
  if (context === 'gai-finance') {
    return {
      brandTitle: 'حوكمة الإدارة المالية',
      brandSubtitle: 'التكامل الإداري المحكوم',
      links: [
        backGai,
        ...FINANCE_MOVED.map((item, idx) => ({
          key: `fing-${idx}`,
          href: item.href,
          icon: item.icon,
          label: item.label
        })),
        backFinance,
        backHome
      ],
      topbarMode: 'gai'
    };
  }
  if (context === 'finance-keep') {
    return {
      brandTitle: 'المالية',
      brandSubtitle: 'القائمة الرئيسية',
      links: [
        backFinance,
        ...FINANCE_KEEP.map((item, idx) => ({
          key: `fkeep-${idx}`,
          href: item.href,
          icon: item.icon,
          label: item.label
        })),
        backHome
      ],
      topbarMode: 'finance'
    };
  }
  if (context === 'hr') {
    return {
      brandTitle: 'نايوش HCM',
      brandSubtitle: 'نظام الموارد البشرية',
      links: null,
      topbarMode: 'hr'
    };
  }
  return null;
}

function getNavigationPayload(pathname) {
  const context = resolveNavigationContext(pathname);
  const built = buildContextNav(context);
  return {
    context,
    brandTitle: built?.brandTitle || 'نايوش',
    brandSubtitle: built?.brandSubtitle || '',
    links: built?.links || null,
    topbarMode: built?.topbarMode || 'hr',
    usesHrDefaultNav: context === 'hr' || !built || built.links == null
  };
}

module.exports = {
  FINANCE_KEEP,
  FINANCE_MOVED,
  HR_KEEP,
  HR_MOVED,
  ARCHIVE_KEEP,
  DOCUMENT_GOVERNANCE_CARDS,
  renderHubAnchor,
  listHrKeepAsHomeModules,
  normalizeNavPath,
  resolveNavigationContext,
  buildContextNav,
  getNavigationPayload
};
