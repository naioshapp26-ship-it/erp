/**
 * Restore organizational hierarchy catalog into relational tables.
 * Data source: hierarchy-catalog.json (extracted from NaioshERP.sql).
 *
 * When incubators/platforms fall below thresholds (e.g. after a wipe or
 * bootstrap-only deploy), re-seed branches + 100 incubators + 95 platforms
 * + sample offices so الهيكل الهرمي shows the full tree again.
 */
const fs = require('fs');
const path = require('path');

const CATALOG_PATH = path.join(__dirname, 'hierarchy-catalog.json');
const MIN_INCUBATORS = 50;
const MIN_PLATFORMS = 40;
const MIN_BRANCHES = 5;
const OFFICES_PER_BRANCH_INCUBATORS = 10; // 4 office templates × first 10 incubators

function loadCatalog() {
  if (!fs.existsSync(CATALOG_PATH)) {
    throw new Error(`Missing hierarchy catalog: ${CATALOG_PATH}`);
  }
  return JSON.parse(fs.readFileSync(CATALOG_PATH, 'utf8'));
}

async function tableCount(db, tableName) {
  const result = await db.query(`SELECT COUNT(*)::int AS c FROM ${tableName}`);
  return Number(result.rows[0]?.c || 0);
}

async function ensureHeadquarters(db) {
  await db.query(`
    INSERT INTO headquarters (name, code, description, country, contact_email, entity_id)
    VALUES ('NAIOSH HQ', 'HQ-001', 'المقر الرئيسي لنظام نايوش', 'Saudi Arabia', 'hq@naiosh.com', 'HQ001')
    ON CONFLICT (code) DO UPDATE
      SET is_active = true,
          name = EXCLUDED.name,
          entity_id = COALESCE(headquarters.entity_id, EXCLUDED.entity_id)
  `);
  const hq = await db.query(`SELECT id FROM headquarters WHERE code = 'HQ-001' LIMIT 1`);
  return hq.rows[0]?.id;
}

async function ensureBranches(db, hqId, branches) {
  let created = 0;
  for (const branch of branches) {
    const code = String(branch.code || '').trim();
    const name = String(branch.name || '').trim();
    if (!code || !name) continue;
    const result = await db.query(
      `
      INSERT INTO branches (hq_id, name, code, country, city, contact_email, is_active)
      VALUES ($1, $2, $3, $4, $5, $6, true)
      ON CONFLICT (hq_id, code) DO UPDATE
        SET name = EXCLUDED.name,
            country = COALESCE(EXCLUDED.country, branches.country),
            city = COALESCE(EXCLUDED.city, branches.city),
            is_active = true
      RETURNING (xmax = 0) AS inserted
      `,
      [
        hqId,
        name,
        code,
        branch.country || name,
        branch.city || branch.country || name,
        `${code.toLowerCase().replace(/[^a-z0-9]+/g, '')}@naiosh.com`,
      ]
    );
    if (result.rows[0]?.inserted) created += 1;
  }

  // Keep bootstrap SA/EG aliases if present
  await db.query(`
    INSERT INTO branches (hq_id, name, code, country, city, contact_email, is_active)
    SELECT $1, 'فرع المملكة العربية السعودية', 'BR-SA', 'Saudi Arabia', 'Riyadh', 'sa@naiosh.com', true
    WHERE NOT EXISTS (SELECT 1 FROM branches WHERE code = 'BR-SA')
  `, [hqId]);
  await db.query(`
    INSERT INTO branches (hq_id, name, code, country, city, contact_email, is_active)
    SELECT $1, 'فرع جمهورية مصر العربية', 'BR-EG', 'Egypt', 'Cairo', 'eg@naiosh.com', true
    WHERE NOT EXISTS (SELECT 1 FROM branches WHERE code = 'BR-EG')
  `, [hqId]);

  return created;
}

