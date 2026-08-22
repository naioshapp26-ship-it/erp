(function () {
  const NAV = [
    { section: 'عام' },
    { key: 'manager-home', href: '/hr/manager', icon: 'fa-house', label: 'الرئيسية' },
    { key: 'my-requests', href: '/hr/my-requests', icon: 'fa-file-lines', label: 'الطلبات' },
    { section: 'المدير' },
    { key: 'pending-actions', href: '/hr/pending-actions', icon: 'fa-hourglass-half', label: 'عمليات بانتظار إجراء', badgeKey: 'pending' },
    { key: 'requests', href: '/hr/requests', icon: 'fa-inbox', label: 'معالجة الطلبات' },
    { key: 'new-hires', href: '/hr/new-hires', icon: 'fa-user-plus', label: 'تعيين موظفين جدد', badgeKey: 'newHires' },
    { key: 'accepted', href: '/hr/accepted-employees', icon: 'fa-user-check', label: 'الموظفون المقبولون' },
    { key: 'employees', href: '/hr/employees', icon: 'fa-users', label: 'سجل الموظفين' },
    { section: 'أخرى' },
    { key: 'hr-home', href: '/hr', icon: 'fa-layer-group', label: 'كل خدمات الموارد البشرية' }
  ];

  const STAGE_LABELS = {
    manager: 'المدير المباشر',
    hr: 'الموارد البشرية',
    supervisor: 'المشرف العام',
    executive: 'المدير التنفيذي',
    finance: 'المالية'
  };

  const getPageKey = () => document.body.getAttribute('data-hr-page') || '';

  const apiHeaders = () => ({
    'Content-Type': 'application/json',
    'x-entity-type': 'HQ',
    'x-entity-id': 'HQ001'
  });

  async function fetchDashboard() {
    try {
      const res = await fetch('/api/hr/manager-dashboard', { headers: apiHeaders() });
      if (!res.ok) throw new Error('dashboard failed');
      return await res.json();
    } catch (_) {
      return { pending: { count: 0, by_stage: {} }, new_hires_pending: 0 };
    }
  }

  function renderSidebar(badges) {
    const path = (window.location.pathname || '').replace(/\/$/, '');
    const items = NAV.map((item) => {
      if (item.section) {
        return `<div class="hr-nav-label">${item.section}</div>`;
      }
      const active = path === item.href || (item.href !== '/hr' && path.startsWith(item.href));
      let badge = '';
      if (item.badgeKey === 'pending' && badges.pending > 0) {
        badge = `<span class="hr-nav-badge">${badges.pending}</span>`;
      }
      if (item.badgeKey === 'newHires' && badges.newHires > 0) {
        badge = `<span class="hr-nav-badge warn">${badges.newHires}</span>`;
      }
      return `
        <a href="${item.href}" class="hr-nav-link${active ? ' active' : ''}">
          <span class="left"><i class="fas ${item.icon}"></i><span>${item.label}</span></span>
          ${badge}
        </a>`;
    }).join('');

    return `
      <div class="hr-sidebar-brand">
        <div class="logo-row">
          <div class="logo-icon"><i class="fas fa-gem"></i></div>
          <div>
            <h2>نايوش للموارد البشرية</h2>
            <p>لوحة المدير والموظف</p>
          </div>
        </div>
      </div>
      <nav class="hr-nav-section">${items}</nav>
      <div class="hr-sidebar-footer">
        <a href="/hr/my-requests" class="hr-nav-link"><span class="left"><i class="fas fa-paper-plane"></i><span>إرسال طلب جديد</span></span></a>
      </div>`;
  }

  function wrapMainContent() {
    const layout = document.querySelector('.hr-app-layout');
    if (!layout) return;
    const sidebar = document.getElementById('hr-sidebar');
    const main = document.getElementById('hr-main');
    if (!sidebar || !main) return;

    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'hr-mobile-toggle';
    toggle.innerHTML = '<i class="fas fa-bars"></i>';
    toggle.addEventListener('click', () => sidebar.classList.toggle('open'));
    document.body.appendChild(toggle);
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
    sidebar.innerHTML = renderSidebar(badges);
    wrapMainContent();

    window.HRPortalShell = {
      STAGE_LABELS,
      refreshBadges: async () => {
        const d = await fetchDashboard();
        sidebar.innerHTML = renderSidebar({
          pending: d.pending?.count || 0,
          newHires: d.new_hires_pending || 0
        });
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
  }

  document.addEventListener('DOMContentLoaded', initShell);
})();
