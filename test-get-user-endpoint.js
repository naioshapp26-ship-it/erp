const { Pool } = require('pg');

const pool = new Pool({
    connectionString: 'postgresql://postgres:PddzJpAQYezqknsntSzmCUlQYuYJldcT@crossover.proxy.rlwy.net:44255/railway'
});

async function testGetUser() {
    try {
        console.log('🧪 اختبار جلب معلومات المستخدم:\n');
        
        const userId = 8; // كريم التسويق
        
        // جلب معلومات المستخدم
        const userResult = await pool.query(`
            SELECT id, name, email, entity_id, entity_name, is_active
            FROM users
            WHERE id = $1
        `, [userId]);

        if (userResult.rows.length === 0) {
            console.log('❌ المستخدم غير موجود');
            return;
        }

        const user = userResult.rows[0];
        console.log('✅ معلومات المستخدم:');
        console.log(`   ID: ${user.id}`);
        console.log(`   الاسم: ${user.name}`);
        console.log(`   البريد: ${user.email}`);
        console.log(`   الجهة: ${user.entity_name} (${user.entity_id})`);
        console.log(`   الحالة: ${user.is_active ? 'نشط' : 'غير نشط'}`);

        // جلب الدور الحالي
        const roleResult = await pool.query(`
            SELECT r.id as role_id, r.name_ar as role_name, ur.is_active
            FROM user_roles ur
            JOIN roles r ON ur.role_id = r.id
            WHERE ur.user_id = $1 AND ur.is_active = true
            LIMIT 1
        `, [userId]);

        console.log('\n✅ الدور الحالي:');
        if (roleResult.rows.length > 0) {
            const role = roleResult.rows[0];
            console.log(`   ${role.role_name} (${role.role_id})`);
            console.log(`   نشط: ${role.is_active}`);
        } else {
            console.log('   ❌ لا يوجد دور مُعيّن');
        }

        console.log('\n✅ الاختبار نجح!');
        
    } catch (error) {
        console.error('❌ خطأ:', error.message);
    } finally {
        await pool.end();
    }
}

testGetUser();
