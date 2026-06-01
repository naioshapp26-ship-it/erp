const express = require('express');
const router = express.Router();
const db = require('../../db');

const ensureAmountAdjustmentsTable = async () => {
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS amount_adjustments (
        id TEXT PRIMARY KEY,
        request_date DATE NOT NULL,
        customer_name TEXT NOT NULL,
        customer_contact TEXT,
        branch_name TEXT NOT NULL,
        previous_product TEXT NOT NULL,
        replacement_product TEXT NOT NULL,
        adjustment_reason TEXT,
        price_difference NUMERIC(14, 2) NOT NULL DEFAULT 0,
        tax_rate NUMERIC(6, 4) NOT NULL DEFAULT 0.15,
        tax_amount NUMERIC(14, 2) NOT NULL DEFAULT 0,
        total_due NUMERIC(14, 2) NOT NULL DEFAULT 0,
        currency TEXT NOT NULL DEFAULT 'SAR',
        approval_status TEXT NOT NULL DEFAULT 'بانتظار الموافقة',
        workflow_stage TEXT NOT NULL DEFAULT 'فتح الطلب',
        status TEXT NOT NULL,
        collection_method TEXT,
        reference_no TEXT,
        collected_by TEXT,
        due_date DATE,
        notes TEXT,
        created_by TEXT,
        entity_id TEXT DEFAULT 'HQ001',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      ALTER TABLE amount_adjustments ADD COLUMN IF NOT EXISTS request_date DATE;
      ALTER TABLE amount_adjustments ADD COLUMN IF NOT EXISTS customer_name TEXT;
      ALTER TABLE amount_adjustments ADD COLUMN IF NOT EXISTS customer_contact TEXT;
      ALTER TABLE amount_adjustments ADD COLUMN IF NOT EXISTS branch_name TEXT;
      ALTER TABLE amount_adjustments ADD COLUMN IF NOT EXISTS adjustment_reason TEXT;
      ALTER TABLE amount_adjustments ADD COLUMN IF NOT EXISTS tax_rate NUMERIC(6, 4) NOT NULL DEFAULT 0.15;
      ALTER TABLE amount_adjustments ADD COLUMN IF NOT EXISTS tax_amount NUMERIC(14, 2) NOT NULL DEFAULT 0;
      ALTER TABLE amount_adjustments ADD COLUMN IF NOT EXISTS total_due NUMERIC(14, 2) NOT NULL DEFAULT 0;
      ALTER TABLE amount_adjustments ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'SAR';
      ALTER TABLE amount_adjustments ADD COLUMN IF NOT EXISTS approval_status TEXT NOT NULL DEFAULT 'بانتظار الموافقة';
      ALTER TABLE amount_adjustments ADD COLUMN IF NOT EXISTS workflow_stage TEXT NOT NULL DEFAULT 'فتح الطلب';
      ALTER TABLE amount_adjustments ADD COLUMN IF NOT EXISTS collection_method TEXT;
      ALTER TABLE amount_adjustments ADD COLUMN IF NOT EXISTS reference_no TEXT;
      ALTER TABLE amount_adjustments ADD COLUMN IF NOT EXISTS collected_by TEXT;
      ALTER TABLE amount_adjustments ADD COLUMN IF NOT EXISTS due_date DATE;
      ALTER TABLE amount_adjustments ADD COLUMN IF NOT EXISTS notes TEXT;
      ALTER TABLE amount_adjustments ADD COLUMN IF NOT EXISTS created_by TEXT;
      ALTER TABLE amount_adjustments ADD COLUMN IF NOT EXISTS entity_id TEXT DEFAULT 'HQ001';
      CREATE INDEX IF NOT EXISTS idx_amount_adjustments_status ON amount_adjustments(status);
      CREATE INDEX IF NOT EXISTS idx_amount_adjustments_branch ON amount_adjustments(branch_name);
      CREATE INDEX IF NOT EXISTS idx_amount_adjustments_date ON amount_adjustments(request_date);
      CREATE INDEX IF NOT EXISTS idx_amount_adjustments_approval ON amount_adjustments(approval_status);
    `);
    console.log('✅ amount_adjustments table ready');
  } catch (error) {
    console.error('❌ Failed to ensure amount_adjustments table:', error);
  }
};

const ensureAmountAdjustmentsLogsTable = async () => {
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS amount_adjustments_logs (
        id SERIAL PRIMARY KEY,
        adjustment_id TEXT REFERENCES amount_adjustments(id) ON DELETE CASCADE,
        action TEXT NOT NULL,
        actor TEXT,
        note TEXT,
        payload JSONB,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_amount_adjustments_logs_adjustment ON amount_adjustments_logs(adjustment_id);
      CREATE INDEX IF NOT EXISTS idx_amount_adjustments_logs_action ON amount_adjustments_logs(action);
    `);
    console.log('✅ amount_adjustments_logs table ready');
  } catch (error) {
    console.error('❌ Failed to ensure amount_adjustments_logs table:', error);
  }
};

