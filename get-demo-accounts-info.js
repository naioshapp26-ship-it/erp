// Get information about demo accounts from database
const { Client } = require('pg');

const connectionString = 'postgresql://postgres:PddzJpAQYezqknsntSzmCUlQYuYJldcT@crossover.proxy.rlwy.net:44255/railway';

async function getDemoAccountsInfo() {
  const client = new Client({ connectionString });
  
  try {
    await client.connect();
    console.log('✅ متصل بقاعدة البيانات\n');

    // الحصول على معلومات المكاتب المستخدمة في تسجيل الدخول
    const officeEmails = [
      'OFF-5657-FIN@nayosh.com',
      'OFF-5657-MKT@nayosh.com',
      'OFF-5657-DEV@nayosh.com'
    ];

    console.log('📋 معلومات الحسابات التجريبية:\n');
    console.log('=' .repeat(80));

    for (const email of officeEmails) {
      // الحصول على معلومات المستخدم
      const userResult = await client.query(`
        SELECT id, name, email, office_id, entity_id
        FROM users
        WHERE email = $1
      `, [email]);

      if (userResult.rows.length > 0) {
        const user = userResult.rows[0];
        console.log(`\n🔐 الحساب: ${email}`);
        console.log(`   📧 البريد: ${email}`);
        console.log(`   🔑 كلمة المرور: demo123`);
        console.log(`   👤 الاسم: ${user.name}`);
        console.log(`   🆔 User ID: ${user.id}`);
        console.log(`   🏢 Office ID: ${user.office_id || 'غير محدد'}`);
        console.log(`   🏷️  Entity ID: ${user.entity_id || 'غير محدد'}`);

        // الحصول على معلومات المكتب
        if (user.office_id) {
          const officeResult = await client.query(`
            SELECT id, code, name, incubator_id
            FROM offices
            WHERE id = $1
          `, [user.office_id]);

          if (officeResult.rows.length > 0) {
            const office = officeResult.rows[0];
            console.log(`\n   📍 معلومات المكتب:`);
            console.log(`      - رقم المكتب (ID): ${office.id}`);
            console.log(`      - كود المكتب: ${office.code}`);
            console.log(`      - اسم المكتب: ${office.name}`);
            console.log(`      - رقم الحاضنة: ${office.incubator_id}`);
          }
        }
      } else {
        console.log(`\n❌ الحساب ${email} غير موجود في قاعدة البيانات`);
      }
    }

    console.log('\n' + '='.repeat(80));
    console.log('\n📊 ملخص الأرقام المهمة:\n');

    // جدول ملخص
    console.log('┌─────────────────────────┬──────────────┬─────────────┬──────────────┐');
    console.log('│ البريد الإلكتروني      │ رقم المكتب  │ كود المكتب  │ رقم الحاضنة  │');
    console.log('├─────────────────────────┼──────────────┼─────────────┼──────────────┤');

    for (const email of officeEmails) {
      const userResult = await client.query(`
        SELECT u.id, u.office_id, o.code, o.incubator_id
        FROM users u
        LEFT JOIN offices o ON u.office_id = o.id
        WHERE u.email = $1
      `, [email]);

      if (userResult.rows.length > 0) {
        const user = userResult.rows[0];
        const emailPart = email.split('@')[0].padEnd(23);
        const officeId = (user.office_id || 'N/A').toString().padEnd(12);
        const code = (user.code || 'N/A').padEnd(11);
        const incubatorId = (user.incubator_id || 'N/A').toString().padEnd(12);
        console.log(`│ ${emailPart} │ ${officeId} │ ${code} │ ${incubatorId} │`);
      }
    }

    console.log('└─────────────────────────┴──────────────┴─────────────┴──────────────┘');

    // معلومات إضافية
    console.log('\n💡 كيفية استخدام الأرقام:\n');
    console.log('1. في صفحة صلاحيات المكتب: استخدم رقم المكتب (Office ID) أو كود المكتب');
    console.log('2. مثال: يمكنك إدخال "39" أو "OFF-5657-FIN"');
    console.log('3. رقم الحاضنة يُستخدم لمعرفة أي حاضنة ينتمي إليها المكتب');

  } catch (error) {
    console.error('❌ خطأ:', error.message);
    console.error(error);
  } finally {
    await client.end();
    console.log('\n✅ تم إغلاق الاتصال');
  }
}

getDemoAccountsInfo();
