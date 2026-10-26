const express = require('express');
const router = express.Router();
const db = require('../../db');
const { getRequestEntityContext } = require('../../entity-context');

const resolveScopedEntityId = (req, explicitEntityId = null) => {
  const context = getRequestEntityContext(req);
  if (context.type !== 'HQ') {
    return context.id;
  }
  return explicitEntityId || req.headers['x-entity-id'] || context.id;
};

const ensureQuickOffersTable = async () => {
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS finance_quick_offers (
        id SERIAL PRIMARY KEY,
        offer_code TEXT UNIQUE NOT NULL,
        title TEXT NOT NULL,
        category TEXT NOT NULL,
        discount_type TEXT NOT NULL DEFAULT 'percent',
        discount_value NUMERIC NOT NULL DEFAULT 0,
        start_at TIMESTAMP NOT NULL,
        end_at TIMESTAMP NOT NULL,
        status TEXT NOT NULL DEFAULT 'draft',
        approval_state TEXT NOT NULL DEFAULT 'pending',
        priority TEXT DEFAULT 'متوسط',
        target_segment TEXT,
        channels TEXT[] DEFAULT '{}',
        budget NUMERIC DEFAULT 0,
        expected_roi NUMERIC DEFAULT 0,
        risk_score NUMERIC DEFAULT 0,
        impressions INTEGER DEFAULT 0,
        conversions INTEGER DEFAULT 0,
        revenue NUMERIC DEFAULT 0,
        cost NUMERIC DEFAULT 0,
        rules JSONB DEFAULT '{}'::jsonb,
        notes TEXT,
        street_name TEXT,
        postal_code TEXT,
        building_number TEXT,
        city TEXT,
        district TEXT,
        national_address_number TEXT,
        short_address TEXT,
        entity_id TEXT DEFAULT 'HQ001',
        entity_type TEXT DEFAULT 'HQ',
        created_by TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_quick_offers_entity ON finance_quick_offers(entity_id);
      CREATE INDEX IF NOT EXISTS idx_quick_offers_status ON finance_quick_offers(status);
      CREATE INDEX IF NOT EXISTS idx_quick_offers_dates ON finance_quick_offers(start_at, end_at);
    `);

    await db.query(`
      ALTER TABLE finance_quick_offers
        ADD COLUMN IF NOT EXISTS street_name TEXT,
        ADD COLUMN IF NOT EXISTS postal_code TEXT,
        ADD COLUMN IF NOT EXISTS building_number TEXT,
        ADD COLUMN IF NOT EXISTS city TEXT,
        ADD COLUMN IF NOT EXISTS district TEXT,
        ADD COLUMN IF NOT EXISTS national_address_number TEXT,
        ADD COLUMN IF NOT EXISTS short_address TEXT,
        ADD COLUMN IF NOT EXISTS item_codes TEXT[] DEFAULT '{}',
        ADD COLUMN IF NOT EXISTS max_discount_pct NUMERIC DEFAULT 100,
        ADD COLUMN IF NOT EXISTS updated_by TEXT,
        ADD COLUMN IF NOT EXISTS activated_by TEXT,
        ADD COLUMN IF NOT EXISTS activated_at TIMESTAMP,
        ADD COLUMN IF NOT EXISTS audit_log JSONB DEFAULT '[]'::jsonb;
    `);

    // Do not seed demo marketing offers as if they were real production data.
    console.log('✅ finance_quick_offers table ready');
  } catch (error) {
    console.error('❌ Failed to ensure finance_quick_offers table:', error);
  }
};

ensureQuickOffersTable();

const normalizeChannels = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter(Boolean);
  if (typeof value === 'string') {
    return value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
};

const generateOfferCode = async () => {
  const year = new Date().getFullYear();
  const prefix = `QO-${year}-`;
  const result = await db.query(
    'SELECT offer_code FROM finance_quick_offers WHERE offer_code LIKE $1 ORDER BY id DESC LIMIT 1',
    [`${prefix}%`]
  );
  const lastCode = result.rows[0]?.offer_code || `${prefix}0000`;
  const numeric = (lastCode.match(/\d+$/) || ['0000'])[0];
  const nextNumber = String(parseInt(numeric, 10) + 1).padStart(4, '0');
  return `${prefix}${nextNumber}`;
};

const normalizeItemCodes = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean);
  return String(value)
    .split(/[\s,]+/)
    .map((item) => item.trim())
    .filter(Boolean);
};

const actorOf = (req) => req.headers['x-user-id'] || req.authUser?.email || req.authUser?.id || 'system';

const appendAudit = (existing, entry) => {
  const list = Array.isArray(existing) ? existing.slice(-49) : [];
  list.push({ ...entry, at: new Date().toISOString() });
  return list;
};

const validateOfferBody = ({ title, category, discount_type, discount_value, start_at, end_at, max_discount_pct }) => {
  if (!title || !category || discount_value === undefined || discount_value === null || !start_at || !end_at) {
    return 'الحقول الإلزامية: العنوان، الفئة، نوع/قيمة الخصم، وتاريخ البداية والنهاية';
  }
  const dtype = String(discount_type || 'percent').toLowerCase();
  if (!['percent', 'amount'].includes(dtype)) return 'نوع الخصم يجب أن يكون نسبة أو مبلغًا ثابتًا';
  const value = Number(discount_value);
  if (!Number.isFinite(value) || value < 0) return 'قيمة الخصم غير صالحة';
  if (dtype === 'percent' && value > 100) return 'نسبة الخصم لا تتجاوز 100%';
  const maxPct = Number(max_discount_pct == null ? 100 : max_discount_pct);
  if (!Number.isFinite(maxPct) || maxPct < 0 || maxPct > 100) return 'الحد الأعلى للخصم غير صالح';
  if (dtype === 'percent' && value > maxPct) return `نسبة الخصم تتجاوز الحد المسموح (${maxPct}%)`;
  if (new Date(end_at) < new Date(start_at)) return 'تاريخ نهاية العرض قبل تاريخ البداية';
  return null;
};

function computeLineDiscount(offer, lineSubtotal) {
  const dtype = String(offer.discount_type || 'percent').toLowerCase();
  const value = Number(offer.discount_value) || 0;
  if (dtype === 'amount') return Math.min(lineSubtotal, value);
  const pct = Math.min(value, Number(offer.max_discount_pct == null ? 100 : offer.max_discount_pct));
  return Math.round(lineSubtotal * (pct / 100) * 100) / 100;
}

router.get('/', async (req, res) => {
  try {
    const { status, category, channel, q } = req.query;
    const entity_id = resolveScopedEntityId(req, req.query.entity_id);

    let query = 'SELECT * FROM finance_quick_offers WHERE entity_id = $1';
    const params = [entity_id];

    if (status) {
      params.push(status);
      query += ` AND status = $${params.length}`;
    }
    if (category) {
      params.push(category);
      query += ` AND category = $${params.length}`;
    }
    if (channel) {
      params.push(channel);
      query += ` AND $${params.length} = ANY(channels)`;
    }
    if (q) {
      params.push(`%${q}%`);
      query += ` AND (title ILIKE $${params.length} OR offer_code ILIKE $${params.length} OR target_segment ILIKE $${params.length})`;
    }

    query += ' ORDER BY start_at DESC, id DESC';

    const result = await db.query(query, params);
    res.json({ success: true, offers: result.rows });
  } catch (error) {
    console.error('Error fetching quick offers:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/summary', async (req, res) => {
  try {
    const entity_id = resolveScopedEntityId(req, req.query.entity_id);
    const result = await db.query(
      `SELECT
        COUNT(*) FILTER (WHERE status = 'active')::int AS active_count,
        ROUND(AVG(discount_value)::numeric, 2) AS avg_discount,
        COUNT(*) FILTER (WHERE end_at <= NOW() + INTERVAL '72 hours')::int AS expiring_soon,
        ROUND((SUM(conversions)::numeric / NULLIF(SUM(impressions), 0)) * 100, 2) AS conversion_rate
      FROM finance_quick_offers
      WHERE entity_id = $1`,
      [entity_id]
    );

    res.json({ success: true, summary: result.rows[0] });
  } catch (error) {
    console.error('Error fetching quick offers summary:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/applicable', async (req, res) => {
  try {
    const entity_id = resolveScopedEntityId(req, req.query.entity_id);
    const channel = String(req.query.channel || 'invoice').trim();
    const sku = String(req.query.sku || '').trim();
    const when = req.query.at ? new Date(req.query.at) : new Date();
    const result = await db.query(
      `SELECT *
       FROM finance_quick_offers
       WHERE entity_id = $1
         AND status = 'active'
         AND approval_state = 'approved'
         AND start_at <= $2
         AND end_at >= $2
         AND ($3 = ANY(channels) OR cardinality(channels) = 0)
       ORDER BY discount_value DESC, id DESC`,
      [entity_id, when.toISOString(), channel]
    );
    const offers = result.rows.filter((offer) => {
      const codes = offer.item_codes || [];
      if (!codes.length) return true;
      if (!sku) return true;
      return codes.includes(sku);
    });
    res.json({ success: true, offers, count: offers.length });
  } catch (error) {
    console.error('Error fetching applicable offers:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/preview', async (req, res) => {
  try {
    const entity_id = resolveScopedEntityId(req, req.body.entity_id);
    const offer_code = String(req.body.offer_code || '').trim();
    const lines = Array.isArray(req.body.lines) ? req.body.lines : [];
    if (!offer_code) return res.status(400).json({ success: false, error: 'رمز العرض مطلوب' });
    const offerRes = await db.query(
      `SELECT * FROM finance_quick_offers
       WHERE entity_id = $1 AND offer_code = $2
         AND status = 'active' AND approval_state = 'approved'
         AND start_at <= NOW() AND end_at >= NOW()
       LIMIT 1`,
      [entity_id, offer_code]
    );
    if (!offerRes.rows[0]) {
      return res.status(404).json({ success: false, error: 'العرض غير نشط أو خارج فترة الصلاحية' });
    }
    const offer = offerRes.rows[0];
    const priced = lines.map((line) => {
      const qty = Number(line.quantity) || 0;
      const price = Number(line.unit_price) || 0;
      const subtotal = qty * price;
      const codes = offer.item_codes || [];
      const sku = String(line.item_code || line.sku || '').trim();
      const eligible = !codes.length || (sku && codes.includes(sku));
      const discount_amount = eligible ? computeLineDiscount(offer, subtotal) : 0;
      return {
        ...line,
        eligible,
        discount_amount,
        line_subtotal_after_discount: Math.max(0, subtotal - discount_amount)
      };
    });
    const discount_total = priced.reduce((sum, line) => sum + Number(line.discount_amount || 0), 0);
    res.json({ success: true, offer, lines: priced, discount_total });
  } catch (error) {
    console.error('Error previewing offer:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const {
      offer_code,
      title,
      category,
      discount_type = 'percent',
      discount_value,
      start_at,
      end_at,
      status = 'draft',
      approval_state = 'pending',
      priority = 'متوسط',
      target_segment,
      channels,
      budget = 0,
      expected_roi = 0,
      risk_score = 0,
      impressions = 0,
      conversions = 0,
      revenue = 0,
      cost = 0,
      rules = {},
      notes,
      street_name,
      postal_code,
      building_number,
      city,
      district,
      national_address_number,
      short_address,
      item_codes,
      max_discount_pct = 100
    } = req.body;
    const entity_id = resolveScopedEntityId(req, req.body.entity_id);
    const entity_type = getRequestEntityContext(req).type;
    const actor = actorOf(req);

    const problem = validateOfferBody({
      title, category, discount_type, discount_value, start_at, end_at, max_discount_pct
    });
    if (problem) return res.status(400).json({ success: false, error: problem });

    const finalOfferCode = offer_code || await generateOfferCode();
    const channelsArray = normalizeChannels(channels);
    const itemCodes = normalizeItemCodes(item_codes);
    const audit = appendAudit([], { action: 'create', by: actor, status, approval_state });

    const result = await db.query(
      `INSERT INTO finance_quick_offers
        (offer_code, title, category, discount_type, discount_value, start_at, end_at, status, approval_state,
         priority, target_segment, channels, budget, expected_roi, risk_score, impressions, conversions, revenue, cost,
         rules, notes, street_name, postal_code, building_number, city, district, national_address_number, short_address,
         entity_id, entity_type, created_by, item_codes, max_discount_pct, audit_log)
       VALUES
        ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33,$34::jsonb)
       RETURNING *`,
      [
        finalOfferCode,
        title,
        category,
        discount_type,
        discount_value,
        start_at,
        end_at,
        status,
        approval_state,
        priority,
        target_segment,
        channelsArray,
        budget,
        expected_roi,
        risk_score,
        impressions,
        conversions,
        revenue,
        cost,
        rules,
        notes,
        street_name,
        postal_code,
        building_number,
        city,
        district,
        national_address_number,
        short_address,
        entity_id,
        entity_type,
        actor,
        itemCodes,
        max_discount_pct,
        JSON.stringify(audit)
      ]
    );

    res.status(201).json({ success: true, offer: result.rows[0] });
  } catch (error) {
    console.error('Error creating quick offer:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const actor = actorOf(req);
    const entityId = resolveScopedEntityId(req, req.body.entity_id);
    const current = await db.query(
      'SELECT * FROM finance_quick_offers WHERE id = $1 AND entity_id = $2',
      [id, entityId]
    );
    if (!current.rows[0]) {
      return res.status(404).json({ success: false, error: 'العرض غير موجود' });
    }

    const merged = {
      title: req.body.title !== undefined ? req.body.title : current.rows[0].title,
      category: req.body.category !== undefined ? req.body.category : current.rows[0].category,
      discount_type: req.body.discount_type !== undefined ? req.body.discount_type : current.rows[0].discount_type,
      discount_value: req.body.discount_value !== undefined ? req.body.discount_value : current.rows[0].discount_value,
      start_at: req.body.start_at !== undefined ? req.body.start_at : current.rows[0].start_at,
      end_at: req.body.end_at !== undefined ? req.body.end_at : current.rows[0].end_at,
      max_discount_pct: req.body.max_discount_pct !== undefined ? req.body.max_discount_pct : current.rows[0].max_discount_pct
    };
    const problem = validateOfferBody(merged);
    if (problem) return res.status(400).json({ success: false, error: problem });

    const fields = {
      title: req.body.title,
      category: req.body.category,
      discount_type: req.body.discount_type,
      discount_value: req.body.discount_value,
      start_at: req.body.start_at,
      end_at: req.body.end_at,
      status: req.body.status,
      approval_state: req.body.approval_state,
      priority: req.body.priority,
      target_segment: req.body.target_segment,
      channels: req.body.channels !== undefined ? normalizeChannels(req.body.channels) : undefined,
      budget: req.body.budget,
      expected_roi: req.body.expected_roi,
      risk_score: req.body.risk_score,
      impressions: req.body.impressions,
      conversions: req.body.conversions,
      revenue: req.body.revenue,
      cost: req.body.cost,
      rules: req.body.rules,
      notes: req.body.notes,
      street_name: req.body.street_name,
      postal_code: req.body.postal_code,
      building_number: req.body.building_number,
      city: req.body.city,
      district: req.body.district,
      national_address_number: req.body.national_address_number,
      short_address: req.body.short_address,
      item_codes: req.body.item_codes !== undefined ? normalizeItemCodes(req.body.item_codes) : undefined,
      max_discount_pct: req.body.max_discount_pct,
      updated_by: actor,
      audit_log: appendAudit(current.rows[0].audit_log, { action: 'update', by: actor, fields: Object.keys(req.body || {}) })
    };

    const updates = [];
    const values = [];
    Object.entries(fields).forEach(([key, value]) => {
      if (value !== undefined) {
        updates.push(`${key} = $${updates.length + 1}${key === 'audit_log' ? '::jsonb' : ''}`);
        values.push(key === 'audit_log' ? JSON.stringify(value) : value);
      }
    });

    if (updates.length === 0) {
      return res.status(400).json({ success: false, error: 'لا حقول للتعديل' });
    }

    updates.push('updated_at = NOW()');
    values.push(id, entityId);

    const result = await db.query(
      `UPDATE finance_quick_offers
       SET ${updates.join(', ')}
       WHERE id = $${values.length - 1} AND entity_id = $${values.length}
       RETURNING *`,
      values
    );

    res.json({ success: true, offer: result.rows[0] });
  } catch (error) {
    console.error('Error updating quick offer:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/:id/activate', async (req, res) => {
  try {
    const { id } = req.params;
    const actor = actorOf(req);
    const entityId = resolveScopedEntityId(req, req.body.entity_id);
    const current = await db.query(
      'SELECT * FROM finance_quick_offers WHERE id = $1 AND entity_id = $2',
      [id, entityId]
    );
    if (!current.rows[0]) return res.status(404).json({ success: false, error: 'العرض غير موجود' });
    const offer = current.rows[0];
    if (new Date(offer.end_at) < new Date()) {
      return res.status(409).json({ success: false, error: 'انتهت صلاحية العرض ولا يمكن تفعيله' });
    }
    const audit = appendAudit(offer.audit_log, { action: 'activate', by: actor });
    const result = await db.query(
      `UPDATE finance_quick_offers
       SET status = 'active',
           approval_state = 'approved',
           activated_by = $1,
           activated_at = NOW(),
           updated_by = $1,
           updated_at = NOW(),
           audit_log = $2::jsonb
       WHERE id = $3 AND entity_id = $4
       RETURNING *`,
      [actor, JSON.stringify(audit), id, entityId]
    );
    res.json({ success: true, offer: result.rows[0], message: 'تم تفعيل العرض' });
  } catch (error) {
    console.error('Error activating offer:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/:id/deactivate', async (req, res) => {
  try {
    const { id } = req.params;
    const actor = actorOf(req);
    const entityId = resolveScopedEntityId(req, req.body.entity_id);
    const current = await db.query(
      'SELECT * FROM finance_quick_offers WHERE id = $1 AND entity_id = $2',
      [id, entityId]
    );
    if (!current.rows[0]) return res.status(404).json({ success: false, error: 'العرض غير موجود' });
    const audit = appendAudit(current.rows[0].audit_log, { action: 'deactivate', by: actor });
    const result = await db.query(
      `UPDATE finance_quick_offers
       SET status = 'paused',
           updated_by = $1,
           updated_at = NOW(),
           audit_log = $2::jsonb
       WHERE id = $3 AND entity_id = $4
       RETURNING *`,
      [actor, JSON.stringify(audit), id, entityId]
    );
    res.json({ success: true, offer: result.rows[0], message: 'تم إيقاف العرض' });
  } catch (error) {
    console.error('Error deactivating offer:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const entityId = resolveScopedEntityId(req, req.query.entity_id);
    const current = await db.query(
      'SELECT status FROM finance_quick_offers WHERE id = $1 AND entity_id = $2',
      [id, entityId]
    );
    if (!current.rows[0]) {
      return res.status(404).json({ success: false, error: 'العرض غير موجود' });
    }
    if (current.rows[0].status === 'active') {
      return res.status(409).json({
        success: false,
        error: 'العرض النشط لا يُحذف. أوقفه أولًا ثم احذف المسودة إن لزم.'
      });
    }
    const result = await db.query(
      'DELETE FROM finance_quick_offers WHERE id = $1 AND entity_id = $2 RETURNING id',
      [id, entityId]
    );
    res.json({ success: true, id: result.rows[0].id });
  } catch (error) {
    console.error('Error deleting quick offer:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
module.exports.computeLineDiscount = computeLineDiscount;
module.exports.validateOfferBody = validateOfferBody;
