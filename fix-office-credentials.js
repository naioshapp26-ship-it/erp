// Fix office accounts - add credentials
const { Client } = require('pg');
const crypto = require('crypto');

const connectionString = 'postgresql://postgres:PddzJpAQYezqknsntSzmCUlQYuYJldcT@crossover.proxy.rlwy.net:44255/railway';

// Hash password using SHA-256 (same as demo123 in other accounts)
function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

async function fixOfficeCredentials() {
  const client = new Client({ connectionString });
  
  try {
    await client.connect();
    console.log('✅ متصل بقاعدة البيانات\n');

    const officeEmails = [
      'OFF-5657-FIN@nayosh.com',
      'OFF-5657-MKT@nayosh.com',
      'OFF-5657-DEV@nayosh.com'
    ];

    const password = 'demo123';
    const passwordHash = hashPassword(password);
    
    console.log('🔄 إصلاح بيانات الاعتماد للمكاتب...\n');
    console.log(`كلمة المرور: ${password}`);
    console.log(`Hash: ${passwordHash}\n`);

    for (const email of officeEmails) {
      console.log(`\n📧 ${email}`);
      
      // 1. الحصول على user_id
      const userResult = await client.query(`
        SELECT id, name FROM users WHERE email = $1
      `, [email]);

      if (userResult.rows.length === 0) {
        console.log(`   ❌ المستخدم غير موجود`);
        continue;
      }

      const userId = userResult.rows[0].id;
      const userName = userResult.rows[0].name;

      // 2. التحقق من وجود credentials
      const credCheck = await client.query(`
        SELECT id FROM user_credentials WHERE user_id = $1
      `, [userId]);

      if (credCheck.rows.length > 0) {
        // تحديث كلمة المرور
        await client.query(`
          UPDATE user_credentials 
          SET password_hash = $1, 
              is_active = true,
              failed_attempts = 0,
              locked_until = NULL,
              updated_at = NOW()
          WHERE user_id = $2
        `, [passwordHash, userId]);
        console.log(`   ✅ تم تحديث كلمة المرور`);
      } else {
        // إنشاء credentials جديد
        await client.query(`
          INSERT INTO user_credentials (
            user_id, username, password_hash, is_active, 
            failed_attempts, created_at, updated_at
          )
          VALUES ($1, $2, $3, true, 0, NOW(), NOW())
        `, [userId, email, passwordHash]);
        console.log(`   ✅ تم إنشاء بيانات الاعتماد`);
      }

      console.log(`   👤 ${userName}`);
      console.log(`   🆔 User ID: ${userId}`);
    }

    // اختبار تسجيل الدخول
    console.log('\n\n🧪 اختبار تسجيل الدخول:\n');
    
    for (const email of officeEmails) {
      const testResult = await client.query(`
        SELECT uc.id as cred_id, uc.user_id, uc.password_hash, 
               uc.is_active, u.name, u.email
        FROM user_credentials uc
        JOIN users u ON uc.user_id = u.id
        WHERE u.email = $1
      `, [email]);

      if (testResult.rows.length > 0) {
        const cred = testResult.rows[0];
        const passwordMatch = cred.password_hash === passwordHash;
        console.log(`${passwordMatch ? '✅' : '❌'} ${email}`);
        console.log(`   Hash مطابق: ${passwordMatch}`);
        console.log(`   نشط: ${cred.is_active}`);
      } else {
        console.log(`❌ ${email} - لا يوجد credentials`);
      }
    }

    console.log('\n\n📊 الملخص:');
    console.log('✅ تم إصلاح جميع الحسابات');
    console.log('✅ يمكنك الآن تسجيل الدخول بكلمة المرور: demo123');

  } catch (error) {
    console.error('\n❌ خطأ:', error.message);
    console.error(error);
  } finally {
    await client.end();
    console.log('\n✅ تم إغلاق الاتصال');
  }
}

fixOfficeCredentials();
