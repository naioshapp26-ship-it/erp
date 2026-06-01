const express = require('express');
const router = express.Router();
const db = require('../../db');
const { getRequestEntityContext, buildEntityScopeCondition } = require('../../entity-context');

const resolveScopedEntityId = (req, explicitEntityId = null) => {
  const context = getRequestEntityContext(req);
  if (context.type !== 'HQ') {
    return context.id;
  }
  return explicitEntityId || req.headers['x-entity-id'] || context.id;
};

const ensureShippingFeesTables = async () => {
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS finance_shipping_fees (
        fee_id TEXT PRIMARY KEY,
        fee_name TEXT NOT NULL,
        carrier TEXT NOT NULL,
        service_level TEXT NOT NULL,
        zone TEXT NOT NULL,
        weight_min NUMERIC(10, 2) NOT NULL DEFAULT 0,
        weight_max NUMERIC(10, 2) NOT NULL DEFAULT 0,
        base_fee NUMERIC(14, 2) NOT NULL DEFAULT 0,
        per_kg_fee NUMERIC(14, 2) NOT NULL DEFAULT 0,
        fuel_surcharge NUMERIC(14, 2) NOT NULL DEFAULT 0,
        remote_area_fee NUMERIC(14, 2) NOT NULL DEFAULT 0,
        cod_fee NUMERIC(14, 2) NOT NULL DEFAULT 0,
        currency TEXT NOT NULL DEFAULT 'SAR',
        status TEXT NOT NULL DEFAULT 'مسودة',
        sla_hours INTEGER NOT NULL DEFAULT 48,
        max_orders INTEGER NOT NULL DEFAULT 0,
        risk_level TEXT NOT NULL DEFAULT 'منخفض',
        effective_from DATE NOT NULL,
        effective_to DATE,
        owner_name TEXT,
        notes TEXT,
        street_name TEXT,
        postal_code TEXT,
        building_number TEXT,
        city TEXT,
        district TEXT,
        national_address_number TEXT,
        short_address TEXT,
        entity_id TEXT DEFAULT 'HQ001',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS finance_shipping_fee_workflows (
        id SERIAL PRIMARY KEY,
        fee_id TEXT NOT NULL REFERENCES finance_shipping_fees(fee_id) ON DELETE CASCADE,
        step TEXT NOT NULL,
        status TEXT NOT NULL,
        actor TEXT,
        comment TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_shipping_fees_status ON finance_shipping_fees(status);
      CREATE INDEX IF NOT EXISTS idx_shipping_fees_carrier ON finance_shipping_fees(carrier);
      CREATE INDEX IF NOT EXISTS idx_shipping_fees_zone ON finance_shipping_fees(zone);
      CREATE INDEX IF NOT EXISTS idx_shipping_fees_risk ON finance_shipping_fees(risk_level);
      CREATE INDEX IF NOT EXISTS idx_shipping_fees_entity ON finance_shipping_fees(entity_id);
      CREATE INDEX IF NOT EXISTS idx_shipping_workflow_fee ON finance_shipping_fee_workflows(fee_id);
    `);

    await db.query(`
      ALTER TABLE finance_shipping_fees
        ADD COLUMN IF NOT EXISTS street_name TEXT,
        ADD COLUMN IF NOT EXISTS postal_code TEXT,
        ADD COLUMN IF NOT EXISTS building_number TEXT,
        ADD COLUMN IF NOT EXISTS city TEXT,
        ADD COLUMN IF NOT EXISTS district TEXT,
        ADD COLUMN IF NOT EXISTS national_address_number TEXT,
        ADD COLUMN IF NOT EXISTS short_address TEXT;
    `);
    console.log('✅ finance_shipping_fees tables ready');
  } catch (error) {
    console.error('❌ Failed to ensure finance_shipping_fees tables:', error);
  }
};

ensureShippingFeesTables();

const generateFeeId = async () => {
  const result = await db.query(
    `SELECT COALESCE(MAX(CAST(regexp_replace(fee_id, '\\D', '', 'g') AS INTEGER)), 2000) AS max_id
     FROM finance_shipping_fees`
  );
  const nextId = (result.rows[0]?.max_id || 2000) + 1;
  return `SHP-${nextId}`;
};

const buildFilters = (req) => {
  const {
    status,
    carrier,
    zone,
    risk,
    q
  } = req.query;
  const entity_id = resolveScopedEntityId(req, req.query.entity_id);

  const conditions = [buildEntityScopeCondition(getRequestEntityContext(req), 'entity_id', 1)];
  const values = [entity_id];

  if (status) {
    values.push(status);
    conditions.push(`status = $${values.length}`);
  }
  if (carrier) {
    values.push(carrier);
    conditions.push(`carrier = $${values.length}`);
  }
  if (zone) {
    values.push(zone);
    conditions.push(`zone = $${values.length}`);
  }
  if (risk) {
    values.push(risk);
    conditions.push(`risk_level = $${values.length}`);
  }
  if (q) {
    values.push(`%${q}%`);
    conditions.push(`(fee_id ILIKE $${values.length} OR fee_name ILIKE $${values.length} OR carrier ILIKE $${values.length} OR zone ILIKE $${values.length})`);
  }

  return { conditions, values, entity_id };
};

router.get('/', async (req, res) => {
  try {
    const { conditions, values, entity_id } = buildFilters(req);

    const result = await db.query(
      `SELECT * FROM finance_shipping_fees
       WHERE ${conditions.join(' AND ')}
       ORDER BY effective_from DESC, fee_id DESC`,
      values
    );

    res.json({ success: true, entity_id, fees: result.rows });
  } catch (error) {
    console.error('Error fetching shipping fees:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/metrics', async (req, res) => {
  try {
    const { conditions, values, entity_id } = buildFilters(req);

    const result = await db.query(
      `SELECT
        COUNT(*)::int AS total_count,
        COUNT(*) FILTER (WHERE status = 'نشط')::int AS active_count,
        COUNT(*) FILTER (WHERE status = 'قيد المراجعة')::int AS pending_count,
        COUNT(*) FILTER (WHERE status = 'معلق')::int AS paused_count,
        ROUND(AVG(base_fee)::numeric, 2) AS avg_base_fee,
        ROUND(AVG(per_kg_fee)::numeric, 2) AS avg_per_kg_fee,
        ROUND(AVG(sla_hours)::numeric, 2) AS avg_sla_hours,
        ROUND(AVG(fuel_surcharge + remote_area_fee + cod_fee)::numeric, 2) AS avg_surcharges
      FROM finance_shipping_fees
      WHERE ${conditions.join(' AND ')}`,
      values
    );

    const statusBreakdown = await db.query(
      `SELECT status, COUNT(*)::int AS count
       FROM finance_shipping_fees
       WHERE ${conditions.join(' AND ')}
       GROUP BY status`,
      values
    );

    const riskBreakdown = await db.query(
      `SELECT risk_level, COUNT(*)::int AS count
       FROM finance_shipping_fees
       WHERE ${conditions.join(' AND ')}
       GROUP BY risk_level`,
      values
    );

    res.json({
      success: true,
      entity_id,
      metrics: result.rows[0],
      status_breakdown: statusBreakdown.rows,
      risk_breakdown: riskBreakdown.rows
    });
  } catch (error) {
    console.error('Error fetching shipping fees metrics:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/seed', async (req, res) => {
  try {
    const entity_id = resolveScopedEntityId(req, req.body?.entity_id);
    const seedData = [
      {
        fee_id: 'SHP-2001',
        fee_name: 'تعرفة المدن الرئيسية - قياسي',
        carrier: 'NaioShip',
        service_level: 'قياسي',
        zone: 'مركزي',
        weight_min: 0,
        weight_max: 5,
        base_fee: 22,
        per_kg_fee: 3.5,
        fuel_surcharge: 2,
        remote_area_fee: 0,
        cod_fee: 4,
        status: 'نشط',
        sla_hours: 24,
        max_orders: 180,
        risk_level: 'منخفض',
        effective_from: '2025-11-01',
        effective_to: null,
        owner_name: 'فريق التسعير'
      },
      {
        fee_id: 'SHP-2002',
        fee_name: 'تعرفة المناطق البعيدة - اقتصادي',
        carrier: 'FastGulf',
        service_level: 'اقتصادي',
        zone: 'بعيد',
        weight_min: 0,
        weight_max: 10,
        base_fee: 28,
        per_kg_fee: 4.2,
        fuel_surcharge: 4.5,
        remote_area_fee: 6,
        cod_fee: 5,
        status: 'قيد المراجعة',
        sla_hours: 72,
        max_orders: 90,
        risk_level: 'متوسط',
        effective_from: '2025-12-10',
        effective_to: null,
        owner_name: 'وحدة التشغيل'
      },
      {
        fee_id: 'SHP-2003',
        fee_name: 'تعرفة نفس اليوم - فائق',
        carrier: 'SkyDrop',
        service_level: 'فائق',
        zone: 'سريع',
        weight_min: 0,
        weight_max: 3,
        base_fee: 38,
        per_kg_fee: 6.5,
        fuel_surcharge: 3.5,
        remote_area_fee: 0,
        cod_fee: 6,
        status: 'نشط',
        sla_hours: 6,
        max_orders: 60,
        risk_level: 'متوسط',
        effective_from: '2025-10-15',
        effective_to: null,
        owner_name: 'مركز التحكم'
      },
      {
        fee_id: 'SHP-2004',
        fee_name: 'تعرفة دولية - الخليج',
        carrier: 'GCC Express',
        service_level: 'دولي',
        zone: 'خليجي',
        weight_min: 0,
        weight_max: 8,
        base_fee: 45,
        per_kg_fee: 7,
        fuel_surcharge: 6,
        remote_area_fee: 10,
        cod_fee: 0,
        status: 'معلق',
        sla_hours: 96,
        max_orders: 40,
        risk_level: 'مرتفع',
        effective_from: '2025-09-01',
        effective_to: '2026-01-31',
        owner_name: 'إدارة المخاطر'
      },
      {
        fee_id: 'SHP-2005',
        fee_name: 'تعرفة التجارة الإلكترونية - مرن',
        carrier: 'MetroX',
        service_level: 'مرن',
        zone: 'محلي',
        weight_min: 0,
        weight_max: 12,
        base_fee: 26,
        per_kg_fee: 3.8,
        fuel_surcharge: 2.8,
        remote_area_fee: 2,
        cod_fee: 4,
        status: 'نشط',
        sla_hours: 36,
        max_orders: 140,
        risk_level: 'منخفض',
        effective_from: '2025-08-01',
        effective_to: null,
        owner_name: 'فريق النمو'
      }
    ];

    const inserted = [];

    for (const row of seedData) {
      const result = await db.query(
        `INSERT INTO finance_shipping_fees (
          fee_id, fee_name, carrier, service_level, zone, weight_min, weight_max, base_fee, per_kg_fee,
          fuel_surcharge, remote_area_fee, cod_fee, status, sla_hours, max_orders, risk_level,
          effective_from, effective_to, owner_name, entity_id
        ) VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20
        )
        ON CONFLICT (fee_id) DO UPDATE SET
          fee_name = EXCLUDED.fee_name,
          carrier = EXCLUDED.carrier,
          service_level = EXCLUDED.service_level,
          zone = EXCLUDED.zone,
          weight_min = EXCLUDED.weight_min,
          weight_max = EXCLUDED.weight_max,
          base_fee = EXCLUDED.base_fee,
          per_kg_fee = EXCLUDED.per_kg_fee,
          fuel_surcharge = EXCLUDED.fuel_surcharge,
          remote_area_fee = EXCLUDED.remote_area_fee,
          cod_fee = EXCLUDED.cod_fee,
          status = EXCLUDED.status,
          sla_hours = EXCLUDED.sla_hours,
          max_orders = EXCLUDED.max_orders,
          risk_level = EXCLUDED.risk_level,
          effective_from = EXCLUDED.effective_from,
          effective_to = EXCLUDED.effective_to,
          owner_name = EXCLUDED.owner_name,
          entity_id = EXCLUDED.entity_id,
          updated_at = NOW()
        RETURNING *`,
        [
          row.fee_id,
          row.fee_name,
          row.carrier,
          row.service_level,
          row.zone,
          row.weight_min,
          row.weight_max,
          row.base_fee,
          row.per_kg_fee,
          row.fuel_surcharge,
          row.remote_area_fee,
          row.cod_fee,
          row.status,
          row.sla_hours,
          row.max_orders,
          row.risk_level,
          row.effective_from,
          row.effective_to,
          row.owner_name,
          entity_id
        ]
      );
      inserted.push(result.rows[0]);
    }

    res.json({ success: true, inserted_count: inserted.length, fees: inserted });
  } catch (error) {
    console.error('Error seeding shipping fees:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/:id/workflow', async (req, res) => {
  try {
    const { id } = req.params;
    const entityId = resolveScopedEntityId(req, req.query.entity_id);
    const result = await db.query(
      `SELECT w.*
       FROM finance_shipping_fee_workflows w
       JOIN finance_shipping_fees f ON f.fee_id = w.fee_id
       WHERE w.fee_id = $1 AND f.entity_id = $2
       ORDER BY created_at DESC, id DESC`,
      [id, entityId]
    );
    res.json({ success: true, workflow: result.rows });
  } catch (error) {
    console.error('Error fetching shipping workflow:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/:id/workflow', async (req, res) => {
  try {
    const { id } = req.params;
    const { step, status, actor, comment } = req.body || {};
    const entityId = resolveScopedEntityId(req, req.body?.entity_id || req.query.entity_id);

    if (!step || !status) {
      return res.status(400).json({ success: false, error: 'step and status are required' });
    }

    const feeCheck = await db.query(
      'SELECT fee_id FROM finance_shipping_fees WHERE fee_id = $1 AND entity_id = $2',
      [id, entityId]
    );
    if (!feeCheck.rows.length) {
      return res.status(404).json({ success: false, error: 'Shipping fee not found' });
    }

    const workflowResult = await db.query(
      `INSERT INTO finance_shipping_fee_workflows (fee_id, step, status, actor, comment)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [id, step, status, actor || 'system', comment || null]
    );

    const feeResult = await db.query(
      `UPDATE finance_shipping_fees
       SET status = $1, updated_at = NOW()
       WHERE fee_id = $2 AND entity_id = $3
       RETURNING *`,
      [status, id, entityId]
    );

    if (feeResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Shipping fee not found' });
    }

    res.json({
      success: true,
      workflow: workflowResult.rows[0],
      fee: feeResult.rows[0]
    });
  } catch (error) {
    console.error('Error updating shipping workflow:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const entityId = resolveScopedEntityId(req, req.query.entity_id);
    const result = await db.query(
      'SELECT * FROM finance_shipping_fees WHERE fee_id = $1 AND entity_id = $2',
      [id, entityId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Shipping fee not found' });
    }

    res.json({ success: true, fee: result.rows[0] });
  } catch (error) {
    console.error('Error fetching shipping fee:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const {
      fee_id,
      fee_name,
      carrier,
      service_level,
      zone,
      weight_min = 0,
      weight_max = 0,
      base_fee = 0,
      per_kg_fee = 0,
      fuel_surcharge = 0,
      remote_area_fee = 0,
      cod_fee = 0,
      currency = 'SAR',
      status = 'مسودة',
      sla_hours = 48,
      max_orders = 0,
      risk_level = 'منخفض',
      effective_from,
      effective_to = null,
      owner_name = null,
      notes = null,
      street_name = null,
      postal_code = null,
      building_number = null,
      city = null,
      district = null,
      national_address_number = null,
      short_address = null,
    } = req.body || {};
    const entity_id = resolveScopedEntityId(req, req.body?.entity_id);

    if (!fee_name || !carrier || !service_level || !zone || !effective_from) {
      return res.status(400).json({ success: false, error: 'fee_name, carrier, service_level, zone, and effective_from are required' });
    }

    const finalId = fee_id || await generateFeeId();

    const result = await db.query(
      `INSERT INTO finance_shipping_fees (
        fee_id, fee_name, carrier, service_level, zone, weight_min, weight_max, base_fee, per_kg_fee,
        fuel_surcharge, remote_area_fee, cod_fee, currency, status, sla_hours, max_orders, risk_level,
        effective_from, effective_to, owner_name, notes,
        street_name, postal_code, building_number, city, district, national_address_number, short_address,
        entity_id
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29
      ) RETURNING *`,
      [
        finalId,
        fee_name,
        carrier,
        service_level,
        zone,
        weight_min,
        weight_max,
        base_fee,
        per_kg_fee,
        fuel_surcharge,
        remote_area_fee,
        cod_fee,
        currency,
        status,
        sla_hours,
        max_orders,
        risk_level,
        effective_from,
        effective_to,
        owner_name,
        notes,
        street_name,
        postal_code,
        building_number,
        city,
        district,
        national_address_number,
        short_address,
        entity_id
      ]
    );

    res.json({ success: true, fee: result.rows[0] });
  } catch (error) {
    console.error('Error creating shipping fee:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const allowedFields = [
      'fee_name',
      'carrier',
      'service_level',
      'zone',
      'weight_min',
      'weight_max',
      'base_fee',
      'per_kg_fee',
      'fuel_surcharge',
      'remote_area_fee',
      'cod_fee',
      'currency',
      'status',
      'sla_hours',
      'max_orders',
      'risk_level',
      'effective_from',
      'effective_to',
      'owner_name',
      'notes',
      'street_name',
      'postal_code',
      'building_number',
      'city',
      'district',
      'national_address_number',
      'short_address'
    ];

    const updates = Object.entries(req.body)
      .filter(([key, value]) => allowedFields.includes(key) && value !== undefined);

    if (updates.length === 0) {
      return res.status(400).json({ success: false, error: 'No fields provided to update' });
    }

    const setClauses = updates.map(([key], idx) => `${key} = $${idx + 1}`);
    const values = updates.map(([, value]) => value);

    const result = await db.query(
      `UPDATE finance_shipping_fees
       SET ${setClauses.join(', ')}, updated_at = NOW()
       WHERE fee_id = $${values.length + 1} AND entity_id = $${values.length + 2}
       RETURNING *`,
      [...values, id, resolveScopedEntityId(req, req.body?.entity_id || req.query.entity_id)]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Shipping fee not found' });
    }

    res.json({ success: true, fee: result.rows[0] });
  } catch (error) {
    console.error('Error updating shipping fee:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const entityId = resolveScopedEntityId(req, req.query.entity_id || req.body?.entity_id);
    const result = await db.query(
      'DELETE FROM finance_shipping_fees WHERE fee_id = $1 AND entity_id = $2 RETURNING *',
      [id, entityId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Shipping fee not found' });
    }

    res.json({ success: true, deleted: result.rows[0] });
  } catch (error) {
    console.error('Error deleting shipping fee:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
