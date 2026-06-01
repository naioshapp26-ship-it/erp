const { Pool } = require('pg');

const pool = new Pool({
    connectionString: 'postgresql://postgres:PddzJpAQYezqknsntSzmCUlQYuYJldcT@crossover.proxy.rlwy.net:44255/railway',
    ssl: { rejectUnauthorized: false }
});

async function testAPIQueries() {
    try {
        console.log('🧪 اختبار استعلامات API...\n');
        
        const branchId = 2; // Test with العراق
        
        // Test incubators query for branch
        console.log(`📋 اختبار الحاضنات للفرع ${branchId}:\n`);
        
        const incubatorsResult = await pool.query(`
            SELECT i.*, 
                   b.name as branch_name, b.code as branch_code
            FROM incubators i
            LEFT JOIN branches b ON i.branch_id = b.id
            WHERE i.branch_id = $1 AND i.is_active = true
            ORDER BY i.name
            LIMIT 5
        `, [branchId]);
        
        console.log(`✅ عدد الحاضنات: ${incubatorsResult.rowCount}`);
        console.log('   أول 5 حاضنات:', incubatorsResult.rows.map(r => ({ id: r.id, name: r.name, code: r.code })));
        
        // Test platforms query for branch
        console.log(`\n📋 اختبار المنصات للفرع ${branchId}:\n`);
        
        const platformsResult = await pool.query(`
            SELECT 
              p.*
            FROM platforms p
            JOIN incubators i ON p.incubator_id = i.id
            WHERE i.branch_id = $1 AND p.is_active = true
            ORDER BY p.name
            LIMIT 5
        `, [branchId]);
        
        console.log(`✅ عدد المنصات: ${platformsResult.rowCount}`);
        console.log('   أول 5 منصات:', platformsResult.rows.map(r => ({ id: r.id, name: r.name, code: r.code })));
        
        console.log('\n✅ جميع الاستعلامات تعمل بشكل صحيح!');
        
    } catch (error) {
        console.error('❌ خطأ:', error.message);
        console.error(error.stack);
    } finally {
        await pool.end();
    }
}

testAPIQueries();
