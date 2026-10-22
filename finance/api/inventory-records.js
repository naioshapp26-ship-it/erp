'use strict';

const db = require('../../db');

const TYPES = {
  item: {
    table: 'finance_items',
    id: 'item_id',
    label: 'الصنف'
  },
  unit: {
    table: 'finance_units',
    id: 'unit_id',
    label: 'وحدة القياس'
  },
  warehouse: {
    table: 'finance_warehouses',
    id: 'warehouse_id',
    label: 'المستودع'
  }
};

function register(router, helpers) {
  async function blockReason(client, entityId, type, row) {
    if (type === 'item') {
      const moves = await client.query(
        `SELECT 1 FROM finance_stock_movements WHERE entity_id = $1 AND item_id = $2 LIMIT 1`,
        [entityId, row.item_id]
      );
      if (moves.rows.length) return 'الصنف مرتبط بحركة مخزون معتمدة ولا يُحذف. يمكن تعطيله.';
      const qty = await client.query(
        `SELECT 1 FROM finance_stock_balances WHERE entity_id = $1 AND item_id = $2 AND qty <> 0 LIMIT 1`,
        [entityId, row.item_id]
      );
      if (qty.rows.length) return 'الصنف له رصيد. عطّله أو سوِّ الرصيد بحركة عكسية.';
      return null;
    }
    if (type === 'unit') {
      const used = await client.query(
        `SELECT 1 FROM finance_items WHERE entity_id = $1 AND unit = $2 LIMIT 1`,
        [entityId, row.code]
      );
      return used.rows.length ? 'الوحدة مستخدمة في أصناف. عطّلها بدل الحذف.' : null;
    }
    const moves = await client.query(
      `SELECT 1 FROM finance_stock_movements WHERE entity_id = $1 AND warehouse_id = $2 LIMIT 1`,
      [entityId, row.warehouse_id]
    );
    if (moves.rows.length) return 'المستودع مرتبط بحركة معتمدة ولا يُحذف. يمكن تعطيله.';
    const qty = await client.query(
      `SELECT 1 FROM finance_stock_balances WHERE entity_id = $1 AND warehouse_id = $2 AND qty <> 0 LIMIT 1`,
      [entityId, row.warehouse_id]
    );
    return qty.rows.length ? 'المستودع له رصيد. عطّله بدل الحذف.' : null;
  }

  async function loadRow(client, entityId, type, id) {
    const meta = TYPES[type];
    const result = await client.query(
      `SELECT * FROM ${meta.table} WHERE ${meta.id} = $1 AND entity_id = $2 FOR UPDATE`,
      [id, entityId]
    );
    return result.rows[0] || null;
  }

  router.get('/items/:id', async (req, res) => {
    const entityId = helpers.requireEntity(req, res);
    if (!entityId) return;
    try {
      await helpers.ensureTables();
      const item = await db.query(
        `SELECT * FROM finance_items WHERE item_id = $1 AND entity_id = $2`,
        [req.params.id, entityId]
      );
      if (!item.rows[0]) return helpers.fail(res, 404, 'الصنف غير موجود في هذا الكيان.');
      const audit = await db.query(
        `SELECT * FROM finance_item_audit
         WHERE entity_id = $1 AND record_type = 'item' AND record_id = $2
         ORDER BY audit_id DESC LIMIT 50`,
        [entityId, item.rows[0].item_id]
      );
      const client = await db.pool.connect();
      let reason = null;
      try {
        reason = await blockReason(client, entityId, 'item', item.rows[0]);
      } finally {
        client.release();
      }
      res.json({
        success: true,
        item: item.rows[0],
        deletable: !reason,
        delete_block_reason: reason,
        audit: audit.rows
      });
    } catch (error) {
      helpers.fail(res, 500, error.message);
    }
  });

  router.get('/units/:id', async (req, res) => {
    const entityId = helpers.requireEntity(req, res);
    if (!entityId) return;
    try {
      await helpers.ensureTables();
      const unit = await db.query(
        `SELECT * FROM finance_units WHERE unit_id = $1 AND entity_id = $2`,
        [req.params.id, entityId]
      );
      if (!unit.rows[0]) return helpers.fail(res, 404, 'وحدة القياس غير موجودة في هذا الكيان.');
      const audit = await db.query(
        `SELECT * FROM finance_item_audit
         WHERE entity_id = $1 AND record_type = 'unit' AND record_id = $2
         ORDER BY audit_id DESC LIMIT 50`,
        [entityId, unit.rows[0].unit_id]
      );
      res.json({ success: true, unit: unit.rows[0], audit: audit.rows });
    } catch (error) {
      helpers.fail(res, 500, error.message);
    }
  });

  router.get('/warehouses/:id', async (req, res) => {
    const entityId = helpers.requireEntity(req, res);
    if (!entityId) return;
    try {
      await helpers.ensureTables();
      const warehouse = await db.query(
        `SELECT * FROM finance_warehouses WHERE warehouse_id = $1 AND entity_id = $2`,
        [req.params.id, entityId]
      );
      if (!warehouse.rows[0]) return helpers.fail(res, 404, 'المستودع غير موجود في هذا الكيان.');
      const audit = await db.query(
        `SELECT * FROM finance_item_audit
         WHERE entity_id = $1 AND record_type = 'warehouse' AND record_id = $2
         ORDER BY audit_id DESC LIMIT 50`,
        [entityId, warehouse.rows[0].warehouse_id]
      );
      res.json({ success: true, warehouse: warehouse.rows[0], audit: audit.rows });
    } catch (error) {
      helpers.fail(res, 500, error.message);
    }
  });

  router.put('/warehouses/:id', async (req, res) => {
    const entityId = helpers.requireEntity(req, res);
    if (!entityId) return;
    const client = await db.pool.connect();
    try {
      await helpers.ensureTables();
      await client.query('BEGIN');
      const current = await loadRow(client, entityId, 'warehouse', req.params.id);
      if (!current) {
        await client.query('ROLLBACK');
        return helpers.fail(res, 404, 'المستودع غير موجود في هذا الكيان.');
      }
      const name = (req.body || {}).name_ar != null ? String(req.body.name_ar).trim() : current.name_ar;
      if (!name) {
        await client.query('ROLLBACK');
        return helpers.fail(res, 400, 'اسم المستودع مطلوب.');
      }
      const updated = await client.query(
        `UPDATE finance_warehouses SET name_ar = $3, is_active = $4
         WHERE warehouse_id = $1 AND entity_id = $2 RETURNING *`,
        [
          current.warehouse_id,
          entityId,
          name,
          (req.body || {}).is_active != null ? !!(req.body || {}).is_active : current.is_active
        ]
      );
      await helpers.audit(client, entityId, 'warehouse', current.warehouse_id, 'update', current, updated.rows[0], helpers.actorOf(req));
      await client.query('COMMIT');
      res.json({ success: true, warehouse: updated.rows[0] });
    } catch (error) {
      await client.query('ROLLBACK');
      helpers.fail(res, 500, error.message);
    } finally {
      client.release();
    }
  });

  router.post('/items/:id/copy', async (req, res) => {
    const entityId = helpers.requireEntity(req, res);
    if (!entityId) return;
    const sku = String((req.body || {}).sku || '').trim().toUpperCase();
    if (!sku) return helpers.fail(res, 400, 'رمز الصنف الجديد مطلوب للنسخ.');
    const client = await db.pool.connect();
    try {
      await helpers.ensureTables();
      await client.query('BEGIN');
      const current = await loadRow(client, entityId, 'item', req.params.id);
      if (!current) {
        await client.query('ROLLBACK');
        return helpers.fail(res, 404, 'الصنف غير موجود في هذا الكيان.');
      }
      const unit = await helpers.assertActiveUnit(client, entityId, current.unit);
      if (!unit.ok) {
        await client.query('ROLLBACK');
        return helpers.fail(res, 400, unit.error);
      }
      const inserted = await client.query(
        `INSERT INTO finance_items
          (entity_id, sku, name_ar, item_type, category, unit, sale_price, reorder_level, is_stocked, is_active)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,true)
         RETURNING *`,
        [entityId, sku, current.name_ar, current.item_type, current.category, current.unit, current.sale_price, current.reorder_level, current.is_stocked]
      );
      await helpers.audit(client, entityId, 'item', inserted.rows[0].item_id, 'copy', current, inserted.rows[0], helpers.actorOf(req));
      await client.query('COMMIT');
      res.status(201).json({ success: true, item: inserted.rows[0] });
    } catch (error) {
      await client.query('ROLLBACK');
      helpers.fail(res, error.code === '23505' ? 409 : 500, error.code === '23505' ? 'رمز الصنف مستخدم داخل هذا الكيان.' : error.message);
    } finally {
      client.release();
    }
  });

  async function destroy(req, res, type) {
    const entityId = helpers.requireEntity(req, res);
    if (!entityId) return;
    const meta = TYPES[type];
    const client = await db.pool.connect();
    try {
      await helpers.ensureTables();
      await client.query('BEGIN');
      const current = await loadRow(client, entityId, type, req.params.id);
      if (!current) {
        await client.query('ROLLBACK');
        return helpers.fail(res, 404, `${meta.label} غير موجود في هذا الكيان.`);
      }
      const reason = await blockReason(client, entityId, type, current);
      if (reason) {
        await client.query('ROLLBACK');
        return helpers.fail(res, 409, reason);
      }
      if (type === 'item') {
        await client.query(
          `DELETE FROM finance_stock_balances WHERE entity_id = $1 AND item_id = $2 AND qty = 0`,
          [entityId, current.item_id]
        );
      }
      if (type === 'warehouse') {
        await client.query(
          `DELETE FROM finance_stock_balances WHERE entity_id = $1 AND warehouse_id = $2 AND qty = 0`,
          [entityId, current.warehouse_id]
        );
      }
      await helpers.audit(client, entityId, type, current[meta.id], 'delete', current, null, helpers.actorOf(req));
      await client.query(
        `DELETE FROM ${meta.table} WHERE ${meta.id} = $1 AND entity_id = $2`,
        [current[meta.id], entityId]
      );
      await client.query('COMMIT');
      res.json({ success: true, deleted: current[meta.id], record_type: type });
    } catch (error) {
      await client.query('ROLLBACK');
      helpers.fail(res, 500, error.message);
    } finally {
      client.release();
    }
  }

  router.delete('/items/:id', (req, res) => destroy(req, res, 'item'));
  router.delete('/units/:id', (req, res) => destroy(req, res, 'unit'));
  router.delete('/warehouses/:id', (req, res) => destroy(req, res, 'warehouse'));

  router.delete('/movements/:id', (req, res) => {
    if (!helpers.requireEntity(req, res)) return;
    helpers.fail(res, 409, 'الحركة المعتمدة لا تُحذف. التصحيح بمرتجع أو قيد عكسي.');
  });

  router.delete('/documents/:id', (req, res) => {
    if (!helpers.requireEntity(req, res)) return;
    helpers.fail(res, 409, 'مستند المخزون المعتمد لا يُحذف. التصحيح بمرتجع أو قيد عكسي.');
  });

  router.post('/bulk', async (req, res) => {
    const entityId = helpers.requireEntity(req, res);
    if (!entityId) return;
    const type = String((req.body || {}).record_type || '');
    const action = String((req.body || {}).action || '');
    const ids = Array.isArray((req.body || {}).ids) ? req.body.ids : [];
    const meta = TYPES[type];
    if (!meta || !['activate', 'deactivate'].includes(action)) {
      return helpers.fail(res, 400, 'نوع السجل أو الإجراء الجماعي غير مدعوم.');
    }
    if (!ids.length || ids.length > 100) return helpers.fail(res, 400, 'حدد سجلًا واحدًا على الأقل وبحد أقصى 100.');
    const results = [];
    for (const rawId of ids) {
      const client = await db.pool.connect();
      try {
        await helpers.ensureTables();
        await client.query('BEGIN');
        const current = await loadRow(client, entityId, type, rawId);
        if (!current) {
          await client.query('ROLLBACK');
          results.push({ id: rawId, ok: false, error: 'السجل غير موجود في هذا الكيان.' });
          continue;
        }
        const updated = await client.query(
          `UPDATE ${meta.table} SET is_active = $3 WHERE ${meta.id} = $1 AND entity_id = $2 RETURNING *`,
          [current[meta.id], entityId, action === 'activate']
        );
        await helpers.audit(client, entityId, type, current[meta.id], action, current, updated.rows[0], helpers.actorOf(req));
        await client.query('COMMIT');
        results.push({ id: current[meta.id], ok: true });
      } catch (error) {
        try { await client.query('ROLLBACK'); } catch { /* */ }
        results.push({ id: rawId, ok: false, error: error.message });
      } finally {
        client.release();
      }
    }
    const failed = results.filter((row) => !row.ok).length;
    res.json({ success: failed === 0, updated: results.length - failed, failed, results });
  });

  router.get('/audit', async (req, res) => {
    const entityId = helpers.requireEntity(req, res);
    if (!entityId) return;
    try {
      await helpers.ensureTables();
      const params = [entityId];
      let sql = `SELECT * FROM finance_item_audit WHERE entity_id = $1`;
      if (req.query.record_type) {
        params.push(String(req.query.record_type));
        sql += ` AND record_type = $${params.length}`;
      }
      if (req.query.record_id) {
        params.push(Number(req.query.record_id));
        sql += ` AND record_id = $${params.length}`;
      }
      sql += ` ORDER BY audit_id DESC LIMIT 100`;
      const result = await db.query(sql, params);
      res.json({ success: true, audit: result.rows, count: result.rows.length });
    } catch (error) {
      helpers.fail(res, 500, error.message);
    }
  });
}

module.exports = { register };
