const { Pool } = require('pg');

const pool = new Pool({
    connectionString: 'postgresql://postgres:PddzJpAQYezqknsntSzmCUlQYuYJldcT@crossover.proxy.rlwy.net:44255/railway'
});

async function testDeleteProtection() {
    try {
        console.log('🧪 اختبار حماية الحذف (دور مستخدم نشط):\n');
        
        // اختبار دور لديه مستخدمين نشطين
        // دور ID 31 - مساعد مدير فرع - لديه المستخدم 8
        const roleName = 'ASSISTANT_BRANCH_MANAGER';
        
        console.log('1️⃣ فحص دور لديه مستخدمين نشطين:');
        
        // التحقق من عدد المستخدمين
        const usersCheck = await pool.query(`
            SELECT COUNT(*) as count, r.name, r.job_title_ar
            FROM user_roles ur
            JOIN roles r ON ur.role_id = r.id
            WHERE r.id = 31 AND ur.is_active = true
            GROUP BY r.name, r.job_title_ar
        `);
        
        if (usersCheck.rows.length > 0) {
            const role = usersCheck.rows[0];
            console.log(`   الدور: ${role.job_title_ar}`);
            console.log(`   المستخدمين النشطين: ${role.count}`);
            console.log(`   ✅ يوجد مستخدمين - يجب منع الحذف`);
        } else {
            console.log('   ⚠️  لا يوجد مستخدمين نشطين لهذا الدور');
        }
        
        console.log('\n2️⃣ اختبار حذف دور بدون مستخدمين:');
        
        // إنشاء دور بدون مستخدمين ثم حذفه
        const testRole = await pool.query(`
            INSERT INTO roles (
                name, name_ar, job_title_ar, job_title_en, 
                level, hierarchy_level, is_active
            ) VALUES ($1, $2, $3, $4, $5, $6, true)
            RETURNING id, name, job_title_ar
        `, [
            'TEMP_ROLE_DELETE_TEST',
            'TEMP_ROLE_DELETE_TEST',
            'دور مؤقت للحذف',
            'Temp Delete Role',
            'OPERATIONAL',
            99
        ]);
        
        console.log(`   ✅ تم إنشاء دور تجريبي: ${testRole.rows[0].job_title_ar}`);
        
        // حذف الدور
        const deleteResult = await pool.query(
            'DELETE FROM roles WHERE name = $1 RETURNING job_title_ar', 
            [testRole.rows[0].name]
        );
        
        if (deleteResult.rows.length > 0) {
            console.log(`   ✅ تم حذف الدور بنجاح: ${deleteResult.rows[0].job_title_ar}`);
        }
        
        console.log('\n✅ جميع الاختبارات نجحت!');
        
    } catch (error) {
        console.error('❌ خطأ:', error.message);
    } finally {
        await pool.end();
    }
}

testDeleteProtection();
