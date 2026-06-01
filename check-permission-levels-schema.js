const { Pool } = require('pg');

const pool = new Pool({
    connectionString: 'postgresql://postgres:PddzJpAQYezqknsntSzmCUlQYuYJldcT@crossover.proxy.rlwy.net:44255/railway'
});

async function checkSchema() {
    try {
        console.log('🔍 فحص بنية جدول permission_levels:\n');
        
        const result = await pool.query(`
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns
            WHERE table_name = 'permission_levels'
            ORDER BY ordinal_position
        `);
        
        console.log('الأعمدة الموجودة:');
        result.rows.forEach(col => {
            console.log(`  - ${col.column_name} (${col.data_type}) ${col.is_nullable === 'NO' ? 'NOT NULL' : ''}`);
        });
        
        console.log('\n📊 بيانات العينة:');
        const data = await pool.query('SELECT * FROM permission_levels LIMIT 3');
        console.log(JSON.stringify(data.rows, null, 2));
        
    } catch (error) {
        console.error('❌ خطأ:', error.message);
    } finally {
        await pool.end();
    }
}

checkSchema();
