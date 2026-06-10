window.SECTOR_PAGES = {
  'member-management': {
    icon: 'fa-users-gear',
    badge: 'إدارة الأعضاء',
    title: 'إدارة الأعضاء',
    subtitle: 'منظومة متكاملة لتسجيل الأعضاء، تصنيفهم، متابعة اشتراكاتهم، وقياس تفاعلهم داخل إمبراطورية نايوش — بلوحة تحكم ذكية وتقارير لحظية.',
    stats: [
      { value: '20,480', label: 'عضو نشط' },
      { value: '96%', label: 'نسبة التجديد' },
      { value: '38', label: 'فئة عضوية' },
      { value: '24/7', label: 'دعم الأعضاء' }
    ],
    tabs: [
      {
        id: 'programs',
        label: 'برامج العضوية',
        title: 'باقات وبرامج العضوية',
        desc: 'اختر البرنامج المناسب لفريقك أو مؤسستك وابدأ فورًا مع صلاحيات واضحة.',
        cards: [
          { icon: 'fa-crown', title: 'عضوية ذهبية', desc: 'وصول كامل للمنصات، حاضنات، واستشارات شهرية مع مدير حساب مخصص.', tags: ['مؤسسات', 'الكل'], href: '/subscription.html', cta: 'اشترك الآن' },
          { icon: 'fa-star', title: 'عضوية فضية', desc: 'دخول للمدونة، الفعاليات، وخصومات على خدمات الفروع والحاضنات.', tags: ['أفراد', 'الكل'], href: '/register.html', cta: 'انضم الآن' },
          { icon: 'fa-building', title: 'عضوية الشركات', desc: 'إدارة فرق متعددة، تقارير موحدة، وفوترة مؤسسية مرنة.', tags: ['مؤسسات'], href: '/newhome/companies.html', cta: 'تسجيل شركة' },
          { icon: 'fa-graduation-cap', title: 'عضوية الطلاب', desc: 'برامج تدريب، شهادات معتمدة، وفرص تدريب داخل الحاضنات.', tags: ['أفراد'], href: '/newhome/incubators.html', cta: 'استكشف البرامج' },
          { icon: 'fa-handshake', title: 'شركاء استراتيجيون', desc: 'شراكات طويلة المدى مع تقارير أداء مشتركة وقنوات دعم أولوية.', tags: ['مؤسسات'], href: '/contact-empire.html', cta: 'تواصل معنا' },
          { icon: 'fa-id-card', title: 'صفحة العضو العامة', desc: 'أنشئ صفحة شخصية لعرض إنجازاتك وخدماتك داخل المجتمع.', tags: ['أفراد', 'الكل'], href: '/create-page', cta: 'أنشئ صفحتك' }
        ]
      },
      {
        id: 'registry',
        label: 'سجل الأعضاء',
        title: 'سجل الأعضاء المباشر',
        desc: 'بيانات محدثة لحظيًا مع إمكانية البحث والتصفية.',
        table: {
          columns: ['العضو', 'الفئة', 'الحالة', 'تاريخ الانضمام', 'إجراء'],
          filters: ['الكل', 'مؤسسات', 'أفراد'],
          actionHref: '/members',
          rows: [
            ['مجموعة الأفق التجارية', 'مؤسسات', { type: 'status', value: 'active', label: 'نشط' }, '2024-03-12', 'عرض الملف'],
            ['مريم السعيد', 'أفراد', { type: 'status', value: 'active', label: 'نشط' }, '2025-01-08', 'عرض الملف'],
            ['شركة نماء الرقمية', 'مؤسسات', { type: 'status', value: 'pending', label: 'قيد المراجعة' }, '2026-05-20', 'عرض الملف'],
            ['خالد العتيبي', 'أفراد', { type: 'status', value: 'done', label: 'مكتمل' }, '2023-11-02', 'عرض الملف'],
            ['حاضنة الابتكار', 'مؤسسات', { type: 'status', value: 'active', label: 'نشط' }, '2025-09-15', 'عرض الملف']
          ]
        }
      },
      {
        id: 'faq',
        label: 'الأسئلة',
        title: 'أسئلة شائعة',
        faq: [
          { q: 'كيف أُسجّل عضوية جديدة؟', a: 'من خلال صفحة التسجيل أو باقات الاشتراك، ثم تفعيل الحساب عبر البريد الإلكتروني خلال دقائق.' },
          { q: 'هل يمكن ترقية فئة العضوية؟', a: 'نعم، يمكن الترقية في أي وقت مع احتساب الفارق بشكل عادل حسب مدة الاشتراك المتبقية.' },
          { q: 'ما الفرق بين العضوية الفردية والمؤسسية؟', a: 'المؤسسية تدعم فرقًا متعددة، فوترة موحدة، وتقارير إدارية متقدمة.' }
        ]
      }
    ],
    cta: {
      title: 'انضم إلى 20,000+ عضو',
      desc: 'سجّل اليوم واستفد من شبكة نايوش العالمية.',
      actions: [
        { label: 'إنشاء حساب', href: '/register.html', tone: 'primary' },
        { label: 'عرض الباقات', href: '/subscription.html', tone: 'ghost' }
      ]
    }
  },

  governance: {
    icon: 'fa-scale-balanced',
    badge: 'الحوكمة',
    title: 'الحوكمة المؤسسية',
    subtitle: 'إطار حوكمة شامل يضمن الشفافية، الامتثال، إدارة المخاطر، ومساءلة القرارات عبر جميع مستويات الإمبراطورية.',
    stats: [
      { value: '120+', label: 'سياسة معتمدة' },
      { value: '99.2%', label: 'امتثال تشغيلي' },
      { value: '45', label: 'لجنة حوكمة' },
      { value: 'ISO', label: 'معايير دولية' }
    ],
    tabs: [
      {
        id: 'framework',
        label: 'الإطار',
        title: 'ركائز الحوكمة',
        desc: 'نموذج حوكمة متعدد الطبقات يربط الاستراتيجية بالتنفيذ والرقابة.',
        cards: [
          { icon: 'fa-file-shield', title: 'السياسات واللوائح', desc: 'مكتبة سياسات محدثة تغطي المالية، الموارد البشرية، وأمن المعلومات.', tags: ['الكل'], href: '/operational-policies', cta: 'عرض السياسات' },
          { icon: 'fa-user-shield', title: 'إدارة المخاطر', desc: 'تحديد المخاطر، تقييمها، وخطط التخفيف مع مؤشرات إنذار مبكر.', tags: ['الكل'], href: '/strategic/dashboard', cta: 'لوحة المخاطر' },
          { icon: 'fa-clipboard-check', title: 'الامتثال والتدقيق', desc: 'تتبع الالتزام بالمعايير المحلية والدولية مع سجلات تدقيق كاملة.', tags: ['الكل'], href: '/audit-logs', cta: 'سجل التدقيق' },
          { icon: 'fa-people-group', title: 'لجان الحوكمة', desc: 'لجان متخصصة للمراجعة، الأخلاقيات، والاستدامة تعقد اجتماعات دورية.', tags: ['الكل'], href: '/contact-empire.html', cta: 'طلب انضمام' },
          { icon: 'fa-chart-pie', title: 'تقارير الشفافية', desc: 'تقارير ربع سنوية عن الأداء والامتثال متاحة للأعضاء المؤسسيين.', tags: ['مؤسسات'], href: '/studies.html', cta: 'قراءة التقارير' },
          { icon: 'fa-gavel', title: 'لجنة الأخلاقيات', desc: 'قنوات بلاغ آمنة وإجراءات تحقيق واضحة لحماية المجتمع.', tags: ['الكل'], href: '/contact-empire.html', cta: 'تقديم بلاغ' }
        ]
      },
      {
        id: 'timeline',
        label: 'المسار',
        title: 'محطات الحوكمة',
        timeline: [
          { date: 'Q1 2026', title: 'تحديث سياسات حماية البيانات', desc: 'اعتماد إطار متوافق مع أفضل الممارسات الدولية لحماية بيانات الأعضاء.' },
          { date: 'Q2 2026', title: 'تدقيق الامتثال الشامل', desc: 'مراجعة خارجية لجميع عمليات الفروع والحاضنات.' },
          { date: 'Q3 2026', title: 'منصة الحوكمة الذكية', desc: 'إطلاق لوحة متابعة لحظية لمؤشرات الامتثال والمخاطر.' }
        ]
      },
      {
        id: 'faq',
        label: 'الأسئلة',
        faq: [
          { q: 'من يشرف على تطبيق الحوكمة؟', a: 'لجنة الحوكمة العليا بالتنسيق مع إدارة الامتثال والتدقيق الداخلي.' },
          { q: 'كيف أطلب مراجعة سياسة؟', a: 'عبر نموذج التواصل مع الإمبراطورة مع تحديد السياسة المطلوبة.' }
        ]
      }
    ],
    cta: {
      title: 'ابنِ مؤسسة شفافة وموثوقة',
      actions: [
        { label: 'استشارة حوكمة', href: '/consultations.html', tone: 'primary' },
        { label: 'تحميل الدليل', href: '/studies.html', tone: 'ghost' }
      ]
    }
  },

  automation: {
    icon: 'fa-robot',
    badge: 'الأتمتة',
    title: 'الأتمتة الذكية',
    subtitle: 'أتمتة العمليات التشغيلية، سير العمل، والتقارير — لتقليل الجهد اليدوي وتسريع الإنجاز بجودة أعلى.',
    stats: [
      { value: '340+', label: 'سير عمل آلي' },
      { value: '67%', label: 'توفير وقت' },
      { value: '0.3%', label: 'معدل خطأ' },
      { value: 'AI', label: 'ذكاء مدمج' }
    ],
    tabs: [
      {
        id: 'solutions',
        label: 'الحلول',
        title: 'حلول الأتمتة',
        cards: [
          { icon: 'fa-gears', title: 'أتمتة الموارد البشرية', desc: 'طلبات الإجازات، الحضور، والرواتب بسير عمل ذكي.', tags: ['الكل'], href: '/hr', cta: 'فتح النظام' },
          { icon: 'fa-file-invoice', title: 'أتمتة الفواتير', desc: 'إصدار الفواتير، التحصيل، والتذكيرات الآلية.', tags: ['مؤسسات'], href: '/finance', cta: 'فتح المالية' },
          { icon: 'fa-bell', title: 'تنبيهات ذكية', desc: 'إشعارات مخصصة عند تجاوز المؤشرات أو تأخر المهام.', tags: ['الكل'], href: '/tasks', cta: 'إدارة المهام' },
          { icon: 'fa-envelope-open-text', title: 'مراسلات آلية', desc: 'قوالب بريد ورسائل واتساب مربوطة بأحداث النظام.', tags: ['الكل'], href: '/settings', cta: 'الإعدادات' },
          { icon: 'fa-database', title: 'تكامل البيانات', desc: 'ربط الأنظمة الداخلية والخارجية بدون تدخل يدوي.', tags: ['مؤسسات'], href: '/newhome/systems.html', cta: 'عرض الأنظمة' },
          { icon: 'fa-wand-magic-sparkles', title: 'مساعد ذكي', desc: 'اقتراحات تشغيلية وتحليلات تنبؤية لدعم القرار.', tags: ['الكل'], href: '/home', cta: 'لوحة التحكم' }
        ]
      },
      {
        id: 'workflows',
        label: 'سير العمل',
        table: {
          columns: ['العملية', 'القسم', 'التوفير', 'الحالة', 'إجراء'],
          filters: ['الكل'],
          actionHref: '/tasks',
          rows: [
            ['اعتماد طلبات الإجازة', 'الموارد البشرية', '72%', { type: 'status', value: 'active', label: 'نشط' }, 'إدارة'],
            ['تسوية الفواتير الشهرية', 'المالية', '58%', { type: 'status', value: 'active', label: 'نشط' }, 'إدارة'],
            ['تذكير تجديد الاشتراك', 'المبيعات', '81%', { type: 'status', value: 'active', label: 'نشط' }, 'إدارة'],
            ['أرشفة العقود', 'القانونية', '64%', { type: 'status', value: 'pending', label: 'قيد الإعداد' }, 'إدارة']
          ]
        }
      },
      {
        id: 'faq',
        label: 'الأسئلة',
        faq: [
          { q: 'هل يمكن تخصيص سير العمل؟', a: 'نعم، كل عميل يمكنه بناء مسارات خاصة بصلاحيات محددة دون برمجة.' },
          { q: 'ما المدة المتوقعة للتفعيل؟', a: 'من 3 إلى 14 يومًا حسب تعقيد العمليات.' }
        ]
      }
    ],
    cta: {
      title: 'أتمت عملياتك اليوم',
      actions: [
        { label: 'استأجر نظام', href: '/saas-signup.html#step1', tone: 'primary' },
        { label: 'استشارة مجانية', href: '/free-consultation.html', tone: 'ghost' }
      ]
    }
  },

  sustainability: {
    icon: 'fa-leaf',
    badge: 'الاستدامة',
    title: 'الاستدامة والمسؤولية',
    subtitle: 'برامج استدامة بيئية واجتماعية وحوكمة ESG متكاملة — لبناء أثر طويل المدى يوازن بين النمو والمسؤولية.',
    stats: [
      { value: '42%', label: 'خفض انبعاثات' },
      { value: '18', label: 'مبادرة خضراء' },
      { value: '12K', label: 'ساعة تطوع' },
      { value: 'ESG', label: 'تقارير سنوية' }
    ],
    tabs: [
      {
        id: 'initiatives',
        label: 'المبادرات',
        cards: [
          { icon: 'fa-solar-panel', title: 'طاقة نظيفة', desc: 'تحول تدريجي للفروع نحو مصادر طاقة مستدامة.', tags: ['الكل'], href: '/newhome/branches.html', cta: 'فروعنا' },
          { icon: 'fa-recycle', title: 'إدارة النفايات', desc: 'برامج إعادة تدوير وتقليل البصمة الكربونية.', tags: ['الكل'], href: '/newhome/initiatives.html', cta: 'المبادرات' },
          { icon: 'fa-hand-holding-heart', title: 'المسؤولية المجتمعية', desc: 'شراكات مع جمعيات محلية لدعم التعليم والصحة.', tags: ['الكل'], href: '/newhome/incubators.html', cta: 'البرامج' },
          { icon: 'fa-seedling', title: 'حاضنات خضراء', desc: 'دعم المشاريع الصديقة للبيئة داخل الحاضنات.', tags: ['مؤسسات'], href: '/incubators-hub', cta: 'الحاضنات' },
          { icon: 'fa-chart-line', title: 'تقارير ESG', desc: 'مؤشرات بيئية واجتماعية وحوكمة شفافة.', tags: ['مؤسسات'], href: '/studies.html', cta: 'التقارير' },
          { icon: 'fa-tree', title: 'زراعة مجتمعية', desc: 'حملات تشجير سنوية بمشاركة الأعضاء والفروع.', tags: ['أفراد'], href: '/register.html', cta: 'شارك معنا' }
        ]
      },
      {
        id: 'metrics',
        label: 'المؤشرات',
        table: {
          columns: ['المؤشر', 'الهدف 2026', 'الإنجاز', 'الحالة', 'تفاصيل'],
          filters: ['الكل'],
          actionHref: '/studies.html',
          rows: [
            ['خفض استهلاك الورق', '50%', '42%', { type: 'status', value: 'active', label: 'جاري' }, 'عرض'],
            ['تدريب الاستدامة', '5,000 عضو', '4,200', { type: 'status', value: 'active', label: 'جاري' }, 'عرض'],
            ['طاقة متجددة', '6 فروع', '4 فروع', { type: 'status', value: 'pending', label: 'مخطط' }, 'عرض']
          ]
        }
      },
      {
        id: 'faq',
        label: 'الأسئلة',
        faq: [
          { q: 'كيف نقيس الأثر البيئي؟', a: 'عبر مؤشرات ESG معتمدة وتقارير ربع سنوية لكل فرع.' },
          { q: 'هل يمكن للشركات المشاركة؟', a: 'نعم، عبر برامج الشراكة المجتمعية والحاضنات الخضراء.' }
        ]
      }
    ],
    cta: {
      title: 'كن شريكًا في الاستدامة',
      actions: [
        { label: 'انضم للمبادرة', href: '/newhome/initiatives.html', tone: 'primary' },
        { label: 'تواصل معنا', href: '/contact-empire.html', tone: 'ghost' }
      ]
    }
  },

  legal: {
    icon: 'fa-gavel',
    badge: 'القانونية والمحاماة',
    title: 'القانونية والمحاماة',
    subtitle: 'خدمات قانونية متخصصة للشركات والأفراد — عقود، امتثال، ملكية فكرية، وتمثيل قانوني بفريق محامين معتمدين.',
    stats: [
      { value: '850+', label: 'عقد سنويًا' },
      { value: '120', label: 'محامٍ شريك' },
      { value: '98%', label: 'نسبة نجاح' },
      { value: '24h', label: 'استجابة عاجلة' }
    ],
    tabs: [
      {
        id: 'services',
        label: 'الخدمات',
        cards: [
          { icon: 'fa-file-contract', title: 'صياغة العقود', desc: 'عقود تجارية، عمل، وشراكات بصياغة قانونية محكمة.', tags: ['مؤسسات'], href: '/consultations.html', cta: 'طلب صياغة' },
          { icon: 'fa-scale-balanced', title: 'التمثيل القضائي', desc: 'تمثيل أمام الجهات القضائية واللجان التحكيمية.', tags: ['الكل'], href: '/contact-empire.html', cta: 'حجز موعد' },
          { icon: 'fa-trademark', title: 'الملكية الفكرية', desc: 'تسجيل العلامات، براءات الاختراع، وحقوق النشر.', tags: ['مؤسسات'], href: '/studies.html', cta: 'استشارة' },
          { icon: 'fa-building-shield', title: 'امتثال الشركات', desc: 'مراجعة اللوائح والامتثال للأنظمة المحلية.', tags: ['مؤسسات'], href: '/operational-policies', cta: 'السياسات' },
          { icon: 'fa-user-tie', title: 'استشارات فردية', desc: 'جلسات قانونية للأفراد في القضايا المدنية والتجارية.', tags: ['أفراد'], href: '/free-consultation.html', cta: 'استشارة مجانية' },
          { icon: 'fa-folder-open', title: 'أرشيف قانوني', desc: 'حفظ وثائق قانونية مشفرة مع صلاحيات وصول دقيقة.', tags: ['الكل'], href: '/archive', cta: 'الأرشيف' }
        ]
      },
      {
        id: 'cases',
        label: 'الملفات',
        table: {
          columns: ['الملف', 'النوع', 'المحامي', 'الحالة', 'إجراء'],
          filters: ['الكل', 'مؤسسات', 'أفراد'],
          actionHref: '/consultations.html',
          rows: [
            ['عقد شراكة استراتيجية', 'عقود', 'د. سارة الحربي', { type: 'status', value: 'active', label: 'قيد المراجعة' }, 'متابعة'],
            ['تسجيل علامة تجارية', 'ملكية فكرية', 'م. أحمد الشمري', { type: 'status', value: 'done', label: 'مكتمل' }, 'متابعة'],
            ['نزاع تجاري', 'تقاضي', 'د. فهد القحطاني', { type: 'status', value: 'pending', label: 'مجدول' }, 'متابعة']
          ]
        }
      },
      {
        id: 'faq',
        label: 'الأسئلة',
        faq: [
          { q: 'ما مدة صياغة العقد؟', a: 'من 48 ساعة للعقود القياسية إلى 10 أيام للعقود المعقدة.' },
          { q: 'هل الخدمة متاحة للأفراد؟', a: 'نعم، عبر استشارات فردية وخطط عضوية قانونية.' }
        ]
      }
    ],
    cta: {
      title: 'احمِ أعمالك قانونيًا',
      actions: [
        { label: 'استشارة قانونية', href: '/consultations.html', tone: 'primary' },
        { label: 'اتصل بالإمبراطورة', href: '/contact-empire.html', tone: 'ghost' }
      ]
    }
  },

  'skills-innovation': {
    icon: 'fa-lightbulb',
    badge: 'المهارات والابتكارات',
    title: 'المهارات والابتكارات',
    subtitle: 'مسارات تعلم عملية، مختبرات ابتكار، وشهادات معتمدة — لبناء جيل قادر على قيادة التحول الرقمي.',
    stats: [
      { value: '240+', label: 'مسار تدريبي' },
      { value: '18K', label: 'متعلم نشط' },
      { value: '65', label: 'مختبر ابتكار' },
      { value: '92%', label: 'معدل إكمال' }
    ],
    tabs: [
      {
        id: 'paths',
        label: 'المسارات',
        cards: [
          { icon: 'fa-code', title: 'تطوير البرمجيات', desc: 'مسارات من المبتدئ إلى المحترف في التطوير الشامل.', tags: ['الكل'], href: '/newhome/beta-club.html', cta: 'نادي بيتا' },
          { icon: 'fa-bullhorn', title: 'التسويق الرقمي', desc: 'استراتيجيات المحتوى، الإعلانات، وتحليلات النمو.', tags: ['الكل'], href: '/newhome/incubators.html', cta: 'حاضنات التسويق' },
          { icon: 'fa-chart-simple', title: 'تحليل البيانات', desc: 'أدوات BI، ذكاء اصطناعي، وتقارير تفاعلية.', tags: ['مؤسسات'], href: '/newhome/systems.html', cta: 'الأنظمة' },
          { icon: 'fa-palette', title: 'التصميم والUX', desc: 'تصميم واجهات وتجربة مستخدم بمعايير عالمية.', tags: ['أفراد'], href: '/create-page', cta: 'ابدأ مشروعك' },
          { icon: 'fa-rocket', title: 'ريادة الأعمال', desc: 'من الفكرة إلى الإطلاق مع حاضنات ومسرعات.', tags: ['الكل'], href: '/incubators-hub', cta: 'الحاضنات' },
          { icon: 'fa-certificate', title: 'شهادات معتمدة', desc: 'شهادات محلية ودولية معتمدة من شركاء نايوش.', tags: ['الكل'], href: '/subscription.html', cta: 'الباقات' }
        ]
      },
      {
        id: 'labs',
        label: 'المختبرات',
        timeline: [
          { date: 'مارس 2026', title: 'مختبر الذكاء الاصطناعي', desc: 'تجارب عملية على نماذج لغوية وأتمتة المهام.' },
          { date: 'مايو 2026', title: 'مختبر التسويق الرقمي', desc: 'حملات حقيقية على منصات التواصل مع قياس الأداء.' },
          { date: 'يوليو 2026', title: 'هاكاثون الابتكار', desc: 'مسابقة وطنية بجوائز تمويلية للفرق الفائزة.' }
        ]
      },
      {
        id: 'faq',
        label: 'الأسئلة',
        faq: [
          { q: 'هل التدريب عن بُعد؟', a: 'نعم، مع جلسات مباشرة ومشاريع عملية ومراجعة من خبراء.' },
          { q: 'ما مدة المسار؟', a: 'من 4 أسابيع للمسارات المكثفة إلى 6 أشهر للمسارات المتقدمة.' }
        ]
      }
    ],
    cta: {
      title: 'طوّر مهاراتك وابتكر',
      actions: [
        { label: 'انضم للتدريب', href: '/register.html', tone: 'primary' },
        { label: 'نادي بيتا', href: '/newhome/beta-club.html', tone: 'ghost' }
      ]
    }
  },

  initiatives: {
    icon: 'fa-flag',
    badge: 'المبادرات',
    title: 'المبادرات المجتمعية',
    subtitle: 'مبادرات وطنية وإقليمية في التعليم، الصحة، ريادة الأعمال، والتقنية — بشراكات فاعلة وأثر قابل للقياس.',
    stats: [
      { value: '56', label: 'مبادرة نشطة' },
      { value: '14', label: 'دولة' },
      { value: '320K', label: 'مستفيد' },
      { value: '85%', label: 'إكمال المشاريع' }
    ],
    tabs: [
      {
        id: 'active',
        label: 'النشطة',
        cards: [
          { icon: 'fa-book-open', title: 'تعليم للجميع', desc: 'منح تعليمية وتدريب مجاني للشباب في المناطق النائية.', tags: ['الكل'], href: '/newhome/incubators.html', cta: 'التفاصيل' },
          { icon: 'fa-heart-pulse', title: 'صحة المجتمع', desc: 'فحوصات مجانية وبرامج توعية صحية.', tags: ['الكل'], href: '/contact-empire.html', cta: 'شارك' },
          { icon: 'fa-laptop', title: 'رقمنة الأعمال', desc: 'دعم المشاريع الصغيرة للتحول الرقمي.', tags: ['مؤسسات'], href: '/saas-signup.html#step1', cta: 'قدّم طلبك' },
          { icon: 'fa-venus', title: 'تمكين المرأة', desc: 'برامج قيادة وريادة مخصصة للمرأة.', tags: ['أفراد'], href: '/register.html', cta: 'انضمي' },
          { icon: 'fa-handshake', title: 'شراكات محلية', desc: 'تعاون مع الجمعيات والبلديات لخدمة المجتمع.', tags: ['مؤسسات'], href: '/newhome/branches.html', cta: 'الفروع' },
          { icon: 'fa-globe', title: 'مبادرات دولية', desc: 'برامج تبادل وخبرات عبر فروع نايوش العالمية.', tags: ['الكل'], href: '/newhome/branches.html', cta: 'خريطة الفروع' }
        ]
      },
      {
        id: 'impact',
        label: 'الأثر',
        table: {
          columns: ['المبادرة', 'المنطقة', 'المستفيدون', 'التقدم', 'رابط'],
          filters: ['الكل'],
          actionHref: '/contact-empire.html',
          rows: [
            ['تعليم للجميع', 'الرياض', '45,000', { type: 'status', value: 'active', label: '78%' }, 'تفاصيل'],
            ['رقمنة الأعمال', 'جدة', '12,500', { type: 'status', value: 'active', label: '65%' }, 'تفاصيل'],
            ['صحة المجتمع', 'الدمام', '8,200', { type: 'status', value: 'done', label: '100%' }, 'تفاصيل']
          ]
        }
      },
      {
        id: 'faq',
        label: 'الأسئلة',
        faq: [
          { q: 'كيف أقترح مبادرة؟', a: 'عبر نموذج التواصل مع فريق المبادرات في الإمبراطورة.' },
          { q: 'هل التمويل متاح؟', a: 'مبادرات مختارة تحصل على دعم مالي وتقني من نايوش وشركائها.' }
        ]
      }
    ],
    cta: {
      title: 'أطلق مبادرتك معنا',
      actions: [
        { label: 'قدّم مبادرة', href: '/contact-empire.html', tone: 'primary' },
        { label: 'استكشف الحاضنات', href: '/newhome/incubators.html', tone: 'ghost' }
      ]
    }
  },

  'beta-club': {
    icon: 'fa-flask',
    badge: 'نادي بيتا الرقمي',
    title: 'نادي بيتا الرقمي',
    subtitle: 'مجتمع تقني حصري لتجربة المنتجات الجديدة، بناء الحلول، والوصول المبكر للميزات — حيث يلتقي المبتكرون بالفرص.',
    stats: [
      { value: '3,200', label: 'عضو بيتا' },
      { value: '48', label: 'منتج تجريبي' },
      { value: '120+', label: 'فعالية سنوية' },
      { value: 'VIP', label: 'وصول مبكر' }
    ],
    tabs: [
      {
        id: 'club',
        label: 'النادي',
        cards: [
          { icon: 'fa-rocket', title: 'وصول مبكر', desc: 'جرّب الميزات الجديدة قبل الإطلاق العام وأرسل ملاحظاتك.', tags: ['الكل'], href: '/register.html', cta: 'انضم للنادي' },
          { icon: 'fa-code-branch', title: 'مشاريع مفتوحة', desc: 'تعاون على مشاريع مفتوحة المصدر مع فريق نايوش.', tags: ['الكل'], href: '/newhome/skills-innovation.html', cta: 'المهارات' },
          { icon: 'fa-trophy', title: 'تحديات بيتا', desc: 'مسابقات شهرية بجوائز تقنية وفرص استثمار.', tags: ['أفراد'], href: '/newhome/ads.html', cta: 'الإعلانات' },
          { icon: 'fa-chalkboard-user', title: 'ورش عمل', desc: 'جلسات تقنية مباشرة مع خبراء المنتج والهندسة.', tags: ['الكل'], href: '/newhome/blog.html', cta: 'المدونة' },
          { icon: 'fa-comments', title: 'مجتمع Discord', desc: 'قناة حصرية للنقاش والدعم بين أعضاء النادي.', tags: ['الكل'], href: '/contact-empire.html', cta: 'طلب دعوة' },
          { icon: 'fa-gift', title: 'مزايا حصرية', desc: 'خصومات على الاشتراكات وأولوية في الفعاليات.', tags: ['الكل'], href: '/subscription.html', cta: 'الباقات' }
        ]
      },
      {
        id: 'events',
        label: 'الفعاليات',
        timeline: [
          { date: '15 يونيو', title: 'لقاء بيتا الشهري', desc: 'عرض خارطة الطريق واستقبال اقتراحات الأعضاء مباشرة.' },
          { date: '2 يوليو', title: 'هاكاثون 48 ساعة', desc: 'بناء نماذج أولية على منتجات نايوش التجريبية.' },
          { date: '20 أغسطس', title: 'يوم المطورين', desc: 'ورش APIs، تكاملات، وأفضل الممارسات.' }
        ]
      },
      {
        id: 'faq',
        label: 'الأسئلة',
        faq: [
          { q: 'من يمكنه الانضمام؟', a: 'المطورون، مصممو المنتجات، رواد الأعمال، وكل من لديه شغف بالتقنية.' },
          { q: 'هل العضوية مجانية؟', a: 'العضوية الأساسية مجانية، مع باقة VIP بمزايا إضافية.' }
        ]
      }
    ],
    cta: {
      title: 'كن أول من يجرّب الجديد',
      actions: [
        { label: 'انضم لنادي بيتا', href: '/register.html', tone: 'primary' },
        { label: 'تواصل مع الفريق', href: '/contact-empire.html', tone: 'ghost' }
      ]
    }
  }
};
