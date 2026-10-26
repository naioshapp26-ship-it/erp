'use strict';

const express = require('express');
const db = require('../../db');
const { resolveScopedEntityId } = require('./resolve-scoped-entity');
const { applyInbound, applyOutbound, roundQty, roundCost } = require('../services/inventory-policy');
const { ensureStockLinkSchema } = require('../services/stock-link');

const router = express.Router();
let tablesReady = null;

function entityOf(req) {
  if (!req.authenticatedEntityContext && !req.userEntity) return null;
  return resolveScopedEntityId(req);
}

function actorOf(req) {
  return req.authUser?.email || req.authUser?.name || 'session';
}

function fail(res, status, error) {
  return res.status(status).json({ success: false, error });
}

async function ensureTables() {
  if (!tablesReady) {
    tablesReady = (async () => {
      await db.query(`
      CREATE TABLE IF NOT EXISTS finance_items (
        item_id SERIAL PRIMARY KEY,
        entity_id TEXT NOT NULL,
        sku TEXT NOT NULL,
        name_ar TEXT NOT NULL,
        item_type TEXT NOT NULL DEFAULT 'product',
        category TEXT,
        unit TEXT NOT NULL DEFAULT 'وحدة',
        sale_price NUMERIC(14,2) NOT NULL DEFAULT 0,
        reorder_level NUMERIC(14,3) NOT NULL DEFAULT 0,
        is_stocked BOOLEAN NOT NULL DEFAULT true,
        is_active BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (entity_id, sku)
      );
      CREATE TABLE IF NOT EXISTS finance_warehouses (
        warehouse_id SERIAL PRIMARY KEY,
        entity_id TEXT NOT NULL,
        code TEXT NOT NULL,
        name_ar TEXT NOT NULL,
        is_active BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (entity_id, code)
      );
      CREATE TABLE IF NOT EXISTS finance_units (
        unit_id SERIAL PRIMARY KEY,
        entity_id TEXT NOT NULL,
        code TEXT NOT NULL,
        name_ar TEXT NOT NULL,
        is_active BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (entity_id, code)
      );
      CREATE TABLE IF NOT EXISTS finance_stock_balances (
        entity_id TEXT NOT NULL,
        item_id INTEGER NOT NULL REFERENCES finance_items(item_id),
        warehouse_id INTEGER NOT NULL REFERENCES finance_warehouses(warehouse_id),
        qty NUMERIC(14,3) NOT NULL DEFAULT 0,
        avg_cost NUMERIC(14,4) NOT NULL DEFAULT 0,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (entity_id, item_id, warehouse_id)
      );
      CREATE TABLE IF NOT EXISTS finance_stock_documents (
        document_id SERIAL PRIMARY KEY,
        entity_id TEXT NOT NULL,
        document_no TEXT NOT NULL,
        client_request_id TEXT,
        movement_type TEXT NOT NULL,
        reason TEXT,
        created_by TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (entity_id, document_no),
        UNIQUE (entity_id, client_request_id)
      );
      CREATE TABLE IF NOT EXISTS finance_stock_movements (
        movement_id SERIAL PRIMARY KEY,
        document_id INTEGER NOT NULL REFERENCES finance_stock_documents(document_id),
        entity_id TEXT NOT NULL,
        item_id INTEGER NOT NULL REFERENCES finance_items(item_id),
        warehouse_id INTEGER NOT NULL REFERENCES finance_warehouses(warehouse_id),
        counter_warehouse_id INTEGER REFERENCES finance_warehouses(warehouse_id),
        movement_type TEXT NOT NULL,
        direction TEXT NOT NULL,
        quantity NUMERIC(14,3) NOT NULL,
        unit_cost NUMERIC(14,4) NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS finance_stock_counters (
        entity_id TEXT PRIMARY KEY,
        last_no INTEGER NOT NULL DEFAULT 0
      );
      CREATE TABLE IF NOT EXISTS finance_item_audit (
        audit_id SERIAL PRIMARY KEY,
        entity_id TEXT NOT NULL,
        record_type TEXT NOT NULL,
        record_id INTEGER NOT NULL,
        action TEXT NOT NULL,
        before_data JSONB,
        after_data JSONB,
        actor TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_finance_items_entity ON finance_items(entity_id);
      CREATE INDEX IF NOT EXISTS idx_finance_wh_entity ON finance_warehouses(entity_id);
      CREATE INDEX IF NOT EXISTS idx_finance_stock_mov_entity ON finance_stock_movements(entity_id, created_at DESC);
    `);
      await ensureStockLinkSchema(db);
    })().catch((error) => {
      tablesReady = null;
      throw error;
    });
  }
  return tablesReady;
}

