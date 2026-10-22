'use strict';

/**
 * Finance inventory master data + stock movements.
 * Tables are ensured at runtime (CREATE IF NOT EXISTS) — no production migration files.
 */

const express = require('express');
const router = express.Router();
const db = require('../../db');
const { resolveScopedEntityId, resolveScopedEntityType } = require('./resolve-scoped-entity');

const MOVEMENT_TYPES = new Set(['OPENING', 'IN', 'OUT', 'TRANSFER', 'ADJUST']);
let tablesReady = false;

async function ensureInventoryTables() {
  if (tablesReady) return;
  await db.query(`
    CREATE TABLE IF NOT EXISTS finance_products (
      product_id SERIAL PRIMARY KEY,
      sku TEXT NOT NULL,
      name_ar TEXT NOT NULL,
      name_en TEXT,
      product_type TEXT NOT NULL DEFAULT 'GOODS',
      category TEXT,
      unit TEXT NOT NULL DEFAULT 'PCS',
      cost_price NUMERIC NOT NULL DEFAULT 0,
      sale_price NUMERIC NOT NULL DEFAULT 0,
      track_inventory BOOLEAN NOT NULL DEFAULT TRUE,
      reorder_level NUMERIC NOT NULL DEFAULT 0,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      entity_id TEXT NOT NULL DEFAULT 'HQ001',
      entity_type TEXT NOT NULL DEFAULT 'HQ',
      notes TEXT,
      created_by TEXT,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW(),
      UNIQUE (entity_id, sku)
    );

    CREATE TABLE IF NOT EXISTS finance_warehouses (
      warehouse_id SERIAL PRIMARY KEY,
      code TEXT NOT NULL,
      name_ar TEXT NOT NULL,
      location TEXT,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      entity_id TEXT NOT NULL DEFAULT 'HQ001',
      entity_type TEXT NOT NULL DEFAULT 'HQ',
      notes TEXT,
      created_by TEXT,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW(),
      UNIQUE (entity_id, code)
    );

    CREATE TABLE IF NOT EXISTS finance_stock_balances (
      balance_id SERIAL PRIMARY KEY,
      product_id INTEGER NOT NULL REFERENCES finance_products(product_id),
      warehouse_id INTEGER NOT NULL REFERENCES finance_warehouses(warehouse_id),
      quantity NUMERIC NOT NULL DEFAULT 0,
      avg_cost NUMERIC NOT NULL DEFAULT 0,
      entity_id TEXT NOT NULL DEFAULT 'HQ001',
      updated_at TIMESTAMP DEFAULT NOW(),
      UNIQUE (product_id, warehouse_id, entity_id)
    );

    CREATE TABLE IF NOT EXISTS finance_stock_movements (
      movement_id SERIAL PRIMARY KEY,
      movement_number TEXT UNIQUE NOT NULL,
      movement_type TEXT NOT NULL,
      product_id INTEGER NOT NULL REFERENCES finance_products(product_id),
      warehouse_id INTEGER NOT NULL REFERENCES finance_warehouses(warehouse_id),
      warehouse_to_id INTEGER REFERENCES finance_warehouses(warehouse_id),
      quantity NUMERIC NOT NULL,
      unit_cost NUMERIC NOT NULL DEFAULT 0,
      reference_type TEXT,
      reference_id TEXT,
      status TEXT NOT NULL DEFAULT 'POSTED',
      notes TEXT,
      entity_id TEXT NOT NULL DEFAULT 'HQ001',
      entity_type TEXT NOT NULL DEFAULT 'HQ',
      created_by TEXT,
      created_at TIMESTAMP DEFAULT NOW(),
      posted_at TIMESTAMP DEFAULT NOW(),
      cancelled_at TIMESTAMP,
      cancel_reason TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_fin_products_entity ON finance_products(entity_id);
    CREATE INDEX IF NOT EXISTS idx_fin_warehouses_entity ON finance_warehouses(entity_id);
    CREATE INDEX IF NOT EXISTS idx_fin_stock_bal_entity ON finance_stock_balances(entity_id);
    CREATE INDEX IF NOT EXISTS idx_fin_stock_mov_entity ON finance_stock_movements(entity_id);
    CREATE INDEX IF NOT EXISTS idx_fin_stock_mov_product ON finance_stock_movements(product_id, warehouse_id);
  `);
  tablesReady = true;
}

