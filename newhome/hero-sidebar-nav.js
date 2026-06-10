(function () {
  'use strict';

  /** روابط القائمة الجانبية في الهيرو فقط — الصفحات الجانبية للزوار */
  const SIDE_PAGES = [
    { label: 'فرعي', href: '/newhome/branches.html' },
    { label: 'حاضنتي', href: '/newhome/incubators.html' },
    { label: 'منصتي', href: '/newhome/platforms.html' },
    { label: 'مكتبي', href: '/newhome/e-offices.html' },
    { label: 'أنظمتي', href: '/newhome/systems.html' },
    { label: 'شركاتي', href: '/newhome/companies.html' },
    { label: 'إعلاناتي', href: '/newhome/ads.html' },
    { label: 'صفحتي', href: '/create-page' },
    { label: 'الأعضاء', href: '/members' }
  ];

  const EMPRESS_PAGES = [
    { label: 'استشارات', href: '/consultations.html' },
    { label: 'دراسات', href: '/studies.html' },
    { label: 'تواصل مع الإمبراطورة', href: '/contact-empire.html' },
    { label: 'اشتراك', href: '/subscription.html', nested: true },
    { label: 'استشارة مجانية', href: '/free-consultation.html', nested: true }
  ];

  const renderSidebar = () => {
    const nav = document.querySelector('.hero-sidebar[data-hero-sidebar]');
    if (!nav) return;

    const sideLinks = SIDE_PAGES.map((item) => (
      `<a class="hero-sidebar-item" href="${item.href}">${item.label}</a>`
    )).join('');

    const empressLinks = EMPRESS_PAGES.map((item) => {
      const nestedClass = item.nested ? ' hero-sidebar-subsubitem' : '';
      return `<a class="hero-sidebar-subitem${nestedClass}" href="${item.href}">${item.label}</a>`;
    }).join('');

    nav.innerHTML = `
      ${sideLinks}
      <div class="hero-sidebar-group">
        <button class="hero-sidebar-item hero-sidebar-toggle" type="button" aria-expanded="false" aria-controls="empress-submenu">
          <span>الإمبراطورة</span>
          <i class="fas fa-chevron-down hero-sidebar-arrow" aria-hidden="true"></i>
        </button>
        <div class="hero-sidebar-submenu" id="empress-submenu" aria-hidden="true">
          ${empressLinks}
        </div>
      </div>
    `;

    initSidebarToggles(nav);
  };

  function initSidebarToggles(sidebar) {
    sidebar.addEventListener('click', (event) => {
      const btn = event.target.closest('.hero-sidebar-toggle');
      if (!btn) return;

      const isOpen = btn.getAttribute('aria-expanded') === 'true';
      const panelId = btn.getAttribute('aria-controls');
      const panel = panelId ? document.getElementById(panelId) : null;

      if (isOpen) {
        btn.setAttribute('aria-expanded', 'false');
        if (panel) {
          panel.classList.remove('open');
          panel.setAttribute('aria-hidden', 'true');
        }
        return;
      }

      btn.setAttribute('aria-expanded', 'true');
      if (panel) {
        panel.classList.add('open');
        panel.setAttribute('aria-hidden', 'false');
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', renderSidebar);
  } else {
    renderSidebar();
  }
})();