function requireEntity(req, res) {
  const entityId = entityOf(req);
  if (!entityId || !req.authenticatedEntityContext) {
    fail(res, 401, 'يجب تسجيل الدخول لتحديد الكيان.');
    return null;
  }
  return entityId;
}

async function assertActiveUnit(client, entityId, code) {
  const unit = String(code || '').trim().toUpperCase();
  if (!unit) return { ok: false, error: 'وحدة القياس مطلوبة.' };
  const found = await client.query(
    `SELECT code FROM finance_units WHERE entity_id = $1 AND code = $2 AND is_active = true`,
    [entityId, unit]
  );
  if (!found.rows.length) return { ok: false, error: 'وحدة القياس غير موجودة أو موقوفة.' };
  return { ok: true, code: unit };
}

async function audit(client, entityId, recordType, recordId, action, beforeData, afterData, actor) {
  await client.query(
    `INSERT INTO finance_item_audit
      (entity_id, record_type, record_id, action, before_data, after_data, actor)
     VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [entityId, recordType, recordId, action, beforeData ? JSON.stringify(beforeData) : null, afterData ? JSON.stringify(afterData) : null, actor]
  );
}

router.get('/items', async (req, res) => {
  const entityId = requireEntity(req, res);
  if (!entityId) return;
  try {
    await ensureTables();
    const q = String(req.query.q || '').trim();
    const params = [entityId];
    let sql = `SELECT i.*,
      CASE
        WHEN EXISTS (SELECT 1 FROM finance_stock_movements m WHERE m.entity_id = i.entity_id AND m.item_id = i.item_id)
          THEN 'الصنف مرتبط بحركة مخزون معتمدة ولا يُحذف. يمكن تعطيله.'
        WHEN EXISTS (SELECT 1 FROM finance_stock_balances b WHERE b.entity_id = i.entity_id AND b.item_id = i.item_id AND b.qty <> 0)
          THEN 'الصنف له رصيد. عطّله أو سوِّ الرصيد بحركة عكسية.'
        ELSE NULL
      END AS delete_block_reason
      FROM finance_items i WHERE i.entity_id = $1`;
    if (q) {
      params.push(`%${q}%`);
      sql += ` AND (i.sku ILIKE $2 OR i.name_ar ILIKE $2 OR COALESCE(i.category,'') ILIKE $2)`;
    }
    sql += ` ORDER BY i.item_id DESC`;
    const result = await db.query(sql, params);
    res.json({ success: true, items: result.rows, count: result.rows.length });
  } catch (error) {
    fail(res, 500, error.message);
  }
});

router.post('/items', async (req, res) => {
  const entityId = requireEntity(req, res);
  if (!entityId) return;
  const body = req.body || {};
  const sku = String(body.sku || '').trim().toUpperCase();
  const name = String(body.name_ar || '').trim();
  const itemType = body.item_type === 'service' ? 'service' : 'product';
  const salePrice = roundCost(body.sale_price || 0);
  const reorder = roundQty(body.reorder_level || 0);
  if (!sku || !name) return fail(res, 400, 'رمز الصنف والاسم العربي مطلوبان.');
  if (!Number.isFinite(salePrice) || salePrice < 0) return fail(res, 400, 'سعر البيع غير صالح.');
  if (!Number.isFinite(reorder) || reorder < 0) return fail(res, 400, 'حد إعادة الطلب غير صالح.');
  const client = await db.pool.connect();
  try {
    await ensureTables();
    await client.query('BEGIN');
    const unit = await assertActiveUnit(client, entityId, body.unit);
    if (!unit.ok) {
      await client.query('ROLLBACK');
      return fail(res, 400, unit.error);
    }
    const inserted = await client.query(
      `INSERT INTO finance_items
        (entity_id, sku, name_ar, item_type, category, unit, sale_price, reorder_level, is_stocked)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       RETURNING *`,
      [
        entityId,
        sku,
        name,
        itemType,
        String(body.category || '').trim() || null,
        unit.code,
        salePrice,
        reorder,
        itemType === 'service' ? false : body.is_stocked !== false
      ]
    );
    await audit(client, entityId, 'item', inserted.rows[0].item_id, 'create', null, inserted.rows[0], actorOf(req));
    await client.query('COMMIT');
    res.status(201).json({ success: true, item: inserted.rows[0] });
  } catch (error) {
    await client.query('ROLLBACK');
    fail(res, error.code === '23505' ? 409 : 500, error.code === '23505' ? 'رمز الصنف مستخدم داخل هذا الكيان.' : error.message);
  } finally {
    client.release();
  }
});

router.put('/items/:id', async (req, res) => {
  const entityId = requireEntity(req, res);
  if (!entityId) return;
  const body = req.body || {};
  const client = await db.pool.connect();
  try {
    await ensureTables();
    await client.query('BEGIN');
    const current = await client.query(
      `SELECT * FROM finance_items WHERE item_id = $1 AND entity_id = $2 FOR UPDATE`,
      [req.params.id, entityId]
    );
    if (!current.rows.length) {
      await client.query('ROLLBACK');
      return fail(res, 404, 'الصنف غير موجود في هذا الكيان.');
    }
    const row = current.rows[0];
    const name = body.name_ar != null ? String(body.name_ar).trim() : row.name_ar;
    const salePrice = body.sale_price != null ? roundCost(body.sale_price) : Number(row.sale_price);
    const reorder = body.reorder_level != null ? roundQty(body.reorder_level) : Number(row.reorder_level);
    if (!name) {
      await client.query('ROLLBACK');
      return fail(res, 400, 'الاسم العربي مطلوب.');
    }
    if (!Number.isFinite(salePrice) || salePrice < 0 || !Number.isFinite(reorder) || reorder < 0) {
      await client.query('ROLLBACK');
      return fail(res, 400, 'السعر أو حد الطلب غير صالح.');
    }
    let unitCode = row.unit;
    if (body.unit != null) {
      const unit = await assertActiveUnit(client, entityId, body.unit);
      if (!unit.ok) {
        await client.query('ROLLBACK');
        return fail(res, 400, unit.error);
      }
      unitCode = unit.code;
    }
    const updated = await client.query(
      `UPDATE finance_items SET
         name_ar = $3,
         category = $4,
         unit = $5,
         sale_price = $6,
         reorder_level = $7,
         is_active = $8,
         updated_at = NOW()
       WHERE item_id = $1 AND entity_id = $2
       RETURNING *`,
      [
        row.item_id,
        entityId,
        name,
        body.category != null ? (String(body.category).trim() || null) : row.category,
        unitCode,
        salePrice,
        reorder,
        body.is_active != null ? !!body.is_active : row.is_active
      ]
    );
    await audit(client, entityId, 'item', row.item_id, 'update', row, updated.rows[0], actorOf(req));
    await client.query('COMMIT');
    res.json({ success: true, item: updated.rows[0] });
  } catch (error) {
    await client.query('ROLLBACK');
    fail(res, 500, error.message);
  } finally {
    client.release();
  }
});

router.get('/units', async (req, res) => {
  const entityId = requireEntity(req, res);
  if (!entityId) return;
  try {
    await ensureTables();
    const result = await db.query(
      `SELECT u.*,
        CASE WHEN EXISTS (SELECT 1 FROM finance_items i WHERE i.entity_id = u.entity_id AND i.unit = u.code)
          THEN 'الوحدة مستخدمة في أصناف. عطّلها بدل الحذف.'
          ELSE NULL
        END AS delete_block_reason
       FROM finance_units u WHERE u.entity_id = $1 ORDER BY u.code`,
      [entityId]
    );
    res.json({ success: true, units: result.rows, count: result.rows.length });
  } catch (error) {
    fail(res, 500, error.message);
  }
});

router.post('/units', async (req, res) => {
  const entityId = requireEntity(req, res);
  if (!entityId) return;
  const code = String((req.body || {}).code || '').trim().toUpperCase();
  const name = String((req.body || {}).name_ar || '').trim();
  if (!code || !name) return fail(res, 400, 'رمز وحدة القياس والاسم مطلوبان.');
  const client = await db.pool.connect();
  try {
    await ensureTables();
    await client.query('BEGIN');
    const inserted = await client.query(
      `INSERT INTO finance_units (entity_id, code, name_ar) VALUES ($1,$2,$3) RETURNING *`,
      [entityId, code, name]
    );
    await audit(client, entityId, 'unit', inserted.rows[0].unit_id, 'create', null, inserted.rows[0], actorOf(req));
    await client.query('COMMIT');
    res.status(201).json({ success: true, unit: inserted.rows[0] });
  } catch (error) {
    await client.query('ROLLBACK');
    fail(res, error.code === '23505' ? 409 : 500, error.code === '23505' ? 'رمز وحدة القياس مستخدم داخل هذا الكيان.' : error.message);
  } finally {
    client.release();
  }
});

router.put('/units/:id', async (req, res) => {
  const entityId = requireEntity(req, res);
  if (!entityId) return;
  const client = await db.pool.connect();
  try {
    await ensureTables();
    await client.query('BEGIN');
    const current = await client.query(
      `SELECT * FROM finance_units WHERE unit_id = $1 AND entity_id = $2 FOR UPDATE`,
      [req.params.id, entityId]
    );
    if (!current.rows.length) {
      await client.query('ROLLBACK');
      return fail(res, 404, 'وحدة القياس غير موجودة في هذا الكيان.');
    }
    const updated = await client.query(
      `UPDATE finance_units SET name_ar = $3, is_active = $4
       WHERE unit_id = $1 AND entity_id = $2 RETURNING *`,
      [
        current.rows[0].unit_id,
        entityId,
        String((req.body || {}).name_ar || current.rows[0].name_ar).trim() || current.rows[0].name_ar,
        (req.body || {}).is_active != null ? !!(req.body || {}).is_active : current.rows[0].is_active
      ]
    );
    await audit(client, entityId, 'unit', current.rows[0].unit_id, 'update', current.rows[0], updated.rows[0], actorOf(req));
    await client.query('COMMIT');
    res.json({ success: true, unit: updated.rows[0] });
  } catch (error) {
    await client.query('ROLLBACK');
    fail(res, 500, error.message);
  } finally {
    client.release();
  }
});

router.get('/warehouses', async (req, res) => {
  const entityId = requireEntity(req, res);
  if (!entityId) return;
  try {
    await ensureTables();
    const result = await db.query(
      `SELECT w.*,
        CASE
          WHEN EXISTS (SELECT 1 FROM finance_stock_movements m WHERE m.entity_id = w.entity_id AND m.warehouse_id = w.warehouse_id)
            THEN 'المستودع مرتبط بحركة معتمدة ولا يُحذف. يمكن تعطيله.'
          WHEN EXISTS (SELECT 1 FROM finance_stock_balances b WHERE b.entity_id = w.entity_id AND b.warehouse_id = w.warehouse_id AND b.qty <> 0)
            THEN 'المستودع له رصيد. عطّله بدل الحذف.'
          ELSE NULL
        END AS delete_block_reason
       FROM finance_warehouses w WHERE w.entity_id = $1 ORDER BY w.warehouse_id DESC`,
      [entityId]
    );
    res.json({ success: true, warehouses: result.rows, count: result.rows.length });
  } catch (error) {
    fail(res, 500, error.message);
  }
});

router.post('/warehouses', async (req, res) => {
  const entityId = requireEntity(req, res);
  if (!entityId) return;
  const code = String((req.body || {}).code || '').trim().toUpperCase();
  const name = String((req.body || {}).name_ar || '').trim();
  if (!code || !name) return fail(res, 400, 'رمز المستودع والاسم مطلوبان.');
  const client = await db.pool.connect();
  try {
    await ensureTables();
    await client.query('BEGIN');
    const inserted = await client.query(
      `INSERT INTO finance_warehouses (entity_id, code, name_ar) VALUES ($1,$2,$3) RETURNING *`,
      [entityId, code, name]
    );
    await audit(client, entityId, 'warehouse', inserted.rows[0].warehouse_id, 'create', null, inserted.rows[0], actorOf(req));
    await client.query('COMMIT');
    res.status(201).json({ success: true, warehouse: inserted.rows[0] });
  } catch (error) {
    await client.query('ROLLBACK');
    fail(res, error.code === '23505' ? 409 : 500, error.code === '23505' ? 'رمز المستودع مستخدم داخل هذا الكيان.' : error.message);
  } finally {
    client.release();
  }
});

async function lockBalance(client, entityId, itemId, warehouseId) {
  const existing = await client.query(
    `SELECT qty, avg_cost FROM finance_stock_balances
     WHERE entity_id = $1 AND item_id = $2 AND warehouse_id = $3
     FOR UPDATE`,
    [entityId, itemId, warehouseId]
  );
  if (existing.rows.length) {
    return { qty: Number(existing.rows[0].qty), avgCost: Number(existing.rows[0].avg_cost) };
  }
  await client.query(
    `INSERT INTO finance_stock_balances (entity_id, item_id, warehouse_id, qty, avg_cost)
     VALUES ($1,$2,$3,0,0)
     ON CONFLICT (entity_id, item_id, warehouse_id) DO NOTHING`,
    [entityId, itemId, warehouseId]
  );
  const locked = await client.query(
    `SELECT qty, avg_cost FROM finance_stock_balances
     WHERE entity_id = $1 AND item_id = $2 AND warehouse_id = $3
     FOR UPDATE`,
    [entityId, itemId, warehouseId]
  );
  return { qty: Number(locked.rows[0].qty), avgCost: Number(locked.rows[0].avg_cost) };
}

async function saveBalance(client, entityId, itemId, warehouseId, next) {
  await client.query(
    `UPDATE finance_stock_balances
     SET qty = $4, avg_cost = $5, updated_at = NOW()
     WHERE entity_id = $1 AND item_id = $2 AND warehouse_id = $3`,
    [entityId, itemId, warehouseId, next.qty, next.avgCost]
  );
}

async function nextDocumentNo(client, entityId) {
  const result = await client.query(
    `INSERT INTO finance_stock_counters (entity_id, last_no) VALUES ($1, 1)
     ON CONFLICT (entity_id) DO UPDATE SET last_no = finance_stock_counters.last_no + 1
     RETURNING last_no`,
    [entityId]
  );
  return `STK-${String(result.rows[0].last_no).padStart(4, '0')}`;
}

async function loadDocument(client, entityId, documentId) {
  const doc = await client.query(
    `SELECT * FROM finance_stock_documents WHERE document_id = $1 AND entity_id = $2`,
    [documentId, entityId]
  );
  const lines = await client.query(
    `SELECT m.*, i.sku, i.name_ar, w.code AS warehouse_code
     FROM finance_stock_movements m
     JOIN finance_items i ON i.item_id = m.item_id
     JOIN finance_warehouses w ON w.warehouse_id = m.warehouse_id
     WHERE m.document_id = $1
     ORDER BY m.movement_id`,
    [documentId]
  );
  return { document: doc.rows[0], lines: lines.rows };
}

router.get('/balances', async (req, res) => {
  const entityId = requireEntity(req, res);
  if (!entityId) return;
  try {
    await ensureTables();
    const result = await db.query(
      `SELECT b.entity_id, b.item_id, b.warehouse_id, b.qty, b.avg_cost,
              i.sku, i.name_ar, i.unit, i.sale_price, i.reorder_level, i.item_type, i.is_stocked, i.is_active,
              w.code AS warehouse_code, w.name_ar AS warehouse_name,
              (b.qty * b.avg_cost) AS stock_value,
              (i.sale_price - b.avg_cost) AS unit_margin
       FROM finance_stock_balances b
       JOIN finance_items i ON i.item_id = b.item_id AND i.entity_id = b.entity_id
       JOIN finance_warehouses w ON w.warehouse_id = b.warehouse_id AND w.entity_id = b.entity_id
       WHERE b.entity_id = $1
       ORDER BY i.sku, w.code`,
      [entityId]
    );
    const low = result.rows.filter((row) => row.is_stocked && Number(row.reorder_level) > 0 && Number(row.qty) <= Number(row.reorder_level));
    const totalValue = roundCost(result.rows.reduce((sum, row) => sum + Number(row.stock_value || 0), 0));
    res.json({
      success: true,
      balances: result.rows,
      low_stock: low,
      low_stock_count: low.length,
      total_value: totalValue,
      valuation: 'weighted_average'
    });
  } catch (error) {
    fail(res, 500, error.message);
  }
});

router.get('/movements', async (req, res) => {
  const entityId = requireEntity(req, res);
  if (!entityId) return;
  try {
    await ensureTables();
    const params = [entityId];
    let sql = `
      SELECT d.document_id, d.document_no, d.movement_type, d.reason, d.created_by, d.created_at,
             d.source_type, d.source_id, d.journal_entry_id, d.currency_code, d.reverses_document_id,
             m.movement_id, m.direction, m.quantity, m.unit_cost, m.item_id, m.warehouse_id,
             i.sku, i.name_ar, w.code AS warehouse_code
      FROM finance_stock_documents d
      JOIN finance_stock_movements m ON m.document_id = d.document_id
      JOIN finance_items i ON i.item_id = m.item_id
      JOIN finance_warehouses w ON w.warehouse_id = m.warehouse_id
      WHERE d.entity_id = $1`;
    if (req.query.item_id) {
      params.push(req.query.item_id);
      sql += ` AND m.item_id = $${params.length}`;
    }
    if (req.query.warehouse_id) {
      params.push(req.query.warehouse_id);
      sql += ` AND m.warehouse_id = $${params.length}`;
    }
    if (req.query.movement_type) {
      params.push(String(req.query.movement_type).toUpperCase());
      sql += ` AND d.movement_type = $${params.length}`;
    }
    if (req.query.from) {
      params.push(req.query.from);
      sql += ` AND d.created_at::date >= $${params.length}::date`;
    }
    if (req.query.to) {
      params.push(req.query.to);
      sql += ` AND d.created_at::date <= $${params.length}::date`;
    }
    sql += ` ORDER BY d.document_id DESC, m.movement_id ASC LIMIT 200`;
    const result = await db.query(sql, params);
    res.json({ success: true, movements: result.rows, count: result.rows.length });
  } catch (error) {
    fail(res, 500, error.message);
  }
});

router.put('/movements/:id', (req, res) => {
  fail(res, 409, 'الحركة المعتمدة لا تُعدَّل. التصحيح بحركة عكسية أو تسوية موثقة.');
});

router.post('/movements', async (req, res) => {
  const entityId = requireEntity(req, res);
  if (!entityId) return;
  const body = req.body || {};
  const type = String(body.movement_type || '').toUpperCase();
  const allowed = ['OPENING', 'IN', 'OUT', 'ADJUSTMENT', 'TRANSFER'];
  if (!allowed.includes(type)) return fail(res, 400, 'نوع الحركة غير معروف.');
  const quantity = roundQty(body.quantity);
  if (!(quantity > 0)) return fail(res, 400, 'الكمية يجب أن تكون أكبر من صفر.');
  const direction = String(body.direction || '').toLowerCase();
  if (type === 'ADJUSTMENT' && direction !== 'in' && direction !== 'out') {
    return fail(res, 400, 'التسوية تحتاج اتجاه إدخال أو إخراج.');
  }
  if ((type === 'ADJUSTMENT' || type === 'OUT') && !String(body.reason || '').trim()) {
    return fail(res, 400, 'سبب الحركة مطلوب للإخراج والتسوية.');
  }
  const clientRequestId = String(body.client_request_id || '').trim() || null;
  const client = await db.pool.connect();
  try {
    await ensureTables();
    await client.query('BEGIN');
    if (clientRequestId) {
      const existing = await client.query(
        `SELECT document_id FROM finance_stock_documents WHERE entity_id = $1 AND client_request_id = $2`,
        [entityId, clientRequestId]
      );
      if (existing.rows.length) {
        const replay = await loadDocument(client, entityId, existing.rows[0].document_id);
        await client.query('COMMIT');
        return res.json({ success: true, replayed: true, ...replay });
      }
    }

    const item = await client.query(
      `SELECT * FROM finance_items WHERE item_id = $1 AND entity_id = $2 FOR UPDATE`,
      [body.item_id, entityId]
    );
    if (!item.rows.length) {
      await client.query('ROLLBACK');
      return fail(res, 404, 'الصنف غير موجود في هذا الكيان.');
    }
    if (!item.rows[0].is_active) {
      await client.query('ROLLBACK');
      return fail(res, 409, 'الصنف غير نشط.');
    }
    if (!item.rows[0].is_stocked || item.rows[0].item_type === 'service') {
      await client.query('ROLLBACK');
      return fail(res, 422, 'الخدمات لا تُحرّك مخزونًا. سجّلها كصنف خدمة بدون رصيد.');
    }

    const warehouse = await client.query(
      `SELECT * FROM finance_warehouses WHERE warehouse_id = $1 AND entity_id = $2`,
      [body.warehouse_id, entityId]
    );
    if (!warehouse.rows.length || !warehouse.rows[0].is_active) {
      await client.query('ROLLBACK');
      return fail(res, 404, 'المستودع غير موجود أو غير نشط.');
    }

    let counter = null;
    if (type === 'TRANSFER') {
      if (String(body.counter_warehouse_id) === String(body.warehouse_id)) {
        await client.query('ROLLBACK');
        return fail(res, 400, 'مستودع التحويل يجب أن يختلف عن المصدر.');
      }
      const other = await client.query(
        `SELECT * FROM finance_warehouses WHERE warehouse_id = $1 AND entity_id = $2`,
        [body.counter_warehouse_id, entityId]
      );
      if (!other.rows.length || !other.rows[0].is_active) {
        await client.query('ROLLBACK');
        return fail(res, 404, 'مستودع الوجهة غير موجود أو غير نشط.');
      }
      counter = other.rows[0];
    }

    const source = await lockBalance(client, entityId, item.rows[0].item_id, warehouse.rows[0].warehouse_id);
    if (type === 'OPENING' && source.qty > 0) {
      await client.query('ROLLBACK');
      return fail(res, 409, 'يوجد رصيد بالفعل. استخدم إدخالًا أو تسوية بدل رصيد افتتاحي جديد.');
    }

    const lines = [];
    if (type === 'OUT' || (type === 'ADJUSTMENT' && direction === 'out') || type === 'TRANSFER') {
      const next = applyOutbound(source, quantity);
      if (!next.ok) {
        await client.query('ROLLBACK');
        return fail(res, 409, next.error);
      }
      await saveBalance(client, entityId, item.rows[0].item_id, warehouse.rows[0].warehouse_id, next);
      lines.push({
        warehouse_id: warehouse.rows[0].warehouse_id,
        counter_warehouse_id: counter ? counter.warehouse_id : null,
        direction: 'out',
        quantity,
        unit_cost: next.appliedUnitCost
      });
      if (type === 'TRANSFER') {
        const destBalance = await lockBalance(client, entityId, item.rows[0].item_id, counter.warehouse_id);
        const inbound = applyInbound(destBalance, quantity, next.appliedUnitCost);
        await saveBalance(client, entityId, item.rows[0].item_id, counter.warehouse_id, inbound);
        lines.push({
          warehouse_id: counter.warehouse_id,
          counter_warehouse_id: warehouse.rows[0].warehouse_id,
          direction: 'in',
          quantity,
          unit_cost: inbound.appliedUnitCost
        });
      }
    } else {
      const unitCost = roundCost(body.unit_cost);
      const next = applyInbound(source, quantity, unitCost);
      if (!next.ok) {
        await client.query('ROLLBACK');
        return fail(res, 400, next.error);
      }
      await saveBalance(client, entityId, item.rows[0].item_id, warehouse.rows[0].warehouse_id, next);
      lines.push({
        warehouse_id: warehouse.rows[0].warehouse_id,
        counter_warehouse_id: null,
        direction: 'in',
        quantity,
        unit_cost: next.appliedUnitCost
      });
    }

    const documentNo = await nextDocumentNo(client, entityId);
    const doc = await client.query(
      `INSERT INTO finance_stock_documents
        (entity_id, document_no, client_request_id, movement_type, reason, created_by)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [entityId, documentNo, clientRequestId, type, String(body.reason || '').trim() || null, actorOf(req)]
    );
    for (const line of lines) {
      await client.query(
        `INSERT INTO finance_stock_movements
          (document_id, entity_id, item_id, warehouse_id, counter_warehouse_id, movement_type, direction, quantity, unit_cost)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [doc.rows[0].document_id, entityId, item.rows[0].item_id, line.warehouse_id, line.counter_warehouse_id, type, line.direction, line.quantity, line.unit_cost]
      );
    }
    const payload = await loadDocument(client, entityId, doc.rows[0].document_id);
    await client.query('COMMIT');
    res.status(201).json({ success: true, replayed: false, ...payload, valuation: 'weighted_average', journal_posted: false });
  } catch (error) {
    await client.query('ROLLBACK');
    fail(res, 500, error.message);
  } finally {
    client.release();
  }
});

const recordHelpers = {
  requireEntity,
  fail,
  actorOf,
  ensureTables,
  audit,
  assertActiveUnit
};
require('./inventory-records').register(router, recordHelpers);
require('./inventory-link').register(router, recordHelpers);
require('./inventory-depth').register(router, recordHelpers);

module.exports = router;
module.exports.ensureTables = ensureTables;
