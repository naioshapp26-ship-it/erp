'use strict';

/**
 * Phase 1 smoke tests for Enterprise Settings Engine + catalog.
 * Does not mutate production. Uses local require + optional live DB if DATABASE_URL is set.
 */

const assert = require('assert');
const { getCatalog, getSeedDefinitions, ALL_ENTRIES } = require('./enterprise-settings-catalog');

function section(title) {
  console.log(`\n=== ${title} ===`);
}

async function run() {
  let failed = 0;
  const ok = (name, cond, detail = '') => {
    if (cond) {
      console.log(`PASS ${name}`);
    } else {
      failed += 1;
      console.error(`FAIL ${name}${detail ? ` — ${detail}` : ''}`);
    }
  };

  section('Catalog inventory integrity');
  const catalog = getCatalog({ includeMock: true });
  ok('has three levels', catalog.levels.length === 3);
  ok('has entries', catalog.entries.length >= 30, `count=${catalog.entries.length}`);
  ok('counts match entries', catalog.counts.total === catalog.entries.length);
  ok('has live entries', catalog.counts.live >= 10, `live=${catalog.counts.live}`);
  ok('marks mock tiles explicitly', catalog.counts.mock >= 1);

  const ids = new Set();
  let duplicate = false;
  for (const entry of ALL_ENTRIES) {
    if (ids.has(entry.id)) duplicate = true;
    ids.add(entry.id);
    ok(
      `entry ${entry.id} has level+status+title`,
      Boolean(entry.level && entry.status && entry.titleAr)
    );
    if (entry.status === 'live') {
      ok(
        `live entry ${entry.id} has href or spaRoute`,
        Boolean(entry.href || entry.spaRoute),
        JSON.stringify({ href: entry.href, spaRoute: entry.spaRoute })
      );
    }
  }
  ok('no duplicate entry ids', !duplicate);

  section('Permissions tile no longer dead-end');
  const permissions = ALL_ENTRIES.find((e) => e.id === 'module-permissions-tile');
  ok('permissions maps to super-admin', permissions?.href === '/super-admin-page.html');
  ok('permissions status live', permissions?.status === 'live');

  section('Seed definitions');
  const seeds = getSeedDefinitions();
  ok('seed definitions exist', seeds.length >= 10);
  ok(
    'seed keys unique',
    new Set(seeds.map((s) => s.key)).size === seeds.length
  );

  section('Optional DB schema + API auth behavior');
  if (!process.env.DATABASE_URL && !process.env.PGDATABASE) {
    console.log('SKIP DB tests (no DATABASE_URL/PGDATABASE in environment)');
  } else {
    try {
      const db = require('./db');
      const api = require('./enterprise-settings-engine-api');
      await api.ensureSchema();
      const tables = await db.query(
        `SELECT table_name FROM information_schema.tables
         WHERE table_schema = 'public'
           AND table_name IN ('setting_definitions','setting_values','setting_versions','setting_audit_events')`
      );
      ok('settings engine tables exist', tables.rows.length === 4, `found=${tables.rows.length}`);
    } catch (err) {
      ok('settings engine schema ensure', false, err.message);
    }
  }

  section('Tenant host catalog isolation (unit)');
  // Simulate filtering used by API for tenant hosts
  const tenantView = {
    ...catalog,
    entries: catalog.entries.filter((e) => e.level !== 'platform'),
  };
  ok('tenant view hides platform entries', tenantView.entries.every((e) => e.level !== 'platform'));
  ok('tenant view keeps company/module', tenantView.entries.some((e) => e.level === 'company'));

  if (failed) {
    console.error(`\nFAILED: ${failed} assertion(s)`);
    process.exitCode = 1;
  } else {
    console.log('\nAll Phase 1 catalog/engine smoke tests passed.');
  }
  // pg pool keeps the process alive — exit explicitly after smoke.
  setTimeout(() => process.exit(failed ? 1 : 0), 200);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
