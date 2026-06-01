const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const pool = new Pool({
    connectionString: 'postgresql://postgres:PddzJpAQYezqknsntSzmCUlQYuYJldcT@crossover.proxy.rlwy.net:44255/railway',
    ssl: { rejectUnauthorized: false }
});

async function createAuthSystem() {
    const client = await pool.connect();
    
    try {
        console.log('🔐 إنشاء نظام المصادقة...\n');
        
        // 1. إنشاء جدول بيانات الاعتماد
        console.log('1️⃣ إنشاء جدول user_credentials...');
        await client.query(`
            CREATE TABLE IF NOT EXISTS user_credentials (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                username VARCHAR(100) UNIQUE NOT NULL,
                password_hash VARCHAR(255) NOT NULL,
                is_active BOOLEAN DEFAULT true,
                last_login TIMESTAMP,
                failed_attempts INTEGER DEFAULT 0,
                locked_until TIMESTAMP,
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW(),
                UNIQUE(user_id)
            )
        `);
        console.log('✅ تم إنشاء جدول user_credentials');
        
        // 2. إنشاء جدول sessions
        console.log('\n2️⃣ إنشاء جدول sessions...');
        await client.query(`
            CREATE TABLE IF NOT EXISTS user_sessions (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                session_token VARCHAR(255) UNIQUE NOT NULL,
                ip_address VARCHAR(50),
                user_agent TEXT,
                expires_at TIMESTAMP NOT NULL,
                created_at TIMESTAMP DEFAULT NOW(),
                last_activity TIMESTAMP DEFAULT NOW()
            )
        `);
        console.log('✅ تم إنشاء جدول user_sessions');
        
        // 3. إنشاء indexes للأداء
        console.log('\n3️⃣ إنشاء Indexes...');
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_credentials_username ON user_credentials(username);
            CREATE INDEX IF NOT EXISTS idx_credentials_user_id ON user_credentials(user_id);
            CREATE INDEX IF NOT EXISTS idx_sessions_token ON user_sessions(session_token);
            CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON user_sessions(user_id);
        `);
        console.log('✅ تم إنشاء Indexes');
        
        // 4. إنشاء بيانات اعتماد للمستخدم HQ001
        console.log('\n4️⃣ إنشاء بيانات اعتماد لـ HQ001...');
        
        // تشفير كلمة المرور
        const password = 'Admin@123';
        const hashedPassword = await bcrypt.hash(password, 10);
        
        // حذف بيانات قديمة إن وجدت
        await client.query('DELETE FROM user_credentials WHERE user_id = 1');
        
        // إضافة بيانات جديدة
        await client.query(`
            INSERT INTO user_credentials (user_id, username, password_hash)
            VALUES ($1, $2, $3)
        `, [1, 'HQ001', hashedPassword]);
        
        console.log('✅ تم إنشاء بيانات اعتماد HQ001');
        console.log('\n═══════════════════════════════════════');
        console.log('📧 اسم المستخدم: HQ001');
        console.log('🔑 كلمة المرور: Admin@123');
        console.log('═══════════════════════════════════════');
        
        // 5. إنشاء بيانات اعتماد إضافية لمستخدمين آخرين
        console.log('\n5️⃣ إنشاء بيانات اعتماد للمستخدمين الآخرين...');
        
        const defaultPassword = await bcrypt.hash('User@123', 10);
        
        // جلب جميع المستخدمين
        const usersResult = await client.query('SELECT id, entity_id FROM users WHERE id > 1 LIMIT 5');
        
        for (const user of usersResult.rows) {
            try {
                await client.query(`
                    INSERT INTO user_credentials (user_id, username, password_hash)
                    VALUES ($1, $2, $3)
                    ON CONFLICT (user_id) DO NOTHING
                `, [user.id, user.entity_id, defaultPassword]);
                console.log(`✅ ${user.entity_id}`);
            } catch (err) {
                console.log(`⚠️ ${user.entity_id} (موجود مسبقاً)`);
            }
        }
        
        // 6. عرض ملخص
        console.log('\n6️⃣ ملخص النظام:');
        const credentialsCount = await client.query('SELECT COUNT(*) FROM user_credentials');
        console.log(`✅ عدد حسابات المصادقة: ${credentialsCount.rows[0].count}`);
        
        // عرض جميع الحسابات
        const allCredentials = await client.query(`
            SELECT uc.id, uc.username, u.name, u.entity_name, uc.is_active
            FROM user_credentials uc
            JOIN users u ON uc.user_id = u.id
            ORDER BY u.id
        `);
        
        console.log('\n📋 الحسابات المتاحة:');
        allCredentials.rows.forEach(cred => {
            console.log(`   ${cred.username} - ${cred.name} (${cred.entity_name})`);
        });
        
        console.log('\n✅ اكتمل إنشاء نظام المصادقة!');
        
    } catch (error) {
        console.error('❌ خطأ:', error.message);
        throw error;
    } finally {
        client.release();
        await pool.end();
    }
}

createAuthSystem().catch(console.error);
