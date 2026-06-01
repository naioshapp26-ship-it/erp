const { Pool } = require('pg');

const pool = new Pool({
    connectionString: 'postgresql://postgres:PddzJpAQYezqknsntSzmCUlQYuYJldcT@crossover.proxy.rlwy.net:44255/railway',
    ssl: { rejectUnauthorized: false }
});

async function checkCurrentStructure() {
    try {
        console.log('🔍 فحص البنية الحالية للبيانات...\n');
        
        // Check branches
        const branchesResult = await pool.query('SELECT id, name, code FROM branches ORDER BY id');
        console.log('📋 الفروع:', branchesResult.rows);
        console.log(`   عدد الفروع: ${branchesResult.rowCount}\n`);
        
        // Check incubators with branch relationship
        const incubatorsResult = await pool.query(`
            SELECT i.id, i.name, i.code, i.branch_id, b.name as branch_name
            FROM incubators i
            LEFT JOIN branches b ON i.branch_id = b.id
            ORDER BY i.branch_id, i.id
            LIMIT 20
        `);
        console.log('🏢 أول 20 حاضنة:', incubatorsResult.rows);
        console.log(`   إجمالي الحاضنات: ${incubatorsResult.rowCount}\n`);
        
        // Check platforms with branch relationship
        const platformsResult = await pool.query(`
            SELECT p.id, p.name, p.code, p.branch_id, b.name as branch_name
            FROM platforms p
            LEFT JOIN branches b ON p.branch_id = b.id
            ORDER BY p.branch_id, p.id
            LIMIT 20
        `);
        console.log('💻 أول 20 منصة:', platformsResult.rows);
        console.log(`   إجمالي المنصات: ${platformsResult.rowCount}\n`);
        
        // Check if there's a junction table
        const tablesResult = await pool.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name LIKE '%branch%' 
            OR table_name LIKE '%incubator%' 
            OR table_name LIKE '%platform%'
        `);
        console.log('📊 الجداول المرتبطة:', tablesResult.rows.map(r => r.table_name));
        
        // Check incubators per branch
        const incPerBranchResult = await pool.query(`
            SELECT branch_id, COUNT(*) as count
            FROM incubators
            GROUP BY branch_id
            ORDER BY branch_id
        `);
        console.log('\n📈 عدد الحاضنات لكل فرع:', incPerBranchResult.rows);
        
        // Check platforms per branch
        const platPerBranchResult = await pool.query(`
            SELECT branch_id, COUNT(*) as count
            FROM platforms
            GROUP BY branch_id
            ORDER BY branch_id
        `);
        console.log('📈 عدد المنصات لكل فرع:', platPerBranchResult.rows);
        
    } catch (error) {
        console.error('❌ خطأ:', error.message);
    } finally {
        await pool.end();
    }
}

checkCurrentStructure();
