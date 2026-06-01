const express = require('express');
const router = express.Router();
const db = require('./db');

const ROLE_LEVEL_MAP = {
  HQ: 0,
  BRANCH: 1,
  INCUBATOR: 2,
  PLATFORM: 3,
  OFFICE: 4,
  EXECUTIVE_OFFICE: 4,
  DEPARTMENT: 5
};

const toNumberOrNull = (value) => {
  if (value === undefined || value === null || value === '') return null;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? null : parsed;
};

const toBooleanOrNull = (value) => {
  if (value === undefined || value === null) return null;
  if (typeof value === 'boolean') return value;
  return ['true', '1', 'yes', 'on'].includes(String(value).toLowerCase());
};

// Get all roles with hierarchy levels
router.get('/roles', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT 
        id,
        name,
        name_ar,
        job_title_ar,
        level,
        hierarchy_level,
        min_approval_limit,
        max_approval_limit,
        approval_notes_ar,
        description,
        is_active,
        created_at,
        updated_at
      FROM roles
      WHERE is_active = true
      ORDER BY hierarchy_level, job_title_ar
    `);
    
    res.json({
      success: true,
      roles: result.rows,
      count: result.rows.length
    });
  } catch (error) {
    console.error('Error fetching roles:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// إنشاء دور جديد
router.post('/roles', async (req, res) => {
  try {
    const {
      role_code,
      name_ar,
      job_title_ar,
      description,
      level,
      hierarchy_level,
      min_approval_limit,
      max_approval_limit,
      approval_notes_ar,
      is_active
    } = req.body || {};

    if (!role_code || !name_ar || !job_title_ar) {
      return res.status(400).json({ success: false, error: 'مطلوب إدخال كود الدور، الاسم العربي، المسمى الوظيفي.' });
    }

    const normalizedLevel = level || 'HQ';
    const normalizedHierarchy = hierarchy_level ?? ROLE_LEVEL_MAP[normalizedLevel] ?? 0;

    const insertResult = await db.query(
      `INSERT INTO roles (
        name,
        name_ar,
        job_title_ar,
        description,
        level,
        hierarchy_level,
        min_approval_limit,
        max_approval_limit,
        approval_notes_ar,
        is_active,
        created_at,
        updated_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,COALESCE($10, TRUE), NOW(), NOW())
      RETURNING id, name, name_ar, job_title_ar, description, level, hierarchy_level, min_approval_limit, max_approval_limit, approval_notes_ar, is_active, created_at`,
      [
        String(role_code).trim().toUpperCase(),
        name_ar.trim(),
        job_title_ar.trim(),
        description || null,
        normalizedLevel,
        normalizedHierarchy,
        toNumberOrNull(min_approval_limit),
        toNumberOrNull(max_approval_limit),
        approval_notes_ar || null,
        toBooleanOrNull(is_active)
      ]
    );

    res.status(201).json({ success: true, role: insertResult.rows[0] });
  } catch (error) {
    console.error('خطأ في إنشاء الدور:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// تعديل دور
router.put('/roles/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      role_code,
      name_ar,
      job_title_ar,
      description,
      level,
      hierarchy_level,
      min_approval_limit,
      max_approval_limit,
      approval_notes_ar,
      is_active
    } = req.body || {};

    const normalizedLevel = level || null;
    const normalizedHierarchy =
      hierarchy_level !== undefined && hierarchy_level !== null
        ? hierarchy_level
        : normalizedLevel
          ? ROLE_LEVEL_MAP[normalizedLevel] ?? null
          : null;

    const updateResult = await db.query(
      `UPDATE roles SET
        name = COALESCE($1, name),
        name_ar = COALESCE($2, name_ar),
        job_title_ar = COALESCE($3, job_title_ar),
        description = COALESCE($4, description),
        level = COALESCE($5, level),
        hierarchy_level = COALESCE($6, hierarchy_level),
        min_approval_limit = COALESCE($7, min_approval_limit),
        max_approval_limit = COALESCE($8, max_approval_limit),
        approval_notes_ar = COALESCE($9, approval_notes_ar),
        is_active = COALESCE($10, is_active),
        updated_at = NOW()
      WHERE id = $11
      RETURNING id, name, name_ar, job_title_ar, description, level, hierarchy_level, min_approval_limit, max_approval_limit, approval_notes_ar, is_active, created_at, updated_at`,
      [
        role_code ? String(role_code).trim().toUpperCase() : null,
        name_ar || null,
        job_title_ar || null,
        description || null,
        normalizedLevel,
        normalizedHierarchy,
        toNumberOrNull(min_approval_limit),
        toNumberOrNull(max_approval_limit),
        approval_notes_ar || null,
        toBooleanOrNull(is_active),
        id
      ]
    );

    if (updateResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'الدور غير موجود' });
    }

    res.json({ success: true, role: updateResult.rows[0] });
  } catch (error) {
    console.error('خطأ في تحديث الدور:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// حذف/تعطيل دور
router.delete('/roles/:id', async (req, res) => {
  const client = await db.pool.connect();
  try {
    const { id } = req.params;
    await client.query('BEGIN');

    const roleUpdate = await client.query(
      `UPDATE roles SET is_active = FALSE, updated_at = NOW() WHERE id = $1 RETURNING id, name, name_ar, job_title_ar`,
      [id]
    );

    if (roleUpdate.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, error: 'الدور غير موجود' });
    }

    await client.query(
      `UPDATE role_system_permissions SET is_active = FALSE, updated_at = NOW() WHERE role_id = $1`,
      [id]
    );

    await client.query('COMMIT');
    res.json({ success: true, role: roleUpdate.rows[0] });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('خطأ في حذف الدور:', error);
    res.status(500).json({ success: false, error: error.message });
  } finally {
    client.release();
  }
});

// Get permissions for specific role
router.get('/role/:roleId', async (req, res) => {
  try {
    const { roleId } = req.params;
    
    const result = await db.query(`
      SELECT 
        rsp.role_id,
        rsp.system_id,
        rsp.permission_level_id,
        s.system_code,
        s.system_name_ar,
        pl.level_code,
        pl.level_name_ar
      FROM role_system_permissions rsp
      JOIN systems s ON rsp.system_id = s.id
      JOIN permission_levels pl ON rsp.permission_level_id = pl.id
      WHERE rsp.role_id = $1
      ORDER BY s.system_code
    `, [roleId]);
    
    res.json({
      success: true,
      permissions: result.rows,
      count: result.rows.length
    });
  } catch (error) {
    console.error('Error fetching role permissions:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

const buildAssignmentQuery = `
  SELECT 
    rsp.id,
    rsp.role_id,
    rsp.system_id,
    rsp.permission_level_id,
    rsp.is_active,
    rsp.notes,
    rsp.created_at,
    rsp.updated_at,
    r.job_title_ar AS role_name_ar,
    r.level AS role_level,
    r.hierarchy_level,
    s.system_code,
    s.system_name_ar,
    pl.level_code,
    pl.level_name_ar
  FROM role_system_permissions rsp
  JOIN roles r ON rsp.role_id = r.id
  JOIN systems s ON rsp.system_id = s.id
  JOIN permission_levels pl ON rsp.permission_level_id = pl.id
`;

// جميع صلاحيات الربط
router.get('/assignments', async (req, res) => {
  try {
    const result = await db.query(`${buildAssignmentQuery} WHERE rsp.is_active = true AND r.is_active = true AND s.is_active = true ORDER BY r.hierarchy_level, r.job_title_ar, s.display_order, s.system_code`);
    res.json({ success: true, assignments: result.rows, count: result.rows.length });
  } catch (error) {
    console.error('خطأ في جلب صلاحيات الربط:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// إضافة أو تحديث صلاحية ربط
router.post('/assignments', async (req, res) => {
  try {
    const { role_id, system_id, permission_level_id, notes, is_active } = req.body || {};

    if (!role_id || !system_id || !permission_level_id) {
      return res.status(400).json({ success: false, error: 'مطلوب تحديد الدور، النظام، مستوى الصلاحية.' });
    }

    const existing = await db.query(
      'SELECT id FROM role_system_permissions WHERE role_id = $1 AND system_id = $2 LIMIT 1',
      [role_id, system_id]
    );

    const activeValue = toBooleanOrNull(is_active);
    let savedId;

    if (existing.rows.length > 0) {
      const update = await db.query(
        `UPDATE role_system_permissions SET
          permission_level_id = $1,
          notes = COALESCE($2, notes),
          is_active = COALESCE($3, is_active),
          updated_at = NOW()
        WHERE id = $4
        RETURNING id`,
        [permission_level_id, notes || null, activeValue, existing.rows[0].id]
      );
      savedId = update.rows[0].id;
    } else {
      const insert = await db.query(
        `INSERT INTO role_system_permissions (role_id, system_id, permission_level_id, is_active, notes, created_at, updated_at)
         VALUES ($1,$2,$3,COALESCE($4, TRUE),$5,NOW(),NOW())
         RETURNING id`,
        [role_id, system_id, permission_level_id, activeValue, notes || null]
      );
      savedId = insert.rows[0].id;
    }

    const assignment = await db.query(`${buildAssignmentQuery} WHERE rsp.id = $1`, [savedId]);
    res.status(201).json({ success: true, assignment: assignment.rows[0] });
  } catch (error) {
    console.error('خطأ في حفظ صلاحية الربط:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// تعديل صلاحية ربط
router.put('/assignments/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { permission_level_id, notes, is_active } = req.body || {};

    const update = await db.query(
      `UPDATE role_system_permissions SET
        permission_level_id = COALESCE($1, permission_level_id),
        notes = COALESCE($2, notes),
        is_active = COALESCE($3, is_active),
        updated_at = NOW()
      WHERE id = $4
      RETURNING id`,
      [permission_level_id || null, notes || null, toBooleanOrNull(is_active), id]
    );

    if (update.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'السجل غير موجود' });
    }

    const assignment = await db.query(`${buildAssignmentQuery} WHERE rsp.id = $1`, [id]);
    res.json({ success: true, assignment: assignment.rows[0] });
  } catch (error) {
    console.error('خطأ في تحديث صلاحية الربط:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// حذف/تعطيل صلاحية ربط
router.delete('/assignments/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const update = await db.query(
      `UPDATE role_system_permissions SET is_active = FALSE, updated_at = NOW() WHERE id = $1 RETURNING id`,
      [id]
    );

    if (update.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'السجل غير موجود' });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('خطأ في حذف صلاحية الربط:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get permissions statistics
router.get('/stats', async (req, res) => {
  try {
    const rolesCount = await db.query('SELECT COUNT(*) as count FROM roles WHERE is_active = true');
    const systemsCount = await db.query('SELECT COUNT(*) as count FROM systems');
    const levelsCount = await db.query('SELECT COUNT(*) as count FROM permission_levels');
    const permissionsCount = await db.query('SELECT COUNT(*) as count FROM role_system_permissions WHERE is_active = true');
    
    // Roles by hierarchy level
    const rolesByLevel = await db.query(`
      SELECT 
        hierarchy_level,
        COUNT(*) as count
      FROM roles
      WHERE is_active = true
      GROUP BY hierarchy_level
      ORDER BY hierarchy_level
    `);
    
    res.json({
      success: true,
      stats: {
        total_roles: parseInt(rolesCount.rows[0].count),
        total_systems: parseInt(systemsCount.rows[0].count),
        total_permission_levels: parseInt(levelsCount.rows[0].count),
        total_permissions: parseInt(permissionsCount.rows[0].count),
        roles_by_level: rolesByLevel.rows
      }
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get full permissions matrix
router.get('/matrix', async (req, res) => {
  try {
    // Get all systems
    const systems = await db.query(`
      SELECT id, system_code, system_name_ar, description_ar
      FROM systems
      WHERE is_active = true
      ORDER BY display_order
    `);
    
    // Get all roles with their permissions
    const roles = await db.query(`
      SELECT 
        r.id,
        r.name,
        r.name_ar,
        r.job_title_ar,
        r.hierarchy_level
      FROM roles r
      WHERE r.is_active = true
      ORDER BY r.hierarchy_level, r.job_title_ar
    `);
    
    // Get all permission mappings
    const permissions = await db.query(`
      SELECT 
        rsp.role_id,
        rsp.system_id,
        rsp.permission_level_id,
        pl.level_code,
        pl.level_name_ar
      FROM role_system_permissions rsp
      JOIN permission_levels pl ON rsp.permission_level_id = pl.id
    `);
    
    res.json({
      success: true,
      matrix: {
        systems: systems.rows,
        roles: roles.rows,
        permissions: permissions.rows
      }
    });
  } catch (error) {
    console.error('Error fetching matrix:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get all systems
router.get('/systems', async (req, res) => {
  try {
    const systems = await db.query(`
      SELECT 
        id,
        system_code,
        system_name_ar,
        description_ar,
        display_order,
        is_active
      FROM systems
      WHERE is_active = true
      ORDER BY display_order
    `);

    res.json({
      success: true,
      systems: systems.rows,
      count: systems.rows.length
    });
  } catch (error) {
    console.error('Error fetching systems:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get all permission levels
router.get('/levels', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT 
        id,
        level_code,
        level_name_ar,
        level_name_en,
        description_ar,
        description_en,
        color_code,
        priority_order,
        created_at
      FROM permission_levels
      ORDER BY priority_order
    `);
    
    res.json({
      success: true,
      levels: result.rows,
      count: result.rows.length
    });
  } catch (error) {
    console.error('Error fetching permission levels:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
