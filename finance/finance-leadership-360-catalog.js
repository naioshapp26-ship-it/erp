/**
 * NAIOSH Financial Leadership 360 — P1 navigation catalog.
 * Browser + Node (tests). No DB changes. Links existing routes or coming-soon.
 */
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  root.FINANCE_LEADERSHIP_360 = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const COMING = '/finance/leadership-coming-soon.html';

  function comingSoon(sectionId, pageId) {
    return `${COMING}?section=${encodeURIComponent(sectionId)}&page=${encodeURIComponent(pageId)}`;
  }

  /**
   * status: operational | partial | coming_soon
   * Ambiguous / HR-only items are NOT listed as finance destinations.
   */
  const SECTIONS = [
    {
      id: 'sales',
      label: 'المبيعات',
      icon: 'fa-cart-shopping',
      pages: [
        { id: 'pos', label: 'نقاط البيع', status: 'coming_soon', href: null },
        { id: 'quotes', label: 'عروض الأسعار', status: 'partial', href: '/finance/quick-offers.html' },
        { id: 'invoices-quotes', label: 'الفواتير وعروض الأسعار', status: 'operational', href: '/finance/invoices-budgets-master.html' },
        { id: 'installments', label: 'الأقساط', status: 'operational', href: '/finance/plan-installments.html' },
        { id: 'targets-commissions', label: 'المبيعات المستهدفة والعمولات', status: 'coming_soon', href: null },
        { id: 'e-invoice', label: 'الفاتورة الإلكترونية', status: 'coming_soon', href: null },
        { id: 'zatca', label: 'هيئة الزكاة والدخل والتكاملات الضريبية', status: 'partial', href: '/manage-tax-settings.html' },
        { id: 'return-policy', label: 'سياسة الاسترجاع', status: 'operational', href: '/finance/return-policy.html' },
        { id: 'offers-discounts', label: 'العروض والخصومات المتقدمة', status: 'partial', href: '/finance/item-invoice-discounts.html' },
        { id: 'deposits', label: 'العربون والدفعات المتقدمة', status: 'operational', href: '/finance/deposits-advance-payments.html' },
        { id: 'collection', label: 'التحصيل', status: 'operational', href: '/finance/receivables-collections.html' }
      ]
    },
    {
      id: 'purchases',
      label: 'المشتريات',
      icon: 'fa-bag-shopping',
      pages: [
        { id: 'vendors', label: 'الموردون', status: 'partial', href: '/finance/expenses.html' },
        { id: 'purchase-requests', label: 'طلبات الشراء', status: 'coming_soon', href: null },
        { id: 'purchase-orders', label: 'أوامر الشراء', status: 'coming_soon', href: null },
        { id: 'vendor-quotes', label: 'عروض أسعار الموردين', status: 'coming_soon', href: null },
        { id: 'vendor-invoices', label: 'فواتير الموردين', status: 'coming_soon', href: null },
        { id: 'receiving', label: 'الاستلام ومتابعة المشتريات', status: 'coming_soon', href: null }
      ]
    },
    {
      id: 'products-costs',
      label: 'المنتجات والتكاليف',
      icon: 'fa-boxes-stacked',
      pages: [
        { id: 'product-settings', label: 'إعدادات المنتجات', status: 'coming_soon', href: null },
        { id: 'product-classify', label: 'تصنيف المنتجات والخدمات', status: 'coming_soon', href: null },
        { id: 'product-costs', label: 'تكاليف المنتجات', status: 'coming_soon', href: null },
        { id: 'price-lists', label: 'قوائم الأسعار', status: 'coming_soon', href: null },
        { id: 'margins', label: 'احتساب التكلفة وهوامش الربح', status: 'coming_soon', href: null }
      ]
    },
    {
      id: 'inventory',
      label: 'المخزون',
      icon: 'fa-warehouse',
      pages: [
        { id: 'stock', label: 'المخزون', status: 'coming_soon', href: null },
        { id: 'product-mgmt', label: 'إدارة المنتجات', status: 'coming_soon', href: null },
        { id: 'stock-purchases', label: 'المشتريات المرتبطة بالمخزون', status: 'coming_soon', href: null },
        { id: 'stock-vendors', label: 'إدارة الموردين', status: 'partial', href: '/finance/expenses.html' },
        { id: 'procurement-cycle', label: 'دورة المشتريات', status: 'coming_soon', href: null },
        { id: 'warehouse-docs', label: 'الأذون المخزنية', status: 'coming_soon', href: null },
        { id: 'stock-count', label: 'إدارة الجرد', status: 'coming_soon', href: null }
      ]
    },
    {
      id: 'fixed-assets',
      label: 'الأصول الثابتة',
      icon: 'fa-building',
      pages: [
        { id: 'asset-register', label: 'سجل الأصول', status: 'operational', href: '/finance/fixed-assets.html' },
        { id: 'asset-lists', label: 'قوائم الأصول', status: 'operational', href: '/finance/fixed-assets.html' },
        { id: 'dep-settings', label: 'إعدادات الإهلاك', status: 'partial', href: '/finance/fixed-assets.html' },
        { id: 'dep-calc', label: 'احتساب الإهلاك', status: 'partial', href: '/finance/fixed-assets.html' },
        { id: 'asset-moves', label: 'حركة الأصول ونقلها واستبعادها', status: 'coming_soon', href: null }
      ]
    },
    {
      id: 'payroll',
      label: 'الرواتب',
      icon: 'fa-money-check-dollar',
      pages: [
        { id: 'attendance', label: 'الحضور والانصراف', status: 'operational', href: '/hr/attendance-departure' },
        { id: 'overtime', label: 'ساعات العمل الإضافي', status: 'operational', href: '/finance/payroll-overtime.html' },
        { id: 'payroll-runs', label: 'كشوف الرواتب', status: 'operational', href: '/finance/payroll-runs.html' },
        { id: 'bank-batches', label: 'دفعات البنوك للرواتب', status: 'operational', href: '/finance/payroll-bank-batches.html' }
      ]
    },
    {
      id: 'accounts',
      label: 'الحسابات',
      icon: 'fa-book',
      pages: [
        { id: 'coa', label: 'دليل الحسابات', status: 'operational', href: '/finance/chart-of-accounts.html' },
        { id: 'coa-tree', label: 'شجرة الحسابات', status: 'partial', href: '/finance/chart-accounts-ui-design.html' },
        { id: 'cost-centers', label: 'مراكز التكلفة', status: 'coming_soon', href: null },
        { id: 'expenses', label: 'المصروفات', status: 'operational', href: '/finance/expenses.html' },
        { id: 'journals', label: 'القيود المحاسبية', status: 'operational', href: '/finance/journal.html' },
        { id: 'checks', label: 'دورة الشيكات', status: 'coming_soon', href: null },
        { id: 'accounting-assets', label: 'إدارة الأصول المحاسبية', status: 'partial', href: '/finance/unified-accounting-overview.html' },
        { id: 'payroll-link', label: 'الربط بكشوف الرواتب والدفعات', status: 'partial', href: '/finance/payroll-runs.html' }
      ]
    },
    {
      id: 'budget',
      label: 'الميزانية',
      icon: 'fa-chart-pie',
      pages: [
        { id: 'budget-setup', label: 'إعداد الميزانيات', status: 'operational', href: '/finance/budgets.html' },
        { id: 'budget-coa', label: 'دليل الحسابات المرتبط بها', status: 'partial', href: '/finance/chart-of-accounts.html' },
        { id: 'estimates', label: 'التقديرات المالية', status: 'partial', href: '/finance/budgets.html' },
        { id: 'actual-vs-plan', label: 'مقارنة الفعلي بالمخطط', status: 'partial', href: '/finance/budgets.html' },
        { id: 'variances', label: 'متابعة الانحرافات', status: 'operational', href: '/finance/budgets.html' }
      ]
    },
    {
      id: 'customers',
      label: 'العملاء',
      icon: 'fa-user-tie',
      pages: [
        { id: 'customer-followup', label: 'متابعة العملاء', status: 'operational', href: '/finance/customers.html' },
        { id: 'loyalty', label: 'نقاط الولاء', status: 'coming_soon', href: null },
        { id: 'subscriptions', label: 'الاشتراكات والعضويات', status: 'coming_soon', href: null },
        { id: 'points-balances', label: 'النقاط والأرصدة', status: 'coming_soon', href: null },
        { id: 'insurance', label: 'التأمينات', status: 'coming_soon', href: null }
      ]
    },
    {
      id: 'hr-links',
      label: 'الموارد البشرية',
      icon: 'fa-users',
      pages: [
        { id: 'hr-personnel', label: 'شؤون الموظفين', status: 'operational', href: '/hr/employee-360' },
        { id: 'hr-requests', label: 'إدارة الطلبات', status: 'operational', href: '/hr/my-requests' },
        { id: 'hr-salaries', label: 'إدارة المرتبات', status: 'operational', href: '/hr/payroll-hub' },
        { id: 'hr-contracts', label: 'إدارة العقود', status: 'partial', href: '/finance/contracts.html' },
        { id: 'hr-attendance', label: 'الحضور والانصراف', status: 'operational', href: '/hr/attendance-departure' }
      ]
    },
    {
      id: 'tasks-projects',
      label: 'المهام والمشاريع',
      icon: 'fa-diagram-project',
      pages: [
        { id: 'tasks', label: 'المهام', status: 'coming_soon', href: null },
        { id: 'projects', label: 'المشاريع', status: 'coming_soon', href: null },
        { id: 'project-costing', label: 'ربط المصروفات والإيرادات والتكاليف بالمشاريع', status: 'coming_soon', href: null }
      ]
    },
    {
      id: 'auto-journals',
      label: 'قيود البنود المؤتمتة',
      icon: 'fa-robot',
      pages: [
        { id: 'auto-rules', label: 'قواعد توليد القيود تلقائيًا', status: 'coming_soon', href: null },
        { id: 'op-account-map', label: 'ربط أنواع العمليات بالحسابات', status: 'coming_soon', href: null },
        { id: 'pre-post-review', label: 'مراجعة القيود قبل الترحيل', status: 'partial', href: '/finance/journal.html' },
        { id: 'exec-log', label: 'سجل التنفيذ والأخطاء', status: 'coming_soon', href: null }
      ]
    },
    {
      id: 'gov-services',
      label: 'الخدمات الحكومية',
      icon: 'fa-landmark',
      pages: [
        {
          id: 'gov-integrations',
          label: 'الخدمات والتكاملات الحكومية المصرح بها',
          status: 'coming_soon',
          href: null,
          note: 'لا تكامل وهمي — يُفعَّل بعد اعتماد المفاتيح'
        }
      ]
    },
    {
      id: 'operations',
      label: 'التشغيل',
      icon: 'fa-gears',
      pages: [
        { id: 'work-orders', label: 'أوامر الشغل', status: 'coming_soon', href: null },
        { id: 'workflow', label: 'دورة العمل', status: 'coming_soon', href: null },
        { id: 'bookings', label: 'الحجوزات', status: 'coming_soon', href: null },
        { id: 'rentals', label: 'إدارة الإيجارات والوحدات', status: 'coming_soon', href: null },
        { id: 'lease-contracts', label: 'عقود الإيجار', status: 'coming_soon', href: null },
        { id: 'time-tracking', label: 'تتبع الوقت', status: 'coming_soon', href: null },
        { id: 'manufacturing', label: 'إدارة التصنيع', status: 'coming_soon', href: null }
      ]
    },
    {
      id: 'reports',
      label: 'التقارير',
      icon: 'fa-chart-column',
      pages: [
        { id: 'report-view', label: 'عرض التقارير', status: 'partial', href: '/finance/financial-reports-ai-journal.html' },
        { id: 'report-export', label: 'تصدير التقارير', status: 'coming_soon', href: null },
        { id: 'pnl', label: 'تقارير الأرباح والخسائر', status: 'operational', href: '/finance/income-statement.html' },
        { id: 'balance-sheet', label: 'الميزانية العمومية', status: 'operational', href: '/finance/balance-sheet.html' },
        { id: 'cashflow', label: 'التدفقات النقدية', status: 'operational', href: '/finance/cashflow-summary.html' },
        { id: 'trial-balance', label: 'ميزان المراجعة', status: 'partial', href: '/finance/account-balances.html' },
        { id: 'income-expense', label: 'تقارير الإيرادات والمصروفات', status: 'partial', href: '/finance/expenses.html' },
        { id: 'ar-ap-stock', label: 'تقارير العملاء والموردين والمخزون', status: 'partial', href: '/finance/ar-aging.html' }
      ]
    },
    {
      id: 'settings',
      label: 'الإعدادات',
      icon: 'fa-gear',
      pages: [
        { id: 'page-settings', label: 'إعدادات الصفحات', status: 'operational', href: '/finance/leadership-page-settings.html' },
        { id: 'finance-settings-hub', label: 'مركز إعدادات النظام المالي', status: 'partial', href: '/modules/settings' },
        { id: 'numbering', label: 'أنظمة الترقيم', status: 'operational', href: '/settings/numbering-systems' },
        { id: 'print-templates', label: 'قوالب الطباعة', status: 'operational', href: '/settings/print-templates' }
      ]
    }
  ];

  /** PR #182 finance functions re-surfaced on Finance (keep HR copies; do not delete). */
  const QUICK_ACCESS = [
    { id: 'qa-expenses', label: 'إدارة المصروفات', icon: 'fa-receipt', href: '/finance/expenses.html', status: 'operational' },
    { id: 'qa-journal', label: 'مركز القيود المحاسبية', icon: 'fa-book', href: '/finance/journal.html', status: 'operational' },
    { id: 'qa-accounting', label: 'التكامل المحاسبي', icon: 'fa-network-wired', href: '/finance/unified-accounting-overview.html', status: 'operational' },
    { id: 'qa-payments', label: 'المدفوعات', icon: 'fa-money-check-dollar', href: '/finance/payments.html', status: 'operational' },
    { id: 'qa-invoices', label: 'إدارة الفواتير', icon: 'fa-file-invoice-dollar', href: '/finance/invoices-budgets-master.html', status: 'operational' }
  ];

  /**
   * Ambiguous cases — documented, not auto-duplicated onto Finance as HR systems.
   */
  const AMBIGUOUS_CASES = [
    {
      id: 'workforce',
      label: 'تخطيط القوى العاملة',
      decision: 'يبقى في HR فقط',
      href: '/hr/workforce-planning',
      reason: 'وظيفة موارد بشرية — ليست محاسبة تشغيلية'
    },
    {
      id: 'custody',
      label: 'العهد المالية / العهد',
      decision: 'تبقى في HR فقط',
      href: '/hr/assets-custodies',
      reason: 'نفس صفحة HR والعهد الوظيفية — لا تكرار في المالية'
    },
    {
      id: 'trips',
      label: 'رحلات العمل',
      decision: 'تبقى في HR فقط',
      href: '/hr/operations',
      reason: 'بوابة عمليات HR — ليست وحدة مالية مستقلة'
    }
  ];

  /** Image-2 page settings hub (13). Real links only where settings already exist. */
  const PAGE_SETTINGS = [
    { id: 'print', label: 'إعدادات الطباعة', status: 'operational', href: '/settings/print-templates' },
    { id: 'quotes', label: 'عروض الأسعار', status: 'coming_soon', href: null },
    { id: 'sales-invoices', label: 'فواتير المبيعات', status: 'coming_soon', href: null },
    { id: 'purchase-orders', label: 'أوامر الشراء', status: 'coming_soon', href: null },
    { id: 'purchase-invoices', label: 'فواتير المشتريات', status: 'coming_soon', href: null },
    { id: 'simple-invoices', label: 'الفواتير البسيطة', status: 'coming_soon', href: null },
    { id: 'vouchers', label: 'السندات', status: 'coming_soon', href: null },
    { id: 'credit-notes', label: 'الإشعارات الدائنة', status: 'coming_soon', href: null },
    { id: 'debit-notes', label: 'الإشعارات المدينة', status: 'coming_soon', href: null },
    { id: 'journal-entries', label: 'القيود المحاسبية', status: 'coming_soon', href: null },
    { id: 'products', label: 'المنتجات', status: 'coming_soon', href: null },
    { id: 'customers', label: 'العملاء', status: 'coming_soon', href: null },
    { id: 'suppliers', label: 'الموردين', status: 'coming_soon', href: null }
  ];

  const STATUS_LABEL = {
    operational: 'تشغيلية',
    partial: 'جزئية',
    coming_soon: 'قيد التطوير'
  };

  function resolveHref(page, sectionId) {
    if (page.href) return page.href;
    return comingSoon(sectionId, page.id);
  }

  function flattenPages() {
    const rows = [];
    SECTIONS.forEach((section) => {
      section.pages.forEach((page) => {
        rows.push({
          sectionId: section.id,
          sectionLabel: section.label,
          pageId: page.id,
          pageLabel: page.label,
          status: page.status,
          statusLabel: STATUS_LABEL[page.status] || page.status,
          href: resolveHref(page, section.id),
          note: page.note || ''
        });
      });
    });
    return rows;
  }

  function getSection(id) {
    return SECTIONS.find((s) => s.id === id) || null;
  }

  function getPage(sectionId, pageId) {
    const section = getSection(sectionId);
    if (!section) return null;
    return section.pages.find((p) => p.id === pageId) || null;
  }

  return {
    COMING,
    SECTIONS,
    QUICK_ACCESS,
    AMBIGUOUS_CASES,
    PAGE_SETTINGS,
    STATUS_LABEL,
    comingSoon,
    resolveHref,
    flattenPages,
    getSection,
    getPage
  };
});
