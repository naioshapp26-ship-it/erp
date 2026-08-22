(function () {
  const WORKSPACE_NAV = [
    { section: 'مساحة العمل اليومية' },
    {
      key: 'manager',
      href: '/hr/manager',
      icon: 'fa-chart-line',
      label: 'لوحة المدير العام',
      subtitle: 'كل الطلبات المعلقة والتعيينات في مكان واحد',
      badgeKey: 'pending'
    },
    {
      key: 'my-requests',
      href: '/hr/my-requests',
      icon: 'fa-file-lines',
      label: 'الطلبات',
      subtitle: 'إجازة · سلفة · متابعة حالتي'
    },
    {
      key: 'pending-actions',
      href: '/hr/pending-actions',
      icon: 'fa-hourglass-half',
      label: 'عمليات بانتظار إجراء',
      subtitle: 'موافقة المدير ثم الموارد البشرية',
      badgeKey: 'pending'
    },
    {
      key: 'advance-new',
      href: '/hr/my-requests?type=advance',
      icon: 'fa-hand-holding-dollar',
      label: 'طلب سلفة جديد',
      subtitle: 'يملأ الموظف النموذج ويرسل'
    },
    {
      key: 'leave-new',
      href: '/hr/leaves',
      icon: 'fa-umbrella-beach',
      label: 'طلب إجازة جديد',
      subtitle: 'يظهر فوراً في عمليات الانتظار'
    },
    {
      key: 'requests',
      href: '/hr/requests',
      icon: 'fa-inbox',
      label: 'معالجة الطلبات',
      subtitle: 'قائمة كاملة لكل الطلبات'
    },
    {
      key: 'operations',
      href: '/hr/operations',
      icon: 'fa-diagram-project',
      label: 'بوابة العمليات',
      subtitle: 'إدارة متقدمة للطلبات والموظفين'
    }
  ];

  const MAIN_MENU_NAV = [
    { section: 'القائمة الرئيسية' },
    { key: 'employees', href: '/hr/employees', icon: 'fa-briefcase', label: 'النظام الإداري والموارد البشرية' },
    { key: 'operations-main', href: '/hr/operations', icon: 'fa-diagram-project', label: 'بوابة العمليات والطلبات' },
    { key: 'policies', href: '/hr/policies', icon: 'fa-scale-balanced', label: 'السياسات والاجراءات' },
    { key: 'accepted', href: '/hr/accepted-employees', icon: 'fa-user-check', label: 'الموظفون المقبولون' },
    { key: 'new-hires', href: '/hr/new-hires', icon: 'fa-user-plus', label: 'تعيين الموظفين الجداد', badgeKey: 'newHires' },
    { key: 'assets', href: '/hr/assets-custodies', icon: 'fa-boxes-stacked', label: 'إدارة العهد والأصول' },
    { key: 'attendance', href: '/hr/attendance-departure', icon: 'fa-clock', label: 'سجلات الحضور والانصراف' },
    { key: 'shifts', href: '/hr/shift-schedules', icon: 'fa-calendar-alt', label: 'جداول ونوبات العمل' },
    { key: 'payroll', href: '/hr/payroll', icon: 'fa-sack-dollar', label: 'تبسيط ادارة الرواتب' },
    { key: 'employee-360', href: '/hr/employee-360', icon: 'fa-id-card', label: 'ملف الموظف 360°' },
    { key: 'attendance-hub', href: '/hr/attendance-hub', icon: 'fa-stopwatch', label: 'مركز الحضور والورديات الذكي' },
    { key: 'payroll-hub', href: '/hr/payroll-hub', icon: 'fa-wallet', label: 'مركز الرواتب والتعويضات' },
    { key: 'performance', href: '/hr/performance', icon: 'fa-chart-line', label: 'مختبر الأداء والتقييم' },
    { key: 'learning', href: '/hr/learning', icon: 'fa-graduation-cap', label: 'أكاديمية التطوير والتدريب' },
    { key: 'notifications', href: '/hr/notifications-center', icon: 'fa-bell', label: 'مركز الإشعارات' }
  ];

  const TOP_NAV = [
    { key: 'hr-home', href: '/hr', icon: 'fa-house', label: 'الرئيسية' }
  ];

  const NAV = [...TOP_NAV, ...WORKSPACE_NAV, ...MAIN_MENU_NAV];

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

  function normalizePath(path) {
    if (!path || path === '/') return '/hr';
    return path.replace(/\/$/, '') || '/hr';
  }

  function isLinkActive(item, currentPath, searchParams) {
    const [itemPath, itemQuery] = item.href.split('?');
    const normalizedCurrent = normalizePath(currentPath);
    const normalizedItem = normalizePath(itemPath);

    if (itemQuery) {
      const expected = new URLSearchParams(itemQuery);
      if (normalizedCurrent !== normalizedItem) return false;
      for (const [key, value] of expected.entries()) {
        if (searchParams.get(key) !== value) return false;
      }
      return true;
    }

    if (normalizedItem === '/hr/my-requests' && normalizedCurrent === '/hr/my-requests') {
      return !searchParams.get('type');
    }

    if (normalizedItem === '/hr') {
      return normalizedCurrent === '/hr';
    }

    return normalizedCurrent === normalizedItem
      || (normalizedItem !== '/hr' && normalizedCurrent.startsWith(normalizedItem + '/'));
  }

  async function fetchDashboard() {
    try {
      const res = await fetch('/api/hr/manager-dashboard', { headers: apiHeaders() });
      if (!res.ok) throw new Error('dashboard failed');
      return await res.json();
    } catch (_) {
      return { pending: { count: 0, by_stage: {} }, new_hires_pending: 0 };
    }
  }

  function renderBadge(item, badges) {
    if (!item.badgeKey) return '';
    const count = badges[item.badgeKey] || 0;
    if (count <= 0) return '';
    const cls = item.badgeKey === 'newHires' ? 'hr-nav-badge warn' : 'hr-nav-badge';
    return `<span class="${cls}" title="إشعارات">${count}</span>`;
  }

  function renderNavLink(item, badges, currentPath, searchParams) {
    if (item.section) {
      return `<div class="hr-nav-label">${item.section}</div>`;
    }

    const active = isLinkActive(item, currentPath, searchParams);
    const badge = renderBadge(item, badges);
    const subtitle = item.subtitle
      ? `<span class="hr-nav-subtitle">${item.subtitle}</span>`
      : '';

    return `
      <a href="${item.href}" class="hr-nav-link${active ? ' active' : ''}" data-nav-key="${item.key || ''}">
        <span class="left">
          <span class="hr-nav-icon"><i class="fas ${item.icon}"></i></span>
          <span class="hr-nav-text">
            <span class="hr-nav-title">${item.label}</span>
            ${subtitle}
          </span>
        </span>
        ${badge}
      </a>`;
  }

  function renderSidebar(badges) {
    const currentPath = normalizePath(window.location.pathname || '');
    const searchParams = new URLSearchParams(window.location.search || '');
    const items = NAV.map((item) => renderNavLink(item, badges, currentPath, searchParams)).join('');

    return `
      <div class="hr-sidebar-brand">
        <div class="logo-row">
          <div class="logo-icon"><i class="fas fa-gem"></i></div>
          <div>
            <h2>نايوش للموارد البشرية</h2>
            <p>القائمة الجانبية</p>
          </div>
        </div>
      </div>
      <nav class="hr-nav-section">${items}</nav>
      <div class="hr-sidebar-footer">
        <a href="/hr/my-requests" class="hr-nav-link hr-nav-cta">
          <span class="left">
            <span class="hr-nav-icon"><i class="fas fa-paper-plane"></i></span>
            <span class="hr-nav-text"><span class="hr-nav-title">إرسال طلب جديد</span></span>
          </span>
        </a>
        <a href="/" class="hr-nav-link hr-nav-muted">
          <span class="left">
            <span class="hr-nav-icon"><i class="fas fa-arrow-right-from-bracket"></i></span>
            <span class="hr-nav-text"><span class="hr-nav-title">العودة للرئيسية</span></span>
          </span>
        </a>
      </div>`;
  }

  function updatePageBadges(badges) {
    const pending = String(badges.pending || 0);
    const ids = [
      'hr-pending-badge', 'hr-pending-card-badge',
      'hr-manager-badge', 'hr-manager-card-badge',
      'heroPendingBadge', 'heroNewHiresBadge', 'heroBigCount',
      'statTotalPending'
    ];
    ids.forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;
      if (id.includes('pending') || id.includes('manager') || id.includes('Total') || id === 'heroBigCount' || id === 'heroPendingBadge') {
        el.textContent = pending;
      }
    });
    const nh = document.getElementById('heroNewHiresBadge');
    const statNh = document.getElementById('statNewHires');
    if (nh) nh.textContent = String(badges.newHires || 0);
    if (statNh) statNh.textContent = String(badges.newHires || 0);
  }

  function wrapMainContent() {
    const layout = document.querySelector('.hr-app-layout');
    if (!layout) return;
    const sidebar = document.getElementById('hr-sidebar');
    if (!sidebar || document.querySelector('.hr-mobile-toggle')) return;

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
    if (total > 0) {
      el.textContent = String(total);
      el.hidden = false;
    } else {
      el.hidden = true;
    }
  }

  async function paintSidebar(sidebar, badges) {
    sidebar.innerHTML = renderSidebar(badges);
    updatePageBadges(badges);
    updateMobileBadge(badges);
  }

  async function initShell() {
    if (!document.body.classList.contains('hr-shell-active')) return;
    const sidebar = document.getElementById('hr-sidebar');
    if (!sidebar) return;

    const dash = await fetchDashboard();
    const badges = {
      pending: dash.pending?.count || 0,
      newHires: dash.new_hires_pending || 0
    };

    await paintSidebar(sidebar, badges);
    wrapMainContent();

    window.HRPortalShell = {
      STAGE_LABELS,
      refreshBadges: async () => {
        const d = await fetchDashboard();
        const next = {
          pending: d.pending?.count || 0,
          newHires: d.new_hires_pending || 0
        };
        await paintSidebar(sidebar, next);
        return next;
      },
      renderRecentRequests: (containerId, requests) => {
        const el = document.getElementById(containerId);
        if (!el) return;
        if (!requests?.length) {
          el.innerHTML = '<div class="p-8 text-center text-slate-400 font-bold">لا توجد طلبات معلقة حالياً</div>';
          return;
        }
        el.innerHTML = requests.map((r) => {
          const isLeave = /إجازة|اجازة|leave/i.test(r.request_type || '');
          const isAdvance = /سلف|قرض|advance|loan/i.test(r.request_type || '');
          const typeClass = isLeave ? 'leave' : (isAdvance ? 'advance' : 'stage');
          return `
            <div class="hr-request-row">
              <div>
                <div class="flex flex-wrap gap-2 mb-1">
                  <span class="hr-chip ${typeClass}">${r.request_type || 'طلب'}</span>
                  <span class="hr-chip stage">${r.current_stage_label || STAGE_LABELS[r.current_stage] || '—'}</span>
                </div>
                <div class="font-extrabold text-slate-800">${r.request_title || '—'}</div>
                <div class="text-sm text-slate-500 mt-1">${r.employee_name || '—'}</div>
              </div>
              <a href="/hr/pending-actions" class="text-sm font-extrabold text-blue-600 whitespace-nowrap">مراجعة ←</a>
            </div>`;
        }).join('');
      }
    };

    setInterval(() => window.HRPortalShell.refreshBadges(), 20000);
  }

  document.addEventListener('DOMContentLoaded', initShell);
})();
