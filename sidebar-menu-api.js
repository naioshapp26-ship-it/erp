/**
 * API للقائمة الجانبية - يعرض العناصر حسب صلاحيات المستخدم
 */

const express = require('express');
require('dotenv').config();
const db = require('./db');

const router = express.Router();
const pool = db.pool;
const VALID_ACCOUNT_TYPES = ['BRANCH', 'OFFICE', 'INCUBATOR', 'TENANT', 'PLATFORM'];

/**
 * GET /api/menu/sidebar
 * جلب عناصر القائمة الجانبية حسب المستخدم
 */
router.get('/sidebar', async (req, res) => {
    try {
        // الحصول على معرف المستخدم من header أو session
        const userId = req.userId || req.headers['x-user-id'] || req.query.user_id;
        
        if (!userId) {
            return res.status(401).json({ 
                success: false, 
                message: 'مطلوب تسجيل دخول' 
            });
        }

        // جلب بيانات المستخدم
        const userResult = await pool.query(`
            SELECT 
                id,
                name,
                email,
                role,
                tenant_type,
                entity_id,
                entity_name,
                office_id
            FROM users
            WHERE id = $1 AND is_active = true
        `, [userId]);

        if (userResult.rows.length === 0) {
            return res.status(404).json({ 
                success: false, 
                message: 'المستخدم غير موجود' 
            });
        }

        const user = userResult.rows[0];

        // جلب دور المستخدم من جدول roles
        let hierarchyLevel = 4; // افتراضياً المستوى الأدنى
        
        const roleResult = await pool.query(`
            SELECT r.hierarchy_level
            FROM user_roles ur
            JOIN roles r ON ur.role_id = r.id
            WHERE ur.user_id = $1 AND ur.is_active = true
            ORDER BY r.hierarchy_level ASC
            LIMIT 1
        `, [userId]);

        if (roleResult.rows.length > 0) {
            hierarchyLevel = roleResult.rows[0].hierarchy_level;
        }

        // جلب عناصر القائمة المناسبة للمستخدم
        let allowedPages = null;
        if (user.tenant_type && user.tenant_type !== 'HQ') {
            try {
                if (user.tenant_type === 'OFFICE') {
                    await pool.query(`
                        CREATE TABLE IF NOT EXISTS office_page_access (
                            id SERIAL PRIMARY KEY,
                            office_id INTEGER REFERENCES offices(id) ON DELETE CASCADE,
                            office_entity_id VARCHAR(120),
                            page_key VARCHAR(120) NOT NULL,
                            created_at TIMESTAMP DEFAULT NOW()
                        )
                    `);
                    await pool.query(`ALTER TABLE office_page_access ALTER COLUMN office_id DROP NOT NULL`);
                    await pool.query(`ALTER TABLE office_page_access ADD COLUMN IF NOT EXISTS office_entity_id VARCHAR(120)`);
                    await pool.query(`
                        CREATE UNIQUE INDEX IF NOT EXISTS office_page_access_office_page_key_idx
                        ON office_page_access (office_id, page_key)
                    `);
                    await pool.query(`
                        CREATE UNIQUE INDEX IF NOT EXISTS office_page_access_entity_page_key_idx
                        ON office_page_access (office_entity_id, page_key)
                    `);
                    const officeResult = await pool.query(`
                        SELECT id
                        FROM offices
                        WHERE id = $1 OR entity_id = $2
                        LIMIT 1
                    `, [user.office_id, user.entity_id]);
                    const officeId = officeResult.rows.length > 0 ? officeResult.rows[0].id : null;
                    const accessResult = await pool.query(`
                        SELECT page_key
                        FROM office_page_access
                        WHERE ($1::INTEGER IS NOT NULL AND office_id = $1)
                           OR office_entity_id = $2
                    `, [officeId, user.entity_id]);
                    allowedPages = new Set(accessResult.rows.map(row => row.page_key));
                }

                if (user.tenant_type === 'TENANT') {
                    await pool.query(`
                        CREATE TABLE IF NOT EXISTS tenant_page_access (
                            id SERIAL PRIMARY KEY,
                            tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
                            tenant_entity_id VARCHAR(120),
                            page_key VARCHAR(120) NOT NULL,
                            created_at TIMESTAMP DEFAULT NOW()
                        )
                    `);
                    await pool.query(`ALTER TABLE tenant_page_access ALTER COLUMN tenant_id DROP NOT NULL`);
                    await pool.query(`ALTER TABLE tenant_page_access ADD COLUMN IF NOT EXISTS tenant_entity_id VARCHAR(120)`);
                    await pool.query(`
                        CREATE UNIQUE INDEX IF NOT EXISTS tenant_page_access_tenant_page_key_idx
                        ON tenant_page_access (tenant_id, page_key)
                    `);
                    await pool.query(`
                        CREATE UNIQUE INDEX IF NOT EXISTS tenant_page_access_entity_page_key_idx
                        ON tenant_page_access (tenant_entity_id, page_key)
                    `);
                    const tenantResult = await pool.query(`
                        SELECT id
                        FROM tenants
                        WHERE id::text = $1
                           OR CONCAT('TEN', LPAD(id::text, 6, '0')) = $2
                        LIMIT 1
                    `, [user.entity_id, user.entity_id]);
                    const tenantId = tenantResult.rows.length > 0 ? tenantResult.rows[0].id : null;
                    const accessResult = await pool.query(`
                        SELECT page_key
                        FROM tenant_page_access
                        WHERE ($1::INTEGER IS NOT NULL AND tenant_id = $1)
                           OR tenant_entity_id = $2
                    `, [tenantId, user.entity_id]);
                    allowedPages = new Set(accessResult.rows.map(row => row.page_key));
                }

                if ((!allowedPages || allowedPages.size === 0) && VALID_ACCOUNT_TYPES.includes(user.tenant_type)) {
                    await pool.query(`
                        CREATE TABLE IF NOT EXISTS account_type_sidebar_config (
                            id SERIAL PRIMARY KEY,
                            account_type VARCHAR(50) NOT NULL,
                            page_key VARCHAR(120) NOT NULL,
                            created_at TIMESTAMP DEFAULT NOW(),
                            UNIQUE(account_type, page_key)
                        )
                    `);
                    const accessResult = await pool.query(`
                        SELECT page_key
                        FROM account_type_sidebar_config
                        WHERE account_type = $1
                    `, [user.tenant_type]);
                    allowedPages = new Set(accessResult.rows.map(row => row.page_key));
                }
            } catch (error) {
                console.log('⚠️  لم يتم تحميل صلاحيات صفحات المكتب:', error.message);
            }
        }

        const menuResult = await pool.query(`
            SELECT 
                id,
                title_ar,
                title_en,
                icon,
                url,
                parent_id,
                display_order
            FROM sidebar_menu
            WHERE is_active = true
            AND (
                -- عناصر متاحة للجميع
                (required_entity_id IS NULL AND min_hierarchy_level IS NULL)
                OR
                -- عناصر خاصة بـ entity_id محدد
                (required_entity_id = $1)
                OR
                -- عناصر حسب المستوى الهرمي
                (min_hierarchy_level IS NOT NULL AND $2 <= min_hierarchy_level)
            )
            ORDER BY display_order, title_ar
        `, [user.entity_id, hierarchyLevel]);

        // تنظيم القائمة (رئيسية وفرعية)
        const menuItems = menuResult.rows.map(item => ({
            id: item.id,
            title: item.title_ar,
            titleEn: item.title_en,
            icon: item.icon,
            url: item.url,
            parentId: item.parent_id,
            order: item.display_order
        })).filter(item => {
            if (!allowedPages) return true;
            if (allowedPages.size === 0) {
                return item.url === '/home' || item.url === '/' || item.url === '/index.html';
            }
            if (!item.url) return true;
            const key = item.url.replace('/', '');
            const routeKey = key === 'home' ? 'dashboard' : key;
            const normalizedKey = key === 'records-archive' ? 'records-archive-home' : key;
            return allowedPages.has(normalizedKey) || allowedPages.has(key) || allowedPages.has(routeKey);
        });

        // تقسيم إلى رئيسية وفرعية
        const mainItems = menuItems.filter(item => !item.parentId);
        const subItems = menuItems.filter(item => item.parentId);

        // ربط العناصر الفرعية بالرئيسية
        mainItems.forEach(main => {
            main.children = subItems.filter(sub => sub.parentId === main.id);
        });
        const filteredMainItems = mainItems.filter(main => main.children.length > 0 || main.url);

        res.json({
            success: true,
            user: {
                id: user.id,
                name: user.name,
                entity_id: user.entity_id,
                entity_name: user.entity_name,
                hierarchy_level: hierarchyLevel
            },
            menu: filteredMainItems
        });

    } catch (error) {
        console.error('خطأ في جلب القائمة:', error);
        res.status(500).json({ 
            success: false, 
            message: 'خطأ في جلب القائمة الجانبية' 
        });
    }
});

