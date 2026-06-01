const express = require('express');
const router = express.Router();
const db = require('../../db');
const { getRequestEntityContext } = require('../../entity-context');

const ensureSkillsTable = async () => {
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS hr_skills_records (
        id SERIAL PRIMARY KEY,
        employee_name TEXT NOT NULL,
        skill_name TEXT NOT NULL,
        department TEXT NOT NULL,
        skill_type TEXT NOT NULL,
        skill_level TEXT NOT NULL,
        years_experience INTEGER NOT NULL DEFAULT 0,
        assessment_date DATE NOT NULL,
        skill_status TEXT NOT NULL,
        role_match TEXT,
        is_core BOOLEAN DEFAULT false,
        entity_id TEXT DEFAULT 'HQ001',
        entity_type TEXT DEFAULT 'HQ',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_hr_skills_entity ON hr_skills_records(entity_id);
      CREATE INDEX IF NOT EXISTS idx_hr_skills_department ON hr_skills_records(department);
      CREATE INDEX IF NOT EXISTS idx_hr_skills_level ON hr_skills_records(skill_level);
      CREATE INDEX IF NOT EXISTS idx_hr_skills_status ON hr_skills_records(skill_status);
      CREATE INDEX IF NOT EXISTS idx_hr_skills_date ON hr_skills_records(assessment_date);
    `);

    const seedCheck = await db.query(
      "SELECT COUNT(*)::int AS count FROM hr_skills_records WHERE entity_id = 'HQ001'"
    );

    if ((seedCheck.rows[0]?.count || 0) === 0) {
      await db.query(
        `INSERT INTO hr_skills_records
          (employee_name, skill_name, department, skill_type, skill_level, years_experience, assessment_date, skill_status, role_match, is_core, entity_id, entity_type)
         VALUES
          ('سارة نجيب', 'تحليل بيانات', 'تحليلات الموارد البشرية', 'تقنية', 'خبير', 8, '2026-01-12', 'معتمدة', 'مطابقة كاملة لمتطلبات الدور', true, 'HQ001', 'HQ'),
          ('أحمد لطفي', 'إدارة برامج التعلم', 'التطوير المؤسسي', 'إدارية', 'متقدم', 6, '2026-02-04', 'معتمدة', 'يحتاج دعم في تحليل النتائج', true, 'HQ001', 'HQ'),
          ('منة سامي', 'حل النزاعات', 'علاقات الموظفين', 'قيادية', 'متوسط', 5, '2026-02-10', 'تحتاج تطوير', 'فجوة في إدارة الحالات المعقدة', false, 'HQ001', 'HQ'),
          ('كريم عادل', 'تصميم التعويضات', 'المكافآت والتعويضات', 'إدارية', 'متقدم', 7, '2026-01-28', 'معتمدة', 'مطابقة عالية مع متطلبات الدور', true, 'HQ001', 'HQ'),
          ('نوران عز', 'تشغيل أنظمة الموارد البشرية', 'أنظمة الموارد البشرية', 'تقنية', 'متوسط', 4, '2026-02-14', 'تحتاج تطوير', 'نقص في أتمتة التقارير', false, 'HQ001', 'HQ'),
          ('ليلى صادق', 'تخطيط التعاقب', 'إدارة المواهب', 'قيادية', 'خبير', 9, '2026-01-22', 'معتمدة', 'جاهزة لقيادة مبادرات جديدة', true, 'HQ001', 'HQ'),
          ('عمر هشام', 'التخطيط للقوى العاملة', 'التخطيط الاستراتيجي', 'تشغيلية', 'متقدم', 10, '2026-01-18', 'معتمدة', 'مطابقة كاملة مع احتياج القسم', true, 'HQ001', 'HQ'),
          ('ميسون سعد', 'التوظيف المتخصص', 'الاستقطاب', 'تشغيلية', 'مبتدئ', 3, '2026-02-09', 'تحتاج تطوير', 'تحتاج تدريب على تقنيات التوظيف الرقمي', false, 'HQ001', 'HQ')
        `
      );
    }

    console.log('✅ hr skills records table ready');
  } catch (error) {
    console.error('❌ Failed to ensure hr skills table:', error);
  }
};

ensureSkillsTable();

const buildOrderBy = () => 'assessment_date DESC, id DESC';

router.get('/', async (req, res) => {
  try {
    const { q, department, level } = req.query || {};
    const userEntity = getRequestEntityContext(req);

    const values = [];
    const conditions = [];

    if (userEntity.type !== 'HQ') {
      values.push(userEntity.id);
      conditions.push('entity_id = $1');
    }

    if (department) {
      values.push(department);
      conditions.push(`department = $${values.length}`);
    }

    if (level) {
      values.push(level);
      conditions.push(`skill_level = $${values.length}`);
    }

    if (q) {
      values.push(`%${q}%`);
      conditions.push(`(employee_name ILIKE $${values.length} OR skill_name ILIKE $${values.length})`);
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const orderBy = buildOrderBy();

    const result = await db.query(
      `SELECT * FROM hr_skills_records
       ${whereClause}
       ORDER BY ${orderBy}`,
      values
    );

    res.json({ success: true, records: result.rows || [] });
  } catch (error) {
    console.error('Error fetching skills records:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const userEntity = getRequestEntityContext(req);
    const values = [id];
    let query = 'SELECT * FROM hr_skills_records WHERE id = $1';
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
    console.error('Error fetching skill record:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const {
      employee_name,
      skill_name,
      department,
      skill_type,
      skill_level,
      years_experience,
      assessment_date,
      skill_status,
      role_match,
      is_core
    } = req.body || {};

    if (!employee_name || !skill_name || !department || !skill_type || !skill_level || !assessment_date || !skill_status) {
      return res.status(400).json({ success: false, error: 'Missing required fields' });
    }

    const userEntity = getRequestEntityContext(req);

    const result = await db.query(
      `INSERT INTO hr_skills_records
        (employee_name, skill_name, department, skill_type, skill_level, years_experience, assessment_date, skill_status, role_match, is_core, entity_id, entity_type)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       RETURNING *`,
      [
        employee_name,
        skill_name,
        department,
        skill_type,
        skill_level,
        Number(years_experience || 0),
        assessment_date,
        skill_status,
        role_match || null,
        Boolean(is_core),
        userEntity.id,
        userEntity.type
      ]
    );

    res.status(201).json({ success: true, record: result.rows[0] });
  } catch (error) {
    console.error('Error creating skill record:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      employee_name,
      skill_name,
      department,
      skill_type,
      skill_level,
      years_experience,
      assessment_date,
      skill_status,
      role_match,
      is_core
    } = req.body || {};

    const userEntity = getRequestEntityContext(req);
    const result = await db.query(
      `UPDATE hr_skills_records
       SET employee_name = COALESCE($1, employee_name),
           skill_name = COALESCE($2, skill_name),
           department = COALESCE($3, department),
           skill_type = COALESCE($4, skill_type),
           skill_level = COALESCE($5, skill_level),
           years_experience = COALESCE($6, years_experience),
           assessment_date = COALESCE($7, assessment_date),
           skill_status = COALESCE($8, skill_status),
           role_match = COALESCE($9, role_match),
           is_core = COALESCE($10, is_core),
           updated_at = NOW()
       WHERE id = $11${userEntity.type !== 'HQ' ? ' AND entity_id = $12' : ''}
       RETURNING *`,
      [
        employee_name || null,
        skill_name || null,
        department || null,
        skill_type || null,
        skill_level || null,
        years_experience === undefined ? null : Number(years_experience),
        assessment_date || null,
        skill_status || null,
        role_match === undefined ? null : role_match,
        is_core === undefined ? null : Boolean(is_core),
        id,
        ...(userEntity.type !== 'HQ' ? [userEntity.id] : [])
      ]
    );

    if (!result.rows.length) {
      return res.status(404).json({ success: false, error: 'Record not found' });
    }

    res.json({ success: true, record: result.rows[0] });
  } catch (error) {
    console.error('Error updating skill record:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const userEntity = getRequestEntityContext(req);
    const values = [id];
    let query = 'DELETE FROM hr_skills_records WHERE id = $1';
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
    console.error('Error deleting skill record:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
