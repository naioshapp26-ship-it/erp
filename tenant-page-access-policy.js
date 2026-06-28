'use strict';

const { buildCentralTenantEntityId } = require('./tenant-directory-sync');
const {
  normalizeAllowedPages,
  normalizePageRestrictions,
  normalizePageKey,
  getPagesForSystem,
  getRuntimeRouteParents
} = require('./page-permissions-registry');

const CENTRAL_ONLY_TENANT_PAGE_KEYS = new Set([
  'hierarchy',
  'entities',
  'saas',
  'billing',
  'tenants',
  'register-tenant',
  'e-offices',
  'platforms',
  'branches-hub',
  'incubators-hub',
  'education-training-incubators',
  'naiosh-sectors',
  'settings',
  'strategic-management',
  'supply-chain',
  'sales',
  'internet-automation',
  'occupational-health',
  'quality-audit',
  'marketing'
]);

const TENANT_SAFE_PAGES_BY_PLAN = {
  basic: [
    'dashboard',
    'tasks-management',
    'requests',
    'hr',
    'employees',
    'tenant-branding'
  ],
  pro: [
    'dashboard',
    'tasks-management',
    'requests',
    'hr',
    'employees',
    'finance',
    'ads',
    'facilities',
    'audit-logs',
    'incubator',
    'tenant-branding'
  ],
  enterprise: [
    'dashboard',
    'tasks-management',
    'requests',
    'hr',
    'employees',
    'finance',
    'ads',
    'facilities',
    'audit-logs',
    'incubator',
    'records-archive-home',
    'events-studio-main',
    'marketing-campaigns-studio',
    'operational-policies',
    'tenant-branding'
  ]
};

const FALLBACK_TENANT_SAFE_PAGES = ['dashboard', 'tenant-branding'];

function isCentralOnlyTenantPage(pageKey) {
  return CENTRAL_ONLY_TENANT_PAGE_KEYS.has(String(pageKey || '').trim());
}

function sanitizeTenantAllowedPages(pages) {
  const normalized = normalizeAllowedPages(pages);
  const filtered = normalized.filter((pageKey) => !isCentralOnlyTenantPage(pageKey));
  if (!filtered.includes('dashboard')) {
    filtered.unshift('dashboard');
  }
  return [...new Set(filtered)];
}

function normalizeRestrictionPages(pages) {
  if (!Array.isArray(pages)) return [];
  return [...new Set(pages.map((pageKey) => normalizePageKey(pageKey)).filter(Boolean))];
}

function isAllowedTenantRestrictionPage(systemKey, pageKey, safeAllowed) {
  if (pageKey === systemKey) {
    return safeAllowed.has(systemKey);
  }
  if (safeAllowed.has(pageKey)) {
    return true;
  }
  if (isCentralOnlyTenantPage(pageKey)) {
    return false;
  }
  if (!safeAllowed.has(systemKey)) {
    return false;
  }
  if (pageKey.startsWith(`${systemKey}__`)) {
    return true;
  }
  const routeParents = getRuntimeRouteParents();
  return routeParents[pageKey] === systemKey;
}

function expandIncompleteParentOnlyRestrictions(pageRestrictions, allowedPages = []) {
  const output = { ...pageRestrictions };
  const safeAllowed = new Set(sanitizeTenantAllowedPages(allowedPages));

  Object.entries(output).forEach(([systemKey, value]) => {
    if (!safeAllowed.has(systemKey) || !value?.restricted) {
      return;
    }
    const systemPages = getPagesForSystem(systemKey).map((page) => page.key);
    const uniqueSystemPages = [...new Set(systemPages)];
    const selected = normalizeRestrictionPages(value.pages || []);
    const uniqueSelected = [...new Set(selected)];
    const selectedChildren = uniqueSelected.filter((pageKey) => pageKey !== systemKey);
    const childKeys = uniqueSystemPages.filter((pageKey) => pageKey !== systemKey);
    const selectedParentOnly = uniqueSelected.length > 0
      && uniqueSelected.every((pageKey) => pageKey === systemKey);

    if (uniqueSelected.length >= uniqueSystemPages.length) {
      delete output[systemKey];
      return;
    }

    if (childKeys.length > 0 && selectedParentOnly) {
      delete output[systemKey];
      return;
    }

    if (childKeys.length > 0 && selectedChildren.length >= childKeys.length) {
      delete output[systemKey];
      return;
    }

    if (childKeys.length > 0 && selectedChildren.length > 0 && selectedChildren.length < childKeys.length) {
      output[systemKey] = {
        restricted: true,
        pages: [...new Set([systemKey, ...selectedChildren])]
      };
    }
  });

  return output;
}

