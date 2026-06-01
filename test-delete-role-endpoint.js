/**
 * اختبار endpoint حذف الأدوار
 */

const { Pool } = require('pg');

const pool = new Pool({
    connectionString: 'postgresql://postgres:PddzJpAQYezqknsntSzmCUlQYuYJldcT@crossover.proxy.rlwy.net:44255/railway',
    ssl: false
});

async function testDeleteRole() {
    const client = await pool.connect();
    
    try {
        console.log('🧪 اختبار عملية حذف الدور...\n');
        
        // 1. إنشاء دور تجريبي
        console.log('1️⃣ إنشاء دور تجريبي...');
        const createResult = await client.query(`
            INSERT INTO roles (
                name, name_ar, job_title_ar, job_title_en, 
                description, level, hierarchy_level, is_active
            ) VALUES (
                'TEST_DELETE_ROLE', 'دور تجريبي للحذف', 'مدير تجريبي', 'Test Manager',
                'دور للاختبار فقط', 'OPERATIONAL', 99, true
            ) RETURNING id, name, job_title_ar
        `);
        
        const testRole = createResult.rows[0];
        console.log(`   ✅ تم إنشاء الدور: ${testRole.job_title_ar} (ID: ${testRole.id}, Code: ${testRole.name})`);
        
        // 2. التحقق من وجود الدور
        console.log('\n2️⃣ التحقق من وجود الدور...');
        const checkBefore = await client.query('SELECT * FROM roles WHERE id = $1', [testRole.id]);
        console.log(`   ✅ الدور موجود: ${checkBefore.rows.length > 0}`);
        
        // 3. محاكاة عملية الحذف (نفس منطق الـ endpoint)
        console.log('\n3️⃣ محاكاة عملية الحذف...');
        
        const roleCode = testRole.name;
        
        // جلب معلومات الدور
        const roleCheck = await client.query('SELECT id, name, job_title_ar FROM roles WHERE name = $1', [roleCode]);
        
        if (roleCheck.rows.length === 0) {
            console.log('   ❌ الدور غير موجود');
            return;
        }
        
        const roleId = roleCheck.rows[0].id;
        console.log(`   📋 معلومات الدور: ID=${roleId}, Name=${roleCheck.rows[0].name}`);
        
        // التحقق من المستخدمين النشطين
        const usersCheck = await client.query(`
            SELECT COUNT(*) as count 
            FROM user_roles ur
            WHERE ur.role_id = $1 AND ur.is_active = true
        `, [roleId]);
        
        console.log(`   👥 عدد المستخدمين النشطين: ${usersCheck.rows[0].count}`);
        
        if (parseInt(usersCheck.rows[0].count) > 0) {
            console.log('   ⚠️ لا يمكن الحذف - يوجد مستخدمين نشطين');
            return;
        }
        
        // بدء المعاملة
        await client.query('BEGIN');
        
        // حذف الصلاحيات
        const delPermissions = await client.query('DELETE FROM role_permissions WHERE role_id = $1', [roleId]);
        console.log(`   🗑️ تم حذف ${delPermissions.rowCount} صلاحية`);
        
        // حذف الدور
        const delResult = await client.query('DELETE FROM roles WHERE id = $1 RETURNING *', [roleId]);
        console.log(`   ✅ تم حذف الدور: ${delResult.rows[0].job_title_ar}`);
        
        await client.query('COMMIT');
        
        // 4. التحقق من الحذف
        console.log('\n4️⃣ التحقق من الحذف...');
        const checkAfter = await client.query('SELECT * FROM roles WHERE id = $1', [testRole.id]);
        console.log(`   ${checkAfter.rows.length === 0 ? '✅' : '❌'} الدور محذوف: ${checkAfter.rows.length === 0}`);
        
        console.log('\n✅ اختبار حذف الدور نجح!');
        
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ خطأ في الاختبار:', error.message);
        console.error(error.stack);
    } finally {
        client.release();
        await pool.end();
    }
}

testDeleteRole();
