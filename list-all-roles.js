const { Pool } = require('pg');

const pool = new Pool({
    connectionString: 'postgresql://postgres:PddzJpAQYezqknsntSzmCUlQYuYJldcT@crossover.proxy.rlwy.net:44255/railway',
    ssl: false
});

async function listAllRoles() {
    const client = await pool.connect();
    
    try {
        const result = await client.query(`
            SELECT id, name, name_ar, job_title_ar, hierarchy_level
            FROM roles
            ORDER BY hierarchy_level, id
        `);
        
        console.log('\n📋 جميع الأدوار المتبقية (' + result.rows.length + '):\n');
        
        result.rows.forEach((role, index) => {
            console.log(`${index + 1}. ID: ${role.id} | ${role.name} | ${role.job_title_ar || role.name_ar || 'لا يوجد'}`);
        });
        
    } catch (error) {
        console.error('❌ خطأ:', error.message);
    } finally {
        client.release();
        await pool.end();
    }
}

listAllRoles();
