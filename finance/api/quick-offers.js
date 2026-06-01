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
        ADD COLUMN IF NOT EXISTS short_address TEXT;
    `);

    const { rows } = await db.query('SELECT COUNT(*)::int AS count FROM finance_quick_offers');
    if (rows[0].count === 0) {
      await db.query(`
        INSERT INTO finance_quick_offers
          (offer_code, title, category, discount_type, discount_value, start_at, end_at, status, approval_state,
           priority, target_segment, channels, budget, expected_roi, risk_score, impressions, conversions, revenue, cost, rules, notes)
        VALUES
          ('QO-2026-0001', 'عرض الإطلاق السريع للمنصة', 'اشتراكات', 'percent', 22, NOW() - INTERVAL '1 day', NOW() + INTERVAL '2 days', 'active', 'approved',
           'عالي', 'شركات التقنية الناشئة', ARRAY['web','sales','whatsapp'], 120000, 3.2, 12, 42000, 2850, 610000, 175000,
           '{"auto_pause_roi":true,"price_floor":0.18,"audience_cap":0.3}', 'حملة افتتاحية بمدة قصيرة مع تنبيهات تلقائية'),
          ('QO-2026-0002', 'عودة العملاء المتوقفين', 'احتفاظ', 'percent', 18, NOW() - INTERVAL '3 days', NOW() + INTERVAL '4 days', 'active', 'approved',
           'متوسط', 'عملاء الاشتراكات السنوية', ARRAY['email','web','crm'], 85000, 2.6, 15, 29000, 1210, 245000, 72000,
           '{"auto_pause_roi":true,"price_floor":0.15,"audience_cap":0.22}', 'تفعيل إعادة الشراء عبر قنوات متعددة'),
          ('QO-2026-0003', 'حزمة النمو الذكي', 'خدمات', 'amount', 1500, NOW() + INTERVAL '1 day', NOW() + INTERVAL '6 days', 'pending', 'pending',
           'عالي', 'شركات الخدمات الاستشارية', ARRAY['sales','events'], 160000, 3.8, 21, 12000, 380, 98000, 28000,
           '{"auto_pause_roi":false,"price_floor":0.2,"audience_cap":0.35}', 'حزمة خدمات مع خصم ثابت وربط بالمبيعات'),
          ('QO-2026-0004', 'فلاش خصم شركاء الحاضنات', 'شراكات', 'percent', 25, NOW() - INTERVAL '2 days', NOW() + INTERVAL '1 day', 'active', 'approved',
           'عالي', 'شركاء الحاضنات والمسرعات', ARRAY['partners','web'], 70000, 4.1, 9, 18000, 740, 210000, 45000,
           '{"auto_pause_roi":true,"price_floor":0.2,"audience_cap":0.28}', 'عرض سريع بتصعيد تلقائي للموافقة'),
          ('QO-2026-0005', 'عروض واتساب الفوري', 'قنوات', 'percent', 12, NOW() - INTERVAL '5 days', NOW() + INTERVAL '3 days', 'active', 'approved',
           'متوسط', 'العملاء النشطون مؤخرا', ARRAY['whatsapp','crm'], 54000, 2.1, 18, 36000, 990, 160000, 52000,
           '{"auto_pause_roi":false,"price_floor":0.12,"audience_cap":0.4}', 'تشغيل آلي عبر البوت مع متابعة فورية'),
          ('QO-2026-0006', 'برنامج القيادات التنفيذية', 'قطاع خاص', 'amount', 2500, NOW() + INTERVAL '2 days', NOW() + INTERVAL '10 days', 'draft', 'pending',
           'عالي', 'القيادات التنفيذية', ARRAY['sales','events','partners'], 200000, 5.0, 30, 8000, 220, 76000, 19000,
           '{"auto_pause_roi":false,"price_floor":0.25,"audience_cap":0.18}', 'عرض متكامل يحتاج موافقة خاصة')
      `);
    }

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
      short_address
    } = req.body;
    const entity_id = resolveScopedEntityId(req, req.body.entity_id);
    const entity_type = getRequestEntityContext(req).type;

    if (!title || !category || discount_value === undefined || !start_at || !end_at) {
      return res.status(400).json({ success: false, error: 'Missing required fields' });
    }

    const finalOfferCode = offer_code || await generateOfferCode();
    const channelsArray = normalizeChannels(channels);

    const result = await db.query(
      `INSERT INTO finance_quick_offers
        (offer_code, title, category, discount_type, discount_value, start_at, end_at, status, approval_state,
         priority, target_segment, channels, budget, expected_roi, risk_score, impressions, conversions, revenue, cost,
         rules, notes, street_name, postal_code, building_number, city, district, national_address_number, short_address,
         entity_id, entity_type, created_by)
       VALUES
        ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31)
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
        req.headers['x-user-id'] || 'system'
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
      channels: normalizeChannels(req.body.channels),
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
      short_address: req.body.short_address
    };
    const entityId = resolveScopedEntityId(req, req.body.entity_id);

    const updates = [];
    const values = [];
    Object.entries(fields).forEach(([key, value]) => {
      if (value !== undefined) {
        updates.push(`${key} = $${updates.length + 1}`);
        values.push(value);
      }
    });

    if (updates.length === 0) {
      return res.status(400).json({ success: false, error: 'No fields to update' });
    }

    updates.push(`updated_at = NOW()`);
    values.push(id, entityId);

    const result = await db.query(
      `UPDATE finance_quick_offers
       SET ${updates.join(', ')}
       WHERE id = $${values.length - 1} AND entity_id = $${values.length}
       RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Offer not found' });
    }

    res.json({ success: true, offer: result.rows[0] });
  } catch (error) {
    console.error('Error updating quick offer:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const entityId = resolveScopedEntityId(req, req.query.entity_id);
    const result = await db.query(
      'DELETE FROM finance_quick_offers WHERE id = $1 AND entity_id = $2 RETURNING id',
      [id, entityId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Offer not found' });
    }

    res.json({ success: true, id: result.rows[0].id });
  } catch (error) {
    console.error('Error deleting quick offer:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
