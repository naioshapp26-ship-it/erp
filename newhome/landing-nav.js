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
    { href: '/contact-empire.html', label: 'اتصل بنا', paths: ['/contact-empire.html'] }
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
      nav.innerHTML = NAV_LINKS.map((link) => {
        const active = isActive(link, path) ? ' class="active"' : '';
        return `<a href="${link.href}"${active}>${link.label}</a>`;
      }).join('');
    });
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', renderNav);
  } else {
    renderNav();
  }
})();
