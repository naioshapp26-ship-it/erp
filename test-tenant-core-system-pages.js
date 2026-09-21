#!/usr/bin/env node

const assert = require('assert');
const {
  TENANT_CORE_SYSTEM_PAGES,
  TENANT_SAFE_PAGES_BY_PLAN,
  ensureTenantCoreSystemPages
} = require('./tenant-page-access-policy');

assert.ok(TENANT_SAFE_PAGES_BY_PLAN.basic.includes('finance'), 'basic plan should include finance');
assert.ok(TENANT_SAFE_PAGES_BY_PLAN.basic.includes('records-archive-home'), 'basic plan catalog may include archive');
assert.deepStrictEqual(
  TENANT_CORE_SYSTEM_PAGES,
  ['hr', 'finance', 'records-archive-home'],
  'core system catalog remains available for signup selection'
);

assert.strictEqual(typeof ensureTenantCoreSystemPages, 'function');

// ensureTenantCoreSystemPages must NOT mutate permissions (no-op / skipped).
ensureTenantCoreSystemPages({
  query: async () => ({ rows: [{ subdomain: 'tast' }, { subdomain: 'mam' }] })
}).then((reports) => {
  assert.ok(Array.isArray(reports));
  assert.ok(reports.every((report) => report.changed === false && report.skipped === true));
  console.log('test-tenant-core-system-pages: ok');
}).catch((error) => {
  console.error(error);
  process.exit(1);
});
