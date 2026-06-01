const express = require('express');
const router = express.Router();
const db = require('../../db');
const { getRequestEntityContext } = require('../../entity-context');

const MODULE_PREFIX = {
  settlements: 'SET',
  tracking: 'TRK',
  arrears: 'ARR',
  analytics: 'ANL',
  reminders: 'REM',
  'smart-invoices': 'INV',
  'collection-rules': 'COL'
};

const resolveScopedEntityId = (req, explicitEntityId = null) => {
  const context = getRequestEntityContext(req);
  if (context.type !== 'HQ') {
    return context.id;
  }
  return explicitEntityId || req.headers['x-entity-id'] || context.id;
};

const STATUS_VALUES = ['مدفوع', 'متأخر', 'قيد التحصيل', 'قيد المراجعة', 'معلق', 'مغلق'];

const ensurePaymentSystemTable = async () => {
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS finance_payment_system_records (
        id SERIAL PRIMARY KEY,
        record_number TEXT UNIQUE NOT NULL,
        module_type TEXT NOT NULL,
        record_date DATE NOT NULL,
        customer_name TEXT NOT NULL,
        amount NUMERIC(14, 2) NOT NULL DEFAULT 0,
        status TEXT NOT NULL,
        owner_employee TEXT NOT NULL,
        notes TEXT,
        entity_id TEXT DEFAULT 'HQ001',
        entity_type TEXT DEFAULT 'HQ',
        created_by TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_payment_system_entity ON finance_payment_system_records(entity_id);
      CREATE INDEX IF NOT EXISTS idx_payment_system_module ON finance_payment_system_records(module_type);
      CREATE INDEX IF NOT EXISTS idx_payment_system_status ON finance_payment_system_records(status);
      CREATE INDEX IF NOT EXISTS idx_payment_system_date ON finance_payment_system_records(record_date);
    `);

    const { rows } = await db.query('SELECT COUNT(*)::int AS count FROM finance_payment_system_records');
    if (rows[0].count === 0) {
      const today = new Date();
      const makeDate = (daysAgo) => new Date(today.getTime() - daysAgo * 86400000).toISOString().slice(0, 10);

      const seedData = [
        { record_number: 'SET-2026-0001', module_type: 'settlements', record_date: makeDate(2), customer_name: 'شركة المدار المتقدمة', amount: 54000, status: 'مدفوع', owner_employee: 'وليد القحطاني', notes: 'تسوية عقد الخدمات السنوي' },
        { record_number: 'SET-2026-0002', module_type: 'settlements', record_date: makeDate(9), customer_name: 'مجموعة الرؤية', amount: 32000, status: 'قيد المراجعة', owner_employee: 'سارة العتيبي', notes: 'مراجعة خصم التسوية' },
        { record_number: 'SET-2026-0003', module_type: 'settlements', record_date: makeDate(18), customer_name: 'منصة أبجد', amount: 87000, status: 'متأخر', owner_employee: 'حسن الغامدي', notes: 'تأخر في سداد المرحلة الأخيرة' },
        { record_number: 'TRK-2026-0004', module_type: 'tracking', record_date: makeDate(1), customer_name: 'شركة أوتار', amount: 15000, status: 'مدفوع', owner_employee: 'نور الشريف', notes: 'متابعة الدفعة الرابعة' },
        { record_number: 'TRK-2026-0005', module_type: 'tracking', record_date: makeDate(6), customer_name: 'بيت التقنية', amount: 26500, status: 'قيد التحصيل', owner_employee: 'ريم العتيبي', notes: 'اتصال تحصيلي أول' },
        { record_number: 'TRK-2026-0006', module_type: 'tracking', record_date: makeDate(11), customer_name: 'مسرعة القمة', amount: 48500, status: 'معلق', owner_employee: 'أنس المطيري', notes: 'انتظار تأكيد التحويل البنكي' },
        { record_number: 'ARR-2026-0007', module_type: 'arrears', record_date: makeDate(23), customer_name: 'مجموعة المدار الصناعي', amount: 64000, status: 'متأخر', owner_employee: 'ليان الحربي', notes: 'إعادة جدولة المتأخرات' },
        { record_number: 'ARR-2026-0008', module_type: 'arrears', record_date: makeDate(16), customer_name: 'شركة أساس المستقبل', amount: 120000, status: 'قيد التحصيل', owner_employee: 'مازن الشهري', notes: 'زيارة ميدانية للتحصيل' },
        { record_number: 'ARR-2026-0009', module_type: 'arrears', record_date: makeDate(30), customer_name: 'شركة نبض الخليج', amount: 78000, status: 'متأخر', owner_employee: 'منى الشهري', notes: 'تحويل الملف للفريق القانوني' },
        { record_number: 'ANL-2026-0010', module_type: 'analytics', record_date: makeDate(3), customer_name: 'بيتك للاستثمار', amount: 23000, status: 'مدفوع', owner_employee: 'هلا الزهراني', notes: 'تحليل أداء شهر فبراير' },
        { record_number: 'ANL-2026-0011', module_type: 'analytics', record_date: makeDate(14), customer_name: 'شركة الأفق', amount: 31000, status: 'قيد المراجعة', owner_employee: 'محمد الحربي', notes: 'مراجعة مؤشرات التحصيل' },
        { record_number: 'ANL-2026-0012', module_type: 'analytics', record_date: makeDate(20), customer_name: 'شركة توازن', amount: 19500, status: 'مدفوع', owner_employee: 'إيمان النجار', notes: 'تحديث لوحات القياس' },
        { record_number: 'REM-2026-0013', module_type: 'reminders', record_date: makeDate(4), customer_name: 'شركة مسار', amount: 8700, status: 'قيد التحصيل', owner_employee: 'راشد العنزي', notes: 'إرسال تذكير عبر البريد' },
        { record_number: 'REM-2026-0014', module_type: 'reminders', record_date: makeDate(12), customer_name: 'المجموعة الرقمية', amount: 14200, status: 'متأخر', owner_employee: 'فيصل الدوسري', notes: 'إرسال تذكير واتساب' },
        { record_number: 'REM-2026-0015', module_type: 'reminders', record_date: makeDate(25), customer_name: 'شركة المشرق', amount: 22500, status: 'مدفوع', owner_employee: 'نورة الشمري', notes: 'تم التحصيل بعد التذكير' },
        { record_number: 'INV-2026-0016', module_type: 'smart-invoices', record_date: makeDate(5), customer_name: 'مؤسسة المدار', amount: 9100, status: 'قيد المراجعة', owner_employee: 'جود الماجد', notes: 'توليد فاتورة ذكية مع خصم' },
        { record_number: 'INV-2026-0017', module_type: 'smart-invoices', record_date: makeDate(15), customer_name: 'شركة شموخ', amount: 43000, status: 'مدفوع', owner_employee: 'أحمد السالم', notes: 'فاتورة ذكية عبر بوابة الدفع' },
        { record_number: 'INV-2026-0018', module_type: 'smart-invoices', record_date: makeDate(21), customer_name: 'مجموعة أركان', amount: 67000, status: 'متأخر', owner_employee: 'تركي القحطاني', notes: 'تنبيه تلقائي للتأخر' },
        { record_number: 'COL-2026-0019', module_type: 'collection-rules', record_date: makeDate(7), customer_name: 'شركة القمم', amount: 15500, status: 'قيد التحصيل', owner_employee: 'سلمان العبدالله', notes: 'تطبيق قاعدة تحصيل جديدة' },
        { record_number: 'COL-2026-0020', module_type: 'collection-rules', record_date: makeDate(19), customer_name: 'شركة ريادة', amount: 36500, status: 'مدفوع', owner_employee: 'دلال السبيعي', notes: 'تفعيل قاعدة تحصيل مرنة' },
        { record_number: 'COL-2026-0021', module_type: 'collection-rules', record_date: makeDate(28), customer_name: 'شركة طموح', amount: 51000, status: 'متأخر', owner_employee: 'صالح الحربي', notes: 'تصعيد آلي بعد التأخر' }
      ];

      for (const item of seedData) {
        await db.query(
          `INSERT INTO finance_payment_system_records
            (record_number, module_type, record_date, customer_name, amount, status, owner_employee, notes)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
          [
            item.record_number,
            item.module_type,
            item.record_date,
            item.customer_name,
            item.amount,
            item.status,
            item.owner_employee,
            item.notes
          ]
        );
      }
    }

    console.log('✅ finance_payment_system_records table ready');
  } catch (error) {
    console.error('❌ Failed to ensure finance_payment_system_records table:', error);
  }
};

