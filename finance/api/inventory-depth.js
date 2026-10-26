'use strict';

/**
 * W4 inventory depth: category tree, margins-by-category, stock counts with approval,
 * and purchase↔stock link listing. Additive DDL only.
 */

const db = require('../../db');
const { denyUnless } = require('../services/inventory-authz');
const { applyInbound, applyOutbound, roundQty, roundCost } = require('../services/inventory-policy');

let depthReady = false;

async function ensureDepthTables(clientOrDb = db) {
  if (depthReady && clientOrDb === db) return;
  await clientOrDb.query(`
    CREATE TABLE IF NOT EXISTS finance_item_categories (
      category_id SERIAL PRIMARY KEY,
      entity_id TEXT NOT NULL,
      parent_id INTEGER REFERENCES finance_item_categories(category_id),
      code TEXT NOT NULL,
      name_ar TEXT NOT NULL,
      is_active BOOLEAN NOT NULL DEFAULT true,
      audit_log JSONB DEFAULT '[]'::jsonb,
      created_by TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (entity_id, code)
    );
    CREATE INDEX IF NOT EXISTS idx_fin_item_cat_entity ON finance_item_categories(entity_id, parent_id);

    ALTER TABLE finance_items ADD COLUMN IF NOT EXISTS category_id INTEGER;
    CREATE INDEX IF NOT EXISTS idx_fin_items_category ON finance_items(entity_id, category_id);

    CREATE TABLE IF NOT EXISTS finance_stock_counts (
      count_id SERIAL PRIMARY KEY,
      entity_id TEXT NOT NULL,
      count_number TEXT NOT NULL,
      warehouse_id INTEGER NOT NULL,
      item_id INTEGER NOT NULL,
      system_qty NUMERIC(14,3) NOT NULL DEFAULT 0,
      counted_qty NUMERIC(14,3) NOT NULL,
      variance_qty NUMERIC(14,3) NOT NULL DEFAULT 0,
      unit_cost NUMERIC(14,4) NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'DRAFT',
      reason TEXT,
      movement_document_id INTEGER,
      audit_log JSONB DEFAULT '[]'::jsonb,
      created_by TEXT,
      approved_by TEXT,
      approved_at TIMESTAMPTZ,
      cancelled_at TIMESTAMPTZ,
      cancel_reason TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (entity_id, count_number)
    );
    CREATE INDEX IF NOT EXISTS idx_fin_stock_counts_entity ON finance_stock_counts(entity_id, status, count_id DESC);
  `);
  if (clientOrDb === db) depthReady = true;
}

function auditEntry(action, by, extra = {}) {
  return { action, by: by || 'ui', at: new Date().toISOString(), ...extra };
}

