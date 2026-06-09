(function () {
  'use strict';

  const STORAGE_PREFIX = 'eoffices:data:';

  const PAGE_CONFIGS = {
    'eo-daily-operations': {
      title: 'العمليات اليومية',
      subtitle: 'متابعة وتنفيذ العمليات اليومية للمكتب الإلكتروني',
      icon: 'fa-calendar-day',
      gradient: 'from-red-800 to-red-600',
      api: '/api/employee-requests',
      stats: [
        { key: 'total', label: 'إجمالي العمليات', icon: 'fa-list-check', tone: 'text-red-700' },
        { key: 'active', label: 'قيد التنفيذ', icon: 'fa-spinner', tone: 'text-amber-600' },
        { key: 'done', label: 'مكتملة', icon: 'fa-circle-check', tone: 'text-emerald-600' },
        { key: 'urgent', label: 'عاجلة', icon: 'fa-bolt', tone: 'text-rose-600' }
      ],
      columns: ['العملية', 'المسؤول', 'الحالة', 'التاريخ'],
      seed: [
        ['متابعة طلبات اليوم', 'فريق العمليات', 'قيد التنفيذ', '2026-06-09'],
        ['تجهيز تقارير الصباح', 'منسق المكتب', 'مكتمل', '2026-06-09'],
        ['مراجعة مهام الفروع', 'مدير العمليات', 'مجدول', '2026-06-09']
      ]
    },
    'eo-sales': {
      title: 'المبيعات',
      subtitle: 'إدارة فرص البيع والعروض والصفقات',
      icon: 'fa-chart-line',
      gradient: 'from-red-800 to-rose-600',
      api: '/api/invoices',
      stats: [
        { key: 'total', label: 'الصفقات', icon: 'fa-handshake', tone: 'text-red-700' },
        { key: 'active', label: 'قيد المتابعة', icon: 'fa-hourglass-half', tone: 'text-amber-600' },
        { key: 'done', label: 'مغلقة', icon: 'fa-check', tone: 'text-emerald-600' },
        { key: 'urgent', label: 'عروض اليوم', icon: 'fa-file-invoice', tone: 'text-blue-600' }
      ],
      columns: ['العميل', 'القيمة', 'الحالة', 'التاريخ'],
      seed: [
        ['شركة المدار', '45,000 ر.س', 'تفاوض', '2026-06-08'],
        ['مؤسسة الحلول', '18,500 ر.س', 'عرض مرسل', '2026-06-07'],
        ['مجموعة الريادة', '92,000 ر.س', 'مغلقة', '2026-06-05']
      ]
    },
    'eo-subscriptions': {
      title: 'الاشتراكات',
      subtitle: 'إدارة خطط الاشتراك وتجديد العملاء',
      icon: 'fa-cubes',
      gradient: 'from-red-900 to-red-700',
      api: '/api/entities',
      stats: [
        { key: 'total', label: 'الاشتراكات', icon: 'fa-layer-group', tone: 'text-red-700' },
        { key: 'active', label: 'نشطة', icon: 'fa-circle-play', tone: 'text-emerald-600' },
        { key: 'done', label: 'منتهية', icon: 'fa-circle-pause', tone: 'text-slate-500' },
        { key: 'urgent', label: 'تنتهي قريباً', icon: 'fa-clock', tone: 'text-amber-600' }
      ],
      columns: ['العميل', 'الخطة', 'الحالة', 'التجديد'],
      seed: [
        ['NAIOSH HQ', 'Enterprise', 'نشط', '2026-12-01'],
        ['فرع الرياض', 'Pro', 'نشط', '2026-09-15'],
        ['مكتب جدة', 'Basic', 'تجريبي', '2026-07-01']
      ]
    },
    'eo-training': {
      title: 'التدريب',
      subtitle: 'الدورات والبرامج التدريبية للموظفين',
      icon: 'fa-chalkboard-teacher',
      gradient: 'from-red-800 to-orange-600',
      api: '/api/hr/learning-academy',
      stats: [
        { key: 'total', label: 'الدورات', icon: 'fa-book-open', tone: 'text-red-700' },
        { key: 'active', label: 'جارية', icon: 'fa-play', tone: 'text-blue-600' },
        { key: 'done', label: 'مكتملة', icon: 'fa-award', tone: 'text-emerald-600' },
        { key: 'urgent', label: 'تسجيل مفتوح', icon: 'fa-user-plus', tone: 'text-amber-600' }
      ],
      columns: ['الدورة', 'المدرب', 'المشاركون', 'الحالة'],
      seed: [
        ['سلامة مهنية', 'د. سامي', '24', 'جارية'],
        ['خدمة العملاء', 'أ. نورة', '18', 'مجدولة'],
        ['إدارة المكاتب', 'فريق نايوش', '12', 'مكتملة']
      ]
    },
    'eo-customer-service': {
      title: 'خدمة العملاء',
      subtitle: 'التذاكر والاستفسارات ورضا العملاء',
      icon: 'fa-headset',
      gradient: 'from-red-800 to-pink-600',
      api: '/api/employee-requests',
      stats: [
        { key: 'total', label: 'التذاكر', icon: 'fa-ticket', tone: 'text-red-700' },
        { key: 'active', label: 'مفتوحة', icon: 'fa-envelope-open', tone: 'text-amber-600' },
        { key: 'done', label: 'مغلقة', icon: 'fa-check-double', tone: 'text-emerald-600' },
        { key: 'urgent', label: 'عاجلة', icon: 'fa-fire', tone: 'text-rose-600' }
      ],
      columns: ['العميل', 'الموضوع', 'الأولوية', 'الحالة'],
      seed: [
        ['عميل 1042', 'تأخر تفعيل الحساب', 'عالية', 'قيد المعالجة'],
        ['عميل 2201', 'استفسار فاتورة', 'متوسطة', 'تم الرد'],
        ['عميل 3310', 'طلب تدريب', 'منخفضة', 'مغلقة']
      ]
    },
    'eo-operational-reports': {
      title: 'التقارير التشغيلية',
      subtitle: 'مؤشرات الأداء والتقارير الدورية',
      icon: 'fa-chart-pie',
      gradient: 'from-red-900 to-red-700',
      stats: [
        { key: 'total', label: 'التقارير', icon: 'fa-file-lines', tone: 'text-red-700' },
        { key: 'active', label: 'قيد الإعداد', icon: 'fa-pen', tone: 'text-amber-600' },
        { key: 'done', label: 'منشورة', icon: 'fa-share', tone: 'text-emerald-600' },
        { key: 'urgent', label: 'تنتظر اعتماد', icon: 'fa-stamp', tone: 'text-blue-600' }
      ],
      columns: ['التقرير', 'الفترة', 'المسؤول', 'الحالة'],
      seed: [
        ['تقرير العمليات الأسبوعي', 'الأسبوع 23', 'إدارة التشغيل', 'منشور'],
        ['مؤشرات المبيعات', 'يونيو 2026', 'المبيعات', 'قيد الإعداد'],
        ['تقرير الجودة', 'Q2 2026', 'الجودة', 'بانتظار الاعتماد']
      ]
    },
    'eo-local-hr': {
      title: 'الموارد البشرية المحلية',
      subtitle: 'شؤون الموظفين والحضور والطلبات',
      icon: 'fa-users',
      gradient: 'from-red-800 to-red-600',
      api: '/api/users',
      stats: [
        { key: 'total', label: 'الموظفون', icon: 'fa-user-group', tone: 'text-red-700' },
        { key: 'active', label: 'نشطون', icon: 'fa-user-check', tone: 'text-emerald-600' },
        { key: 'done', label: 'طلبات معتمدة', icon: 'fa-thumbs-up', tone: 'text-blue-600' },
        { key: 'urgent', label: 'طلبات معلقة', icon: 'fa-hourglass', tone: 'text-amber-600' }
      ],
      columns: ['الموظف', 'القسم', 'الدور', 'الحالة'],
      seed: [
        ['أحمد العلي', 'العمليات', 'مدير', 'نشط'],
        ['سارة القحطاني', 'المبيعات', 'تنفيذي', 'نشط'],
        ['محمد الشهري', 'الدعم', 'موظف', 'إجازة']
      ]
    },
    'eo-operational-finance': {
      title: 'المالية التشغيلية',
      subtitle: 'المصروفات والتحصيل والميزانية التشغيلية',
      icon: 'fa-coins',
      gradient: 'from-red-900 to-amber-700',
      api: '/api/invoices',
      stats: [
        { key: 'total', label: 'المعاملات', icon: 'fa-receipt', tone: 'text-red-700' },
        { key: 'active', label: 'قيد التحصيل', icon: 'fa-money-bill-wave', tone: 'text-amber-600' },
        { key: 'done', label: 'محصلة', icon: 'fa-circle-check', tone: 'text-emerald-600' },
        { key: 'urgent', label: 'متأخرة', icon: 'fa-triangle-exclamation', tone: 'text-rose-600' }
      ],
      columns: ['البند', 'المبلغ', 'الحالة', 'التاريخ'],
      seed: [
        ['اشتراك سنوي', '120,000 ر.س', 'محصل', '2026-06-01'],
        ['صيانة أنظمة', '8,400 ر.س', 'قيد الدفع', '2026-06-05'],
        ['تجهيز مكتب', '15,200 ر.س', 'معتمد', '2026-06-07']
      ]
    },
    'eo-files': {
      title: 'الملفات',
      subtitle: 'إدارة المستندات والمرفقات الرسمية',
      icon: 'fa-folder-open',
      gradient: 'from-red-800 to-red-600',
      stats: [
        { key: 'total', label: 'الملفات', icon: 'fa-file', tone: 'text-red-700' },
        { key: 'active', label: 'قيد المراجعة', icon: 'fa-eye', tone: 'text-amber-600' },
        { key: 'done', label: 'معتمدة', icon: 'fa-lock', tone: 'text-emerald-600' },
        { key: 'urgent', label: 'تنتهي صلاحيتها', icon: 'fa-calendar-xmark', tone: 'text-rose-600' }
      ],
      columns: ['الملف', 'النوع', 'المالك', 'آخر تحديث'],
      seed: [
        ['عقد مكتب الرياض', 'PDF', 'الإدارة القانونية', '2026-06-08'],
        ['سياسة الخصوصية', 'DOCX', 'الجودة', '2026-06-02'],
        ['دليل التشغيل', 'PDF', 'العمليات', '2026-05-28']
      ]
    },
    'eo-archive': {
      title: 'الأرشيف',
      subtitle: 'أرشفة السجلات والوثائق التاريخية',
      icon: 'fa-box-archive',
      gradient: 'from-red-900 to-slate-700',
      api: '/api/records/master-register',
      stats: [
        { key: 'total', label: 'السجلات', icon: 'fa-database', tone: 'text-red-700' },
        { key: 'active', label: 'مؤرشف حديثاً', icon: 'fa-clock-rotate-left', tone: 'text-blue-600' },
        { key: 'done', label: 'مؤمن', icon: 'fa-shield', tone: 'text-emerald-600' },
        { key: 'urgent', label: 'بحاجة فهرسة', icon: 'fa-tags', tone: 'text-amber-600' }
      ],
      columns: ['السجل', 'القسم', 'السنة', 'الحالة'],
      seed: [
        ['عقود 2025', 'القانونية', '2025', 'مؤمن'],
        ['تقارير Q1', 'التشغيل', '2026', 'مفهرس'],
        ['مراسلات خارجية', 'الإدارة', '2024', 'بانتظار الفهرسة']
      ]
    },
    'eo-tasks': {
      title: 'المهام',
      subtitle: 'توزيع ومتابعة مهام الفريق',
      icon: 'fa-list-check',
      gradient: 'from-red-800 to-red-600',
      api: '/api/employee-requests',
      stats: [
        { key: 'total', label: 'المهام', icon: 'fa-tasks', tone: 'text-red-700' },
        { key: 'active', label: 'جارية', icon: 'fa-spinner', tone: 'text-amber-600' },
        { key: 'done', label: 'منجزة', icon: 'fa-check', tone: 'text-emerald-600' },
        { key: 'urgent', label: 'متأخرة', icon: 'fa-calendar-times', tone: 'text-rose-600' }
      ],
      columns: ['المهمة', 'المكلف', 'الأولوية', 'الحالة'],
      seed: [
        ['تحديث بيانات العملاء', 'فريق CRM', 'عالية', 'جارية'],
        ['مراجعة عقود الموردين', 'المشتريات', 'متوسطة', 'مجدولة'],
        ['إغلاق تذكرة دعم', 'الدعم', 'عالية', 'منجزة']
      ]
    },
    'eo-meetings': {
      title: 'الاجتماعات',
      subtitle: 'جدولة الاجتماعات ومحاضر الحضور',
      icon: 'fa-video',
      gradient: 'from-red-800 to-indigo-600',
      stats: [
        { key: 'total', label: 'الاجتماعات', icon: 'fa-calendar', tone: 'text-red-700' },
        { key: 'active', label: 'اليوم', icon: 'fa-sun', tone: 'text-amber-600' },
        { key: 'done', label: 'منتهية', icon: 'fa-check', tone: 'text-emerald-600' },
        { key: 'urgent', label: 'تحتاج محضر', icon: 'fa-file-signature', tone: 'text-blue-600' }
      ],
      columns: ['الاجتماع', 'القائد', 'الوقت', 'الحالة'],
      seed: [
        ['اجتماع العمليات الصباحي', 'مدير المكتب', '09:00', 'مجدول'],
        ['مراجعة المبيعات', 'قائد المبيعات', '11:30', 'مجدول'],
        ['لجنة الجودة', 'ضمان الجودة', 'أمس', 'مكتمل']
      ]
    },
    'eo-consultations': {
      title: 'الاستشارات',
      subtitle: 'طلبات الاستشارة والمتابعة مع الخبراء',
      icon: 'fa-user-tie',
      gradient: 'from-red-900 to-red-700',
      stats: [
        { key: 'total', label: 'الاستشارات', icon: 'fa-comments', tone: 'text-red-700' },
        { key: 'active', label: 'قيد الدراسة', icon: 'fa-magnifying-glass', tone: 'text-amber-600' },
        { key: 'done', label: 'مغلقة', icon: 'fa-check-circle', tone: 'text-emerald-600' },
        { key: 'urgent', label: 'عاجلة', icon: 'fa-bolt', tone: 'text-rose-600' }
      ],
      columns: ['الموضوع', 'العميل', 'المستشار', 'الحالة'],
      seed: [
        ['تحسين العمليات', 'فرع الشرقية', 'خبير تشغيل', 'قيد الدراسة'],
        ['تقييم مالي', 'مكتب جدة', 'مستشار مالي', 'مجدولة'],
        ['خطة تدريب', 'حاضنة الرياض', 'خبير تدريب', 'مغلقة']
      ]
    },
    'eo-latest-news': {
      title: 'آخر الأخبار',
      subtitle: 'التعاميم والإعلانات الداخلية',
      icon: 'fa-newspaper',
      gradient: 'from-red-800 to-rose-600',
      api: '/api/operational-policies',
      stats: [
        { key: 'total', label: 'الأخبار', icon: 'fa-rss', tone: 'text-red-700' },
        { key: 'active', label: 'منشورة', icon: 'fa-bullhorn', tone: 'text-emerald-600' },
        { key: 'done', label: 'مؤرشفة', icon: 'fa-box', tone: 'text-slate-500' },
        { key: 'urgent', label: 'مهمة', icon: 'fa-star', tone: 'text-amber-600' }
      ],
      columns: ['العنوان', 'المصدر', 'التاريخ', 'الحالة'],
      seed: [
        ['تحديث سياسة العمل عن بُعد', 'الإدارة', '2026-06-08', 'منشور'],
        ['إطلاق بوابة المكاتب الإلكترونية', 'تقنية المعلومات', '2026-06-07', 'منشور'],
        ['ورشة سلامة مهنية', 'التدريب', '2026-06-03', 'مؤرشف']
      ]
    },
    'eo-users': {
      title: 'المستخدمين',
      subtitle: 'إدارة حسابات مستخدمي المكتب الإلكتروني',
      icon: 'fa-user-gear',
      gradient: 'from-red-900 to-red-700',
      api: '/api/users',
      stats: [
        { key: 'total', label: 'المستخدمون', icon: 'fa-users', tone: 'text-red-700' },
        { key: 'active', label: 'نشطون', icon: 'fa-user-check', tone: 'text-emerald-600' },
        { key: 'done', label: 'أدوار مخصصة', icon: 'fa-id-badge', tone: 'text-blue-600' },
        { key: 'urgent', label: 'بانتظار التفعيل', icon: 'fa-user-clock', tone: 'text-amber-600' }
      ],
      columns: ['الاسم', 'البريد', 'الدور', 'الحالة'],
      seed: [
        ['Super Admin', 'admin@naiosh.com', 'مسؤول', 'نشط'],
        ['مدير المكتب', 'office@naiosh.com', 'مدير', 'نشط'],
        ['موظف دعم', 'support@naiosh.com', 'موظف', 'نشط']
      ]
    }
  };

  function toast(message, type) {
    const container = document.getElementById('toast-container');
    if (!container) {
      window.alert(message);
      return;
    }
    const colors = {
      success: 'bg-emerald-600',
      error: 'bg-red-600',
      info: 'bg-slate-800'
    };
    const el = document.createElement('div');
    el.className = `${colors[type] || colors.info} text-white px-4 py-3 rounded-xl shadow-lg text-sm font-bold pointer-events-auto animate-fade-in`;
    el.textContent = message;
    container.appendChild(el);
    setTimeout(() => el.remove(), 3200);
  }

  function getEntityHeaders() {
    const user = JSON.parse(sessionStorage.getItem('user') || localStorage.getItem('user') || 'null');
    const headers = { Accept: 'application/json' };
    if (user?.entity_id || user?.entityId) {
      headers['x-entity-id'] = user.entity_id || user.entityId;
    }
    if (user?.tenant_type || user?.tenantType) {
      headers['x-entity-type'] = user.tenant_type || user.tenantType;
    }
    return headers;
  }

  function loadLocalRows(route) {
    try {
      const raw = localStorage.getItem(STORAGE_PREFIX + route);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : null;
    } catch (_) {
      return null;
    }
  }

  function saveLocalRows(route, rows) {
    localStorage.setItem(STORAGE_PREFIX + route, JSON.stringify(rows));
  }

  function mapApiRows(route, payload) {
    const list = Array.isArray(payload) ? payload : (payload?.data || payload?.rows || payload?.records || payload?.users || payload?.invoices || []);
    if (!Array.isArray(list) || !list.length) return null;

    if (route === 'eo-users' || route === 'eo-local-hr') {
      return list.slice(0, 12).map((item) => [
        item.name || item.full_name || item.username || '—',
        item.email || '—',
        item.role || item.job_title || '—',
        item.is_active === false ? 'موقوف' : 'نشط'
      ]);
    }
    if (route === 'eo-sales' || route === 'eo-operational-finance') {
      return list.slice(0, 12).map((item) => [
        item.customer_name || item.client_name || item.title || item.invoice_number || '—',
        item.total_amount || item.amount || item.total || '—',
        item.status || '—',
        (item.created_at || item.issue_date || '').toString().slice(0, 10) || '—'
      ]);
    }
    if (route === 'eo-subscriptions') {
      return list.slice(0, 12).map((item) => [
        item.name || item.company_name || item.entity_name || '—',
        item.plan || item.type || '—',
        item.status || 'نشط',
        (item.updated_at || '').toString().slice(0, 10) || '—'
      ]);
    }
    if (route === 'eo-customer-service' || route === 'eo-tasks' || route === 'eo-daily-operations') {
      return list.slice(0, 12).map((item) => [
        item.request_title || item.title || item.employee_name || '—',
        item.employee_name || item.request_type || '—',
        item.priority || item.status || '—',
        item.status || '—'
      ]);
    }
    if (route === 'eo-latest-news') {
      return list.slice(0, 12).map((item) => [
        item.title || item.name || '—',
        item.category || item.slug || '—',
        (item.updated_at || item.created_at || '').toString().slice(0, 10) || '—',
        item.status || 'منشور'
      ]);
    }
    if (route === 'eo-archive') {
      return list.slice(0, 12).map((item) => [
        item.title || item.record_title || item.name || '—',
        item.department || item.section || '—',
        item.year || '—',
        item.status || 'مؤرشف'
      ]);
    }
    return null;
  }

  function computeStats(rows) {
    const total = rows.length;
    const active = rows.filter((row) => /قيد|جار|مفتوح|نشط|مجدول|تفاوض/i.test(String(row[3] || row[2]))).length;
    const done = rows.filter((row) => /مكتمل|مغلق|منج|محصل|معتمد|منشور/i.test(String(row[3] || row[2]))).length;
    const urgent = Math.max(1, Math.round(total * 0.15));
    return { total, active, done, urgent };
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function getRows(route) {
    const config = PAGE_CONFIGS[route];
    if (!config) return [];
    return loadLocalRows(route) || config.seed.slice();
  }

  function renderRowActions(route, index) {
    return `
      <div class="flex flex-wrap items-center justify-end gap-1.5">
        <button type="button" data-eo-action="view" data-route="${route}" data-index="${index}"
          class="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold" title="عرض">
          <i class="fas fa-eye"></i>
        </button>
        <button type="button" data-eo-action="edit" data-route="${route}" data-index="${index}"
          class="px-2.5 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold" title="تعديل">
          <i class="fas fa-pen"></i>
        </button>
        <button type="button" data-eo-action="delete" data-route="${route}" data-index="${index}"
          class="px-2.5 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold" title="حذف">
          <i class="fas fa-trash"></i>
        </button>
      </div>
    `;
  }

  function renderTable(route, config, rows) {
    const body = rows.length
      ? rows.map((row, index) => `
      <tr class="border-b border-slate-100 hover:bg-red-50/40 transition" data-eo-row="${index}">
        ${row.map((cell) => `<td class="px-4 py-3 text-sm text-slate-700">${escapeHtml(cell)}</td>`).join('')}
        <td class="px-4 py-3">${renderRowActions(route, index)}</td>
      </tr>
    `).join('')
      : `<tr><td colspan="${config.columns.length + 1}" class="px-4 py-10 text-center text-slate-400 text-sm">لا توجد بيانات — استخدم زر الإضافة لإنشاء سجل جديد</td></tr>`;

    return `
      <div class="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden" data-eo-table="${route}">
        <div class="px-5 py-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
          <h3 class="font-bold text-slate-800">سجل ${config.title}</h3>
          <div class="flex flex-wrap gap-2">
            <button type="button" data-eo-action="refresh" data-route="${route}" class="px-3 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold">
              <i class="fas fa-rotate"></i> تحديث
            </button>
            <button type="button" data-eo-action="add" data-route="${route}" class="px-3 py-2 rounded-lg bg-red-700 hover:bg-red-800 text-white text-xs font-bold">
              <i class="fas fa-plus"></i> إضافة
            </button>
            <button type="button" data-eo-action="export" data-route="${route}" class="px-3 py-2 rounded-lg border border-red-200 text-red-700 hover:bg-red-50 text-xs font-bold">
              <i class="fas fa-download"></i> تصدير
            </button>
          </div>
        </div>
        <div class="overflow-x-auto">
          <table class="min-w-full text-right">
            <thead class="bg-slate-50 text-slate-500 text-xs uppercase">
              <tr>
                ${config.columns.map((col) => `<th class="px-4 py-3 font-bold">${col}</th>`).join('')}
                <th class="px-4 py-3 font-bold text-left">الإجراءات</th>
              </tr>
            </thead>
            <tbody>${body}</tbody>
          </table>
        </div>
      </div>
    `;
  }

  function renderPage(route) {
    const config = PAGE_CONFIGS[route];
    if (!config) {
      return '<div class="p-6 text-center text-slate-500">الصفحة غير موجودة</div>';
    }

    const rows = loadLocalRows(route) || config.seed;
    const stats = computeStats(rows);

    return `
      <div class="space-y-6" data-eo-page="${route}">
        <div class="bg-gradient-to-r ${config.gradient} rounded-2xl p-6 text-white shadow-lg">
          <h2 class="text-2xl md:text-3xl font-black flex items-center gap-3">
            <i class="fas ${config.icon}"></i>
            ${config.title}
          </h2>
          <p class="mt-2 text-white/90 text-sm md:text-base">${config.subtitle}</p>
        </div>

        <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
          ${config.stats.map((item) => `
            <div class="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
              <div class="flex items-center justify-between mb-2">
                <span class="text-slate-500 text-sm">${item.label}</span>
                <i class="fas ${item.icon} ${item.tone}"></i>
              </div>
              <p class="text-3xl font-black text-slate-800" data-eo-stat="${route}:${item.key}">${stats[item.key] || 0}</p>
            </div>
          `).join('')}
        </div>

        ${renderTable(route, config, rows)}
      </div>
    `;
  }

  async function fetchRows(route) {
    const config = PAGE_CONFIGS[route];
    if (!config?.api) return loadLocalRows(route) || config.seed;

    try {
      const response = await fetch(config.api, { headers: getEntityHeaders(), credentials: 'same-origin' });
      if (!response.ok) throw new Error('تعذر جلب البيانات');
      const payload = await response.json();
      const mapped = mapApiRows(route, payload);
      if (mapped?.length) {
        saveLocalRows(route, mapped);
        return mapped;
      }
    } catch (error) {
      console.warn('[EOffices] API fallback for', route, error.message);
    }
    return loadLocalRows(route) || config.seed;
  }

  function refreshStats(route, rows) {
    const stats = computeStats(rows);
    Object.keys(stats).forEach((key) => {
      const el = document.querySelector(`[data-eo-stat="${route}:${key}"]`);
      if (el) el.textContent = String(stats[key]);
    });
  }

  function refreshPage(route, rows) {
    const config = PAGE_CONFIGS[route];
    if (!config) return;
    const page = document.querySelector(`[data-eo-page="${route}"]`);
    if (!page) return;
    const table = page.querySelector(`[data-eo-table="${route}"]`);
    if (table) {
      const wrapper = document.createElement('div');
      wrapper.innerHTML = renderTable(route, config, rows);
      table.replaceWith(wrapper.firstElementChild);
    }
    refreshStats(route, rows);
  }

  function closeModal() {
    document.getElementById('eo-modal-overlay')?.remove();
  }

  function openRecordModal(route, mode, index) {
    const config = PAGE_CONFIGS[route];
    if (!config) return;

    const rows = getRows(route);
    const row = typeof index === 'number' ? rows[index] : null;
    const isView = mode === 'view';
    const titleMap = { add: 'إضافة سجل جديد', edit: 'تعديل السجل', view: 'عرض السجل' };

    closeModal();

    const fields = config.columns.map((col, colIndex) => {
      const value = row ? (row[colIndex] ?? '') : '';
      const inputAttrs = isView
        ? `readonly class="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-700"`
        : `class="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-red-500 focus:ring-2 focus:ring-red-100 outline-none"`;
      return `
        <label class="block">
          <span class="text-sm font-bold text-slate-600 mb-1.5 block">${escapeHtml(col)}</span>
          <input type="text" name="eo-field-${colIndex}" value="${escapeHtml(value)}" ${inputAttrs} />
        </label>
      `;
    }).join('');

    const overlay = document.createElement('div');
    overlay.id = 'eo-modal-overlay';
    overlay.className = 'fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm';
    overlay.innerHTML = `
      <div class="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" dir="rtl" role="dialog" aria-modal="true">
        <div class="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h3 class="text-lg font-black text-slate-800">${titleMap[mode] || 'السجل'}</h3>
          <button type="button" data-eo-modal-close class="w-9 h-9 rounded-lg hover:bg-slate-100 text-slate-500">
            <i class="fas fa-times"></i>
          </button>
        </div>
        <form id="eo-record-form" class="p-6 space-y-4">
          ${fields}
          <div class="flex flex-wrap gap-2 pt-2 ${isView ? 'hidden' : ''}">
            <button type="submit" class="flex-1 min-w-[120px] px-4 py-2.5 rounded-xl bg-red-700 hover:bg-red-800 text-white font-bold text-sm">
              <i class="fas fa-check ml-1"></i> ${mode === 'edit' ? 'حفظ التعديل' : 'إضافة'}
            </button>
            <button type="button" data-eo-modal-close class="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold text-sm hover:bg-slate-50">
              إلغاء
            </button>
          </div>
        </form>
      </div>
    `;

    document.body.appendChild(overlay);

    overlay.addEventListener('click', (event) => {
      if (event.target === overlay || event.target.closest('[data-eo-modal-close]')) {
        closeModal();
      }
    });

    if (isView) return;

    const form = overlay.querySelector('#eo-record-form');
    form?.addEventListener('submit', (event) => {
      event.preventDefault();
      const values = config.columns.map((_, colIndex) => {
        const input = form.querySelector(`[name="eo-field-${colIndex}"]`);
        return (input?.value || '').trim() || '—';
      });

      if (!values[0] || values[0] === '—') {
        toast('يرجى تعبئة الحقل الأول على الأقل', 'error');
        return;
      }

      const nextRows = getRows(route).slice();
      if (mode === 'edit' && typeof index === 'number') {
        nextRows[index] = values;
        toast('تم تحديث السجل بنجاح', 'success');
      } else {
        nextRows.unshift(values);
        toast('تمت إضافة السجل بنجاح', 'success');
      }

      saveLocalRows(route, nextRows);
      refreshPage(route, nextRows);
      closeModal();
    });
  }

  async function handleEoAction(action, route, index) {
    const config = PAGE_CONFIGS[route];
    if (!config) return;

    if (action === 'refresh') {
      const button = document.querySelector(`[data-eo-action="refresh"][data-route="${route}"]`);
      if (button) button.disabled = true;
      try {
        const rows = await fetchRows(route);
        saveLocalRows(route, rows);
        refreshPage(route, rows);
        toast('تم تحديث البيانات', 'success');
      } catch (_) {
        toast('تعذر تحديث البيانات', 'error');
      } finally {
        if (button) button.disabled = false;
      }
      return;
    }

    if (action === 'add') {
      openRecordModal(route, 'add');
      return;
    }

    if (action === 'export') {
      const rows = getRows(route);
      const csv = [config.columns.join(','), ...rows.map((row) => row.join(','))].join('\n');
      const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${route}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      toast('تم تجهيز ملف التصدير', 'success');
      return;
    }

    if (action === 'view') {
      const rows = getRows(route);
      if (!rows[index]) {
        toast('لا توجد بيانات لهذا السجل', 'error');
        return;
      }
      openRecordModal(route, 'view', index);
      return;
    }

    if (action === 'edit') {
      const rows = getRows(route);
      if (!rows[index]) {
        toast('لا توجد بيانات لهذا السجل', 'error');
        return;
      }
      openRecordModal(route, 'edit', index);
      return;
    }

    if (action === 'delete') {
      const rows = getRows(route);
      const row = rows[index];
      if (!row) {
        toast('لا توجد بيانات لهذا السجل', 'error');
        return;
      }
      const confirmed = window.confirm(`هل تريد حذف "${row[0]}"؟`);
      if (!confirmed) return;
      rows.splice(index, 1);
      saveLocalRows(route, rows);
      refreshPage(route, rows);
      toast('تم حذف السجل', 'success');
    }
  }

  let delegationReady = false;

  function ensureDelegation() {
    if (delegationReady) return;
    delegationReady = true;
    document.addEventListener('click', (event) => {
      const button = event.target.closest('[data-eo-action]');
      if (!button) return;
      event.preventDefault();
      event.stopPropagation();
      const action = button.dataset.eoAction;
      const route = button.dataset.route;
      if (!action || !route || !PAGE_CONFIGS[route]) return;
      const index = button.dataset.index !== undefined ? Number(button.dataset.index) : undefined;
      handleEoAction(action, route, index);
    });
  }

  window.EOfficesPages = {
    routes: Object.keys(PAGE_CONFIGS),
    render(route) {
      return renderPage(route);
    },
    async init(route) {
      const config = PAGE_CONFIGS[route];
      if (!config) return;
      ensureDelegation();
      const rows = await fetchRows(route);
      saveLocalRows(route, rows);
      refreshPage(route, rows);
    }
  };

  ensureDelegation();
})();
