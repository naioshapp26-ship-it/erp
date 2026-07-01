const express = require('express');
const db = require('../../db');
const { getRequestEntityContext, buildEntityScopeCondition } = require('../../entity-context');

const router = express.Router();

const ensureTable = async () => {
  await db.query(`
    CREATE TABLE IF NOT EXISTS e_offices_records (
      id SERIAL PRIMARY KEY,
      module_key TEXT NOT NULL,
      entity_id TEXT NOT NULL DEFAULT 'HQ001',
      entity_type TEXT NOT NULL DEFAULT 'HQ',
      row_data JSONB NOT NULL DEFAULT '[]'::jsonb,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_e_offices_records_module ON e_offices_records(module_key, entity_id);
  `);
};

ensureTable().catch((error) => {
  console.error('Failed to ensure e_offices_records table:', error.message);
});

const scopeFor = (req, alias = 'r', paramIndex = 1) => {
  const column = `${alias}.entity_id`;
  return {
    clause: buildEntityScopeCondition(getRequestEntityContext(req), column, paramIndex),
    value: getRequestEntityContext(req).id
  };
};

const normalizeCells = (cells) => {
  if (!Array.isArray(cells)) return [];
  return cells.map((cell) => String(cell ?? '').trim() || '—');
};

const mapRow = (row) => ({
  id: row.id,
  cells: Array.isArray(row.row_data) ? row.row_data : [],
  createdAt: row.created_at,
  updatedAt: row.updated_at
});

router.get('/:moduleKey', async (req, res) => {
  try {
    const moduleKey = String(req.params.moduleKey || '').trim();
    if (!moduleKey) return res.status(400).json({ error: 'مفتاح الصفحة مطلوب.' });

    const scope = scopeFor(req, 'r', 2);
    const result = await db.query(
      `SELECT id, row_data, created_at, updated_at
       FROM e_offices_records r
       WHERE r.module_key = $1 AND ${scope.clause}
       ORDER BY r.updated_at DESC, r.id DESC`,
      [moduleKey, scope.value]
    );

    res.json({ records: result.rows.map(mapRow) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/:moduleKey', async (req, res) => {
  try {
    const moduleKey = String(req.params.moduleKey || '').trim();
    const cells = normalizeCells(req.body?.cells);
    if (!moduleKey) return res.status(400).json({ error: 'مفتاح الصفحة مطلوب.' });
    if (!cells.length || !cells[0] || cells[0] === '—') {
      return res.status(400).json({ error: 'يرجى تعبئة الحقول المطلوبة.' });
    }

    const context = getRequestEntityContext(req);
    const result = await db.query(
      `INSERT INTO e_offices_records (module_key, entity_id, entity_type, row_data)
       VALUES ($1, $2, $3, $4::jsonb)
       RETURNING id, row_data, created_at, updated_at`,
      [moduleKey, context.id, context.type, JSON.stringify(cells)]
    );

    res.status(201).json({ record: mapRow(result.rows[0]) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/:moduleKey/seed', async (req, res) => {
  try {
    const moduleKey = String(req.params.moduleKey || '').trim();
    const seedRows = Array.isArray(req.body?.seed) ? req.body.seed : [];
    if (!moduleKey || !seedRows.length) {
      return res.status(400).json({ error: 'بيانات البذرة غير صالحة.' });
    }

    const context = getRequestEntityContext(req);
    const scope = scopeFor(req, 'r', 2);
    const existing = await db.query(
      `SELECT COUNT(*)::int AS count FROM e_offices_records r WHERE r.module_key = $1 AND ${scope.clause}`,
      [moduleKey, scope.value]
    );
    if (existing.rows[0].count > 0) {
      return res.json({ seeded: false, message: 'السجلات موجودة مسبقاً.' });
    }

    const inserts = seedRows.map((cells) =>
      db.query(
        `INSERT INTO e_offices_records (module_key, entity_id, entity_type, row_data)
         VALUES ($1, $2, $3, $4::jsonb)
         RETURNING id`,
        [moduleKey, context.id, context.type, JSON.stringify(normalizeCells(cells))]
      )
    );
    await Promise.all(inserts);
    res.status(201).json({ seeded: true, count: seedRows.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/:moduleKey/:id', async (req, res) => {
  try {
    const moduleKey = String(req.params.moduleKey || '').trim();
    const id = Number(req.params.id);
    const cells = normalizeCells(req.body?.cells);
    if (!id) return res.status(400).json({ error: 'معرّف السجل غير صالح.' });
    if (!cells.length) return res.status(400).json({ error: 'لا توجد بيانات للتحديث.' });

    const scope = scopeFor(req, 'r', 3);
    const result = await db.query(
      `UPDATE e_offices_records r
       SET row_data = $1::jsonb, updated_at = NOW()
       WHERE r.id = $2 AND r.module_key = $3 AND ${scope.clause}
       RETURNING id, row_data, created_at, updated_at`,
      [JSON.stringify(cells), id, moduleKey, scope.value]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'السجل غير موجود.' });
    res.json({ record: mapRow(result.rows[0]) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/:moduleKey/:id', async (req, res) => {
  try {
    const moduleKey = String(req.params.moduleKey || '').trim();
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: 'معرّف السجل غير صالح.' });

    const scope = scopeFor(req, 'r', 3);
    const result = await db.query(
      `DELETE FROM e_offices_records r
       WHERE r.id = $1 AND r.module_key = $2 AND ${scope.clause}
       RETURNING id`,
      [id, moduleKey, scope.value]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'السجل غير موجود.' });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