ensurePaymentSystemTable();

const generateRecordNumber = async (moduleType) => {
  const prefix = MODULE_PREFIX[moduleType] || 'PAY';
  const year = new Date().getFullYear();
  const likePattern = `${prefix}-${year}-%`;
  const result = await db.query(
    'SELECT record_number FROM finance_payment_system_records WHERE record_number LIKE $1 ORDER BY id DESC LIMIT 1',
    [likePattern]
  );

  const lastNumber = result.rows[0]?.record_number || `${prefix}-${year}-0000`;
  const numericMatch = lastNumber.match(/(\d+)$/);
  const nextNumber = numericMatch ? parseInt(numericMatch[1], 10) + 1 : 1;
  const padded = String(nextNumber).padStart(4, '0');
  return `${prefix}-${year}-${padded}`;
};

router.get('/records', async (req, res) => {
  try {
    const { module_type, status, owner, q, from, to, limit, offset } = req.query;
    const entity_id = resolveScopedEntityId(req, req.query.entity_id);

    let query = 'SELECT * FROM finance_payment_system_records WHERE entity_id = $1';
    const params = [entity_id];

    if (module_type) {
      params.push(module_type);
      query += ` AND module_type = $${params.length}`;
    }
    if (status) {
      params.push(status);
      query += ` AND status = $${params.length}`;
    }
    if (owner) {
      params.push(owner);
      query += ` AND owner_employee = $${params.length}`;
    }
    if (from) {
      params.push(from);
      query += ` AND record_date >= $${params.length}`;
    }
    if (to) {
      params.push(to);
      query += ` AND record_date <= $${params.length}`;
    }
    if (q) {
      params.push(`%${q}%`);
      query += ` AND (record_number ILIKE $${params.length} OR customer_name ILIKE $${params.length} OR notes ILIKE $${params.length} OR owner_employee ILIKE $${params.length})`;
    }

    query += ' ORDER BY record_date DESC, id DESC';

    const limitValue = Math.min(parseInt(limit || '0', 10) || 0, 200);
    const offsetValue = Math.max(parseInt(offset || '0', 10) || 0, 0);

    if (limitValue > 0) {
      params.push(limitValue);
      query += ` LIMIT $${params.length}`;
    }
    if (offsetValue > 0) {
      params.push(offsetValue);
      query += ` OFFSET $${params.length}`;
    }

    const result = await db.query(query, params);
    res.json({ success: true, records: result.rows });
  } catch (error) {
    console.error('Error fetching payment system records:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/summary', async (req, res) => {
  try {
    const entity_id = resolveScopedEntityId(req, req.query.entity_id);
    const result = await db.query(
      `SELECT
        COUNT(*)::int AS total_count,
        COALESCE(SUM(amount) FILTER (WHERE status = 'مدفوع'), 0) AS total_paid,
        COALESCE(SUM(amount) FILTER (WHERE status = 'متأخر'), 0) AS total_overdue,
        COALESCE(SUM(amount) FILTER (WHERE status = 'مدفوع' AND record_date >= date_trunc('month', NOW())::date), 0) AS paid_this_month,
        COUNT(*) FILTER (WHERE status IN ('متأخر', 'قيد التحصيل', 'قيد المراجعة', 'معلق'))::int AS unpaid_count
      FROM finance_payment_system_records
      WHERE entity_id = $1`,
      [entity_id]
    );

    res.json({ success: true, summary: result.rows[0] });
  } catch (error) {
    console.error('Error fetching payment system summary:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/charts', async (req, res) => {
  try {
    const entity_id = resolveScopedEntityId(req, req.query.entity_id);

    const monthly = await db.query(
      `SELECT
        to_char(date_trunc('month', record_date), 'YYYY-MM') AS month,
        COALESCE(SUM(amount) FILTER (WHERE status = 'مدفوع'), 0) AS paid
      FROM finance_payment_system_records
      WHERE entity_id = $1
        AND record_date >= (date_trunc('month', NOW()) - INTERVAL '5 months')
      GROUP BY 1
      ORDER BY 1`,
      [entity_id]
    );

    const arrears = await db.query(
      `SELECT
        customer_name,
        COALESCE(SUM(amount), 0) AS total
      FROM finance_payment_system_records
      WHERE entity_id = $1 AND status = 'متأخر'
      GROUP BY customer_name
      ORDER BY total DESC
      LIMIT 6`,
      [entity_id]
    );

    const ratio = await db.query(
      `SELECT
        COALESCE(SUM(amount) FILTER (WHERE status = 'مدفوع'), 0) AS paid,
        COALESCE(SUM(amount) FILTER (WHERE status <> 'مدفوع'), 0) AS outstanding
      FROM finance_payment_system_records
      WHERE entity_id = $1`,
      [entity_id]
    );

    res.json({
      success: true,
      charts: {
        monthly: monthly.rows,
        arrears: arrears.rows,
        ratio: ratio.rows[0] || { paid: 0, outstanding: 0 }
      }
    });
  } catch (error) {
    console.error('Error fetching payment system charts:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/records', async (req, res) => {
  try {
    const {
      record_number,
      module_type,
      record_date,
      customer_name,
      amount,
      status,
      owner_employee,
      notes,
    } = req.body;
    const entity_id = resolveScopedEntityId(req, req.body.entity_id);
    const entity_type = getRequestEntityContext(req).type;

    if (!module_type || !record_date || !customer_name || amount === undefined || !status || !owner_employee) {
      return res.status(400).json({ success: false, error: 'Missing required fields' });
    }

    const finalNumber = record_number || await generateRecordNumber(module_type);

    const result = await db.query(
      `INSERT INTO finance_payment_system_records
        (record_number, module_type, record_date, customer_name, amount, status, owner_employee, notes, entity_id, entity_type, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       RETURNING *`,
      [
        finalNumber,
        module_type,
        record_date,
        customer_name,
        amount,
        status,
        owner_employee,
        notes || null,
        entity_id,
        entity_type,
        req.headers['x-user-id'] || 'system'
      ]
    );

    res.status(201).json({ success: true, record: result.rows[0] });
  } catch (error) {
    console.error('Error creating payment system record:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.put('/records/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const allowedFields = [
      'record_number',
      'module_type',
      'record_date',
      'customer_name',
      'amount',
      'status',
      'owner_employee',
      'notes'
    ];

    const updates = Object.entries(req.body)
      .filter(([key, value]) => allowedFields.includes(key) && value !== undefined);

    if (updates.length === 0) {
      return res.status(400).json({ success: false, error: 'No fields provided to update' });
    }

    const setClauses = updates.map(([key], idx) => `${key} = $${idx + 1}`);
    const values = updates.map(([, value]) => value);

    const result = await db.query(
      `UPDATE finance_payment_system_records
       SET ${setClauses.join(', ')}, updated_at = NOW()
       WHERE id = $${values.length + 1} AND entity_id = $${values.length + 2}
       RETURNING *`,
      [...values, id, resolveScopedEntityId(req, req.body.entity_id || req.query.entity_id)]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Record not found' });
    }

    res.json({ success: true, record: result.rows[0] });
  } catch (error) {
    console.error('Error updating payment system record:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.delete('/records/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const entityId = resolveScopedEntityId(req, req.query.entity_id || req.body?.entity_id);
    const result = await db.query(
      'DELETE FROM finance_payment_system_records WHERE id = $1 AND entity_id = $2 RETURNING *',
      [id, entityId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Record not found' });
    }

    res.json({ success: true, record: result.rows[0] });
  } catch (error) {
    console.error('Error deleting payment system record:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/meta', (req, res) => {
  res.json({
    success: true,
    meta: {
      status_values: STATUS_VALUES,
      module_prefix: MODULE_PREFIX
    }
  });
});

module.exports = router;
