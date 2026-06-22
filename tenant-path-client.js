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

  global.isTenantPathMode = isTenantPathMode;
  global.getStoredTenantSubdomain = getStoredTenantSubdomain;
  global.getTenantScopedPath = getTenantScopedPath;
})(window);
