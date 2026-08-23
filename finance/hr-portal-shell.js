(function () {
  const NAV = [
    { key: 'home', href: '/hr', icon: 'fa-house', label: 'الرئيسية' },
    { key: 'requests', href: '/hr/my-requests', icon: 'fa-inbox', label: 'الطلبات' },
    { key: 'employee', href: '/hr/employees', icon: 'fa-user', label: 'الموظف' },
    { key: 'manager', href: '/hr/manager', icon: 'fa-user-tie', label: 'المدير' },
    { key: 'pending-actions', href: '/hr/pending-actions', icon: 'fa-hourglass-half', label: 'عمليات بانتظار إجراء', badgeKey: 'pending' },
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

    window.HRPortalShell = {
      STAGE_LABELS,
      NAV,
      headers: apiHeaders,
      loadSettingRecords,
      recordLabel,
      refreshBadges: async () => {
        const d = await fetchDashboard();
        const next = { pending: d.pending?.count || 0, newHires: d.new_hires_pending || 0 };
        sidebar.innerHTML = renderSidebar(next);
        updateMobileBadge(next);
        return next;
      }
    };
    setInterval(() => window.HRPortalShell.refreshBadges(), 20000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initShell);
  } else {
    initShell();
  }
})();
