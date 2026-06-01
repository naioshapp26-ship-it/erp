const express = require('express');
const router = express.Router();
const db = require('../../db');

const ensureExchangeRequestsTable = async () => {
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS exchange_requests (
        id TEXT PRIMARY KEY,
        request_date DATE NOT NULL,
        customer_name TEXT NOT NULL,
        branch_name TEXT NOT NULL,
        product_name TEXT NOT NULL,
        serial_number TEXT NOT NULL,
        exchange_type TEXT NOT NULL,
        reason TEXT NOT NULL,
        warranty_status TEXT NOT NULL,
        priority TEXT NOT NULL,
        technical_result TEXT NOT NULL,
        approval_status TEXT NOT NULL,
        exchange_cost NUMERIC(14, 2) NOT NULL DEFAULT 0,
        owner_name TEXT NOT NULL,
        delivery_date DATE,
        workflow_stage TEXT NOT NULL,
        created_by TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_exchange_requests_approval ON exchange_requests(approval_status);
      CREATE INDEX IF NOT EXISTS idx_exchange_requests_branch ON exchange_requests(branch_name);
      CREATE INDEX IF NOT EXISTS idx_exchange_requests_date ON exchange_requests(request_date);
    `);

    const legacyTable = await db.query("SELECT to_regclass('public.finance_exchange_requests') AS name");
    if (legacyTable.rows[0]?.name) {
      const existing = await db.query('SELECT COUNT(*)::int AS count FROM exchange_requests');
      if ((existing.rows[0]?.count || 0) === 0) {
        await db.query(`
          INSERT INTO exchange_requests (
            id, request_date, customer_name, branch_name, product_name, serial_number,
            exchange_type, reason, warranty_status, priority, technical_result,
            approval_status, exchange_cost, owner_name, delivery_date, workflow_stage,
            created_by, created_at, updated_at
          )
          SELECT
            id, request_date, customer_name, branch_name, product_name, serial_number,
            exchange_type, reason, warranty_status, priority, technical_result,
            approval_status, exchange_cost, owner_name, delivery_date, workflow_stage,
            created_by, created_at, updated_at
          FROM finance_exchange_requests
        `);
      }
    }

    console.log('✅ exchange_requests table ready');
  } catch (error) {
    console.error('❌ Failed to ensure exchange_requests table:', error);
  }
};

const ensureExchangeLogsTable = async () => {
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS exchange_logs (
        id SERIAL PRIMARY KEY,
        request_id TEXT REFERENCES exchange_requests(id) ON DELETE CASCADE,
        action TEXT NOT NULL,
        actor TEXT,
        note TEXT,
        payload JSONB,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_exchange_logs_request ON exchange_logs(request_id);
      CREATE INDEX IF NOT EXISTS idx_exchange_logs_action ON exchange_logs(action);
    `);
    console.log('✅ exchange_logs table ready');
  } catch (error) {
    console.error('❌ Failed to ensure exchange_logs table:', error);
  }
};

const logExchangeAction = async ({ requestId, action, actor, note, payload }) => {
  try {
    await db.query(
      `INSERT INTO exchange_logs (request_id, action, actor, note, payload)
       VALUES ($1, $2, $3, $4, $5)` ,
      [requestId, action, actor || null, note || null, payload || null]
    );
  } catch (error) {
    console.error('❌ Failed to log exchange action:', error);
  }
};

