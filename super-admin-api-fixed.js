require('dotenv').config();
const db = require('./db');
const pool = db.pool;
/**
 * Super Admin API - متوافق مع البنية الحالية للداتابيس
 */

const express = require('express');
const router = express.Router();

// ========== Middleware للتحقق من Super Admin ==========
const verifySuperAdmin = async (req, res, next) => {
    try {
        const userId = req.userId || req.headers['x-user-id'] || 1; // افتراضياً user 1
        
        const result = await pool.query(`
            SELECT r.name, r.hierarchy_level
            FROM user_roles ur
            JOIN roles r ON ur.role_id = r.id
            WHERE ur.user_id = $1 AND ur.is_active = true
            ORDER BY r.hierarchy_level ASC
            LIMIT 1
        `, [userId]);

        if (result.rows.length === 0) {
            return res.status(403).json({ success: false, message: 'غير مصرح - لا يوجد دور نشط' });
        }

        const userRole = result.rows[0];

        // فقط المستوى 0 و 1 لديهم صلاحيات Super Admin
        if (userRole.hierarchy_level > 1) {
            return res.status(403).json({ 
                success: false, 
                message: 'غير مصرح - يجب أن تكون من الإدارة العليا للوصول لهذه الصفحة' 
            });
        }

        req.userRole = userRole;
        next();
    } catch (error) {
        console.error('خطأ في التحقق من Super Admin:', error);
        res.status(500).json({ success: false, message: 'خطأ في التحقق من الصلاحيات' });
    }
};

// ========== 1. GET /metadata - معلومات النظام ==========
router.get('/metadata', async (req, res) => {
    try {
        const rolesCount = await pool.query('SELECT COUNT(*) FROM roles');
        const permissionsCount = await pool.query('SELECT COUNT(*) FROM permissions');
        const usersCount = await pool.query('SELECT COUNT(DISTINCT user_id) FROM user_roles WHERE is_active = true');
        
        res.json({
            success: true,
            metadata: {
                totalRoles: parseInt(rolesCount.rows[0].count),
                totalPermissions: parseInt(permissionsCount.rows[0].count),
                totalUsers: parseInt(usersCount.rows[0].count),
                systemName: 'نظام إدارة الأدوار والصلاحيات',
                version: '1.0.0'
            }
        });
    } catch (error) {
        console.error('خطأ في جلب metadata:', error);
        res.status(500).json({ success: false, message: 'خطأ في جلب معلومات النظام' });
    }
});

