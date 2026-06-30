#!/usr/bin/env node

const assert = require('assert');

function resolveHrSectionPath(pathname = '') {
  const normalized = String(pathname || '').replace(/\/$/, '') || '/';
  const tenantMatch = normalized.match(/^\/t\/[a-z0-9][a-z0-9-]*(\/.*)?$/i);
  if (!tenantMatch) return normalized;
  const stripped = normalized.replace(/^\/t\/[a-z0-9][a-z0-9-]*/i, '') || '/';
  return stripped.replace(/\/$/, '') || '/';
}

assert.strictEqual(resolveHrSectionPath('/hr/e-archive'), '/hr/e-archive');
assert.strictEqual(resolveHrSectionPath('/t/mam/hr/e-archive'), '/hr/e-archive');
assert.strictEqual(resolveHrSectionPath('/t/mam/hr/e-archive/'), '/hr/e-archive');
assert.strictEqual(resolveHrSectionPath('/t/MAM/hr/e-archive'), '/hr/e-archive');
assert.strictEqual(resolveHrSectionPath('/t/mam'), '/');
assert.strictEqual(resolveHrSectionPath('/t/mam/archive'), '/archive');

const fs = require('fs');
const path = require('path');
const html = fs.readFileSync(path.join(__dirname, 'finance', 'hr-section.html'), 'utf8');
assert.match(html, /resolveHrSectionPath\(window\.location\.pathname\)/);

console.log('test-hr-section-tenant-path: ok');
