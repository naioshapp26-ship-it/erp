const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const pool = new Pool({
  connectionString: 'postgresql://postgres:PddzJpAQYezqknsntSzmCUlQYuYJldcT@crossover.proxy.rlwy.net:44255/railway'
});

async function addDemoAccounts() {
  try {
    console.log('🚀 إضافة حسابات التجربة...\n');

    // First, ensure demo incubator and platform exist in entities table
    await pool.query(`
      INSERT INTO entities (id, name, type, created_at)
      VALUES 
        ('INC-5657', 'التعليم والتعلم', 'INCUBATOR', NOW()),
        ('PLT-0001', 'مطعم الوجبات الجاهزة', 'PLATFORM', NOW())
      ON CONFLICT (id) DO NOTHING
    `);
    
    console.log('✅ تم التأكد من وجود الكيانات المطلوبة\n');

    const demoAccounts = [
      {
        email: 'branch@nayosh.com',
        name: 'مدير فرع تجريبي',
        role: 'مسؤول النظام',
        entity_id: 'BR015', // فرع العليا مول
        tenant_type: 'BRANCH',
        password: 'demo123'
      },
      {
        email: 'incubator@nayosh.com',
        name: 'مدير حاضنة تجريبي',
        role: 'مسؤول النظام',
        entity_id: 'INC-5657', // حاضنة التعليم والتعلم
        tenant_type: 'INCUBATOR',
        password: 'demo123'
      },
      {
        email: 'platform@nayosh.com',
        name: 'مدير منصة تجريبي',
        role: 'مسؤول النظام',
        entity_id: 'PLT-0001', // مطعم الوجبات الجاهزة
        tenant_type: 'PLATFORM',
        password: 'demo123'
      },
      {
        email: 'office@nayosh.com',
        name: 'مدير مكتب تجريبي',
        role: 'مسؤول النظام',
        entity_id: 'OFF01', // مكتب الدمام
        tenant_type: 'OFFICE',
        password: 'demo123'
      }
    ];

    for (const account of demoAccounts) {
      // Check if user already exists
      const existingUser = await pool.query(
        'SELECT id FROM users WHERE email = $1',
        [account.email]
      );

      let userId;
      
      if (existingUser.rows.length > 0) {
        console.log(`⚠️  الحساب ${account.email} موجود بالفعل - سيتم التحديث`);
        userId = existingUser.rows[0].id;
        
        // Update user
        await pool.query(
          `UPDATE users 
           SET name = $1, role = $2, entity_id = $3, tenant_type = $4
           WHERE id = $5`,
          [account.name, account.role, account.entity_id, account.tenant_type, userId]
        );
      } else {
        // Insert new user
        const userResult = await pool.query(
          `INSERT INTO users (email, name, role, entity_id, tenant_type)
           VALUES ($1, $2, $3, $4, $5)
           RETURNING id`,
          [account.email, account.name, account.role, account.entity_id, account.tenant_type]
        );
        userId = userResult.rows[0].id;
        console.log(`✅ تم إنشاء الحساب ${account.email}`);
      }

      // Hash password
      const passwordHash = await bcrypt.hash(account.password, 10);

      // Update or insert credentials
      const existingCred = await pool.query(
        'SELECT user_id FROM user_credentials WHERE user_id = $1',
        [userId]
      );

      if (existingCred.rows.length > 0) {
        await pool.query(
          'UPDATE user_credentials SET username = $1, password_hash = $2 WHERE user_id = $3',
          [account.email, passwordHash, userId]
        );
      } else {
        await pool.query(
          'INSERT INTO user_credentials (user_id, username, password_hash) VALUES ($1, $2, $3)',
          [userId, account.email, passwordHash]
        );
      }

      console.log(`   📧 Email: ${account.email}`);
      console.log(`   👤 Name: ${account.name}`);
      console.log(`   🏢 Type: ${account.tenant_type}`);
      console.log(`   🔐 Password: ${account.password}\n`);
    }

    console.log('✅ تم إضافة/تحديث جميع الحسابات التجريبية بنجاح!');
    
    await pool.end();
  } catch (err) {
    console.error('❌ خطأ:', err.message);
    console.error(err);
    await pool.end();
    process.exit(1);
  }
}

addDemoAccounts();
