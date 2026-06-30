#!/usr/bin/env node

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {
  resolveProjectHtmlPath,
  isHubPermissionHtmlFile,
  applyHubPermissionFilterToHtml
} = require('./hub-permission-html');

const rootDir = __dirname;
const financeIndexPath = path.join(rootDir, 'finance', 'index.html');

assert.strictEqual(
  resolveProjectHtmlPath(rootDir, '/finance/index.html'),
  financeIndexPath
);

assert.strictEqual(isHubPermissionHtmlFile(rootDir, financeIndexPath), true);
assert.strictEqual(isHubPermissionHtmlFile(rootDir, path.join(rootDir, 'dashboard.html')), false);

const html = fs.readFileSync(financeIndexPath, 'utf8');
const tenant = { id: 15, subdomain: 'mam' };
const permissionBundle = {
  allowed_pages: ['dashboard', 'finance'],
  page_restrictions: {
    finance: {
      restricted: true,
      pages: ['finance', 'finance__journal', 'finance__balance-sheet']
    }
  }
};

const filtered = applyHubPermissionFilterToHtml(html, financeIndexPath, {
  tenant,
  tenantPermissionBundle: permissionBundle
}, rootDir);

const blockMatch = filtered.match(/id=["']finance-cards["'][\s\S]*?<\/div>/i);
assert.ok(blockMatch, 'finance-cards container should remain');
const linkCount = (blockMatch[0].match(/<a /g) || []).length;
assert.ok(linkCount < 10, `expected filtered finance hub links, got ${linkCount}`);
assert.strictEqual(filtered.includes('payment-terms'), false);

const unchanged = applyHubPermissionFilterToHtml(
  html,
  path.join(rootDir, 'dashboard.html'),
  { tenant, tenantPermissionBundle: permissionBundle },
  rootDir
);
assert.strictEqual(unchanged, html);

console.log('test-hub-permission-html: ok');
