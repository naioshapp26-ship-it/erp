const { Pool } = require('pg');

const pool = new Pool({
    connectionString: 'postgresql://postgres:PddzJpAQYezqknsntSzmCUlQYuYJldcT@crossover.proxy.rlwy.net:44255/railway',
    ssl: false
});

async function checkSchema() {
    const client = await pool.connect();
    
    try {
        console.log('\n📊 فحص بنية جدول roles...\n');
        
        const result = await client.query(`
            SELECT column_name, data_type, character_maximum_length, is_nullable, column_default
            FROM information_schema.columns
            WHERE table_name = 'roles'
            ORDER BY ordinal_position
        `);
        
        console.table(result.rows);
        
    } catch (error) {
        console.error('❌ خطأ:', error.message);
    } finally {
        client.release();
        await pool.end();
    }
}

checkSchema();