const seedExchangeRequests = async () => {
  try {
    const existing = await db.query('SELECT COUNT(*)::int AS count FROM exchange_requests');
    if ((existing.rows[0]?.count || 0) > 0) return;

    await db.query(
      `INSERT INTO exchange_requests
        (id, request_date, customer_name, branch_name, product_name, serial_number, exchange_type, reason, warranty_status, priority, technical_result, approval_status, exchange_cost, owner_name, delivery_date, workflow_stage, created_by)
       VALUES
        ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17),
        ($18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33,$34),
        ($35,$36,$37,$38,$39,$40,$41,$42,$43,$44,$45,$46,$47,$48,$49,$50,$51),
        ($52,$53,$54,$55,$56,$57,$58,$59,$60,$61,$62,$63,$64,$65,$66,$67,$68)`,
      [
        'EX-7001', '2026-02-02', 'شركة المدار الذكية', 'الرياض - الأجهزة', 'حاسب محمول X9', 'SN-9821-AX', 'استبدال كامل', 'عيب تصنيع', 'داخل الضمان', 'عالي', 'مشكلة في اللوحة الأم', 'قيد المراجعة', 1800, 'أحمد عبدالعزيز', '2026-02-12', 'الفحص الفني', 'خدمة العملاء',
        'EX-7002', '2026-02-05', 'مؤسسة الحلول المتقدمة', 'جدة - الصيانة', 'طابعة ليزر MX', 'SN-4410-MX', 'إصلاح', 'تلف أثناء الشحن', 'داخل الضمان', 'متوسط', 'استبدال وحدة التغذية', 'موافق عليه', 420, 'سارة الشمري', '2026-02-15', 'تحديث المخزون', 'خدمة العملاء',
        'EX-7003', '2026-02-07', 'شركة الريادة التجارية', 'الدمام - المبيعات', 'جهاز نقاط بيع Pro', 'POS-3391-PR', 'استرجاع مبلغ', 'عدم مطابقة المواصفات', 'خارج الضمان', 'عاجل', 'مطابقة غير مكتملة للمواصفات', 'قيد المراجعة', 920, 'هبة القحطاني', '2026-02-18', 'اتخاذ قرار الموافقة', 'خدمة العملاء',
        'EX-7004', '2026-02-09', 'مستشفى النخبة', 'المدينة - الدعم', 'سيرفر Edge 4U', 'SRV-7719-ED', 'استبدال جزئي', 'فشل إصلاح سابق', 'خارج الضمان', 'عالي', 'استبدال وحدات تبريد', 'موافق عليه', 3200, 'محمد الدوسري', '2026-02-20', 'تسليم البديل', 'الدعم الفني'
      ]
    );
    console.log('✅ exchange_requests seeded');
  } catch (error) {
    console.error('❌ Failed to seed exchange requests:', error);
  }
};

(async () => {
  await ensureExchangeRequestsTable();
  await ensureExchangeLogsTable();
  await seedExchangeRequests();
})();

const generateExchangeId = async () => {
  const result = await db.query(
    `SELECT COALESCE(MAX(CAST(regexp_replace(id, '\\D', '', 'g') AS INTEGER)), 7000) AS max_id
      FROM exchange_requests`
  );
  const nextId = (result.rows[0]?.max_id || 7000) + 1;
  return `EX-${nextId}`;
};