// ========== 1. جلب جميع الأدوار ==========
router.get('/roles', verifySuperAdmin, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT 
                r.id,
                r.name as code,
                r.name_ar,
                r.job_title_ar as title_ar,
                r.job_title_en as title_en,
                r.description,
                r.hierarchy_level,
                r.min_approval_limit,
                r.max_approval_limit,
                r.is_active,
                r.created_at,
                (SELECT COUNT(*) FROM user_roles WHERE role_id = r.id AND is_active = true) as users_count,
                (SELECT COUNT(*) FROM role_permissions WHERE role_id = r.id) as permissions_count
            FROM roles r
            WHERE r.is_active = true
            ORDER BY r.hierarchy_level ASC, r.job_title_ar ASC
        `);

        res.json({
            success: true,
            roles: result.rows,
            total: result.rows.length
        });
    } catch (error) {
        console.error('خطأ في جلب الأدوار:', error);
        res.status(500).json({ success: false, message: 'خطأ في جلب الأدوار' });
    }
});

// ========== 2. جلب تفاصيل دور محدد ==========
router.get('/roles/:roleId', verifySuperAdmin, async (req, res) => {
    try {
        const { roleId } = req.params;

        const roleResult = await pool.query(`
            SELECT 
                id,
                name as code,
                name_ar,
                job_title_ar as title_ar,
                job_title_en as title_en,
                description,
                hierarchy_level,
                min_approval_limit,
                max_approval_limit,
                is_active
            FROM roles 
            WHERE id = $1
        `, [roleId]);

        if (roleResult.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'الدور غير موجود' });
        }

        const permissionsResult = await pool.query(`
            SELECT 
                rp.id,
                rp.permission_id,
                p.name as permission_name,
                p.resource,
                p.action
            FROM role_permissions rp
            JOIN permissions p ON rp.permission_id = p.id
            WHERE rp.role_id = $1
        `, [roleId]);

        const usersResult = await pool.query(`
            SELECT 
                ur.user_id,
                ur.assigned_at,
                ur.is_active,
                u.name as user_name
            FROM user_roles ur
            LEFT JOIN users u ON ur.user_id = u.id
            WHERE ur.role_id = $1
            ORDER BY ur.assigned_at DESC
        `, [roleId]);

        res.json({
            success: true,
            role: roleResult.rows[0],
            permissions: permissionsResult.rows,
            users: usersResult.rows
        });
    } catch (error) {
        console.error('خطأ في جلب تفاصيل الدور:', error);
        res.status(500).json({ success: false, message: 'خطأ في جلب التفاصيل' });
    }
});

// ========== 3. تحديث معلومات دور ==========
router.put('/roles/:roleId', verifySuperAdmin, async (req, res) => {
    try {
        const { roleId } = req.params;
        const { 
            name_ar,
            job_title_ar, 
            job_title_en, 
            description, 
            hierarchy_level,
            min_approval_limit,
            max_approval_limit,
            is_active
        } = req.body;

        const result = await pool.query(`
            UPDATE roles SET
                name_ar = COALESCE($1, name_ar),
                job_title_ar = COALESCE($2, job_title_ar),
                job_title_en = COALESCE($3, job_title_en),
                description = COALESCE($4, description),
                hierarchy_level = COALESCE($5, hierarchy_level),
                min_approval_limit = COALESCE($6, min_approval_limit),
                max_approval_limit = COALESCE($7, max_approval_limit),
                is_active = COALESCE($8, is_active),
                updated_at = NOW()
            WHERE id = $9
            RETURNING *
        `, [
            name_ar,
            job_title_ar, 
            job_title_en, 
            description, 
            hierarchy_level,
            min_approval_limit,
            max_approval_limit,
            is_active,
            roleId
        ]);

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'الدور غير موجود' });
        }

        res.json({
            success: true,
            message: 'تم تحديث الدور بنجاح',
            role: result.rows[0]
        });
    } catch (error) {
        console.error('خطأ في تحديث الدور:', error);
        res.status(500).json({ success: false, message: 'خطأ في تحديث الدور' });
    }
});

// ========== 4. إضافة صلاحية لدور ==========
router.post('/roles/:roleId/permissions', verifySuperAdmin, async (req, res) => {
    try {
        const { roleId } = req.params;
        const { permission_ids } = req.body; // مصفوفة من permission IDs

        if (!Array.isArray(permission_ids)) {
            return res.status(400).json({ success: false, message: 'يجب أن تكون permission_ids مصفوفة' });
        }

        const insertedPermissions = [];

        for (const permId of permission_ids) {
            const result = await pool.query(`
                INSERT INTO role_permissions (role_id, permission_id)
                VALUES ($1, $2)
                ON CONFLICT DO NOTHING
                RETURNING *
            `, [roleId, permId]);

            if (result.rows.length > 0) {
                insertedPermissions.push(result.rows[0]);
            }
        }

        res.json({
            success: true,
            message: 'تم إضافة الصلاحيات بنجاح',
            added_count: insertedPermissions.length
        });
    } catch (error) {
        console.error('خطأ في إضافة الصلاحيات:', error);
        res.status(500).json({ success: false, message: 'خطأ في إضافة الصلاحيات' });
    }
});

// ========== 5. حذف صلاحية من دور ==========
router.delete('/roles/:roleId/permissions/:permissionId', verifySuperAdmin, async (req, res) => {
    try {
        const { roleId, permissionId } = req.params;

        const result = await pool.query(`
            DELETE FROM role_permissions 
            WHERE role_id = $1 AND permission_id = $2
            RETURNING *
        `, [roleId, permissionId]);

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'الصلاحية غير موجودة' });
        }

        res.json({
            success: true,
            message: 'تم حذف الصلاحية بنجاح'
        });
    } catch (error) {
        console.error('خطأ في حذف الصلاحية:', error);
        res.status(500).json({ success: false, message: 'خطأ في حذف الصلاحية' });
    }
});

// ========== 6. جلب جميع الصلاحيات المتاحة ==========
router.get('/permissions', verifySuperAdmin, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT id, name, resource, action, description
            FROM permissions
            ORDER BY resource, action
        `);

        res.json({
            success: true,
            permissions: result.rows,
            total: result.rows.length
        });
    } catch (error) {
        console.error('خطأ في جلب الصلاحيات:', error);
        res.status(500).json({ success: false, message: 'خطأ في جلب الصلاحيات' });
    }
});

