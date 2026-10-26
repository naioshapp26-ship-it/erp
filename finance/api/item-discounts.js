'use strict';

const express = require('express');
const router = express.Router();
const db = require('../../db');

async function ensureTable() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS finance_item_discounts (
      id SERIAL PRIMARY KEY,
      discount_code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      scope TEXT NOT NULL DEFAULT 'فاتورة',
      discount_type TEXT NOT NULL DEFAULT 'نسبة',
      value NUMERIC NOT NULL DEFAULT 0,
      cap_amount NUMERIC NOT NULL DEFAULT 0,
      min_qty NUMERIC NOT NULL DEFAULT 1,
      min_invoice NUMERIC NOT NULL DEFAULT 0,
      start_date DATE,
      end_date DATE,
      approval TEXT,
      status TEXT NOT NULL DEFAULT 'نشط',
      channel TEXT,
      reason TEXT,
      stackable BOOLEAN DEFAULT false,
      priority INTEGER DEFAULT 2,
      entity_id TEXT DEFAULT 'HQ001',
      entity_type TEXT DEFAULT 'HQ',
      created_by TEXT,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_item_discounts_entity ON finance_item_discounts(entity_id);
  `);
}

router.get('/', async (req, res) => {
  try {
    await ensureTable();
    const entityId = req.query.entity_id || req.headers['x-entity-id'] || 'HQ001';
    const r = await db.query(
      `SELECT * FROM finance_item_discounts WHERE entity_id = $1 ORDER BY id DESC`,
      [entityId]
    );
    res.json({ success: true, discounts: r.rows, count: r.rows.length });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.post('/', async (req, res) => {
  try {
    await ensureTable();
    const b = req.body || {};
    const entityId = b.entity_id || req.headers['x-entity-id'] || 'HQ001';
    const code = b.code || b.discount_code || `DS-${Date.now()}`;
    const r = await db.query(
      `INSERT INTO finance_item_discounts
        (discount_code, name, scope, discount_type, value, cap_amount, min_qty, min_invoice,
         start_date, end_date, approval, status, channel, reason, stackable, priority,
         entity_id, entity_type, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
       RETURNING *`,
      [
        code,
        b.name,
        b.scope || 'فاتورة',
        b.type || b.discount_type || 'نسبة',
        Number(b.value || 0),
        Number(b.cap || b.cap_amount || 0),
        Number(b.minQty || b.min_qty || 1),
        Number(b.minInvoice || b.min_invoice || 0),
        b.startDate || b.start_date || null,
        b.endDate || b.end_date || null,
        b.approval || null,
        b.status || 'نشط',
        b.channel || null,
        b.reason || null,
        Boolean(b.stackable),
        Number(b.priority || 2),
        entityId,
        b.entity_type || 'HQ',
        b.createdBy || b.created_by || 'ui'
      ]
    );
    res.status(201).json({ success: true, discount: r.rows[0] });
  } catch (e) {
    res.status(e.code === '23505' ? 409 : 500).json({ success: false, error: e.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    await ensureTable();
    const id = req.params.id;
    const b = req.body || {};
    const r = await db.query(
      `UPDATE finance_item_discounts SET
        name = COALESCE($2, name),
        scope = COALESCE($3, scope),
        discount_type = COALESCE($4, discount_type),
        value = COALESCE($5, value),
        cap_amount = COALESCE($6, cap_amount),
        min_qty = COALESCE($7, min_qty),
        min_invoice = COALESCE($8, min_invoice),
        start_date = COALESCE($9, start_date),
        end_date = COALESCE($10, end_date),
        approval = COALESCE($11, approval),
        status = COALESCE($12, status),
        channel = COALESCE($13, channel),
        reason = COALESCE($14, reason),
        updated_at = NOW()
       WHERE id::text = $1::text OR discount_code = $1::text
       RETURNING *`,
      [
        String(id),
        b.name || null,
        b.scope || null,
        b.type || b.discount_type || null,
        b.value != null ? Number(b.value) : null,
        b.cap != null || b.cap_amount != null ? Number(b.cap || b.cap_amount) : null,
        b.minQty != null || b.min_qty != null ? Number(b.minQty || b.min_qty) : null,
        b.minInvoice != null || b.min_invoice != null ? Number(b.minInvoice || b.min_invoice) : null,
        b.startDate || b.start_date || null,
        b.endDate || b.end_date || null,
        b.approval || null,
        b.status || null,
        b.channel || null,
        b.reason || null
      ]
    );
    if (!r.rows[0]) return res.status(404).json({ success: false, error: 'not found' });
    res.json({ success: true, discount: r.rows[0] });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await ensureTable();
    const r = await db.query(
      `DELETE FROM finance_item_discounts WHERE id::text = $1 OR discount_code = $1 RETURNING id`,
      [String(req.params.id)]
    );
    if (!r.rows[0]) return res.status(404).json({ success: false, error: 'not found' });
    res.json({ success: true, deleted: r.rows[0].id });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

module.exports = router;
