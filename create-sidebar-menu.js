/**
 * إنشاء جدول القائمة الجانبية وإضافة عنصر Super Admin
 */

const { Pool } = require('pg');

const pool = new Pool({
    connectionString: 'postgresql://postgres:PddzJpAQYezqknsntSzmCUlQYuYJldcT@crossover.proxy.rlwy.net:44255/railway',
    ssl: false
});

async function createMenuSystem() {
    const client = await pool.connect();
    
    try {
        await client.query('BEGIN');

        console.log('========== إنشاء جدول القائمة الجانبية ==========\n');

        // إنشاء جدول القائمة
        await client.query(`
            CREATE TABLE IF NOT EXISTS sidebar_menu (
                id SERIAL PRIMARY KEY,
                title_ar VARCHAR(100) NOT NULL,
                title_en VARCHAR(100),
                icon VARCHAR(50),
                url VARCHAR(255),
                parent_id INTEGER REFERENCES sidebar_menu(id),
                display_order INTEGER DEFAULT 0,
                required_role VARCHAR(100),
                required_entity_type VARCHAR(50),
                required_entity_id VARCHAR(50),
                min_hierarchy_level INTEGER,
                is_active BOOLEAN DEFAULT true,
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            )
        `);
        console.log('✓ تم إنشاء جدول sidebar_menu');

        // حذف البيانات القديمة إن وجدت
        await client.query('DELETE FROM sidebar_menu');
        console.log('✓ تم حذف البيانات القديمة');

        // إضافة عناصر القائمة الرئيسية
        const menuItems = [
            {
                title_ar: 'لوحة التحكم',
                title_en: 'Dashboard',
                icon: '📊',
                url: '/dashboard',
                display_order: 1
            },
            {
                title_ar: 'الموارد البشرية',
                title_en: 'HR',
                icon: '👥',
                url: '/hr',
                display_order: 2
            },
            {
                title_ar: 'الحسابات',
                title_en: 'Finance',
                icon: '💰',
                url: '/finance',
                display_order: 3
            },
            {
                title_ar: 'المبيعات',
                title_en: 'Sales',
                icon: '🛍️',
                url: '/sales',
                display_order: 4
            },
            {
                title_ar: 'المشتريات',
                title_en: 'Procurement',
                icon: '🛒',
                url: '/procurement',
                display_order: 5
            },
            {
                title_ar: 'التسويق',
                title_en: 'Marketing',
                icon: '📢',
                url: '/marketing',
                display_order: 6
            },
            {
                title_ar: 'سلسلة التوريد',
                title_en: 'Supply Chain',
                icon: '🚚',
                url: '/supply-chain',
                display_order: 7
            },
            {
                title_ar: 'السلامة',
                title_en: 'Safety',
                icon: '🛡️',
                url: '/safety',
                display_order: 8
            },
            {
                title_ar: 'المستودعات',
                title_en: 'Warehouse',
                icon: '📦',
                url: '/warehouse',
                display_order: 9
            },
            {
                title_ar: 'إعدادات الصفحة الرئيسية',
                title_en: 'Homepage Settings',
                icon: '⚙️',
                url: '/settings',
                display_order: 100
            }
        ];

        for (const item of menuItems) {
            await client.query(`
                INSERT INTO sidebar_menu (
                    title_ar, title_en, icon, url, display_order, is_active
                ) VALUES ($1, $2, $3, $4, $5, true)
            `, [item.title_ar, item.title_en, item.icon, item.url, item.display_order]);
        }

        console.log(`✓ تم إضافة ${menuItems.length} عنصر للقائمة الرئيسية`);

        // إضافة عنصر Super Admin (يظهر فقط لـ HQ001)
        await client.query(`
            INSERT INTO sidebar_menu (
                title_ar, 
                title_en, 
                icon, 
                url, 
                display_order,
                required_entity_id,
                min_hierarchy_level,
                is_active
            ) VALUES (
                'Super Admin',
                'Super Admin',
                '🔐',
                '/super-admin',
                999,
                'HQ001',
                0,
                true
            )
        `);

        console.log('✓ تم إضافة عنصر Super Admin (يظهر فقط لـ HQ001)');

        await client.query('COMMIT');

        // عرض النتيجة
        console.log('\n========== عناصر القائمة النهائية ==========\n');
        const result = await client.query(`
            SELECT 
                id,
                title_ar,
                icon,
                url,
                display_order,
                required_entity_id,
                min_hierarchy_level
            FROM sidebar_menu
            ORDER BY display_order
        `);

        result.rows.forEach(item => {
            const access = item.required_entity_id 
                ? `(فقط: ${item.required_entity_id})` 
                : '(الكل)';
            console.log(`  ${item.icon} ${item.title_ar.padEnd(20)} - ${item.url.padEnd(20)} ${access}`);
        });

        console.log(`\n✅ تم إنشاء ${result.rows.length} عنصر في القائمة الجانبية`);

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ خطأ:', error.message);
        throw error;
    } finally {
        client.release();
        await pool.end();
    }
}

createMenuSystem();
