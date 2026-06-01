const { Pool } = require('pg');

const pool = new Pool({
    connectionString: 'postgresql://postgres:PddzJpAQYezqknsntSzmCUlQYuYJldcT@crossover.proxy.rlwy.net:44255/railway'
});

async function checkRoles() {
    try {
        console.log('🔍 فحص أعمدة جدول roles:\n');
        
        const result = await pool.query(`
            SELECT column_name, data_type
            FROM information_schema.columns
            WHERE table_name = 'roles'
            ORDER BY ordinal_position
        `);
        
        console.log('الأعمدة:');
        result.rows.forEach(col => {
            console.log(`  - ${col.column_name} (${col.data_type})`);
        });
        
    } catch (error) {
        console.error('❌ خطأ:', error.message);
    } finally {
        await pool.end();
    }
}

checkRoles();
