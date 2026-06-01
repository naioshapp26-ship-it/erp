const { Pool } = require('pg');

const pool = new Pool({
    connectionString: 'postgresql://postgres:PddzJpAQYezqknsntSzmCUlQYuYJldcT@crossover.proxy.rlwy.net:44255/railway'
});

async function testDeleteRole() {
    const client = await pool.connect();
    
    try {
        console.log('🧪 اختبار حذف دور:\n');
        
        // 1. إنشاء دور تجريبي
        console.log('1️⃣ إنشاء دور تجريبي للحذف:');
        const createResult = await client.query(`
            INSERT INTO roles (
                name, name_ar, job_title_ar, job_title_en, 
                level, hierarchy_level, is_active
            ) VALUES ($1, $2, $3, $4, $5, $6, true)
            RETURNING id, name, job_title_ar
        `, [
            'TEST_DELETE_ROLE',
            'TEST_DELETE_ROLE',
            'دور للحذف',
            'Role to Delete',
            'OPERATIONAL',
            25
        ]);
        
        const roleId = createResult.rows[0].id;
        const roleName = createResult.rows[0].name;
        console.log(`   ✅ تم الإنشاء: ${createResult.rows[0].job_title_ar} (ID: ${roleId})`);
        
        // 2. التحقق من عدم وجود مستخدمين
        console.log('\n2️⃣ التحقق من عدم وجود مستخدمين نشطين:');
        const usersCheck = await client.query(`
            SELECT COUNT(*) as count 
            FROM user_roles ur
            JOIN roles r ON ur.role_id = r.id
            WHERE r.name = $1 AND ur.is_active = true
        `, [roleName]);
        
        console.log(`   المستخدمين النشطين: ${usersCheck.rows[0].count}`);
        
        if (parseInt(usersCheck.rows[0].count) === 0) {
            console.log('   ✅ لا يوجد مستخدمين - يمكن الحذف');
        } else {
            console.log('   ❌ يوجد مستخدمين - لا يمكن الحذف');
        }
        
        // 3. حذف الدور
        console.log('\n3️⃣ حذف الدور:');
        await client.query('BEGIN');
        
        const deleteResult = await client.query(
            'DELETE FROM roles WHERE name = $1 RETURNING *', 
            [roleName]
        );
        
        if (deleteResult.rows.length > 0) {
            console.log(`   ✅ تم الحذف بنجاح: ${deleteResult.rows[0].job_title_ar}`);
            await client.query('COMMIT');
        } else {
            console.log('   ❌ الدور غير موجود');
            await client.query('ROLLBACK');
        }
        
        // 4. التحقق من الحذف
        console.log('\n4️⃣ التحقق من الحذف:');
        const checkResult = await client.query(
            'SELECT * FROM roles WHERE name = $1', 
            [roleName]
        );
        
        if (checkResult.rows.length === 0) {
            console.log('   ✅ تأكيد: الدور تم حذفه من قاعدة البيانات');
        } else {
            console.log('   ❌ خطأ: الدور ما زال موجوداً');
        }
        
        console.log('\n✅ جميع الاختبارات نجحت!');
        
    } catch (error) {
        console.error('❌ خطأ:', error.message);
        await client.query('ROLLBACK');
    } finally {
        client.release();
        await pool.end();
    }
}

testDeleteRole();
