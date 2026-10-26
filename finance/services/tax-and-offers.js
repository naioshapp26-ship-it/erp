'use strict';

/**
 * Resolve active internal tax rates and apply approved quick offers to invoice lines.
 * Does not invent legal rates — uses tax_settings rows configured by the entity.
 */

function computeLineDiscount(offer, lineSubtotal) {
  const dtype = String(offer.discount_type || 'percent').toLowerCase();
  const value = Number(offer.discount_value) || 0;
  if (dtype === 'amount') return Math.min(lineSubtotal, value);
  const pct = Math.min(value, Number(offer.max_discount_pct == null ? 100 : offer.max_discount_pct));
  return Math.round(lineSubtotal * (pct / 100) * 100) / 100;
}

async function ensureTaxSettingsExtras(db) {
  await db.query(`
    ALTER TABLE tax_settings
      ADD COLUMN IF NOT EXISTS entity_id TEXT,
      ADD COLUMN IF NOT EXISTS effective_from DATE,
      ADD COLUMN IF NOT EXISTS effective_to DATE,
      ADD COLUMN IF NOT EXISTS exempt_item_codes TEXT[] DEFAULT '{}';
    CREATE TABLE IF NOT EXISTS tax_settings_audit (
      id SERIAL PRIMARY KEY,
      tax_id INTEGER,
      action TEXT NOT NULL,
      actor TEXT,
      before_value JSONB,
      after_value JSONB,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

async function resolveDefaultTaxRate(db, { entityId, branchId, onDate, applicableOn = 'invoice' }) {
  const day = onDate ? String(onDate).slice(0, 10) : new Date().toISOString().slice(0, 10);
  const result = await db.query(
    `SELECT *
     FROM tax_settings
     WHERE is_active = true
       AND tax_type = 'VAT'
       AND (applicable_on = $1 OR applicable_on = 'all')
       AND (entity_id IS NULL OR entity_id = $2)
       AND (branch_id IS NULL OR branch_id = $3)
       AND (effective_from IS NULL OR effective_from <= $4::date)
       AND (effective_to IS NULL OR effective_to >= $4::date)
     ORDER BY
       CASE WHEN entity_id = $2 THEN 0 ELSE 1 END,
       CASE WHEN branch_id = $3 THEN 0 ELSE 1 END,
       is_default DESC,
       priority ASC,
       id ASC
     LIMIT 1`,
    [applicableOn, entityId || null, branchId || null, day]
  );
  if (!result.rows[0]) return null;
  const row = result.rows[0];
  const rate = row.branch_specific_rate != null ? Number(row.branch_specific_rate) : Number(row.default_rate);
  return {
    tax: row,
    rate: Number.isFinite(rate) ? rate : 0
  };
}

async function loadActiveOffer(db, { entityId, offerCode }) {
  if (!offerCode) return null;
  const result = await db.query(
    `SELECT * FROM finance_quick_offers
     WHERE entity_id = $1 AND offer_code = $2
       AND status = 'active' AND approval_state = 'approved'
       AND start_at <= NOW() AND end_at >= NOW()
     LIMIT 1`,
    [entityId, String(offerCode).trim()]
  );
  return result.rows[0] || null;
}

function applyOfferAndTaxToLines(lines, { offer, taxRate, settingsTaxPct, exemptItemCodes }) {
  const exempt = new Set(
    (exemptItemCodes || []).map((c) => String(c || '').trim()).filter(Boolean)
  );
  let subtotal = 0;
  let discount_amount = 0;
  let tax_amount = 0;
  const priced = [];
  for (const line of lines || []) {
    const qty = Number(line.quantity) || 0;
    const price = Number(line.unit_price) || 0;
    const lineSubtotal = qty * price;
    const sku = String(line.item_code || line.sku || '').trim();
    let lineDiscount = Number(line.discount_amount);
    if (!Number.isFinite(lineDiscount)) {
      lineDiscount = lineSubtotal * (Number(line.discount_percentage) || 0) / 100;
    }
    if (offer) {
      const codes = offer.item_codes || [];
      const eligible = !codes.length || (sku && codes.includes(sku));
      if (eligible) {
        lineDiscount = Math.max(lineDiscount, computeLineDiscount(offer, lineSubtotal));
      }
    }
    const taxable = Math.max(0, lineSubtotal - lineDiscount);
    let taxPct = line.tax_percentage;
    if (taxPct == null || taxPct === '') {
      taxPct = taxRate != null ? taxRate : settingsTaxPct;
    }
    taxPct = Number(taxPct);
    if (!Number.isFinite(taxPct)) taxPct = 0;
    if (sku && exempt.has(sku)) taxPct = 0;
    const lineTax = taxable * (taxPct / 100);
    subtotal += lineSubtotal;
    discount_amount += lineDiscount;
    tax_amount += lineTax;
    priced.push({
      ...line,
      discount_amount: lineDiscount,
      tax_percentage: taxPct,
      tax_amount: lineTax,
      line_total: taxable + lineTax,
      offer_code: offer ? offer.offer_code : null,
      tax_exempt: !!(sku && exempt.has(sku))
    });
  }
  return {
    lines: priced,
    subtotal,
    discount_amount,
    tax_amount,
    total_amount: subtotal - discount_amount + tax_amount
  };
}

module.exports = {
  ensureTaxSettingsExtras,
  resolveDefaultTaxRate,
  loadActiveOffer,
  applyOfferAndTaxToLines
};
