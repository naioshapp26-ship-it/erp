'use strict';

const db = require('./db');
const { buildCentralTenantEntityId } = require('./tenant-directory-sync');
const {
  resolveTenantSafePagesForPlan,
  sanitizeTenantAllowedPages
} = require('./tenant-page-access-policy');

const DEFAULT_PAGES_BY_PLAN = {
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

const FALLBACK_TENANT_PAGES = ['dashboard', 'tenant-branding'];

async function ensureTenantPageAccessTable() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS tenant_page_access (
      id SERIAL PRIMARY KEY,
      tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
      tenant_entity_id VARCHAR(120),
      page_key VARCHAR(120) NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);
  await db.query(`ALTER TABLE tenant_page_access ALTER COLUMN tenant_id DROP NOT NULL`);
  await db.query(`ALTER TABLE tenant_page_access ADD COLUMN IF NOT EXISTS tenant_entity_id VARCHAR(120)`);
  await db.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS tenant_page_access_tenant_page_key_idx
    ON tenant_page_access (tenant_id, page_key)
  `);
  await db.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS tenant_page_access_entity_page_key_idx
    ON tenant_page_access (tenant_entity_id, page_key)
  `);
}

async function getConfiguredTenantTypePages() {
  const { getConfiguredTenantTypePages: readConfiguredPages } = require('./tenant-page-access-policy');
  return readConfiguredPages(db);
}

function resolvePagesForPlan(plan, configuredPages = []) {
  return resolveTenantSafePagesForPlan(plan, configuredPages);
}

async function seedTenantPageAccess(tenantId, plan = 'basic', options = {}) {
  const normalizedTenantId = Number.parseInt(tenantId, 10);
  if (!Number.isInteger(normalizedTenantId) || normalizedTenantId <= 0) {
    throw new Error(`معرّف المستأجر غير صالح: ${tenantId}`);
  }

  await ensureTenantPageAccessTable();

  const tenantRes = await db.query('SELECT * FROM tenants WHERE id = $1 LIMIT 1', [normalizedTenantId]);
  const tenant = tenantRes.rows[0];
  if (!tenant) {
    throw new Error('المستأجر غير موجود');
  }

  if (!options.force) {
    const existing = await db.query(
      `SELECT page_key
       FROM tenant_page_access
       WHERE tenant_id = $1`,
      [normalizedTenantId]
    );
    if (existing.rows.length > 0) {
      const { reseedTenantPageAccessForTenant } = require('./tenant-page-access-policy');
      const { getTenantPermissionBundle } = require('./tenant-page-permissions');
      const { getTenantPageRestrictions } = require('./tenant-page-permissions');
      const existingBundle = await getTenantPermissionBundle(db, tenant);
      const storedRestrictions = await getTenantPageRestrictions(db, tenant.id);
      const sanitizedPages = sanitizeTenantAllowedPages(existingBundle.allowed_pages);
      const hasCentralPages = sanitizedPages.length !== existingBundle.allowed_pages.length
        || existingBundle.allowed_pages.some((pageKey) => !sanitizedPages.includes(pageKey));
      const repairedRestrictions = sanitizeTenantPageRestrictions(storedRestrictions, sanitizedPages);
      const restrictionsNeedRepair = JSON.stringify(repairedRestrictions)
        !== JSON.stringify(storedRestrictions);

      if (!hasCentralPages && !restrictionsNeedRepair) {
        return { seeded: false, pages: existingBundle.allowed_pages };
      }

      const reseeded = await reseedTenantPageAccessForTenant(db, tenant, {
        existingBundle: {
          allowed_pages: sanitizedPages,
          page_restrictions: repairedRestrictions
        },
        preserveExisting: true
      });
      return { seeded: true, sanitized: true, pages: reseeded.pages };
    }
  }

  const { reseedTenantPageAccessForTenant } = require('./tenant-page-access-policy');
  const reseeded = await reseedTenantPageAccessForTenant(db, tenant, {
    forcePlanDefaults: Boolean(options.force)
  });
  return { seeded: true, pages: reseeded.pages };
}

async function seedTenantPageAccessFromSelection(tenantId, moduleSelection = {}) {
  const normalizedTenantId = Number.parseInt(tenantId, 10);
  if (!Number.isInteger(normalizedTenantId) || normalizedTenantId <= 0) {
    throw new Error(`معرّف المستأجر غير صالح: ${tenantId}`);
  }

  const tenantRes = await db.query('SELECT * FROM tenants WHERE id = $1 LIMIT 1', [normalizedTenantId]);
  const tenant = tenantRes.rows[0];
  if (!tenant) {
    throw new Error('المستأجر غير موجود');
  }

  const { saveTenantPermissionBundle } = require('./tenant-page-permissions');
  const { buildSavePayload } = require('./page-permissions-registry');
  const payload = buildSavePayload({
    pages: [...new Set(['dashboard', 'settings', ...(moduleSelection.pages || [])])],
    pageRestrictions: moduleSelection.page_restrictions || moduleSelection.pageRestrictions || {}
  });
  const saved = await saveTenantPermissionBundle(db, tenant, payload);
  return { seeded: true, pages: saved.pages, page_restrictions: saved.page_restrictions };
}

module.exports = {
  DEFAULT_PAGES_BY_PLAN,
  FALLBACK_TENANT_PAGES,
  ensureTenantPageAccessTable,
  getConfiguredTenantTypePages,
  seedTenantPageAccess,
  seedTenantPageAccessFromSelection,
  resolvePagesForPlan
};
