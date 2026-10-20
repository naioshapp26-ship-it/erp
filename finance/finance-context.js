(function () {
  // Never leave entity empty — empty/wrong office scope makes finance lists look "blank".
  const DEFAULT_CONTEXT = { entityId: 'HQ001', entityType: 'HQ' };

  function pathName() {
    return String(window.location.pathname || '');
  }

  function isCentralFinancePath() {
    // Hub and module pages under /finance (not tenant sites under /t/...)
    return pathName().startsWith('/finance');
  }

  function clearStaleCentralFinanceContext() {
    // On central /finance pages, do not inherit a tenant/office selection that empties HQ data.
    if (!isCentralFinancePath()) {
      // Legacy: on /t/ sites, drop accidental HQ leftovers
      if (!pathName().startsWith('/t/')) return;
      try {
        const stored = localStorage.getItem('nayosh_selected_entity');
        if (!stored) return;
        const parsed = JSON.parse(stored);
        const entityId = String(parsed.entityId || parsed.entity_id || '').trim();
        const entityType = String(parsed.tenantType || parsed.tenant_type || '').trim().toUpperCase();
        if (!entityId || entityId === 'HQ001' || entityType === 'HQ') {
          localStorage.removeItem('nayosh_selected_entity');
        }
      } catch (_) {
        localStorage.removeItem('nayosh_selected_entity');
      }
      return;
    }

    try {
      const stored = localStorage.getItem('nayosh_selected_entity');
      if (!stored) return;
      const parsed = JSON.parse(stored);
      const entityId = String(parsed.entityId || parsed.entity_id || '').trim();
      const entityType = String(parsed.tenantType || parsed.tenant_type || '').trim().toUpperCase();
      // Keep only explicit HQ on central finance; drop office/branch picks that hide data
      if (!entityId || entityType !== 'HQ' || entityId !== 'HQ001') {
        localStorage.removeItem('nayosh_selected_entity');
      }
    } catch (_) {
      localStorage.removeItem('nayosh_selected_entity');
    }
  }

  clearStaleCentralFinanceContext();

  function readStoredContext() {
    try {
      const stored = localStorage.getItem('nayosh_selected_entity');
      if (!stored) return null;
      const parsed = JSON.parse(stored);
      const entityId = String(parsed.entityId || parsed.entity_id || '').trim();
      const entityType = String(parsed.tenantType || parsed.tenant_type || '').trim().toUpperCase();
      if (!entityId) return null;
      return { entityId, entityType: entityType || DEFAULT_CONTEXT.entityType };
    } catch {
      return null;
    }
  }

  function readQueryContext() {
    const params = new URLSearchParams(window.location.search);
    const entityId = String(params.get('entity_id') || '').trim();
    const entityType = String(params.get('entity_type') || '').trim().toUpperCase();
    return entityId ? { entityId, entityType: entityType || DEFAULT_CONTEXT.entityType } : null;
  }

  const queryContext = readQueryContext();
  const storedContext = isCentralFinancePath() ? null : readStoredContext();

  const context = {
    entityId:
      (queryContext && queryContext.entityId) ||
      (storedContext && storedContext.entityId) ||
      DEFAULT_CONTEXT.entityId,
    entityType:
      (queryContext && queryContext.entityType) ||
      (storedContext && storedContext.entityType) ||
      DEFAULT_CONTEXT.entityType
  };

  window.FINANCE_CONTEXT = context;
  window.getFinanceEntityId = () => context.entityId || DEFAULT_CONTEXT.entityId;
  window.getFinanceEntityType = () => context.entityType || DEFAULT_CONTEXT.entityType;
  window.getFinanceHeaders = () => {
    const headers = {};
    const entityId = window.getFinanceEntityId();
    const entityType = window.getFinanceEntityType();
    if (entityId) headers['x-entity-id'] = entityId;
    if (entityType) headers['x-entity-type'] = entityType;
    return headers;
  };
})();
