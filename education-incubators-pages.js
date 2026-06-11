(function () {
  'use strict';

  const STORAGE_PREFIX = 'eti:data:';

  const HUB_CARDS = [
    {
      route: 'eti-ohs',
      title: 'حاضنة السلامة والصحة المهنية',
      desc: 'برامج تأهيلية وشهادات معتمدة في السلامة المهنية وإدارة المخاطر والامتثال',
      icon: 'fa-hard-hat',
      gradient: 'from-orange-700 via-red-700 to-rose-800',
      stats: { programs: 24, trainees: '1,840', certs: 156, rate: '96%' }
    },
    {
      route: 'eti-supply-chain',
      title: 'حاضنة سلاسل الإمداد',
      desc: 'تدريب متخصص في المشتريات والمخزون والتوريد الذكي وإدارة الموردين',
      icon: 'fa-truck-loading',
      gradient: 'from-blue-800 via-indigo-700 to-violet-800',
      stats: { programs: 18, trainees: '1,220', certs: 98, rate: '93%' }
    },
    {
      route: 'eti-facilities',
      title: 'حضانة إدارة المرافق',
      desc: 'مسارات تدريبية في إدارة المباني والأصول والصيانة والطاقة',
      icon: 'fa-building',
      gradient: 'from-emerald-800 via-teal-700 to-cyan-800',
      stats: { programs: 16, trainees: '980', certs: 74, rate: '91%' }
    },
    {
      route: 'eti-logistics',
      title: 'حاضنة اللوجستيات والنقل والتوصيل',
      desc: 'تأهيل احترافي في سلاسل النقل والتوزيع وتتبع الشحنات',
      icon: 'fa-shipping-fast',
      gradient: 'from-amber-700 via-orange-700 to-red-800',
      stats: { programs: 14, trainees: '860', certs: 62, rate: '94%' }
    },
    {
      route: 'eti-project-management',
      title: 'حاضنة إدارة المشاريع',
      desc: 'دورات PMP وAgile وإدارة المشاريع التشغيلية والاستراتيجية',
      icon: 'fa-project-diagram',
      gradient: 'from-purple-800 via-fuchsia-700 to-pink-800',
      stats: { programs: 22, trainees: '1,450', certs: 118, rate: '97%' }
    },
    {
      route: 'eti-hr',
      title: 'حاضنة HR الموارد البشرية',
      desc: 'تطوير الكفاءات في التوظيف والتدريب والأداء والامتثال الوظيفي',
      icon: 'fa-users-gear',
      gradient: 'from-red-900 via-rose-800 to-red-700',
      stats: { programs: 20, trainees: '1,680', certs: 142, rate: '95%' }
    }
  ];

  const PAGE_CONFIGS = {
    'eti-ohs': {
      title: 'حاضنة السلامة والصحة المهنية',
      subtitle: 'منصة تدريبية متكاملة لتأهيل الكوادر في السلامة المهنية والصحة المهنية وفق المعايير الدولية',
      icon: 'fa-hard-hat',
      gradient: 'from-orange-700 via-red-700 to-rose-800',
      stats: [
        { key: 'total', label: 'البرامج', icon: 'fa-book-open', tone: 'text-orange-600' },
        { key: 'active', label: 'متدربون نشطون', icon: 'fa-user-graduate', tone: 'text-emerald-600' },
        { key: 'done', label: 'شهادات صادرة', icon: 'fa-certificate', tone: 'text-blue-600' },
        { key: 'urgent', label: 'دورات مفتوحة', icon: 'fa-door-open', tone: 'text-amber-600' }
      ],
      columns: ['البرنامج', 'المستوى', 'المتدربون', 'الحالة'],
      seed: [
        ['NEBOSH IGC', 'متقدم', '48', 'جاري'],
        ['OSHA 30 ساعة', 'متوسط', '62', 'جاري'],
        ['إدارة المخاطر المهنية', 'متقدم', '35', 'مجدول'],
        ['السلامة في مواقع البناء', 'أساسي', '80', 'مكتمل'],
        ['الاستجابة للطوارئ', 'متوسط', '42', 'جاري'],
        ['ISO 45001 Lead Auditor', 'خبير', '18', 'تسجيل مفتوح']
      ],
      highlights: [
        { label: 'معدل النجاح', value: '96.4%', icon: 'fa-chart-line' },
        { label: 'ساعات تدريب', value: '12,400', icon: 'fa-clock' },
        { label: 'مدربون معتمدون', value: '28', icon: 'fa-chalkboard-teacher' },
        { label: 'شركاء اعتماد', value: '14', icon: 'fa-handshake' }
      ]
    },
    'eti-supply-chain': {
      title: 'حاضنة سلاسل الإمداد',
      subtitle: 'تأهيل متخصص في إدارة سلاسل التوريد والمشتريات الذكية والمخزون الاستراتيجي',
      icon: 'fa-truck-loading',
      gradient: 'from-blue-800 via-indigo-700 to-violet-800',
      stats: [
        { key: 'total', label: 'المسارات', icon: 'fa-route', tone: 'text-blue-600' },
        { key: 'active', label: 'متدربون', icon: 'fa-users', tone: 'text-emerald-600' },
        { key: 'done', label: 'مشاريع تطبيقية', icon: 'fa-briefcase', tone: 'text-purple-600' },
        { key: 'urgent', label: 'ورش عمل', icon: 'fa-wrench', tone: 'text-amber-600' }
      ],
      columns: ['المسار', 'التخصص', 'المشاركون', 'الحالة'],
      seed: [
        ['إدارة المشتريات الاستراتيجية', 'مشتريات', '56', 'جاري'],
        ['المخزون الذكي', 'مخزون', '44', 'جاري'],
        ['تحليل سلاسل الإمداد', 'تحليل', '32', 'مجدول'],
        ['التفاوض مع الموردين', 'موردين', '38', 'مكتمل'],
        ['SCM Analytics', 'بيانات', '28', 'جاري'],
        ['التوريد المستدام', 'استدامة', '22', 'تسجيل مفتوح']
      ],
      highlights: [
        { label: 'توفير تكاليف', value: '18.5%', icon: 'fa-piggy-bank' },
        { label: 'موردون معتمدون', value: '340', icon: 'fa-truck' },
        { label: 'مشاريع ميدانية', value: '45', icon: 'fa-map-marked-alt' },
        { label: 'شهادات CSCP', value: '62', icon: 'fa-award' }
      ]
    },
    'eti-facilities': {
      title: 'حضانة إدارة المرافق',
      subtitle: 'برامج تدريبية في إدارة المرافق والأصول والصيانة الوقائية وكفاءة الطاقة',
      icon: 'fa-building',
      gradient: 'from-emerald-800 via-teal-700 to-cyan-800',
      stats: [
        { key: 'total', label: 'الدورات', icon: 'fa-graduation-cap', tone: 'text-emerald-600' },
        { key: 'active', label: 'متدربون', icon: 'fa-user-check', tone: 'text-blue-600' },
        { key: 'done', label: 'مباني مُدارة', icon: 'fa-city', tone: 'text-teal-600' },
        { key: 'urgent', label: 'زيارات ميدانية', icon: 'fa-walking', tone: 'text-amber-600' }
      ],
      columns: ['الدورة', 'المجال', 'المشاركون', 'الحالة'],
      seed: [
        ['إدارة المرافق المتقدمة', 'إدارة', '40', 'جاري'],
        ['الصيانة الوقائية', 'صيانة', '52', 'جاري'],
        ['إدارة الأصول الثابتة', 'أصول', '30', 'مجدول'],
        ['كفاءة الطاقة في المباني', 'طاقة', '36', 'مكتمل'],
        ['إدارة العقود والمقاولين', 'عقود', '24', 'جاري'],
        ['BIM للمرافق', 'تقنية', '18', 'تسجيل مفتوح']
      ],
      highlights: [
        { label: 'مساحة مُدارة', value: '2.4M م²', icon: 'fa-ruler-combined' },
        { label: 'توفير طاقة', value: '22%', icon: 'fa-bolt' },
        { label: 'معايير IFMA', value: 'معتمد', icon: 'fa-stamp' },
        { label: 'مشاريع تطبيقية', value: '38', icon: 'fa-tools' }
      ]
    },
    'eti-logistics': {
      title: 'حاضنة اللوجستيات والنقل والتوصيل',
      subtitle: 'تأهيل الكوادر في إدارة النقل والتوزيع وتتبع الشحنات وسلاسل التوصيل',
      icon: 'fa-shipping-fast',
      gradient: 'from-amber-700 via-orange-700 to-red-800',
      stats: [
        { key: 'total', label: 'البرامج', icon: 'fa-boxes', tone: 'text-orange-600' },
        { key: 'active', label: 'متدربون', icon: 'fa-user-friends', tone: 'text-emerald-600' },
        { key: 'done', label: 'شحنات مُدارة', icon: 'fa-truck-moving', tone: 'text-blue-600' },
        { key: 'urgent', label: 'محاكاة تشغيلية', icon: 'fa-gamepad', tone: 'text-purple-600' }
      ],
      columns: ['البرنامج', 'التخصص', 'المشاركون', 'الحالة'],
      seed: [
        ['إدارة أسطول النقل', 'نقل', '46', 'جاري'],
        ['تتبع الشحنات الذكي', 'تتبع', '38', 'جاري'],
        ['التوزيع الحضري', 'توصيل', '52', 'مجدول'],
        ['إدارة المستودعات', 'مستودعات', '44', 'مكتمل'],
        ['Last Mile Delivery', 'توصيل', '30', 'جاري'],
        ['اللوجستيات العكسية', 'عكسي', '20', 'تسجيل مفتوح']
      ],
      highlights: [
        { label: 'دقة التسليم', value: '98.2%', icon: 'fa-bullseye' },
        { label: 'أساطيل مُدربة', value: '180', icon: 'fa-truck' },
        { label: 'مسارات محسّنة', value: '1,240', icon: 'fa-route' },
        { label: 'شهادات CLTD', value: '48', icon: 'fa-medal' }
      ]
    },
    'eti-project-management': {
      title: 'حاضنة إدارة المشاريع',
      subtitle: 'مسارات احترافية في إدارة المشاريع PMP وAgile وPMO والحوكمة التنفيذية',
      icon: 'fa-project-diagram',
      gradient: 'from-purple-800 via-fuchsia-700 to-pink-800',
      stats: [
        { key: 'total', label: 'المسارات', icon: 'fa-sitemap', tone: 'text-purple-600' },
        { key: 'active', label: 'متدربون', icon: 'fa-users-cog', tone: 'text-emerald-600' },
        { key: 'done', label: 'مشاريع تخرج', icon: 'fa-flag-checkered', tone: 'text-blue-600' },
        { key: 'urgent', label: 'ورش Agile', icon: 'fa-sync', tone: 'text-amber-600' }
      ],
      columns: ['المسار', 'المنهجية', 'المشاركون', 'الحالة'],
      seed: [
        ['PMP Prep Course', 'PMP', '64', 'جاري'],
        ['Agile Scrum Master', 'Agile', '48', 'جاري'],
        ['PMO Setup', 'PMO', '28', 'مجدول'],
        ['إدارة المخاطر في المشاريع', 'مخاطر', '36', 'مكتمل'],
        ['Prince2 Foundation', 'Prince2', '42', 'جاري'],
        ['إدارة المحافظ الاستثمارية', 'محافظ', '22', 'تسجيل مفتوح']
      ],
      highlights: [
        { label: 'معدل اجتياز PMP', value: '89%', icon: 'fa-trophy' },
        { label: 'مشاريع تخرج', value: '156', icon: 'fa-rocket' },
        { label: 'مدربون PMP', value: '16', icon: 'fa-user-tie' },
        { label: 'ساعات PDU', value: '8,200', icon: 'fa-hourglass-half' }
      ]
    },
    'eti-hr': {
      title: 'حاضنة HR الموارد البشرية',
      subtitle: 'تطوير الكفاءات في التوظيف والتدريب وتقييم الأداء والامتثال الوظيفي',
      icon: 'fa-users-gear',
      gradient: 'from-red-900 via-rose-800 to-red-700',
      stats: [
        { key: 'total', label: 'البرامج', icon: 'fa-book-reader', tone: 'text-red-600' },
        { key: 'active', label: 'متدربون', icon: 'fa-user-graduate', tone: 'text-emerald-600' },
        { key: 'done', label: 'شهادات SHRM', icon: 'fa-id-card', tone: 'text-blue-600' },
        { key: 'urgent', label: 'جلسات توجيه', icon: 'fa-comments', tone: 'text-amber-600' }
      ],
      columns: ['البرنامج', 'المجال', 'المشاركون', 'الحالة'],
      seed: [
        ['التوظيف الاستراتيجي', 'توظيف', '58', 'جاري'],
        ['إدارة الأداء الوظيفي', 'أداء', '46', 'جاري'],
        ['تصميم هيكل الرواتب', 'تعويضات', '32', 'مجدول'],
        ['قانون العمل السعودي', 'قانوني', '72', 'مكتمل'],
        ['تطوير القيادات', 'قيادة', '38', 'جاري'],
        ['HR Analytics', 'تحليل', '26', 'تسجيل مفتوح']
      ],
      highlights: [
        { label: 'معدل الاحتفاظ', value: '94%', icon: 'fa-heart' },
        { label: 'برامج قيادية', value: '12', icon: 'fa-crown' },
        { label: 'شهادات معتمدة', value: '142', icon: 'fa-certificate' },
        { label: 'ساعات تدريب', value: '9,600', icon: 'fa-clock' }
      ]
    }
  };

  function toast(message, type) {
    if (window.app?.showToast) {
      window.app.showToast(message, type || 'info');
      return;
    }
    const container = document.getElementById('toast-container');
    if (!container) {
      window.alert(message);
      return;
    }
    const colors = { success: 'bg-emerald-600', error: 'bg-red-600', info: 'bg-slate-800' };
    const el = document.createElement('div');
    el.className = `${colors[type] || colors.info} text-white px-4 py-3 rounded-xl shadow-lg text-sm font-bold pointer-events-auto`;
    el.textContent = message;
    container.appendChild(el);
    setTimeout(() => el.remove(), 3200);
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
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

  function computeStats(rows) {
    const total = rows.length;
    const active = rows.filter((row) => /جار|مفتوح|تسجيل/i.test(String(row[3]))).length;
    const done = rows.filter((row) => /مكتمل/i.test(String(row[3]))).length;
    const urgent = rows.filter((row) => /مجدول|تسجيل/i.test(String(row[3]))).length;
    return { total, active: Math.max(active, Math.round(total * 0.6)), done, urgent };
  }

  function getRows(route) {
    const config = PAGE_CONFIGS[route];
    if (!config) return [];
    return loadLocalRows(route) || config.seed.slice();
  }

  function renderHighlights(highlights) {
    if (!highlights?.length) return '';
    return `
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-3">
        ${highlights.map((item) => `
          <div class="bg-gradient-to-br from-white to-slate-50 rounded-xl p-4 border border-slate-100 shadow-sm hover:shadow-md transition">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center text-red-700">
                <i class="fas ${item.icon}"></i>
              </div>
              <div>
                <p class="text-xs text-slate-500">${escapeHtml(item.label)}</p>
                <p class="text-lg font-black text-slate-800">${escapeHtml(item.value)}</p>
              </div>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }

  function renderRowActions(route, index) {
    return `
      <div class="flex flex-wrap items-center justify-end gap-1.5">
        <button type="button" data-eti-action="view" data-route="${route}" data-index="${index}"
          class="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold">
          <i class="fas fa-eye"></i>
        </button>
        <button type="button" data-eti-action="edit" data-route="${route}" data-index="${index}"
          class="px-2.5 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold">
          <i class="fas fa-pen"></i>
        </button>
        <button type="button" data-eti-action="delete" data-route="${route}" data-index="${index}"
          class="px-2.5 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold">
          <i class="fas fa-trash"></i>
        </button>
      </div>
    `;
  }

  function renderTable(route, config, rows) {
    const body = rows.length
      ? rows.map((row, index) => `
        <tr class="border-b border-slate-100 hover:bg-red-50/30 transition" data-eti-row="${index}">
          ${row.map((cell) => `<td class="px-4 py-3 text-sm text-slate-700">${escapeHtml(cell)}</td>`).join('')}
          <td class="px-4 py-3">${renderRowActions(route, index)}</td>
        </tr>
      `).join('')
      : `<tr><td colspan="${config.columns.length + 1}" class="px-4 py-10 text-center text-slate-400 text-sm">لا توجد بيانات</td></tr>`;

    return `
      <div class="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden" data-eti-table="${route}">
        <div class="px-5 py-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
          <h3 class="font-bold text-slate-800">سجل البرامج والدورات</h3>
          <div class="flex flex-wrap gap-2">
            <button type="button" data-eti-action="refresh" data-route="${route}" class="px-3 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold">
              <i class="fas fa-rotate"></i> تحديث
            </button>
            <button type="button" data-eti-action="add" data-route="${route}" class="px-3 py-2 rounded-lg bg-red-800 hover:bg-red-900 text-white text-xs font-bold">
              <i class="fas fa-plus"></i> إضافة برنامج
            </button>
            <button type="button" data-eti-action="export" data-route="${route}" class="px-3 py-2 rounded-lg border border-red-200 text-red-700 hover:bg-red-50 text-xs font-bold">
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

  function renderQuickActions(route) {
    return `
      <div class="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
        <h3 class="font-bold text-lg mb-4 text-slate-800">إجراءات سريعة</h3>
        <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
          <button type="button" data-eti-action="toast" data-msg="تم فتح نموذج التسجيل" class="p-4 bg-red-50 hover:bg-red-100 rounded-xl transition text-right">
            <i class="fas fa-user-plus text-red-700 ml-2"></i>
            <span class="font-bold text-red-800 text-sm">تسجيل متدرب</span>
          </button>
          <button type="button" data-eti-action="toast" data-msg="تم جدولة جلسة تدريبية" class="p-4 bg-blue-50 hover:bg-blue-100 rounded-xl transition text-right">
            <i class="fas fa-calendar-plus text-blue-700 ml-2"></i>
            <span class="font-bold text-blue-800 text-sm">جدولة جلسة</span>
          </button>
          <button type="button" data-eti-action="toast" data-msg="تم إصدار التقرير" class="p-4 bg-emerald-50 hover:bg-emerald-100 rounded-xl transition text-right">
            <i class="fas fa-file-alt text-emerald-700 ml-2"></i>
            <span class="font-bold text-emerald-800 text-sm">تقرير الأداء</span>
          </button>
          <button type="button" onclick="app.loadRoute('education-training-incubators')" class="p-4 bg-slate-50 hover:bg-slate-100 rounded-xl transition text-right">
            <i class="fas fa-th-large text-slate-700 ml-2"></i>
            <span class="font-bold text-slate-800 text-sm">العودة للحاضنات</span>
          </button>
        </div>
      </div>
    `;
  }

  function renderHub() {
    const totalPrograms = HUB_CARDS.reduce((sum, card) => sum + card.stats.programs, 0);
    const totalTrainees = '7,030';
    const totalCerts = HUB_CARDS.reduce((sum, card) => sum + card.stats.certs, 0);

    return `
      <div class="space-y-6" data-eti-hub="main">
        <div class="relative overflow-hidden rounded-3xl bg-gradient-to-br from-red-950 via-red-800 to-rose-900 p-8 text-white shadow-2xl">
          <div class="absolute inset-0 opacity-20" style="background-image: radial-gradient(circle at 20% 50%, white 1px, transparent 1px); background-size: 24px 24px;"></div>
          <div class="relative z-10">
            <div class="flex flex-wrap items-start justify-between gap-6">
              <div class="max-w-2xl">
                <div class="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/15 backdrop-blur text-sm font-bold mb-4">
                  <i class="fas fa-seedling"></i>
                  <span>المنصة الرسمية — نايوش</span>
                </div>
                <h1 class="text-3xl md:text-4xl font-black mb-3">حاضنات التعليم والتدريب</h1>
                <p class="text-white/90 text-base md:text-lg leading-relaxed">
                  منظومة حاضنات متخصصة لتأهيل الكوادر الوطنية في مجالات السلامة والإمداد والمرافق واللوجستيات وإدارة المشاريع والموارد البشرية
                </p>
              </div>
              <div class="w-20 h-20 md:w-24 md:h-24 rounded-2xl bg-white/15 backdrop-blur flex items-center justify-center text-4xl">
                <i class="fas fa-graduation-cap"></i>
              </div>
            </div>
            <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8">
              <div class="bg-white/10 backdrop-blur rounded-2xl p-4 border border-white/20">
                <p class="text-white/70 text-sm">الحاضنات</p>
                <p class="text-3xl font-black">6</p>
              </div>
              <div class="bg-white/10 backdrop-blur rounded-2xl p-4 border border-white/20">
                <p class="text-white/70 text-sm">البرامج</p>
                <p class="text-3xl font-black">${totalPrograms}</p>
              </div>
              <div class="bg-white/10 backdrop-blur rounded-2xl p-4 border border-white/20">
                <p class="text-white/70 text-sm">المتدربون</p>
                <p class="text-3xl font-black">${totalTrainees}</p>
              </div>
              <div class="bg-white/10 backdrop-blur rounded-2xl p-4 border border-white/20">
                <p class="text-white/70 text-sm">الشهادات</p>
                <p class="text-3xl font-black">${totalCerts}</p>
              </div>
            </div>
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          ${HUB_CARDS.map((card) => `
            <article
              onclick="app.loadRoute('${card.route}')"
              class="group relative overflow-hidden rounded-2xl bg-white border border-slate-100 shadow-sm hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 cursor-pointer"
            >
              <div class="h-2 bg-gradient-to-r ${card.gradient}"></div>
              <div class="p-6">
                <div class="flex items-start justify-between mb-4">
                  <div class="w-14 h-14 rounded-2xl bg-gradient-to-br ${card.gradient} flex items-center justify-center text-white text-xl shadow-lg group-hover:scale-110 transition-transform">
                    <i class="fas ${card.icon}"></i>
                  </div>
                  <span class="text-xs px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 font-bold">${card.stats.rate} نجاح</span>
                </div>
                <h3 class="text-lg font-black text-slate-800 mb-2 group-hover:text-red-800 transition-colors">${escapeHtml(card.title)}</h3>
                <p class="text-sm text-slate-600 leading-relaxed mb-4">${escapeHtml(card.desc)}</p>
                <div class="grid grid-cols-3 gap-2 pt-4 border-t border-slate-100">
                  <div class="text-center">
                    <p class="text-lg font-black text-slate-800">${card.stats.programs}</p>
                    <p class="text-xs text-slate-500">برنامج</p>
                  </div>
                  <div class="text-center">
                    <p class="text-lg font-black text-slate-800">${card.stats.trainees}</p>
                    <p class="text-xs text-slate-500">متدرب</p>
                  </div>
                  <div class="text-center">
                    <p class="text-lg font-black text-slate-800">${card.stats.certs}</p>
                    <p class="text-xs text-slate-500">شهادة</p>
                  </div>
                </div>
                <div class="mt-4 flex items-center justify-between text-red-700 font-bold text-sm">
                  <span>دخول الحاضنة</span>
                  <i class="fas fa-arrow-left group-hover:-translate-x-1 transition-transform"></i>
                </div>
              </div>
            </article>
          `).join('')}
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
      <div class="space-y-6" data-eti-page="${route}">
        <div class="relative overflow-hidden rounded-2xl bg-gradient-to-r ${config.gradient} p-6 text-white shadow-xl">
          <div class="absolute top-0 left-0 w-40 h-40 bg-white/10 rounded-full -translate-x-1/2 -translate-y-1/2"></div>
          <div class="relative z-10">
            <button type="button" onclick="app.loadRoute('education-training-incubators')" class="mb-3 text-sm text-white/80 hover:text-white font-bold flex items-center gap-2">
              <i class="fas fa-arrow-right"></i> العودة لحاضنات التعليم والتدريب
            </button>
            <h2 class="text-2xl md:text-3xl font-black flex items-center gap-3">
              <i class="fas ${config.icon}"></i>
              ${config.title}
            </h2>
            <p class="mt-2 text-white/90 text-sm md:text-base max-w-3xl">${config.subtitle}</p>
          </div>
        </div>

        <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
          ${config.stats.map((item) => `
            <div class="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm hover:shadow-md transition">
              <div class="flex items-center justify-between mb-2">
                <span class="text-slate-500 text-sm">${item.label}</span>
                <i class="fas ${item.icon} ${item.tone}"></i>
              </div>
              <p class="text-3xl font-black text-slate-800" data-eti-stat="${route}:${item.key}">${stats[item.key] || 0}</p>
            </div>
          `).join('')}
        </div>

        ${renderHighlights(config.highlights)}
        ${renderTable(route, config, rows)}
        ${renderQuickActions(route)}
      </div>
    `;
  }

  function refreshStats(route, rows) {
    const stats = computeStats(rows);
    Object.keys(stats).forEach((key) => {
      const el = document.querySelector(`[data-eti-stat="${route}:${key}"]`);
      if (el) el.textContent = String(stats[key]);
    });
  }

  function refreshPage(route, rows) {
    const config = PAGE_CONFIGS[route];
    if (!config) return;
    const page = document.querySelector(`[data-eti-page="${route}"]`);
    if (!page) return;
    const table = page.querySelector(`[data-eti-table="${route}"]`);
    if (table) {
      const wrapper = document.createElement('div');
      wrapper.innerHTML = renderTable(route, config, rows);
      table.replaceWith(wrapper.firstElementChild);
    }
    refreshStats(route, rows);
  }

  function closeModal() {
    document.getElementById('eti-modal-overlay')?.remove();
  }

  function openRecordModal(route, mode, index) {
    const config = PAGE_CONFIGS[route];
    if (!config) return;
    const rows = getRows(route);
    const row = typeof index === 'number' ? rows[index] : null;
    const isView = mode === 'view';
    const titleMap = { add: 'إضافة برنامج', edit: 'تعديل البرنامج', view: 'عرض البرنامج' };

    closeModal();
    const fields = config.columns.map((col, colIndex) => {
      const value = row ? (row[colIndex] ?? '') : '';
      const inputAttrs = isView
        ? 'readonly class="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-700"'
        : 'class="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-red-500 focus:ring-2 focus:ring-red-100 outline-none"';
      return `
        <label class="block">
          <span class="text-sm font-bold text-slate-600 mb-1.5 block">${escapeHtml(col)}</span>
          <input type="text" name="eti-field-${colIndex}" value="${escapeHtml(value)}" ${inputAttrs} />
        </label>
      `;
    }).join('');

    const overlay = document.createElement('div');
    overlay.id = 'eti-modal-overlay';
    overlay.className = 'fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm';
    overlay.innerHTML = `
      <div class="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" dir="rtl">
        <div class="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h3 class="text-lg font-black text-slate-800">${titleMap[mode]}</h3>
          <button type="button" data-eti-modal-close class="w-9 h-9 rounded-lg hover:bg-slate-100 text-slate-500"><i class="fas fa-times"></i></button>
        </div>
        <form id="eti-record-form" class="p-6 space-y-4">
          ${fields}
          <div class="flex flex-wrap gap-2 pt-2 ${isView ? 'hidden' : ''}">
            <button type="submit" class="flex-1 min-w-[120px] px-4 py-2.5 rounded-xl bg-red-800 hover:bg-red-900 text-white font-bold text-sm">
              <i class="fas fa-check ml-1"></i> ${mode === 'edit' ? 'حفظ' : 'إضافة'}
            </button>
            <button type="button" data-eti-modal-close class="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold text-sm hover:bg-slate-50">إلغاء</button>
          </div>
        </form>
      </div>
    `;
    document.body.appendChild(overlay);

    overlay.querySelectorAll('[data-eti-modal-close]').forEach((btn) => {
      btn.addEventListener('click', closeModal);
    });
    overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(); });

    if (!isView) {
      overlay.querySelector('#eti-record-form')?.addEventListener('submit', (e) => {
        e.preventDefault();
        const form = e.target;
        const newRow = config.columns.map((_, i) => form.querySelector(`[name="eti-field-${i}"]`)?.value?.trim() || '—');
        const allRows = getRows(route);
        if (mode === 'edit' && typeof index === 'number') {
          allRows[index] = newRow;
        } else {
          allRows.unshift(newRow);
        }
        saveLocalRows(route, allRows);
        refreshPage(route, allRows);
        closeModal();
        toast(mode === 'edit' ? 'تم تحديث البرنامج' : 'تمت إضافة البرنامج', 'success');
      });
    }
  }

  function handleEtiAction(action, route, index) {
    const config = PAGE_CONFIGS[route];
    if (!config && action !== 'toast') return;

    if (action === 'toast') {
      toast('تم تنفيذ الإجراء بنجاح', 'success');
      return;
    }

    if (action === 'add') {
      openRecordModal(route, 'add');
      return;
    }

    if (action === 'refresh') {
      refreshPage(route, getRows(route));
      toast('تم تحديث البيانات', 'success');
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
      if (!getRows(route)[index]) { toast('لا توجد بيانات', 'error'); return; }
      openRecordModal(route, 'view', index);
      return;
    }

    if (action === 'edit') {
      if (!getRows(route)[index]) { toast('لا توجد بيانات', 'error'); return; }
      openRecordModal(route, 'edit', index);
      return;
    }

    if (action === 'delete') {
      const rows = getRows(route);
      const row = rows[index];
      if (!row) { toast('لا توجد بيانات', 'error'); return; }
      if (!window.confirm(`هل تريد حذف "${row[0]}"؟`)) return;
      rows.splice(index, 1);
      saveLocalRows(route, rows);
      refreshPage(route, rows);
      toast('تم الحذف', 'success');
    }
  }

  let etiDelegationReady = false;

  function ensureEtiDelegation() {
    if (etiDelegationReady) return;
    etiDelegationReady = true;
    document.addEventListener('click', (event) => {
      const button = event.target.closest('[data-eti-action]');
      if (!button) return;
      event.preventDefault();
      event.stopPropagation();
      const action = button.dataset.etiAction;
      const route = button.dataset.route;
      const index = button.dataset.index !== undefined ? Number(button.dataset.index) : undefined;
      if (action === 'toast') {
        toast(button.dataset.msg || 'تم التنفيذ', 'success');
        return;
      }
      if (!route || !PAGE_CONFIGS[route]) return;
      handleEtiAction(action, route, index);
    });
  }

  window.EducationIncubatorsPages = {
    routes: ['education-training-incubators', ...Object.keys(PAGE_CONFIGS)],
    renderHub,
    render(route) {
      if (route === 'education-training-incubators') return renderHub();
      return renderPage(route);
    },
    init(route) {
      if (route === 'education-training-incubators') return;
      ensureEtiDelegation();
    }
  };

  ensureEtiDelegation();
})();
