/**
 * API Endpoints لنظام الصلاحيات
 * يمكن استخدام هذه الـ endpoints من الواجهة الأمامية
 */

const express = require('express');
require('dotenv').config();
const db = require('./db');

const pool = db.pool;

const router = express.Router();

/**
 * 1. الحصول على صلاحيات المستخدم الحالي
 * GET /api/permissions/my-permissions
 */
router.get('/my-permissions', async (req, res) => {
    try {
        const userId = req.user?.id; // من authentication middleware
        
        if (!userId) {
            return res.status(401).json({ error: 'غير مصرح' });
        }

        const result = await pool.query(`
            SELECT 
                s.system_code,
                s.system_name_ar,
                s.system_name_en,
                pl.level_code,
                pl.level_name_ar,
                pl.level_name_en,
                pl.priority_order,
                r.job_title_ar,
                r.max_approval_limit
            FROM users u
            JOIN user_roles ur ON u.id = ur.user_id
            JOIN roles r ON ur.role_id = r.id
            JOIN role_system_permissions rsp ON r.id = rsp.role_id
            JOIN systems s ON rsp.system_id = s.id
            JOIN permission_levels pl ON rsp.permission_level_id = pl.id
            WHERE u.id = $1 
            AND u.is_active = TRUE
            AND r.is_active = TRUE
            AND rsp.is_active = TRUE
            ORDER BY s.display_order, pl.priority_order
        `, [userId]);

        // تنظيم البيانات حسب النظام
        const permissions = {};
        result.rows.forEach(row => {
            if (!permissions[row.system_code]) {
                permissions[row.system_code] = {
                    system_name_ar: row.system_name_ar,
                    system_name_en: row.system_name_en,
                    level_code: row.level_code,
                    level_name_ar: row.level_name_ar,
                    can_view: ['FULL', 'VIEW_APPROVE', 'EXECUTIVE', 'VIEW', 'LIMITED'].includes(row.level_code),
                    can_create: ['FULL', 'EXECUTIVE'].includes(row.level_code),
                    can_edit: ['FULL', 'EXECUTIVE'].includes(row.level_code),
                    can_delete: ['FULL'].includes(row.level_code),
                    can_approve: ['FULL', 'VIEW_APPROVE'].includes(row.level_code)
                };
            }
        });

        res.json({
            success: true,
            user_role: result.rows[0]?.job_title_ar || 'غير محدد',
            max_approval_limit: result.rows[0]?.max_approval_limit,
            permissions
        });

    } catch (error) {
        console.error('خطأ في جلب الصلاحيات:', error);
        res.status(500).json({ error: 'خطأ في الخادم' });
    }
});

/**
 * 2. التحقق من صلاحية محددة
 * POST /api/permissions/check
 * Body: { system_code: 'FINANCE', action: 'create' }
 */
router.post('/check', async (req, res) => {
    try {
        const userId = req.user?.id;
        const { system_code, action } = req.body;

        if (!userId) {
            return res.status(401).json({ error: 'غير مصرح' });
        }

        // تحديد المستوى المطلوب حسب الإجراء
        const requiredLevels = {
            'view': ['FULL', 'VIEW_APPROVE', 'EXECUTIVE', 'VIEW', 'LIMITED'],
            'create': ['FULL', 'EXECUTIVE'],
            'edit': ['FULL', 'EXECUTIVE'],
            'delete': ['FULL'],
            'approve': ['FULL', 'VIEW_APPROVE']
        };

        const levels = requiredLevels[action] || [];
        
        const result = await pool.query(`
            SELECT EXISTS (
                SELECT 1
                FROM users u
                JOIN user_roles ur ON u.id = ur.user_id
                JOIN roles r ON ur.role_id = r.id
                JOIN role_system_permissions rsp ON r.id = rsp.role_id
                JOIN systems s ON rsp.system_id = s.id
                JOIN permission_levels pl ON rsp.permission_level_id = pl.id
                WHERE u.id = $1
                AND s.system_code = $2
                AND pl.level_code = ANY($3)
                AND u.is_active = TRUE
                AND r.is_active = TRUE
                AND rsp.is_active = TRUE
            ) AS has_permission
        `, [userId, system_code, levels]);

        res.json({
            success: true,
            has_permission: result.rows[0].has_permission,
            system_code,
            action
        });

    } catch (error) {
        console.error('خطأ في التحقق من الصلاحية:', error);
        res.status(500).json({ error: 'خطأ في الخادم' });
    }
});

/**
 * 3. التحقق من حد الموافقة المالية
 * POST /api/permissions/check-approval
 * Body: { amount: 50000 }
 */
