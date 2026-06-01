const { Pool } = require('pg');

const pool = new Pool({
    connectionString: 'postgresql://postgres:PddzJpAQYezqknsntSzmCUlQYuYJldcT@crossover.proxy.rlwy.net:44255/railway',
    ssl: false
});

async function checkRolePermissions() {
    try {
        console.log('📋 فحص جدول role_permissions...\n');
        
        // 1. فحص إذا كان الجدول موجود
        const tableExists = await pool.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_name = 'role_permissions'
            );
        `);
        
        if (!tableExists.rows[0].exists) {
            console.log('❌ جدول role_permissions غير موجود');
            return;
        }
        
        // 2. فحص الأعمدة
        const columnsResult = await pool.query(`
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns
            WHERE table_name = 'role_permissions'
            ORDER BY ordinal_position
        `);
        
        console.log('الأعمدة الموجودة:');
        columnsResult.rows.forEach(col => {
            console.log(`  - ${col.column_name} (${col.data_type})`);
        });
        
        // 3. عد السجلات
        const count = await pool.query('SELECT COUNT(*) FROM role_permissions');
        console.log(`\nعدد السجلات: ${count.rows[0].count}`);
        
        // 4. عينة من البيانات
        if (parseInt(count.rows[0].count) > 0) {
            const sample = await pool.query('SELECT * FROM role_permissions LIMIT 3');
            console.log('\nعينة من البيانات:');
            sample.rows.forEach((row, i) => {
                console.log(`\n${i + 1}.`);
                Object.keys(row).forEach(key => {
                    console.log(`   ${key}: ${row[key]}`);
                });
            });
        }
        
    } catch (error) {
        console.error('❌ خطأ:', error.message);
    } finally {
        await pool.end();
    }
}

checkRolePermissions();
