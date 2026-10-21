'use strict';

/**
 * Sales quotations (عروض الأسعار) — Postgres-backed.
 * Mount: /finance/sales-quotes
 * Applies finance.page.quotes settings on create.
 */

const express = require('express');
const db = require('../../db');
const { resolveScopedEntityId, resolveScopedEntityType } = require('./resolve-scoped-entity');
const pageDocumentSettings = require('../services/page-document-settings');

const router = express.Router();
let tableReady = false;

async function ensureTable() {
  if (tableReady) return;
  await db.query(`
    CREATE TABLE IF NOT EXISTS finance_sales_quotes (
      id SERIAL PRIMARY KEY,
      quote_number TEXT NOT NULL,
      quote_date DATE NOT NULL DEFAULT CURRENT_DATE,
      valid_until DATE,
      customer_id INTEGER,
      customer_name TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'DRAFT',
      currency TEXT NOT NULL DEFAULT 'SAR',
      subtotal NUMERIC(14,2) NOT NULL DEFAULT 0,
      tax_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
      discount_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
      total_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
      notes TEXT,
      footer_text TEXT,
      lines JSONB NOT NULL DEFAULT '[]'::jsonb,
      converted_invoice_id INTEGER,
      entity_id TEXT NOT NULL,
      entity_type TEXT,
      created_by TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
      UNIQUE (entity_id, quote_number)
    );
    CREATE INDEX IF NOT EXISTS idx_finance_sales_quotes_entity ON finance_sales_quotes(entity_id);
    CREATE INDEX IF NOT EXISTS idx_finance_sales_quotes_status ON finance_sales_quotes(status);
  `);
  tableReady = true;
}

function computeTotals(lines, defaultTaxPct) {
  let subtotal = 0;
  let discount = 0;
  let tax = 0;
  const normalized = (Array.isArray(lines) ? lines : []).map((line, idx) => {
    const qty = Number(line.quantity) || 0;
    const price = Number(line.unit_price) || 0;
    const lineSub = qty * price;
    const lineDiscount = Number(line.discount_amount) || (lineSub * (Number(line.discount_percentage) || 0) / 100);
    const taxable = lineSub - lineDiscount;
    const taxPct = line.tax_percentage != null ? Number(line.tax_percentage) : Number(defaultTaxPct) || 0;
    const lineTax = taxable * taxPct / 100;
    subtotal += lineSub;
    discount += lineDiscount;
    tax += lineTax;
    return {
      line_number: idx + 1,
      item_name: line.item_name || line.description || `بند ${idx + 1}`,
      description: line.description || null,
      quantity: qty,
      unit_price: price,
      discount_percentage: Number(line.discount_percentage) || 0,
      discount_amount: lineDiscount,
      tax_percentage: taxPct,
      tax_amount: Math.round(lineTax * 100) / 100,
      line_total: Math.round((taxable + lineTax) * 100) / 100
    };
  });
  return {
    lines: normalized,
    subtotal: Math.round(subtotal * 100) / 100,
    discount_amount: Math.round(discount * 100) / 100,
    tax_amount: Math.round(tax * 100) / 100,
    total_amount: Math.round((subtotal - discount + tax) * 100) / 100
  };
}

async function nextQuoteNumber(prefix, entityId) {
  const result = await db.query(
    `SELECT quote_number FROM finance_sales_quotes
     WHERE entity_id = $1 AND quote_number ~ ('^' || $2 || '-[0-9]+$')
     ORDER BY quote_number DESC LIMIT 1`,
    [entityId, prefix]
  );
  const last = result.rows[0]?.quote_number || '';
  const nums = String(last).match(/\d+/g) || [];
  const next = (nums.length ? parseInt(nums[nums.length - 1], 10) : 0) + 1;
  return `${prefix}-${String(next).padStart(4, '0')}`;
}

