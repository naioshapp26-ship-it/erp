const { Pool } = require('pg');

const pool = new Pool({
    connectionString: 'postgresql://postgres:PddzJpAQYezqknsntSzmCUlQYuYJldcT@crossover.proxy.rlwy.net:44255/railway',
    ssl: { rejectUnauthorized: false }
});

async function checkPlatformsStructure() {
    try {
        console.log('🔍 فحص بنية جدول المنصات...\n');
        
        // Check platforms table structure
        const columnsResult = await pool.query(`
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns
            WHERE table_name = 'platforms'
            ORDER BY ordinal_position
        `);
        console.log('📋 أعمدة جدول platforms:', columnsResult.rows);
        
        // Check platforms count
        const countResult = await pool.query('SELECT COUNT(*) FROM platforms');
        console.log(`\n📊 إجمالي المنصات: ${countResult.rows[0].count}\n`);
        
        // Check some platforms
        const platformsResult = await pool.query(`
            SELECT id, name, code, incubator_id
            FROM platforms
            LIMIT 10
        `);
        console.log('💻 أول 10 منصات:', platformsResult.rows);
        
        // Check incubators table structure
        const incColumnsResult = await pool.query(`
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns
            WHERE table_name = 'incubators'
            ORDER BY ordinal_position
        `);
        console.log('\n📋 أعمدة جدول incubators:', incColumnsResult.rows);
        
    } catch (error) {
        console.error('❌ خطأ:', error.message);
    } finally {
        await pool.end();
    }
}

checkPlatformsStructure();
