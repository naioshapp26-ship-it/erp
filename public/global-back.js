(function () {
  'use strict';

  const EXCLUDED_PATHS = new Set([
    '/',
    '/index.html',
    '/login-page.html',
    '/register.html',
    '/saas-signup.html',
    '/unauthorized.html'
  ]);

  const EXCLUDED_PREFIXES = [
    '/newhome/',
    '/pwa/'
  ];

  function normalizePath(pathname) {
    const path = String(pathname || '/').split('?')[0].replace(/\/+$/, '') || '/';
    return path;
  }

  function shouldShowBackButton() {
    const path = normalizePath(window.location.pathname);
    if (EXCLUDED_PATHS.has(path)) return false;
    if (EXCLUDED_PREFIXES.some((prefix) => path.startsWith(prefix))) return false;
    if (document.body?.dataset?.hideGlobalBack === 'true') return false;
    return true;
  }

  function resolveFallbackUrl() {
    const path = normalizePath(window.location.pathname);

    if (path.startsWith('/finance/')) {
      return '/finance/index.html';
    }
    if (path.startsWith('/finance')) {
      return '/dashboard.html';
    }
    if (path.includes('super-admin')) {
      return '/dashboard.html';
    }
    if (path.includes('settings')) {
      return '/dashboard.html';
    }
    if (path.includes('tenant-admin')) {
      return '/dashboard.html';
    }
    if (path === '/dashboard.html' || path === '/home') {
      return '/';
    }
    return '/dashboard.html';
  }

  function goBack() {
    const referrer = String(document.referrer || '');
    const sameOriginReferrer = referrer.startsWith(window.location.origin);
    if (window.history.length > 1 && sameOriginReferrer) {
      window.history.back();
      return;
    }
    window.location.href = resolveFallbackUrl();
  }

  function ensureFontAwesome() {
    if (document.querySelector('link[href*="font-awesome"]')) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css';
    document.head.appendChild(link);
  }

  function mountBackButton() {
    if (!shouldShowBackButton()) {
      document.body?.classList.add('global-back-hidden');
      return;
    }

    if (document.getElementById('global-back-button')) return;

    ensureFontAwesome();

    const button = document.createElement('button');
    button.id = 'global-back-button';
    button.type = 'button';
    button.className = 'global-back-button';
    button.setAttribute('aria-label', 'رجوع');
    button.innerHTML = '<i class="fas fa-arrow-right" aria-hidden="true"></i><span>رجوع</span>';
    button.addEventListener('click', goBack);
    document.body.appendChild(button);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mountBackButton);
  } else {
    mountBackButton();
  }
})();
