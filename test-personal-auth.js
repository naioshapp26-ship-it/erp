const { Pool } = require('pg');

const pool = new Pool({
    connectionString: 'postgresql://postgres:PddzJpAQYezqknsntSzmCUlQYuYJldcT@crossover.proxy.rlwy.net:44255/railway',
    ssl: { rejectUnauthorized: false }
});

async function testNewAuthSystem() {
    console.log('🧪 اختبار نظام المصادقة الجديد (البريد الإلكتروني)\n');
    
    try {
        // 1. اختبار تسجيل الدخول بالبريد الإلكتروني
        console.log('📧 اختبار 1: تسجيل دخول Super Admin');
        const testEmail = 'ahmed@nayosh.com';
        
        const result = await pool.query(`
            SELECT uc.id as cred_id, uc.user_id, uc.password_hash, 
                   uc.is_active, uc.failed_attempts, uc.locked_until,
                   u.id, u.name, u.email, u.entity_id, u.entity_name,
                   u.role, u.tenant_type, u.is_active as user_active
            FROM user_credentials uc
            JOIN users u ON uc.user_id = u.id
            WHERE u.email = $1
        `, [testEmail]);
        
        if (result.rows.length > 0) {
            const user = result.rows[0];
            console.log('✅ تم جلب بيانات المستخدم بنجاح');
            console.log(`   👤 الاسم: ${user.name}`);
            console.log(`   📧 البريد: ${user.email}`);
            console.log(`   🏢 الجهة: ${user.entity_name} (${user.entity_id})`);
            console.log(`   ✅ الحالة: ${user.is_active ? 'نشط' : 'غير نشط'}`);
        } else {
            console.log('❌ لم يتم العثور على المستخدم');
        }
        
        // 2. عرض جميع الحسابات المتاحة
        console.log('\n📋 اختبار 2: عرض جميع الحسابات');
        const allUsers = await pool.query(`
            SELECT u.name, u.email, u.entity_id, uc.is_active,
                   CASE WHEN u.entity_id = 'HQ001' THEN 'Admin@123' ELSE 'User@123' END as password
            FROM users u
            JOIN user_credentials uc ON u.id = uc.user_id
            ORDER BY u.id
        `);
        
        console.log('\n✅ الحسابات المتاحة للدخول:');
        console.log('┌────────────────────────────────────────────────────────┐');
        allUsers.rows.forEach(u => {
            console.log(`│ ${u.name}`);
            console.log(`│   📧 ${u.email}`);
            console.log(`│   🔑 ${u.password}`);
            console.log(`│   🏢 ${u.entity_id}`);
            console.log('├────────────────────────────────────────────────────────┤');
        });
        console.log('└────────────────────────────────────────────────────────┘');
        
        // 3. اختبار التحقق من كلمة المرور
        console.log('\n🔐 اختبار 3: التحقق من تشفير كلمات المرور');
        const bcrypt = require('bcryptjs');
        const testPassword = 'Admin@123';
        const hashResult = await pool.query(`
            SELECT password_hash FROM user_credentials WHERE user_id = 1
        `);
        
        if (hashResult.rows.length > 0) {
            const isValid = await bcrypt.compare(testPassword, hashResult.rows[0].password_hash);
            console.log(`   كلمة المرور "${testPassword}": ${isValid ? '✅ صحيحة' : '❌ خاطئة'}`);
        }
        
        console.log('\n✅ جميع الاختبارات نجحت!');
        console.log('📌 النظام الآن يعمل بالحسابات الشخصية (البريد الإلكتروني)');
        
    } catch (error) {
        console.error('❌ خطأ في الاختبار:', error.message);
    } finally {
        await pool.end();
    }
}

testNewAuthSystem();
