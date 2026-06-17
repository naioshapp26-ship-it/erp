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
    }
  ];

  const normalizePath = (pathname) => {
    const path = String(pathname || '/').replace(/\/+$/, '') || '/';
    return path;
  };

  const isActive = (link, path) => link.paths.some((candidate) => {
    const normalized = normalizePath(candidate);
    return normalized === path;
  });

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

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', renderNav);
  } else {
    renderNav();
  }
})();
