'use strict';

/**
 * Inventory operations: items, warehouses, posted stock moves, balances.
 * Mount: /finance/inventory
 * Weighted-average valuation. Posted moves are not edited in place.
 */

const express = require('express');
const db = require('../../db');
const { resolveScopedEntityId, resolveScopedEntityType } = require('./resolve-scoped-entity');
const pageDocumentSettings = require('../services/page-document-settings');

const router = express.Router();
let ready = false;

async function ensureSchema() {
  if (ready) return;
  await db.query(`
    CREATE TABLE IF NOT EXISTS finance_items (
      id SERIAL PRIMARY KEY,
      sku TEXT NOT NULL,
      name_ar TEXT NOT NULL,
      item_type TEXT NOT NULL DEFAULT 'product',
      category TEXT,
      unit_name TEXT NOT NULL DEFAULT 'وحدة',
      purchase_cost NUMERIC(14,4) NOT NULL DEFAULT 0,
      sale_price NUMERIC(14,4) NOT NULL DEFAULT 0,
      reorder_level NUMERIC(14,4) NOT NULL DEFAULT 0,
      track_inventory BOOLEAN NOT NULL DEFAULT true,
      is_active BOOLEAN NOT NULL DEFAULT true,
      entity_id TEXT NOT NULL,
      entity_type TEXT,
      created_by TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
      UNIQUE (entity_id, sku)
    );
    CREATE TABLE IF NOT EXISTS finance_warehouses (
      id SERIAL PRIMARY KEY,
      code TEXT NOT NULL,
      name_ar TEXT NOT NULL,
      location_name TEXT,
      is_active BOOLEAN NOT NULL DEFAULT true,
      entity_id TEXT NOT NULL,
      entity_type TEXT,
      created_by TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
      UNIQUE (entity_id, code)
    );
    CREATE TABLE IF NOT EXISTS finance_stock_balances (
      id SERIAL PRIMARY KEY,
      entity_id TEXT NOT NULL,
      item_id INTEGER NOT NULL REFERENCES finance_items(id),
      warehouse_id INTEGER NOT NULL REFERENCES finance_warehouses(id),
      qty NUMERIC(14,4) NOT NULL DEFAULT 0,
      avg_cost NUMERIC(14,4) NOT NULL DEFAULT 0,
      updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
      UNIQUE (entity_id, item_id, warehouse_id)
    );
    CREATE TABLE IF NOT EXISTS finance_stock_moves (
      id SERIAL PRIMARY KEY,
      move_number TEXT NOT NULL,
      move_type TEXT NOT NULL,
      item_id INTEGER NOT NULL REFERENCES finance_items(id),
      warehouse_id INTEGER NOT NULL REFERENCES finance_warehouses(id),
      warehouse_to_id INTEGER REFERENCES finance_warehouses(id),
      qty NUMERIC(14,4) NOT NULL,
      unit_cost NUMERIC(14,4) NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'POSTED',
      notes TEXT,
      reverses_move_id INTEGER,
      idempotency_key TEXT,
      entity_id TEXT NOT NULL,
      entity_type TEXT,
      created_by TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      UNIQUE (entity_id, move_number)
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_finance_stock_moves_idem
      ON finance_stock_moves (entity_id, idempotency_key)
      WHERE idempotency_key IS NOT NULL;
  `);
  ready = true;
}

function actor(req) {
  return (req.authUser && (req.authUser.email || req.authUser.id)) || req.headers['x-user-id'] || 'system';
}

async function allowNegative(req) {
  try {
    const doc = await pageDocumentSettings.getDocSettings('products', pageDocumentSettings.resolveTenantId(req));
    return !!doc.value?.allow_negative_stock;
  } catch (_) {
    return false;
  }
}

async function nextMoveNumber(client, entityId) {
  const result = await client.query(
    `SELECT move_number FROM finance_stock_moves
     WHERE entity_id = $1 AND move_number ~ '^STK-[0-9]+$'
     ORDER BY move_number DESC LIMIT 1`,
    [entityId]
  );
  const last = result.rows[0]?.move_number || '';
  const n = parseInt(String(last).replace(/\D/g, ''), 10) || 0;
  return `STK-${String(n + 1).padStart(4, '0')}`;
}

