'use strict';

(function initTenantPathHelpers(global) {
  function isTenantPathMode() {
    if (String(global.location.pathname || '').startsWith('/t/')) {
      return true;
    }
    const host = String(global.location.hostname || '').toLowerCase();
    return host.includes('railway.app') || host.includes('rlwy.net');
  }

  function readStoredUser() {
    try {
      return JSON.parse(
        global.sessionStorage.getItem('user')
        || global.localStorage.getItem('user')
        || 'null'
      );
    } catch (_) {
      return null;
    }
  }

  function getStoredTenantSubdomain() {
    const pathMatch = String(global.location.pathname || '').match(/^\/t\/([a-z0-9][a-z0-9-]*)/i);
    if (pathMatch) {
      return pathMatch[1].toLowerCase();
    }

    const authGetter = global.getAuthContext || global.getAppAuthContext;
    if (typeof authGetter === 'function') {
      const authContext = authGetter();
      if (authContext?.tenantSubdomain) {
        return authContext.tenantSubdomain;
      }
    }

    const user = readStoredUser();
    return user?.tenantSubdomain || null;
  }

  function getTenantScopedPath(targetPath) {
    const normalizedPath = String(targetPath || '').startsWith('/')
      ? String(targetPath || '')
      : `/${targetPath || ''}`;
    const subdomain = getStoredTenantSubdomain();
    if (!subdomain || !isTenantPathMode()) {
      return normalizedPath;
    }
    if (normalizedPath.startsWith(`/t/${subdomain}`)) {
      return normalizedPath;
    }
    return `/t/${subdomain}${normalizedPath}`;
  }

  function getTenantLandingPath() {
    const subdomain = getStoredTenantSubdomain();
    if (!subdomain || !isTenantPathMode()) {
      return '/';
    }
    return `/t/${subdomain}/`;
  }

  function shouldScopeInternalHref(href) {
    if (!href || typeof href !== 'string') return false;
    if (!href.startsWith('/')) return false;
    if (href.startsWith('//') || href.startsWith('/api/') || href.startsWith('/public/') || href.startsWith('/uploads/')) {
      return false;
    }
    const subdomain = getStoredTenantSubdomain();
    if (!subdomain) return false;
    return !href.startsWith(`/t/${subdomain}`);
  }

  function rewriteTenantAnchors(root) {
    if (!isTenantPathMode()) return;
    const scopeRoot = root && root.querySelectorAll ? root : document;
    scopeRoot.querySelectorAll('a[href^="/"]').forEach((anchor) => {
      const href = anchor.getAttribute('href');
      if (!shouldScopeInternalHref(href)) return;
      anchor.setAttribute('href', getTenantScopedPath(href));
    });
  }

  function bootTenantPathHelpers() {
    rewriteTenantAnchors(document);
    if (typeof MutationObserver === 'function' && document.body) {
      const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          mutation.addedNodes.forEach((node) => {
            if (!(node instanceof Element)) return;
            if (node.matches && node.matches('a[href^="/"]')) {
              const href = node.getAttribute('href');
              if (shouldScopeInternalHref(href)) {
                node.setAttribute('href', getTenantScopedPath(href));
              }
            }
            if (node.querySelectorAll) {
              rewriteTenantAnchors(node);
            }
          });
        });
      });
      observer.observe(document.body, { childList: true, subtree: true });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootTenantPathHelpers);
  } else {
    bootTenantPathHelpers();
  }

  global.isTenantPathMode = isTenantPathMode;
  global.getStoredTenantSubdomain = getStoredTenantSubdomain;
  global.getTenantScopedPath = getTenantScopedPath;
  global.getTenantLandingPath = getTenantLandingPath;
  global.rewriteTenantAnchors = rewriteTenantAnchors;
})(window);
