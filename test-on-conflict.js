const { Pool } = require('pg');
const pool = new Pool({
    connectionString: 'postgresql://postgres:PddzJpAQYezqknsntSzmCUlQYuYJldcT@crossover.proxy.rlwy.net:44255/railway',
    ssl: false
});

async function testOnConflict() {
    try {
        console.log('🧪 اختبار ON CONFLICT مع entity_id = NULL...\n');
        
        const userId = 8;
        const roleId = 114; // FINANCIAL_MANAGER_HQ
        
        console.log('1️⃣  محاولة الإضافة الأولى (entity_id = NULL)...');
        const result1 = await pool.query(`
            INSERT INTO user_roles (user_id, role_id, entity_id, is_active, granted_at)
            VALUES ($1, $2, NULL, true, NOW())
            ON CONFLICT (user_id, role_id, entity_id) 
            DO UPDATE SET is_active = true, granted_at = NOW()
            RETURNING *
        `, [userId, roleId]);
        console.log('   ✅ نجح - ID:', result1.rows[0].id);
        
        console.log('\n2️⃣  محاولة الإضافة الثانية (نفس البيانات)...');
        const result2 = await pool.query(`
            INSERT INTO user_roles (user_id, role_id, entity_id, is_active, granted_at)
            VALUES ($1, $2, NULL, true, NOW())
            ON CONFLICT (user_id, role_id, entity_id) 
            DO UPDATE SET is_active = true, granted_at = NOW()
            RETURNING *
        `, [userId, roleId]);
        console.log('   ✅ نجح - ID:', result2.rows[0].id);
        
        if (result1.rows[0].id === result2.rows[0].id) {
            console.log('\n✅ ON CONFLICT يعمل - تم التحديث بنفس السجل');
        } else {
            console.log('\n❌ ON CONFLICT لا يعمل - تم إنشاء سجل جديد!');
            console.log('   ID الأول:', result1.rows[0].id);
            console.log('   ID الثاني:', result2.rows[0].id);
        }
        
        // تنظيف
        await pool.query('DELETE FROM user_roles WHERE user_id = $1 AND role_id = $2', [userId, roleId]);
        
    } catch (error) {
        console.error('\n❌ خطأ:', error.message);
        console.error('الكود:', error.code);
    } finally {
        await pool.end();
    }
}

testOnConflict();
