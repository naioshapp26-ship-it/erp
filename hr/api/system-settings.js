'use strict';

const express = require('express');
const router = express.Router();
const db = require('../../db');
const {
  getCatalogPublic,
  getItem,
  listItemKeys
} = require('../../hr-system-settings-catalog');
const {
  settingRequiresEmployeeNumber,
  payloadEmployeeNumber
} = require('../../hr-employee-fields');
const {
  isReadableSettingText,
  isCorruptedSettingRecord,
  normalizeSeedData
} = require('../../hr-setting-record-safety');

const DEFAULT_ENTITY = 'HQ001';

const ensureTable = async () => {
  await db.query(`
    CREATE TABLE IF NOT EXISTS hr_system_setting_records (
      id SERIAL PRIMARY KEY,
      catalog_key TEXT NOT NULL,
      code TEXT,
      name TEXT NOT NULL,
      status TEXT DEFAULT 'نشط',
      data JSONB DEFAULT '{}'::jsonb,
      entity_id TEXT DEFAULT 'HQ001',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_hr_sysset_catalog ON hr_system_setting_records(catalog_key);
    CREATE INDEX IF NOT EXISTS idx_hr_sysset_entity ON hr_system_setting_records(entity_id);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_hr_sysset_unique_code
      ON hr_system_setting_records(entity_id, catalog_key, code)
      WHERE code IS NOT NULL AND code <> '';
  `);
};

const entityIdOf = (req) => {
  const header = req.headers['x-entity-id'] || req.headers['x-entity-id'];
  return String(req.userEntity?.id || header || DEFAULT_ENTITY).trim() || DEFAULT_ENTITY;
};

const seedIfEmpty = async (catalogKey, entityId) => {
  const item = getItem(catalogKey);
  if (!item) return;
  const countRes = await db.query(
    'SELECT COUNT(*)::int AS count FROM hr_system_setting_records WHERE catalog_key = $1 AND entity_id = $2',
    [catalogKey, entityId]
  );
  if ((countRes.rows[0]?.count || 0) > 0) return;

  for (const seed of item.seeds || []) {
    await upsertSeedRecord(item, entityId, seed);
  }
};

const upsertSeedRecord = async (item, entityId, seed) => {
  const data = normalizeSeedData(seed, item);
  const code = data.code || null;
  const name = data.name || item.label;
  const status = data.status || 'نشط';
  if (code) {
    const existing = await db.query(
      'SELECT id FROM hr_system_setting_records WHERE catalog_key = $1 AND entity_id = $2 AND code = $3',
      [item.key, entityId, code]
    );
    if (existing.rows.length) {
      await db.query(
        `UPDATE hr_system_setting_records
         SET name = $1, status = $2, data = $3::jsonb, updated_at = NOW()
         WHERE id = $4`,
        [name, status, JSON.stringify(data), existing.rows[0].id]
      );
      return;
    }
  }
  await db.query(
    `INSERT INTO hr_system_setting_records (catalog_key, code, name, status, data, entity_id)
     VALUES ($1, $2, $3, $4, $5::jsonb, $6)`,
    [item.key, code, name, status, JSON.stringify(data), entityId]
  );
};

const repairCatalogSeedRecords = async (item, entityId) => {
  for (const seed of item.seeds || []) {
    if (!seed?.code) continue;
    await upsertSeedRecord(item, entityId, seed);
  }
};

const purgeCorruptedSettingRecords = async (catalogKey, entityId, seedCodes = []) => {
  const protectedCodes = new Set(seedCodes.filter(Boolean));
  const result = await db.query(
    'SELECT id, code, name FROM hr_system_setting_records WHERE catalog_key = $1 AND entity_id = $2',
    [catalogKey, entityId]
  );
  for (const row of result.rows) {
    if (!isCorruptedSettingRecord(row)) continue;
    if (row.code && protectedCodes.has(row.code)) continue;
    await db.query('DELETE FROM hr_system_setting_records WHERE id = $1', [row.id]);
  }
};

const prepareCatalogRecords = async (item, entityId) => {
  await seedIfEmpty(item.key, entityId);
  await repairCatalogSeedRecords(item, entityId);
  const seedCodes = (item.seeds || []).map((seed) => seed.code).filter(Boolean);
  await purgeCorruptedSettingRecords(item.key, entityId, seedCodes);
};

const mapRow = (row, item) => {
  const data = row.data && typeof row.data === 'object' ? row.data : {};
  return {
    id: row.id,
    catalog_key: row.catalog_key,
    code: row.code,
    name: row.name,
    status: row.status,
    data,
    entity_id: row.entity_id,
    created_at: row.created_at,
    updated_at: row.updated_at,
    display: item
      ? item.fields.map((f) => ({
          key: f.key,
          label: f.label,
          value: (['name', 'code', 'status'].includes(f.key) && row[f.key] != null)
            ? row[f.key]
            : (data[f.key] != null ? data[f.key] : (row[f.key] != null ? row[f.key] : ''))
        }))
      : []
  };
};

const readyPromise = ensureTable().catch((error) => {
  console.error('❌ hr_system_setting_records init failed:', error.message);
});