function requireEntity(req, res) {
  const entityId = resolveScopedEntityId(req, req.query.entity_id || (req.body && req.body.entity_id));
  if (!entityId) {
    res.status(400).json({ success: false, error: 'entity_id مطلوب', code: 'ENTITY_REQUIRED' });
    return null;
  }
  return {
    entityId,
    entityType: resolveScopedEntityType(req, req.query.entity_type || (req.body && req.body.entity_type)) || 'HQ'
  };
}

function readText(v, fallback = '') {
  if (v === undefined || v === null) return fallback;
  return String(v).trim();
}

function toNum(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function movementNumber(prefix = 'STM') {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 900 + 100)}`;
}

async function getOrCreateBalance(client, productId, warehouseId, entityId) {
  const existing = await client.query(
    `SELECT * FROM finance_stock_balances
     WHERE product_id = $1 AND warehouse_id = $2 AND entity_id = $3
     FOR UPDATE`,
    [productId, warehouseId, entityId]
  );
  if (existing.rows[0]) return existing.rows[0];
  const created = await client.query(
    `INSERT INTO finance_stock_balances (product_id, warehouse_id, quantity, avg_cost, entity_id)
     VALUES ($1,$2,0,0,$3) RETURNING *`,
    [productId, warehouseId, entityId]
  );
  return created.rows[0];
}

async function applyQtyDelta(client, { productId, warehouseId, entityId, qtyDelta, unitCost, allowNegative }) {
  const bal = await getOrCreateBalance(client, productId, warehouseId, entityId);
  const currentQty = toNum(bal.quantity);
  const nextQty = currentQty + qtyDelta;
  if (!allowNegative && nextQty < -0.000001) {
    const err = new Error('الرصيد غير كافٍ — سياسة منع الرصيد السالب');
    err.code = 'NEGATIVE_STOCK';
    err.status = 409;
    throw err;
  }

  let nextAvg = toNum(bal.avg_cost);
  if (qtyDelta > 0 && unitCost != null) {
    const cost = toNum(unitCost);
    const incomingValue = qtyDelta * cost;
    const currentValue = currentQty * nextAvg;
    nextAvg = nextQty > 0 ? (currentValue + incomingValue) / nextQty : cost;
  }

  const updated = await client.query(
    `UPDATE finance_stock_balances
     SET quantity = $4, avg_cost = $5, updated_at = NOW()
     WHERE balance_id = $1 AND product_id = $2 AND warehouse_id = $3
     RETURNING *`,
    [bal.balance_id, productId, warehouseId, nextQty, nextAvg]
  );
  return updated.rows[0];
}

async function postMovement(client, {
  movementType,
  productId,
  warehouseId,
  warehouseToId,
  quantity,
  unitCost,
  referenceType,
  referenceId,
  notes,
  entityId,
  entityType,
  createdBy,
  allowNegative
}) {
  const type = String(movementType || '').toUpperCase();
  if (!MOVEMENT_TYPES.has(type)) {
    const err = new Error('نوع الحركة غير مدعوم');
    err.code = 'INVALID_MOVEMENT_TYPE';
    err.status = 400;
    throw err;
  }
  const qty = Math.abs(toNum(quantity));
  if (qty <= 0) {
    const err = new Error('الكمية يجب أن تكون أكبر من صفر');
    err.code = 'INVALID_QTY';
    err.status = 400;
    throw err;
  }

  const product = await client.query(
    `SELECT * FROM finance_products WHERE product_id = $1 AND entity_id = $2 FOR UPDATE`,
    [productId, entityId]
  );
  if (!product.rows[0]) {
    const err = new Error('الصنف غير موجود');
    err.code = 'PRODUCT_NOT_FOUND';
    err.status = 404;
    throw err;
  }
  if (!product.rows[0].track_inventory) {
    const err = new Error('هذا الصنف غير متابع مخزنيًا');
    err.code = 'NOT_TRACKED';
    err.status = 409;
    throw err;
  }

  const wh = await client.query(
    `SELECT warehouse_id FROM finance_warehouses WHERE warehouse_id = $1 AND entity_id = $2`,
    [warehouseId, entityId]
  );
  if (!wh.rows[0]) {
    const err = new Error('المستودع غير موجود');
    err.code = 'WAREHOUSE_NOT_FOUND';
    err.status = 404;
    throw err;
  }

  if (type === 'TRANSFER') {
    if (!warehouseToId || Number(warehouseToId) === Number(warehouseId)) {
      const err = new Error('مستودع الوجهة مطلوب ومختلف عن المصدر');
      err.code = 'TRANSFER_TARGET_REQUIRED';
      err.status = 400;
      throw err;
    }
    const whTo = await client.query(
      `SELECT warehouse_id FROM finance_warehouses WHERE warehouse_id = $1 AND entity_id = $2`,
      [warehouseToId, entityId]
    );
    if (!whTo.rows[0]) {
      const err = new Error('مستودع الوجهة غير موجود');
      err.code = 'WAREHOUSE_TO_NOT_FOUND';
      err.status = 404;
      throw err;
    }
  }

  const cost = unitCost != null ? toNum(unitCost) : toNum(product.rows[0].cost_price);
  const number = movementNumber(type === 'OPENING' ? 'OPN' : 'STM');

  if (type === 'OPENING' || type === 'IN') {
    await applyQtyDelta(client, {
      productId,
      warehouseId,
      entityId,
      qtyDelta: qty,
      unitCost: cost,
      allowNegative: !!allowNegative
    });
  } else if (type === 'OUT') {
    await applyQtyDelta(client, {
      productId,
      warehouseId,
      entityId,
      qtyDelta: -qty,
      unitCost: null,
      allowNegative: !!allowNegative
    });
  } else if (type === 'ADJUST') {
    // quantity signed via notes convention: positive increase, negative decrease via signed body.quantity
    const signed = toNum(quantity);
    await applyQtyDelta(client, {
      productId,
      warehouseId,
      entityId,
      qtyDelta: signed,
      unitCost: signed > 0 ? cost : null,
      allowNegative: !!allowNegative
    });
  } else if (type === 'TRANSFER') {
    await applyQtyDelta(client, {
      productId,
      warehouseId,
      entityId,
      qtyDelta: -qty,
      unitCost: null,
      allowNegative: !!allowNegative
    });
    await applyQtyDelta(client, {
      productId,
      warehouseId: warehouseToId,
      entityId,
      qtyDelta: qty,
      unitCost: cost,
      allowNegative: true
    });
  }

  const movQty = type === 'ADJUST' ? toNum(quantity) : qty;
  const inserted = await client.query(
    `INSERT INTO finance_stock_movements (
      movement_number, movement_type, product_id, warehouse_id, warehouse_to_id,
      quantity, unit_cost, reference_type, reference_id, status, notes,
      entity_id, entity_type, created_by
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'POSTED',$10,$11,$12,$13)
    RETURNING *`,
    [
      number,
      type,
      productId,
      warehouseId,
      warehouseToId || null,
      movQty,
      cost,
      referenceType || null,
      referenceId != null ? String(referenceId) : null,
      notes || null,
      entityId,
      entityType,
      createdBy || 'ui'
    ]
  );
  return inserted.rows[0];
}

// ---------- Products ----------
router.get('/products', async (req, res) => {
  try {
    await ensureInventoryTables();
    const scope = requireEntity(req, res);
    if (!scope) return;
    const q = readText(req.query.q).toLowerCase();
    const onlyActive = String(req.query.active || '') === '1';
    const params = [scope.entityId];
    let sql = `SELECT * FROM finance_products WHERE entity_id = $1`;
    if (onlyActive) sql += ` AND is_active = TRUE`;
    if (q) {
      params.push(`%${q}%`);
      sql += ` AND (LOWER(sku) LIKE $2 OR LOWER(name_ar) LIKE $2 OR LOWER(COALESCE(name_en,'')) LIKE $2 OR LOWER(COALESCE(category,'')) LIKE $2)`;
    }
    sql += ` ORDER BY product_id DESC`;
    const r = await db.query(sql, params);
    res.json({ success: true, products: r.rows, count: r.rows.length });
  } catch (e) {
    console.error('inventory products list', e);
    res.status(500).json({ success: false, error: e.message });
  }
});

router.post('/products', async (req, res) => {
  try {
    await ensureInventoryTables();
    const scope = requireEntity(req, res);
    if (!scope) return;
    const b = req.body || {};
    const nameAr = readText(b.name_ar);
    if (!nameAr) {
      return res.status(400).json({ success: false, error: 'اسم الصنف بالعربية إلزامي', code: 'NAME_REQUIRED' });
    }
    const sku = readText(b.sku) || `SKU-${Date.now().toString().slice(-8)}`;
    const r = await db.query(
      `INSERT INTO finance_products (
        sku, name_ar, name_en, product_type, category, unit, cost_price, sale_price,
        track_inventory, reorder_level, is_active, entity_id, entity_type, notes, created_by
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
      RETURNING *`,
      [
        sku,
        nameAr,
        readText(b.name_en) || null,
        readText(b.product_type, 'GOODS').toUpperCase() || 'GOODS',
        readText(b.category) || null,
        readText(b.unit, 'PCS') || 'PCS',
        toNum(b.cost_price),
        toNum(b.sale_price),
        b.track_inventory === false || b.track_inventory === 'false' ? false : true,
        toNum(b.reorder_level),
        b.is_active === false || b.is_active === 'false' ? false : true,
        scope.entityId,
        scope.entityType,
        readText(b.notes) || null,
        readText(b.created_by, 'ui')
      ]
    );
    res.status(201).json({ success: true, product: r.rows[0] });
  } catch (e) {
    const status = e.code === '23505' ? 409 : 500;
    res.status(status).json({
      success: false,
      error: e.code === '23505' ? 'رمز الصنف (SKU) مكرر لنفس الكيان' : e.message,
      code: e.code === '23505' ? 'DUPLICATE_SKU' : 'ERROR'
    });
  }
});

router.put('/products/:id', async (req, res) => {
  try {
    await ensureInventoryTables();
    const scope = requireEntity(req, res);
    if (!scope) return;
    const b = req.body || {};
    const r = await db.query(
      `UPDATE finance_products SET
        sku = COALESCE($3, sku),
        name_ar = COALESCE($4, name_ar),
        name_en = COALESCE($5, name_en),
        product_type = COALESCE($6, product_type),
        category = COALESCE($7, category),
        unit = COALESCE($8, unit),
        cost_price = COALESCE($9, cost_price),
        sale_price = COALESCE($10, sale_price),
        track_inventory = COALESCE($11, track_inventory),
        reorder_level = COALESCE($12, reorder_level),
        is_active = COALESCE($13, is_active),
        notes = COALESCE($14, notes),
        updated_at = NOW()
       WHERE product_id = $1 AND entity_id = $2
       RETURNING *`,
      [
        req.params.id,
        scope.entityId,
        b.sku != null ? readText(b.sku) : null,
        b.name_ar != null ? readText(b.name_ar) : null,
        b.name_en != null ? readText(b.name_en) : null,
        b.product_type != null ? readText(b.product_type).toUpperCase() : null,
        b.category != null ? readText(b.category) : null,
        b.unit != null ? readText(b.unit) : null,
        b.cost_price != null ? toNum(b.cost_price) : null,
        b.sale_price != null ? toNum(b.sale_price) : null,
        b.track_inventory != null ? !(b.track_inventory === false || b.track_inventory === 'false') : null,
        b.reorder_level != null ? toNum(b.reorder_level) : null,
        b.is_active != null ? !(b.is_active === false || b.is_active === 'false') : null,
        b.notes != null ? readText(b.notes) : null
      ]
    );
    if (!r.rows[0]) return res.status(404).json({ success: false, error: 'الصنف غير موجود' });
    res.json({ success: true, product: r.rows[0] });
  } catch (e) {
    const status = e.code === '23505' ? 409 : 500;
    res.status(status).json({ success: false, error: e.message });
  }
});

router.delete('/products/:id', async (req, res) => {
  const client = await db.pool.connect();
  try {
    await ensureInventoryTables();
    const scope = requireEntity(req, res);
    if (!scope) return;
    await client.query('BEGIN');
    const bal = await client.query(
      `SELECT COALESCE(SUM(ABS(quantity)),0)::float AS q
       FROM finance_stock_balances WHERE product_id = $1 AND entity_id = $2`,
      [req.params.id, scope.entityId]
    );
    const mov = await client.query(
      `SELECT COUNT(*)::int AS n FROM finance_stock_movements
       WHERE product_id = $1 AND entity_id = $2 AND status = 'POSTED'`,
      [req.params.id, scope.entityId]
    );
    if (toNum(bal.rows[0].q) > 0.0001 || mov.rows[0].n > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({
        success: false,
        error: 'لا يمكن حذف صنف له حركات أو رصيد. عطّله بدل الحذف.',
        code: 'HAS_STOCK_HISTORY'
      });
    }
    const r = await client.query(
      `DELETE FROM finance_products WHERE product_id = $1 AND entity_id = $2 RETURNING product_id`,
      [req.params.id, scope.entityId]
    );
    if (!r.rows[0]) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, error: 'الصنف غير موجود' });
    }
    await client.query('COMMIT');
    res.json({ success: true, deleted: r.rows[0].product_id });
  } catch (e) {
    try { await client.query('ROLLBACK'); } catch { /* */ }
    res.status(500).json({ success: false, error: e.message });
  } finally {
    client.release();
  }
});

// ---------- Warehouses ----------
router.get('/warehouses', async (req, res) => {
  try {
    await ensureInventoryTables();
    const scope = requireEntity(req, res);
    if (!scope) return;
    const r = await db.query(
      `SELECT * FROM finance_warehouses WHERE entity_id = $1 ORDER BY warehouse_id DESC`,
      [scope.entityId]
    );
    res.json({ success: true, warehouses: r.rows, count: r.rows.length });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.post('/warehouses', async (req, res) => {
  try {
    await ensureInventoryTables();
    const scope = requireEntity(req, res);
    if (!scope) return;
    const b = req.body || {};
    const nameAr = readText(b.name_ar);
    if (!nameAr) {
      return res.status(400).json({ success: false, error: 'اسم المستودع إلزامي' });
    }
    const code = readText(b.code) || `WH-${Date.now().toString().slice(-6)}`;
    const r = await db.query(
      `INSERT INTO finance_warehouses
        (code, name_ar, location, is_active, entity_id, entity_type, notes, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [
        code,
        nameAr,
        readText(b.location) || null,
        b.is_active === false || b.is_active === 'false' ? false : true,
        scope.entityId,
        scope.entityType,
        readText(b.notes) || null,
        readText(b.created_by, 'ui')
      ]
    );
    res.status(201).json({ success: true, warehouse: r.rows[0] });
  } catch (e) {
    const status = e.code === '23505' ? 409 : 500;
    res.status(status).json({
      success: false,
      error: e.code === '23505' ? 'رمز المستودع مكرر' : e.message
    });
  }
});

