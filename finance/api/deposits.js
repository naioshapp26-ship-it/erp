'use strict';

/**
 * Sales deposits / advance payments — Postgres-backed.
 * Mount: /finance/deposits
 */

const express = require('express');
const db = require('../../db');
const { resolveScopedEntityId, resolveScopedEntityType } = require('./resolve-scoped-entity');

const router = express.Router();
let tableReady = false;

async function ensureTable() {
  if (tableReady) return;
  await db.query(`
    CREATE TABLE IF NOT EXISTS finance_deposits (
      id SERIAL PRIMARY KEY,
      deposit_code TEXT NOT NULL,
      client_name TEXT NOT NULL,
      deposit_type TEXT NOT NULL DEFAULT 'عربون',
      amount NUMERIC(14,2) NOT NULL DEFAULT 0,
      currency TEXT NOT NULL DEFAULT 'SAR',
      due_date DATE,
      status TEXT NOT NULL DEFAULT 'نشط',
      refundable BOOLEAN NOT NULL DEFAULT false,
      contract_ref TEXT,
      project_name TEXT,
      payment_method TEXT,
      risk_score NUMERIC(6,2) DEFAULT 0,
      settled_amount NUMERIC(14,2) DEFAULT 0,
      remaining_amount NUMERIC(14,2) DEFAULT 0,
      invoice_ref TEXT,
      notes TEXT,
      entity_id TEXT NOT NULL,
      entity_type TEXT,
      created_by TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
      UNIQUE (entity_id, deposit_code)
    );
    CREATE INDEX IF NOT EXISTS idx_finance_deposits_entity ON finance_deposits(entity_id);
    CREATE INDEX IF NOT EXISTS idx_finance_deposits_status ON finance_deposits(status);
  `);
  tableReady = true;
}

