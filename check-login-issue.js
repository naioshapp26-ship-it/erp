// Check login issue for office accounts
const { Client } = require('pg');

const connectionString = 'postgresql://postgres:PddzJpAQYezqknsntSzmCUlQYuYJldcT@crossover.proxy.rlwy.net:44255/railway';

async function checkLoginIssue() {
  const client = new Client({ connectionString });
  
  try {
    await client.connect();
    console.log('✅ متصل بقاعدة البيانات\n');

    const officeEmails = [
      'OFF-5657-FIN@nayosh.com',
      'OFF-5657-MKT@nayosh.com',
      'OFF-5657-DEV@nayosh.com'
    ];

    console.log('🔍 فحص حسابات المكاتب:\n');

    for (const email of officeEmails) {
      console.log(`\n📧 ${email}`);
      console.log('='.repeat(60));

      // 1. فحص في جدول users
      const userCheck = await client.query(`
        SELECT id, name, email, office_id, entity_id, role
        FROM users
        WHERE email = $1
      `, [email]);

      if (userCheck.rows.length > 0) {
        const user = userCheck.rows[0];
        console.log(`✅ موجود في جدول users:`);
        console.log(`   User ID: ${user.id}`);
        console.log(`   الاسم: ${user.name}`);
        console.log(`   Office ID: ${user.office_id}`);
        console.log(`   الدور: ${user.role}`);

        // 2. فحص في جدول user_credentials
        const credCheck = await client.query(`
          SELECT id, user_id, password_hash, is_active
          FROM user_credentials
          WHERE user_id = $1
        `, [user.id]);

        if (credCheck.rows.length > 0) {
          console.log(`✅ موجود في جدول user_credentials`);
          console.log(`   Credential ID: ${credCheck.rows[0].id}`);
          console.log(`   نشط: ${credCheck.rows[0].is_active}`);
          console.log(`   كلمة المرور: ${credCheck.rows[0].password_hash ? 'موجودة' : 'غير موجودة'}`);
        } else {
          console.log(`❌ غير موجود في جدول user_credentials`);
          console.log(`   المشكلة: لا يمكن تسجيل الدخول بدون سجل في user_credentials`);
        }
      } else {
        console.log(`❌ غير موجود في جدول users`);
      }
    }

    console.log('\n\n💡 الحل:');
    console.log('يجب إضافة سجلات في جدول user_credentials لكل مستخدم');

  } catch (error) {
    console.error('❌ خطأ:', error.message);
    console.error(error);
  } finally {
    await client.end();
    console.log('\n✅ تم إغلاق الاتصال');
  }
}

checkLoginIssue();