async function lockBalance(client, entityId, itemId, warehouseId) {
  const found = await client.query(
    `SELECT id, qty, avg_cost FROM finance_stock_balances
     WHERE entity_id = $1 AND item_id = $2 AND warehouse_id = $3
     FOR UPDATE`,
    [entityId, itemId, warehouseId]
  );
  if (found.rows.length) return found.rows[0];
  const inserted = await client.query(
    `INSERT INTO finance_stock_balances (entity_id, item_id, warehouse_id, qty, avg_cost)
     VALUES ($1,$2,$3,0,0)
     ON CONFLICT (entity_id, item_id, warehouse_id) DO NOTHING
     RETURNING id, qty, avg_cost`,
    [entityId, itemId, warehouseId]
  );
  if (inserted.rows.length) return inserted.rows[0];
  const again = await client.query(
    `SELECT id, qty, avg_cost FROM finance_stock_balances
     WHERE entity_id = $1 AND item_id = $2 AND warehouse_id = $3
     FOR UPDATE`,
    [entityId, itemId, warehouseId]
  );
  return again.rows[0];
}

async function saveBalance(client, id, qty, avgCost) {
  await client.query(
    `UPDATE finance_stock_balances SET qty = $2, avg_cost = $3, updated_at = NOW() WHERE id = $1`,
    [id, qty, avgCost]
  );
}

function applyIn(bal, qty, unitCost) {
  const oldQty = Number(bal.qty);
  const oldAvg = Number(bal.avg_cost);
  const newQty = oldQty + qty;
  const newAvg = newQty === 0 ? 0 : ((oldQty * oldAvg) + (qty * unitCost)) / newQty;
  return { qty: newQty, avg: Math.round(newAvg * 10000) / 10000 };
}

function applyOut(bal, qty, allowNeg) {
  const oldQty = Number(bal.qty);
  const newQty = oldQty - qty;
  if (newQty < -0.0001 && !allowNeg) {
    const err = new Error('الرصيد لا يكفي وهذه السياسة تمنع الرصيد السالب');
    err.status = 400;
    throw err;
  }
  return { qty: newQty, avg: Number(bal.avg_cost) };
}

