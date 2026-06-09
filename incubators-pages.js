(function () {
  'use strict';

  const STORAGE_PREFIX = 'incubators:data:';

  const PAGE_CONFIGS = {
    'ic-daily-operations': {
      title: 'العمليات اليومية',
      subtitle: 'متابعة وتنفيذ العمليات اليومية للحاضنة',
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
        ['متابعة برامج الحاضنة', 'فريق التشغيل', 'قيد التنفيذ', '2026-06-09'],
        ['تجهيز تقارير الرواد', 'منسق الحاضنة', 'مكتمل', '2026-06-09'],
        ['مراجعة طلبات الانضمام', 'مدير الحاضنة', 'مجدول', '2026-06-09']
      ]
    },
    'ic-sales': {
      title: 'المبيعات',
      subtitle: 'إدارة مبيعات وخدمات الحاضنة والصفقات',
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
    'ic-subscriptions': {
      title: 'الاشتراكات',
      subtitle: 'إدارة خطط الاشتراك وتجديد العملاء',
      icon: 'fa-cubes',
      gradient: 'from-red-900 to-red-700',
      api: '/api/incubators',
      stats: [
        { key: 'total', label: 'الاشتراكات', icon: 'fa-layer-group', tone: 'text-red-700' },
        { key: 'active', label: 'نشطة', icon: 'fa-circle-play', tone: 'text-emerald-600' },
        { key: 'done', label: 'منتهية', icon: 'fa-circle-pause', tone: 'text-slate-500' },
        { key: 'urgent', label: 'تنتهي قريباً', icon: 'fa-clock', tone: 'text-amber-600' }
      ],
      columns: ['الحاضنة', 'الخطة', 'الحالة', 'التجديد'],
      seed: [
        ['حاضنة نايوش الرئيسية', 'Enterprise', 'نشط', '2026-12-01'],
        ['حاضنة الرياض', 'Pro', 'نشط', '2026-09-15'],
        ['حاضنة جدة', 'Basic', 'تجريبي', '2026-07-01']
      ]
    },
    'ic-training': {
      title: 'التدريب',
      subtitle: 'الدورات والبرامج التدريبية في الحاضنة',
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
    'ic-customer-service': {
      title: 'خدمة العملاء',
      subtitle: 'تذاكر واستفسارات رواد ومستفيدي الحاضنة',
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
    'ic-operational-reports': {
      title: 'التقارير التشغيلية',
      subtitle: 'مؤشرات أداء الحاضنة والتقارير الدورية',
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
    'ic-local-hr': {
      title: 'الموارد البشرية المحلية',
      subtitle: 'شؤون موظفي الحاضنة والحضور والطلبات',
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
    'ic-operational-finance': {
      title: 'المالية التشغيلية',
      subtitle: 'المصروفات والتحصيل والميزانية التشغيلية للحاضنة',
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

    if (route === 'ic-local-hr') {
      return list.slice(0, 12).map((item) => [
        item.name || item.full_name || item.username || '—',
        item.department || item.email || '—',
        item.role || item.job_title || '—',
        item.is_active === false ? 'موقوف' : 'نشط'
      ]);
    }
    if (route === 'ic-sales' || route === 'ic-operational-finance') {
      return list.slice(0, 12).map((item) => [
        item.customer_name || item.client_name || item.title || item.invoice_number || '—',
        item.total_amount || item.amount || item.total || '—',
        item.status || '—',
        (item.created_at || item.issue_date || '').toString().slice(0, 10) || '—'
      ]);
    }
    if (route === 'ic-subscriptions') {
      return list.slice(0, 12).map((item) => [
        item.name || item.code || '—',
        item.incubator_type || item.type || item.plan || '—',
        item.is_active === false ? 'موقوف' : 'نشط',
        (item.updated_at || item.created_at || '').toString().slice(0, 10) || '—'
      ]);
    }
    if (route === 'ic-customer-service' || route === 'ic-daily-operations') {
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
        <button type="button" data-ic-action="view" data-route="${route}" data-index="${index}"
          class="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold" title="عرض">
          <i class="fas fa-eye"></i>
        </button>
        <button type="button" data-ic-action="edit" data-route="${route}" data-index="${index}"
          class="px-2.5 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold" title="تعديل">
          <i class="fas fa-pen"></i>
        </button>
        <button type="button" data-ic-action="delete" data-route="${route}" data-index="${index}"
          class="px-2.5 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold" title="حذف">
          <i class="fas fa-trash"></i>
        </button>
      </div>
    `;
  }

  function renderTable(route, config, rows) {
    const body = rows.length
      ? rows.map((row, index) => `
      <tr class="border-b border-slate-100 hover:bg-red-50/40 transition" data-ic-row="${index}">
        ${row.map((cell) => `<td class="px-4 py-3 text-sm text-slate-700">${escapeHtml(cell)}</td>`).join('')}
        <td class="px-4 py-3">${renderRowActions(route, index)}</td>
      </tr>
    `).join('')
      : `<tr><td colspan="${config.columns.length + 1}" class="px-4 py-10 text-center text-slate-400 text-sm">لا توجد بيانات — استخدم زر الإضافة لإنشاء سجل جديد</td></tr>`;

    return `
      <div class="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden" data-ic-table="${route}">
        <div class="px-5 py-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
          <h3 class="font-bold text-slate-800">سجل ${config.title}</h3>
          <div class="flex flex-wrap gap-2">
            <button type="button" data-ic-action="refresh" data-route="${route}" class="px-3 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold">
              <i class="fas fa-rotate"></i> تحديث
            </button>
            <button type="button" data-ic-action="add" data-route="${route}" class="px-3 py-2 rounded-lg bg-red-700 hover:bg-red-800 text-white text-xs font-bold">
              <i class="fas fa-plus"></i> إضافة
            </button>
            <button type="button" data-ic-action="export" data-route="${route}" class="px-3 py-2 rounded-lg border border-red-200 text-red-700 hover:bg-red-50 text-xs font-bold">
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
      <div class="space-y-6" data-ic-page="${route}">
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
              <p class="text-3xl font-black text-slate-800" data-ic-stat="${route}:${item.key}">${stats[item.key] || 0}</p>
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
      console.warn('[Incubators] API fallback for', route, error.message);
    }
    return loadLocalRows(route) || config.seed;
  }

  function refreshStats(route, rows) {
    const stats = computeStats(rows);
    Object.keys(stats).forEach((key) => {
      const el = document.querySelector(`[data-ic-stat="${route}:${key}"]`);
      if (el) el.textContent = String(stats[key]);
    });
  }

  function refreshPage(route, rows) {
    const config = PAGE_CONFIGS[route];
    if (!config) return;
    const page = document.querySelector(`[data-ic-page="${route}"]`);
    if (!page) return;
    const table = page.querySelector(`[data-ic-table="${route}"]`);
    if (table) {
      const wrapper = document.createElement('div');
      wrapper.innerHTML = renderTable(route, config, rows);
      table.replaceWith(wrapper.firstElementChild);
    }
    refreshStats(route, rows);
  }

  function closeModal() {
    document.getElementById('ic-modal-overlay')?.remove();
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
          <input type="text" name="ic-field-${colIndex}" value="${escapeHtml(value)}" ${inputAttrs} />
        </label>
      `;
    }).join('');

    const overlay = document.createElement('div');
    overlay.id = 'ic-modal-overlay';
    overlay.className = 'fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm';
    overlay.innerHTML = `
      <div class="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" dir="rtl" role="dialog" aria-modal="true">
        <div class="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h3 class="text-lg font-black text-slate-800">${titleMap[mode] || 'السجل'}</h3>
          <button type="button" data-ic-modal-close class="w-9 h-9 rounded-lg hover:bg-slate-100 text-slate-500">
            <i class="fas fa-times"></i>
          </button>
        </div>
        <form id="ic-record-form" class="p-6 space-y-4">
          ${fields}
          <div class="flex flex-wrap gap-2 pt-2 ${isView ? 'hidden' : ''}">
            <button type="submit" class="flex-1 min-w-[120px] px-4 py-2.5 rounded-xl bg-red-700 hover:bg-red-800 text-white font-bold text-sm">
              <i class="fas fa-check ml-1"></i> ${mode === 'edit' ? 'حفظ التعديل' : 'إضافة'}
            </button>
            <button type="button" data-ic-modal-close class="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold text-sm hover:bg-slate-50">
              إلغاء
            </button>
          </div>
        </form>
      </div>
    `;

    document.body.appendChild(overlay);

    overlay.addEventListener('click', (event) => {
      if (event.target === overlay || event.target.closest('[data-ic-modal-close]')) {
        closeModal();
      }
    });

    if (isView) return;

    const form = overlay.querySelector('#ic-record-form');
    form?.addEventListener('submit', (event) => {
      event.preventDefault();
      const values = config.columns.map((_, colIndex) => {
        const input = form.querySelector(`[name="ic-field-${colIndex}"]`);
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

  async function handleIcAction(action, route, index) {
    const config = PAGE_CONFIGS[route];
    if (!config) return;

    if (action === 'refresh') {
      const button = document.querySelector(`[data-ic-action="refresh"][data-route="${route}"]`);
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

  let icDelegationReady = false;

  function ensureIcDelegation() {
    if (icDelegationReady) return;
    icDelegationReady = true;
    document.addEventListener('click', (event) => {
      const button = event.target.closest('[data-ic-action]');
      if (!button) return;
      event.preventDefault();
      event.stopPropagation();
      const action = button.dataset.icAction;
      const route = button.dataset.route;
      if (!action || !route || !PAGE_CONFIGS[route]) return;
      const index = button.dataset.index !== undefined ? Number(button.dataset.index) : undefined;
      handleIcAction(action, route, index);
    });
  }

  window.IncubatorsPages = {
    routes: Object.keys(PAGE_CONFIGS),
    render(route) {
      return renderPage(route);
    },
    async init(route) {
      const config = PAGE_CONFIGS[route];
      if (!config) return;
      ensureIcDelegation();
      const rows = await fetchRows(route);
      saveLocalRows(route, rows);
      refreshPage(route, rows);
    }
  };

  ensureIcDelegation();
})();
