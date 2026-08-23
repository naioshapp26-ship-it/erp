'use strict';

const express = require('express');
const router = express.Router();
const db = require('../../db');
const { listOpsModules, getOpsModule } = require('../../hr-ops-modules');

const DEFAULT_ENTITY = 'HQ001';

const ensureTable = async () => {
  await db.query(`
    CREATE TABLE IF NOT EXISTS hr_ops_records (
      id SERIAL PRIMARY KEY,
      module_key TEXT NOT NULL,
      name TEXT NOT NULL,
      status TEXT DEFAULT 'نشط',
      data JSONB DEFAULT '{}'::jsonb,
      entity_id TEXT DEFAULT 'HQ001',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_hr_ops_module ON hr_ops_records(module_key, entity_id);
  `);
};

const entityIdOf = (req) => String(req.userEntity?.id || req.headers['x-entity-id'] || DEFAULT_ENTITY).trim() || DEFAULT_ENTITY;

const seedIfEmpty = async (mod, entityId) => {
  if (!mod?.seeds?.length) return;
  const countRes = await db.query(
    'SELECT COUNT(*)::int AS count FROM hr_ops_records WHERE module_key = $1 AND entity_id = $2',
    [mod.key, entityId]
  );
  if ((countRes.rows[0]?.count || 0) > 0) return;
  for (const seed of mod.seeds) {
    const name = seed.name || mod.title;
    await db.query(
      `INSERT INTO hr_ops_records (module_key, name, status, data, entity_id)
       VALUES ($1, $2, $3, $4::jsonb, $5)`,
      [mod.key, name, seed.status || 'نشط', JSON.stringify(seed), entityId]
    );
  }
};

const readyPromise = ensureTable().catch((error) => {
  console.error('❌ hr_ops_records init failed:', error.message);
});

router.get('/', async (_req, res) => {
  res.json({ success: true, modules: listOpsModules() });
});

router.get('/:key', async (req, res) => {
  try {
    await readyPromise;
    const mod = getOpsModule(req.params.key);
    if (!mod) return res.status(404).json({ success: false, error: 'القسم غير موجود' });
    const entityId = entityIdOf(req);
    await seedIfEmpty(mod, entityId);
    const result = await db.query(
      'SELECT * FROM hr_ops_records WHERE module_key = $1 AND entity_id = $2 ORDER BY id DESC',
      [mod.key, entityId]
    );
    res.json({
      success: true,
      module: {
        key: mod.key,
        title: mod.title,
        subtitle: mod.subtitle,
        icon: mod.icon,
        isNew: Boolean(mod.isNew),
        requestType: mod.requestType || null,
        requestLabel: mod.requestLabel || null,
        fields: mod.fields || [],
        href: mod.href || `/hr/${mod.key}`
      },
      records: result.rows
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.put('/:key/:id', async (req, res) => {
  try {
    await readyPromise;
    const mod = getOpsModule(req.params.key);
    if (!mod) return res.status(404).json({ success: false, error: 'القسم غير موجود' });
    const entityId = entityIdOf(req);
    const body = req.body || {};
    const name = String(body.name || body.title || '').trim();
    if (!name) return res.status(400).json({ success: false, error: 'الاسم مطلوب' });
    const updated = await db.query(
      `UPDATE hr_ops_records
       SET name = $1, status = $2, data = $3::jsonb, updated_at = NOW()
       WHERE id = $4 AND module_key = $5 AND entity_id = $6
       RETURNING *`,
      [name, body.status || 'نشط', JSON.stringify(body), req.params.id, mod.key, entityId]
    );
    if (!updated.rows.length) return res.status(404).json({ success: false, error: 'السجل غير موجود' });
    res.json({ success: true, record: updated.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/:key', async (req, res) => {
  try {
    await readyPromise;
    const mod = getOpsModule(req.params.key);
    if (!mod) return res.status(404).json({ success: false, error: 'القسم غير موجود' });
    const entityId = entityIdOf(req);
    const body = req.body || {};
    const name = String(body.name || body.title || '').trim();
    if (!name) return res.status(400).json({ success: false, error: 'الاسم مطلوب' });
    const inserted = await db.query(
      `INSERT INTO hr_ops_records (module_key, name, status, data, entity_id)
       VALUES ($1, $2, $3, $4::jsonb, $5) RETURNING *`,
      [mod.key, name, body.status || 'نشط', JSON.stringify(body), entityId]
    );
    res.status(201).json({ success: true, record: inserted.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.delete('/:key/:id', async (req, res) => {
  try {
    await readyPromise;
    const entityId = entityIdOf(req);
    const deleted = await db.query(
      'DELETE FROM hr_ops_records WHERE id = $1 AND module_key = $2 AND entity_id = $3 RETURNING id',
      [req.params.id, req.params.key, entityId]
    );
    if (!deleted.rows.length) return res.status(404).json({ success: false, error: 'السجل غير موجود' });
    res.json({ success: true, deleted: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