async function ensureIncubatorsForBranch(db, branch, incubators) {
  const rows = [];
  const entityRows = [];
  for (const item of incubators) {
    const num = String(item.code_suffix || item.num || '').padStart(3, '0');
    const code = `INC-${branch.code}-${num}`.replace(/\s+/g, '');
    const name = String(item.name || '').trim();
    if (!name) continue;
    rows.push([branch.id, name, code, `${name} — ${branch.name}`, 'MIXED', 100, true]);
    entityRows.push([`INC-${branch.id}-${num}`, name, 'INCUBATOR', 'Active', branch.name, 'PRO', 'red']);
  }
  if (!rows.length) return 0;

  const values = [];
  const params = [];
  rows.forEach((row, idx) => {
    const base = idx * 7;
    values.push(`($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7})`);
    params.push(...row);
  });
  const before = await db.query(
    `SELECT COUNT(*)::int AS c FROM incubators WHERE branch_id = $1`,
    [branch.id]
  );
  await db.query(
    `
    INSERT INTO incubators (branch_id, name, code, description, program_type, capacity, is_active)
    VALUES ${values.join(',')}
    ON CONFLICT (branch_id, code) DO UPDATE
      SET name = EXCLUDED.name,
          is_active = true,
          description = COALESCE(incubators.description, EXCLUDED.description)
    `,
    params
  );

  const entityValues = [];
  const entityParams = [];
  entityRows.forEach((row, idx) => {
    const base = idx * 7;
    entityValues.push(`($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7})`);
    entityParams.push(...row);
  });
  await db.query(
    `
    INSERT INTO entities (id, name, type, status, location, plan, theme)
    VALUES ${entityValues.join(',')}
    ON CONFLICT (id) DO UPDATE
      SET name = EXCLUDED.name,
          status = 'Active',
          location = EXCLUDED.location
    `,
    entityParams
  );

  const after = await db.query(
    `SELECT COUNT(*)::int AS c FROM incubators WHERE branch_id = $1`,
    [branch.id]
  );
  return Math.max(0, after.rows[0].c - before.rows[0].c);
}

async function ensurePlatformsForBranch(db, branch, platforms) {
  const hostInc = await db.query(
    `
    SELECT id FROM incubators
    WHERE branch_id = $1 AND is_active = true
    ORDER BY id
    LIMIT 1
    `,
    [branch.id]
  );
  const incubatorId = hostInc.rows[0]?.id;
  if (!incubatorId) return 0;

  const rows = [];
  const entityRows = [];
  for (const item of platforms) {
    const num = String(item.code_suffix || item.num || '').padStart(3, '0');
    const code = `PLT-${branch.code}-${num}`.replace(/\s+/g, '');
    const name = String(item.name || '').trim();
    if (!name) continue;
    rows.push([
      incubatorId,
      name,
      code,
      `${name} — ${branch.name}`,
      item.platform_type || 'GENERAL',
      'اشتراك شهري',
      99.99,
      'SAR',
      true,
    ]);
    entityRows.push([`PLT-${branch.id}-${num}`, name, 'PLATFORM', 'Active', branch.name, 'PRO', 'blue']);
  }
  if (!rows.length) return 0;

  const before = await db.query(
    `SELECT COUNT(*)::int AS c FROM platforms WHERE incubator_id = $1`,
    [incubatorId]
  );

  const values = [];
  const params = [];
  rows.forEach((row, idx) => {
    const base = idx * 9;
    values.push(`($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7}, $${base + 8}, $${base + 9})`);
    params.push(...row);
  });
  await db.query(
    `
    INSERT INTO platforms (
      incubator_id, name, code, description, platform_type,
      pricing_model, base_price, currency, is_active
    )
    VALUES ${values.join(',')}
    ON CONFLICT (incubator_id, code) DO UPDATE
      SET name = EXCLUDED.name,
          is_active = true,
          platform_type = COALESCE(EXCLUDED.platform_type, platforms.platform_type)
    `,
    params
  );

  const entityValues = [];
  const entityParams = [];
  entityRows.forEach((row, idx) => {
    const base = idx * 7;
    entityValues.push(`($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7})`);
    entityParams.push(...row);
  });
  await db.query(
    `
    INSERT INTO entities (id, name, type, status, location, plan, theme)
    VALUES ${entityValues.join(',')}
    ON CONFLICT (id) DO UPDATE
      SET name = EXCLUDED.name,
          status = 'Active',
          location = EXCLUDED.location
    `,
    entityParams
  );

  const after = await db.query(
    `SELECT COUNT(*)::int AS c FROM platforms WHERE incubator_id = $1`,
    [incubatorId]
  );
  return Math.max(0, after.rows[0].c - before.rows[0].c);
}

