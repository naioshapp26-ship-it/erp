'use strict';

const db = require('./db');
const { buildCentralTenantEntityId } = require('./tenant-directory-sync');

const DEFAULT_PAGES_BY_PLAN = {
  basic: [
    'dashboard',
    'settings',
    'tasks-management',
    'requests',
    'hr',
    'employees'
  ],
  pro: [
    'dashboard',
    'settings',
    'tasks-management',
    'requests',
    'hr',
    'employees',
    'finance',
    'ads',
    'facilities',
    'audit-logs',
    'incubator'
  ],
  enterprise: [
    'dashboard',
    'settings',
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
    'strategic-management',
    'events-studio-main',
    'operational-policies',
    'e-offices'
  ]
};

const FALLBACK_TENANT_PAGES = ['dashboard', 'settings'];

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

function resolvePagesForPlan(plan, configuredPages = []) {
  if (configuredPages.length > 0) {
    return configuredPages;
  }

  const normalizedPlan = String(plan || 'basic').trim().toLowerCase();
  return DEFAULT_PAGES_BY_PLAN[normalizedPlan] || FALLBACK_TENANT_PAGES;
}

async function seedTenantPageAccess(tenantId, plan = 'basic', options = {}) {
  const normalizedTenantId = Number.parseInt(tenantId, 10);
  if (!Number.isInteger(normalizedTenantId) || normalizedTenantId <= 0) {
    throw new Error(`معرّف المستأجر غير صالح: ${tenantId}`);
  }

  await ensureTenantPageAccessTable();

  if (!options.force) {
    const existing = await db.query(
      `SELECT COUNT(*)::int AS total
       FROM tenant_page_access
       WHERE tenant_id = $1`,
      [normalizedTenantId]
    );
    if ((existing.rows[0]?.total || 0) > 0) {
      return { seeded: false, pages: [] };
    }
  }

  const configuredPages = await getConfiguredTenantTypePages();
  const pages = resolvePagesForPlan(plan, configuredPages);
  const entityId = buildCentralTenantEntityId(normalizedTenantId);

  for (const pageKey of pages) {
    await db.query(
      `INSERT INTO tenant_page_access (tenant_id, tenant_entity_id, page_key)
       VALUES ($1, $2, $3)
       ON CONFLICT (tenant_id, page_key) DO NOTHING`,
      [normalizedTenantId, entityId, pageKey]
    );
  }

  return { seeded: true, pages };
}

module.exports = {
  DEFAULT_PAGES_BY_PLAN,
  FALLBACK_TENANT_PAGES,
  ensureTenantPageAccessTable,
  seedTenantPageAccess,
  resolvePagesForPlan
};