router.get('/items', async (req, res) => {
  try {
    await ensureSchema();
    const entityId = resolveScopedEntityId(req, req.query.entity_id);
    if (!entityId) return res.status(400).json({ success: false, error: 'entity_id is required' });
    const q = String(req.query.q || '').trim();
    const params = [entityId];
    let where = 'entity_id = $1';
    if (q) {
      params.push(`%${q}%`);
      where += ` AND (sku ILIKE $2 OR name_ar ILIKE $2 OR COALESCE(category,'') ILIKE $2)`;
    }
    const result = await db.query(
      `SELECT *,
         CASE WHEN sale_price > 0
           THEN ROUND(((sale_price - purchase_cost) / sale_price) * 100, 2)
           ELSE NULL END AS margin_pct
       FROM finance_items WHERE ${where} ORDER BY name_ar`,
      params
    );
    res.json({ success: true, entity_id: entityId, count: result.rows.length, items: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/items', async (req, res) => {
  try {
    await ensureSchema();
    const body = req.body || {};
    const entityId = resolveScopedEntityId(req, body.entity_id);
    const entityType = resolveScopedEntityType(req, body.entity_type);
    if (!entityId) return res.status(400).json({ success: false, error: 'entity_id is required' });
    const sku = String(body.sku || '').trim();
    const name = String(body.name_ar || '').trim();
    if (!sku || !name) return res.status(400).json({ success: false, error: 'رمز الصنف والاسم مطلوبان' });
    const result = await db.query(
      `INSERT INTO finance_items (
         sku, name_ar, item_type, category, unit_name, purchase_cost, sale_price,
         reorder_level, track_inventory, is_active, entity_id, entity_type, created_by
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       RETURNING *`,
      [
        sku, name, body.item_type || 'product', body.category || null, body.unit_name || 'وحدة',
        Number(body.purchase_cost) || 0, Number(body.sale_price) || 0, Number(body.reorder_level) || 0,
        body.track_inventory !== false, body.is_active !== false, entityId, entityType, actor(req)
      ]
    );
    res.status(201).json({ success: true, item: result.rows[0] });
  } catch (error) {
    const status = error.code === '23505' ? 409 : 500;
    res.status(status).json({ success: false, error: status === 409 ? 'رمز الصنف مستخدم داخل هذا الكيان' : error.message });
  }
});

router.put('/items/:id', async (req, res) => {
  try {
    await ensureSchema();
    const body = req.body || {};
    const entityId = resolveScopedEntityId(req, body.entity_id || req.query.entity_id);
    if (!entityId) return res.status(400).json({ success: false, error: 'entity_id is required' });
    const result = await db.query(
      `UPDATE finance_items SET
         name_ar = COALESCE($1, name_ar),
         item_type = COALESCE($2, item_type),
         category = COALESCE($3, category),
         unit_name = COALESCE($4, unit_name),
         purchase_cost = COALESCE($5, purchase_cost),
         sale_price = COALESCE($6, sale_price),
         reorder_level = COALESCE($7, reorder_level),
         track_inventory = COALESCE($8, track_inventory),
         is_active = COALESCE($9, is_active),
         updated_at = NOW()
       WHERE id = $10 AND entity_id = $11
       RETURNING *`,
      [
        body.name_ar || null, body.item_type || null, body.category || null, body.unit_name || null,
        body.purchase_cost != null ? Number(body.purchase_cost) : null,
        body.sale_price != null ? Number(body.sale_price) : null,
        body.reorder_level != null ? Number(body.reorder_level) : null,
        body.track_inventory == null ? null : !!body.track_inventory,
        body.is_active == null ? null : !!body.is_active,
        req.params.id, entityId
      ]
    );
    if (!result.rows.length) return res.status(404).json({ success: false, error: 'الصنف غير موجود' });
    res.json({ success: true, item: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/warehouses', async (req, res) => {
  try {
    await ensureSchema();
    const entityId = resolveScopedEntityId(req, req.query.entity_id);
    if (!entityId) return res.status(400).json({ success: false, error: 'entity_id is required' });
    const result = await db.query(
      `SELECT * FROM finance_warehouses WHERE entity_id = $1 ORDER BY name_ar`,
      [entityId]
    );
    res.json({ success: true, entity_id: entityId, count: result.rows.length, warehouses: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/warehouses', async (req, res) => {
  try {
    await ensureSchema();
    const body = req.body || {};
    const entityId = resolveScopedEntityId(req, body.entity_id);
    const entityType = resolveScopedEntityType(req, body.entity_type);
    if (!entityId) return res.status(400).json({ success: false, error: 'entity_id is required' });
    const code = String(body.code || '').trim();
    const name = String(body.name_ar || '').trim();
    if (!code || !name) return res.status(400).json({ success: false, error: 'رمز المستودع والاسم مطلوبان' });
    const result = await db.query(
      `INSERT INTO finance_warehouses (code, name_ar, location_name, is_active, entity_id, entity_type, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [code, name, body.location_name || null, body.is_active !== false, entityId, entityType, actor(req)]
    );
    res.status(201).json({ success: true, warehouse: result.rows[0] });
  } catch (error) {
    const status = error.code === '23505' ? 409 : 500;
    res.status(status).json({ success: false, error: status === 409 ? 'رمز المستودع مستخدم داخل هذا الكيان' : error.message });
  }
});

router.put('/warehouses/:id', async (req, res) => {
  try {
    await ensureSchema();
    const body = req.body || {};
    const entityId = resolveScopedEntityId(req, body.entity_id || req.query.entity_id);
    if (!entityId) return res.status(400).json({ success: false, error: 'entity_id is required' });
    const result = await db.query(
      `UPDATE finance_warehouses SET
         name_ar = COALESCE($1, name_ar),
         location_name = COALESCE($2, location_name),
         is_active = COALESCE($3, is_active),
         updated_at = NOW()
       WHERE id = $4 AND entity_id = $5
       RETURNING *`,
      [
        body.name_ar || null,
        body.location_name || null,
        body.is_active == null ? null : !!body.is_active,
        req.params.id,
        entityId
      ]
    );
    if (!result.rows.length) return res.status(404).json({ success: false, error: 'المستودع غير موجود' });
    res.json({ success: true, warehouse: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/balances', async (req, res) => {
  try {
    await ensureSchema();
    const entityId = resolveScopedEntityId(req, req.query.entity_id);
    if (!entityId) return res.status(400).json({ success: false, error: 'entity_id is required' });
    const result = await db.query(
      `SELECT b.item_id, b.warehouse_id, b.qty, b.avg_cost,
              (b.qty * b.avg_cost) AS stock_value,
              i.sku, i.name_ar, i.unit_name, i.reorder_level, i.category,
              w.code AS warehouse_code, w.name_ar AS warehouse_name,
              (i.reorder_level > 0 AND b.qty <= i.reorder_level) AS low_stock
       FROM finance_stock_balances b
       JOIN finance_items i ON i.id = b.item_id
       JOIN finance_warehouses w ON w.id = b.warehouse_id
       WHERE b.entity_id = $1
       ORDER BY i.name_ar, w.name_ar`,
      [entityId]
    );
    const low = result.rows.filter((r) => r.low_stock && Number(r.reorder_level) > 0);
    res.json({
      success: true,
      entity_id: entityId,
      count: result.rows.length,
      low_stock_count: low.length,
      balances: result.rows
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/moves', async (req, res) => {
  try {
    await ensureSchema();
    const entityId = resolveScopedEntityId(req, req.query.entity_id);
    if (!entityId) return res.status(400).json({ success: false, error: 'entity_id is required' });
    const result = await db.query(
      `SELECT m.*, i.sku, i.name_ar AS item_name, w.name_ar AS warehouse_name, wt.name_ar AS warehouse_to_name
       FROM finance_stock_moves m
       JOIN finance_items i ON i.id = m.item_id
       JOIN finance_warehouses w ON w.id = m.warehouse_id
       LEFT JOIN finance_warehouses wt ON wt.id = m.warehouse_to_id
       WHERE m.entity_id = $1
       ORDER BY m.id DESC
       LIMIT 200`,
      [entityId]
    );
    res.json({ success: true, entity_id: entityId, count: result.rows.length, moves: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/moves', async (req, res) => {
  const client = await db.pool.connect();
  try {
    await ensureSchema();
    const body = req.body || {};
    const entityId = resolveScopedEntityId(req, body.entity_id);
    const entityType = resolveScopedEntityType(req, body.entity_type);
    if (!entityId) return res.status(400).json({ success: false, error: 'entity_id is required' });
    const moveType = String(body.move_type || '').toUpperCase();
    if (!['IN', 'OUT', 'TRANSFER', 'ADJUST'].includes(moveType)) {
      return res.status(400).json({ success: false, error: 'نوع الحركة غير مدعوم' });
    }
    const qty = Number(body.qty);
    if (!Number.isFinite(qty) || qty === 0 || (moveType !== 'ADJUST' && qty < 0)) {
      return res.status(400).json({ success: false, error: 'الكمية غير صحيحة' });
    }
    const itemId = Number(body.item_id);
    const warehouseId = Number(body.warehouse_id);
    const warehouseToId = body.warehouse_to_id ? Number(body.warehouse_to_id) : null;
    if (!itemId || !warehouseId) return res.status(400).json({ success: false, error: 'الصنف والمستودع مطلوبان' });
    if (moveType === 'TRANSFER' && !warehouseToId) {
      return res.status(400).json({ success: false, error: 'مستودع الوجهة مطلوب للتحويل' });
    }
    if (body.idempotency_key) {
      const dup = await db.query(
        `SELECT * FROM finance_stock_moves WHERE entity_id = $1 AND idempotency_key = $2`,
        [entityId, String(body.idempotency_key)]
      );
      if (dup.rows.length) return res.json({ success: true, duplicate: true, move: dup.rows[0] });
    }

    const neg = await allowNegative(req);
    await client.query('BEGIN');
    const item = await client.query(`SELECT * FROM finance_items WHERE id = $1 AND entity_id = $2`, [itemId, entityId]);
    if (!item.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, error: 'الصنف غير موجود في هذا الكيان' });
    }
    const wh = await client.query(`SELECT id FROM finance_warehouses WHERE id = $1 AND entity_id = $2`, [warehouseId, entityId]);
    if (!wh.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, error: 'المستودع غير موجود في هذا الكيان' });
    }
    if (item.rows[0].track_inventory === false) {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, error: 'هذا الصنف غير متتبع مخزنيًا' });
    }
    if (moveType === 'TRANSFER') {
      if (warehouseToId === warehouseId) {
        await client.query('ROLLBACK');
        return res.status(400).json({ success: false, error: 'مستودع الوجهة يجب أن يختلف عن المصدر' });
      }
      const dest = await client.query(
        `SELECT id FROM finance_warehouses WHERE id = $1 AND entity_id = $2`,
        [warehouseToId, entityId]
      );
      if (!dest.rows.length) {
        await client.query('ROLLBACK');
        return res.status(404).json({ success: false, error: 'مستودع الوجهة غير موجود في هذا الكيان' });
      }
    }

    const unitCost = body.unit_cost != null ? Number(body.unit_cost) : Number(item.rows[0].purchase_cost) || 0;
    if (moveType === 'IN' || (moveType === 'ADJUST' && qty > 0)) {
      const bal = await lockBalance(client, entityId, itemId, warehouseId);
      const next = applyIn(bal, Math.abs(qty), unitCost);
      await saveBalance(client, bal.id, next.qty, next.avg);
    } else if (moveType === 'OUT' || (moveType === 'ADJUST' && qty < 0)) {
      const bal = await lockBalance(client, entityId, itemId, warehouseId);
      const next = applyOut(bal, Math.abs(qty), neg);
      await saveBalance(client, bal.id, next.qty, next.avg);
    } else if (moveType === 'TRANSFER') {
      const src = await lockBalance(client, entityId, itemId, warehouseId);
      const out = applyOut(src, Math.abs(qty), neg);
      await saveBalance(client, src.id, out.qty, out.avg);
      const dst = await lockBalance(client, entityId, itemId, warehouseToId);
      const inn = applyIn(dst, Math.abs(qty), out.avg);
      await saveBalance(client, dst.id, inn.qty, inn.avg);
    }

    const moveNumber = await nextMoveNumber(client, entityId);
    const inserted = await client.query(
      `INSERT INTO finance_stock_moves (
         move_number, move_type, item_id, warehouse_id, warehouse_to_id, qty, unit_cost,
         status, notes, idempotency_key, entity_id, entity_type, created_by
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,'POSTED',$8,$9,$10,$11,$12)
       RETURNING *`,
      [
        moveNumber, moveType, itemId, warehouseId, warehouseToId, qty, unitCost,
        body.notes || null, body.idempotency_key || null, entityId, entityType, actor(req)
      ]
    );
    await client.query('COMMIT');
    res.status(201).json({ success: true, move: inserted.rows[0] });
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch (_) { /* */ }
    if (error.code === '23505' && req.body && req.body.idempotency_key) {
      const dup = await db.query(
        `SELECT * FROM finance_stock_moves WHERE entity_id = $1 AND idempotency_key = $2`,
        [resolveScopedEntityId(req, req.body.entity_id), String(req.body.idempotency_key)]
      );
      if (dup.rows.length) return res.json({ success: true, duplicate: true, move: dup.rows[0] });
    }
    const status = error.status || (error.code === '23505' ? 409 : 500);
    res.status(status).json({
      success: false,
      error: status === 409 ? 'حركة مكررة أو رقم حركة متعارض' : error.message
    });
  } finally {
    client.release();
  }
});

module.exports = router;
