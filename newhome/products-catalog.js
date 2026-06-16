(function () {
  'use strict';

  function product(slug, icon, name, desc, href) {
    const item = { slug, icon, name, desc };
    if (href) item.href = href;
    return item;
  }

  const catalog = [
    {
      section: 'الأنظمة والإدارة',
      icon: 'fa-sitemap',
      products: [
        product('user-interface', 'fa-display', 'واجهة المستخدم', 'لوحة تحكم مركزية بتصميم عصري تتيح إدارة جميع وحدات النظام من مكان واحد.'),
        product('home-dashboard', 'fa-house', 'الرئيسية', 'الصفحة الرئيسية للنظام مع ملخص فوري للمؤشرات والأنشطة الحديثة.'),
        product('org-chart', 'fa-sitemap', 'الهيكل الهرمي', 'رسم بياني تفاعلي يعرض بنية المؤسسة ومستويات الإدارة بشكل واضح.'),
        product('roles-permissions', 'fa-user-shield', 'إدارة الأدوار والصلاحيات', 'تحديد صلاحيات دقيقة لكل دور وظيفي لضمان أمان البيانات.'),
        product('strategic-mgmt', 'fa-chess', 'الإدارة الاستراتيجية', 'أدوات تخطيط استراتيجي ومتابعة الأهداف على المستوى المؤسسي.'),
        product('member-management', 'fa-id-card', 'إدارة الأعضاء', 'تسجيل وإدارة بيانات الأعضاء والمشتركين مع تتبع حالة كل عضو.'),
        product('subscriptions', 'fa-credit-card', 'إدارة الاشتراكات', 'إدارة خطط الاشتراك والدفع وتجديد العقود بشكل آلي.'),
        product('system-log', 'fa-clipboard-list', 'سجل النظام', 'توثيق جميع العمليات والتغييرات لأغراض المراجعة والتدقيق.'),
        product('identity-settings', 'fa-fingerprint', 'إعدادات الهوية', 'تخصيص هوية المؤسسة البصرية واللغوية على مستوى النظام.'),
        product('records-archive', 'fa-archive', 'نظام الأرشفة', 'أرشفة السجلات والوثائق المؤسسية مع تصنيف آمن وسهل الوصول.', '/archive'),
        product('operational-policies', 'fa-scale-balanced', 'السياسات التشغيلية المعتمدة', 'إدارة السياسات التشغيلية المعتمدة ونشرها على مستوى المؤسسة.', '/operational-policies'),
        product('tenants-hub', 'fa-building', 'المستأجرين', 'إدارة المستأجرين والكيانات الفرعية ضمن النظام متعدد المستأجرين.', '/tenants'),
        product('requests-hub', 'fa-clipboard-list', 'الطلبات', 'متابعة الطلبات الداخلية والخارجية من الإنشاء حتى الإغلاق.', '/requests'),
        product('saas-platform', 'fa-cubes', 'اشتراكي (SaaS)', 'إدارة اشتراك المنصة السحابية وخطط الخدمة للمستأجرين.', '/saas'),
        product('executive-management', 'fa-user-tie', 'الإدارة التنفيذية', 'لوحة الإدارة التنفيذية لمتابعة القرارات والمؤشرات العليا.', '/strategic/executive'),
        product('smart-systems', 'fa-microchip', 'الأنظمة الذكية', 'تنسيق الأنظمة الذكية والتكاملات التقنية على مستوى المؤسسة.', '/strategic/smart-systems'),
        product('operations-management', 'fa-cogs', 'إدارة العمليات', 'تخطيط ومتابعة العمليات التشغيلية والسياسات المرتبطة بها.', '/strategic/operations'),
        product('financial-approvals', 'fa-file-signature', 'الموافقات المالية', 'سير عمل الموافقات المالية والاعتمادات قبل التنفيذ.', '/strategic/financial-approvals'),
        product('quality-audit', 'fa-clipboard-check', 'الجودة والتدقيق', 'مراقبة الجودة والتدقيق الداخلي وفق معايير الاعتماد.', '/strategic/quality'),
        product('strategic-evaluation', 'fa-star', 'التقييم', 'تقييم الأداء المؤسسي والمتابعة الدورية للنتائج.', '/strategic/evaluation'),
        product('information-center', 'fa-info-circle', 'مركز المعلومات', 'تجميع المعلومات والتعاميم المرجعية للإدارة والموظفين.', '/strategic/information'),
        product('strategic-reports', 'fa-chart-line', 'التقارير الاستراتيجية', 'تقارير استراتيجية شاملة لدعم اتخاذ القرار.', '/strategic/reports'),
        product('my-page-analytics', 'fa-chart-column', 'إحصائيات صفحتي', 'مؤشرات أداء صفحتك الشخصية داخل المنصة.', '/my-page-analytics')
      ]
    },
    {
      section: 'التعليم والتدريب',
      icon: 'fa-graduation-cap',
      products: [
        product('education-system', 'fa-graduation-cap', 'نظام التعليم', 'منصة تعليمية متكاملة تدعم المحتوى التفاعلي والاختبارات والشهادات.'),
        product('beta-digital-club', 'fa-flask', 'نادي بيتا الرقمي', 'بيئة تجريبية للمطورين والمبتكرين لتجربة أحدث ميزات النظام.'),
        product('certifications', 'fa-award', 'الشهادات والابتكارات', 'إصدار الشهادات المعتمدة وتتبع الإنجازات لكل مستخدم.'),
        product('initiatives', 'fa-rocket', 'المبادرات', 'إطلاق وإدارة المبادرات الداخلية وقياس أثرها على المؤسسة.'),
        product('education-incubators', 'fa-graduation-cap', 'حاضنات التعليم والتدريب', 'منصة حاضنات التعليم والتدريب المتخصصة ضمن نظام نايوش.', '/education-incubators'),
        product('eti-ohs', 'fa-hard-hat', 'حاضنة السلامة والصحة المهنية', 'برامج وتدريب متخصص في السلامة والصحة المهنية.', '/education-incubators/ohs'),
        product('eti-supply-chain', 'fa-truck-loading', 'حاضنة سلاسل الإمداد', 'حاضنة تعليمية لسلاسل الإمداد والتوريد الذكي.', '/education-incubators/supply-chain'),
        product('eti-facilities', 'fa-building', 'حضانة إدارة المرافق', 'تدريب وبرامج احتضان في إدارة المرافق والصيانة.', '/education-incubators/facilities'),
        product('eti-logistics', 'fa-shipping-fast', 'حاضنة اللوجستيات والنقل', 'حاضنة متخصصة في اللوجستيات والنقل والتوصيل.', '/education-incubators/logistics'),
        product('eti-project-management', 'fa-project-diagram', 'حاضنة إدارة المشاريع', 'برامج احتضان وتدريب في إدارة المشاريع الاحترافية.', '/education-incubators/project-management'),
        product('eti-hr', 'fa-users-gear', 'حاضنة HR الموارد البشرية', 'حاضنة تعليمية لإدارة الموارد البشرية والتطوير الوظيفي.', '/education-incubators/hr'),
        product('safety-incubator', 'fa-graduation-cap', 'حاضنة السلامة', 'منصة حاضنة السلامة للتدريب والبرامج التخصصية.', '/incubator'),
        product('events-studio', 'fa-video', 'استوديو الفعاليات', 'إدارة وتنظيم الفعاليات الافتراضية والحضورية من مكان واحد.', '/finance/events-studio-main.html'),
        product('training-development', 'fa-chalkboard-teacher', 'التدريب والتطوير', 'إدارة برامج التدريب والتطوير المؤسسي والمتابعة.', '/strategic/training')
      ]
    },
    {
      section: 'الإعلانات والتسويق',
      icon: 'fa-bullhorn',
      products: [
        product('marketing-sales', 'fa-bullhorn', 'التسويق والبيع', 'أدوات تسويق رقمي متكاملة وإدارة حملات البيع وتحليل الأداء.'),
        product('automation', 'fa-bolt', 'الإنترنت والأتمتة', 'أتمتة العمليات التسويقية وربط القنوات الرقمية بشكل سلس.'),
        product('platforms', 'fa-layer-group', 'المنصات', 'ربط وإدارة منصات التواصل الاجتماعي وقنوات البيع الإلكتروني.'),
        product('ads-center', 'fa-bullhorn', 'مركز المعلنين', 'إدارة الإعلانات والحملات الترويجية ومتابعة الأداء.', '/ads'),
        product('sales-system', 'fa-chart-line', 'نظام البيع', 'منظومة بيع متكاملة تربط الفرق والعمليات والتحصيل.', '/sales'),
        product('crm', 'fa-users-cog', 'نظام إدارة علاقات العملاء CRM', 'إدارة علاقات العملاء وفرص البيع والمتابعة.', '/sales/crm'),
        product('sales-operations', 'fa-handshake', 'إدارة عمليات البيع', 'تنسيق عمليات البيع من العرض حتى الإغلاق.', '/sales/operations'),
        product('pos', 'fa-cash-register', 'نظام نقاط البيع التشابكي', 'نقاط بيع متصلة بالمخزون والفواتير والتقارير.', '/sales/pos'),
        product('quotes-contracts', 'fa-file-contract', 'العروض والعقود', 'إعداد العروض وإدارة العقود ومتابعة الاعتماد.', '/sales/quotes-contracts'),
        product('commissions', 'fa-percentage', 'نظام العمولات', 'حساب ومتابعة عمولات المبيعات وفق السياسات المعتمدة.', '/sales/commissions'),
        product('order-tracking', 'fa-shipping-fast', 'تتبع الطلبات والشحنات', 'متابعة الطلبات والشحنات حتى التسليم النهائي.', '/sales/order-tracking'),
        product('strategic-advertisers', 'fa-ad', 'مركز المعلنين الاستراتيجي', 'إدارة المعلنين والشراكات الترويجية على المستوى الاستراتيجي.', '/strategic/advertisers')
      ]
    },
    {
      section: 'التقنية والأنظمة',
      icon: 'fa-microchip',
      products: [
        product('dev-center', 'fa-code', 'مركز المطورين', 'واجهات API، توثيق تقني، وأدوات بناء تكاملات مخصصة مع النظام.'),
        product('governance', 'fa-shield-halved', 'الحوكمة والأمنية', 'سياسات حوكمة بيانات صارمة وحماية متقدمة من التهديدات الأمنية.'),
        product('project-mgmt', 'fa-diagram-project', 'نظام إدارة المشاريع', 'تخطيط وتتبع المشاريع بلوحة مهام بصرية ومؤشرات تقدم حية.'),
        product('naiosh-fit', 'fa-dumbbell', 'نظام نايوش فيت', 'نظام متخصص في إدارة المرافق الرياضية والاشتراكات الصحية.'),
        product('business-class', 'fa-briefcase', 'نظام البزنس كلاس', 'حل متكامل للشركات يشمل الأتمتة والتحليلات المتقدمة وإدارة الأعمال.'),
        product('e-offices', 'fa-building', 'المكاتب الإلكترونية', 'منظومة المكاتب الإلكترونية لإدارة العمليات والمبيعات والاشتراكات.', '/e-offices'),
        product('payment-system', 'fa-credit-card', 'نظام الدفع', 'إدارة الدفع والتحصيل والفوترة الذكية بشكل متكامل.', '/finance'),
        product('smart-invoices', 'fa-file-invoice-dollar', 'الفواتير الذكية', 'إصدار ومتابعة الفواتير الذكية مع ربط طرق الدفع.', '/finance'),
        product('payment-methods', 'fa-wallet', 'طرق الدفع', 'إعداد وإدارة طرق الدفع المتاحة للعملاء.', '/finance'),
        product('installment-plans', 'fa-calendar-days', 'خطط الأقساط', 'تصميم خطط أقساط مرنة ومتابعة السداد.', '/finance'),
        product('payment-tracking', 'fa-chart-line', 'تتبع الدفعات', 'متابعة الدفعات والتحصيل في الوقت الفعلي.', '/finance'),
        product('tax-settings', 'fa-percent', 'إعدادات الضرائب', 'ضبط الضرائب والرسوم وفق السياسات المعتمدة.', '/finance'),
        product('payment-reminders', 'fa-bell', 'التذكيرات الآلية', 'تذكيرات آلية للعملاء قبل مواعيد السداد.', '/finance'),
        product('overdue-management', 'fa-exclamation-circle', 'إدارة المتأخرات', 'متابعة المتأخرات وإجراءات التحصيل اللازمة.', '/finance'),
        product('payment-analytics', 'fa-chart-bar', 'تحليلات الدفع', 'تحليلات شاملة لأداء التحصيل والدفع.', '/finance'),
        product('collection-rules', 'fa-cog', 'قواعد التحصيل', 'تعريف قواعد التحصيل الآلي وفق سياسات المؤسسة.', '/finance'),
        product('supply-chain', 'fa-truck-loading', 'سلاسل التوريد', 'إدارة سلاسل التوريد من الشراء حتى التسليم.', '/supply-chain'),
        product('purchases', 'fa-shopping-cart', 'المشتريات', 'إدارة طلبات الشراء والاعتمادات والموردين.', '/supply-chain/purchases'),
        product('logistics', 'fa-truck', 'اللوجستيات والنقل والتوصيل', 'تنسيق النقل والتوصيل ومتابعة الشحنات.', '/supply-chain/logistics'),
        product('inventory', 'fa-boxes', 'المخزون', 'إدارة المخزون والحركات والتنبيهات.', '/supply-chain/inventory'),
        product('suppliers', 'fa-handshake', 'التعامل مع الموردين', 'سجل الموردين وتقييمهم وإدارة العلاقة.', '/supply-chain/suppliers'),
        product('smart-procurement', 'fa-brain', 'الإمداد الذكي', 'إدارة سلاسل التوريد والإمداد الذكي بالتنبؤ والأتمتة.', '/supply-chain/smart-procurement'),
        product('manufacturing', 'fa-industry', 'التصنيع', 'متابعة عمليات التصنيع والإنتاج.', '/supply-chain/manufacturing'),
        product('quality-control', 'fa-check-double', 'مراقبة الجودة', 'فحص الجودة وضبط المعايير في سلسلة التوريد.', '/supply-chain/quality-control'),
        product('orders-delivery', 'fa-clipboard-list', 'إدارة الطلبات والتسليم', 'متابعة الطلبات والتسليم في سلسلة التوريد.', '/supply-chain/orders-delivery'),
        product('product-lifecycle', 'fa-recycle', 'حياة المنتج', 'إدارة دورة حياة المنتج من التصميم حتى الإيقاف.', '/supply-chain/product-lifecycle'),
        product('sc-maintenance', 'fa-wrench', 'صيانة سلسلة التوريد', 'صيانة المعدات والأصول في سلسلة التوريد.', '/supply-chain/maintenance'),
        product('sc-safety', 'fa-hard-hat', 'سلامة سلسلة التوريد', 'معايير السلامة في عمليات التوريد والتصنيع.', '/supply-chain/safety'),
        product('specs-estimates', 'fa-ruler-combined', 'مواصفات ومقايس', 'إعداد المواصفات والمقايسات للمشتريات.', '/supply-chain/specs-estimates'),
        product('customs-clearance', 'fa-passport', 'تخليص جمركي', 'إدارة التخليص الجمركي والمستندات المرتبطة.', '/supply-chain/customs-clearance'),
        product('occupational-health', 'fa-hard-hat', 'السلامة والصحة المهنية', 'منظومة السلامة والصحة المهنية والامتثال.', '/education-incubators/ohs'),
        product('occupational-safety', 'fa-shield-alt', 'السلامة المهنية', 'سياسات وإجراءات السلامة المهنية في بيئة العمل.', '/education-incubators/ohs'),
        product('risk-management', 'fa-exclamation-triangle', 'إدارة المخاطر', 'تحديد وتقييم ومتابعة المخاطر التشغيلية.', '/education-incubators/ohs'),
        product('international-standards', 'fa-globe', 'المعايير الدولية', 'الامتثال للمعايير الدولية في السلامة والجودة.', '/education-incubators/ohs'),
        product('iso-standards', 'fa-certificate', 'معايير الأيزو', 'تطبيق ومتابعة معايير الأيزو المعتمدة.', '/education-incubators/ohs'),
        product('ohs-consulting', 'fa-user-tie', 'استشارات السلامة', 'خدمات استشارية متخصصة في السلامة المهنية.', '/education-incubators/ohs'),
        product('specialized-courses', 'fa-graduation-cap', 'الدورات التخصصية', 'دورات تدريبية متخصصة في السلامة والصحة المهنية.', '/education-incubators/ohs'),
        product('ohs-evaluation', 'fa-clipboard-check', 'تقييم السلامة', 'تقييم السلامة للشركات والمصانع والمشاريع.', '/education-incubators/ohs'),
        product('ohs-data-analysis', 'fa-chart-bar', 'تحليل بيانات السلامة', 'تحليل بيانات السلامة واستخراج المؤشرات.', '/education-incubators/ohs'),
        product('facilities-mgmt', 'fa-building-gear', 'إدارة المرافق', 'إدارة المرافق والصيانة والحجوزات والأصول.', '/facilities'),
        product('facilities-events', 'fa-calendar-star', 'الفعاليات والترفيه', 'إدارة فعاليات المرافق والأنشطة الترفيهية.', '/facilities/events'),
        product('facilities-real-estate', 'fa-city', 'العقارات والمباني', 'إدارة العقارات والمباني والمساحات.', '/facilities/real-estate'),
        product('facilities-assets', 'fa-boxes-stacked', 'إدارة الأصول', 'تتبع أصول المرافق والصيانة الدورية.', '/facilities/assets'),
        product('facilities-projects', 'fa-diagram-project', 'مشاريع المرافق', 'إدارة مشاريع المرافق والتطوير.', '/facilities/projects'),
        product('facilities-maintenance', 'fa-screwdriver-wrench', 'صيانة المرافق', 'جدولة وتنفيذ صيانة المرافق والمعدات.', '/facilities/projects/maintenance'),
        product('facilities-contracts', 'fa-file-contract', 'عقود المرافق', 'إدارة عقود الطرف الثاني للمرافق.', '/facilities/projects/contracts'),
        product('facilities-vendors', 'fa-people-carry-box', 'موردي المرافق', 'إدارة موردي خدمات المرافق.', '/facilities/projects/vendors'),
        product('facilities-energy', 'fa-bolt', 'إدارة الطاقة', 'مراقبة وإدارة استهلاك الطاقة في المرافق.', '/facilities/projects/energy'),
        product('facilities-crowd', 'fa-people-group', 'إدارة الحشود', 'تنظيم وإدارة الحشود في الفعاليات والمرافق.', '/facilities/projects/crowd'),
        product('ai-integration', 'fa-brain', 'الذكاء الاصطناعي', 'تكامل الذكاء الاصطناعي في العمليات والخدمات.', '/internet-automation/ai'),
        product('iot', 'fa-network-wired', 'انترنت الأشياء', 'ربط الأجهزة والحساسات لمراقبة التشغيل.', '/internet-automation/iot'),
        product('elearning', 'fa-graduation-cap', 'التعلم الإلكتروني', 'منصة التعلم الإلكتروني والمحتوى التفاعلي.', '/internet-automation/elearning'),
        product('ia-compliance', 'fa-balance-scale', 'الموائمة', 'إدارة الامتثال والموائمة التنظيمية.', '/internet-automation/compliance'),
        product('ia-forum', 'fa-comments', 'المنتدى', 'منتدى النقاش والتواصل الداخلي.', '/internet-automation/forum'),
        product('ia-knowledge', 'fa-lightbulb', 'المعرفة والتحليل', 'إدارة المعرفة والتحليل المؤسسي.', '/internet-automation/knowledge'),
        product('intellectual-property', 'fa-copyright', 'الملكية الفكرية', 'حماية وإدارة الملكية الفكرية.', '/internet-automation/intellectual-property'),
        product('records-archiving-ia', 'fa-archive', 'السجلات والأرشيف', 'أرشفة السجلات الرقمية ضمن منظومة الأتمتة.', '/internet-automation/records-archiving'),
        product('visitor-chat', 'fa-comment-dots', 'الدردشة مع الزوار', 'دردشة مباشرة مع زوار الموقع والعملاء المحتملين.', '/internet-automation/visitor-chat')
      ]
    },
    {
      section: 'الأعمال والاستشارات',
      icon: 'fa-handshake',
      products: [
        product('services', 'fa-headset', 'الخدمات', 'منظومة متكاملة لإدارة طلبات الخدمة ومستوى الدعم وفق SLA محدد.'),
        product('hr', 'fa-people-group', 'الموارد البشرية', 'نظام HR شامل يغطي التوظيف وكشوف الرواتب والأداء والتطوير الوظيفي.'),
        product('finance', 'fa-chart-pie', 'المالية', 'إدارة الحسابات والتقارير المالية والميزانيات بدقة وشفافية عالية.'),
        product('employees', 'fa-users', 'إدارة الموظفين', 'ملف شامل لكل موظف يشمل بياناته ومساره الوظيفي وحضوره واجازاته.'),
        product('clients', 'fa-handshake', 'العملاء', 'إدارة علاقات العملاء (CRM) لمتابعة التفاعلات وفرص البيع.'),
        product('tasks', 'fa-list-check', 'المهام', 'تكليف وتتبع المهام بين الفرق مع أولويات وتواريخ استحقاق واضحة.'),
        product('legal', 'fa-scale-balanced', 'القانونية والمحاماة', 'إدارة العقود والوثائق القانونية والمواعيد القضائية بكل سهولة.'),
        product('employee-portal', 'fa-user-tie', 'بوابة الموظف', 'بوابة الخدمات الذاتية للموظف: طلبات، إجازات، ورواتب.', '/hr'),
        product('attendance-departure', 'fa-clock', 'الحضور والانصراف', 'تسجيل ومتابعة الحضور والانصراف للموظفين.', '/hr/attendance-departure'),
        product('emp-leaves', 'fa-umbrella-beach', 'الإجازات', 'طلب ومتابعة الإجازات واعتمادها.', '/hr/leaves'),
        product('salary-slips', 'fa-receipt', 'قسائم الراتب', 'عرض وإصدار قسائم الرواتب للموظفين.', '/hr/salary-slips'),
        product('pmo', 'fa-project-diagram', 'مكتب إدارة المشاريع', 'تنسيق المشاريع والمبادرات على مستوى المؤسسة.'),
        product('customer-service-module', 'fa-headset', 'خدمة العملاء', 'إدارة تذاكر الدعم ورضا العملاء.'),
        product('feasibility-studies', 'fa-calculator', 'دراسات الجدوى', 'إعداد ومراجعة دراسات الجدوى الاقتصادية.'),
        product('consulting-training', 'fa-chalkboard-teacher', 'الاستشارات والتدريب', 'إدارة طلبات الاستشارة وبرامج التدريب.'),
        product('institutional-performance', 'fa-chart-line', 'إدارة الأداء المؤسسي', 'متابعة مؤشرات الأداء المؤسسي والتحسين المستمر.'),
        product('operations-monitoring', 'fa-eye', 'متابعة العمليات', 'مراقبة العمليات التشغيلية في الوقت الفعلي.'),
        product('ai-market-research', 'fa-brain', 'دراسة السوق بالذكاء الاصطناعي', 'تحليل السوق باستخدام أدوات الذكاء الاصطناعي.'),
        product('client-admin-services', 'fa-user-cog', 'الخدمات الإدارية للعميل', 'تقديم الخدمات الإدارية المتكاملة للعملاء.'),
        product('virtual-halls', 'fa-video', 'القاعات الافتراضية', 'قاعات افتراضية للاجتماعات والفعاليات.'),
        product('research-services', 'fa-search', 'البحوث', 'إدارة البحوث والدراسات المتخصصة.'),
        product('emp-requests', 'fa-clipboard-list', 'طلبات الموظف', 'تقديم ومتابعة طلبات الموظفين الإدارية.', '/hr/requests'),
        product('flexible-salary', 'fa-sliders-h', 'الراتب المرن', 'إدارة الرواتب المرنة والحوافز.', '/employee/flexible-salary'),
        product('resignations', 'fa-user-minus', 'الاستقالات', 'إدارة طلبات الاستقالة وإجراءاتها.', '/employee/resignations'),
        product('employee-settlement', 'fa-file-signature', 'تسوية حساب موظف', 'تسوية مستحقات الموظف عند إنهاء الخدمة.', '/employee/employee-settlement'),
        product('leave-balance', 'fa-calendar-check', 'رصيد الإجازات', 'عرض رصيد الإجازات المتبقي لكل موظف.', '/hr/leave-balance'),
        product('evaluation-forms', 'fa-clipboard-check', 'نماذج التقييم', 'نماذج تقييم الأداء الوظيفي.', '/hr/evaluation-forms'),
        product('custodies', 'fa-box', 'العهد', 'إدارة عهد الموظفين والمستلزمات.', '/hr/custodies'),
        product('assets-custodies', 'fa-boxes-stacked', 'إدارة العهد والأصول', 'تتبع العهد والأصول المسلمة للموظفين.', '/hr/assets-custodies')
      ]
    },
    {
      section: 'الحاضنات والتخصصات',
      icon: 'fa-seedling',
      products: [
        product('incubators', 'fa-seedling', 'الحاضنات', 'برامج دعم شاملة للشركات الناشئة من الفكرة حتى التشغيل التجاري.'),
        product('branches', 'fa-code-branch', 'الفروع', 'إدارة فروع المؤسسة الجغرافية مع مزامنة البيانات آنياً.'),
        product('naiosh-sectors', 'fa-building-columns', 'قطاعات نايوش', 'منظومة قطاعات نايوش المتخصصة والخدمات القطاعية.', '/sectors'),
        product('sector-automation', 'fa-robot', 'الأتمتة', 'حلول الأتمتة القطاعية لرفع كفاءة العمليات.', '/automation'),
        product('sector-sustainability', 'fa-leaf', 'الاستدامة', 'مبادرات ومؤشرات الاستدامة البيئية والاجتماعية.', '/sustainability'),
        product('sector-skills-innovation', 'fa-lightbulb', 'المهارات والابتكارات', 'تطوير المهارات والابتكار المؤسسي.', '/skills-innovation')
      ]
    },
    {
      section: 'المكاتب الإلكترونية',
      icon: 'fa-building',
      products: [
        product('eo-daily-operations', 'fa-calendar-day', 'العمليات اليومية', 'متابعة وتنفيذ العمليات اليومية للمكتب الإلكتروني.', '/e-offices/daily-operations'),
        product('eo-sales', 'fa-chart-line', 'مبيعات المكاتب', 'إدارة فرص البيع والعروض والصفقات للمكتب.', '/e-offices/sales'),
        product('eo-subscriptions', 'fa-cubes', 'اشتراكات المكاتب', 'إدارة خطط الاشتراك وتجديد العملاء.', '/e-offices/subscriptions'),
        product('eo-training', 'fa-chalkboard-teacher', 'تدريب المكاتب', 'الدورات والبرامج التدريبية للموظفين.', '/e-offices/training'),
        product('eo-customer-service', 'fa-headset', 'خدمة عملاء المكاتب', 'التذاكر والاستفسارات ورضا العملاء.', '/e-offices/customer-service'),
        product('eo-operational-reports', 'fa-chart-pie', 'التقارير التشغيلية', 'مؤشرات الأداء والتقارير الدورية للمكتب.', '/e-offices/operational-reports'),
        product('eo-local-hr', 'fa-users', 'الموارد البشرية المحلية', 'شؤون الموظفين المحليين في المكتب.', '/e-offices/local-hr'),
        product('eo-operational-finance', 'fa-coins', 'المالية التشغيلية', 'المصروفات والتحصيل والميزانية التشغيلية.', '/e-offices/operational-finance'),
        product('eo-files', 'fa-folder-open', 'ملفات المكاتب', 'إدارة المستندات والمرفقات الرسمية.', '/e-offices/files'),
        product('eo-archive', 'fa-box-archive', 'أرشيف المكاتب', 'أرشفة السجلات والوثائق التاريخية.', '/e-offices/archive'),
        product('eo-tasks', 'fa-list-check', 'مهام المكاتب', 'توزيع ومتابعة مهام فريق المكتب.', '/e-offices/tasks'),
        product('eo-meetings', 'fa-video', 'اجتماعات المكاتب', 'جدولة الاجتماعات ومحاضر الحضور.', '/e-offices/meetings'),
        product('eo-consultations', 'fa-user-tie', 'استشارات المكاتب', 'طلبات الاستشارة والمتابعة مع الخبراء.', '/e-offices/consultations'),
        product('eo-latest-news', 'fa-newspaper', 'آخر أخبار المكاتب', 'التعاميم والإعلانات الداخلية.', '/e-offices/latest-news'),
        product('eo-users', 'fa-user-gear', 'مستخدمي المكاتب', 'إدارة حسابات مستخدمي المكتب الإلكتروني.', '/e-offices/users')
      ]
    },
    {
      section: 'منصات التشغيل',
      icon: 'fa-layer-group',
      products: [
        product('pl-daily-operations', 'fa-calendar-day', 'عمليات المنصات اليومية', 'متابعة العمليات اليومية على مستوى المنصة.', '/platforms/daily-operations'),
        product('pl-sales', 'fa-chart-line', 'مبيعات المنصات', 'إدارة المبيعات والعروض على المنصة.', '/platforms/sales'),
        product('pl-subscriptions', 'fa-cubes', 'اشتراكات المنصات', 'إدارة اشتراكات العملاء على المنصة.', '/platforms/subscriptions'),
        product('pl-training', 'fa-chalkboard-teacher', 'تدريب المنصات', 'برامج التدريب المرتبطة بالمنصة.', '/platforms/training'),
        product('pl-customer-service', 'fa-headset', 'خدمة عملاء المنصات', 'دعم العملاء والتذاكر على المنصة.', '/platforms/customer-service'),
        product('pl-operational-reports', 'fa-chart-pie', 'تقارير المنصات', 'تقارير تشغيلية ومؤشرات أداء المنصة.', '/platforms/operational-reports'),
        product('pl-local-hr', 'fa-users', 'موارد بشرية المنصات', 'شؤون الموظفين على مستوى المنصة.', '/platforms/local-hr'),
        product('pl-operational-finance', 'fa-coins', 'مالية المنصات', 'المالية التشغيلية للمنصة.', '/platforms/operational-finance')
      ]
    },
    {
      section: 'عمليات الفروع',
      icon: 'fa-code-branch',
      products: [
        product('br-daily-operations', 'fa-calendar-day', 'عمليات الفروع اليومية', 'متابعة العمليات اليومية على مستوى الفرع.', '/branches/daily-operations'),
        product('br-sales', 'fa-chart-line', 'مبيعات الفروع', 'إدارة المبيعات والصفقات في الفرع.', '/branches/sales'),
        product('br-subscriptions', 'fa-cubes', 'اشتراكات الفروع', 'إدارة اشتراكات العملاء في الفرع.', '/branches/subscriptions'),
        product('br-training', 'fa-chalkboard-teacher', 'تدريب الفروع', 'برامج التدريب على مستوى الفرع.', '/branches/training'),
        product('br-customer-service', 'fa-headset', 'خدمة عملاء الفروع', 'دعم العملاء والتذاكر في الفرع.', '/branches/customer-service'),
        product('br-operational-reports', 'fa-chart-pie', 'تقارير الفروع', 'تقارير تشغيلية ومؤشرات الفرع.', '/branches/operational-reports'),
        product('br-local-hr', 'fa-users', 'موارد بشرية الفروع', 'شؤون الموظفين في الفرع.', '/branches/local-hr'),
        product('br-operational-finance', 'fa-coins', 'مالية الفروع', 'المالية التشغيلية للفرع.', '/branches/operational-finance')
      ]
    },
    {
      section: 'عمليات الحاضنات',
      icon: 'fa-seedling',
      products: [
        product('ic-daily-operations', 'fa-calendar-day', 'عمليات الحاضنات اليومية', 'متابعة العمليات اليومية في الحاضنة.', '/incubators-hub/daily-operations'),
        product('ic-sales', 'fa-chart-line', 'مبيعات الحاضنات', 'إدارة المبيعات والصفقات في الحاضنة.', '/incubators-hub/sales'),
        product('ic-subscriptions', 'fa-cubes', 'اشتراكات الحاضنات', 'إدارة اشتراكات العملاء في الحاضنة.', '/incubators-hub/subscriptions'),
        product('ic-training', 'fa-chalkboard-teacher', 'تدريب الحاضنات', 'برامج التدريب في الحاضنة.', '/incubators-hub/training'),
        product('ic-customer-service', 'fa-headset', 'خدمة عملاء الحاضنات', 'دعم العملاء في الحاضنة.', '/incubators-hub/customer-service'),
        product('ic-operational-reports', 'fa-chart-pie', 'تقارير الحاضنات', 'تقارير تشغيلية ومؤشرات الحاضنة.', '/incubators-hub/operational-reports'),
        product('ic-local-hr', 'fa-users', 'موارد بشرية الحاضنات', 'شؤون الموظفين في الحاضنة.', '/incubators-hub/local-hr'),
        product('ic-operational-finance', 'fa-coins', 'مالية الحاضنات', 'المالية التشغيلية للحاضنة.', '/incubators-hub/operational-finance')
      ]
    },
    {
      section: 'إدارة المهام التفصيلية',
      icon: 'fa-tasks',
      products: [
        product('tasks-main-menu', 'fa-home', 'قائمة المهام الرئيسية', 'القائمة الرئيسية لنظام إدارة المهام.', '/tasks/main-menu'),
        product('tasks-control-panel', 'fa-sliders-h', 'لوحة تحكم المهام', 'لوحة التحكم المركزية للمهام.', '/tasks/control-panel'),
        product('my-tasks', 'fa-check-square', 'مهامي', 'عرض ومتابعة المهام المسندة إليك.', '/tasks/my-tasks'),
        product('procedures', 'fa-file-alt', 'الإجراءات', 'إدارة الإجراءات والخطوات التشغيلية.', '/tasks/procedures'),
        product('all-procedures', 'fa-list-check', 'جميع الإجراءات', 'سجل شامل لجميع الإجراءات المعتمدة.', '/tasks/all-procedures'),
        product('general-tasks', 'fa-clipboard-list', 'المهام العامة', 'المهام العامة المشتركة بين الفرق.', '/tasks/general-tasks'),
        product('task-customers', 'fa-users', 'عملاء المهام', 'ربط العملاء بمهام المتابعة والتنفيذ.', '/tasks/customers'),
        product('delegations', 'fa-user-friends', 'التفويضات', 'تفويض المهام والصلاحيات بين الموظفين.', '/tasks/delegations'),
        product('task-reports', 'fa-chart-bar', 'تقارير المهام', 'تقارير أداء المهام والإنجاز.', '/tasks/reports')
      ]
    }
  ];

  function getProductHref(item) {
    return item.href || `/products/${item.slug}`;
  }

  function countProducts(catalogData) {
    return catalogData.reduce((sum, cat) => sum + cat.products.length, 0);
  }

  function deriveFeatures(desc) {
    if (!desc) return [];
    const byClause = desc
      .split(/[.،؛]|(?:\s+[-–—]\s+)/)
      .map((s) => s.trim())
      .filter((s) => s.length > 5);
    if (byClause.length >= 2) return byClause.slice(0, 3);
    const words = desc.split(/\s+/).filter(Boolean);
    if (words.length <= 10) return [desc];
    const size = Math.ceil(words.length / 3);
    return [0, 1, 2]
      .map((i) => words.slice(i * size, (i + 1) * size).join(' '))
      .filter(Boolean);
  }

  function buildProductCard(item) {
    const href = getProductHref(item);
    const features = deriveFeatures(item.desc);
    const card = document.createElement('article');
    card.className = 'product-card';
    card.setAttribute('aria-label', item.name);
    const featuresHtml = features
      .map((f) => `<li><i class="fas fa-check" aria-hidden="true"></i><span>${f}</span></li>`)
      .join('');
    card.innerHTML = `
      <div class="card-icon"><i class="fas ${item.icon}"></i></div>
      <h3>${item.name}</h3>
      <p class="card-desc">${item.desc}</p>
      ${features.length ? `<ul class="card-features">${featuresHtml}</ul>` : ''}
      <div class="card-actions">
        <a href="${href}" class="card-btn card-btn-primary">
          <i class="fas fa-arrow-left" aria-hidden="true"></i>
          اعرف المزيد
        </a>
        <a href="/saas-signup.html#step1" class="card-btn card-btn-secondary">
          <i class="fas fa-calendar-check" aria-hidden="true"></i>
          اطلب عرضاً تجريبياً
        </a>
      </div>
    `;
    return card;
  }

  function initProductCardObserver(root) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.08 });
    root.querySelectorAll('.product-card').forEach((card) => observer.observe(card));
    return observer;
  }

  function renderProductsCatalog(options) {
    const opts = options || {};
    const tabsRoot = document.getElementById(opts.tabsId || 'productsTabs');
    const sectionsRoot = document.getElementById(opts.sectionsId || 'productsSections');
    if (!sectionsRoot) return;

    if (tabsRoot) tabsRoot.innerHTML = '';
    sectionsRoot.innerHTML = '';

    catalog.forEach((cat, idx) => {
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
        <span class="product-section-count">${cat.products.length} منتج</span>
      `;
      section.appendChild(head);

      const grid = document.createElement('div');
      grid.className = 'product-grid';
      cat.products.forEach((item) => grid.appendChild(buildProductCard(item)));
      section.appendChild(grid);
      sectionsRoot.appendChild(section);
    });

    initProductCardObserver(sectionsRoot);

    if (tabsRoot) {
      const sectionEls = catalog.map((_, i) => document.getElementById(`ps-${i}`));
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
      const total = countProducts(catalog);
      const totalEl = document.querySelector('[data-products-stat="total"]');
      const sectorsEl = document.querySelector('[data-products-stat="sectors"]');
      if (totalEl) totalEl.textContent = `${total}+`;
      if (sectorsEl) sectorsEl.textContent = String(catalog.length);
    }
  }

  window.NAIOSH_PRODUCTS_CATALOG = catalog;
  window.renderProductsCatalog = renderProductsCatalog;
  window.getProductHref = getProductHref;
  window.countProducts = () => countProducts(catalog);
})();
