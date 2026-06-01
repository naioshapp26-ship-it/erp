// Test office login
const { Client } = require('pg');
const crypto = require('crypto');

const connectionString = 'postgresql://postgres:PddzJpAQYezqknsntSzmCUlQYuYJldcT@crossover.proxy.rlwy.net:44255/railway';

async function testLogin(email, password) {
  const client = new Client({ connectionString });
  
  try {
    await client.connect();
    
    const passwordHash = crypto.createHash('sha256').update(password).digest('hex');
    
    // محاكاة استعلام تسجيل الدخول
    const result = await client.query(`
      SELECT 
        u.id,
        u.email,
        u.name,
        u.role,
        u.office_id,
        uc.password_hash,
        uc.is_active
      FROM users u
      JOIN user_credentials uc ON u.id = uc.user_id
      WHERE u.email = $1
    `, [email]);

    if (result.rows.length === 0) {
      console.log(`❌ ${email}: المستخدم غير موجود`);
      return false;
    }

    const user = result.rows[0];
    
    if (user.password_hash === passwordHash && user.is_active) {
      console.log(`✅ ${email}: تسجيل الدخول ناجح`);
      console.log(`   👤 ${user.name}`);
      console.log(`   🏢 Office ID: ${user.office_id}`);
      console.log(`   👔 Role: ${user.role}`);
      return true;
    } else {
      console.log(`❌ ${email}: كلمة المرور غير صحيحة أو الحساب غير نشط`);
      console.log(`   Hash المتوقع: ${passwordHash}`);
      console.log(`   Hash في DB: ${user.password_hash}`);
      console.log(`   نشط: ${user.is_active}`);
      return false;
    }
    
  } catch (error) {
    console.error(`❌ خطأ في ${email}:`, error.message);
    return false;
  } finally {
    await client.end();
  }
}

async function testAllOffices() {
  console.log('🧪 اختبار تسجيل الدخول لجميع المكاتب\n');
  
  const accounts = [
    { email: 'OFF-5657-FIN@nayosh.com', password: 'demo123' },
    { email: 'OFF-5657-MKT@nayosh.com', password: 'demo123' },
    { email: 'OFF-5657-DEV@nayosh.com', password: 'demo123' }
  ];
  
  for (const account of accounts) {
    await testLogin(account.email, account.password);
    console.log();
  }
  
  console.log('✅ اختبار تسجيل الدخول انتهى');
}

testAllOffices();
