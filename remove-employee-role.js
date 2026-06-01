const { Pool } = require('pg');

const pool = new Pool({
    connectionString: 'postgresql://postgres:PddzJpAQYezqknsntSzmCUlQYuYJldcT@crossover.proxy.rlwy.net:44255/railway',
    ssl: false
});

async function removeEmployee() {
    const client = await pool.connect();
    
    try {
        console.log('\n🗑️ حذف دور EMPLOYEE...\n');
        
        // حذف العلاقات أولاً
        await client.query(`DELETE FROM role_system_permissions WHERE role_id = (SELECT id FROM roles WHERE name = 'EMPLOYEE')`);
        await client.query(`DELETE FROM user_roles WHERE role_id = (SELECT id FROM roles WHERE name = 'EMPLOYEE')`);
        
        // حذف الدور
        const result = await client.query(`DELETE FROM roles WHERE name = 'EMPLOYEE' RETURNING id`);
        
        if (result.rowCount > 0) {
            console.log(`✅ تم حذف دور EMPLOYEE (ID: ${result.rows[0].id})`);
        } else {
            console.log('⚠️ لم يتم العثور على دور EMPLOYEE');
        }
        
        // التحقق من العدد
        const countResult = await client.query(`SELECT COUNT(*) as count FROM roles`);
        console.log(`\n📊 عدد الأدوار الحالي: ${countResult.rows[0].count}`);
        
        if (countResult.rows[0].count === '33') {
            console.log('🎉 ممتاز! الآن لدينا 33 دور بالضبط ✅\n');
        } else {
            console.log(`⚠️ العدد: ${countResult.rows[0].count} (يجب أن يكون 33)\n`);
        }
        
    } catch (error) {
        console.error('❌ خطأ:', error.message);
    } finally {
        client.release();
        await pool.end();
    }
}

removeEmployee();
