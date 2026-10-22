'use strict';

const express = require('express');
const router = express.Router();
const db = require('../../db');
const { resolveScopedEntityId, resolveScopedEntityType } = require('./resolve-scoped-entity');
const inventoryApi = require('./inventory');

let tablesReady = false;

async function ensureTables() {
  if (tablesReady) return;
  await db.query(`
    CREATE TABLE IF NOT EXISTS finance_purchase_orders (
      po_id SERIAL PRIMARY KEY,
      po_number TEXT UNIQUE NOT NULL,
      vendor_id INTEGER,
      vendor_name TEXT,
      order_date DATE NOT NULL DEFAULT CURRENT_DATE,
      expected_date DATE,
      status TEXT NOT NULL DEFAULT 'DRAFT',
      total_amount NUMERIC NOT NULL DEFAULT 0,
      notes TEXT,
      entity_id TEXT DEFAULT 'HQ001',
      entity_type TEXT DEFAULT 'HQ',
      created_by TEXT,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS finance_vendor_invoices (
      vendor_invoice_id SERIAL PRIMARY KEY,
      invoice_number TEXT UNIQUE NOT NULL,
      vendor_id INTEGER,
      vendor_name TEXT,
      po_id INTEGER,
      invoice_date DATE NOT NULL DEFAULT CURRENT_DATE,
      due_date DATE,
      status TEXT NOT NULL DEFAULT 'OPEN',
      total_amount NUMERIC NOT NULL DEFAULT 0,
      paid_amount NUMERIC NOT NULL DEFAULT 0,
      notes TEXT,
      entity_id TEXT DEFAULT 'HQ001',
      entity_type TEXT DEFAULT 'HQ',
      created_by TEXT,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS finance_purchase_order_lines (
      line_id SERIAL PRIMARY KEY,
      po_id INTEGER NOT NULL REFERENCES finance_purchase_orders(po_id) ON DELETE CASCADE,
      product_id INTEGER,
      description TEXT,
      qty NUMERIC NOT NULL DEFAULT 0,
      unit_cost NUMERIC NOT NULL DEFAULT 0,
      received_qty NUMERIC NOT NULL DEFAULT 0,
      line_total NUMERIC NOT NULL DEFAULT 0,
      created_at TIMESTAMP DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_po_entity ON finance_purchase_orders(entity_id);
    CREATE INDEX IF NOT EXISTS idx_vi_entity ON finance_vendor_invoices(entity_id);
    CREATE INDEX IF NOT EXISTS idx_po_lines_po ON finance_purchase_order_lines(po_id);
  `);
  await inventoryApi.ensureInventoryTables();
  tablesReady = true;
}

function scopeEntity(req, body) {
  const entity_id = resolveScopedEntityId(req, (body && body.entity_id) || req.query.entity_id);
  const entity_type = resolveScopedEntityType(req, (body && body.entity_type) || req.query.entity_type) || 'HQ';
  return { entity_id, entity_type };
}