const logAdjustmentAction = async ({ adjustmentId, action, actor, note, payload }) => {
  try {
    await db.query(
      `INSERT INTO amount_adjustments_logs (adjustment_id, action, actor, note, payload)
       VALUES ($1, $2, $3, $4, $5)`,
      [adjustmentId, action, actor || null, note || null, payload || null]
    );
  } catch (error) {
    console.error('❌ Failed to log amount adjustment action:', error);
  }
};

const generateAdjustmentId = async () => {
  const result = await db.query(
    `SELECT COALESCE(MAX(CAST(regexp_replace(id, '\\D', '', 'g') AS INTEGER)), 8800) AS max_id
     FROM amount_adjustments`
  );
  const nextId = (result.rows[0]?.max_id || 8800) + 1;
  return `UP-${nextId}`;
};

const calculateTotals = ({ price_difference = 0, tax_rate = 0.15 }) => {
  const price = Number(price_difference || 0);
  const rate = Number(tax_rate || 0);
  const tax_amount = Number((price * rate).toFixed(2));
  const total_due = Number((price + tax_amount).toFixed(2));
  return { tax_amount, total_due };
};

const seedAdjustments = async () => {
  try {
    const existing = await db.query('SELECT COUNT(*)::int AS count FROM amount_adjustments');
    if ((existing.rows[0]?.count || 0) > 0) return;

    await db.query(
      `INSERT INTO amount_adjustments
        (id, request_date, customer_name, customer_contact, branch_name, previous_product, replacement_product, adjustment_reason,
         price_difference, tax_rate, tax_amount, total_due, currency, approval_status, workflow_stage, status,
         collection_method, reference_no, collected_by, due_date, notes, created_by)
       VALUES
        ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22),
        ($23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33,$34,$35,$36,$37,$38,$39,$40,$41,$42,$43,$44),
        ($45,$46,$47,$48,$49,$50,$51,$52,$53,$54,$55,$56,$57,$58,$59,$60,$61,$62,$63,$64,$65,$66)` ,
      [
        'UP-8801', '2026-02-12', 'شركة المدار الذكية', '+966550001111', 'الرياض - المبيعات', 'خدمة أساسية', 'خدمة متقدمة', 'ترقية باقة الدعم',
        600, 0.15, 90, 690, 'SAR', 'موافق عليه', 'تحصيل الفارق', 'تم التحصيل', 'تحويل بنكي', 'BNK-3822', 'ندى الشمري', '2026-02-15', 'تم تحصيل الفارق عند الترقية', 'خدمة العملاء',
        'UP-8802', '2026-02-13', 'مؤسسة الحلول المتقدمة', '+966551112222', 'جدة - العملاء', 'باقة شهرية', 'باقة سنوية', 'استبدال خطة اشتراك',
        2400, 0.15, 360, 2760, 'SAR', 'بانتظار الموافقة', 'مراجعة مالية', 'قيد التحصيل', 'بطاقة ائتمان', 'POS-9911', 'سارة القحطاني', '2026-02-20', 'ينتظر اعتماد الإدارة المالية', 'خدمة العملاء',
        'UP-8803', '2026-02-14', 'شركة الريادة التجارية', '+966552223333', 'الدمام - الفروع', 'منتج قياسي', 'منتج مميز', 'طلب خاص للعميل',
        350, 0.15, 52.5, 402.5, 'SAR', 'بانتظار الموافقة', 'التقييم الفني', 'بانتظار الموافقة', 'تحويل بنكي', 'BNK-4431', 'محمد الدوسري', '2026-02-22', 'مراجعة فنية قبل التحصيل', 'الدعم الفني'
      ]
    );

    console.log('✅ amount_adjustments seeded');
  } catch (error) {
    console.error('❌ Failed to seed amount adjustments:', error);
  }
};