router.put('/warehouses/:id', async (req, res) => {
  try {
    await ensureInventoryTables();
    const scope = requireEntity(req, res);
    if (!scope) return;
    const b = req.body || {};
    const r = await db.query(
      `UPDATE finance_warehouses SET
        code = COALESCE($3, code),
        name_ar = COALESCE($4, name_ar),
        location = COALESCE($5, location),
        is_active = COALESCE($6, is_active),
        notes = COALESCE($7, notes),
        updated_at = NOW()
       WHERE warehouse_id = $1 AND entity_id = $2
       RETURNING *`,
      [
        req.params.id,
        scope.entityId,
        b.code != null ? readText(b.code) : null,
        b.name_ar != null ? readText(b.name_ar) : null,
        b.location != null ? readText(b.location) : null,
        b.is_active != null ? !(b.is_active === false || b.is_active === 'false') : null,
        b.notes != null ? readText(b.notes) : null
      ]
    );
    if (!r.rows[0]) return res.status(404).json({ success: false, error: 'المستودع غير موجود' });
    res.json({ success: true, warehouse: r.rows[0] });
  } catch (e) {
    res.status(e.code === '23505' ? 409 : 500).json({ success: false, error: e.message });
  }
});

// ---------- Balances / summary ----------
router.get('/balances', async (req, res) => {
  try {
    await ensureInventoryTables();
    const scope = requireEntity(req, res);
    if (!scope) return;
    const lowOnly = String(req.query.low_stock || '') === '1';
    const params = [scope.entityId];
    let sql = `
      SELECT b.*,
             p.sku, p.name_ar, p.unit, p.reorder_level, p.cost_price, p.sale_price, p.track_inventory,
             w.code AS warehouse_code, w.name_ar AS warehouse_name,
             (b.quantity * b.avg_cost) AS stock_value
      FROM finance_stock_balances b
      JOIN finance_products p ON p.product_id = b.product_id
      JOIN finance_warehouses w ON w.warehouse_id = b.warehouse_id
      WHERE b.entity_id = $1 AND p.track_inventory = TRUE`;
    if (lowOnly) {
      sql += ` AND b.quantity <= p.reorder_level`;
    }
    if (req.query.warehouse_id) {
      params.push(req.query.warehouse_id);
      sql += ` AND b.warehouse_id = $${params.length}`;
    }
    if (req.query.product_id) {
      params.push(req.query.product_id);
      sql += ` AND b.product_id = $${params.length}`;
    }
    sql += ` ORDER BY p.name_ar, w.name_ar`;
    const r = await db.query(sql, params);
    const totalValue = r.rows.reduce((s, row) => s + toNum(row.stock_value), 0);
    const lowCount = r.rows.filter((row) => toNum(row.quantity) <= toNum(row.reorder_level)).length;
    res.json({
      success: true,
      balances: r.rows,
      count: r.rows.length,
      summary: {
        lines: r.rows.length,
        total_value: totalValue,
        low_stock_count: lowCount
      }
    });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.get('/summary', async (req, res) => {
  try {
    await ensureInventoryTables();
    const scope = requireEntity(req, res);
    if (!scope) return;
    const [products, warehouses, value, low, movements] = await Promise.all([
      db.query(`SELECT COUNT(*)::int AS n FROM finance_products WHERE entity_id = $1 AND is_active = TRUE`, [scope.entityId]),
      db.query(`SELECT COUNT(*)::int AS n FROM finance_warehouses WHERE entity_id = $1 AND is_active = TRUE`, [scope.entityId]),
      db.query(
        `SELECT COALESCE(SUM(b.quantity * b.avg_cost),0)::float AS v,
                COALESCE(SUM(b.quantity),0)::float AS q
         FROM finance_stock_balances b
         JOIN finance_products p ON p.product_id = b.product_id
         WHERE b.entity_id = $1 AND p.track_inventory = TRUE`,
        [scope.entityId]
      ),
      db.query(
        `SELECT COUNT(*)::int AS n
         FROM finance_stock_balances b
         JOIN finance_products p ON p.product_id = b.product_id
         WHERE b.entity_id = $1 AND p.track_inventory = TRUE AND b.quantity <= p.reorder_level`,
        [scope.entityId]
      ),
      db.query(
        `SELECT COUNT(*)::int AS n FROM finance_stock_movements
         WHERE entity_id = $1 AND status = 'POSTED'`,
        [scope.entityId]
      )
    ]);
    res.json({
      success: true,
      summary: {
        active_products: products.rows[0].n,
        active_warehouses: warehouses.rows[0].n,
        on_hand_qty: value.rows[0].q,
        stock_value: value.rows[0].v,
        low_stock_count: low.rows[0].n,
        posted_movements: movements.rows[0].n
      }
    });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ---------- Movements ----------
router.get('/movements', async (req, res) => {
  try {
    await ensureInventoryTables();
    const scope = requireEntity(req, res);
    if (!scope) return;
    const params = [scope.entityId];
    let sql = `
      SELECT m.*,
             p.sku, p.name_ar AS product_name,
             w.name_ar AS warehouse_name,
             wt.name_ar AS warehouse_to_name
      FROM finance_stock_movements m
      JOIN finance_products p ON p.product_id = m.product_id
      JOIN finance_warehouses w ON w.warehouse_id = m.warehouse_id
      LEFT JOIN finance_warehouses wt ON wt.warehouse_id = m.warehouse_to_id
      WHERE m.entity_id = $1`;
    if (req.query.status) {
      params.push(String(req.query.status).toUpperCase());
      sql += ` AND m.status = $${params.length}`;
    }
    if (req.query.product_id) {
      params.push(req.query.product_id);
      sql += ` AND m.product_id = $${params.length}`;
    }
    if (req.query.q) {
      params.push(`%${String(req.query.q).toLowerCase()}%`);
      sql += ` AND (LOWER(m.movement_number) LIKE $${params.length} OR LOWER(p.sku) LIKE $${params.length} OR LOWER(p.name_ar) LIKE $${params.length})`;
    }
    sql += ` ORDER BY m.movement_id DESC LIMIT 500`;
    const r = await db.query(sql, params);
    res.json({ success: true, movements: r.rows, count: r.rows.length });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.post('/movements', async (req, res) => {
  const client = await db.pool.connect();
  try {
    await ensureInventoryTables();
    const scope = requireEntity(req, res);
    if (!scope) return;
    const b = req.body || {};
    await client.query('BEGIN');
    const movement = await postMovement(client, {
      movementType: b.movement_type,
      productId: b.product_id,
      warehouseId: b.warehouse_id,
      warehouseToId: b.warehouse_to_id,
      quantity: b.quantity,
      unitCost: b.unit_cost,
      referenceType: b.reference_type || 'MANUAL',
      referenceId: b.reference_id,
      notes: b.notes,
      entityId: scope.entityId,
      entityType: scope.entityType,
      createdBy: b.created_by || 'ui',
      allowNegative: b.allow_negative === true
    });
    await client.query('COMMIT');
    res.status(201).json({ success: true, movement });
  } catch (e) {
    try { await client.query('ROLLBACK'); } catch { /* */ }
    res.status(e.status || 500).json({ success: false, error: e.message, code: e.code || 'ERROR' });
  } finally {
    client.release();
  }
});

router.post('/movements/:id/cancel', async (req, res) => {
  const client = await db.pool.connect();
  try {
    await ensureInventoryTables();
    const scope = requireEntity(req, res);
    if (!scope) return;
    const reason = readText(req.body && req.body.reason);
    if (!reason) {
      return res.status(400).json({ success: false, error: 'سبب الإلغاء إلزامي', code: 'REASON_REQUIRED' });
    }
    await client.query('BEGIN');
    const movRes = await client.query(
      `SELECT * FROM finance_stock_movements
       WHERE movement_id = $1 AND entity_id = $2 FOR UPDATE`,
      [req.params.id, scope.entityId]
    );
    if (!movRes.rows[0]) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, error: 'الحركة غير موجودة' });
    }
    const mov = movRes.rows[0];
    if (String(mov.status).toUpperCase() === 'CANCELLED') {
      await client.query('ROLLBACK');
      return res.status(409).json({ success: false, error: 'الحركة ملغاة مسبقًا', code: 'ALREADY_CANCELLED' });
    }

    const type = String(mov.movement_type).toUpperCase();
    const qty = Math.abs(toNum(mov.quantity));
    if (type === 'OPENING' || type === 'IN') {
      await applyQtyDelta(client, {
        productId: mov.product_id,
        warehouseId: mov.warehouse_id,
        entityId: scope.entityId,
        qtyDelta: -qty,
        unitCost: null,
        allowNegative: false
      });
    } else if (type === 'OUT') {
      await applyQtyDelta(client, {
        productId: mov.product_id,
        warehouseId: mov.warehouse_id,
        entityId: scope.entityId,
        qtyDelta: qty,
        unitCost: toNum(mov.unit_cost),
        allowNegative: true
      });
    } else if (type === 'ADJUST') {
      await applyQtyDelta(client, {
        productId: mov.product_id,
        warehouseId: mov.warehouse_id,
        entityId: scope.entityId,
        qtyDelta: -toNum(mov.quantity),
        unitCost: toNum(mov.quantity) < 0 ? toNum(mov.unit_cost) : null,
        allowNegative: false
      });
    } else if (type === 'TRANSFER') {
      await applyQtyDelta(client, {
        productId: mov.product_id,
        warehouseId: mov.warehouse_to_id,
        entityId: scope.entityId,
        qtyDelta: -qty,
        unitCost: null,
        allowNegative: false
      });
      await applyQtyDelta(client, {
        productId: mov.product_id,
        warehouseId: mov.warehouse_id,
        entityId: scope.entityId,
        qtyDelta: qty,
        unitCost: toNum(mov.unit_cost),
        allowNegative: true
      });
    }

    const updated = await client.query(
      `UPDATE finance_stock_movements
       SET status = 'CANCELLED', cancelled_at = NOW(), cancel_reason = $2
       WHERE movement_id = $1 RETURNING *`,
      [mov.movement_id, reason]
    );
    await client.query('COMMIT');
    res.json({ success: true, movement: updated.rows[0], message: 'تم إلغاء الحركة وعكس أثرها على الرصيد' });
  } catch (e) {
    try { await client.query('ROLLBACK'); } catch { /* */ }
    res.status(e.status || 500).json({ success: false, error: e.message, code: e.code || 'ERROR' });
  } finally {
    client.release();
  }
});

module.exports = router;
module.exports.ensureInventoryTables = ensureInventoryTables;
module.exports.postMovement = postMovement;
module.exports.applyQtyDelta = applyQtyDelta;
