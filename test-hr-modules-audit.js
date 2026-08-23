#!/usr/bin/env node
const assert = require('assert');
const { listHrHomeModules, HR_MODULE_CATEGORIES } = require('./hr-home-modules');

const BASE = process.env.TEST_BASE_URL || 'http://127.0.0.1:3000';
const headers = { 'x-entity-type': 'HQ', 'x-entity-id': 'HQ001' };

const modules = listHrHomeModules();
assert.ok(modules.length >= 40, `expected 40+ HR modules, got ${modules.length}`);
assert.ok(HR_MODULE_CATEGORIES.includes('الكل'));
modules.forEach((item) => {
  assert.ok(item.href.startsWith('/hr/'), `bad href ${item.href}`);
  assert.ok(item.label, `missing label for ${item.key}`);
  assert.ok(item.icon.startsWith('fa-'), `bad icon for ${item.key}`);
  assert.ok(item.category, `missing category for ${item.key}`);
  assert.ok(!item.icon.includes('scanner-gun'), `invalid icon ${item.icon}`);
});

async function page(path) {
  const res = await fetch(`${BASE}${path}`, { headers });
  const html = await res.text();
  assert.ok(res.ok, `${path} status ${res.status}`);
  assert.ok(
    html.includes('hr-sidebar') || html.includes('hr-main') || html.includes('نايوش') || html.includes('hr-shell-active'),
    `${path} looks blocked`
  );
  return html;
}

async function main() {
  const api = await fetch(`${BASE}/api/hr/home-modules`, { headers }).then((r) => r.json());
  assert.strictEqual(api.success, true);
  assert.strictEqual(api.modules.length, modules.length);

  const bad = [];
  for (const item of modules) {
    try {
      await page(item.href);
    } catch (error) {
      bad.push({ href: item.href, error: error.message });
    }
  }
  assert.strictEqual(bad.length, 0, `broken routes: ${JSON.stringify(bad.slice(0, 5))}`);

  const home = await page('/hr');
  assert.ok(home.includes('hrHomeSearch') || home.includes('hr-cards'), 'HR home search UI missing');

  const dash = await fetch(`${BASE}/api/hr/manager-dashboard`, { headers }).then((r) => r.json());
  assert.ok(dash.pending, 'manager dashboard missing pending payload');

  console.log(`ok: ${modules.length} HR modules reachable, manager dashboard wired`);
}

main().catch((error) => {
  console.error('HR MODULES AUDIT FAILED:', error.message);
  process.exit(1);
});
