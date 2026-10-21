'use strict';

/**
 * Sales targets & commissions — Postgres-backed.
 * Mount: /finance/sales-targets
 */

const express = require('express');
const db = require('../../db');
const { resolveScopedEntityId, resolveScopedEntityType } = require('./resolve-scoped-entity');

const router = express.Router();
let tableReady = false;

async function ensureTable() {
  if (tableReady) return;
  await db.query(`
    CREATE TABLE IF NOT EXISTS finance_sales_targets (
      id SERIAL PRIMARY KEY,
      period_label TEXT NOT NULL,
      period_start DATE,
      period_end DATE,
      salesperson_name TEXT NOT NULL,
      target_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
      achieved_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
      commission_rate NUMERIC(8,4) NOT NULL DEFAULT 0,
      commission_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
      currency TEXT NOT NULL DEFAULT 'SAR',
      status TEXT NOT NULL DEFAULT 'OPEN',
      notes TEXT,
      entity_id TEXT NOT NULL,
      entity_type TEXT,
      created_by TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_finance_sales_targets_entity ON finance_sales_targets(entity_id);
  `);
  tableReady = true;
}

function calcCommission(achieved, rate) {
  const a = Number(achieved) || 0;
  const r = Number(rate) || 0;
  return Math.round((a * r) / 100 * 100) / 100;
}

router.get('/', async (req, res) => {
  try {
    await ensureTable();
    const entityId = resolveScopedEntityId(req, req.query.entity_id);
    if (!entityId) {
      return res.status(400).json({ success: false, error: 'entity_id is required' });
    }
    const result = await db.query(
      `SELECT * FROM finance_sales_targets WHERE entity_id = $1 ORDER BY period_start DESC NULLS LAST, id DESC`,
      [entityId]
    );
    res.json({ success: true, entity_id: entityId, count: result.rows.length, targets: result.rows });
  } catch (error) {
    console.error('sales-targets list error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/', async (req, res) => {
  try {
    await ensureTable();
    const body = req.body || {};
    const entityId = resolveScopedEntityId(req, body.entity_id);
    const entityType = resolveScopedEntityType(req, body.entity_type);
    if (!entityId) {
      return res.status(400).json({ success: false, error: 'entity_id is required — لا يُمنح HQ001 تلقائيًا' });
    }
    const salesperson = String(body.salesperson_name || '').trim();
    const period = String(body.period_label || '').trim();
    if (!salesperson || !period) {
      return res.status(400).json({ success: false, error: 'اسم المندوب وفترة الهدف مطلوبان' });
    }
    const targetAmount = Number(body.target_amount) || 0;
    const achieved = Number(body.achieved_amount) || 0;
    const rate = Number(body.commission_rate) || 0;
    const commission = body.commission_amount != null
      ? Number(body.commission_amount)
      : calcCommission(achieved, rate);

    const result = await db.query(
      `INSERT INTO finance_sales_targets (
         period_label, period_start, period_end, salesperson_name, target_amount, achieved_amount,
         commission_rate, commission_amount, currency, status, notes, entity_id, entity_type, created_by
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
       RETURNING *`,
      [
        period,
        body.period_start || null,
        body.period_end || null,
        salesperson,
        targetAmount,
        achieved,
        rate,
        commission,
        body.currency || 'SAR',
        body.status || 'OPEN',
        body.notes || null,
        entityId,
        entityType,
        req.headers['x-user-id'] || 'system'
      ]
    );
    res.status(201).json({ success: true, target: result.rows[0] });
  } catch (error) {
    console.error('sales-targets create error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    await ensureTable();
    const body = req.body || {};
    const entityId = resolveScopedEntityId(req, body.entity_id || req.query.entity_id);
    if (!entityId) {
      return res.status(400).json({ success: false, error: 'entity_id is required' });
    }
    const existing = await db.query(
      `SELECT * FROM finance_sales_targets WHERE id = $1 AND entity_id = $2`,
      [req.params.id, entityId]
    );
    if (!existing.rows.length) {
      return res.status(404).json({ success: false, error: 'السجل غير موجود' });
    }
    const row = existing.rows[0];
    const achieved = body.achieved_amount != null ? Number(body.achieved_amount) : Number(row.achieved_amount);
    const rate = body.commission_rate != null ? Number(body.commission_rate) : Number(row.commission_rate);
    const commission = body.commission_amount != null
      ? Number(body.commission_amount)
      : calcCommission(achieved, rate);

    const result = await db.query(
      `UPDATE finance_sales_targets SET
         period_label = COALESCE($1, period_label),
         period_start = COALESCE($2, period_start),
         period_end = COALESCE($3, period_end),
         salesperson_name = COALESCE($4, salesperson_name),
         target_amount = COALESCE($5, target_amount),
         achieved_amount = COALESCE($6, achieved_amount),
         commission_rate = COALESCE($7, commission_rate),
         commission_amount = $8,
         currency = COALESCE($9, currency),
         status = COALESCE($10, status),
         notes = COALESCE($11, notes),
         updated_at = NOW()
       WHERE id = $12 AND entity_id = $13
       RETURNING *`,
      [
        body.period_label || null,
        body.period_start || null,
        body.period_end || null,
        body.salesperson_name || null,
        body.target_amount != null ? Number(body.target_amount) : null,
        body.achieved_amount != null ? achieved : null,
        body.commission_rate != null ? rate : null,
        commission,
        body.currency || null,
        body.status || null,
        body.notes != null ? body.notes : null,
        req.params.id,
        entityId
      ]
    );
    res.json({ success: true, target: result.rows[0] });
  } catch (error) {
    console.error('sales-targets update error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await ensureTable();
    const entityId = resolveScopedEntityId(req, req.query.entity_id);
    if (!entityId) {
      return res.status(400).json({ success: false, error: 'entity_id is required' });
    }
    const result = await db.query(
      `DELETE FROM finance_sales_targets WHERE id = $1 AND entity_id = $2 RETURNING id`,
      [req.params.id, entityId]
    );
    if (!result.rows.length) {
      return res.status(404).json({ success: false, error: 'السجل غير موجود' });
    }
    res.json({ success: true, deleted: Number(req.params.id) });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
