#!/usr/bin/env node

const assert = require('assert');
const { normalizeTenantAwareRequestPath } = require('./tenant-domain');
const { getPageKeysForPath, isPathAllowed } = require('./page-permissions-registry');

assert.strictEqual(
  normalizeTenantAwareRequestPath('/t/mam/finance/payment-terms.html'),
  '/finance/payment-terms.html'
);

const financeKeys = getPageKeysForPath('/t/mam/finance/payment-terms.html');
assert.ok(financeKeys.includes('finance__payment-terms'), 'tenant finance path should resolve to finance page key');

const ctx = {
  tenantType: 'TENANT',
  entityId: 'TENANT_1',
  allowedPages: ['dashboard', 'finance'],
  pageRestrictions: {
    finance: {
      restricted: true,
      pages: ['finance', 'finance__journal', 'finance__balance-sheet']
    }
  }
};

assert.strictEqual(isPathAllowed('/t/mam/finance/payment-terms.html', ctx), false);
assert.strictEqual(isPathAllowed('/t/mam/finance/journal.html', ctx), true);
assert.strictEqual(isPathAllowed('/finance/payment-terms.html', ctx), false);
assert.strictEqual(isPathAllowed('/finance/journal.html', ctx), true);

console.log('test-tenant-finance-permissions: ok');
