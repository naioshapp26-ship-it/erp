(function () {
  const NAV = [
    { key: 'home', href: '/hr', icon: 'fa-house', label: 'الرئيسية' },
    { key: 'requests', href: '/hr/my-requests', icon: 'fa-inbox', label: 'الطلبات' },
    { key: 'employee', href: '/hr/employees', icon: 'fa-user', label: 'الموظف' },
    { key: 'manager', href: '/hr/manager', icon: 'fa-user-tie', label: 'المدير' },
    { key: 'pending-actions', href: '/hr/pending-actions', icon: 'fa-hourglass-half', label: 'عمليات بانتظار إجراء', badgeKey: 'pending' },
    { key: 'attendance-hub', href: '/hr/attendance-hub', icon: 'fa-stopwatch', label: 'مركز الحضور والنوبات الذكي' },
    { key: 'human-resources', href: '/hr/human-resources', icon: 'fa-people-group', label: 'الموارد البشرية' },
    { key: 'tasks', href: '/hr/tasks-management', icon: 'fa-list-check', label: 'المهام' },
    { key: 'decisions', href: '/hr/decisions', icon: 'fa-gavel', label: 'القرارات' },
    { key: 'payroll-expenses', href: '/hr/payroll', icon: 'fa-sack-dollar', label: 'الرواتب والمصروفات' },
    { key: 'government-services', href: '/hr/government-services', icon: 'fa-landmark', label: 'الخدمات الحكومية' },
    { key: 'third-party-services', href: '/hr/third-party-services', icon: 'fa-handshake', label: 'خدمات الطرف الثالث', isNew: true },
    { key: 'training-development', href: '/hr/learning', icon: 'fa-graduation-cap', label: 'التدريب والتطوير' },
    { key: 'circulars', href: '/hr/circulars', icon: 'fa-bullhorn', label: 'التعاميم والإشعارات' },
    { key: 'policies', href: '/hr/policies', icon: 'fa-scale-balanced', label: 'السياسات' },
    { key: 'letters', href: '/hr/letters', icon: 'fa-envelope-open-text', label: 'الخطابات' },
    { key: 'recruitment', href: '/hr/recruitment', icon: 'fa-user-plus', label: 'التوظيف' },
    { key: 'offers-benefits', href: '/hr/offers-benefits', icon: 'fa-gift', label: 'العروض والمزايا', isNew: true },
    { key: 'custody', href: '/hr/assets-custodies', icon: 'fa-box-open', label: 'العهد' },
    { key: 'surveys', href: '/hr/surveys', icon: 'fa-square-poll-vertical', label: 'الاستبيانات' },
    { key: 'reports', href: '/hr/reports', icon: 'fa-chart-column', label: 'التقارير' },
    { key: 'system-settings', href: '/hr/system-settings', icon: 'fa-gear', label: 'إعدادات النظام' }
  ];

  const STAGE_LABELS = {
    manager: 'المدير المباشر',
    hr: 'الموارد البشرية',
    supervisor: 'المشرف العام',
    executive: 'المدير التنفيذي',
    finance: 'المالية'
  };

  const apiHeaders = () => ({
    'Content-Type': 'application/json',
    'x-entity-type': 'HQ',
    'x-entity-id': 'HQ001'
  });

  function isHrRoute() {
    const path = String(window.location.pathname || '');
    return path === '/hr' || path.startsWith('/hr/');
  }

  function normalizePath(path) {
    if (!path || path === '/') return '/hr';
    return path.replace(/\/$/, '') || '/hr';
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }

  let homeModulesCache = null;

  async function loadHomeModules() {
    if (Array.isArray(window.HR_HOME_MODULES) && window.HR_HOME_MODULES.length) {
      homeModulesCache = window.HR_HOME_MODULES;
      return homeModulesCache;
    }
    if (homeModulesCache) return homeModulesCache;
    try {
      const res = await fetch('/api/hr/home-modules', { headers: apiHeaders() });
      const data = await res.json();
      homeModulesCache = data.success ? (data.modules || []) : [];
    } catch (_) {
      homeModulesCache = [];
    }
    return homeModulesCache;
  }

  function isLinkActive(item, currentPath) {
    const itemPath = normalizePath(item.href.split('?')[0]);
    const current = normalizePath(currentPath);
    if (itemPath === '/hr') return current === '/hr';
    if (itemPath === '/hr/system-settings') {
      return current === itemPath || current.startsWith('/hr/system-settings/');
    }
    return current === itemPath || current.startsWith(itemPath + '/');
  }

  async function fetchDashboard() {
    try {
      const res = await fetch('/api/hr/manager-dashboard', { headers: apiHeaders() });
      if (!res.ok) throw new Error('dashboard failed');
      return await res.json();
    } catch (_) {
      return { pending: { count: 0 }, new_hires_pending: 0 };
    }
  }

  function renderBadge(item, badges) {
    if (item.isNew) return '<span class="hr-nav-new">جديد</span>';
    if (!item.badgeKey) return '';
    const count = badges[item.badgeKey] || 0;
    if (count <= 0) return '';
    return `<span class="hr-nav-badge">${count}</span>`;
  }

  function renderNavLink(item, badges, currentPath) {
    const active = isLinkActive(item, currentPath);
    return `
      <a href="${item.href}" class="hr-nav-link${active ? ' active' : ''}" data-nav-key="${item.key}">
        <span class="hr-nav-main">
          <span class="hr-nav-icon"><i class="fas ${item.icon}"></i></span>
          <span class="hr-nav-title">${item.label}</span>
        </span>
        ${renderBadge(item, badges)}
      </a>`;
  }

  function renderSidebar(badges) {
    const currentPath = normalizePath(window.location.pathname || '');
    const links = NAV.map((item) => renderNavLink(item, badges, currentPath)).join('');
    return `
      <div class="hr-sidebar-brand">
        <div class="logo-row">
          <div class="logo-icon"><i class="fas fa-gem"></i></div>
          <div>
            <h2>نايوش HCM</h2>
            <p>نظام الموارد البشرية</p>
          </div>
        </div>
      </div>
      <nav class="hr-nav-section">${links}</nav>
      <div class="hr-sidebar-footer">
        <a href="/hr/my-requests" class="hr-nav-link">
          <span class="hr-nav-main">
            <span class="hr-nav-icon"><i class="fas fa-paper-plane"></i></span>
            <span class="hr-nav-title">إرسال طلب للمدير</span>
          </span>
        </a>
        <a href="/" class="hr-nav-link hr-nav-muted">
          <span class="hr-nav-main">
            <span class="hr-nav-icon"><i class="fas fa-arrow-right-from-bracket"></i></span>
            <span class="hr-nav-title">العودة للرئيسية</span>
          </span>
        </a>
      </div>`;
  }

  async function loadSettingRecords(key) {
    try {
      const res = await fetch(`/api/hr/system-settings/${encodeURIComponent(key)}`, { headers: apiHeaders() });
      const data = await res.json();
      if (!data.success) return [];
      return data.records || [];
    } catch (_) {
      return [];
    }
  }

  function recordLabel(record) {
    const data = record?.data && typeof record.data === 'object' ? record.data : {};
    return data.name || record?.name || data.code || record?.code || `#${record?.id || ''}`;
  }

  function ensureLayout() {
    document.body.classList.add('hr-shell-active');
    const existing = document.getElementById('hr-sidebar');
    if (existing) return existing;

    const sidebar = document.createElement('aside');
    sidebar.className = 'hr-sidebar';
    sidebar.id = 'hr-sidebar';
    sidebar.setAttribute('aria-label', 'القائمة الجانبية');
    document.body.appendChild(sidebar);
    document.body.classList.add('hr-has-injected-sidebar');
    return sidebar;
  }

  function wrapMainContent(sidebar) {
    if (document.querySelector('.hr-mobile-toggle')) return;
    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'hr-mobile-toggle';
    toggle.setAttribute('aria-label', 'فتح القائمة');
    toggle.innerHTML = '<i class="fas fa-bars"></i><span class="hr-mobile-badge" id="hr-mobile-nav-badge" hidden>0</span>';
    toggle.addEventListener('click', () => sidebar.classList.toggle('open'));
    document.body.appendChild(toggle);
    document.addEventListener('click', (e) => {
      if (!sidebar.classList.contains('open')) return;
      if (sidebar.contains(e.target) || toggle.contains(e.target)) return;
      sidebar.classList.remove('open');
    });
  }

  function ensureTopBar(badges) {
    if (document.getElementById('hr-topbar')) return;
    const current = normalizePath(window.location.pathname || '');
    if (current === '/hr') return;

    const topbar = document.createElement('div');
    topbar.id = 'hr-topbar';
    topbar.className = 'hr-topbar';
    topbar.innerHTML = `
      <div class="hr-topbar-inner">
        <div class="hr-topbar-start">
          <a href="/hr" class="hr-topbar-btn"><i class="fas fa-house"></i><span>الرئيسية</span></a>
          <button type="button" class="hr-topbar-btn" id="hr-open-search"><i class="fas fa-magnifying-glass"></i><span>بحث الأنظمة</span></button>
        </div>
        <div class="hr-topbar-note"><i class="fas fa-user-tie"></i> كل الطلبات تمر عبر المدير المباشر</div>
        <div class="hr-topbar-actions">
          <a href="/hr/my-requests" class="hr-topbar-btn hr-topbar-primary"><i class="fas fa-paper-plane"></i><span>إرسال طلب</span></a>
          <a href="/hr/pending-actions" class="hr-topbar-btn">
            <i class="fas fa-hourglass-half"></i><span>بانتظار الإجراء</span>
            ${badges.pending > 0 ? `<span class="hr-topbar-badge">${badges.pending}</span>` : ''}
          </a>
          <a href="/hr/manager" class="hr-topbar-btn"><i class="fas fa-user-tie"></i><span>لوحة المدير</span></a>
        </div>
      </div>`;
    document.body.appendChild(topbar);
    document.getElementById('hr-open-search')?.addEventListener('click', openModuleSearch);
    document.body.classList.add('hr-has-topbar');
  }

  function ensureSearchModal() {
    if (document.getElementById('hr-module-search-modal')) return;
    const modal = document.createElement('div');
    modal.id = 'hr-module-search-modal';
    modal.className = 'hr-module-search-modal';
    modal.hidden = true;
    modal.innerHTML = `
      <div class="hr-module-search-backdrop" data-close="1"></div>
      <div class="hr-module-search-panel" role="dialog" aria-modal="true" aria-label="بحث أنظمة الموارد البشرية">
        <div class="hr-module-search-head">
          <i class="fas fa-magnifying-glass"></i>
          <input id="hr-module-search-input" type="search" placeholder="ابحث عن نظام أو خدمة..." autocomplete="off">
          <button type="button" class="hr-module-search-close" data-close="1" aria-label="إغلاق"><i class="fas fa-xmark"></i></button>
        </div>
        <div id="hr-module-search-results" class="hr-module-search-results"></div>
      </div>`;
    document.body.appendChild(modal);
    modal.querySelectorAll('[data-close]').forEach((el) => el.addEventListener('click', closeModuleSearch));
    document.getElementById('hr-module-search-input')?.addEventListener('input', (e) => {
      renderModuleSearchResults(e.target.value);
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeModuleSearch();
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        openModuleSearch();
      }
    });
  }

  async function renderModuleSearchResults(query = '') {
    const wrap = document.getElementById('hr-module-search-results');
    if (!wrap) return;
    const modules = await loadHomeModules();
    const q = String(query || '').trim().toLowerCase();
    const list = modules.filter((item) => {
      if (!q) return true;
      return item.label.toLowerCase().includes(q)
        || item.category.toLowerCase().includes(q)
        || item.href.toLowerCase().includes(q);
    }).slice(0, 24);
    if (!list.length) {
      wrap.innerHTML = '<div class="hr-module-search-empty">لا توجد نتائج مطابقة</div>';
      return;
    }
    wrap.innerHTML = list.map((item) => `
      <a class="hr-module-search-item" href="${escapeHtml(item.href)}">
        <span class="hr-module-search-icon"><i class="fas ${escapeHtml(item.icon)}"></i></span>
        <span class="hr-module-search-copy">
          <strong>${escapeHtml(item.label)}</strong>
          <small>${escapeHtml(item.category)}${item.manager ? ' • يمر عبر المدير' : ''}</small>
        </span>
        <i class="fas fa-chevron-left hr-module-search-arrow"></i>
      </a>
    `).join('');
  }

  function openModuleSearch() {
    ensureSearchModal();
    const modal = document.getElementById('hr-module-search-modal');
    const input = document.getElementById('hr-module-search-input');
    if (!modal || !input) return;
    modal.hidden = false;
    input.value = '';
    renderModuleSearchResults('');
    setTimeout(() => input.focus(), 0);
  }

  function closeModuleSearch() {
    const modal = document.getElementById('hr-module-search-modal');
    if (modal) modal.hidden = true;
  }

  function updateMobileBadge(badges) {
    const el = document.getElementById('hr-mobile-nav-badge');
    if (!el) return;
    const total = (badges.pending || 0) + (badges.newHires || 0);
    el.hidden = total <= 0;
    el.textContent = String(total);
  }

  function ensureAssets() {
    if (!document.querySelector('link[href*="font-awesome"], link[href*="fontawesome"]')) {
      const fa = document.createElement('link');
      fa.rel = 'stylesheet';
      fa.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css';
      document.head.appendChild(fa);
    }
  }

  async function initShell() {
    if (!isHrRoute() && !document.body.classList.contains('hr-shell-active')) return;
    ensureAssets();
    const sidebar = ensureLayout();
    if (!sidebar) return;

    const dash = await fetchDashboard();
    const badges = {
      pending: dash.pending?.count || 0,
      newHires: dash.new_hires_pending || 0
    };
    sidebar.innerHTML = renderSidebar(badges);
    updateMobileBadge(badges);
    wrapMainContent(sidebar);
    ensureTopBar(badges);
    ensureSearchModal();

    window.HRPortalShell = {
      STAGE_LABELS,
      NAV,
      headers: apiHeaders,
      loadSettingRecords,
      recordLabel,
      loadHomeModules,
      openModuleSearch,
      closeModuleSearch,
      findModuleByPath: (path) => {
        const clean = normalizePath(path || window.location.pathname);
        return (homeModulesCache || []).find((item) => item.href === clean) || null;
      },
      refreshBadges: async () => {
        const d = await fetchDashboard();
        const next = { pending: d.pending?.count || 0, newHires: d.new_hires_pending || 0 };
        sidebar.innerHTML = renderSidebar(next);
        updateMobileBadge(next);
        ensureTopBar(next);
        return next;
      }
    };
    await loadHomeModules();
    setInterval(() => window.HRPortalShell.refreshBadges(), 20000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initShell);
  } else {
    initShell();
  }
})();