router.post('/check-approval', async (req, res) => {
    try {
        const userId = req.user?.id;
        const { amount } = req.body;

        if (!userId) {
            return res.status(401).json({ error: 'غير مصرح' });
        }

        const result = await pool.query(`
            SELECT 
                r.job_title_ar,
                r.min_approval_limit,
                r.max_approval_limit,
                CASE 
                    WHEN r.max_approval_limit IS NULL THEN true
                    WHEN r.max_approval_limit >= $2 THEN true
                    ELSE false
                END AS can_approve
            FROM users u
            JOIN user_roles ur ON u.id = ur.user_id
            JOIN roles r ON ur.role_id = r.id
            WHERE u.id = $1
            AND u.is_active = TRUE
            AND r.is_active = TRUE
            ORDER BY r.max_approval_limit DESC NULLS FIRST
            LIMIT 1
        `, [userId, amount]);

        if (result.rows.length === 0) {
            return res.json({
                success: false,
                can_approve: false,
                message: 'لا يوجد دور للمستخدم'
            });
        }

        const userRole = result.rows[0];

        res.json({
            success: true,
            can_approve: userRole.can_approve,
            user_role: userRole.job_title_ar,
            max_limit: userRole.max_approval_limit,
            requested_amount: amount,
            message: userRole.can_approve 
                ? `يمكنك الموافقة على هذا المبلغ`
                : `تجاوز حد الموافقة المسموح (${userRole.max_approval_limit || 'غير محدود'})`
        });

    } catch (error) {
        console.error('خطأ في التحقق من حد الموافقة:', error);
        res.status(500).json({ error: 'خطأ في الخادم' });
    }
});

/**
 * 4. الحصول على جميع الأنظمة المتاحة للمستخدم
 * GET /api/permissions/available-systems
 */
router.get('/available-systems', async (req, res) => {
    try {
        const userId = req.user?.id;

        if (!userId) {
            return res.status(401).json({ error: 'غير مصرح' });
        }

        const result = await pool.query(`
            SELECT DISTINCT
                s.system_code,
                s.system_name_ar,
                s.system_name_en,
                s.description_ar,
                s.display_order
            FROM users u
            JOIN user_roles ur ON u.id = ur.user_id
            JOIN roles r ON ur.role_id = r.id
            JOIN role_system_permissions rsp ON r.id = rsp.role_id
            JOIN systems s ON rsp.system_id = s.id
            JOIN permission_levels pl ON rsp.permission_level_id = pl.id
            WHERE u.id = $1
            AND pl.level_code != 'NONE'
            AND u.is_active = TRUE
            AND r.is_active = TRUE
            AND rsp.is_active = TRUE
            AND s.is_active = TRUE
            ORDER BY s.display_order
        `, [userId]);

        res.json({
            success: true,
            systems: result.rows
        });

    } catch (error) {
        console.error('خطأ في جلب الأنظمة المتاحة:', error);
        res.status(500).json({ error: 'خطأ في الخادم' });
    }
});

/**
 * 5. الحصول على معلومات دور المستخدم
 * GET /api/permissions/my-role
 */
router.get('/my-role', async (req, res) => {
    try {
        const userId = req.user?.id;

        if (!userId) {
            return res.status(401).json({ error: 'غير مصرح' });
        }

        const result = await pool.query(`
            SELECT 
                r.name AS role_code,
                r.job_title_ar,
                r.job_title_en,
                r.hierarchy_level,
                r.level,
                r.min_approval_limit,
                r.max_approval_limit,
                r.approval_notes_ar
            FROM users u
            JOIN user_roles ur ON u.id = ur.user_id
            JOIN roles r ON ur.role_id = r.id
            WHERE u.id = $1
            AND u.is_active = TRUE
            AND r.is_active = TRUE
            LIMIT 1
        `, [userId]);

        if (result.rows.length === 0) {
            return res.status(404).json({ 
                success: false,
                error: 'لا يوجد دور للمستخدم' 
            });
        }

        const hierarchyNames = {
            0: 'المكتب الرئيسي',
            1: 'فرع الدولة',
            2: 'حاضنة قطاع الأعمال',
            3: 'المنصة التشغيلية',
            4: 'المكتب التنفيذي'
        };

        const role = result.rows[0];

        res.json({
            success: true,
            role: {
                code: role.role_code,
                title_ar: role.job_title_ar,
                title_en: role.job_title_en,
                hierarchy_level: role.hierarchy_level,
                hierarchy_name: hierarchyNames[role.hierarchy_level],
                level: role.level,
                approval_limit: {
                    min: role.min_approval_limit,
                    max: role.max_approval_limit,
                    is_unlimited: role.max_approval_limit === null,
                    notes: role.approval_notes_ar
                }
            }
        });

    } catch (error) {
        console.error('خطأ في جلب معلومات الدور:', error);
        res.status(500).json({ error: 'خطأ في الخادم' });
    }
});

module.exports = router;
