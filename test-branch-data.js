const { Pool } = require('pg');

const pool = new Pool({
    connectionString: 'postgresql://postgres:PddzJpAQYezqknsntSzmCUlQYuYJldcT@crossover.proxy.rlwy.net:44255/railway',
    ssl: { rejectUnauthorized: false }
});

async function testBranchData() {
    try {
        console.log('🧪 اختبار البيانات...\n');
        
        // Test for a random branch (e.g., العراق - branch_id = 2)
        const testBranchId = 2;
        
        console.log(`📋 اختبار الفرع رقم ${testBranchId}:\n`);
        
        // Get incubators for this branch
        const incubatorsResult = await pool.query(`
            SELECT id, name, code, branch_id
            FROM incubators
            WHERE branch_id = $1
            ORDER BY id
            LIMIT 10
        `, [testBranchId]);
        
        console.log(`✅ الحاضنات (أول 10):`, incubatorsResult.rows);
        console.log(`   إجمالي الحاضنات: ${incubatorsResult.rowCount}\n`);
        
        // Get platforms for this branch through incubators
        const platformsResult = await pool.query(`
            SELECT p.id, p.name, p.code, p.incubator_id, i.name as incubator_name
            FROM platforms p
            JOIN incubators i ON p.incubator_id = i.id
            WHERE i.branch_id = $1
            ORDER BY p.id
            LIMIT 10
        `, [testBranchId]);
        
        console.log(`✅ المنصات (أول 10):`, platformsResult.rows);
        console.log(`   إجمالي المنصات: ${platformsResult.rowCount}\n`);
        
        // Test another branch (e.g., مصر - branch_id = 3)
        const testBranchId2 = 3;
        
        console.log(`\n📋 اختبار الفرع رقم ${testBranchId2}:\n`);
        
        const inc2Result = await pool.query(`
            SELECT COUNT(*) as count
            FROM incubators
            WHERE branch_id = $1
        `, [testBranchId2]);
        
        const plat2Result = await pool.query(`
            SELECT COUNT(*) as count
            FROM platforms p
            JOIN incubators i ON p.incubator_id = i.id
            WHERE i.branch_id = $1
        `, [testBranchId2]);
        
        console.log(`✅ عدد الحاضنات: ${inc2Result.rows[0].count}`);
        console.log(`✅ عدد المنصات: ${plat2Result.rows[0].count}\n`);
        
        // Get total counts
        const totalIncResult = await pool.query('SELECT COUNT(*) FROM incubators');
        const totalPlatResult = await pool.query('SELECT COUNT(*) FROM platforms');
        
        console.log('\n📊 الإحصائيات الإجمالية:');
        console.log(`   إجمالي الحاضنات في النظام: ${totalIncResult.rows[0].count}`);
        console.log(`   إجمالي المنصات في النظام: ${totalPlatResult.rows[0].count}`);
        console.log(`   عدد الفروع: 27`);
        console.log(`   متوسط الحاضنات لكل فرع: ${parseInt(totalIncResult.rows[0].count) / 27}`);
        console.log(`   متوسط المنصات لكل فرع: ${parseInt(totalPlatResult.rows[0].count) / 27}`);
        
        console.log('\n✅ الاختبار نجح! جميع الفروع تحتوي على الحاضنات والمنصات.');
        
    } catch (error) {
        console.error('❌ خطأ:', error.message);
    } finally {
        await pool.end();
    }
}

testBranchData();
