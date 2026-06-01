const { Pool } = require('pg');

const pool = new Pool({
    connectionString: 'postgresql://postgres:PddzJpAQYezqknsntSzmCUlQYuYJldcT@crossover.proxy.rlwy.net:44255/railway'
});

async function checkUsers() {
    try {
        console.log('🔍 فحص جدول المستخدمين:\n');
        
        // فحص البنية
        const schema = await pool.query(`
            SELECT column_name, data_type
            FROM information_schema.columns
            WHERE table_name = 'users'
            ORDER BY ordinal_position
        `);
        
        console.log('أعمدة جدول users:');
        schema.rows.forEach(col => {
            console.log(`  - ${col.column_name} (${col.data_type})`);
        });
        
        // جلب عينة من المستخدمين
        console.log('\n📊 عينة من المستخدمين:');
        const users = await pool.query('SELECT id, name, email, entity_id FROM users LIMIT 10');
        
        users.rows.forEach(user => {
            console.log(`  ID: ${user.id} | ${user.name} | ${user.email} | ${user.entity_id || 'N/A'}`);
        });
        
        console.log(`\n📊 إجمالي المستخدمين: ${users.rows.length} (من أول 10)`);
        
    } catch (error) {
        console.error('❌ خطأ:', error.message);
    } finally {
        await pool.end();
    }
}

checkUsers();
