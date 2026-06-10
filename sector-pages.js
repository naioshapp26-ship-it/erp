(function () {
  'use strict';

  const STORAGE_PREFIX = 'sectors:data:';

  const PAGE_CONFIGS = {
    'sc-member-management': {
      title: 'إدارة الأعضاء',
      subtitle: 'تسجيل الأعضاء، تصنيفهم، متابعة اشتراكاتهم، وقياس تفاعلهم داخل إمبراطورية نايوش',
      icon: 'fa-users-gear',
      gradient: 'from-red-800 to-red-600',
      api: '/api/users',
      stats: [
        { key: 'total', label: 'الأعضاء', icon: 'fa-users', tone: 'text-red-700' },
        { key: 'active', label: 'نشطون', icon: 'fa-user-check', tone: 'text-emerald-600' },
        { key: 'done', label: 'مجددون', icon: 'fa-rotate', tone: 'text-blue-600' },
        { key: 'urgent', label: 'ينتهي قريباً', icon: 'fa-clock', tone: 'text-amber-600' }
      ],
      columns: ['العضو', 'الفئة', 'الحالة', 'تاريخ الانضمام'],
      seed: [
        ['مجموعة الأفق التجارية', 'مؤسسات', 'نشط', '2024-03-12'],
        ['مريم السعيد', 'أفراد', 'نشط', '2025-01-08'],
        ['شركة نماء الرقمية', 'مؤسسات', 'قيد المراجعة', '2026-05-20'],
        ['خالد العتيبي', 'أفراد', 'مكتمل', '2023-11-02']
      ]
    },
    'sc-governance': {
      title: 'الحوكمة',
      subtitle: 'إطار حوكمة شامل للشفافية والامتثال وإدارة المخاطر عبر الإمبراطورية',
      icon: 'fa-scale-balanced',
      gradient: 'from-red-900 to-red-700',
      stats: [
        { key: 'total', label: 'السياسات', icon: 'fa-file-shield', tone: 'text-red-700' },
        { key: 'active', label: 'قيد المراجعة', icon: 'fa-pen', tone: 'text-amber-600' },
        { key: 'done', label: 'معتمدة', icon: 'fa-stamp', tone: 'text-emerald-600' },
        { key: 'urgent', label: 'مخاطر عالية', icon: 'fa-triangle-exclamation', tone: 'text-rose-600' }
      ],
      columns: ['السياسة', 'اللجنة', 'الحالة', 'آخر تحديث'],
      seed: [
        ['حماية البيانات', 'لجنة الامتثال', 'معتمد', '2026-06-01'],
        ['إدارة المخاطر', 'لجنة الحوكمة', 'قيد المراجعة', '2026-05-28'],
        ['أخلاقيات العمل', 'لجنة الأخلاقيات', 'معتمد', '2026-04-15']
      ]
    },
    'sc-automation': {
      title: 'الأتمتة',
      subtitle: 'أتمتة العمليات التشغيلية وسير العمل والتقارير لتسريع الإنجاز',
      icon: 'fa-robot',
      gradient: 'from-red-800 to-rose-600',
      api: '/api/employee-requests',
      stats: [
        { key: 'total', label: 'سير العمل', icon: 'fa-gears', tone: 'text-red-700' },
        { key: 'active', label: 'نشط', icon: 'fa-play', tone: 'text-emerald-600' },
        { key: 'done', label: 'مكتمل', icon: 'fa-check', tone: 'text-blue-600' },
        { key: 'urgent', label: 'قيد الإعداد', icon: 'fa-wrench', tone: 'text-amber-600' }
      ],
      columns: ['العملية', 'القسم', 'التوفير', 'الحالة'],
      seed: [
        ['اعتماد طلبات الإجازة', 'الموارد البشرية', '72%', 'نشط'],
        ['تسوية الفواتير الشهرية', 'المالية', '58%', 'نشط'],
        ['تذكير تجديد الاشتراك', 'المبيعات', '81%', 'نشط']
      ]
    },
    'sc-sustainability': {
      title: 'الاستدامة',
      subtitle: 'برامج الاستدامة البيئية والاجتماعية وتقارير ESG',
      icon: 'fa-leaf',
      gradient: 'from-red-800 to-emerald-700',
      stats: [
        { key: 'total', label: 'المبادرات', icon: 'fa-seedling', tone: 'text-red-700' },
        { key: 'active', label: 'جارية', icon: 'fa-spinner', tone: 'text-amber-600' },
        { key: 'done', label: 'مكتملة', icon: 'fa-circle-check', tone: 'text-emerald-600' },
        { key: 'urgent', label: 'أهداف 2026', icon: 'fa-bullseye', tone: 'text-blue-600' }
      ],
      columns: ['المبادرة', 'الهدف', 'الإنجاز', 'الحالة'],
      seed: [
        ['خفض استهلاك الورق', '50%', '42%', 'جاري'],
        ['تدريب الاستدامة', '5,000 عضو', '4,200', 'جاري'],
        ['طاقة متجددة', '6 فروع', '4 فروع', 'مخطط']
      ]
    },
    'sc-legal': {
      title: 'القانونية والمحاماة',
      subtitle: 'خدمات قانونية متخصصة للعقود والامتثال والملكية الفكرية',
      icon: 'fa-gavel',
      gradient: 'from-red-900 to-red-800',
      stats: [
        { key: 'total', label: 'الملفات', icon: 'fa-folder-open', tone: 'text-red-700' },
        { key: 'active', label: 'قيد المراجعة', icon: 'fa-scale-balanced', tone: 'text-amber-600' },
        { key: 'done', label: 'مغلقة', icon: 'fa-check-double', tone: 'text-emerald-600' },
        { key: 'urgent', label: 'عاجلة', icon: 'fa-fire', tone: 'text-rose-600' }
      ],
      columns: ['الملف', 'النوع', 'المحامي', 'الحالة'],
      seed: [
        ['عقد شراكة استراتيجية', 'عقود', 'د. سارة الحربي', 'قيد المراجعة'],
        ['تسجيل علامة تجارية', 'ملكية فكرية', 'م. أحمد الشمري', 'مكتمل'],
        ['نزاع تجاري', 'تقاضي', 'د. فهد القحطاني', 'مجدول']
      ]
    },
    'sc-skills-innovation': {
      title: 'المهارات والابتكارات',
      subtitle: 'مسارات تعلم عملية ومختبرات ابتكار وشهادات معتمدة',
      icon: 'fa-lightbulb',
      gradient: 'from-red-800 to-orange-600',
      api: '/api/hr/learning-academy',
      stats: [
        { key: 'total', label: 'المسارات', icon: 'fa-route', tone: 'text-red-700' },
        { key: 'active', label: 'جارية', icon: 'fa-play', tone: 'text-blue-600' },
        { key: 'done', label: 'مكتملة', icon: 'fa-award', tone: 'text-emerald-600' },
        { key: 'urgent', label: 'تسجيل مفتوح', icon: 'fa-user-plus', tone: 'text-amber-600' }
      ],
      columns: ['المسار', 'المدرب', 'المتعلمون', 'الحالة'],
      seed: [
        ['تطوير البرمجيات', 'فريق بيتا', '120', 'جاري'],
        ['التسويق الرقمي', 'أ. نورة', '85', 'جاري'],
        ['تحليل البيانات', 'د. سامي', '64', 'مجدول']
      ]
    },
    'sc-initiatives': {
      title: 'المبادرات',
      subtitle: 'مبادرات وطنية وإقليمية في التعليم والصحة وريادة الأعمال',
      icon: 'fa-flag',
      gradient: 'from-red-800 to-red-600',
      stats: [
        { key: 'total', label: 'المبادرات', icon: 'fa-hand-holding-heart', tone: 'text-red-700' },
        { key: 'active', label: 'نشطة', icon: 'fa-spinner', tone: 'text-amber-600' },
        { key: 'done', label: 'مكتملة', icon: 'fa-circle-check', tone: 'text-emerald-600' },
        { key: 'urgent', label: 'مستفيدون', icon: 'fa-users', tone: 'text-blue-600' }
      ],
      columns: ['المبادرة', 'المنطقة', 'المستفيدون', 'التقدم'],
      seed: [
        ['تعليم للجميع', 'الرياض', '45,000', '78%'],
        ['رقمنة الأعمال', 'جدة', '12,500', '65%'],
        ['صحة المجتمع', 'الدمام', '8,200', '100%']
      ]
    },
    'sc-beta-club': {
      title: 'نادي بيتا الرقمي',
      subtitle: 'مجتمع تقني حصري لتجربة المنتجات الجديدة والوصول المبكر للميزات',
      icon: 'fa-flask',
      gradient: 'from-red-900 to-purple-800',
      stats: [
        { key: 'total', label: 'الأعضاء', icon: 'fa-user-astronaut', tone: 'text-red-700' },
        { key: 'active', label: 'فعاليات', icon: 'fa-calendar', tone: 'text-amber-600' },
        { key: 'done', label: 'منتجات تجريبية', icon: 'fa-vial', tone: 'text-emerald-600' },
        { key: 'urgent', label: 'تسجيل مفتوح', icon: 'fa-door-open', tone: 'text-blue-600' }
      ],
      columns: ['الفعالية', 'التاريخ', 'المشاركون', 'الحالة'],
      seed: [
        ['لقاء بيتا الشهري', '15 يونيو 2026', '180', 'مجدول'],
        ['هاكاثون 48 ساعة', '2 يوليو 2026', '95', 'تسجيل مفتوح'],
        ['يوم المطورين', '20 أغسطس 2026', '220', 'مخطط']
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

    if (route === 'sc-local-hr') {
      return list.slice(0, 12).map((item) => [
        item.name || item.full_name || item.username || '—',
        item.department || item.email || '—',
        item.role || item.job_title || '—',
        item.is_active === false ? 'موقوف' : 'نشط'
      ]);
    }
    if (route === 'sc-sales' || route === 'sc-operational-finance') {
      return list.slice(0, 12).map((item) => [
        item.customer_name || item.client_name || item.title || item.invoice_number || '—',
        item.total_amount || item.amount || item.total || '—',
        item.status || '—',
        (item.created_at || item.issue_date || '').toString().slice(0, 10) || '—'
      ]);
    }
    if (route === 'sc-subscriptions') {
      return list.slice(0, 12).map((item) => [
        item.name || item.code || '—',
        item.platform_type || item.pricing_model || '—',
        item.is_active === false ? 'موقوف' : 'نشط',
        (item.updated_at || item.created_at || '').toString().slice(0, 10) || '—'
      ]);
    }
    if (route === 'sc-customer-service' || route === 'sc-daily-operations') {
      return list.slice(0, 12).map((item) => [
        item.request_title || item.title || item.employee_name || '—',
        item.employee_name || item.request_type || '—',
        item.priority || item.status || '—',
        item.status || '—'
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
        <button type="button" data-sc-action="view" data-route="${route}" data-index="${index}"
          class="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold" title="عرض">
          <i class="fas fa-eye"></i>
        </button>
        <button type="button" data-sc-action="edit" data-route="${route}" data-index="${index}"
          class="px-2.5 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold" title="تعديل">
          <i class="fas fa-pen"></i>
        </button>
        <button type="button" data-sc-action="delete" data-route="${route}" data-index="${index}"
          class="px-2.5 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold" title="حذف">
          <i class="fas fa-trash"></i>
        </button>
      </div>
    `;
  }

  function renderTable(route, config, rows) {
    const body = rows.length
      ? rows.map((row, index) => `
      <tr class="border-b border-slate-100 hover:bg-red-50/40 transition" data-sc-row="${index}">
        ${row.map((cell) => `<td class="px-4 py-3 text-sm text-slate-700">${escapeHtml(cell)}</td>`).join('')}
        <td class="px-4 py-3">${renderRowActions(route, index)}</td>
      </tr>
    `).join('')
      : `<tr><td colspan="${config.columns.length + 1}" class="px-4 py-10 text-center text-slate-400 text-sm">لا توجد بيانات — استخدم زر الإضافة لإنشاء سجل جديد</td></tr>`;

    return `
      <div class="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden" data-sc-table="${route}">
        <div class="px-5 py-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
          <h3 class="font-bold text-slate-800">سجل ${config.title}</h3>
          <div class="flex flex-wrap gap-2">
            <button type="button" data-sc-action="refresh" data-route="${route}" class="px-3 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold">
              <i class="fas fa-rotate"></i> تحديث
            </button>
            <button type="button" data-sc-action="add" data-route="${route}" class="px-3 py-2 rounded-lg bg-red-700 hover:bg-red-800 text-white text-xs font-bold">
              <i class="fas fa-plus"></i> إضافة
            </button>
            <button type="button" data-sc-action="export" data-route="${route}" class="px-3 py-2 rounded-lg border border-red-200 text-red-700 hover:bg-red-50 text-xs font-bold">
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
      <div class="space-y-6" data-sc-page="${route}">
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
              <p class="text-3xl font-black text-slate-800" data-sc-stat="${route}:${item.key}">${stats[item.key] || 0}</p>
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
      console.warn('[Sectors] API fallback for', route, error.message);
    }
    return loadLocalRows(route) || config.seed;
  }

  function refreshStats(route, rows) {
    const stats = computeStats(rows);
    Object.keys(stats).forEach((key) => {
      const el = document.querySelector(`[data-sc-stat="${route}:${key}"]`);
      if (el) el.textContent = String(stats[key]);
    });
  }

  function refreshPage(route, rows) {
    const config = PAGE_CONFIGS[route];
    if (!config) return;
    const page = document.querySelector(`[data-sc-page="${route}"]`);
    if (!page) return;
    const table = page.querySelector(`[data-sc-table="${route}"]`);
    if (table) {
      const wrapper = document.createElement('div');
      wrapper.innerHTML = renderTable(route, config, rows);
      table.replaceWith(wrapper.firstElementChild);
    }
    refreshStats(route, rows);
  }

  function closeModal() {
    document.getElementById('sc-modal-overlay')?.remove();
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
          <input type="text" name="sc-field-${colIndex}" value="${escapeHtml(value)}" ${inputAttrs} />
        </label>
      `;
    }).join('');

    const overlay = document.createElement('div');
    overlay.id = 'sc-modal-overlay';
    overlay.className = 'fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm';
    overlay.innerHTML = `
      <div class="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" dir="rtl" role="dialog" aria-modal="true">
        <div class="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h3 class="text-lg font-black text-slate-800">${titleMap[mode] || 'السجل'}</h3>
          <button type="button" data-sc-modal-close class="w-9 h-9 rounded-lg hover:bg-slate-100 text-slate-500">
            <i class="fas fa-times"></i>
          </button>
        </div>
        <form id="sc-record-form" class="p-6 space-y-4">
          ${fields}
          <div class="flex flex-wrap gap-2 pt-2 ${isView ? 'hidden' : ''}">
            <button type="submit" class="flex-1 min-w-[120px] px-4 py-2.5 rounded-xl bg-red-700 hover:bg-red-800 text-white font-bold text-sm">
              <i class="fas fa-check ml-1"></i> ${mode === 'edit' ? 'حفظ التعديل' : 'إضافة'}
            </button>
            <button type="button" data-sc-modal-close class="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold text-sm hover:bg-slate-50">
              إلغاء
            </button>
          </div>
        </form>
      </div>
    `;

    document.body.appendChild(overlay);

    overlay.addEventListener('click', (event) => {
      if (event.target === overlay || event.target.closest('[data-sc-modal-close]')) {
        closeModal();
      }
    });

    if (isView) return;

    const form = overlay.querySelector('#sc-record-form');
    form?.addEventListener('submit', (event) => {
      event.preventDefault();
      const values = config.columns.map((_, colIndex) => {
        const input = form.querySelector(`[name="sc-field-${colIndex}"]`);
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

  async function handleScAction(action, route, index) {
    const config = PAGE_CONFIGS[route];
    if (!config) return;

    if (action === 'refresh') {
      const button = document.querySelector(`[data-sc-action="refresh"][data-route="${route}"]`);
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

  let plDelegationReady = false;

  function ensurePlDelegation() {
    if (plDelegationReady) return;
    plDelegationReady = true;
    document.addEventListener('click', (event) => {
      const button = event.target.closest('[data-sc-action]');
      if (!button) return;
      event.preventDefault();
      event.stopPropagation();
      const action = button.dataset.plAction;
      const route = button.dataset.route;
      if (!action || !route || !PAGE_CONFIGS[route]) return;
      const index = button.dataset.index !== undefined ? Number(button.dataset.index) : undefined;
      handleScAction(action, route, index);
    });
  }

  window.SectorPages = {
    routes: Object.keys(PAGE_CONFIGS),
    render(route) {
      return renderPage(route);
    },
    async init(route) {
      const config = PAGE_CONFIGS[route];
      if (!config) return;
      ensurePlDelegation();
      const rows = await fetchRows(route);
      saveLocalRows(route, rows);
      refreshPage(route, rows);
    }
  };

  ensurePlDelegation();
})();
