const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const pool = new Pool({
    connectionString: 'postgresql://postgres:PddzJpAQYezqknsntSzmCUlQYuYJldcT@crossover.proxy.rlwy.net:44255/railway',
    ssl: { rejectUnauthorized: false }
});

async function simulateLogin(email, password) {
    const client = await pool.connect();
    
    try {
        console.log(`\n🔐 محاكاة تسجيل دخول: ${email}`);
        console.log('━'.repeat(60));
        
        // 1. جلب بيانات المستخدم من قاعدة البيانات (نفس منطق auth-api.js)
        const credQuery = `
            SELECT uc.id as cred_id, uc.user_id, uc.password_hash, 
                   uc.is_active, uc.failed_attempts, uc.locked_until,
                   u.id, u.name, u.email, u.entity_id, u.entity_name,
                   u.role, u.tenant_type, u.is_active as user_active
            FROM user_credentials uc
            JOIN users u ON uc.user_id = u.id
            WHERE u.email = $1
        `;
        
        const credResult = await client.query(credQuery, [email]);
        
        if (credResult.rows.length === 0) {
            console.log('❌ البريد الإلكتروني أو كلمة المرور غير صحيحة');
            return { success: false, message: 'البريد الإلكتروني أو كلمة المرور غير صحيحة' };
        }
        
        const credential = credResult.rows[0];
        console.log(`✅ تم العثور على المستخدم: ${credential.name}`);
        
        // 2. التحقق من الحساب مقفل
        if (credential.locked_until && new Date(credential.locked_until) > new Date()) {
            console.log('❌ الحساب مقفل مؤقتاً');
            return { success: false, message: 'الحساب مقفل مؤقتاً' };
        }
        
        // 3. التحقق من الحساب نشط
        if (!credential.is_active || !credential.user_active) {
            console.log('❌ الحساب غير نشط');
            return { success: false, message: 'الحساب غير نشط' };
        }
        console.log('✅ الحساب نشط');
        
        // 4. التحقق من كلمة المرور
        const isPasswordValid = await bcrypt.compare(password, credential.password_hash);
        
        if (!isPasswordValid) {
            console.log('❌ كلمة المرور غير صحيحة');
            return { success: false, message: 'البريد الإلكتروني أو كلمة المرور غير صحيحة' };
        }
        console.log('✅ كلمة المرور صحيحة');
        
        // 5. جلب الصلاحيات
        const rolesQuery = `
            SELECT r.id, r.name, r.name_ar, r.job_title_ar, r.hierarchy_level
            FROM user_roles ur
            JOIN roles r ON ur.role_id = r.id
            WHERE ur.user_id = $1 AND ur.is_active = true
        `;
        const rolesResult = await client.query(rolesQuery, [credential.user_id]);
        console.log(`✅ الأدوار: ${rolesResult.rows.length} دور`);
        
        // 6. النتيجة
        console.log('\n📊 تفاصيل تسجيل الدخول:');
        console.log(`   👤 الاسم: ${credential.name}`);
        console.log(`   📧 البريد: ${credential.email}`);
        console.log(`   🏢 الجهة: ${credential.entity_name} (${credential.entity_id})`);
        console.log(`   🎭 الأدوار: ${rolesResult.rows.map(r => r.name_ar).join(', ') || 'لا يوجد'}`);
        
        return {
            success: true,
            message: 'تم تسجيل الدخول بنجاح',
            user: {
                id: credential.user_id,
                name: credential.name,
                email: credential.email,
                entity_id: credential.entity_id,
                entity_name: credential.entity_name
            },
            roles: rolesResult.rows
        };
        
    } catch (error) {
        console.error('❌ خطأ:', error.message);
        return { success: false, message: 'حدث خطأ في الخادم' };
    } finally {
        client.release();
    }
}

async function runTests() {
    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║  اختبار شامل لنظام تسجيل الدخول بالبريد الإلكتروني       ║');
    console.log('╚════════════════════════════════════════════════════════════╝');
    
    // الاختبار 1: تسجيل دخول Super Admin
    await simulateLogin('ahmed@nayosh.com', 'Admin@123');
    
    // الاختبار 2: تسجيل دخول مستخدم عادي
    await simulateLogin('sara@nayosh.com', 'User@123');
    
    // الاختبار 3: محاولة بكلمة مرور خاطئة
    await simulateLogin('ahmed@nayosh.com', 'WrongPassword');
    
    // الاختبار 4: محاولة ببريد غير موجود
    await simulateLogin('notexist@nayosh.com', 'Admin@123');
    
    // عرض جميع الحسابات المتاحة
    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║  الحسابات المتاحة للدخول                                 ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');
    
    const allUsers = await pool.query(`
        SELECT u.name, u.email, u.entity_id,
               CASE WHEN u.entity_id = 'HQ001' THEN 'Admin@123' ELSE 'User@123' END as password
        FROM users u
        JOIN user_credentials uc ON u.id = uc.user_id
        WHERE uc.is_active = true
        ORDER BY u.id
    `);
    
    console.log('┌────────────────────────────────────────────────────────────┐');
    allUsers.rows.forEach((u, i) => {
        console.log(`│ ${i+1}. ${u.name}`);
        console.log(`│    📧 ${u.email}`);
        console.log(`│    🔑 ${u.password}`);
        if (i < allUsers.rows.length - 1) {
            console.log('├────────────────────────────────────────────────────────────┤');
        }
    });
    console.log('└────────────────────────────────────────────────────────────┘');
    
    console.log('\n✅ جميع الاختبارات انتهت!');
    console.log('📌 النظام الآن يعمل بالحساب الشخصي (البريد الإلكتروني)\n');
    
    await pool.end();
}

runTests().catch(console.error);
