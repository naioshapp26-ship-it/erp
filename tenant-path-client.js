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
    if (href.startsWith('//') || href.startsWith('/public/') || href.startsWith('/uploads/')) {
      return false;
    }
    // Path-mode must also scope /api/* so settings centers keep tenant context.
    // Subdomain-mode leaves paths untouched (isTenantPathMode is false).
    const subdomain = getStoredTenantSubdomain();
    if (!subdomain) return false;
    return !href.startsWith(`/t/${subdomain}`);
  }

  function scopeApiUrl(url) {
    const raw = String(url || '');
    if (!raw || /^https?:\/\//i.test(raw) || raw.startsWith('//')) return raw;
    if (!raw.startsWith('/api/') && !raw.startsWith('/invite')) return raw;
    return getTenantScopedPath(raw);
  }

  function installTenantFetchGuard() {
    if (!isTenantPathMode() || global.__tenantFetchGuarded) return;
    if (typeof global.fetch !== 'function') return;
    const originalFetch = global.fetch.bind(global);
    global.fetch = function tenantScopedFetch(input, init) {
      if (typeof input === 'string') {
        return originalFetch(scopeApiUrl(input), init);
      }
      if (input && typeof Request !== 'undefined' && input instanceof Request) {
        const scoped = scopeApiUrl(input.url);
        if (scoped !== input.url) {
          return originalFetch(new Request(scoped, input), init);
        }
      }
      return originalFetch(input, init);
    };
    global.__tenantFetchGuarded = true;
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

  function installTenantNavigationGuard() {
    if (!isTenantPathMode()) return;
    document.addEventListener('click', (event) => {
      const anchor = event.target && event.target.closest ? event.target.closest('a[href^="/"]') : null;
      if (!anchor || anchor.hasAttribute('data-tenant-scope-skip')) return;
      const href = anchor.getAttribute('href');
      if (!shouldScopeInternalHref(href)) return;
      event.preventDefault();
      window.location.assign(getTenantScopedPath(href));
    }, true);
  }

  function bootTenantPathHelpers() {
    installTenantFetchGuard();
    rewriteTenantAnchors(document);
    installTenantNavigationGuard();
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

  function scheduleTenantPathBoot() {
    bootTenantPathHelpers();
    window.addEventListener('load', () => rewriteTenantAnchors(document), { once: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', scheduleTenantPathBoot);
  } else {
    scheduleTenantPathBoot();
  }

  // Install fetch guard immediately so inline page scripts that run after this
  // file still inherit tenant-scoped /api/* URLs in path mode.
  installTenantFetchGuard();

  global.isTenantPathMode = isTenantPathMode;
  global.getStoredTenantSubdomain = getStoredTenantSubdomain;
  global.getTenantScopedPath = getTenantScopedPath;
  global.getTenantLandingPath = getTenantLandingPath;
  global.scopeApiUrl = scopeApiUrl;
  global.rewriteTenantAnchors = rewriteTenantAnchors;
})(window);