function toNum(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

async function loadLines(poId) {
  const r = await db.query(
    `SELECT l.*, p.sku, p.name_ar AS product_name
     FROM finance_purchase_order_lines l
     LEFT JOIN finance_products p ON p.product_id = l.product_id
     WHERE l.po_id = $1
     ORDER BY l.line_id`,
    [poId]
  );
  return r.rows;
}

async function replaceLines(client, poId, lines) {
  await client.query(`DELETE FROM finance_purchase_order_lines WHERE po_id = $1`, [poId]);
  let total = 0;
  const inserted = [];
  for (const line of lines || []) {
    const qty = toNum(line.qty);
    const unitCost = toNum(line.unit_cost);
    const lineTotal = qty * unitCost;
    total += lineTotal;
    const r = await client.query(
      `INSERT INTO finance_purchase_order_lines
        (po_id, product_id, description, qty, unit_cost, received_qty, line_total)
       VALUES ($1,$2,$3,$4,$5,0,$6) RETURNING *`,
      [
        poId,
        line.product_id || null,
        line.description || null,
        qty,
        unitCost,
        lineTotal
      ]
    );
    inserted.push(r.rows[0]);
  }
  await client.query(
    `UPDATE finance_purchase_orders SET total_amount = $2, updated_at = NOW() WHERE po_id = $1`,
    [poId, total]
  );
  return { lines: inserted, total };
}

router.get('/orders', async (req, res) => {
  try {
    await ensureTables();
    const { entity_id } = scopeEntity(req);
    if (!entity_id) return res.status(400).json({ success: false, error: 'entity_id مطلوب' });
    const q = String(req.query.q || '').trim().toLowerCase();
    const params = [entity_id];
    let sql = `SELECT * FROM finance_purchase_orders WHERE entity_id = $1`;
    if (q) {
      params.push(`%${q}%`);
      sql += ` AND (LOWER(po_number) LIKE $2 OR LOWER(COALESCE(vendor_name,'')) LIKE $2 OR LOWER(COALESCE(status,'')) LIKE $2)`;
    }
    sql += ` ORDER BY po_id DESC`;
    const r = await db.query(sql, params);
    res.json({ success: true, orders: r.rows, count: r.rows.length });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.get('/orders/:id', async (req, res) => {
  try {
    await ensureTables();
    const { entity_id } = scopeEntity(req);
    const r = await db.query(
      `SELECT * FROM finance_purchase_orders WHERE po_id = $1 AND entity_id = $2`,
      [req.params.id, entity_id]
    );
    if (!r.rows[0]) return res.status(404).json({ success: false, error: 'أمر الشراء غير موجود' });
    const lines = await loadLines(req.params.id);
    res.json({ success: true, order: r.rows[0], lines });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.post('/orders', async (req, res) => {
  const client = await db.pool.connect();
  try {
    await ensureTables();
    const b = req.body || {};
    const { entity_id, entity_type } = scopeEntity(req, b);
    if (!entity_id) return res.status(400).json({ success: false, error: 'entity_id مطلوب' });
    const poNumber = b.po_number || `PO-${Date.now()}`;
    await client.query('BEGIN');
    const r = await client.query(
      `INSERT INTO finance_purchase_orders
        (po_number, vendor_id, vendor_name, order_date, expected_date, status, total_amount, notes, entity_id, entity_type, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [
        poNumber,
        b.vendor_id || null,
        b.vendor_name || null,
        b.order_date || new Date().toISOString().slice(0, 10),
        b.expected_date || null,
        b.status || 'OPEN',
        toNum(b.total_amount),
        b.notes || null,
        entity_id,
        entity_type,
        b.created_by || 'ui'
      ]
    );
    let order = r.rows[0];
    let lines = [];
    if (Array.isArray(b.lines) && b.lines.length) {
      const replaced = await replaceLines(client, order.po_id, b.lines);
      lines = replaced.lines;
      const refreshed = await client.query(`SELECT * FROM finance_purchase_orders WHERE po_id = $1`, [order.po_id]);
      order = refreshed.rows[0];
    }
    await client.query('COMMIT');
    res.status(201).json({ success: true, order, lines });
  } catch (e) {
    try { await client.query('ROLLBACK'); } catch { /* */ }
    res.status(e.code === '23505' ? 409 : 500).json({ success: false, error: e.message });
  } finally {
    client.release();
  }
});

router.put('/orders/:id', async (req, res) => {
  const client = await db.pool.connect();
  try {
    await ensureTables();
    const b = req.body || {};
    const { entity_id } = scopeEntity(req, b);
    await client.query('BEGIN');
    const existing = await client.query(
      `SELECT * FROM finance_purchase_orders WHERE po_id = $1 AND entity_id = $2 FOR UPDATE`,
      [req.params.id, entity_id]
    );
    if (!existing.rows[0]) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, error: 'أمر الشراء غير موجود' });
    }
    const status = String(existing.rows[0].status || '').toUpperCase();
    if (['RECEIVED', 'CANCELLED'].includes(status) && Array.isArray(b.lines)) {
      await client.query('ROLLBACK');
      return res.status(409).json({
        success: false,
        error: 'لا يمكن تعديل بنود أمر مستلم أو ملغى',
        code: 'PO_LOCKED'
      });
    }
    const r = await client.query(
      `UPDATE finance_purchase_orders SET
        vendor_id = COALESCE($3, vendor_id),
        vendor_name = COALESCE($4, vendor_name),
        order_date = COALESCE($5, order_date),
        expected_date = COALESCE($6, expected_date),
        status = COALESCE($7, status),
        total_amount = COALESCE($8, total_amount),
        notes = COALESCE($9, notes),
        updated_at = NOW()
       WHERE po_id = $1 AND entity_id = $2 RETURNING *`,
      [
        req.params.id,
        entity_id,
        b.vendor_id != null ? b.vendor_id : null,
        b.vendor_name != null ? b.vendor_name : null,
        b.order_date || null,
        b.expected_date || null,
        b.status || null,
        b.total_amount != null ? toNum(b.total_amount) : null,
        b.notes != null ? b.notes : null
      ]
    );
    let lines = await loadLines(req.params.id);
    if (Array.isArray(b.lines)) {
      const replaced = await replaceLines(client, req.params.id, b.lines);
      lines = replaced.lines;
    }
    const refreshed = await client.query(`SELECT * FROM finance_purchase_orders WHERE po_id = $1`, [req.params.id]);
    await client.query('COMMIT');
    res.json({ success: true, order: refreshed.rows[0] || r.rows[0], lines });
  } catch (e) {
    try { await client.query('ROLLBACK'); } catch { /* */ }
    res.status(500).json({ success: false, error: e.message });
  } finally {
    client.release();
  }
});

router.delete('/orders/:id', async (req, res) => {
  try {
    await ensureTables();
    const { entity_id } = scopeEntity(req);
    const existing = await db.query(
      `SELECT * FROM finance_purchase_orders WHERE po_id = $1 AND entity_id = $2`,
      [req.params.id, entity_id]
    );
    if (!existing.rows[0]) return res.status(404).json({ success: false, error: 'not found' });
    const status = String(existing.rows[0].status || '').toUpperCase();
    if (['PARTIAL', 'RECEIVED'].includes(status)) {
      return res.status(409).json({
        success: false,
        error: 'لا يمكن حذف أمر شراء تم استلامه. ألغِ الاستلامات أولًا أو علّم الحالة CANCELLED.',
        code: 'HAS_RECEIPTS'
      });
    }
    const r = await db.query(
      `DELETE FROM finance_purchase_orders WHERE po_id = $1 AND entity_id = $2 RETURNING po_id`,
      [req.params.id, entity_id]
    );
    res.json({ success: true, deleted: r.rows[0].po_id });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

/**
 * Receive PO lines into a warehouse → stock IN movements (atomic).
 * body: { warehouse_id, lines: [{ line_id, qty }], notes, created_by }
 */
router.post('/orders/:id/receive', async (req, res) => {
  const client = await db.pool.connect();
  try {
    await ensureTables();
    const b = req.body || {};
    const { entity_id, entity_type } = scopeEntity(req, b);
    const warehouseId = b.warehouse_id;
    if (!warehouseId) {
      return res.status(400).json({ success: false, error: 'warehouse_id إلزامي', code: 'WAREHOUSE_REQUIRED' });
    }
    if (!Array.isArray(b.lines) || !b.lines.length) {
      return res.status(400).json({ success: false, error: 'بنود الاستلام إلزامية', code: 'LINES_REQUIRED' });
    }

    await client.query('BEGIN');
    const poRes = await client.query(
      `SELECT * FROM finance_purchase_orders WHERE po_id = $1 AND entity_id = $2 FOR UPDATE`,
      [req.params.id, entity_id]
    );
    if (!poRes.rows[0]) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, error: 'أمر الشراء غير موجود' });
    }
    const po = poRes.rows[0];
    if (String(po.status).toUpperCase() === 'CANCELLED') {
      await client.query('ROLLBACK');
      return res.status(409).json({ success: false, error: 'أمر الشراء ملغى', code: 'PO_CANCELLED' });
    }

    const movements = [];
    for (const item of b.lines) {
      const lineRes = await client.query(
        `SELECT * FROM finance_purchase_order_lines WHERE line_id = $1 AND po_id = $2 FOR UPDATE`,
        [item.line_id, po.po_id]
      );
      if (!lineRes.rows[0]) {
        await client.query('ROLLBACK');
        return res.status(404).json({ success: false, error: `البند ${item.line_id} غير موجود` });
      }
      const line = lineRes.rows[0];
      if (!line.product_id) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          success: false,
          error: 'البند بلا صنف مخزني — اربط product_id قبل الاستلام',
          code: 'PRODUCT_REQUIRED'
        });
      }
      const recvQty = toNum(item.qty);
      if (recvQty <= 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ success: false, error: 'كمية الاستلام غير صحيحة' });
      }
      const remaining = toNum(line.qty) - toNum(line.received_qty);
      if (recvQty > remaining + 0.0001) {
        await client.query('ROLLBACK');
        return res.status(409).json({
          success: false,
          error: `الكمية تتجاوز المتبقي للبند (${remaining})`,
          code: 'OVER_RECEIVE'
        });
      }

      const movement = await inventoryApi.postMovement(client, {
        movementType: 'IN',
        productId: line.product_id,
        warehouseId,
        quantity: recvQty,
        unitCost: toNum(line.unit_cost),
        referenceType: 'PO_RECEIVE',
        referenceId: `${po.po_id}:${line.line_id}`,
        notes: b.notes || `استلام أمر شراء ${po.po_number}`,
        entityId: entity_id,
        entityType: entity_type,
        createdBy: b.created_by || 'ui',
        allowNegative: false
      });
      movements.push(movement);

      await client.query(
        `UPDATE finance_purchase_order_lines
         SET received_qty = received_qty + $2
         WHERE line_id = $1`,
        [line.line_id, recvQty]
      );
    }

    const progress = await client.query(
      `SELECT
         COUNT(*)::int AS lines_n,
         COUNT(*) FILTER (WHERE received_qty >= qty - 0.0001)::int AS fully,
         COUNT(*) FILTER (WHERE received_qty > 0)::int AS any_recv
       FROM finance_purchase_order_lines WHERE po_id = $1`,
      [po.po_id]
    );
    let nextStatus = 'OPEN';
    if (progress.rows[0].lines_n > 0 && progress.rows[0].fully === progress.rows[0].lines_n) {
      nextStatus = 'RECEIVED';
    } else if (progress.rows[0].any_recv > 0) {
      nextStatus = 'PARTIAL';
    }
    const updated = await client.query(
      `UPDATE finance_purchase_orders SET status = $2, updated_at = NOW() WHERE po_id = $1 RETURNING *`,
      [po.po_id, nextStatus]
    );
    const lines = await client.query(
      `SELECT l.*, p.sku, p.name_ar AS product_name
       FROM finance_purchase_order_lines l
       LEFT JOIN finance_products p ON p.product_id = l.product_id
       WHERE l.po_id = $1 ORDER BY l.line_id`,
      [po.po_id]
    );
    await client.query('COMMIT');
    res.json({
      success: true,
      order: updated.rows[0],
      lines: lines.rows,
      movements,
      message: 'تم استلام البنود وتحديث المخزون'
    });
  } catch (e) {
    try { await client.query('ROLLBACK'); } catch { /* */ }
    res.status(e.status || 500).json({ success: false, error: e.message, code: e.code || 'ERROR' });
  } finally {
    client.release();
  }
});

router.get('/vendor-invoices', async (req, res) => {
  try {
    await ensureTables();
    const { entity_id } = scopeEntity(req);
    if (!entity_id) return res.status(400).json({ success: false, error: 'entity_id مطلوب' });
    const r = await db.query(
      `SELECT * FROM finance_vendor_invoices WHERE entity_id = $1 ORDER BY vendor_invoice_id DESC`,
      [entity_id]
    );
    res.json({ success: true, invoices: r.rows, count: r.rows.length });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.post('/vendor-invoices', async (req, res) => {
  try {
    await ensureTables();
    const b = req.body || {};
    const { entity_id, entity_type } = scopeEntity(req, b);
    if (!entity_id) return res.status(400).json({ success: false, error: 'entity_id مطلوب' });
    const invNo = b.invoice_number || `VI-${Date.now()}`;
    const r = await db.query(
      `INSERT INTO finance_vendor_invoices
        (invoice_number, vendor_id, vendor_name, po_id, invoice_date, due_date, status, total_amount, paid_amount, notes, entity_id, entity_type, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
      [
        invNo,
        b.vendor_id || null,
        b.vendor_name || null,
        b.po_id || null,
        b.invoice_date || new Date().toISOString().slice(0, 10),
        b.due_date || null,
        b.status || 'OPEN',
        toNum(b.total_amount),
        toNum(b.paid_amount),
        b.notes || null,
        entity_id,
        entity_type,
        b.created_by || 'ui'
      ]
    );
    res.status(201).json({ success: true, invoice: r.rows[0] });
  } catch (e) {
    res.status(e.code === '23505' ? 409 : 500).json({ success: false, error: e.message });
  }
});

router.delete('/vendor-invoices/:id', async (req, res) => {
  try {
    await ensureTables();
    const { entity_id } = scopeEntity(req);
    const r = await db.query(
      `DELETE FROM finance_vendor_invoices WHERE vendor_invoice_id = $1 AND entity_id = $2 RETURNING vendor_invoice_id`,
      [req.params.id, entity_id]
    );
    if (!r.rows[0]) return res.status(404).json({ success: false, error: 'not found' });
    res.json({ success: true, deleted: r.rows[0].vendor_invoice_id });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

module.exports = router;
