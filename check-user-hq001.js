/**
 * فحص المستخدم HQ001 والبنية الحالية
 */

const { Pool } = require('pg');

const pool = new Pool({
    connectionString: 'postgresql://postgres:PddzJpAQYezqknsntSzmCUlQYuYJldcT@crossover.proxy.rlwy.net:44255/railway',
    ssl: false
});

async function checkUserAndSystem() {
    try {
        console.log('========== فحص المستخدم HQ001 ==========\n');
        
        // البحث عن المستخدم HQ001
        const userResult = await pool.query(`
            SELECT * FROM users 
            WHERE name = 'HQ001' OR username = 'HQ001' OR email LIKE '%HQ001%'
        `);
        
        console.log('عدد النتائج:', userResult.rows.length);
        if (userResult.rows.length > 0) {
            console.log('بيانات المستخدم:');
            userResult.rows.forEach(user => {
                console.log({
                    id: user.id,
                    name: user.name,
                    username: user.username || 'N/A',
                    email: user.email,
                    role_id: user.role_id || 'N/A'
                });
            });
        } else {
            console.log('❌ المستخدم HQ001 غير موجود');
            
            // البحث عن أي مستخدم يبدأ بـ HQ
            const hqUsers = await pool.query(`
                SELECT * FROM users 
                WHERE name LIKE 'HQ%' 
                LIMIT 5
            `);
            
            if (hqUsers.rows.length > 0) {
                console.log('\nمستخدمين HQ موجودين:');
                hqUsers.rows.forEach(user => {
                    console.log(`  - ${user.name} (ID: ${user.id})`);
                });
            }
        }

        console.log('\n========== فحص جدول menu_items ==========\n');
        
        // التحقق من وجود جدول القائمة
        const menuTableCheck = await pool.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_name IN ('menu_items', 'sidebar_items', 'navigation_items')
        `);
        
        if (menuTableCheck.rows.length > 0) {
            console.log('جداول القائمة الموجودة:');
            menuTableCheck.rows.forEach(table => {
                console.log(`  - ${table.table_name}`);
            });
            
            // عرض محتوى الجدول
            for (const table of menuTableCheck.rows) {
                const items = await pool.query(`SELECT * FROM ${table.table_name} LIMIT 5`);
                console.log(`\nمحتوى ${table.table_name}:`, items.rows);
            }
        } else {
            console.log('❌ لا توجد جداول للقائمة الجانبية');
            
            // البحث عن جداول قد تحتوي على قائمة
            const allTables = await pool.query(`
                SELECT table_name 
                FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_type = 'BASE TABLE'
                ORDER BY table_name
            `);
            
            console.log('\nجميع الجداول المتاحة:');
            allTables.rows.forEach(table => {
                console.log(`  - ${table.table_name}`);
            });
        }

        console.log('\n========== فحص دور المستخدم ==========\n');
        
        if (userResult.rows.length > 0) {
            const userId = userResult.rows[0].id;
            
            const roleResult = await pool.query(`
                SELECT 
                    u.id as user_id,
                    u.name as user_name,
                    r.id as role_id,
                    r.name as role_name,
                    r.job_title_ar,
                    r.hierarchy_level
                FROM users u
                LEFT JOIN user_roles ur ON u.id = ur.user_id AND ur.is_active = true
                LEFT JOIN roles r ON ur.role_id = r.id
                WHERE u.id = $1
            `, [userId]);
            
            if (roleResult.rows.length > 0) {
                console.log('دور المستخدم:', roleResult.rows[0]);
            } else {
                console.log('❌ المستخدم ليس له دور معين');
            }
        }

    } catch (error) {
        console.error('خطأ:', error.message);
    } finally {
        await pool.end();
    }
}

checkUserAndSystem();
