const {
  mergeRestrictions,
  normalizeAllowedPages,
  normalizePageRestrictions,
  buildSavePayload
} = require('./page-permissions-registry');
const { buildCentralTenantEntityId } = require('./tenant-directory-sync');
const {
  sanitizeTenantAllowedPages,
  sanitizeTenantPageRestrictions,
  sanitizeTenantPermissionBundle
} = require('./tenant-page-access-policy');

async function ensureTenantPageAccessTable(db) {
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

async function getTenantPageRestrictions(db, tenantId) {
  if (!tenantId) return {};
  const result = await db.query(
    `SELECT settings FROM tenants WHERE id = $1 LIMIT 1`,
    [tenantId]
  );
  const settings = result.rows[0]?.settings || {};
  if (typeof settings === 'string') {
    try {
      return normalizePageRestrictions(JSON.parse(settings).page_restrictions);
    } catch (_) {
      return {};
    }
  }
  return normalizePageRestrictions(settings.page_restrictions);
}

async function setTenantPageRestrictions(client, tenantId, pageRestrictions) {
  if (!tenantId) return;
  const normalized = normalizePageRestrictions(pageRestrictions);
  await client.query(
    `
      UPDATE tenants
      SET settings = jsonb_set(
            COALESCE(settings, '{}'::jsonb),
            '{page_restrictions}',
            $2::jsonb,
            true
          ),
          updated_at = NOW()
      WHERE id = $1
    `,
    [tenantId, JSON.stringify(normalized)]
  );
}

async function getTenantAllowedPages(db, tenant) {
  if (!tenant?.id) return [];

  await ensureTenantPageAccessTable(db);
  const entityId = buildCentralTenantEntityId(tenant.id);

  const tenantPagesResult = await db.query(
    `SELECT page_key
     FROM tenant_page_access
     WHERE ($1::INTEGER IS NOT NULL AND tenant_id = $1)
        OR tenant_entity_id = $2
     ORDER BY page_key`,
    [tenant.id, entityId]
  );

  const tenantPages = tenantPagesResult.rows.map((row) => row.page_key);
  if (tenantPages.length > 0) {
    return normalizeAllowedPages(tenantPages);
  }

  await db.query(`
    CREATE TABLE IF NOT EXISTS account_type_sidebar_config (
      id SERIAL PRIMARY KEY,
      account_type VARCHAR(50) NOT NULL,
      page_key VARCHAR(120) NOT NULL,
      created_at TIMESTAMP DEFAULT NOW(),
      UNIQUE(account_type, page_key)
    )
  `);
  const typePagesResult = await db.query(
    `SELECT page_key
     FROM account_type_sidebar_config
     WHERE account_type = 'TENANT'
     ORDER BY page_key`
  );
  return normalizeAllowedPages(typePagesResult.rows.map((row) => row.page_key));
}

async function getTenantPermissionBundle(db, tenant) {
  const allowedPagesRaw = await getTenantAllowedPages(db, tenant);
  const allowedPages = sanitizeTenantAllowedPages(allowedPagesRaw);
  const storedRestrictions = tenant?.id
    ? await getTenantPageRestrictions(db, tenant.id)
    : {};
  const pageRestrictions = sanitizeTenantPageRestrictions(
    mergeRestrictions(storedRestrictions, allowedPagesRaw),
    allowedPages
  );
  return sanitizeTenantPermissionBundle({
    allowed_pages: allowedPages,
    page_restrictions: pageRestrictions
  });
}

async function saveTenantPermissionBundle(client, tenant, payload = {}) {
  const tenantId = tenant?.id;
  const normalizedEntityId = tenantId
    ? buildCentralTenantEntityId(tenantId)
    : tenant?.entity_id;
  const savePayload = buildSavePayload({
    pages: sanitizeTenantAllowedPages(payload.pages || []),
    pageRestrictions: sanitizeTenantPageRestrictions(
      payload.page_restrictions || payload.pageRestrictions || {},
      payload.pages || []
    )
  });

  await ensureTenantPageAccessTable(client);
  await client.query(
    `
      DELETE FROM tenant_page_access
      WHERE ($1::INTEGER IS NOT NULL AND tenant_id = $1)
         OR ($2::VARCHAR IS NOT NULL AND tenant_entity_id = $2)
    `,
    [tenantId, normalizedEntityId]
  );

  for (const pageKey of savePayload.pages) {
    if (tenantId) {
      await client.query(
        `
          INSERT INTO tenant_page_access (tenant_id, tenant_entity_id, page_key)
          VALUES ($1, $2, $3)
          ON CONFLICT (tenant_id, page_key) DO NOTHING
        `,
        [tenantId, normalizedEntityId || null, pageKey]
      );
    } else {
      await client.query(
        `
          INSERT INTO tenant_page_access (tenant_entity_id, page_key)
          VALUES ($1, $2)
          ON CONFLICT (tenant_entity_id, page_key) DO NOTHING
        `,
        [normalizedEntityId, pageKey]
      );
    }
  }

  if (tenantId) {
    await setTenantPageRestrictions(client, tenantId, savePayload.page_restrictions);
  }

  return savePayload;
}

module.exports = {
  ensureTenantPageAccessTable,
  getTenantAllowedPages,
  getTenantPageRestrictions,
  getTenantPermissionBundle,
  saveTenantPermissionBundle
};
