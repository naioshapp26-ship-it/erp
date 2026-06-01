/**
 * فحص جدول systems
 */

const { Pool } = require('pg');

const pool = new Pool({
    connectionString: 'postgresql://postgres:PddzJpAQYezqknsntSzmCUlQYuYJldcT@crossover.proxy.rlwy.net:44255/railway',
    ssl: false
});

async function checkSystemsTable() {
    try {
        // فحص وجود الجدول
        const tableCheck = await pool.query(`
            SELECT COUNT(*) as count FROM information_schema.tables 
            WHERE table_name = 'systems'
        `);
        
        if (parseInt(tableCheck.rows[0].count) === 0) {
            console.log('❌ جدول systems غير موجود!');
            return;
        }
        
        console.log('✅ جدول systems موجود\n');
        
        // فحص الأعمدة
        const columnsResult = await pool.query(`
            SELECT column_name, data_type
            FROM information_schema.columns
            WHERE table_name = 'systems'
            ORDER BY ordinal_position
        `);
        
        console.log('الأعمدة:');
        columnsResult.rows.forEach(col => {
            console.log(`  - ${col.column_name} (${col.data_type})`);
        });
        
        // جلب البيانات
        const dataResult = await pool.query('SELECT * FROM systems LIMIT 5');
        console.log(`\nعدد الأنظمة: ${dataResult.rows.length}`);
        console.log('\nالبيانات:');
        dataResult.rows.forEach((sys, i) => {
            console.log(`\n${i + 1}.`);
            Object.keys(sys).forEach(key => {
                console.log(`   ${key}: ${sys[key]}`);
            });
        });
        
    } catch (error) {
        console.error('❌ خطأ:', error.message);
    } finally {
        await pool.end();
    }
}

checkSystemsTable();