/**
 * GET /api/menu/check-access
 * التحقق من صلاحية الوصول لصفحة معينة
 */
router.get('/check-access', async (req, res) => {
    try {
        const userId = req.userId || req.headers['x-user-id'] || req.query.user_id;
        const { url } = req.query;

        if (!userId || !url) {
            return res.status(400).json({ 
                success: false, 
                message: 'مطلوب user_id و url' 
            });
        }

        // جلب بيانات المستخدم
        const userResult = await pool.query(`
            SELECT entity_id FROM users WHERE id = $1 AND is_active = true
        `, [userId]);

        if (userResult.rows.length === 0) {
            return res.json({ success: false, has_access: false });
        }

        const user = userResult.rows[0];

        // جلب المستوى الهرمي
        let hierarchyLevel = 4;
        const roleResult = await pool.query(`
            SELECT r.hierarchy_level
            FROM user_roles ur
            JOIN roles r ON ur.role_id = r.id
            WHERE ur.user_id = $1 AND ur.is_active = true
            ORDER BY r.hierarchy_level ASC
            LIMIT 1
        `, [userId]);

        if (roleResult.rows.length > 0) {
            hierarchyLevel = roleResult.rows[0].hierarchy_level;
        }

        // التحقق من الصلاحية
        const accessResult = await pool.query(`
            SELECT id
            FROM sidebar_menu
            WHERE url = $1
            AND is_active = true
            AND (
                (required_entity_id IS NULL AND min_hierarchy_level IS NULL)
                OR (required_entity_id = $2)
                OR (min_hierarchy_level IS NOT NULL AND $3 <= min_hierarchy_level)
            )
        `, [url, user.entity_id, hierarchyLevel]);

        res.json({
            success: true,
            has_access: accessResult.rows.length > 0
        });

    } catch (error) {
        console.error('خطأ في التحقق من الصلاحية:', error);
        res.status(500).json({ 
            success: false, 
            message: 'خطأ في التحقق من الصلاحية' 
        });
    }
});

module.exports = router;
