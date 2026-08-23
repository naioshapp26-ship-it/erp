#!/usr/bin/env node
const assert = require('assert');
const { getCatalogPublic, getItem, listItemKeys } = require('./hr-system-settings-catalog');
const { listOpsModules, getOpsModule } = require('./hr-ops-modules');
const { buildInitialWorkflow, getStagesForRequestType } = require('./hr-request-workflow');

const groups = getCatalogPublic();
assert.ok(groups.length >= 12, `expected 12+ settings groups, got ${groups.length}`);
assert.ok(groups.some((g) => g.items.some((i) => i.key === 'users')), 'users tile missing');
assert.ok(groups.some((g) => g.items.some((i) => i.key === 'fixed-system-components')), 'fixed HR components missing');
assert.ok(groups.some((g) => g.items.some((i) => i.key === 'overtime-settings')), 'attendance tiles missing');
assert.strictEqual(groups.find((g) => g.items.some((i) => i.key === 'employee-fields')).items.find((i) => i.key === 'employee-fields').isNew, true);

const keys = listItemKeys();
assert.ok(keys.length >= 80, `expected 80+ setting items, got ${keys.length}`);
assert.ok(getItem('fixed-system-components').seeds.length >= 110, 'expected 110+ fixed HR components');
keys.forEach((key) => {
  const item = getItem(key);
  assert.ok(item, `missing item ${key}`);
  assert.ok(item.fields.length >= 2, `fields missing for ${key}`);
  assert.ok(item.seeds.length >= 1, `seeds missing for ${key}`);
});

const ops = listOpsModules();
assert.ok(ops.find((m) => m.key === 'decisions'));
assert.ok(ops.find((m) => m.key === 'government-services'));
assert.ok(getOpsModule('letters').requestType === 'خطاب');

const leaveWf = buildInitialWorkflow('إجازة');
assert.strictEqual(leaveWf.current_stage, 'manager');
const letterWf = buildInitialWorkflow('خطاب');
assert.strictEqual(letterWf.current_stage, 'manager');
const advanceWf = buildInitialWorkflow('سلفة');
assert.strictEqual(advanceWf.current_stage, 'manager');
assert.ok(getStagesForRequestType('تدريب')[0] === 'manager');

console.log(`ok: ${keys.length} settings items, ${ops.length} ops modules, workflow starts at manager`);
