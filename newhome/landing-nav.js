(function () {
  'use strict';

  const NAV_LINKS = [
    { href: '/', label: 'الرئيسية', paths: ['/', ''] },
    { href: '/products', label: 'منتجاتنا', paths: ['/products'] },
    { href: '/services', label: 'خدماتنا', paths: ['/services', '/newhome/services.html'] },
    { href: '/newhome/branches.html', label: 'الفروع', paths: ['/newhome/branches.html'] },
    { href: '/newhome/incubators.html', label: 'الحاضنات', paths: ['/newhome/incubators.html'] },
    { href: '/newhome/platforms.html', label: 'المنصات', paths: ['/newhome/platforms.html'] },
    { href: '/newhome/ads.html', label: 'الإعلانات', paths: ['/newhome/ads.html'] },
    { href: '/members', label: 'العضوية', paths: ['/members', '/newhome/members.html', '/register.html'] },
    { href: '/newhome/blog.html', label: 'المدونة', paths: ['/newhome/blog.html'] },
    { href: '/saas-signup.html', label: 'الأسعار', paths: ['/saas-signup.html'] },
    { href: '/contact-empire.html', label: 'اتصل بنا', paths: ['/contact-empire.html'] },
    {
      href: '/strategic/information',
      label: 'مركز المعلومات',
      icon: 'fa-info-circle',
      className: 'nav-info-center',
      paths: ['/strategic/information']
    },
    {
      href: '/#register-with-us',
      label: 'سجل معانا',
      icon: 'fa-user-plus',
      className: 'nav-register-with-us',
      paths: ['/#register-with-us']
    }
  ];

  const HOME_SECTION_IDS = new Set(['book-tour', 'register-with-us', 'modules', 'contact']);

  const normalizePath = (pathname) => {
    const path = String(pathname || '/').replace(/\/+$/, '') || '/';
    return path;
  };

  const isActive = (link, path) => link.paths.some((candidate) => {
    const normalized = normalizePath(candidate);
    return normalized === path;
  });

  const isHomePage = () => {
    const path = normalizePath(window.location.pathname);
    return path === '/' || path === '/newhome' || path === '/newhome/index.html';
  };

  const getSectionIdFromHref = (href) => {
    const match = String(href || '').match(/#([A-Za-z0-9_-]+)/);
    return match ? match[1] : '';
  };

  const scrollToHomeSection = (sectionId, behavior = 'smooth') => {
    if (!sectionId || !HOME_SECTION_IDS.has(sectionId)) return false;
    const target = document.getElementById(sectionId);
    if (!target) return false;
    target.scrollIntoView({ behavior, block: 'start' });
    return true;
  };

  const bindHomeSectionNavigation = () => {
    document.addEventListener('click', (event) => {
      const link = event.target.closest('a[href*="#"]');
      if (!link) return;

      const href = link.getAttribute('href') || '';
      const sectionId = getSectionIdFromHref(href);
      if (!sectionId || !HOME_SECTION_IDS.has(sectionId)) return;

      const isSamePageHash = href.startsWith('#');
      const isRootHash = href.startsWith('/#');

      if (!isSamePageHash && !(isRootHash && isHomePage())) return;

      event.preventDefault();
      const hash = `#${sectionId}`;
      if (window.history?.replaceState) {
        window.history.replaceState(null, '', hash);
      } else {
        window.location.hash = hash;
      }
      scrollToHomeSection(sectionId);
    });

    const scrollToInitialHash = () => {
      if (!isHomePage() || !window.location.hash) return;
      const sectionId = getSectionIdFromHref(window.location.hash);
      if (!sectionId) return;
      requestAnimationFrame(() => {
        scrollToHomeSection(sectionId, 'auto');
      });
    };

    window.addEventListener('hashchange', () => {
      if (!isHomePage()) return;
      scrollToHomeSection(getSectionIdFromHref(window.location.hash));
    });

    scrollToInitialHash();
  };

  const renderNav = () => {
    const path = normalizePath(window.location.pathname);
    document.querySelectorAll('header.top-nav .nav-links').forEach((nav) => {
      const indicator = nav.querySelector('.nav-active-indicator, #nav-active-indicator');
      const indicatorHtml = indicator ? indicator.outerHTML : '';
      nav.innerHTML = indicatorHtml + NAV_LINKS.map((link) => {
        const active = isActive(link, path) ? ' active' : '';
        const className = [link.className, active.trim()].filter(Boolean).join(' ');
        const classAttr = className ? ` class="${className}"` : '';
        const icon = link.icon ? `<i class="fas ${link.icon}" aria-hidden="true"></i>` : '';
        return `<a href="${link.href}"${classAttr} aria-label="${link.label}">${icon}<span>${link.label}</span></a>`;
      }).join('');
    });
  };

  const init = () => {
    renderNav();
    bindHomeSectionNavigation();
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
