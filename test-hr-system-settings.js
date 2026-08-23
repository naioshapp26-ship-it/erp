#!/usr/bin/env node
const assert = require('assert');
const { getCatalogPublic, getItem, listItemKeys } = require('./hr-system-settings-catalog');
const { listOpsModules, getOpsModule } = require('./hr-ops-modules');
const { buildInitialWorkflow, getStagesForRequestType } = require('./hr-request-workflow');

const groups = getCatalogPublic();
assert.strictEqual(groups.length, 8, 'expected 8 settings groups');
assert.strictEqual(groups[0].title, groups[0].title);
assert.ok(groups[0].title.includes('عامة'), groups[0].title);
assert.strictEqual(groups[0].items[0].key, 'users');
assert.strictEqual(groups[3].items.find((i) => i.key === 'employee-fields').isNew, true);

const keys = listItemKeys();
assert.ok(keys.length >= 40, `expected 40+ setting items, got ${keys.length}`);
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