function sanitizeTenantPageRestrictions(pageRestrictions, allowedPages = []) {
  const normalized = normalizePageRestrictions(pageRestrictions);
  const safeAllowed = new Set(sanitizeTenantAllowedPages(allowedPages));
  const output = {};

  Object.entries(normalized).forEach(([systemKey, value]) => {
    if (isCentralOnlyTenantPage(systemKey) || !safeAllowed.has(systemKey)) {
      return;
    }

    const pages = normalizeRestrictionPages(value?.pages || [])
      .filter((pageKey) => isAllowedTenantRestrictionPage(systemKey, pageKey, safeAllowed));

    if (!pages.length) {
      return;
    }

    output[systemKey] = {
      restricted: Boolean(value?.restricted),
      pages: pages.includes(systemKey) ? pages : [systemKey, ...pages]
    };
  });

  return expandIncompleteParentOnlyRestrictions(output, allowedPages);
}

function sanitizeTenantPermissionBundle(bundle = {}) {
  const allowedPages = sanitizeTenantAllowedPages(bundle.allowed_pages || bundle.allowedPages || []);
  const pageRestrictions = sanitizeTenantPageRestrictions(
    bundle.page_restrictions || bundle.pageRestrictions || {},
    allowedPages
  );

  return {
    allowed_pages: allowedPages,
    allowedPages,
    page_restrictions: pageRestrictions,
    pageRestrictions
  };
}

function resolveTenantSafePagesForPlan(plan, configuredPages = []) {
  const configuredSafe = sanitizeTenantAllowedPages(configuredPages);
  if (configuredSafe.length > 0) {
    return configuredSafe;
  }

  const normalizedPlan = String(plan || 'basic').trim().toLowerCase();
  return TENANT_SAFE_PAGES_BY_PLAN[normalizedPlan] || FALLBACK_TENANT_SAFE_PAGES;
}

async function getConfiguredTenantTypePages(db) {
  await db.query(`
    CREATE TABLE IF NOT EXISTS account_type_sidebar_config (
      id SERIAL PRIMARY KEY,
      account_type VARCHAR(50) NOT NULL,
      page_key VARCHAR(120) NOT NULL,
      created_at TIMESTAMP DEFAULT NOW(),
      UNIQUE(account_type, page_key)
    )
  `);

  const result = await db.query(
    `SELECT page_key
     FROM account_type_sidebar_config
     WHERE account_type = 'TENANT'
     ORDER BY page_key`
  );
  return result.rows.map((row) => row.page_key);
}

