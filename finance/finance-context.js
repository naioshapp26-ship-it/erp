(function () {
  const DEFAULT_CONTEXT = { entityId: '', entityType: '' };

  function readStoredContext() {
    try {
      const stored = localStorage.getItem('nayosh_selected_entity');
      if (!stored) return null;
      const parsed = JSON.parse(stored);
      return {
        entityId: parsed.entityId || parsed.entity_id || DEFAULT_CONTEXT.entityId,
        entityType: parsed.tenantType || parsed.tenant_type || DEFAULT_CONTEXT.entityType
      };
    } catch {
      return null;
    }
  }

  function readQueryContext() {
    const params = new URLSearchParams(window.location.search);
    const entityId = params.get('entity_id');
    const entityType = params.get('entity_type');
    return entityId ? { entityId, entityType: entityType || DEFAULT_CONTEXT.entityType } : null;
  }

  const storedContext = readStoredContext();
  const queryContext = readQueryContext();

  const context = {
    entityId: (queryContext && queryContext.entityId) || (storedContext && storedContext.entityId) || DEFAULT_CONTEXT.entityId,
    entityType: (queryContext && queryContext.entityType) || (storedContext && storedContext.entityType) || DEFAULT_CONTEXT.entityType
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
