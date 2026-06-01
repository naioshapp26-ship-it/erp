const { Pool } = require('pg');

const pool = new Pool({
    connectionString: 'postgresql://postgres:PddzJpAQYezqknsntSzmCUlQYuYJldcT@crossover.proxy.rlwy.net:44255/railway',
    ssl: { rejectUnauthorized: false }
});

async function checkCurrentMenu() {
    const client = await pool.connect();
    
    try {
        console.log('🔍 فحص القائمة الجانبية الحالية...\n');
        
        // 1. التحقق من وجود جدول sidebar_menu
        console.log('1️⃣ التحقق من جدول sidebar_menu:');
        const tableCheck = await client.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_name = 'sidebar_menu'
            )
        `);
        
        if (!tableCheck.rows[0].exists) {
            console.log('❌ جدول sidebar_menu غير موجود!');
            console.log('💡 سيتم إنشاؤه الآن...');
            return;
        }
        
        console.log('✅ جدول sidebar_menu موجود\n');
        
        // 2. عرض جميع عناصر القائمة
        console.log('2️⃣ عناصر القائمة الحالية:');
        const menuResult = await client.query(`
            SELECT id, title_ar, title_en, icon, url, 
                   display_order, required_entity_id, is_active
            FROM sidebar_menu
            ORDER BY display_order
        `);
        
        console.log(`✅ عدد العناصر: ${menuResult.rows.length}\n`);
        
        menuResult.rows.forEach(item => {
            const access = item.required_entity_id ? `(${item.required_entity_id} فقط)` : '(الكل)';
            const status = item.is_active ? '✅' : '❌';
            console.log(`${status} ${item.display_order}. ${item.icon} ${item.title_ar} ${access}`);
            console.log(`   URL: ${item.url}`);
            if (!item.is_active) console.log('   ⚠️ غير نشط!');
            console.log('');
        });
        
        // 3. التحقق من عنصر Super Admin
        console.log('3️⃣ عنصر Super Admin:');
        const superAdminResult = await client.query(`
            SELECT * FROM sidebar_menu
            WHERE title_ar LIKE '%Super%' OR title_ar LIKE '%سوبر%' 
               OR title_ar LIKE '%إدارة%' OR url LIKE '%super%'
        `);
        
        if (superAdminResult.rows.length === 0) {
            console.log('❌ عنصر Super Admin غير موجود!');
            console.log('💡 سيتم إضافته...');
        } else {
            console.log('✅ عنصر Super Admin موجود:');
            superAdminResult.rows.forEach(item => {
                console.log({
                    title: item.title_ar,
                    url: item.url,
                    icon: item.icon,
                    order: item.display_order,
                    access: item.required_entity_id || 'الكل',
                    active: item.is_active
                });
            });
        }
        
        // 4. معاينة القائمة لـ HQ001
        console.log('\n4️⃣ القائمة كما ستظهر لـ HQ001:');
        const hq001Menu = await client.query(`
            SELECT title_ar, icon, url
            FROM sidebar_menu
            WHERE is_active = true
            AND (required_entity_id IS NULL OR required_entity_id = 'HQ001')
            ORDER BY display_order
        `);
        
        console.log('═══════════════════════════════════════');
        hq001Menu.rows.forEach((item, index) => {
            console.log(`${index + 1}. ${item.icon} ${item.title_ar}`);
        });
        console.log('═══════════════════════════════════════');
        
        // 5. معاينة القائمة لمستخدم عادي
        console.log('\n5️⃣ القائمة كما ستظهر لمستخدم عادي (BR015):');
        const regularMenu = await client.query(`
            SELECT title_ar, icon, url
            FROM sidebar_menu
            WHERE is_active = true
            AND (required_entity_id IS NULL)
            ORDER BY display_order
        `);
        
        console.log('═══════════════════════════════════════');
        regularMenu.rows.forEach((item, index) => {
            console.log(`${index + 1}. ${item.icon} ${item.title_ar}`);
        });
        console.log('═══════════════════════════════════════');
        
        console.log('\n✅ اكتمل الفحص!');
        
    } catch (error) {
        console.error('❌ خطأ:', error.message);
        throw error;
    } finally {
        client.release();
        await pool.end();
    }
}

checkCurrentMenu().catch(console.error);
