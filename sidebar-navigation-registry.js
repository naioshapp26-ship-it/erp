(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }
  if (root) {
    root.SidebarNavigationRegistry = api;
  }
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  /**
   * Master sidebar navigation registry — client-approved IA (2026-10-17).
   * Display/order only. Routes, APIs, permissions, and page ownership unchanged.
   *
   * Open questions (flagged, not guessed):
   * - Portal name «مركز الخدمات والفعاليات» is proposed pending client lock-in.
   * - «التكامل الإداري المحكوم» is not on the client sketch → parked under strategic-management.
   * - «الاختبارات» mapped to existing specialized-courses until a dedicated tests module is confirmed.
   */

  const PROTECTED_NAV_IDS = new Set([
    'dashboard',
    'super-admin',
    'settings-admin',
    'saas',
    'operational-policies',
    'hierarchy'
  ]);

  const SIDEBAR_DEFAULT_ORDER = [
    'dashboard',
    'strategic-management',
    'smart-management',
    'incubators-platforms',
    'education-training-incubators',
    'naiosh-sectors',
    'super-admin',
    'operational-policies',
    'hierarchy',
    'saas',
    'payment-menu',
    'services-events-center',
    'services',
    'tasks-management',
    'settings',
    'settings-admin'
  ];

  const SIDEBAR_DEDUPE_FROM_TOP = [
    { id: 'hr', reason: 'via smart-management', accessVia: ['smart-management', '/hr'] },
    { id: 'finance', reason: 'via smart-management', accessVia: ['smart-management', '/finance'] },
    { id: 'archive', reason: 'via smart-management', accessVia: ['smart-management', '/archive'] },
    { id: 'supply-chain', reason: 'under incubators organization', accessVia: ['incubators-hub'] },
    { id: 'occupational-health', reason: 'under incubators organization', accessVia: ['incubators-hub'] },
    { id: 'facilities', reason: 'under incubators organization', accessVia: ['incubators-hub'] },
    { id: 'incubator', reason: 'under incubators organization', accessVia: ['incubators-hub'] },
    { id: 'internet-automation', reason: 'under naiosh-sectors', accessVia: ['naiosh-sectors'] },
    { id: 'sales', reason: 'under naiosh-sectors', accessVia: ['naiosh-sectors'] },
    { id: 'events-studio-main', reason: 'via services-events-center', accessVia: ['services-events-center'] },
    { id: 'marketing-campaigns-studio', reason: 'via services-events-center', accessVia: ['services-events-center'] },
    { id: 'requests', reason: 'via services-events-center', accessVia: ['services-events-center'] },
    { id: 'employee-menu', reason: 'via services-events-center', accessVia: ['services-events-center'] },
    { id: 'entities', reason: 'duplicate of strategic tenants', accessVia: ['tenants'] },
    { id: 'employees', reason: 'duplicate of strategic employee-management', accessVia: ['employee-management'] },
    { id: 'ads', reason: 'duplicate of strategic advertisers-center', accessVia: ['advertisers-center'] },
    { id: 'audit-logs', reason: 'duplicate of strategic system-log', accessVia: ['system-log'] },
    { id: 'my-page-analytics', reason: 'under services', accessVia: ['services'] },
    { id: 'tenant-branding', reason: 'under identity-settings', accessVia: ['identity-settings'] },
    {
      id: 'governed-administrative-integration',
      reason: 'not on client sketch — parked under strategic-management (pending review)',
      accessVia: ['strategic-management', '/governed-administrative-integration']
    }
  ];

  const INCUBATORS_RELATED_NAV = [
    { id: 'supply-chain', icon: 'fa-truck-loading', label: 'سلاسل التوريد' },
    { id: 'occupational-health', icon: 'fa-hard-hat', label: 'السلامة والصحة المهنية' },
    { id: 'facilities', icon: 'fa-building-gear', label: 'إدارة المرافق واللوجستيات' },
    { id: 'incubator', icon: 'fa-graduation-cap', label: 'حاضنة السلامة' },
    { id: 'eti-ohs', icon: 'fa-hard-hat', label: 'حاضنة السلامة والصحة المهنية' },
    { id: 'eti-supply-chain', icon: 'fa-truck-loading', label: 'حاضنة سلاسل الإمداد' },
    { id: 'eti-facilities', icon: 'fa-building', label: 'حضانة إدارة المرافق' },
    { id: 'eti-logistics', icon: 'fa-shipping-fast', label: 'حاضنة اللوجستيات والنقل' }
  ];

  const STRATEGIC_DEDUPE_SUB_IDS = new Set([
    'subscription-management',
    'tasks-strategic',
    'evaluation',
    'training-development'
  ]);

  const SETTINGS_SIDEBAR_KEY = 'company.sidebar.navigation';

  function isProtectedNavId(id) {
    return PROTECTED_NAV_IDS.has(String(id || ''));
  }

  function getDefaultSidebarOrder() {
    return SIDEBAR_DEFAULT_ORDER.slice();
  }

  function applySidebarCustomization(defaultItems, customization) {
    const items = Array.isArray(defaultItems) ? defaultItems.slice() : [];
    const byId = new Map(items.map((item) => [item.id, item]));
    const custom = customization && typeof customization === 'object' ? customization : {};
    const hidden = new Set(
      (Array.isArray(custom.hiddenIds) ? custom.hiddenIds : [])
        .map(String)
        .filter((id) => byId.has(id) && !isProtectedNavId(id))
    );
    const preferredOrder = Array.isArray(custom.orderIds) && custom.orderIds.length
      ? custom.orderIds.map(String)
      : getDefaultSidebarOrder();

    const ordered = [];
    const seen = new Set();
    preferredOrder.forEach((id) => {
      if (!byId.has(id) || seen.has(id) || hidden.has(id)) return;
      ordered.push(byId.get(id));
      seen.add(id);
    });
    items.forEach((item) => {
      if (seen.has(item.id) || hidden.has(item.id)) return;
      ordered.push(item);
      seen.add(item.id);
    });
    return ordered;
  }

  return {
    PROTECTED_NAV_IDS,
    SIDEBAR_DEFAULT_ORDER,
    SIDEBAR_DEDUPE_FROM_TOP,
    INCUBATORS_RELATED_NAV,
    STRATEGIC_DEDUPE_SUB_IDS,
    SETTINGS_SIDEBAR_KEY,
    isProtectedNavId,
    getDefaultSidebarOrder,
    applySidebarCustomization
  };
}));
