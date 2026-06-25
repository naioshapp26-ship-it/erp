#!/usr/bin/env node

const assert = require('assert');
const {
  resolveArchiveRoleKey,
  canPerformArchiveAction
} = require('./hr-archive-permissions');

assert.strictEqual(resolveArchiveRoleKey('مسؤول النظام'), 'admin');
assert.strictEqual(resolveArchiveRoleKey('tenant_admin'), 'admin');
assert.strictEqual(resolveArchiveRoleKey('SUPER_ADMIN'), 'admin');
assert.strictEqual(resolveArchiveRoleKey('HQ Admin'), 'admin');
assert.strictEqual(resolveArchiveRoleKey(encodeURIComponent('مسؤول النظام')), 'admin');
assert.strictEqual(resolveArchiveRoleKey('viewer'), 'viewer');

const reqWithArabicRole = {
  headers: {
    'x-user-role': 'مسؤول النظام',
    'x-user-name': 'مستخدم تجريبي'
  }
};
assert.strictEqual(
  canPerformArchiveAction(reqWithArabicRole, 'create', false),
  true,
  'Arabic admin role should allow create'
);

const reqWithUnknownRole = {
  headers: {
    'x-user-role': 'employee',
    Authorization: 'Bearer test-token'
  }
};
assert.strictEqual(
  canPerformArchiveAction(reqWithUnknownRole, 'create', true),
  true,
  'Authenticated users should be allowed to create archive records'
);

const reqViewerNoAuth = {
  headers: {
    'x-user-role': 'viewer'
  }
};
assert.strictEqual(
  canPerformArchiveAction(reqViewerNoAuth, 'create', false),
  false,
  'Viewer without auth should not create records'
);

console.log('test-e-archive-permissions: ok');