router.get('/', async (req, res) => {
  try {
    await ensureTable();
    const entityId = resolveScopedEntityId(req, req.query.entity_id);
    if (!entityId) {
      return res.status(400).json({ success: false, error: 'entity_id is required' });
    }
    const result = await db.query(
      `SELECT * FROM finance_sales_quotes WHERE entity_id = $1 ORDER BY quote_date DESC, id DESC`,
      [entityId]
    );
    res.json({ success: true, entity_id: entityId, count: result.rows.length, quotes: result.rows });
  } catch (error) {
    console.error('sales-quotes list error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    await ensureTable();
    const entityId = resolveScopedEntityId(req, req.query.entity_id);
    const result = await db.query(
      `SELECT * FROM finance_sales_quotes WHERE id = $1 AND ($2::text IS NULL OR entity_id = $2)`,
      [req.params.id, entityId]
    );
    if (!result.rows.length) {
      return res.status(404).json({ success: false, error: 'عرض السعر غير موجود' });
    }
    res.json({ success: true, quote: result.rows[0] });
  } catch (error) {
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

    let settings = {};
    try {
      const doc = await pageDocumentSettings.getDocSettings(
        'quotes',
        pageDocumentSettings.resolveTenantId(req)
      );
      settings = doc.value || {};
    } catch (e) {
      console.warn('quotes settings skipped:', e.message);
    }

    const customerName = String(body.customer_name || '').trim();
    if (settings.require_customer !== false && !customerName && !body.customer_id) {
      return res.status(400).json({ success: false, error: 'العميل مطلوب حسب إعدادات عروض الأسعار' });
    }
    if (!customerName) {
      return res.status(400).json({ success: false, error: 'اسم العميل مطلوب' });
    }

    const totals = computeTotals(body.lines || [], settings.default_tax_pct ?? 15);
    if (!totals.lines.length) {
      return res.status(400).json({ success: false, error: 'أضف بندًا واحدًا على الأقل' });
    }

    const prefix = String(settings.number_prefix || 'QOT').trim() || 'QOT';
    const quoteNumber = body.quote_number || (await nextQuoteNumber(prefix, entityId));
    const quoteDate = body.quote_date || new Date().toISOString().slice(0, 10);
    let validUntil = body.valid_until || null;
    if (!validUntil) {
      const days = Number(settings.validity_days);
      if (Number.isFinite(days) && days >= 0) {
        const d = new Date(quoteDate);
        d.setDate(d.getDate() + days);
        validUntil = d.toISOString().slice(0, 10);
      }
    }

    const result = await db.query(
      `INSERT INTO finance_sales_quotes (
         quote_number, quote_date, valid_until, customer_id, customer_name, status, currency,
         subtotal, tax_amount, discount_amount, total_amount, notes, footer_text, lines,
         entity_id, entity_type, created_by
       ) VALUES (
         $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14::jsonb,$15,$16,$17
       ) RETURNING *`,
      [
        quoteNumber,
        quoteDate,
        validUntil,
        body.customer_id || null,
        customerName,
        body.status || 'DRAFT',
        body.currency || 'SAR',
        totals.subtotal,
        totals.tax_amount,
        totals.discount_amount,
        totals.total_amount,
        body.notes || null,
        body.footer_text != null ? body.footer_text : settings.footer_text || null,
        JSON.stringify(totals.lines),
        entityId,
        entityType,
        req.headers['x-user-id'] || 'system'
      ]
    );
    res.status(201).json({ success: true, quote: result.rows[0], settings_applied: {
      number_prefix: prefix,
      validity_days: settings.validity_days,
      default_tax_pct: settings.default_tax_pct
    }});
  } catch (error) {
    console.error('sales-quotes create error:', error);
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
      `SELECT * FROM finance_sales_quotes WHERE id = $1 AND entity_id = $2`,
      [req.params.id, entityId]
    );
    if (!existing.rows.length) {
      return res.status(404).json({ success: false, error: 'عرض السعر غير موجود' });
    }
    if (existing.rows[0].status === 'CONVERTED') {
      return res.status(400).json({ success: false, error: 'لا يمكن تعديل عرض محوّل لفاتورة' });
    }

    let settings = { default_tax_pct: 15 };
    try {
      const doc = await pageDocumentSettings.getDocSettings(
        'quotes',
        pageDocumentSettings.resolveTenantId(req)
      );
      settings = { ...settings, ...(doc.value || {}) };
    } catch (_) { /* */ }

    const totals = body.lines
      ? computeTotals(body.lines, settings.default_tax_pct)
      : null;

    const result = await db.query(
      `UPDATE finance_sales_quotes SET
         customer_name = COALESCE($1, customer_name),
         customer_id = COALESCE($2, customer_id),
         quote_date = COALESCE($3, quote_date),
         valid_until = COALESCE($4, valid_until),
         status = COALESCE($5, status),
         currency = COALESCE($6, currency),
         notes = COALESCE($7, notes),
         footer_text = COALESCE($8, footer_text),
         lines = COALESCE($9::jsonb, lines),
         subtotal = COALESCE($10, subtotal),
         tax_amount = COALESCE($11, tax_amount),
         discount_amount = COALESCE($12, discount_amount),
         total_amount = COALESCE($13, total_amount),
         updated_at = NOW()
       WHERE id = $14 AND entity_id = $15
       RETURNING *`,
      [
        body.customer_name || null,
        body.customer_id || null,
        body.quote_date || null,
        body.valid_until || null,
        body.status || null,
        body.currency || null,
        body.notes != null ? body.notes : null,
        body.footer_text != null ? body.footer_text : null,
        totals ? JSON.stringify(totals.lines) : null,
        totals ? totals.subtotal : null,
        totals ? totals.tax_amount : null,
        totals ? totals.discount_amount : null,
        totals ? totals.total_amount : null,
        req.params.id,
        entityId
      ]
    );
    res.json({ success: true, quote: result.rows[0] });
  } catch (error) {
    console.error('sales-quotes update error:', error);
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
      `DELETE FROM finance_sales_quotes
       WHERE id = $1 AND entity_id = $2 AND status <> 'CONVERTED'
       RETURNING id`,
      [req.params.id, entityId]
    );
    if (!result.rows.length) {
      return res.status(404).json({ success: false, error: 'تعذّر الحذف' });
    }
    res.json({ success: true, deleted: Number(req.params.id) });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
