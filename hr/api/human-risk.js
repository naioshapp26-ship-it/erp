const express = require('express');
const router = express.Router();
const db = require('../../db');
const { getRequestEntityContext } = require('../../entity-context');

const ensureHumanRiskTable = async () => {
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS hr_human_risks (
        id SERIAL PRIMARY KEY,
        subject_name TEXT NOT NULL,
        risk_type TEXT NOT NULL,
        risk_level TEXT NOT NULL,
        risk_reason TEXT NOT NULL,
        proposed_action TEXT NOT NULL,
        owner_name TEXT NOT NULL,
        review_date DATE NOT NULL,
        follow_status TEXT NOT NULL,
        entity_id TEXT DEFAULT 'HQ001',
        entity_type TEXT DEFAULT 'HQ',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_hr_human_risks_entity ON hr_human_risks(entity_id);
      CREATE INDEX IF NOT EXISTS idx_hr_human_risks_level ON hr_human_risks(risk_level);
      CREATE INDEX IF NOT EXISTS idx_hr_human_risks_status ON hr_human_risks(follow_status);
      CREATE INDEX IF NOT EXISTS idx_hr_human_risks_review ON hr_human_risks(review_date);
    `);

    const seedCheck = await db.query(
      "SELECT COUNT(*)::int AS count FROM hr_human_risks WHERE entity_id = 'HQ001'"
    );

    if ((seedCheck.rows[0]?.count || 0) === 0) {
      await db.query(
        `INSERT INTO hr_human_risks
          (subject_name, risk_type, risk_level, risk_reason, proposed_action, owner_name, review_date, follow_status, entity_id, entity_type)
         VALUES
          ('قسم الدعم الفني', 'ضغط عمل', 'مرتفع', 'تراكم 28 طلبا عالي الاولوية خلال 10 ايام', 'اضافة مناوبة مسائية وتوزيع الطلبات الحرجة', 'رئيس قسم الدعم', '2026-03-12', 'قيد المتابعة', 'HQ001', 'HQ'),
          ('سارة عبد الرحمن', 'غياب', 'متوسط', '6 ايام غياب غير مخطط خلال شهر', 'مراجعة خطة الدوام المرن وتحديد سبب الغياب', 'مدير الموارد البشرية', '2026-03-10', 'قيد المتابعة', 'HQ001', 'HQ'),
          ('فريق المبيعات', 'أداء', 'متوسط', 'تراجع مؤشر اغلاق الصفقات بنسبة 18%', 'جلسات تدريب مركزة ومراجعة الحوافز', 'مدير المبيعات', '2026-03-15', 'قيد المتابعة', 'HQ001', 'HQ'),
          ('يوسف العتيبي', 'استقالة محتملة', 'مرتفع', 'تراجع المشاركة وطلب نقل داخلي', 'لقاء فردي وخطة مسار وظيفي واضحة', 'مدير العمليات', '2026-03-08', 'قيد المتابعة', 'HQ001', 'HQ'),
          ('قسم الموارد البشرية', 'نزاع وظيفي', 'منخفض', 'خلاف محدود حول توزيع المهام', 'جلسة توضيح الادوار وتوثيق الاجراءات', 'شريك الاعمال للموارد البشرية', '2026-03-18', 'مفتوح', 'HQ001', 'HQ'),
          ('ريم ناصر', 'ضغط عمل', 'متوسط', 'زيادة مهام الادارة المالية في اغلاق نهاية الشهر', 'اعادة جدولة تسليم التقارير وتفويض جزئي', 'مدير المالية', '2026-03-14', 'قيد المتابعة', 'HQ001', 'HQ'),
          ('قسم تجربة العملاء', 'أداء', 'مرتفع', 'انخفاض تقييمات الرضا الى 72%', 'تفعيل فريق دعم سريع وتحديث نصوص التواصل', 'مدير تجربة العملاء', '2026-03-11', 'قيد المتابعة', 'HQ001', 'HQ'),
          ('محمد سالم', 'غياب', 'منخفض', 'غياب يومين بدون اشعار مع توضيح لاحق', 'تنبيه كتابي ومراجعة سياسة الاشعارات', 'مدير الموارد البشرية', '2026-03-20', 'مغلق', 'HQ001', 'HQ')
        `
      );
    }

    console.log('✅ hr human risks table ready');
  } catch (error) {
    console.error('❌ Failed to ensure hr human risks table:', error);
  }
};

ensureHumanRiskTable();

const getEntityFilter = (userEntity) => {
  if (!userEntity || userEntity.type === 'HQ') return '1=1';
  return 'entity_id = $1';
};

const buildOrderBy = (sortKey) => {
  switch (sortKey) {
    case 'date_asc':
      return 'review_date ASC, id ASC';
    case 'risk_desc':
      return "CASE risk_level WHEN 'مرتفع' THEN 3 WHEN 'متوسط' THEN 2 WHEN 'منخفض' THEN 1 ELSE 0 END DESC, review_date DESC";
    case 'risk_asc':
      return "CASE risk_level WHEN 'مرتفع' THEN 3 WHEN 'متوسط' THEN 2 WHEN 'منخفض' THEN 1 ELSE 0 END ASC, review_date DESC";
    case 'date_desc':
    default:
      return 'review_date DESC, id DESC';
  }
};

router.get('/', async (req, res) => {
  try {
    const { q, risk_level, sort = 'date_desc' } = req.query || {};
    const userEntity = getRequestEntityContext(req);

    const values = [];
    const conditions = [];

    if (userEntity.type !== 'HQ') {
      values.push(userEntity.id);
      conditions.push(getEntityFilter(userEntity));
    }

    if (risk_level) {
      values.push(risk_level);
      conditions.push(`risk_level = $${values.length}`);
    }

    if (q) {
      values.push(`%${q}%`);
      conditions.push(`subject_name ILIKE $${values.length}`);
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const orderBy = buildOrderBy(sort);

    const result = await db.query(
      `SELECT * FROM hr_human_risks
       ${whereClause}
       ORDER BY ${orderBy}`,
      values
    );

    res.json({ success: true, records: result.rows || [] });
  } catch (error) {
    console.error('Error fetching human risks:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const userEntity = getRequestEntityContext(req);
    const values = [id];
    let query = 'SELECT * FROM hr_human_risks WHERE id = $1';
    if (userEntity.type !== 'HQ') {
      values.push(userEntity.id);
      query += ` AND entity_id = $${values.length}`;
    }
    const result = await db.query(query, values);

    if (!result.rows.length) {
      return res.status(404).json({ success: false, error: 'Record not found' });
    }

    res.json({ success: true, record: result.rows[0] });
  } catch (error) {
    console.error('Error fetching human risk record:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const {
      subject_name,
      risk_type,
      risk_level,
      risk_reason,
      proposed_action,
      owner_name,
      review_date,
      follow_status
    } = req.body || {};

    if (!subject_name || !risk_type || !risk_level || !risk_reason || !proposed_action || !owner_name || !review_date || !follow_status) {
      return res.status(400).json({ success: false, error: 'Missing required fields' });
    }

    const userEntity = getRequestEntityContext(req);

    const result = await db.query(
      `INSERT INTO hr_human_risks
        (subject_name, risk_type, risk_level, risk_reason, proposed_action, owner_name, review_date, follow_status, entity_id, entity_type)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       RETURNING *`,
      [
        subject_name,
        risk_type,
        risk_level,
        risk_reason,
        proposed_action,
        owner_name,
        review_date,
        follow_status,
        userEntity.id,
        userEntity.type
      ]
    );

    res.status(201).json({ success: true, record: result.rows[0] });
  } catch (error) {
    console.error('Error creating human risk record:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      subject_name,
      risk_type,
      risk_level,
      risk_reason,
      proposed_action,
      owner_name,
      review_date,
      follow_status
    } = req.body || {};

    const userEntity = getRequestEntityContext(req);
    const result = await db.query(
      `UPDATE hr_human_risks
       SET subject_name = COALESCE($1, subject_name),
           risk_type = COALESCE($2, risk_type),
           risk_level = COALESCE($3, risk_level),
           risk_reason = COALESCE($4, risk_reason),
           proposed_action = COALESCE($5, proposed_action),
           owner_name = COALESCE($6, owner_name),
           review_date = COALESCE($7, review_date),
           follow_status = COALESCE($8, follow_status),
           updated_at = NOW()
       WHERE id = $9${userEntity.type !== 'HQ' ? ' AND entity_id = $10' : ''}
       RETURNING *`,
      [
        subject_name || null,
        risk_type || null,
        risk_level || null,
        risk_reason || null,
        proposed_action || null,
        owner_name || null,
        review_date || null,
        follow_status || null,
        id,
        ...(userEntity.type !== 'HQ' ? [userEntity.id] : [])
      ]
    );

    if (!result.rows.length) {
      return res.status(404).json({ success: false, error: 'Record not found' });
    }

    res.json({ success: true, record: result.rows[0] });
  } catch (error) {
    console.error('Error updating human risk record:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const userEntity = getRequestEntityContext(req);
    const values = [id];
    let query = 'DELETE FROM hr_human_risks WHERE id = $1';
    if (userEntity.type !== 'HQ') {
      values.push(userEntity.id);
      query += ` AND entity_id = $${values.length}`;
    }
    query += ' RETURNING id';
    const result = await db.query(query, values);

    if (!result.rows.length) {
      return res.status(404).json({ success: false, error: 'Record not found' });
    }

    res.json({ success: true, id: result.rows[0].id });
  } catch (error) {
    console.error('Error deleting human risk record:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
