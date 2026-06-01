const express = require('express');
const router = express.Router();
const db = require('../../db');

const ensureReturnRequestsTable = async () => {
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS finance_return_requests (
        id TEXT PRIMARY KEY,
        order_id TEXT NOT NULL,
        customer TEXT NOT NULL,
        reason TEXT NOT NULL,
        condition TEXT NOT NULL,
        category TEXT NOT NULL,
        amount NUMERIC(14, 2) NOT NULL DEFAULT 0,
        fee_rate NUMERIC(6, 4) NOT NULL DEFAULT 0,
        status TEXT NOT NULL,
        risk TEXT NOT NULL,
        received DATE NOT NULL,
        channel TEXT NOT NULL,
        inspector TEXT NOT NULL,
        refund_type TEXT NOT NULL,
        sla_days INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_return_requests_status ON finance_return_requests(status);
      CREATE INDEX IF NOT EXISTS idx_return_requests_risk ON finance_return_requests(risk);
      CREATE INDEX IF NOT EXISTS idx_return_requests_received ON finance_return_requests(received);
    `);
    console.log('✅ finance_return_requests table ready');
  } catch (error) {
    console.error('❌ Failed to ensure finance_return_requests table:', error);
  }
};

ensureReturnRequestsTable();

const generateReturnId = async () => {
  const result = await db.query(
    `SELECT COALESCE(MAX(CAST(regexp_replace(id, '\\D', '', 'g') AS INTEGER)), 7800) AS max_id
     FROM finance_return_requests`
  );
  const nextId = (result.rows[0]?.max_id || 7800) + 1;
  return `RET-${nextId}`;
};

router.get('/', async (req, res) => {
  try {
    const { status, risk, q } = req.query;

    let query = 'SELECT * FROM finance_return_requests WHERE 1=1';
    const params = [];

    if (status) {
      params.push(status);
      query += ` AND status = $${params.length}`;
    }
    if (risk) {
      params.push(risk);
      query += ` AND risk = $${params.length}`;
    }
    if (q) {
      params.push(`%${q}%`);
      query += ` AND (id ILIKE $${params.length} OR order_id ILIKE $${params.length} OR customer ILIKE $${params.length} OR reason ILIKE $${params.length})`;
    }

    query += ' ORDER BY received DESC, id DESC';

    const result = await db.query(query, params);
    res.json({ success: true, requests: result.rows });
  } catch (error) {
    console.error('Error fetching return requests:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/metrics', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT
        COUNT(*)::int AS total_count,
        COUNT(*) FILTER (WHERE status = 'مقبول')::int AS approved_count,
        COUNT(*) FILTER (WHERE status = 'مرفوض')::int AS rejected_count,
        COUNT(*) FILTER (WHERE status = 'مفتوح' OR status = 'قيد المعالجة')::int AS active_count,
        ROUND(AVG(amount)::numeric, 2) AS avg_amount,
        ROUND(AVG(fee_rate * 100)::numeric, 2) AS avg_fee_rate
      FROM finance_return_requests
    `);

    res.json({ success: true, metrics: result.rows[0] });
  } catch (error) {
    console.error('Error fetching return metrics:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const {
      id,
      order_id,
      customer,
      reason,
      condition,
      category,
      amount = 0,
      fee_rate = 0,
      status,
      risk,
      received,
      channel,
      inspector,
      refund_type,
      sla_days = 0
    } = req.body;

    if (!order_id || !customer || !reason || !condition || !category || !status || !risk || !received || !channel || !inspector || !refund_type) {
      return res.status(400).json({ success: false, error: 'Missing required fields' });
    }

    const finalId = id || await generateReturnId();

    const result = await db.query(
      `INSERT INTO finance_return_requests
        (id, order_id, customer, reason, condition, category, amount, fee_rate, status, risk, received, channel, inspector, refund_type, sla_days)
       VALUES
        ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
       RETURNING *`,
      [
        finalId,
        order_id,
        customer,
        reason,
        condition,
        category,
        amount,
        fee_rate,
        status,
        risk,
        received,
        channel,
        inspector,
        refund_type,
        sla_days
      ]
    );

    res.json({ success: true, request: result.rows[0] });
  } catch (error) {
    console.error('Error creating return request:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const allowedFields = [
      'order_id', 'customer', 'reason', 'condition', 'category',
      'amount', 'fee_rate', 'status', 'risk', 'received',
      'channel', 'inspector', 'refund_type', 'sla_days'
    ];

    const updates = Object.entries(req.body)
      .filter(([key, value]) => allowedFields.includes(key) && value !== undefined);

    if (updates.length === 0) {
      return res.status(400).json({ success: false, error: 'No fields provided to update' });
    }

    const setClauses = updates.map(([key], idx) => `${key} = $${idx + 1}`);
    const values = updates.map(([, value]) => value);

    const result = await db.query(
      `UPDATE finance_return_requests
       SET ${setClauses.join(', ')}, updated_at = NOW()
       WHERE id = $${values.length + 1}
       RETURNING *`,
      [...values, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Return request not found' });
    }

    res.json({ success: true, request: result.rows[0] });
  } catch (error) {
    console.error('Error updating return request:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query(
      'DELETE FROM finance_return_requests WHERE id = $1 RETURNING *',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Return request not found' });
    }

    res.json({ success: true, request: result.rows[0] });
  } catch (error) {
    console.error('Error deleting return request:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