async function ensureOfficesForBranch(db, branch) {
  const incubators = await db.query(
    `
    SELECT id, name, code FROM incubators
    WHERE branch_id = $1 AND is_active = true
    ORDER BY id
    LIMIT $2
    `,
    [branch.id, OFFICES_PER_BRANCH_INCUBATORS]
  );
  const templates = loadCatalog().officeTemplates || [];
  let created = 0;

  for (const incubator of incubators.rows) {
    for (const tpl of templates) {
      const code = `OFF-${incubator.id}-${tpl.code_suffix}`;
      const name = `${tpl.name} - ${incubator.name}`;
      const result = await db.query(
        `
        INSERT INTO offices (
          incubator_id, name, code, description, office_type, capacity, is_active
        )
        VALUES ($1, $2, $3, $4, $5, $6, true)
        ON CONFLICT (incubator_id, code) DO UPDATE
          SET name = EXCLUDED.name,
              is_active = true
        RETURNING (xmax = 0) AS inserted
        `,
        [
          incubator.id,
          name,
          code,
          tpl.name,
          tpl.office_type || 'Shared',
          tpl.capacity || 10,
        ]
      );
      if (result.rows[0]?.inserted) created += 1;

      await db.query(
        `
        INSERT INTO entities (id, name, type, status, location, plan, theme)
        VALUES ($1, $2, 'OFFICE', 'Active', $3, 'BASIC', 'BLUE')
        ON CONFLICT (id) DO UPDATE
          SET name = EXCLUDED.name,
              status = 'Active'
        `,
        [code, name, branch.name]
      );
    }
  }
  return created;
}

async function syncBranchEntities(db) {
  await db.query(`
    INSERT INTO entities (id, name, type, status, location, plan, theme)
    SELECT
      COALESCE(NULLIF(b.entity_id, ''), b.code) AS id,
      b.name,
      'BRANCH',
      CASE WHEN b.is_active THEN 'Active' ELSE 'Inactive' END,
      COALESCE(b.city, b.country, b.name),
      'BASIC',
      'BLUE'
    FROM branches b
    ON CONFLICT (id) DO UPDATE
      SET name = EXCLUDED.name,
          status = EXCLUDED.status,
          location = EXCLUDED.location
  `);
}

/**
 * @param {import('./db')} db
 * @param {{ force?: boolean }} [options]
 */
async function ensureHierarchyCatalog(db, options = {}) {
  const force = Boolean(options.force) || process.env.RESTORE_HIERARCHY_CATALOG === 'true';
  const [branchCount, incubatorCount, platformCount, officeCount] = await Promise.all([
    tableCount(db, 'branches'),
    tableCount(db, 'incubators'),
    tableCount(db, 'platforms'),
    tableCount(db, 'offices'),
  ]);

  const needsRestore =
    force ||
    branchCount < MIN_BRANCHES ||
    incubatorCount < MIN_INCUBATORS ||
    platformCount < MIN_PLATFORMS;

  if (!needsRestore) {
    console.log(
      `✅ Hierarchy catalog OK (branches=${branchCount}, incubators=${incubatorCount}, platforms=${platformCount}, offices=${officeCount})`
    );
    return {
      restored: false,
      branchCount,
      incubatorCount,
      platformCount,
      officeCount,
    };
  }

  console.log(
    `🔄 Restoring hierarchy catalog (branches=${branchCount}, incubators=${incubatorCount}, platforms=${platformCount}, offices=${officeCount})...`
  );

  const catalog = loadCatalog();
  const hqId = await ensureHeadquarters(db);
  if (!hqId) throw new Error('Could not resolve headquarters HQ-001');

  const branchesCreated = await ensureBranches(db, hqId, catalog.branches || []);
  await syncBranchEntities(db);

  const branchRows = await db.query(
    `SELECT id, name, code FROM branches WHERE is_active = true ORDER BY id`
  );

  let incubatorsCreated = 0;
  let platformsCreated = 0;
  let officesCreated = 0;

  for (const branch of branchRows.rows) {
    incubatorsCreated += await ensureIncubatorsForBranch(db, branch, catalog.incubators || []);
    platformsCreated += await ensurePlatformsForBranch(db, branch, catalog.platforms || []);
    officesCreated += await ensureOfficesForBranch(db, branch);
  }

  const after = {
    branches: await tableCount(db, 'branches'),
    incubators: await tableCount(db, 'incubators'),
    platforms: await tableCount(db, 'platforms'),
    offices: await tableCount(db, 'offices'),
  };

  console.log(
    `✅ Hierarchy catalog restored: +${branchesCreated} branches, +${incubatorsCreated} incubators, +${platformsCreated} platforms, +${officesCreated} offices → totals ${JSON.stringify(after)}`
  );

  return {
    restored: true,
    created: {
      branches: branchesCreated,
      incubators: incubatorsCreated,
      platforms: platformsCreated,
      offices: officesCreated,
    },
    totals: after,
  };
}

module.exports = {
  ensureHierarchyCatalog,
  loadCatalog,
};
