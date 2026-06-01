const { Pool } = require('pg');

const pool = new Pool({
    connectionString: 'postgresql://postgres:PddzJpAQYezqknsntSzmCUlQYuYJldcT@crossover.proxy.rlwy.net:44255/railway',
    ssl: { rejectUnauthorized: false }
});

async function updateAuthSystem() {
    const client = await pool.connect();
    
    try {
        console.log('🔄 تحديث نظام المصادقة للعمل بالحساب الشخصي...\n');
        
        // 1. التحقق من البيانات الحالية
        console.log('📋 المستخدمين الحاليين:');
        const currentUsers = await client.query(`
            SELECT u.id, u.name, u.email, uc.username 
            FROM users u 
            LEFT JOIN user_credentials uc ON u.id = uc.user_id
        `);
        currentUsers.rows.forEach(u => {
            console.log(`  - ${u.name} | ${u.email} | ${u.username || 'لا يوجد'}`);
        });
        
        // 2. حذف البيانات القديمة من user_credentials
        console.log('\n🗑️ حذف بيانات الاعتماد القديمة...');
        await client.query('DELETE FROM user_credentials');
        console.log('✅ تم الحذف');
        
        // 3. إنشاء بيانات اعتماد جديدة لكل مستخدم بناءً على البريد الإلكتروني
        console.log('\n🔐 إنشاء بيانات اعتماد جديدة...');
        
        const bcrypt = require('bcryptjs');
        const adminPass = await bcrypt.hash('Admin@123', 10);
        const userPass = await bcrypt.hash('User@123', 10);
        
        const users = await client.query('SELECT id, name, email, entity_id FROM users');
        
        for (const user of users.rows) {
            const password = user.entity_id === 'HQ001' ? adminPass : userPass;
            
            await client.query(`
                INSERT INTO user_credentials 
                (user_id, username, password_hash, is_active, failed_attempts, locked_until)
                VALUES ($1, $2, $3, true, 0, NULL)
            `, [user.id, user.email, password]);
            
            console.log(`  ✅ ${user.name} - ${user.email}`);
        }
        
        // 4. عرض النتيجة النهائية
        console.log('\n📊 النتيجة النهائية:');
        const finalResult = await client.query(`
            SELECT u.name, u.email, uc.username, uc.is_active, 
                   CASE WHEN u.entity_id = 'HQ001' THEN 'Admin@123' ELSE 'User@123' END as password
            FROM users u
            JOIN user_credentials uc ON u.id = uc.user_id
            ORDER BY u.id
        `);
        
        console.log('\n الحسابات المتاحة:');
        console.log('┌────────────────────────────────────────────────────────────────┐');
        finalResult.rows.forEach(r => {
            console.log(`│ 👤 ${r.name}`);
            console.log(`│    📧 البريد: ${r.email}`);
            console.log(`│    🔑 كلمة المرور: ${r.password}`);
            console.log(`│    ✅ الحالة: ${r.is_active ? 'نشط' : 'غير نشط'}`);
            console.log('├────────────────────────────────────────────────────────────────┤');
        });
        console.log('└────────────────────────────────────────────────────────────────┘');
        
        console.log('\n✅ تم تحديث نظام المصادقة بنجاح!');
        console.log('📌 الآن يمكن للمستخدمين تسجيل الدخول باستخدام البريد الإلكتروني');
        
    } catch (error) {
        console.error('❌ خطأ:', error.message);
    } finally {
        client.release();
        await pool.end();
    }
}

updateAuthSystem();