function register(router, helpers) {
  router.get('/categories', async (req, res) => {
    if (denyUnless(req, res, 'view')) return;
    const entityId = helpers.requireEntity(req, res);
    if (!entityId) return;
    try {
      await helpers.ensureTables();
      await ensureDepthTables();
      const r = await db.query(
        `SELECT c.*,
                p.name_ar AS parent_name,
                (SELECT COUNT(*)::int FROM finance_items i WHERE i.entity_id = c.entity_id AND i.category_id = c.category_id) AS item_count
         FROM finance_item_categories c
         LEFT JOIN finance_item_categories p ON p.category_id = c.parent_id
         WHERE c.entity_id = $1
         ORDER BY COALESCE(c.parent_id,0), c.code`,
        [entityId]
      );
      res.json({ success: true, categories: r.rows, count: r.rows.length });
    } catch (error) {
      helpers.fail(res, 500, error.message);
    }
  });

  router.post('/categories', async (req, res) => {
    if (denyUnless(req, res, 'categories')) return;
    const entityId = helpers.requireEntity(req, res);
    if (!entityId) return;
    const body = req.body || {};
    const code = String(body.code || '').trim().toUpperCase();
    const name = String(body.name_ar || '').trim();
    if (!code || !name) return helpers.fail(res, 400, 'رمز واسم التصنيف إلزاميان');
    const client = await db.pool.connect();
    try {
      await helpers.ensureTables();
      await ensureDepthTables(client);
      if (body.parent_id) {
        const parent = await client.query(
          `SELECT category_id FROM finance_item_categories WHERE category_id = $1 AND entity_id = $2`,
          [body.parent_id, entityId]
        );
        if (!parent.rows[0]) return helpers.fail(res, 404, 'التصنيف الأب غير موجود');
      }
      const by = helpers.actorOf(req);
      const ins = await client.query(
        `INSERT INTO finance_item_categories
          (entity_id, parent_id, code, name_ar, created_by, audit_log)
         VALUES ($1,$2,$3,$4,$5,$6::jsonb)
         RETURNING *`,
        [
          entityId,
          body.parent_id || null,
          code,
          name,
          by,
          JSON.stringify([auditEntry('create', by)])
        ]
      );
      res.status(201).json({ success: true, category: ins.rows[0] });
    } catch (error) {
      if (error.code === '23505') return helpers.fail(res, 409, 'رمز التصنيف مستخدم مسبقًا');
      helpers.fail(res, 500, error.message);
    } finally {
      client.release();
    }
  });

  router.put('/categories/:id', async (req, res) => {
    if (denyUnless(req, res, 'categories')) return;
    const entityId = helpers.requireEntity(req, res);
    if (!entityId) return;
    const body = req.body || {};
    const client = await db.pool.connect();
    try {
      await ensureDepthTables(client);
      const existing = await client.query(
        `SELECT * FROM finance_item_categories WHERE category_id = $1 AND entity_id = $2 FOR UPDATE`,
        [req.params.id, entityId]
      );
      if (!existing.rows[0]) return helpers.fail(res, 404, 'التصنيف غير موجود');
      if (body.parent_id && Number(body.parent_id) === Number(req.params.id)) {
        return helpers.fail(res, 400, 'لا يمكن أن يكون التصنيف أبًا لنفسه');
      }
      const by = helpers.actorOf(req);
      const updated = await client.query(
        `UPDATE finance_item_categories
         SET name_ar = COALESCE($3, name_ar),
             parent_id = CASE WHEN $4::boolean THEN $5 ELSE parent_id END,
             is_active = COALESCE($6, is_active),
             audit_log = COALESCE(audit_log, '[]'::jsonb) || $7::jsonb,
             updated_at = NOW()
         WHERE category_id = $1 AND entity_id = $2
         RETURNING *`,
        [
          req.params.id,
          entityId,
          body.name_ar != null ? String(body.name_ar).trim() : null,
          body.parent_id !== undefined,
          body.parent_id || null,
          body.is_active != null ? !!body.is_active : null,
          JSON.stringify([auditEntry('update', by)])
        ]
      );
      res.json({ success: true, category: updated.rows[0] });
    } catch (error) {
      helpers.fail(res, 500, error.message);
    } finally {
      client.release();
    }
  });

  router.post('/items/:id/assign-category', async (req, res) => {
    if (denyUnless(req, res, 'categories')) return;
    const entityId = helpers.requireEntity(req, res);
    if (!entityId) return;
    const categoryId = req.body?.category_id != null ? Number(req.body.category_id) : null;
    const client = await db.pool.connect();
    try {
      await helpers.ensureTables();
      await ensureDepthTables(client);
      await client.query('BEGIN');
      const item = await client.query(
        `SELECT * FROM finance_items WHERE item_id = $1 AND entity_id = $2 FOR UPDATE`,
        [req.params.id, entityId]
      );
      if (!item.rows[0]) {
        await client.query('ROLLBACK');
        return helpers.fail(res, 404, 'الصنف غير موجود');
      }
      let categoryName = null;
      if (categoryId) {
        const cat = await client.query(
          `SELECT * FROM finance_item_categories WHERE category_id = $1 AND entity_id = $2 AND is_active = true`,
          [categoryId, entityId]
        );
        if (!cat.rows[0]) {
          await client.query('ROLLBACK');
          return helpers.fail(res, 404, 'التصنيف غير موجود أو غير نشط');
        }
        categoryName = cat.rows[0].name_ar;
      }
      const by = helpers.actorOf(req);
      const updated = await client.query(
        `UPDATE finance_items
         SET category_id = $3,
             category = COALESCE($4, category),
             updated_at = NOW()
         WHERE item_id = $1 AND entity_id = $2
         RETURNING *`,
        [req.params.id, entityId, categoryId, categoryName]
      );
      await helpers.audit(client, entityId, 'item', updated.rows[0].item_id, 'assign_category', item.rows[0], updated.rows[0], by);
      await client.query('COMMIT');
      res.json({ success: true, item: updated.rows[0] });
    } catch (error) {
      try { await client.query('ROLLBACK'); } catch { /* */ }
      helpers.fail(res, 500, error.message);
    } finally {
      client.release();
    }
  });

  router.get('/margins-by-category', async (req, res) => {
    if (denyUnless(req, res, 'margins')) return;
    const entityId = helpers.requireEntity(req, res);
    if (!entityId) return;
    try {
      await helpers.ensureTables();
      await ensureDepthTables();
      const r = await db.query(
        `SELECT
           COALESCE(c.category_id, 0) AS category_id,
           COALESCE(c.code, '_') AS category_code,
           COALESCE(c.name_ar, COALESCE(i.category, 'غير مصنّف')) AS category_name,
           COUNT(DISTINCT i.item_id)::int AS item_count,
           COALESCE(SUM(b.qty),0) AS total_qty,
           COALESCE(SUM(b.qty * b.avg_cost),0) AS stock_value,
           COALESCE(SUM(b.qty * i.sale_price),0) AS sale_value,
           COALESCE(SUM(b.qty * (i.sale_price - b.avg_cost)),0) AS margin_value,
           CASE WHEN COALESCE(SUM(b.qty * i.sale_price),0) = 0 THEN 0
                ELSE ROUND(SUM(b.qty * (i.sale_price - b.avg_cost)) / SUM(b.qty * i.sale_price) * 100, 2)
           END AS margin_pct
         FROM finance_items i
         LEFT JOIN finance_item_categories c ON c.category_id = i.category_id AND c.entity_id = i.entity_id
         LEFT JOIN finance_stock_balances b ON b.item_id = i.item_id AND b.entity_id = i.entity_id
         WHERE i.entity_id = $1 AND i.is_active = true
         GROUP BY COALESCE(c.category_id, 0), COALESCE(c.code, '_'), COALESCE(c.name_ar, COALESCE(i.category, 'غير مصنّف'))
         ORDER BY margin_value DESC`,
        [entityId]
      );
      res.json({
        success: true,
        rows: r.rows,
        count: r.rows.length,
        note: 'هامش حسب التصنيف من رصيد المخزون × (سعر البيع − متوسط التكلفة). ليست ربحية أقسام محاسبية كاملة.'
      });
    } catch (error) {
      helpers.fail(res, 500, error.message);
    }
  });

  router.get('/costs', async (req, res) => {
    if (denyUnless(req, res, 'costs')) return;
    const entityId = helpers.requireEntity(req, res);
    if (!entityId) return;
    try {
      await helpers.ensureTables();
      const r = await db.query(
        `SELECT b.item_id, b.warehouse_id, b.qty, b.avg_cost, (b.qty * b.avg_cost) AS stock_value,
                i.sku, i.name_ar, i.sale_price, i.category, i.category_id,
                w.code AS warehouse_code, w.name_ar AS warehouse_name
         FROM finance_stock_balances b
         JOIN finance_items i ON i.item_id = b.item_id
         JOIN finance_warehouses w ON w.warehouse_id = b.warehouse_id
         WHERE b.entity_id = $1
         ORDER BY i.sku, w.code`,
        [entityId]
      );
      res.json({
        success: true,
        costs: r.rows,
        count: r.rows.length,
        valuation: 'weighted_average',
        note: 'متوسط التكلفة المرجح على رصيد الصنف/المستودع. تكلفة المشروعات غير ضمن هذه الوحدة.'
      });
    } catch (error) {
      helpers.fail(res, 500, error.message);
    }
  });

  router.get('/purchase-links', async (req, res) => {
    if (denyUnless(req, res, 'links')) return;
    const entityId = helpers.requireEntity(req, res);
    if (!entityId) return;
    try {
      await helpers.ensureTables();
      const orders = await db.query(
        `SELECT po_id, po_number, vendor_name, status, total_amount, order_date, updated_at
         FROM finance_purchase_orders
         WHERE entity_id = $1
         ORDER BY po_id DESC LIMIT 100`,
        [entityId]
      ).catch(() => ({ rows: [] }));
      const receipts = await db.query(
        `SELECT d.document_id, d.document_no, d.movement_type, d.reason, d.created_at, d.created_by,
                d.source_type, d.source_id, d.journal_entry_id
         FROM finance_stock_documents d
         WHERE d.entity_id = $1
           AND (
             UPPER(d.movement_type) IN ('IN','RECEIPT','PO_RECEIPT')
             OR COALESCE(d.source_type,'') ILIKE '%PO%'
             OR COALESCE(d.source_type,'') ILIKE '%PURCHASE%'
           )
         ORDER BY d.document_id DESC LIMIT 100`,
        [entityId]
      );
      res.json({
        success: true,
        purchase_orders: orders.rows,
        stock_receipts: receipts.rows,
        note: 'إنشاء/اعتماد أمر الشراء وحده لا يحرّك المخزون. الاستلام المعتمد يزيد الرصيد.'
      });
    } catch (error) {
      helpers.fail(res, 500, error.message);
    }
  });

  router.get('/counts', async (req, res) => {
    if (denyUnless(req, res, 'view')) return;
    const entityId = helpers.requireEntity(req, res);
    if (!entityId) return;
    try {
      await ensureDepthTables();
      const r = await db.query(
        `SELECT sc.*, i.sku, i.name_ar, w.code AS warehouse_code, w.name_ar AS warehouse_name
         FROM finance_stock_counts sc
         JOIN finance_items i ON i.item_id = sc.item_id
         JOIN finance_warehouses w ON w.warehouse_id = sc.warehouse_id
         WHERE sc.entity_id = $1
         ORDER BY sc.count_id DESC
         LIMIT 200`,
        [entityId]
      );
      res.json({ success: true, counts: r.rows, count: r.rows.length });
    } catch (error) {
      helpers.fail(res, 500, error.message);
    }
  });

  router.post('/counts', async (req, res) => {
    if (denyUnless(req, res, 'count')) return;
    const entityId = helpers.requireEntity(req, res);
    if (!entityId) return;
    const body = req.body || {};
    const counted = roundQty(body.counted_qty);
    if (!(Number.isFinite(counted))) return helpers.fail(res, 400, 'الكمية المعدودة مطلوبة');
    if (!String(body.reason || '').trim()) return helpers.fail(res, 400, 'سبب الجرد إلزامي');
    const client = await db.pool.connect();
    try {
      await helpers.ensureTables();
      await ensureDepthTables(client);
      await client.query('BEGIN');
      const item = await client.query(
        `SELECT * FROM finance_items WHERE item_id = $1 AND entity_id = $2`,
        [body.item_id, entityId]
      );
      if (!item.rows[0] || !item.rows[0].is_stocked) {
        await client.query('ROLLBACK');
        return helpers.fail(res, 404, 'صنف مخزني غير موجود');
      }
      const wh = await client.query(
        `SELECT * FROM finance_warehouses WHERE warehouse_id = $1 AND entity_id = $2 AND is_active = true`,
        [body.warehouse_id, entityId]
      );
      if (!wh.rows[0]) {
        await client.query('ROLLBACK');
        return helpers.fail(res, 404, 'المستودع غير موجود');
      }
      const bal = await client.query(
        `SELECT qty, avg_cost FROM finance_stock_balances
         WHERE entity_id = $1 AND item_id = $2 AND warehouse_id = $3`,
        [entityId, body.item_id, body.warehouse_id]
      );
      const systemQty = bal.rows[0] ? Number(bal.rows[0].qty) : 0;
      const unitCost = bal.rows[0] ? Number(bal.rows[0].avg_cost) : 0;
      const variance = roundQty(counted - systemQty);
      const by = helpers.actorOf(req);
      const num = `CNT-${Date.now().toString(36).toUpperCase()}`;
      const ins = await client.query(
        `INSERT INTO finance_stock_counts
          (entity_id, count_number, warehouse_id, item_id, system_qty, counted_qty, variance_qty,
           unit_cost, status, reason, created_by, audit_log)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'DRAFT',$9,$10,$11::jsonb)
         RETURNING *`,
        [
          entityId, num, body.warehouse_id, body.item_id, systemQty, counted, variance,
          unitCost, String(body.reason).trim(), by,
          JSON.stringify([auditEntry('create', by, { systemQty, counted, variance })])
        ]
      );
      await client.query('COMMIT');
      res.status(201).json({ success: true, count: ins.rows[0], message: 'مسودة جرد — بانتظار الاعتماد' });
    } catch (error) {
      try { await client.query('ROLLBACK'); } catch { /* */ }
      helpers.fail(res, 500, error.message);
    } finally {
      client.release();
    }
  });

  router.post('/counts/:id/approve', async (req, res) => {
    if (denyUnless(req, res, 'count_approve')) return;
    const entityId = helpers.requireEntity(req, res);
    if (!entityId) return;
    const client = await db.pool.connect();
    try {
      await helpers.ensureTables();
      await ensureDepthTables(client);
      await client.query('BEGIN');
      const existing = await client.query(
        `SELECT * FROM finance_stock_counts WHERE count_id = $1 AND entity_id = $2 FOR UPDATE`,
        [req.params.id, entityId]
      );
      if (!existing.rows[0]) {
        await client.query('ROLLBACK');
        return helpers.fail(res, 404, 'سجل الجرد غير موجود');
      }
      const row = existing.rows[0];
      if (String(row.status).toUpperCase() !== 'DRAFT') {
        await client.query('ROLLBACK');
        return helpers.fail(res, 409, 'الجرد ليس مسودة للاعتماد');
      }
      const variance = Number(row.variance_qty);
      let documentId = null;
      if (Math.abs(variance) > 0.0005) {
        const direction = variance > 0 ? 'in' : 'out';
        const quantity = roundQty(Math.abs(variance));
        const balRes = await client.query(
          `SELECT qty, avg_cost FROM finance_stock_balances
           WHERE entity_id = $1 AND item_id = $2 AND warehouse_id = $3 FOR UPDATE`,
          [entityId, row.item_id, row.warehouse_id]
        );
        let source = balRes.rows[0]
          ? { qty: Number(balRes.rows[0].qty), avgCost: Number(balRes.rows[0].avg_cost) }
          : { qty: 0, avgCost: 0 };
        if (!balRes.rows[0]) {
          await client.query(
            `INSERT INTO finance_stock_balances (entity_id, item_id, warehouse_id, qty, avg_cost)
             VALUES ($1,$2,$3,0,0)`,
            [entityId, row.item_id, row.warehouse_id]
          );
        }
        let next;
        if (direction === 'out') {
          next = applyOutbound(source, quantity);
          if (!next.ok) {
            await client.query('ROLLBACK');
            return helpers.fail(res, 409, next.error);
          }
        } else {
          next = applyInbound(source, quantity, roundCost(row.unit_cost || source.avgCost || 0));
          if (!next.ok) {
            await client.query('ROLLBACK');
            return helpers.fail(res, 400, next.error);
          }
        }
        await client.query(
          `UPDATE finance_stock_balances
           SET qty = $4, avg_cost = $5, updated_at = NOW()
           WHERE entity_id = $1 AND item_id = $2 AND warehouse_id = $3`,
          [entityId, row.item_id, row.warehouse_id, next.qty, next.avgCost]
        );
        const counter = await client.query(
          `INSERT INTO finance_stock_counters (entity_id, last_no) VALUES ($1, 1)
           ON CONFLICT (entity_id) DO UPDATE SET last_no = finance_stock_counters.last_no + 1
           RETURNING last_no`,
          [entityId]
        );
        const documentNo = `STK-${String(counter.rows[0].last_no).padStart(6, '0')}`;
        const doc = await client.query(
          `INSERT INTO finance_stock_documents
            (entity_id, document_no, movement_type, reason, created_by)
           VALUES ($1,$2,'ADJUSTMENT',$3,$4) RETURNING document_id`,
          [entityId, documentNo, `جرد ${row.count_number}: ${row.reason}`, helpers.actorOf(req)]
        );
        documentId = doc.rows[0].document_id;
        await client.query(
          `INSERT INTO finance_stock_movements
            (document_id, entity_id, item_id, warehouse_id, movement_type, direction, quantity, unit_cost)
           VALUES ($1,$2,$3,$4,'ADJUSTMENT',$5,$6,$7)`,
          [documentId, entityId, row.item_id, row.warehouse_id, direction, quantity, next.appliedUnitCost || row.unit_cost || 0]
        );
      }
      const by = helpers.actorOf(req);
      const updated = await client.query(
        `UPDATE finance_stock_counts
         SET status = 'APPROVED',
             movement_document_id = $3,
             approved_by = $4,
             approved_at = NOW(),
             audit_log = COALESCE(audit_log, '[]'::jsonb) || $5::jsonb,
             updated_at = NOW()
         WHERE count_id = $1 AND entity_id = $2
         RETURNING *`,
        [
          row.count_id,
          entityId,
          documentId,
          by,
          JSON.stringify([auditEntry('approve', by, { movement_document_id: documentId })])
        ]
      );
      await client.query('COMMIT');
      res.json({
        success: true,
        count: updated.rows[0],
        message: documentId ? 'اعتُمد الجرد وسُجّلت تسوية مخزون' : 'اعتُمد الجرد دون حركة (لا فرق كمية)'
      });
    } catch (error) {
      try { await client.query('ROLLBACK'); } catch { /* */ }
      helpers.fail(res, 500, error.message);
    } finally {
      client.release();
    }
  });

  router.post('/counts/:id/cancel', async (req, res) => {
    if (denyUnless(req, res, 'count_approve')) return;
    const entityId = helpers.requireEntity(req, res);
    if (!entityId) return;
    const reason = String((req.body || {}).reason || '').trim();
    if (!reason) return helpers.fail(res, 400, 'سبب الإلغاء إلزامي');
    try {
      await ensureDepthTables();
      const existing = await db.query(
        `SELECT * FROM finance_stock_counts WHERE count_id = $1 AND entity_id = $2`,
        [req.params.id, entityId]
      );
      if (!existing.rows[0]) return helpers.fail(res, 404, 'سجل الجرد غير موجود');
      if (String(existing.rows[0].status).toUpperCase() !== 'DRAFT') {
        return helpers.fail(res, 409, 'لا يُلغى إلا مسودة الجرد — المعتمد يُصحَّح بحركة عكسية');
      }
      const by = helpers.actorOf(req);
      const updated = await db.query(
        `UPDATE finance_stock_counts
         SET status = 'CANCELLED', cancel_reason = $3, cancelled_at = NOW(),
             audit_log = COALESCE(audit_log, '[]'::jsonb) || $4::jsonb, updated_at = NOW()
         WHERE count_id = $1 AND entity_id = $2
         RETURNING *`,
        [req.params.id, entityId, reason, JSON.stringify([auditEntry('cancel', by, { reason })])]
      );
      res.json({ success: true, count: updated.rows[0] });
    } catch (error) {
      helpers.fail(res, 500, error.message);
    }
  });
}

module.exports = { register, ensureDepthTables };
