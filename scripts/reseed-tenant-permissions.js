#!/usr/bin/env node
'use strict';

require('../load-env');

const db = require('../db');
const { ensureDatabaseReady } = require('../database-bootstrap');
const {
  sanitizeAllActiveTenantPermissions,
  reseedTenantPageAccessForTenant
} = require('../tenant-page-access-policy');
const { getTenantPermissionBundle } = require('../tenant-page-permissions');

async function main() {
  await ensureDatabaseReady();

  const subdomain = String(process.argv[2] || '').trim().toLowerCase();
  const forcePlanDefaults = process.argv.includes('--force-plan');

  if (subdomain) {
    const tenantRes = await db.query(
      'SELECT * FROM tenants WHERE LOWER(subdomain) = $1 LIMIT 1',
      [subdomain]
    );
    const tenant = tenantRes.rows[0];
    if (!tenant) {
      console.error(`Tenant not found: ${subdomain}`);
      process.exit(1);
    }

    const existingBundle = await getTenantPermissionBundle(db, tenant);
    const result = await reseedTenantPageAccessForTenant(db, tenant, {
      existingBundle,
      preserveExisting: !forcePlanDefaults,
      forcePlanDefaults
    });

    console.log(JSON.stringify(result, null, 2));
    process.exit(0);
  }

  const reports = await sanitizeAllActiveTenantPermissions(db, { forcePlanDefaults });
  console.log(JSON.stringify(reports, null, 2));
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
