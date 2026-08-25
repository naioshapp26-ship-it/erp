#!/usr/bin/env node

const assert = require('assert');
const {
  TENANT_CORE_SYSTEM_PAGES,
  TENANT_SAFE_PAGES_BY_PLAN,
  ensureTenantCoreSystemPages
} = require('./tenant-page-access-policy');

assert.ok(TENANT_SAFE_PAGES_BY_PLAN.basic.includes('finance'), 'basic plan should include finance');
assert.ok(TENANT_SAFE_PAGES_BY_PLAN.basic.includes('records-archive-home'), 'basic plan should include archive home');
assert.deepStrictEqual(
  TENANT_CORE_SYSTEM_PAGES,
  ['hr', 'finance', 'records-archive-home'],
  'core system pages should match tenant landing sidebar'
);

assert.strictEqual(typeof ensureTenantCoreSystemPages, 'function');

console.log('test-tenant-core-system-pages: ok');
