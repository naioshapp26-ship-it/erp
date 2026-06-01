// Create demo office accounts from real offices in database
const { Client } = require('pg');
const crypto = require('crypto');

const connectionString = 'postgresql://postgres:PddzJpAQYezqknsntSzmCUlQYuYJldcT@crossover.proxy.rlwy.net:44255/railway';

// Simple hash function for demo purposes
function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

async function createDemoOfficeAccounts() {
  const client = new Client({ connectionString });
  
  try {
    await client.connect();
    console.log('✅ تم الاتصال بقاعدة البيانات\n');

    // 1. جلب بعض المكاتب الحقيقية
    console.log('📋 جلب المكاتب من قاعدة البيانات...');
    const offices = await client.query(`
      SELECT o.id, o.code, o.name, i.name as incubator_name
      FROM offices o
      LEFT JOIN incubators i ON o.incubator_id = i.id
      WHERE o.is_active = true
      ORDER BY o.id
      LIMIT 5
    `);

    console.log(`وجدت ${offices.rows.length} مكاتب\n`);
    
    if (offices.rows.length === 0) {
      console.log('❌ لا توجد مكاتب في قاعدة البيانات');
      return;
    }

    // عرض المكاتب
    console.log('المكاتب المختارة:');
    offices.rows.forEach((office, i) => {
      console.log(`  ${i+1}. ${office.code} - ${office.name}`);
    });
    console.log();

    // 2. حذف حسابات office القديمة
    console.log('🗑️  حذف حسابات المكاتب القديمة...');
    await client.query(`
      DELETE FROM users 
      WHERE email LIKE 'office%@nayosh.com' 
      OR email LIKE 'OFF-%@nayosh.com'
    `);
    console.log('✅ تم حذف الحسابات القديمة\n');

    // 3. إنشاء حسابات جديدة من المكاتب الحقيقية
    console.log('🔄 إنشاء حسابات جديدة...');
    
    const demoAccounts = [];
    
    for (let i = 0; i < Math.min(3, offices.rows.length); i++) {
      const office = offices.rows[i];
      const email = `${office.code}@nayosh.com`;
      const displayName = `مدير ${office.name.substring(0, 30)}`;
      
      try {
        // إنشاء entity_id للمكتب إذا لم يكن موجوداً
        const entityId = `OFF0${office.id}`;
        await client.query(`
          INSERT INTO entities (id, name, type, status, balance, users_count, plan, theme)
          VALUES ($1, $2, 'OFFICE', 'Active', 0, 1, 'BASIC', 'GREEN')
          ON CONFLICT (id) DO UPDATE SET name = $2
        `, [entityId, office.name]);
        
        // تحديث entity_id في جدول offices
        await client.query('UPDATE offices SET entity_id = $1 WHERE id = $2', [entityId, office.id]);
        
        // إنشاء المستخدم
        const result = await client.query(`
          INSERT INTO users (
            name, email, role, tenant_type, entity_id, 
            entity_name, office_id, is_active, created_at
          )
          VALUES ($1, $2, 'OFFICE_MANAGER', 'OFFICE', $3, $4, $5, true, NOW())
          RETURNING id, email, name
        `, [displayName, email, entityId, office.name, office.id]);
        
        demoAccounts.push({
          email,
          displayName,
          officeCode: office.code,
          officeName: office.name,
          officeId: office.id
        });
        
        console.log(`  ✅ ${email} - ${displayName}`);
      } catch (err) {
        console.error(`  ❌ خطأ في إنشاء حساب ${email}:`, err.message);
      }
    }

    // 4. عرض النتيجة
    console.log('\n📊 حسابات الاختبار الجديدة:');
    console.log('==========================================');
    demoAccounts.forEach((account, i) => {
      console.log(`\n${i+1}. البريد: ${account.email}`);
      console.log(`   كلمة المرور: demo123`);
      console.log(`   المكتب: ${account.officeCode}`);
      console.log(`   الاسم: ${account.displayName}`);
    });
    console.log('\n==========================================');

    // 5. حفظ البيانات في ملف للاستخدام في الواجهة
    const fs = require('fs');
    const outputData = {
      offices: demoAccounts.map(acc => ({
        email: acc.username,
        password: 'demo123',
        name: acc.displayName,
        code: acc.officeCode
      })),
      generatedAt: new Date().toISOString()
    };
    
    fs.writeFileSync('demo-office-accounts.json', JSON.stringify(outputData, null, 2));
    console.log('\n✅ تم حفظ البيانات في demo-office-accounts.json');

  } catch (error) {
    console.error('\n❌ خطأ:', error.message);
    console.error(error);
  } finally {
    await client.end();
    console.log('\n✅ تم إغلاق الاتصال');
  }
}

createDemoOfficeAccounts();
