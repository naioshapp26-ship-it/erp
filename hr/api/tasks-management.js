const express = require('express');
const router = express.Router();
const db = require('../../db');
const { getRequestEntityContext } = require('../../entity-context');

const ensureTasksTable = async () => {
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS hr_tasks (
        id SERIAL PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT,
        status TEXT NOT NULL DEFAULT 'todo',
        priority TEXT NOT NULL DEFAULT 'medium',
        start_date DATE,
        end_date DATE,
        attachments JSONB DEFAULT '[]',
        entity_id TEXT DEFAULT 'HQ001',
        entity_type TEXT DEFAULT 'HQ',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_hr_tasks_entity ON hr_tasks(entity_id);
      CREATE INDEX IF NOT EXISTS idx_hr_tasks_status ON hr_tasks(status);
      CREATE INDEX IF NOT EXISTS idx_hr_tasks_priority ON hr_tasks(priority);
      CREATE INDEX IF NOT EXISTS idx_hr_tasks_end_date ON hr_tasks(end_date);
    `);
    console.log('✅ hr_tasks table ready');
  } catch (error) {
    console.error('❌ Failed to ensure hr_tasks table:', error);
  }
};

ensureTasksTable();

// GET all tasks
router.get('/', async (req, res) => {
  try {
    const { q, status, priority } = req.query || {};
    const userEntity = req.userEntity || { type: 'HQ', id: 'HQ001' };

    const values = [];
    const conditions = [];

    if (userEntity.type !== 'HQ') {
      values.push(userEntity.id);
      conditions.push(`entity_id = $${values.length}`);
    }

    if (status) {
      values.push(status);
      conditions.push(`status = $${values.length}`);
    }

    if (priority) {
      values.push(priority);
      conditions.push(`priority = $${values.length}`);
    }

    if (q) {
      values.push(`%${q}%`);
      conditions.push(`(title ILIKE $${values.length} OR description ILIKE $${values.length})`);
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const result = await db.query(
      `SELECT * FROM hr_tasks ${whereClause} ORDER BY created_at DESC`,
      values
    );

    res.json({ success: true, records: result.rows || [] });
  } catch (error) {
    console.error('Error fetching tasks:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET stats
router.get('/stats', async (req, res) => {
  try {
    const userEntity = getRequestEntityContext(req);
    const values = [];
    let entityFilter = '';
    if (userEntity.type !== 'HQ') {
      values.push(userEntity.id);
      entityFilter = `WHERE entity_id = $${values.length}`;
    }

    const result = await db.query(`
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE status = 'in_progress')::int AS in_progress,
        COUNT(*) FILTER (WHERE status = 'done')::int AS done,
        COUNT(*) FILTER (WHERE status != 'done' AND end_date < CURRENT_DATE)::int AS late
      FROM hr_tasks
      ${entityFilter}
    `, values);

    res.json({ success: true, stats: result.rows[0] });
  } catch (error) {
    console.error('Error fetching task stats:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET single task
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const userEntity = getRequestEntityContext(req);
    const values = [id];
    let query = 'SELECT * FROM hr_tasks WHERE id = $1';
    if (userEntity.type !== 'HQ') {
      values.push(userEntity.id);
      query += ` AND entity_id = $${values.length}`;
    }
    const result = await db.query(query, values);
    if (!result.rows.length) {
      return res.status(404).json({ success: false, error: 'Task not found' });
    }
    res.json({ success: true, record: result.rows[0] });
  } catch (error) {
    console.error('Error fetching task:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST create task
router.post('/', async (req, res) => {
  try {
    const { title, description, status, priority, start_date, end_date, attachments } = req.body || {};

    if (!title || !title.trim()) {
      return res.status(400).json({ success: false, error: 'عنوان المهمة مطلوب' });
    }

    const userEntity = getRequestEntityContext(req);
    const safeAttachments = Array.isArray(attachments) ? JSON.stringify(attachments) : '[]';

    const result = await db.query(
      `INSERT INTO hr_tasks
        (title, description, status, priority, start_date, end_date, attachments, entity_id, entity_type)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       RETURNING *`,
      [
        title.trim(),
        description || null,
        status || 'todo',
        priority || 'medium',
        start_date || null,
        end_date || null,
        safeAttachments,
        userEntity.id,
        userEntity.type
      ]
    );

    res.status(201).json({ success: true, record: result.rows[0] });
  } catch (error) {
    console.error('Error creating task:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// PUT update task
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, status, priority, start_date, end_date, attachments } = req.body || {};

    if (!title || !title.trim()) {
      return res.status(400).json({ success: false, error: 'عنوان المهمة مطلوب' });
    }

    const userEntity = getRequestEntityContext(req);
    const existingValues = [id];
    let existingQuery = 'SELECT id FROM hr_tasks WHERE id = $1';
    if (userEntity.type !== 'HQ') {
      existingValues.push(userEntity.id);
      existingQuery += ` AND entity_id = $${existingValues.length}`;
    }
    const existing = await db.query(existingQuery, existingValues);
    if (!existing.rows.length) {
      return res.status(404).json({ success: false, error: 'Task not found' });
    }

    const safeAttachments = Array.isArray(attachments) ? JSON.stringify(attachments) : '[]';

    const result = await db.query(
      `UPDATE hr_tasks
       SET title=$1, description=$2, status=$3, priority=$4,
            start_date=$5, end_date=$6, attachments=$7, updated_at=NOW()
       WHERE id=$8${userEntity.type !== 'HQ' ? ' AND entity_id = $9' : ''}
       RETURNING *`,
      [
        title.trim(),
        description || null,
        status || 'todo',
        priority || 'medium',
        start_date || null,
        end_date || null,
        safeAttachments,
        id,
        ...(userEntity.type !== 'HQ' ? [userEntity.id] : [])
      ]
    );

    res.json({ success: true, record: result.rows[0] });
  } catch (error) {
    console.error('Error updating task:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// PATCH update status only
router.patch('/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body || {};
    const userEntity = getRequestEntityContext(req);

    const validStatuses = ['todo', 'in_progress', 'done'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, error: 'حالة غير صالحة' });
    }

    const result = await db.query(
      `UPDATE hr_tasks
       SET status=$1, updated_at=NOW()
       WHERE id=$2${userEntity.type !== 'HQ' ? ' AND entity_id = $3' : ''}
       RETURNING *`,
      [status, id, ...(userEntity.type !== 'HQ' ? [userEntity.id] : [])]
    );

    if (!result.rows.length) {
      return res.status(404).json({ success: false, error: 'Task not found' });
    }

    res.json({ success: true, record: result.rows[0] });
  } catch (error) {
    console.error('Error updating task status:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// DELETE task
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const userEntity = getRequestEntityContext(req);
    const values = [id];
    let query = 'DELETE FROM hr_tasks WHERE id = $1';
    if (userEntity.type !== 'HQ') {
      values.push(userEntity.id);
      query += ` AND entity_id = $${values.length}`;
    }
    query += ' RETURNING id';
    const result = await db.query(query, values);

    if (!result.rows.length) {
      return res.status(404).json({ success: false, error: 'Task not found' });
    }

    res.json({ success: true, message: 'تم حذف المهمة بنجاح' });
  } catch (error) {
    console.error('Error deleting task:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