async function reseedTenantPageAccessForTenant(db, tenant, options = {}) {
  const tenantId = Number.parseInt(tenant?.id, 10);
  if (!Number.isInteger(tenantId) || tenantId <= 0) {
    throw new Error(`معرّف المستأجر غير صالح: ${tenant?.id}`);
  }

  const { saveTenantPermissionBundle } = require('./tenant-page-permissions');

  const configuredPages = await getConfiguredTenantTypePages(db);
  const plan = tenant.subscription_plan
    || (typeof tenant.settings === 'string'
      ? (() => {
        try {
          return JSON.parse(tenant.settings).plan;
        } catch (_) {
          return null;
        }
      })()
      : tenant.settings?.plan)
    || 'basic';

  const existingBundle = options.existingBundle || null;
  let targetPages;

  if (options.preserveExisting !== false && existingBundle?.allowed_pages?.length) {
    targetPages = sanitizeTenantAllowedPages(existingBundle.allowed_pages);
  } else {
    targetPages = resolveTenantSafePagesForPlan(plan, configuredPages);
  }

  if (options.forcePlanDefaults) {
    targetPages = resolveTenantSafePagesForPlan(plan, configuredPages);
  }

  const targetRestrictions = sanitizeTenantPageRestrictions(
    existingBundle?.page_restrictions || {},
    targetPages
  );

  const previousPages = sanitizeTenantAllowedPages(existingBundle?.allowed_pages || []);
  const previousRestrictions = sanitizeTenantPageRestrictions(
    existingBundle?.page_restrictions || {},
    previousPages
  );
  const pagesChanged = JSON.stringify([...targetPages].sort())
    !== JSON.stringify([...previousPages].sort());
  const restrictionsChanged = JSON.stringify(targetRestrictions)
    !== JSON.stringify(previousRestrictions);

  if (!pagesChanged && !restrictionsChanged) {
    return {
      changed: false,
      tenant_id: tenantId,
      tenant_entity_id: buildCentralTenantEntityId(tenantId),
      subdomain: tenant.subdomain,
      plan,
      pages: previousPages,
      page_restrictions: previousRestrictions,
      removed_pages: []
    };
  }

  const saved = await saveTenantPermissionBundle(db, tenant, {
    pages: targetPages,
    page_restrictions: targetRestrictions
  });

  const removedPages = (existingBundle?.allowed_pages || []).filter((pageKey) => !saved.pages.includes(pageKey));

  return {
    changed: removedPages.length > 0
      || saved.pages.length !== (existingBundle?.allowed_pages || []).length,
    tenant_id: tenantId,
    tenant_entity_id: buildCentralTenantEntityId(tenantId),
    subdomain: tenant.subdomain,
    plan,
    pages: saved.pages,
    page_restrictions: saved.page_restrictions,
    removed_pages: removedPages
  };
}

async function sanitizeAllActiveTenantPermissions(db, options = {}) {
  const result = await db.query(
    `SELECT *
     FROM tenants
     WHERE status = 'active'
     ORDER BY id ASC`
  );

  const { getTenantPermissionBundle } = require('./tenant-page-permissions');
  const reports = [];

  for (const tenant of result.rows) {
    try {
      const existingBundle = await getTenantPermissionBundle(db, tenant);
      const beforePages = [...(existingBundle.allowed_pages || [])];
      const reseeded = await reseedTenantPageAccessForTenant(db, tenant, {
        existingBundle,
        preserveExisting: !options.forcePlanDefaults,
        forcePlanDefaults: Boolean(options.forcePlanDefaults)
      });
      reports.push({
        subdomain: tenant.subdomain,
        tenant_id: tenant.id,
        changed: reseeded.changed,
        before_count: beforePages.length,
        after_count: reseeded.pages.length,
        removed_pages: reseeded.removed_pages || [],
        pages: reseeded.pages
      });
    } catch (error) {
      reports.push({
        subdomain: tenant.subdomain,
        tenant_id: tenant.id,
        error: error.message
      });
    }
  }

  return reports;
}

module.exports = {
  CENTRAL_ONLY_TENANT_PAGE_KEYS,
  TENANT_SAFE_PAGES_BY_PLAN,
  isCentralOnlyTenantPage,
  sanitizeTenantAllowedPages,
  sanitizeTenantPageRestrictions,
  sanitizeTenantPermissionBundle,
  resolveTenantSafePagesForPlan,
  getConfiguredTenantTypePages,
  reseedTenantPageAccessForTenant,
  sanitizeAllActiveTenantPermissions
};
