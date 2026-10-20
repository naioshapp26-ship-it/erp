(function () {
  /**
   * Trusted entity scope comes from the server session (/api/auth/verify).
   * Never invent HQ001 for arbitrary users. Never trust localStorage alone for API scope.
   * Until session resolves, omit x-entity-* headers so the server uses the session cookie/token.
   */
  let context = { entityId: '', entityType: '', authenticated: false, userId: null, role: null };
  let ready = false;
  const readyWaiters = [];

  function pathName() {
    return String(window.location.pathname || '');
  }

  function isCentralFinancePath() {
    return pathName().startsWith('/finance');
  }

  function readAuthToken() {
    try {
      const fromStorage =
        localStorage.getItem('authToken') ||
        sessionStorage.getItem('authToken') ||
        '';
      if (fromStorage) return fromStorage;
    } catch (_) {
      /* */
    }
    const cookieMatch = String(document.cookie || '').match(/(?:^|;\s*)authToken=([^;]+)/);
    return cookieMatch ? decodeURIComponent(cookieMatch[1]) : '';
  }

  function clearInheritedLocalEntityOnFinance() {
    // Prevent stale office picks from driving client-side filters on central finance pages.
    // Does NOT grant HQ; session remains the authority for API scope.
    if (!isCentralFinancePath()) return;
    try {
      localStorage.removeItem('nayosh_selected_entity');
    } catch (_) {
      /* */
    }
  }

  clearInheritedLocalEntityOnFinance();

  function notifyReady() {
    ready = true;
    while (readyWaiters.length) {
      try {
        readyWaiters.shift()(context);
      } catch (_) {
        /* */
      }
    }
    try {
      window.dispatchEvent(new CustomEvent('finance-context-ready', { detail: context }));
    } catch (_) {
      /* */
    }
  }

  window.whenFinanceContextReady = function whenFinanceContextReady(cb) {
    if (typeof cb !== 'function') return;
    if (ready) {
      cb(context);
      return;
    }
    readyWaiters.push(cb);
  };

  window.FINANCE_CONTEXT = context;
  window.getFinanceEntityId = () => context.entityId || '';
  window.getFinanceEntityType = () => context.entityType || '';
  window.getFinanceHeaders = () => {
    const headers = {};
    const token = readAuthToken();
    if (token) headers.Authorization = `Bearer ${token}`;
    // Only echo session-resolved entity; never spoof HQ for limited users.
    if (context.authenticated && context.entityId) {
      headers['x-entity-id'] = context.entityId;
    }
    if (context.authenticated && context.entityType) {
      headers['x-entity-type'] = context.entityType;
    }
    return headers;
  };

  async function hydrateFromSession() {
    const token = readAuthToken();
    if (!token) {
      notifyReady();
      return;
    }
    try {
      const res = await fetch('/api/auth/verify', {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` },
        credentials: 'same-origin'
      });
      if (!res.ok) {
        notifyReady();
        return;
      }
      const data = await res.json();
      const user = (data && (data.user || (data.data && data.data.user))) || null;
      if (!user) {
        notifyReady();
        return;
      }
      const entityId = String(user.entity_id || '').trim();
      const entityType = String(user.tenant_type || '').trim().toUpperCase();
      context = {
        entityId,
        entityType,
        authenticated: true,
        userId: user.id || null,
        role: user.role || null
      };
      window.FINANCE_CONTEXT = context;
    } catch (_) {
      /* keep empty — server session still applies via cookie/bearer */
    }
    notifyReady();
  }

  // Kick off session hydrate immediately
  hydrateFromSession();
})();