router.get('/catalog', async (_req, res) => {
  try {
    await readyPromise;
    res.json({ success: true, groups: getCatalogPublic(), count: listItemKeys().length });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/:key', async (req, res) => {
  try {
    await readyPromise;
    const item = getItem(req.params.key);
    if (!item) return res.status(404).json({ success: false, error: 'عنصر الإعدادات غير موجود' });
    const entityId = entityIdOf(req);
    await prepareCatalogRecords(item, entityId);
    const result = await db.query(
      `SELECT * FROM hr_system_setting_records
       WHERE catalog_key = $1 AND entity_id = $2
       ORDER BY id ASC`,
      [item.key, entityId]
    );
    res.json({
      success: true,
      item: {
        key: item.key,
        label: item.label,
        description: item.description,
        icon: item.icon,
        isNew: item.isNew || false,
        groupKey: item.groupKey,
        groupTitle: item.groupTitle,
        fields: item.fields
      },
      records: result.rows.map((row) => mapRow(row, item))
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/:key', async (req, res) => {
  try {
    await readyPromise;
    const item = getItem(req.params.key);
    if (!item) return res.status(404).json({ success: false, error: 'عنصر الإعدادات غير موجود' });
    const entityId = entityIdOf(req);
    const body = req.body || {};
    const data = {};
    item.fields.forEach((f) => {
      if (body[f.key] !== undefined) data[f.key] = body[f.key];
      else if (body.data && body.data[f.key] !== undefined) data[f.key] = body.data[f.key];
    });
    const name = String(data.name || body.name || '').trim();
    if (!name) return res.status(400).json({ success: false, error: 'الاسم مطلوب' });
    if (!isReadableSettingText(name)) {
      return res.status(400).json({ success: false, error: 'الاسم يحتوي على بيانات غير صالحة. تأكد من ترميز الملف UTF-8 عند الاستيراد.' });
    }
    if (settingRequiresEmployeeNumber(item.key) && !payloadEmployeeNumber({ ...data, ...body })) {
      return res.status(400).json({ success: false, error: 'رقم الموظف مطلوب' });
    }
    const code = data.code || body.code || null;
    if (code && !isReadableSettingText(code, { minReadableRatio: 0.6, maxLength: 80 })) {
      return res.status(400).json({ success: false, error: 'الرمز يحتوي على بيانات غير صالحة' });
    }
    const status = data.status || body.status || 'نشط';
    const inserted = await db.query(
      `INSERT INTO hr_system_setting_records (catalog_key, code, name, status, data, entity_id)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6)
       RETURNING *`,
      [item.key, code, name, status, JSON.stringify(data), entityId]
    );
    res.status(201).json({ success: true, record: mapRow(inserted.rows[0], item) });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.put('/:key/:id', async (req, res) => {
  try {
    await readyPromise;
    const item = getItem(req.params.key);
    if (!item) return res.status(404).json({ success: false, error: 'عنصر الإعدادات غير موجود' });
    const entityId = entityIdOf(req);
    const existing = await db.query(
      'SELECT * FROM hr_system_setting_records WHERE id = $1 AND catalog_key = $2 AND entity_id = $3',
      [req.params.id, item.key, entityId]
    );
    if (!existing.rows.length) return res.status(404).json({ success: false, error: 'السجل غير موجود' });
    const prev = existing.rows[0];
    const prevData = prev.data && typeof prev.data === 'object' ? prev.data : {};
    const body = req.body || {};
    const data = { ...prevData };
    item.fields.forEach((f) => {
      if (body[f.key] !== undefined) data[f.key] = body[f.key];
      else if (body.data && body.data[f.key] !== undefined) data[f.key] = body.data[f.key];
    });
    const name = String(data.name || body.name || prev.name).trim();
    if (!isReadableSettingText(name)) {
      return res.status(400).json({ success: false, error: 'الاسم يحتوي على بيانات غير صالحة' });
    }
    if (settingRequiresEmployeeNumber(item.key) && !payloadEmployeeNumber({ ...data, ...body })) {
      return res.status(400).json({ success: false, error: 'رقم الموظف مطلوب' });
    }
    const code = data.code || body.code || prev.code;
    if (code && !isReadableSettingText(code, { minReadableRatio: 0.6, maxLength: 80 })) {
      return res.status(400).json({ success: false, error: 'الرمز يحتوي على بيانات غير صالحة' });
    }
    const status = data.status || body.status || prev.status;
    const updated = await db.query(
      `UPDATE hr_system_setting_records
       SET code = $1, name = $2, status = $3, data = $4::jsonb, updated_at = NOW()
       WHERE id = $5
       RETURNING *`,
      [code, name, status, JSON.stringify(data), req.params.id]
    );
    res.json({ success: true, record: mapRow(updated.rows[0], item) });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.delete('/:key/:id', async (req, res) => {
  try {
    await readyPromise;
    const item = getItem(req.params.key);
    if (!item) return res.status(404).json({ success: false, error: 'عنصر الإعدادات غير موجود' });
    const entityId = entityIdOf(req);
    const deleted = await db.query(
      'DELETE FROM hr_system_setting_records WHERE id = $1 AND catalog_key = $2 AND entity_id = $3 RETURNING id',
      [req.params.id, item.key, entityId]
    );
    if (!deleted.rows.length) return res.status(404).json({ success: false, error: 'السجل غير موجود' });
    res.json({ success: true, deleted: true, id: deleted.rows[0].id });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