(async () => {
  await ensureAmountAdjustmentsTable();
  await ensureAmountAdjustmentsLogsTable();
  await seedAdjustments();
})();

router.get('/', async (req, res) => {
  try {
    const {
      status,
      approval_status,
      branch_name,
      date_from,
      date_to,
      q
    } = req.query;

    let query = 'SELECT * FROM amount_adjustments WHERE 1=1';
    const params = [];

    if (status) {
      params.push(status);
      query += ` AND status = $${params.length}`;
    }
    if (approval_status) {
      params.push(approval_status);
      query += ` AND approval_status = $${params.length}`;
    }
    if (branch_name) {
      params.push(branch_name);
      query += ` AND branch_name = $${params.length}`;
    }
    if (date_from) {
      params.push(date_from);
      query += ` AND request_date >= $${params.length}`;
    }
    if (date_to) {
      params.push(date_to);
      query += ` AND request_date <= $${params.length}`;
    }
    if (q) {
      params.push(`%${q}%`);
      query += ` AND (
        id ILIKE $${params.length} OR
        customer_name ILIKE $${params.length} OR
        previous_product ILIKE $${params.length} OR
        replacement_product ILIKE $${params.length} OR
        branch_name ILIKE $${params.length}
      )`;
    }

    query += ' ORDER BY request_date DESC, id DESC';

    const result = await db.query(query, params);
    res.json({ success: true, adjustments: result.rows });
  } catch (error) {
    console.error('Error fetching amount adjustments:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/metrics', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT
        COUNT(*)::int AS total_count,
        COUNT(*) FILTER (WHERE status = 'تم التحصيل')::int AS collected_count,
        COUNT(*) FILTER (WHERE approval_status = 'موافق عليه')::int AS approved_count,
        COUNT(*) FILTER (WHERE approval_status = 'بانتظار الموافقة')::int AS pending_count,
        ROUND(COALESCE(SUM(price_difference), 0)::numeric, 2) AS total_difference,
        ROUND(COALESCE(SUM(total_due), 0)::numeric, 2) AS total_due
      FROM amount_adjustments
    `);

    res.json({ success: true, metrics: result.rows[0] });
  } catch (error) {
    console.error('Error fetching amount adjustment metrics:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/logs', async (req, res) => {
  try {
    const result = await db.query(
      'SELECT * FROM amount_adjustments_logs ORDER BY created_at DESC, id DESC'
    );
    res.json({ success: true, logs: result.rows });
  } catch (error) {
    console.error('Error fetching amount adjustment logs:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const {
      id,
      request_date,
      customer_name,
      customer_contact,
      branch_name,
      previous_product,
      replacement_product,
      adjustment_reason,
      price_difference = 0,
      tax_rate = 0.15,
      currency = 'SAR',
      approval_status = 'بانتظار الموافقة',
      workflow_stage = 'فتح الطلب',
      status,
      collection_method,
      reference_no,
      collected_by,
      due_date,
      notes,
      created_by,
      entity_id,
      actor,
      note
    } = req.body;

    if (!request_date || !customer_name || !branch_name || !previous_product || !replacement_product || !status) {
      return res.status(400).json({ success: false, error: 'Missing required fields' });
    }

    const finalId = id || await generateAdjustmentId();
    const totals = calculateTotals({ price_difference, tax_rate });

    const result = await db.query(
      `INSERT INTO amount_adjustments
        (id, request_date, customer_name, customer_contact, branch_name, previous_product, replacement_product, adjustment_reason,
         price_difference, tax_rate, tax_amount, total_due, currency, approval_status, workflow_stage, status,
         collection_method, reference_no, collected_by, due_date, notes, created_by, entity_id)
       VALUES
        ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23)
       RETURNING *`,
      [
        finalId,
        request_date,
        customer_name,
        customer_contact || null,
        branch_name,
        previous_product,
        replacement_product,
        adjustment_reason || null,
        price_difference,
        tax_rate,
        totals.tax_amount,
        totals.total_due,
        currency,
        approval_status,
        workflow_stage,
        status,
        collection_method || null,
        reference_no || null,
        collected_by || null,
        due_date || null,
        notes || null,
        created_by || null,
        entity_id || 'HQ001'
      ]
    );

    await logAdjustmentAction({
      adjustmentId: finalId,
      action: 'إنشاء',
      actor,
      note,
      payload: result.rows[0]
    });

    res.json({ success: true, adjustment: result.rows[0] });
  } catch (error) {
    console.error('Error creating amount adjustment:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const allowedFields = [
      'request_date',
      'customer_name',
      'customer_contact',
      'branch_name',
      'previous_product',
      'replacement_product',
      'adjustment_reason',
      'price_difference',
      'tax_rate',
      'currency',
      'approval_status',
      'workflow_stage',
      'status',
      'collection_method',
      'reference_no',
      'collected_by',
      'due_date',
      'notes',
      'created_by',
      'entity_id'
    ];

    const updates = Object.entries(req.body)
      .filter(([key, value]) => allowedFields.includes(key) && value !== undefined);

    if (updates.length === 0) {
      return res.status(400).json({ success: false, error: 'No fields provided to update' });
    }

    const payload = Object.fromEntries(updates);
    const priceDifference = payload.price_difference ?? undefined;
    const taxRate = payload.tax_rate ?? undefined;
    const shouldRecalc = priceDifference !== undefined || taxRate !== undefined;
    if (shouldRecalc) {
      const current = await db.query(
        'SELECT price_difference, tax_rate FROM amount_adjustments WHERE id = $1',
        [id]
      );
      if (current.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Adjustment not found' });
      }
      const currentValues = current.rows[0];
      const totals = calculateTotals({
        price_difference: priceDifference ?? currentValues.price_difference,
        tax_rate: taxRate ?? currentValues.tax_rate
      });
      payload.tax_amount = totals.tax_amount;
      payload.total_due = totals.total_due;
    }

    const setClauses = Object.keys(payload).map((key, idx) => `${key} = $${idx + 1}`);
    const values = Object.values(payload);

    const result = await db.query(
      `UPDATE amount_adjustments
       SET ${setClauses.join(', ')}, updated_at = NOW()
       WHERE id = $${values.length + 1}
       RETURNING *`,
      [...values, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Adjustment not found' });
    }

    await logAdjustmentAction({
      adjustmentId: id,
      action: 'تعديل',
      actor: req.body.actor,
      note: req.body.note,
      payload: result.rows[0]
    });

    res.json({ success: true, adjustment: result.rows[0] });
  } catch (error) {
    console.error('Error updating amount adjustment:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.patch('/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status, actor, note } = req.body;

    if (!status) {
      return res.status(400).json({ success: false, error: 'Missing status value' });
    }

    const result = await db.query(
      `UPDATE amount_adjustments
       SET status = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [status, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Adjustment not found' });
    }

    await logAdjustmentAction({
      adjustmentId: id,
      action: 'تغيير حالة',
      actor,
      note,
      payload: result.rows[0]
    });

    res.json({ success: true, adjustment: result.rows[0] });
  } catch (error) {
    console.error('Error updating adjustment status:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.patch('/:id/approval', async (req, res) => {
  try {
    const { id } = req.params;
    const { approval_status, actor, note } = req.body;

    if (!approval_status) {
      return res.status(400).json({ success: false, error: 'Missing approval_status value' });
    }

    const result = await db.query(
      `UPDATE amount_adjustments
       SET approval_status = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [approval_status, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Adjustment not found' });
    }

    await logAdjustmentAction({
      adjustmentId: id,
      action: 'تحديث موافقة',
      actor,
      note,
      payload: result.rows[0]
    });

    res.json({ success: true, adjustment: result.rows[0] });
  } catch (error) {
    console.error('Error updating approval status:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.patch('/:id/workflow', async (req, res) => {
  try {
    const { id } = req.params;
    const { workflow_stage, actor, note } = req.body;

    if (!workflow_stage) {
      return res.status(400).json({ success: false, error: 'Missing workflow_stage value' });
    }

    const result = await db.query(
      `UPDATE amount_adjustments
       SET workflow_stage = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [workflow_stage, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Adjustment not found' });
    }

    await logAdjustmentAction({
      adjustmentId: id,
      action: 'تحديث سير العمل',
      actor,
      note,
      payload: result.rows[0]
    });

    res.json({ success: true, adjustment: result.rows[0] });
  } catch (error) {
    console.error('Error updating workflow stage:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query(
      'DELETE FROM amount_adjustments WHERE id = $1 RETURNING *',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Adjustment not found' });
    }

    await logAdjustmentAction({
      adjustmentId: id,
      action: 'حذف',
      actor: req.body.actor,
      note: req.body.note,
      payload: result.rows[0]
    });

    res.json({ success: true, adjustment: result.rows[0] });
  } catch (error) {
    console.error('Error deleting amount adjustment:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
