/**
 * NAIOSH Financial Leadership 360 — P1 navigation catalog.
 * Statuses reflect the post-audit functional review (catalog correction only).
 * Browser + Node (tests). No DB / API / posting changes.
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
   * href may remain for coming_soon when a local/legacy page must stay reachable (no delete).
   */
  const SECTIONS = [
    {
      id: 'sales',
      label: 'المبيعات',
      icon: 'fa-cart-shopping',
      pages: [
        { id: 'pos', label: 'نقاط البيع', status: 'operational', href: '/finance/pos.html', note: 'تذاكر بيع محفوظة في Postgres. بلا بوابة دفع خارجية.' },
        {
          id: 'quotes',
          label: 'عروض ترويجية سريعة',
          status: 'operational',
          href: '/finance/quick-offers.html',
          note: 'إنشاء/صلاحية/أصناف/خصم + تطبيق على الفاتورة والضريبة. ليست عروض أسعار مبيعات مستقلة. الإرسال الحكومي غير مطلوب هنا.'
        },
        {
          id: 'invoices-quotes',
          label: 'الفواتير والتحصيل والميزانيات',
          status: 'operational',
          href: '/finance/invoices-budgets-master.html',
          note: 'إنشاء/تعديل/حذف فواتير + سداد مخصص + خطة دفع + إنشاء ميزانية'
        },
        { id: 'installments', label: 'الأقساط', status: 'operational', href: '/finance/plan-installments.html' },
        { id: 'targets-commissions', label: 'المبيعات المستهدفة والعمولات', status: 'operational', href: '/finance/sales-targets.html', note: 'الهدف يُقارن بمجموع فواتير الفترة. العمولات في /finance/commissions.html' },
        {
          id: 'e-invoice',
          label: 'الفاتورة الإلكترونية',
          status: 'operational',
          href: '/finance/e-invoice-queue.html',
          note: 'دورة محلية تشغيلية: جاهز→طابور→تحقق/رفض→أرشفة مع صلاحيات وسجل تدقيق في Postgres. الإرسال للجهة الضريبية غير موصول (CONNECTOR_ABSENT).'
        },
        {
          id: 'zatca',
          label: 'إعدادات الضرائب الداخلية',
          status: 'operational',
          href: '/manage-tax-settings.html',
          note: 'معدلات حسب الكيان وتاريخ السريان والإعفاءات + سجل تدقيق، مربوطة بالفواتير. ليست تكامل هيئة حكومية.'
        },
        { id: 'return-policy', label: 'سياسة الاسترجاع', status: 'operational', href: '/finance/return-policy.html' },
        {
          id: 'offers-discounts',
          label: 'العروض والخصومات المتقدمة',
          status: 'operational',
          href: '/finance/item-invoice-discounts.html',
          note: 'حفظ Postgres عبر /finance/item-discounts'
        },
        {
          id: 'deposits',
          label: 'العربون والدفعات المتقدمة',
          status: 'operational',
          href: '/finance/deposits.html',
          note: 'عربون محفوظ، وتطبيقه على فاتورة يحدّث المدفوع والمتبقي. ملف localStorage القديم ليس المسار.'
        },
        { id: 'collection', label: 'التحصيل', status: 'operational', href: '/finance/receivables-collections.html' }
      ]
    },
    {
      id: 'purchases',
      label: 'المشتريات',
      icon: 'fa-bag-shopping',
      pages: [
        {
          id: 'vendors',
          label: 'موردو المشتريات',
          status: 'operational',
          href: '/finance/purchase-vendors.html',
          note: 'نطاق PURCHASE/BOTH على finance_vendors + ربط أوامر/فواتير/مستحق. موردو المصروفات فقط ما زالوا عبر expenses'
        },
        { id: 'purchase-requests', label: 'طلبات الشراء', status: 'operational', href: '/finance/purchase-requests.html', note: 'طلب مستقل قابل للتحويل إلى أمر شراء' },
        {
          id: 'purchase-orders',
          label: 'أوامر الشراء',
          status: 'operational',
          href: '/finance/purchase-orders.html',
          note: 'مسودة→اعتماد→استلام/إلغاء، بنود وضرائب، مفوتر/متبقي، تدقيق — منضدة purchase-orders'
        },
        {
          id: 'vendor-quotes',
          label: 'عروض أسعار الموردين',
          status: 'operational',
          href: '/finance/vendor-quotes.html',
          note: 'وحدة مستقلة: مسودة→إرسال→قبول/رفض→تحويل لأمر شراء مع بنود وتدقيق'
        },
        {
          id: 'vendor-invoices',
          label: 'فواتير الموردين',
          status: 'operational',
          href: '/finance/purchase-orders.html',
          note: 'ربط بأمر معتمد، منع التكرار، اعتماد وسداد جزئي/كامل، بلا حذف بعد الاعتماد'
        },
        {
          id: 'receiving',
          label: 'الاستلام ومتابعة المشتريات',
          status: 'operational',
          href: '/finance/purchase-receiving.html',
          note: 'شاشة مستقلة: استلام أمر معتمد يزيد المخزون وينشئ قيد GRNI عبر stock-link'
        }
      ]
    },
    {
      id: 'products-costs',
      label: 'المنتجات والتكاليف',
      icon: 'fa-boxes-stacked',
      pages: [
        { id: 'product-settings', label: 'إعدادات المنتجات', status: 'operational', href: '/finance/inventory.html#items', note: 'سجل أصناف وخدمات في Postgres عبر /finance/inventory' },
        { id: 'product-classify', label: 'تصنيف المنتجات والخدمات', status: 'operational', href: '/finance/inventory.html#categories', note: 'شجرة تصنيفات مستقلة (أب/فرع) + ربط الصنف بـ category_id مع تدقيق. ليست مراكز تكلفة محاسبية.' },
        { id: 'product-costs', label: 'تكاليف المنتجات', status: 'operational', href: '/finance/inventory.html#costs', note: 'متوسط التكلفة المرجح على رصيد الصنف/المستودع عبر /finance/inventory/costs. تكلفة المشروعات خارج النطاق.' },
        { id: 'price-lists', label: 'قوائم الأسعار', status: 'operational', href: '/finance/price-lists.html', note: 'قوائم وبنود محفوظة' },
        { id: 'margins', label: 'احتساب التكلفة وهوامش الربح', status: 'operational', href: '/finance/inventory.html#margins', note: 'هامش الوحدة + تجميع حسب التصنيف عبر /finance/inventory/margins-by-category. ليست ربحية أقسام GL كاملة.' }
      ]
    },
    {
      id: 'inventory',
      label: 'المخزون',
      icon: 'fa-warehouse',
      pages: [
        { id: 'stock', label: 'المخزون', status: 'operational', href: '/finance/inventory.html', note: 'أرصدة وحركات فعلية. الرصيد السالب ممنوع. القيد يُنشأ عند استلام أمر شراء معتمد أو صرف فاتورة أو مرتجع، لا عند الإدخال اليدوي' },
        { id: 'product-mgmt', label: 'إدارة المنتجات', status: 'operational', href: '/finance/inventory.html#items' },
        {
          id: 'stock-purchases',
          label: 'المشتريات المرتبطة بالمخزون',
          status: 'operational',
          href: '/finance/inventory.html#links',
          note: 'عرض أوامر الشراء وإيصالات المخزون عبر /finance/inventory/purchase-links. إنشاء/اعتماد الأمر وحده لا يحرّك الرصيد — الاستلام المعتمد يفعل.'
        },
        {
          id: 'stock-vendors',
          label: 'موردو المشتريات (مرجع)',
          status: 'operational',
          href: '/finance/purchase-vendors.html',
          note: 'إدارة موردي المشتريات؛ موردي المصروفات يبقون في expenses عند الحاجة'
        },
        { id: 'procurement-cycle', label: 'دورة المشتريات', status: 'operational', href: '/finance/purchase-requests.html', note: 'من طلب الشراء إلى أمر الشراء' },
        { id: 'warehouse-docs', label: 'الأذون المخزنية', status: 'operational', href: '/finance/inventory.html#moves', note: 'إذن إدخال وإخراج وتحويل وتسوية. الحركة المعتمدة لا تُعدَّل' },
        { id: 'stock-count', label: 'إدارة الجرد', status: 'operational', href: '/finance/inventory.html#counts', note: 'مسودة جرد بسبب موثق ثم اعتماد ينشئ تسوية مخزون عند وجود فرق — مع صلاحيات وإلغاء مسودة.' }
      ]
    },
    {
      id: 'fixed-assets',
      label: 'الأصول الثابتة',
      icon: 'fa-building',
      pages: [
        { id: 'asset-register', label: 'سجل الأصول', status: 'operational', href: '/finance/fixed-assets.html' },
        { id: 'asset-lists', label: 'قوائم الأصول', status: 'operational', href: '/finance/fixed-assets.html' },
        {
          id: 'dep-settings',
          label: 'إعدادات الإهلاك',
          status: 'partial',
          href: '/finance/fixed-assets.html',
          note: 'إعدادات/احتساب ضمن صفحة الأصول — حركة الأصول والاستبعاد غير مكتملة'
        },
        {
          id: 'dep-calc',
          label: 'احتساب الإهلاك',
          status: 'partial',
          href: '/finance/fixed-assets.html',
          note: 'احتساب ضمن صفحة الأصول — التحقق من اكتمال الترحيل المحاسبي لاحقًا'
        },
        { id: 'asset-moves', label: 'حركة الأصول ونقلها واستبعادها', status: 'operational', href: '/finance/asset-moves.html', note: 'نقل أو استبعاد أو بيع أصل قائم، والإلغاء يعكس آخر حالة' }
      ]
    },
    {
      id: 'payroll',
      label: 'الرواتب',
      icon: 'fa-money-check-dollar',
      pages: [
        {
          id: 'attendance',
          label: 'الحضور والانصراف',
          status: 'operational',
          href: '/hr/attendance-departure',
          note: 'رابط تكامل — القسم الأساسي: الموارد البشرية'
        },
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
        {
          id: 'coa-tree',
          label: 'شجرة الحسابات',
          status: 'operational',
          href: '/finance/coa-tree.html',
          note: 'شجرة هرمية تشغيلية + أرصدة قيود + ربط الرواتب/الترحيل'
        },
        { id: 'cost-centers', label: 'مراكز التكلفة', status: 'operational', href: '/finance/cost-centers.html' },
        { id: 'expenses', label: 'المصروفات', status: 'operational', href: '/finance/expenses.html' },
        { id: 'journals', label: 'القيود المحاسبية', status: 'operational', href: '/finance/journal.html' },
        { id: 'checks', label: 'دورة الشيكات', status: 'operational', href: '/finance/checks.html', note: 'شيكات محفوظة مع إلغاء بسبب' },
        {
          id: 'accounting-assets',
          label: 'إدارة الأصول المحاسبية',
          status: 'partial',
          href: '/finance/unified-accounting-overview.html',
          note: 'لوحة تكامل/عرض أكثر من تشغيل محاسبي كامل'
        },
        {
          id: 'payroll-link',
          label: 'الربط بكشوف الرواتب والدفعات',
          status: 'operational',
          href: '/finance/payroll-runs.html',
          note: 'ساعات معتمدة ← مسير ← قيد متوازن عبر /finance/payroll-ops'
        }
      ]
    },
    {
      id: 'budget',
      label: 'الميزانية',
      icon: 'fa-chart-pie',
      pages: [
        { id: 'budget-setup', label: 'إعداد الميزانيات', status: 'operational', href: '/finance/budgets.html' },
        {
          id: 'budget-coa',
          label: 'دليل الحسابات المرتبط بها',
          status: 'partial',
          href: '/finance/chart-of-accounts.html',
          note: 'رابط لدليل الحسابات العام — ليس ربط ميزانية مخصصًا'
        },
        {
          id: 'estimates',
          label: 'التقديرات المالية',
          status: 'partial',
          href: '/finance/budgets.html',
          note: 'ضمن صفحة الميزانيات — ليست وحدة تقديرات منفصلة'
        },
        {
          id: 'actual-vs-plan',
          label: 'مقارنة الفعلي بالمخطط',
          status: 'partial',
          href: '/finance/budgets.html',
          note: 'عرض/انحرافات ضمن الميزانيات — مقارنة تلقائية من القيود لاحقًا'
        },
        { id: 'variances', label: 'متابعة الانحرافات', status: 'operational', href: '/finance/budgets.html' }
      ]
    },
    {
      id: 'customers',
      label: 'العملاء',
      icon: 'fa-user-tie',
      pages: [
        { id: 'customer-followup', label: 'متابعة العملاء', status: 'operational', href: '/finance/customers.html' },
        { id: 'loyalty', label: 'نقاط الولاء', status: 'operational', href: '/finance/loyalty.html' },
        { id: 'subscriptions', label: 'الاشتراكات والعضويات', status: 'operational', href: '/finance/subscriptions.html' },
        { id: 'points-balances', label: 'النقاط والأرصدة', status: 'operational', href: '/finance/loyalty.html', note: 'الرصيد مجموع حركات النقاط غير الملغاة' },
        { id: 'insurance', label: 'التأمينات', status: 'operational', href: '/finance/insurance.html' }
      ]
    },
    {
      id: 'hr-links',
      label: 'الموارد البشرية',
      icon: 'fa-users',
      pages: [
        {
          id: 'hr-personnel',
          label: 'شؤون الموظفين',
          status: 'operational',
          href: '/hr/employee-360',
          note: 'رابط تكامل — القسم الأساسي: الموارد البشرية'
        },
        {
          id: 'hr-requests',
          label: 'إدارة الطلبات',
          status: 'operational',
          href: '/hr/my-requests',
          note: 'رابط تكامل — القسم الأساسي: الموارد البشرية'
        },
        {
          id: 'hr-salaries',
          label: 'إدارة المرتبات',
          status: 'operational',
          href: '/hr/payroll-hub',
          note: 'رابط تكامل — القسم الأساسي: الموارد البشرية'
        },
        {
          id: 'hr-contracts',
          label: 'العقود المالية/التجارية',
          status: 'partial',
          href: '/finance/contracts.html',
          note: 'عقود مالية في finance/contracts — ليست عقود عمل موظفين'
        },
        {
          id: 'hr-attendance',
          label: 'الحضور والانصراف',
          status: 'operational',
          href: '/hr/attendance-departure',
          note: 'رابط تكامل — القسم الأساسي: الموارد البشرية'
        }
      ]
    },
    {
      id: 'tasks-projects',
      label: 'المهام والمشاريع',
      icon: 'fa-diagram-project',
      pages: [
        { id: 'tasks', label: 'المهام', status: 'operational', href: '/finance/tasks.html' },
        { id: 'projects', label: 'المشاريع', status: 'operational', href: '/finance/projects.html' },
        { id: 'project-costing', label: 'ربط المصروفات والإيرادات والتكاليف بالمشاريع', status: 'operational', href: '/finance/project-costs.html' }
      ]
    },
    {
      id: 'auto-journals',
      label: 'قيود البنود المؤتمتة',
      icon: 'fa-robot',
      pages: [
        { id: 'auto-rules', label: 'قواعد توليد القيود تلقائيًا', status: 'operational', href: '/finance/auto-journal-rules.html', note: 'التنفيذ ينشئ قيدًا متوازنًا على الحسابين المحددين' },
        { id: 'op-account-map', label: 'ربط أنواع العمليات بالحسابات', status: 'operational', href: '/finance/auto-journal-rules.html', note: 'الربط هو حساب المدين والدائن داخل القاعدة' },
        {
          id: 'pre-post-review',
          label: 'مراجعة القيود قبل الترحيل',
          status: 'partial',
          href: '/finance/journal.html',
          note: 'مراجعة عبر دفتر القيود — بلا محرك قواعد مؤتمت'
        },
        { id: 'exec-log', label: 'سجل التنفيذ والأخطاء', status: 'operational', href: '/finance/auto-journal-rules.html', note: 'كل تنفيذ ناجح يُحفظ كسجل auto-runs مع رقم القيد' }
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
          status: 'partial',
          href: '/finance/gov-integrations.html',
          note: 'سجل الجهات فقط. تعليم الخدمة متصلة مرفوض لأن الموصل غير موجود'
        }
      ]
    },
    {
      id: 'operations',
      label: 'التشغيل',
      icon: 'fa-gears',
      pages: [
        { id: 'work-orders', label: 'أوامر الشغل', status: 'operational', href: '/finance/work-orders.html' },
        { id: 'workflow', label: 'دورة العمل', status: 'operational', href: '/finance/workflows.html', note: 'قوالب خطوات محفوظة. صندوق الموافقات الحالي غير مربوط تلقائيًا.' },
        { id: 'bookings', label: 'الحجوزات', status: 'operational', href: '/finance/bookings.html' },
        { id: 'rentals', label: 'إدارة الإيجارات والوحدات', status: 'operational', href: '/finance/rentals.html' },
        { id: 'lease-contracts', label: 'عقود الإيجار', status: 'operational', href: '/finance/leases.html' },
        { id: 'time-tracking', label: 'تتبع الوقت', status: 'operational', href: '/finance/time-entries.html' },
        { id: 'manufacturing', label: 'إدارة التصنيع', status: 'operational', href: '/finance/manufacturing.html', note: 'قائمة مكونات محفوظة. لا أوامر إنتاج متعددة المراحل.' }
      ]
    },
    {
      id: 'reports',
      label: 'التقارير',
      icon: 'fa-chart-column',
      pages: [
        {
          id: 'report-view',
          label: 'عرض التقارير',
          status: 'partial',
          href: '/finance/financial-reports-ai-journal.html',
          note: 'تقارير مجمّعة جزئية — ليست مركز تقارير موحّدًا'
        },
        { id: 'report-export', label: 'تصدير التقارير', status: 'operational', href: '/finance/report-exports.html', note: 'CSV للفواتير والعملاء والمصروفات من Postgres' },
        { id: 'pnl', label: 'تقارير الأرباح والخسائر', status: 'operational', href: '/finance/income-statement.html' },
        {
          id: 'balance-sheet',
          label: 'الميزانية العمومية',
          status: 'partial',
          href: '/finance/balance-sheet.html',
          note: 'الواجهة موجودة لكن GET /finance/balance-sheet يفشل (جدول finance_balance_sheet غير موجود) — بلا migration في هذا الإصلاح'
        },
        { id: 'cashflow', label: 'التدفقات النقدية', status: 'operational', href: '/finance/cashflow-summary.html' },
        {
          id: 'trial-balance',
          label: 'ميزان المراجعة',
          status: 'partial',
          href: '/finance/account-balances.html',
          note: 'أرصدة حسابات — ليست ميزان مراجعة تقليديًا كاملًا'
        },
        {
          id: 'income-expense',
          label: 'تقارير الإيرادات والمصروفات',
          status: 'partial',
          href: '/finance/expenses.html',
          note: 'يفتح المصروفات — ليست حزمة تقارير إيراد/مصروف منفصلة'
        },
        {
          id: 'ar-ap-stock',
          label: 'تقارير العملاء والموردين والمخزون',
          status: 'partial',
          href: '/finance/ar-aging.html',
          note: 'أعمار ذمم — بلا تقارير مخزون/موردين مكتملة'
        }
      ]
    },
    {
      id: 'settings',
      label: 'الإعدادات',
      icon: 'fa-gear',
      pages: [
        {
          id: 'page-settings',
          label: 'إعدادات الصفحات',
          status: 'operational',
          href: '/finance/leadership-page-settings.html',
          note: 'مركز إعدادات المستندات الـ13 — حفظ PostgreSQL عبر /finance/page-settings'
        },
        {
          id: 'finance-settings-hub',
          label: 'مركز إعدادات النظام المالي',
          status: 'partial',
          href: '/modules/settings',
          note: 'مركز وحدات عام — ليس إعدادات مالية مكتملة لكل مستند'
        },
        {
          id: 'numbering',
          label: 'أنظمة الترقيم',
          status: 'partial',
          href: '/settings/numbering-systems',
          note: 'ترقيم Enterprise عام — إعدادات ترقيم المستندات المالية عبر إعدادات الصفحات'
        },
        {
          id: 'print-templates',
          label: 'قوالب الطباعة',
          status: 'partial',
          href: '/settings/print-templates',
          note: 'قوالب طباعة عامة — إعداد طباعة المستندات المالية عبر إعدادات الصفحات'
        }
      ]
    }
  ];

  /** PR #182 finance functions re-surfaced on Finance (keep HR copies; do not delete). */
  const QUICK_ACCESS = [
    {
      id: 'qa-expenses',
      label: 'إدارة المصروفات',
      icon: 'fa-receipt',
      href: '/finance/expenses.html',
      status: 'operational',
      note: 'حفظ وترحيل قيد من دليل الحسابات عند الاعتماد، وعكس معتمد بدل حذف الأثر'
    },
    { id: 'qa-journal', label: 'مركز القيود المحاسبية', icon: 'fa-book', href: '/finance/journal.html', status: 'operational' },
    {
      id: 'qa-accounting',
      label: 'التكامل المحاسبي',
      icon: 'fa-network-wired',
      href: '/finance/accounting-integration.html',
      status: 'operational',
      note: 'ربط الفواتير/المدفوعات/المصروفات/المخزون بالقيود + عرض المرجع والتوازن وعكس القيد المعتمد'
    },
    { id: 'qa-payments', label: 'المدفوعات', icon: 'fa-money-check-dollar', href: '/finance/payments.html', status: 'operational' },
    {
      id: 'qa-invoices',
      label: 'إدارة الفواتير',
      icon: 'fa-file-invoice-dollar',
      href: '/finance/invoices-budgets-master.html',
      status: 'operational',
      note: 'إنشاء/تعديل/حذف + سداد مخصص + خطة دفع + ميزانية'
    }
  ];

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

  /** Image-2 page settings hub (13). All persist via /finance/page-settings → PostgreSQL. */
  const PAGE_SETTINGS = [
    {
      id: 'print',
      label: 'إعدادات الطباعة',
      status: 'operational',
      href: '/finance/leadership-doc-settings.html?doc=print',
      note: 'حفظ وتطبيق إعدادات الطباعة للمستندات المالية'
    },
    {
      id: 'quotes',
      label: 'عروض الأسعار',
      status: 'operational',
      href: '/finance/leadership-doc-settings.html?doc=quotes',
      note: 'بادئة الرقم ومدة الصلاحية والضريبة الافتراضية'
    },
    {
      id: 'sales-invoices',
      label: 'فواتير المبيعات',
      status: 'operational',
      href: '/finance/leadership-doc-settings.html?doc=sales-invoices',
      note: 'تُطبَّق على إنشاء فواتير /finance/invoices'
    },
    {
      id: 'purchase-orders',
      label: 'أوامر الشراء',
      status: 'operational',
      href: '/finance/leadership-doc-settings.html?doc=purchase-orders'
    },
    {
      id: 'purchase-invoices',
      label: 'فواتير المشتريات',
      status: 'operational',
      href: '/finance/leadership-doc-settings.html?doc=purchase-invoices'
    },
    {
      id: 'simple-invoices',
      label: 'الفواتير البسيطة',
      status: 'operational',
      href: '/finance/leadership-doc-settings.html?doc=simple-invoices'
    },
    {
      id: 'vouchers',
      label: 'السندات',
      status: 'operational',
      href: '/finance/leadership-doc-settings.html?doc=vouchers'
    },
    {
      id: 'credit-notes',
      label: 'الإشعارات الدائنة',
      status: 'operational',
      href: '/finance/leadership-doc-settings.html?doc=credit-notes'
    },
    {
      id: 'debit-notes',
      label: 'الإشعارات المدينة',
      status: 'operational',
      href: '/finance/leadership-doc-settings.html?doc=debit-notes'
    },
    {
      id: 'journal-entries',
      label: 'القيود المحاسبية',
      status: 'operational',
      href: '/finance/leadership-doc-settings.html?doc=journal-entries',
      note: 'تُطبَّق عند إنشاء القيود (التوازن والوصف)'
    },
    {
      id: 'products',
      label: 'المنتجات',
      status: 'operational',
      href: '/finance/leadership-doc-settings.html?doc=products'
    },
    {
      id: 'customers',
      label: 'العملاء',
      status: 'operational',
      href: '/finance/leadership-doc-settings.html?doc=customers',
      note: 'تُطبَّق على إنشاء العملاء'
    },
    {
      id: 'suppliers',
      label: 'الموردين',
      status: 'operational',
      href: '/finance/leadership-doc-settings.html?doc=suppliers',
      note: 'تُطبَّق على إنشاء الموردين'
    },
    {
      id: 'overtime',
      label: 'ساعات العمل الإضافي',
      status: 'operational',
      href: '/finance/leadership-doc-settings.html?doc=overtime',
      note: 'بادئة الطلب والأسباب والتداخل والتصدير — تُطبَّق على /finance/payroll-overtime.html'
    },
    {
      id: 'payroll-runs',
      label: 'كشوف الرواتب',
      status: 'operational',
      href: '/finance/leadership-doc-settings.html?doc=payroll-runs',
      note: 'ضرائب/تأمينات وحسابات الترحيل — تُطبَّق على إنشاء المسير والقيد'
    },
    {
      id: 'coa-tree',
      label: 'شجرة الحسابات',
      status: 'operational',
      href: '/finance/leadership-doc-settings.html?doc=coa-tree',
      note: 'عرض الأرصدة واللغة والمستويات واعتماد التعديل الحساس'
    }
  ];

  const STATUS_LABEL = {
    operational: 'تشغيلية',
    partial: 'جزئية',
    coming_soon: 'قيد التطوير'
  };

  /** Expected post-audit status map for regression tests (pageId → status). */
  const AUDIT_STATUS_EXPECTATIONS = {
    'sales.pos': 'operational',
    'sales.quotes': 'operational',
    'sales.invoices-quotes': 'operational',
    'sales.installments': 'operational',
    'sales.targets-commissions': 'operational',
    'sales.e-invoice': 'operational',
    'sales.zatca': 'operational',
    'sales.return-policy': 'operational',
    'sales.offers-discounts': 'operational',
    'sales.deposits': 'operational',
    'sales.collection': 'operational',
    'purchases.vendors': 'operational',
    'purchases.purchase-requests': 'operational',
    'purchases.purchase-orders': 'operational',
    'purchases.vendor-quotes': 'operational',
    'purchases.vendor-invoices': 'operational',
    'purchases.receiving': 'operational',
    'inventory.stock-vendors': 'partial',
    'reports.balance-sheet': 'partial',
    'settings.page-settings': 'operational',
    'settings.numbering': 'partial',
    'settings.print-templates': 'partial',
    'qa.qa-accounting': 'operational',
    'qa.qa-invoices': 'operational',
    'qa.qa-expenses': 'operational',
    'qa.qa-journal': 'operational',
    'qa.qa-payments': 'operational',
    'pagesettings.print': 'operational',
    'pagesettings.quotes': 'operational',
    'pagesettings.sales-invoices': 'operational',
    'pagesettings.purchase-orders': 'operational',
    'pagesettings.purchase-invoices': 'operational',
    'pagesettings.simple-invoices': 'operational',
    'pagesettings.vouchers': 'operational',
    'pagesettings.credit-notes': 'operational',
    'pagesettings.debit-notes': 'operational',
    'pagesettings.journal-entries': 'operational',
    'pagesettings.products': 'operational',
    'pagesettings.customers': 'operational',
    'pagesettings.suppliers': 'operational',
    'pagesettings.overtime': 'operational',
    'pagesettings.payroll-runs': 'operational',
    'pagesettings.coa-tree': 'operational',
    'payroll.overtime': 'operational',
    'payroll.payroll-runs': 'operational',
    'accounts.coa-tree': 'operational'
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
    AUDIT_STATUS_EXPECTATIONS,
    comingSoon,
    resolveHref,
    flattenPages,
    getSection,
    getPage
  };
});
