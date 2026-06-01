const { Pool } = require('pg');

const pool = new Pool({
    connectionString: 'postgresql://postgres:PddzJpAQYezqknsntSzmCUlQYuYJldcT@crossover.proxy.rlwy.net:44255/railway',
    ssl: false
});

async function checkSuperAdmin() {
    const client = await pool.connect();
    
    try {
        const result = await client.query(`
            SELECT id, name, name_ar, job_title_ar, hierarchy_level, max_approval_limit
            FROM roles
            WHERE name = 'SUPER_ADMIN'
            ORDER BY id
        `);
        
        console.log('\n🔍 فحص SUPER_ADMIN:\n');
        console.log(`عدد النسخ: ${result.rows.length}\n`);
        
        result.rows.forEach(role => {
            console.log(`ID: ${role.id}`);
            console.log(`Name: ${role.name}`);
            console.log(`Name AR: ${role.name_ar}`);
            console.log(`Job Title AR: ${role.job_title_ar}`);
            console.log(`Hierarchy Level: ${role.hierarchy_level}`);
            console.log(`Max Approval: ${role.max_approval_limit === null ? 'غير محدود' : role.max_approval_limit}`);
            console.log('---');
        });
        
        // يجب أن يكون هناك نسخة واحدة فقط
        if (result.rows.length === 1) {
            console.log('✅ يوجد SUPER_ADMIN واحد فقط\n');
        } else if (result.rows.length > 1) {
            console.log('⚠️ يوجد أكثر من SUPER_ADMIN واحد\n');
        } else {
            console.log('❌ لا يوجد SUPER_ADMIN\n');
        }
        
    } catch (error) {
        console.error('❌ خطأ:', error.message);
    } finally {
        client.release();
        await pool.end();
    }
}

checkSuperAdmin();
