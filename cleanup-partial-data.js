const { Pool } = require('pg');

const pool = new Pool({
    connectionString: 'postgresql://postgres:PddzJpAQYezqknsntSzmCUlQYuYJldcT@crossover.proxy.rlwy.net:44255/railway',
    ssl: { rejectUnauthorized: false }
});

async function cleanupPartialData() {
    try {
        console.log('🧹 حذف البيانات الجزئية...\n');
        
        // Delete incubators from branches other than branch 1
        const deleteResult = await pool.query(`
            DELETE FROM incubators WHERE branch_id != 1
        `);
        
        console.log(`✅ تم حذف ${deleteResult.rowCount} حاضنة من الفروع الأخرى`);
        
        // Verify
        const verifyResult = await pool.query(`
            SELECT branch_id, COUNT(*) as count
            FROM incubators
            GROUP BY branch_id
            ORDER BY branch_id
        `);
        
        console.log('\n📊 الحاضنات المتبقية:', verifyResult.rows);
        
    } catch (error) {
        console.error('❌ خطأ:', error.message);
    } finally {
        await pool.end();
    }
}

cleanupPartialData();
