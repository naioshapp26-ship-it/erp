(function () {
  'use strict';

  function mod(name, href) {
    return { name, href: href || '/saas-signup.html#step1' };
  }

  function system(id, icon, name, desc, modules, href) {
    return { id, icon, name, desc, modules: modules || [], href: href || null };
  }

  const mainSystemsCatalog = [
    {
      section: 'الأنظمة والإدارة',
      icon: 'fa-sitemap',
      systems: [
        system('user-interface', 'fa-display', 'واجهة المستخدم', 'لوحة تحكم مركزية بتصميم عصري تتيح إدارة جميع وحدات النظام من مكان واحد.', [
          mod('الرئيسية', '/home'),
          mod('إحصائيات صفحتي', '/my-page-analytics')
        ]),
        system('roles-permissions', 'fa-user-shield', 'إدارة الأدوار والصلاحيات', 'تحديد صلاحيات دقيقة لكل دور وظيفي لضمان أمان البيانات.', [], '/home'),
        system('operational-policies', 'fa-scale-balanced', 'السياسات التشغيلية المعتمدة', 'إدارة السياسات التشغيلية المعتمدة ونشرها على مستوى المؤسسة.', [], '/operational-policies'),
        system('strategic-mgmt', 'fa-chess', 'الإدارة الاستراتيجية', 'أدوات تخطيط استراتيجي ومتابعة الأهداف على المستوى المؤسسي.', [
          mod('الإدارة التنفيذية', '/strategic/executive'),
          mod('إدارة الموظفين', '/strategic/employees'),
          mod('الأنظمة الذكية', '/strategic/smart-systems'),
          mod('إدارة الاشتراكات', '/strategic/subscriptions'),
          mod('إدارة العمليات', '/strategic/operations'),
          mod('الموافقات المالية', '/strategic/financial-approvals'),
          mod('المستأجرين', '/strategic/tenants'),
          mod('مركز المعلنين', '/strategic/advertisers'),
          mod('التدريب والتطوير', '/strategic/training'),
          mod('الجودة والتدقيق', '/strategic/quality'),
          mod('التقييم', '/strategic/evaluation'),
          mod('المهام', '/strategic/tasks'),
          mod('مركز المعلومات', '/strategic/information'),
          mod('إعدادات الهوية', '/strategic/identity'),
          mod('سجل النظام', '/strategic/log'),
          mod('التقارير', '/strategic/reports')
        ]),
        system('org-chart', 'fa-sitemap', 'الهيكل الهرمي', 'رسم بياني تفاعلي يعرض بنية المؤسسة ومستويات الإدارة بشكل واضح.', [], '/hierarchy'),
        system('records-archive', 'fa-archive', 'نظام الأرشفة', 'أرشفة السجلات والوثائق المؤسسية مع تصنيف آمن وسهل الوصول.', [
          mod('الإدارة الأكاديمية', '/archive/academic-admin'),
          mod('شؤون الطلاب', '/archive/student-affairs'),
          mod('قسم المالية والمحاسبة', '/archive/finance-accounting'),
          mod('قسم المشاريع', '/archive/projects'),
          mod('ملفات عامة وإدارية', '/archive/general-admin-files'),
          mod('التدريب والتعليم', '/archive/training-education'),
          mod('قسم IT', '/archive/it'),
          mod('التسويق والمبيعات', '/archive/marketing-sales'),
          mod('قسم الصادر', '/archive/outgoing'),
          mod('الموارد البشرية', '/archive/human-resources'),
          mod('ضبط الوصول الآمن', '/archive/access-control'),
          mod('سجل الأمان', '/archive/audit-log')
        ], '/archive'),
        system('tenants-hub', 'fa-building', 'المستأجرين', 'إدارة المستأجرين والكيانات الفرعية ضمن النظام متعدد المستأجرين.', [], '/tenants'),
        system('requests-hub', 'fa-clipboard-list', 'الطلبات', 'متابعة الطلبات الداخلية والخارجية من الإنشاء حتى الإغلاق.', [], '/requests'),
        system('saas-platform', 'fa-cubes', 'اشتراكي (SaaS)', 'إدارة اشتراك المنصة السحابية وخطط الخدمة للمستأجرين.', [], '/saas')
      ]
    },
    {
      section: 'المالية والتسويق',
      icon: 'fa-chart-pie',
      systems: [
        system('finance-reports', 'fa-file-invoice-dollar', 'الفواتير والتقارير المالية', 'إدارة الحسابات والتقارير المالية والميزانيات بدقة وشفافية عالية.', [
          mod('دليل الحسابات', '/finance/chart-of-accounts.html'),
          mod('قيود اليومية', '/finance/journal.html'),
          mod('الميزانية العمومية', '/finance/balance-sheet.html'),
          mod('قائمة الدخل', '/finance/income-statement.html'),
          mod('التدفقات النقدية', '/finance/cashflow-summary.html'),
          mod('المصروفات', '/finance/expenses.html'),
          mod('الميزانيات', '/finance/budgets.html'),
          mod('العملاء', '/finance/customers.html'),
          mod('أعمار الذمم المدينة', '/finance/ar-aging.html'),
          mod('التحصيل', '/finance/receivables-collections.html'),
          mod('الأصول الثابتة', '/finance/fixed-assets.html'),
          mod('كشوف الرواتب', '/finance/payroll-runs.html'),
          mod('نظام المدفوعات', '/finance/payments/'),
          mod('الفواتير الذكية', '/finance/payments/smart-invoices.html'),
          mod('التقارير المالية الاستراتيجية', '/finance/strategic-financial-reports.html'),
          mod('التنبؤات بالذكاء الاصطناعي', '/finance/ai-forecasts.html')
        ], '/finance'),
        system('payment-system', 'fa-credit-card', 'نظام الدفع', 'إدارة الدفع والتحصيل والفوترة الذكية بشكل متكامل.', [
          mod('الفواتير الذكية', '/finance/payments/smart-invoices.html'),
          mod('طرق الدفع', '/finance/payments/'),
          mod('خطط الأقساط', '/finance/payment-plans.html'),
          mod('تتبع الدفعات', '/finance/payments/tracking.html'),
          mod('إعدادات الضرائب', '/finance/multiple-taxes.html'),
          mod('قواعد التحصيل', '/finance/payments/collection-rules.html'),
          mod('التذكيرات الآلية', '/finance/payments/reminders.html'),
          mod('إدارة المتأخرات', '/finance/payments/arrears.html'),
          mod('تحليلات الدفع', '/finance/payments/analytics.html'),
          mod('بوابات الدفع', '/gateway-payments'),
          mod('شحن الرصيد', '/credit-topup'),
          mod('المتجر والسلة', '/online-store')
        ]),
        system('sales-system', 'fa-chart-line', 'البيع', 'منظومة بيع متكاملة تربط الفرق والعمليات والتحصيل.', [
          mod('نظام إدارة علاقات العملاء CRM', '/sales/crm'),
          mod('إدارة عمليات البيع', '/sales/operations'),
          mod('نظام نقاط البيع التشابكي', '/sales/pos'),
          mod('العروض والعقود', '/sales/quotes-contracts'),
          mod('نظام العمولات', '/sales/commissions'),
          mod('تتبع الطلبات والشحنات', '/sales/order-tracking')
        ], '/sales'),
        system('ads-center', 'fa-bullhorn', 'مركز المعلنين', 'إدارة الإعلانات والحملات الترويجية ومتابعة الأداء.', [], '/ads'),
        system('marketing-campaigns', 'fa-bullhorn', 'استديو الحملات التسويقية', 'استوديو متكامل لتصميم وإطلاق ومتابعة الحملات التسويقية.', [], '/marketing-campaigns-studio'),
        system('events-studio', 'fa-video', 'استوديو الفعاليات', 'إدارة وتنظيم الفعاليات الافتراضية والحضورية من مكان واحد.', [], '/finance/events-studio-main.html')
      ]
    },
    {
      section: 'الموارد البشرية والخدمات',
      icon: 'fa-users',
      systems: [
        system('hr', 'fa-people-group', 'الموارد البشرية', 'نظام HR شامل يغطي التوظيف وكشوف الرواتب والأداء والتطوير الوظيفي.', [
          mod('إدارة الموظفين', '/hr/employees'),
          mod('بوابة العمليات والطلبات', '/hr/operations'),
          mod('السياسات والإجراءات', '/hr/policies'),
          mod('الموظفون المقبولون', '/hr/accepted-employees'),
          mod('تعيين الموظفين الجدد', '/hr/new-hires'),
          mod('معالجة الطلبات', '/hr/requests'),
          mod('إدارة العهد والأصول', '/hr/assets-custodies'),
          mod('الحضور والانصراف', '/hr/attendance-departure'),
          mod('مركز الحضور والنوبات الذكي', '/hr/attendance-hub'),
          mod('إدارة الرواتب', '/hr/payroll'),
          mod('ملف الموظف 360°', '/hr/employee-360'),
          mod('مركز الرواتب', '/hr/payroll-hub'),
          mod('إدارة الأداء', '/hr/performance'),
          mod('أكاديمية التعلم', '/hr/learning'),
          mod('التحليلات الاستراتيجية', '/hr/strategic-analytics'),
          mod('إدارة المهام', '/hr/tasks-management'),
          mod('الأرشفة الإلكترونية', '/hr/e-archive'),
          mod('قسائم الراتب', '/hr/salary-slips'),
          mod('الإجازات', '/hr/leaves')
        ], '/hr'),
        system('employees', 'fa-users', 'إدارة الموظفين', 'ملف شامل لكل موظف يشمل بياناته ومساره الوظيفي وحضوره وإجازاته.', [], '/hr/employees'),
        system('employee-portal', 'fa-user-tie', 'الموظف', 'بوابة الخدمات الذاتية للموظف: طلبات، إجازات، ورواتب.', [
          mod('الحضور والانصراف', '/hr/attendance-departure'),
          mod('الطلبات', '/hr/requests'),
          mod('الراتب المرن', '/employee/flexible-salary'),
          mod('الاستقالات', '/employee/resignations'),
          mod('تسوية حساب موظف', '/employee/employee-settlement'),
          mod('الإجازات', '/hr/leaves'),
          mod('رصيد الإجازات', '/hr/leave-balance'),
          mod('الإشعارات/الإنذارات', '/hr/notifications-warnings'),
          mod('القرارات', '/hr/decisions'),
          mod('مخالفات أنظمة الشركة', '/hr/company-violations'),
          mod('نماذج التقييم', '/hr/evaluation-forms'),
          mod('التعاميم', '/hr/circulars'),
          mod('السلف/الذمم', '/hr/advances-receivables'),
          mod('الاستبيانات', '/hr/surveys'),
          mod('أنشطة الأعمال', '/hr/business-activities'),
          mod('الخطابات', '/hr/letters'),
          mod('العهد', '/hr/custodies'),
          mod('إدارة العهد والأصول', '/hr/assets-custodies'),
          mod('قسائم الراتب', '/hr/salary-slips'),
          mod('تسجيل الحضور', '/hr/attendance-register'),
          mod('جدول الحضور', '/hr/attendance-table')
        ]),
        system('services', 'fa-headset', 'الخدمات', 'منظومة متكاملة لإدارة طلبات الخدمة ومستوى الدعم وفق SLA محدد.', [
          mod('مكتب إدارة المشاريع', '/services/project-management-office'),
          mod('إدارة الأداء المؤسسي', '/services/institutional-performance'),
          mod('متابعة العمليات', '/services/operations-monitoring'),
          mod('دراسة السوق بالذكاء الاصطناعي', '/services/ai-market-research'),
          mod('خدمة العملاء', '/services/customer-service'),
          mod('الخدمات الإدارية للعميل', '/services/client-admin-services'),
          mod('القاعات الافتراضية', '/services/virtual-halls'),
          mod('دراسات الجدوى', '/services/feasibility-studies'),
          mod('البحوث', '/services/research'),
          mod('الاستشارات والتدريب', '/services/consulting-training')
        ], '/services'),
        system('tasks-management', 'fa-list-check', 'المهام', 'تكليف وتتبع المهام بين الفرق مع أولويات وتواريخ استحقاق واضحة.', [
          mod('القائمة الرئيسية', '/tasks/main-menu'),
          mod('لوحة التحكم', '/tasks/control-panel'),
          mod('مهامي', '/tasks/my-tasks'),
          mod('الإجراءات', '/tasks/procedures'),
          mod('جميع الإجراءات', '/tasks/all-procedures'),
          mod('المهام العامة', '/tasks/general-tasks'),
          mod('العملاء', '/tasks/customers'),
          mod('التفويضات', '/tasks/delegations'),
          mod('التقارير', '/tasks/reports')
        ], '/tasks')
      ]
    },
    {
      section: 'التشغيل والسلسلة',
      icon: 'fa-truck-loading',
      systems: [
        system('supply-chain', 'fa-truck-loading', 'سلاسل التوريد', 'إدارة سلاسل التوريد من الشراء حتى التسليم.', [
          mod('المشتريات', '/supply-chain/purchases'),
          mod('اللوجستيات والنقل والتوصيل', '/supply-chain/logistics'),
          mod('المخزون', '/supply-chain/inventory'),
          mod('التعامل مع الموردين', '/supply-chain/suppliers'),
          mod('إدارة الطلبات والتسليم', '/supply-chain/orders-delivery'),
          mod('الإمداد الذكي', '/supply-chain/smart-procurement'),
          mod('التصنيع', '/supply-chain/manufacturing'),
          mod('حياة المنتج', '/supply-chain/product-lifecycle'),
          mod('الصيانة', '/supply-chain/maintenance'),
          mod('مراقبة الجودة', '/supply-chain/quality-control'),
          mod('السلامة', '/supply-chain/safety'),
          mod('مواصفات ومقايس', '/supply-chain/specs-estimates'),
          mod('تخليص جمركي', '/supply-chain/customs-clearance')
        ], '/supply-chain'),
        system('occupational-health', 'fa-hard-hat', 'السلامة والصحة المهنية', 'منظومة السلامة والصحة المهنية والامتثال للمعايير.', [
          mod('السلامة المهنية', '/education-incubators/ohs'),
          mod('المعايير الدولية', '/education-incubators/ohs'),
          mod('معايير الأيزو', '/education-incubators/ohs'),
          mod('إدارة المخاطر', '/education-incubators/ohs'),
          mod('استشارات السلامة', '/education-incubators/ohs'),
          mod('الدورات التخصصية', '/education-incubators/ohs'),
          mod('تقييم السلامة', '/education-incubators/ohs'),
          mod('تحليل بيانات السلامة', '/education-incubators/ohs')
        ]),
        system('facilities-mgmt', 'fa-building-gear', 'إدارة المرافق', 'إدارة المرافق والصيانة والحجوزات والأصول.', [
          mod('لوحة المرافق', '/facilities'),
          mod('الفعاليات والترفيه', '/facilities/events'),
          mod('العقارات والمباني', '/facilities/real-estate'),
          mod('إدارة الأصول', '/facilities/assets'),
          mod('إدارة المشاريع', '/facilities/projects'),
          mod('صيانة المرافق', '/facilities/projects/maintenance'),
          mod('عقود المرافق', '/facilities/projects/contracts'),
          mod('موردي المرافق', '/facilities/projects/vendors'),
          mod('إدارة الطاقة', '/facilities/projects/energy'),
          mod('إدارة الحشود', '/facilities/projects/crowd')
        ], '/facilities'),
        system('internet-automation', 'fa-robot', 'الإنترنت والأتمتة', 'أتمتة العمليات التسويقية وربط القنوات الرقمية بشكل سلس.', [
          mod('الذكاء الاصطناعي', '/internet-automation/ai'),
          mod('الحوكمة', '/internet-automation/governance'),
          mod('الموائمة', '/internet-automation/compliance'),
          mod('انترنت الأشياء', '/internet-automation/iot'),
          mod('فض النزاعات والتسويات', '/internet-automation/dispute-settlements'),
          mod('السجلات والأرشيف', '/internet-automation/records-archiving'),
          mod('التعلم الإلكتروني', '/internet-automation/elearning'),
          mod('المنتدى', '/internet-automation/forum'),
          mod('المعرفة والتحليل', '/internet-automation/knowledge'),
          mod('الملكية الفكرية', '/internet-automation/intellectual-property'),
          mod('الدردشة مع الزوار', '/internet-automation/visitor-chat')
        ], '/internet-automation')
      ]
    },
    {
      section: 'الفروع والمنصات',
      icon: 'fa-layer-group',
      systems: [
        system('e-offices', 'fa-building', 'المكاتب الإلكترونية', 'منظومة المكاتب الإلكترونية لإدارة العمليات والمبيعات والاشتراكات.', [
          mod('العمليات اليومية', '/e-offices/daily-operations'),
          mod('المبيعات', '/e-offices/sales'),
          mod('الاشتراكات', '/e-offices/subscriptions'),
          mod('التدريب', '/e-offices/training'),
          mod('خدمة العملاء', '/e-offices/customer-service'),
          mod('التقارير التشغيلية', '/e-offices/operational-reports'),
          mod('الموارد البشرية المحلية', '/e-offices/local-hr'),
          mod('المالية التشغيلية', '/e-offices/operational-finance'),
          mod('الملفات', '/e-offices/files'),
          mod('الأرشيف', '/e-offices/archive'),
          mod('المهام', '/e-offices/tasks'),
          mod('الاجتماعات', '/e-offices/meetings'),
          mod('الاستشارات', '/e-offices/consultations'),
          mod('آخر الأخبار', '/e-offices/latest-news'),
          mod('المستخدمين', '/e-offices/users')
        ], '/e-offices'),
        system('platforms', 'fa-layer-group', 'المنصات', 'ربط وإدارة منصات التواصل الاجتماعي وقنوات البيع الإلكتروني.', [
          mod('العمليات اليومية', '/platforms/daily-operations'),
          mod('المبيعات', '/platforms/sales'),
          mod('الاشتراكات', '/platforms/subscriptions'),
          mod('التدريب', '/platforms/training'),
          mod('خدمة العملاء', '/platforms/customer-service'),
          mod('التقارير التشغيلية', '/platforms/operational-reports'),
          mod('الموارد البشرية المحلية', '/platforms/local-hr'),
          mod('المالية التشغيلية', '/platforms/operational-finance')
        ], '/platforms'),
        system('branches', 'fa-code-branch', 'الفروع', 'إدارة فروع المؤسسة الجغرافية مع مزامنة البيانات آنياً.', [
          mod('العمليات اليومية', '/branches/daily-operations'),
          mod('المبيعات', '/branches/sales'),
          mod('الاشتراكات', '/branches/subscriptions'),
          mod('التدريب', '/branches/training'),
          mod('خدمة العملاء', '/branches/customer-service'),
          mod('التقارير التشغيلية', '/branches/operational-reports'),
          mod('الموارد البشرية المحلية', '/branches/local-hr'),
          mod('المالية التشغيلية', '/branches/operational-finance')
        ], '/branches'),
        system('incubators-hub', 'fa-seedling', 'الحاضنات', 'برامج دعم شاملة للشركات الناشئة من الفكرة حتى التشغيل التجاري.', [
          mod('العمليات اليومية', '/incubators-hub/daily-operations'),
          mod('المبيعات', '/incubators-hub/sales'),
          mod('الاشتراكات', '/incubators-hub/subscriptions'),
          mod('التدريب', '/incubators-hub/training'),
          mod('خدمة العملاء', '/incubators-hub/customer-service'),
          mod('التقارير التشغيلية', '/incubators-hub/operational-reports'),
          mod('الموارد البشرية المحلية', '/incubators-hub/local-hr'),
          mod('المالية التشغيلية', '/incubators-hub/operational-finance')
        ], '/incubators-hub'),
        system('education-incubators', 'fa-graduation-cap', 'حاضنات التعليم والتدريب', 'منصة حاضنات التعليم والتدريب المتخصصة ضمن نظام نايوش.', [
          mod('حاضنة السلامة والصحة المهنية', '/education-incubators/ohs'),
          mod('حاضنة سلاسل الإمداد', '/education-incubators/supply-chain'),
          mod('حضانة إدارة المرافق', '/education-incubators/facilities'),
          mod('حاضنة اللوجستيات والنقل', '/education-incubators/logistics'),
          mod('حاضنة إدارة المشاريع', '/education-incubators/project-management'),
          mod('حاضنة HR الموارد البشرية', '/education-incubators/hr')
        ], '/education-incubators'),
        system('naiosh-sectors', 'fa-building-columns', 'قطاعات نايوش', 'منظومة قطاعات نايوش المتخصصة والخدمات القطاعية.', [
          mod('إدارة الأعضاء', '/sectors/member-management'),
          mod('الحوكمة', '/sectors/governance'),
          mod('الأتمتة', '/sectors/automation'),
          mod('الاستدامة', '/sectors/sustainability'),
          mod('القانونية والمحاماة', '/sectors/legal'),
          mod('المهارات والابتكارات', '/sectors/skills-innovation'),
          mod('المبادرات', '/sectors/initiatives'),
          mod('نادي بيتا الرقمي', '/sectors/beta-club')
        ], '/sectors'),
        system('safety-incubator', 'fa-graduation-cap', 'حاضنة السلامة', 'منصة حاضنة السلامة للتدريب والبرامج التخصصية.', [], '/incubator')
      ]
    }
  ];

  function countMainSystems(catalogData) {
    return catalogData.reduce((sum, cat) => sum + cat.systems.length, 0);
  }

  function countModules(catalogData) {
    return catalogData.reduce(
      (sum, cat) => sum + cat.systems.reduce((s, sys) => s + sys.modules.length, 0),
      0
    );
  }

  function buildMainSystemCard(item) {
    const hasModules = item.modules.length > 0;
    const card = document.createElement('article');
    card.className = 'main-system-card';
    card.dataset.systemId = item.id;
    card.setAttribute('aria-label', item.name);

    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.className = 'main-system-trigger';
    trigger.setAttribute('aria-expanded', 'false');
    trigger.innerHTML = `
      <div class="main-system-icon"><i class="fas ${item.icon}" aria-hidden="true"></i></div>
      <div class="main-system-body">
        <h3 class="main-system-name">${item.name}</h3>
        <p class="main-system-desc">${item.desc}</p>
      </div>
      <div class="main-system-meta">
        ${hasModules ? `<span class="main-system-count">${item.modules.length} وحدة</span>` : ''}
        <i class="fas ${hasModules ? 'fa-chevron-down' : 'fa-arrow-left'} main-system-chevron" aria-hidden="true"></i>
      </div>
    `;

    card.appendChild(trigger);

    if (hasModules) {
      const panel = document.createElement('div');
      panel.className = 'system-modules-panel';
      panel.hidden = true;
      panel.innerHTML = `
        <p class="system-modules-hint">محتويات النظام</p>
        <ul class="module-list" role="list">
          ${item.modules.map((m) => `
            <li class="module-item">
              <a href="${m.href}" class="module-link">${m.name}</a>
            </li>
          `).join('')}
        </ul>
        <div class="system-modules-actions">
          ${item.href ? `<a href="${item.href}" class="module-enter-btn"><i class="fas fa-door-open" aria-hidden="true"></i> الدخول إلى النظام</a>` : ''}
          <a href="/saas-signup.html#step1" class="module-demo-btn"><i class="fas fa-calendar-check" aria-hidden="true"></i> اطلب عرضاً تجريبياً</a>
        </div>
      `;
      card.appendChild(panel);

      trigger.addEventListener('click', () => {
        const isExpanded = card.classList.contains('is-expanded');
        const section = card.closest('.product-section');
        if (section) {
          section.querySelectorAll('.main-system-card.is-expanded').forEach((other) => {
            if (other !== card) collapseCard(other);
          });
        }
        if (isExpanded) {
          collapseCard(card);
        } else {
          expandCard(card);
        }
      });
    } else {
      trigger.addEventListener('click', () => {
        const target = item.href || '/saas-signup.html#step1';
        window.location.href = target;
      });
    }

    return card;
  }

  function expandCard(card) {
    const trigger = card.querySelector('.main-system-trigger');
    const panel = card.querySelector('.system-modules-panel');
    card.classList.add('is-expanded');
    if (trigger) trigger.setAttribute('aria-expanded', 'true');
    if (panel) {
      panel.hidden = false;
      requestAnimationFrame(() => {
        panel.classList.add('is-visible');
        panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      });
    }
  }

  function collapseCard(card) {
    const trigger = card.querySelector('.main-system-trigger');
    const panel = card.querySelector('.system-modules-panel');
    card.classList.remove('is-expanded');
    if (trigger) trigger.setAttribute('aria-expanded', 'false');
    if (panel) {
      panel.classList.remove('is-visible');
      panel.hidden = true;
    }
  }

  function hasArabicText(value) {
    return /[\u0600-\u06FF]/.test(String(value || ''));
  }

  function normalizeModuleHref(href) {
    return String(href || '').split('#')[0].replace(/\/+$/, '') || '/';
  }

  function mergeCatalogModules(staticModules, remoteModules) {
    if (!Array.isArray(remoteModules) || !remoteModules.length) {
      return staticModules;
    }
    const staticByHref = new Map(
      (staticModules || []).map((entry) => [normalizeModuleHref(entry.href), entry])
    );

    return remoteModules.map((remote) => {
      const staticMatch = staticByHref.get(normalizeModuleHref(remote.href));
      const remoteName = String(remote.name || '').trim();
      const staticName = staticMatch?.name;
      const name = (
        staticName &&
        hasArabicText(staticName) &&
        !hasArabicText(remoteName)
      ) ? staticName : (hasArabicText(remoteName) ? remoteName : (staticName || remoteName));
      const href = remote.href || staticMatch?.href;
      return { name, href };
    });
  }

  async function hydrateCatalogModules() {
    try {
      const response = await fetch('/api/products/modules', {
        headers: { Accept: 'application/json' }
      });
      if (!response.ok) return;
      const data = await response.json();
      const bySystem = data.modulesBySystem || {};
      mainSystemsCatalog.forEach((section) => {
        section.systems.forEach((sys) => {
          const remote = bySystem[sys.id];
          if (Array.isArray(remote) && remote.length) {
            sys.modules = mergeCatalogModules(sys.modules, remote);
          }
        });
      });
    } catch (_) {
      // Keep static fallback modules when API is unavailable.
    }
  }

  function initMainSystemObserver(root) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.08 });
    root.querySelectorAll('.main-system-card').forEach((card) => observer.observe(card));
    return observer;
  }

  async function renderProductsCatalog(options) {
    const opts = options || {};
    const tabsRoot = document.getElementById(opts.tabsId || 'productsTabs');
    const sectionsRoot = document.getElementById(opts.sectionsId || 'productsSections');
    if (!sectionsRoot) return;

    await hydrateCatalogModules();

    if (tabsRoot) tabsRoot.innerHTML = '';
    sectionsRoot.innerHTML = '';

    mainSystemsCatalog.forEach((cat, idx) => {
      if (tabsRoot) {
        const tab = document.createElement('button');
        tab.type = 'button';
        tab.className = 'products-tab';
        tab.textContent = cat.section;
        tab.addEventListener('click', () => {
          document.getElementById(`ps-${idx}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
        tabsRoot.appendChild(tab);
      }

      const section = document.createElement('section');
      section.className = 'product-section';
      section.id = `ps-${idx}`;

      const head = document.createElement('div');
      head.className = 'product-section-head';
      head.innerHTML = `
        <div class="section-icon"><i class="fas ${cat.icon}"></i></div>
        <h2>${cat.section}</h2>
        <span class="product-section-count">${cat.systems.length} نظام</span>
      `;
      section.appendChild(head);

      const grid = document.createElement('div');
      grid.className = 'main-systems-grid';
      cat.systems.forEach((item) => grid.appendChild(buildMainSystemCard(item)));
      section.appendChild(grid);
      sectionsRoot.appendChild(section);
    });

    initMainSystemObserver(sectionsRoot);

    if (tabsRoot) {
      const sectionEls = mainSystemsCatalog.map((_, i) => document.getElementById(`ps-${i}`));
      const tabEls = tabsRoot.querySelectorAll('.products-tab');
      const activateTab = () => {
        let current = 0;
        sectionEls.forEach((el, i) => {
          if (el && el.getBoundingClientRect().top <= 120) current = i;
        });
        tabEls.forEach((t, i) => t.classList.toggle('active', i === current));
      };
      window.addEventListener('scroll', activateTab, { passive: true });
      activateTab();
    }

    if (opts.updateStats !== false) {
      const systemsEl = document.querySelector('[data-products-stat="systems"]');
      const modulesEl = document.querySelector('[data-products-stat="modules"]');
      const sectorsEl = document.querySelector('[data-products-stat="sectors"]');
      if (systemsEl) systemsEl.textContent = String(countMainSystems(mainSystemsCatalog));
      if (modulesEl) modulesEl.textContent = `${countModules(mainSystemsCatalog)}+`;
      if (sectorsEl) sectorsEl.textContent = String(mainSystemsCatalog.length);
    }
  }

  window.NAIOSH_PRODUCTS_CATALOG = mainSystemsCatalog;
  window.renderProductsCatalog = renderProductsCatalog;
  window.countMainSystems = () => countMainSystems(mainSystemsCatalog);
  window.countProductModules = () => countModules(mainSystemsCatalog);
})();