function mapRow(row) {
  return {
    id: row.deposit_code,
    dbId: row.id,
    client: row.client_name,
    type: row.deposit_type,
    amount: Number(row.amount) || 0,
    currency: row.currency || 'SAR',
    dueDate: row.due_date ? String(row.due_date).slice(0, 10) : null,
    status: row.status,
    refundable: !!row.refundable,
    contract: row.contract_ref || '',
    project: row.project_name || '',
    method: row.payment_method || '',
    risk: Number(row.risk_score) || 0,
    settlement: {
      invoice: row.invoice_ref || '',
      settled: Number(row.settled_amount) || 0,
      remaining: Number(row.remaining_amount) || 0
    },
    notes: row.notes || '',
    entity_id: row.entity_id,
    entity_type: row.entity_type,
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

router.get('/', async (req, res) => {
  try {
    await ensureTable();
    const entityId = resolveScopedEntityId(req, req.query.entity_id);
    if (!entityId) {
      return res.status(400).json({ success: false, error: 'entity_id is required' });
    }
    const result = await db.query(
      `SELECT * FROM finance_deposits
       WHERE entity_id = $1
       ORDER BY updated_at DESC, id DESC`,
      [entityId]
    );
    res.json({
      success: true,
      entity_id: entityId,
      count: result.rows.length,
      records: result.rows.map(mapRow)
    });
  } catch (error) {
    console.error('deposits list error:', error);
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
    const clientName = String(body.client || body.client_name || '').trim();
    const amount = Number(body.amount);
    if (!clientName || !Number.isFinite(amount)) {
      return res.status(400).json({ success: false, error: 'اسم العميل والمبلغ مطلوبان' });
    }
    const code =
      String(body.id || body.deposit_code || '').trim() ||
      `DAP-${Date.now().toString().slice(-8)}`;
    const settled = Number(body.settlement?.settled ?? body.settled_amount ?? 0) || 0;
    const remaining =
      body.settlement?.remaining != null
        ? Number(body.settlement.remaining)
        : Math.max(amount - settled, 0);

    const result = await db.query(
      `INSERT INTO finance_deposits (
         deposit_code, client_name, deposit_type, amount, currency, due_date, status,
         refundable, contract_ref, project_name, payment_method, risk_score,
         settled_amount, remaining_amount, invoice_ref, notes, entity_id, entity_type, created_by
       ) VALUES (
         $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19
       )
       RETURNING *`,
      [
        code,
        clientName,
        body.type || body.deposit_type || 'عربون',
        amount,
        body.currency || 'SAR',
        body.dueDate || body.due_date || null,
        body.status || 'نشط',
        !!body.refundable,
        body.contract || body.contract_ref || null,
        body.project || body.project_name || null,
        body.method || body.payment_method || null,
        Number(body.risk || body.risk_score || 0) || 0,
        settled,
        remaining,
        body.settlement?.invoice || body.invoice_ref || null,
        body.notes || null,
        entityId,
        entityType,
        req.headers['x-user-id'] || 'system'
      ]
    );
    res.status(201).json({ success: true, record: mapRow(result.rows[0]) });
  } catch (error) {
    console.error('deposits create error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.put('/:code', async (req, res) => {
  try {
    await ensureTable();
    const body = req.body || {};
    const entityId = resolveScopedEntityId(req, body.entity_id || req.query.entity_id);
    if (!entityId) {
      return res.status(400).json({ success: false, error: 'entity_id is required' });
    }
    const amount = body.amount != null ? Number(body.amount) : null;
    const settled = body.settlement?.settled != null ? Number(body.settlement.settled) : null;
    const remaining =
      body.settlement?.remaining != null
        ? Number(body.settlement.remaining)
        : amount != null && settled != null
          ? Math.max(amount - settled, 0)
          : null;

    const result = await db.query(
      `UPDATE finance_deposits SET
         client_name = COALESCE($1, client_name),
         deposit_type = COALESCE($2, deposit_type),
         amount = COALESCE($3, amount),
         currency = COALESCE($4, currency),
         due_date = COALESCE($5, due_date),
         status = COALESCE($6, status),
         refundable = COALESCE($7, refundable),
         contract_ref = COALESCE($8, contract_ref),
         project_name = COALESCE($9, project_name),
         payment_method = COALESCE($10, payment_method),
         risk_score = COALESCE($11, risk_score),
         settled_amount = COALESCE($12, settled_amount),
         remaining_amount = COALESCE($13, remaining_amount),
         invoice_ref = COALESCE($14, invoice_ref),
         notes = COALESCE($15, notes),
         updated_at = NOW()
       WHERE deposit_code = $16 AND entity_id = $17
       RETURNING *`,
      [
        body.client || body.client_name || null,
        body.type || body.deposit_type || null,
        amount,
        body.currency || null,
        body.dueDate || body.due_date || null,
        body.status || null,
        body.refundable == null ? null : !!body.refundable,
        body.contract || body.contract_ref || null,
        body.project || body.project_name || null,
        body.method || body.payment_method || null,
        body.risk != null || body.risk_score != null ? Number(body.risk ?? body.risk_score) : null,
        settled,
        remaining,
        body.settlement?.invoice || body.invoice_ref || null,
        body.notes != null ? body.notes : null,
        req.params.code,
        entityId
      ]
    );
    if (!result.rows.length) {
      return res.status(404).json({ success: false, error: 'السجل غير موجود' });
    }
    res.json({ success: true, record: mapRow(result.rows[0]) });
  } catch (error) {
    console.error('deposits update error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.delete('/:code', async (req, res) => {
  try {
    await ensureTable();
    const entityId = resolveScopedEntityId(req, req.query.entity_id);
    if (!entityId) {
      return res.status(400).json({ success: false, error: 'entity_id is required' });
    }
    const result = await db.query(
      `DELETE FROM finance_deposits WHERE deposit_code = $1 AND entity_id = $2 RETURNING id`,
      [req.params.code, entityId]
    );
    if (!result.rows.length) {
      return res.status(404).json({ success: false, error: 'السجل غير موجود' });
    }
    res.json({ success: true, deleted: req.params.code });
  } catch (error) {
    console.error('deposits delete error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