// ========== 7. تعيين دور لمستخدم ==========
router.post('/users/:userId/role', verifySuperAdmin, async (req, res) => {
    try {
        const { userId } = req.params;
        const { role_id } = req.body;

        if (!role_id) {
            return res.status(400).json({ success: false, message: 'role_id مطلوب' });
        }

        // التحقق من وجود الدور
        const roleCheck = await pool.query('SELECT id FROM roles WHERE id = $1', [role_id]);
        if (roleCheck.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'الدور غير موجود' });
        }

        // إلغاء تفعيل الدور القديم
        await pool.query(`
            UPDATE user_roles 
            SET is_active = false 
            WHERE user_id = $1
        `, [userId]);

        // إضافة الدور الجديد
        const result = await pool.query(`
            INSERT INTO user_roles (user_id, role_id, is_active, assigned_at)
            VALUES ($1, $2, true, NOW())
            ON CONFLICT (user_id, role_id) 
            DO UPDATE SET is_active = true, assigned_at = NOW()
            RETURNING *
        `, [userId, role_id]);

        res.json({
            success: true,
            message: 'تم تعيين الدور بنجاح',
            user_role: result.rows[0]
        });
    } catch (error) {
        console.error('خطأ في تعيين الدور:', error);
        res.status(500).json({ success: false, message: 'خطأ في تعيين الدور' });
    }
});

// ========== 8. إلغاء دور من مستخدم ==========
router.delete('/users/:userId/role', verifySuperAdmin, async (req, res) => {
    try {
        const { userId } = req.params;

        await pool.query(`
            UPDATE user_roles 
            SET is_active = false 
            WHERE user_id = $1
        `, [userId]);

        res.json({
            success: true,
            message: 'تم إلغاء الدور بنجاح'
        });
    } catch (error) {
        console.error('خطأ في إلغاء الدور:', error);
        res.status(500).json({ success: false, message: 'خطأ في إلغاء الدور' });
    }
});

// ========== 9. إحصائيات Dashboard ==========
router.get('/dashboard-stats', verifySuperAdmin, async (req, res) => {
    try {
        const stats = {};

        // عدد الأدوار النشطة
        const rolesResult = await pool.query('SELECT COUNT(*) as count FROM roles WHERE is_active = true');
        stats.total_roles = parseInt(rolesResult.rows[0].count);

        // عدد المستخدمين النشطين
        const usersResult = await pool.query('SELECT COUNT(DISTINCT user_id) as count FROM user_roles WHERE is_active = true');
        stats.active_users = parseInt(usersResult.rows[0].count);

        // عدد الصلاحيات
        const permsResult = await pool.query('SELECT COUNT(*) as count FROM permissions');
        stats.total_permissions = parseInt(permsResult.rows[0].count);

        // عدد تعيينات الأدوار النشطة
        const assignmentsResult = await pool.query('SELECT COUNT(*) as count FROM user_roles WHERE is_active = true');
        stats.active_assignments = parseInt(assignmentsResult.rows[0].count);

        res.json({
            success: true,
            stats
        });
    } catch (error) {
        console.error('خطأ في جلب الإحصائيات:', error);
        res.status(500).json({ success: false, message: 'خطأ في جلب الإحصائيات' });
    }
});

// ========== 10. البحث عن المستخدمين ==========
router.get('/users/search', verifySuperAdmin, async (req, res) => {
    try {
        const { query } = req.query;

        let sql = `
            SELECT 
                u.id,
                u.name,
                u.email,
                r.job_title_ar as current_role,
                ur.assigned_at
            FROM users u
            LEFT JOIN user_roles ur ON u.id = ur.user_id AND ur.is_active = true
            LEFT JOIN roles r ON ur.role_id = r.id
        `;

        const params = [];
        if (query) {
            sql += ` WHERE u.name ILIKE $1 OR u.email ILIKE $1`;
            params.push(`%${query}%`);
        }

        sql += ` ORDER BY u.name LIMIT 50`;

        const result = await pool.query(sql, params);

        res.json({
            success: true,
            users: result.rows
        });
    } catch (error) {
        console.error('خطأ في البحث عن المستخدمين:', error);
        res.status(500).json({ success: false, message: 'خطأ في البحث' });
    }
});

module.exports = router;
