#!/usr/bin/env node

/**
 * Simulates the /*.html fallback path that previously skipped hub filtering.
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { applyHubPermissionFilterToHtml } = require('./hub-permission-html');

const rootDir = __dirname;
const financeIndexPath = path.join(rootDir, 'finance', 'index.html');
const rawHtml = fs.readFileSync(financeIndexPath, 'utf8');

const req = {
  tenant: { id: 15, subdomain: 'mam' },
  tenantPermissionBundle: {
    allowed_pages: ['dashboard', 'finance', 'hr', 'records-archive-home'],
    page_restrictions: {
      finance: {
        restricted: true,
        pages: [
          'finance',
          'finance__balance-sheet',
          'finance__chart-of-accounts',
          'finance__journal',
          'finance__income-statement'
        ]
      }
    }
  }
};

// Before fix: /*.html called prepareHtmlPayload without req -> no filter
const unfiltered = applyHubPermissionFilterToHtml(rawHtml, financeIndexPath, null, rootDir);
const unfilteredLinks = (unfiltered.match(/id=["']finance-cards["'][\s\S]*?<\/div>/i)[0].match(/<a /g) || []).length;

// After fix: /*.html passes req -> filter applied in prepareHtmlPayload
const filtered = applyHubPermissionFilterToHtml(rawHtml, financeIndexPath, req, rootDir);
const filteredBlock = filtered.match(/id=["']finance-cards["'][\s\S]*?<\/div>/i)[0];
const filteredLinks = (filteredBlock.match(/<a /g) || []).length;

assert.ok(unfilteredLinks > 50, `baseline should have many links, got ${unfilteredLinks}`);
assert.ok(filteredLinks < unfilteredLinks, `filtered should have fewer links: ${filteredLinks} vs ${unfilteredLinks}`);
assert.strictEqual(filtered.includes('payment-terms'), false, 'payment-terms must be hidden');
assert.strictEqual(filtered.includes('/finance/journal.html'), true, 'journal must remain visible');

console.log(`test-html-fallback-hub-filter: ok (${unfilteredLinks} -> ${filteredLinks} links)`);
