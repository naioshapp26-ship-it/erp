'use strict';

const assert = require('assert');
const { applyInbound, applyOutbound } = require('./finance/services/inventory-policy');

const results = [];
function check(name, fn) {
  try {
    fn();
    results.push({ name, ok: true });
    console.log('PASS', name);
  } catch (error) {
    results.push({ name, ok: false, detail: error.message });
    console.error('FAIL', name, error.message);
  }
}

check('opening-sets-average', () => {
  const next = applyInbound({ qty: 0, avgCost: 0 }, 10, 5);
  assert.strictEqual(next.ok, true);
  assert.strictEqual(next.qty, 10);
  assert.strictEqual(next.avgCost, 5);
});

check('weighted-average-inbound', () => {
  const next = applyInbound({ qty: 10, avgCost: 5 }, 10, 7);
  assert.strictEqual(next.ok, true);
  assert.strictEqual(next.qty, 20);
  assert.strictEqual(next.avgCost, 6);
});

check('outbound-keeps-average', () => {
  const next = applyOutbound({ qty: 20, avgCost: 6 }, 5);
  assert.strictEqual(next.ok, true);
  assert.strictEqual(next.qty, 15);
  assert.strictEqual(next.avgCost, 6);
  assert.strictEqual(next.appliedUnitCost, 6);
});

check('negative-stock-rejected', () => {
  const next = applyOutbound({ qty: 2, avgCost: 4 }, 3);
  assert.strictEqual(next.ok, false);
});

check('zero-quantity-rejected', () => {
  assert.strictEqual(applyInbound({ qty: 0, avgCost: 0 }, 0, 1).ok, false);
  assert.strictEqual(applyOutbound({ qty: 5, avgCost: 1 }, 0).ok, false);
});

check('negative-cost-rejected', () => {
  assert.strictEqual(applyInbound({ qty: 0, avgCost: 0 }, 1, -1).ok, false);
});

const failed = results.filter((row) => !row.ok);
console.log(`inventory-policy ${results.length - failed.length}/${results.length}`);
process.exit(failed.length ? 1 : 0);