router.get('/', async (req, res) => {
  try {
    const {
      approval_status,
      branch_name,
      exchange_type,
      priority,
      warranty_status,
      q,
      date_from,
      date_to
    } = req.query;

    let query = 'SELECT * FROM exchange_requests WHERE 1=1';
    const params = [];

    if (approval_status) {
      params.push(approval_status);
      query += ` AND approval_status = $${params.length}`;
    }
    if (branch_name) {
      params.push(branch_name);
      query += ` AND branch_name = $${params.length}`;
    }
    if (exchange_type) {
      params.push(exchange_type);
      query += ` AND exchange_type = $${params.length}`;
    }
    if (priority) {
      params.push(priority);
      query += ` AND priority = $${params.length}`;
    }
    if (warranty_status) {
      params.push(warranty_status);
      query += ` AND warranty_status = $${params.length}`;
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
        product_name ILIKE $${params.length} OR
        owner_name ILIKE $${params.length} OR
        serial_number ILIKE $${params.length}
      )`;
    }

    query += ' ORDER BY request_date DESC, id DESC';

    const result = await db.query(query, params);
    res.json({ success: true, requests: result.rows });
  } catch (error) {
    console.error('Error fetching exchange requests:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/metrics', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT
        COUNT(*)::int AS total_count,
        COUNT(*) FILTER (WHERE approval_status = 'موافق عليه')::int AS approved_count,
        COUNT(*) FILTER (WHERE approval_status = 'مرفوض')::int AS rejected_count,
        COUNT(*) FILTER (WHERE approval_status NOT IN ('موافق عليه', 'مرفوض'))::int AS pending_count,
        ROUND(AVG(exchange_cost)::numeric, 2) AS avg_cost
      FROM exchange_requests
    `);

    res.json({ success: true, metrics: result.rows[0] });
  } catch (error) {
    console.error('Error fetching exchange request metrics:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const {
      id,
      request_date,
      customer_name,
      branch_name,
      product_name,
      serial_number,
      exchange_type,
      reason,
      warranty_status,
      priority,
      technical_result,
      approval_status,
      exchange_cost = 0,
      owner_name,
      delivery_date,
      workflow_stage,
      created_by
    } = req.body;

    if (!request_date || !customer_name || !branch_name || !product_name || !serial_number || !exchange_type || !reason || !warranty_status || !priority || !technical_result || !approval_status || !owner_name || !workflow_stage || !created_by) {
      return res.status(400).json({ success: false, error: 'Missing required fields' });
    }

    const finalId = id || await generateExchangeId();

    const result = await db.query(
      `INSERT INTO exchange_requests
        (id, request_date, customer_name, branch_name, product_name, serial_number, exchange_type, reason, warranty_status, priority, technical_result, approval_status, exchange_cost, owner_name, delivery_date, workflow_stage, created_by)
       VALUES
        ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
       RETURNING *`,
      [
        finalId,
        request_date,
        customer_name,
        branch_name,
        product_name,
        serial_number,
        exchange_type,
        reason,
        warranty_status,
        priority,
        technical_result,
        approval_status,
        exchange_cost,
        owner_name,
        delivery_date || null,
        workflow_stage,
        created_by
      ]
    );

    await logExchangeAction({
      requestId: result.rows[0].id,
      action: 'create',
      actor: created_by,
      payload: result.rows[0]
    });

    res.json({ success: true, request: result.rows[0] });
  } catch (error) {
    console.error('Error creating exchange request:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const allowedFields = [
      'request_date', 'customer_name', 'branch_name', 'product_name', 'serial_number',
      'exchange_type', 'reason', 'warranty_status', 'priority', 'technical_result',
      'approval_status', 'exchange_cost', 'owner_name', 'delivery_date', 'workflow_stage',
      'created_by'
    ];

    const updates = Object.entries(req.body)
      .filter(([key, value]) => allowedFields.includes(key) && value !== undefined);

    if (updates.length === 0) {
      return res.status(400).json({ success: false, error: 'No fields provided to update' });
    }

    const setClauses = updates.map(([key], idx) => `${key} = $${idx + 1}`);
    const values = updates.map(([, value]) => value);

    const result = await db.query(
      `UPDATE exchange_requests
       SET ${setClauses.join(', ')}, updated_at = NOW()
       WHERE id = $${values.length + 1}
       RETURNING *`,
      [...values, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Exchange request not found' });
    }

    await logExchangeAction({
      requestId: result.rows[0].id,
      action: 'update',
      actor: req.body.created_by,
      payload: req.body
    });

    res.json({ success: true, request: result.rows[0] });
  } catch (error) {
    console.error('Error updating exchange request:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query(
      'DELETE FROM exchange_requests WHERE id = $1 RETURNING *',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Exchange request not found' });
    }

    await logExchangeAction({
      requestId: id,
      action: 'delete',
      payload: result.rows[0]
    });

    res.json({ success: true, request: result.rows[0] });
  } catch (error) {
    console.error('Error deleting exchange request:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.patch('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { approval_status, workflow_stage, note, actor } = req.body;

    const updates = [];
    const values = [];

    if (approval_status !== undefined) {
      values.push(approval_status);
      updates.push(`approval_status = $${values.length}`);
    }

    if (workflow_stage !== undefined) {
      values.push(workflow_stage);
      updates.push(`workflow_stage = $${values.length}`);
    }

    if (updates.length === 0) {
      return res.status(400).json({ success: false, error: 'No fields provided to patch' });
    }

    values.push(id);
    const result = await db.query(
      `UPDATE exchange_requests
       SET ${updates.join(', ')}, updated_at = NOW()
       WHERE id = $${values.length}
       RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Exchange request not found' });
    }

    const action = approval_status !== undefined && workflow_stage !== undefined
      ? 'status_stage_change'
      : approval_status !== undefined
        ? 'status_change'
        : 'stage_change';

    await logExchangeAction({
      requestId: id,
      action,
      actor,
      note,
      payload: { approval_status, workflow_stage }
    });

    res.json({ success: true, request: result.rows[0] });
  } catch (error) {
    console.error('Error patching exchange request:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
