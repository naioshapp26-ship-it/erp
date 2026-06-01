const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const pool = new Pool({
  connectionString: 'postgresql://postgres:PddzJpAQYezqknsntSzmCUlQYuYJldcT@crossover.proxy.rlwy.net:44255/railway',
  ssl: {
    rejectUnauthorized: false
  }
});

async function setupRealOfficesCredentials() {
  const client = await pool.connect();
  
  try {
    console.log('🔍 Step 1: جلب جميع المكاتب من قاعدة البيانات...\n');
    
    // Get all offices with their incubators
    const officesResult = await client.query(`
      SELECT 
        o.id,
        o.name,
        o.code,
        o.office_type,
        o.incubator_id,
        i.name as incubator_name,
        i.code as incubator_code
      FROM offices o
      LEFT JOIN incubators i ON o.incubator_id = i.id
      WHERE o.is_active = true
      ORDER BY o.id
    `);
    
    console.log(`📊 تم العثور على ${officesResult.rows.length} مكتب\n`);
    
    // Show sample offices
    console.log('📋 عينة من المكاتب:');
    officesResult.rows.slice(0, 5).forEach(office => {
      console.log(`   - [${office.id}] ${office.name} (${office.code})`);
      console.log(`     الحاضنة: ${office.incubator_name}`);
    });
    console.log('');
    
    console.log('🔐 Step 2: إنشاء credentials للمكاتب...\n');
    
    const defaultPassword = 'test123'; // كلمة مرور الاختبار
    const hashedPassword = await bcrypt.hash(defaultPassword, 10);
    
    let createdCount = 0;
    let updatedCount = 0;
    let errorCount = 0;
    
    for (const office of officesResult.rows) {
      try {
        // إنشاء اسم المستخدم من كود المكتب
        const username = `${office.code}@naiosh.com`;
        const email = username;
        const name = `مدير ${office.name}`;
        
        // التحقق من وجود المستخدم
        const existingUser = await client.query(`
          SELECT id FROM users WHERE office_id = $1
        `, [office.id]);
        
        let userId;
        
        if (existingUser.rows.length > 0) {
          // تحديث المستخدم الموجود
          userId = existingUser.rows[0].id;
          
          await client.query(`
            UPDATE users
            SET 
              name = $1,
              email = $2,
              is_active = true,
              updated_at = NOW()
            WHERE id = $3
          `, [name, email, userId]);
          
          // تحديث credentials
          const existingCreds = await client.query(`
            SELECT id FROM user_credentials WHERE user_id = $1
          `, [userId]);
          
          if (existingCreds.rows.length > 0) {
            await client.query(`
              UPDATE user_credentials
              SET 
                username = $1,
                password_hash = $2,
                is_active = true,
                failed_attempts = 0,
                locked_until = NULL,
                updated_at = NOW()
              WHERE user_id = $3
            `, [username, hashedPassword, userId]);
          } else {
            await client.query(`
              INSERT INTO user_credentials (user_id, username, password_hash, is_active, failed_attempts)
              VALUES ($1, $2, $3, true, 0)
            `, [userId, username, hashedPassword]);
          }
          
          updatedCount++;
        } else {
          // إنشاء مستخدم جديد (بدون entity_id لتجنب foreign key constraint)
          const userResult = await client.query(`
            INSERT INTO users (
              name, 
              email, 
              role, 
              tenant_type,
              entity_name,
              office_id,
              incubator_id,
              is_active
            )
            VALUES ($1, $2, 'office_manager', 'office', $3, $4, $5, true)
            RETURNING id
          `, [
            name,
            email,
            office.name,
            office.id,
            office.incubator_id
          ]);
          
          userId = userResult.rows[0].id;
          
          // إنشاء credentials
          await client.query(`
            INSERT INTO user_credentials (user_id, username, password_hash, is_active, failed_attempts)
            VALUES ($1, $2, $3, true, 0)
          `, [userId, username, hashedPassword]);
          
          createdCount++;
        }
        
      } catch (error) {
        console.error(`   ❌ خطأ في المكتب ${office.id}: ${error.message}`);
        errorCount++;
      }
    }
    
    console.log(`\n✅ تم الانتهاء:`);
    console.log(`   - تم إنشاء: ${createdCount} مستخدم جديد`);
    console.log(`   - تم تحديث: ${updatedCount} مستخدم موجود`);
    console.log(`   - أخطاء: ${errorCount}`);
    console.log('');
    
    console.log('📝 Step 3: جلب جميع credentials للمكاتب...\n');
    
    // Get all office credentials for the HTML
    const credentialsResult = await client.query(`
      SELECT 
        u.id,
        u.name,
        u.office_id,
        uc.username,
        o.name as office_name,
        o.code as office_code,
        o.office_type,
        i.name as incubator_name
      FROM users u
      INNER JOIN user_credentials uc ON u.id = uc.user_id
      INNER JOIN offices o ON u.office_id = o.id
      LEFT JOIN incubators i ON o.incubator_id = i.id
      WHERE u.office_id IS NOT NULL
        AND u.is_active = true
        AND uc.is_active = true
      ORDER BY u.office_id
    `);
    
    console.log(`📊 تم العثور على ${credentialsResult.rows.length} حساب مكتب جاهز\n`);
    
    // Generate HTML buttons code
    console.log('📄 Step 4: توليد كود HTML للمكاتب...\n');
    
    const officesByType = {};
    credentialsResult.rows.forEach(cred => {
      const type = cred.office_type || 'other';
      if (!officesByType[type]) {
        officesByType[type] = [];
      }
      officesByType[type].push(cred);
    });
    
    // Save to JSON file for HTML generation
    const fs = require('fs');
    const outputData = {
      password: defaultPassword,
      offices: credentialsResult.rows.map(cred => ({
        id: cred.office_id,
        name: cred.office_name,
        code: cred.office_code,
        username: cred.username,
        type: cred.office_type,
        incubator: cred.incubator_name,
        userFullName: cred.name
      }))
    };
    
    fs.writeFileSync('real-offices-data.json', JSON.stringify(outputData, null, 2), 'utf8');
    console.log('✅ تم حفظ البيانات في real-offices-data.json\n');
    
    // Show sample HTML code
    console.log('📋 نموذج من أكواد HTML (أول 3 مكاتب):\n');
    credentialsResult.rows.slice(0, 3).forEach(cred => {
      const iconClass = getIconForOfficeType(cred.office_type);
      const colorClass = getColorForOfficeType(cred.office_type);
      
      console.log(`<!-- Office: ${cred.office_name} -->`);
      console.log(`<button onclick="fillLogin('${cred.username}', '${defaultPassword}')" class="flex flex-col items-center p-3 border border-gray-200 rounded-lg hover:border-primary hover:bg-primary-50 transition-all duration-200 group text-center w-full">`);
      console.log(`  <div class="bg-${colorClass}-50 text-${colorClass}-600 w-8 h-8 rounded-full flex items-center justify-center mb-2 group-hover:bg-${colorClass}-100">`);
      console.log(`    <i class="${iconClass}"></i>`);
      console.log(`  </div>`);
      console.log(`  <span class="text-xs font-bold text-gray-800">${getShortName(cred.office_name)}</span>`);
      console.log(`  <span class="text-[10px] text-gray-500">${cred.office_code}</span>`);
      console.log(`</button>\n`);
    });
    
    console.log(`\n✅ جميع المكاتب جاهزة للاختبار!`);
    console.log(`📌 كلمة المرور لجميع المكاتب: ${defaultPassword}\n`);
    
    // Summary
    console.log('📊 ملخص المكاتب حسب النوع:');
    Object.keys(officesByType).forEach(type => {
      console.log(`   - ${type}: ${officesByType[type].length} مكتب`);
    });
    console.log('');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    client.release();
    await pool.end();
  }
}

function getIconForOfficeType(type) {
  const icons = {
    'Consulting': 'fa-solid fa-handshake',
    'Co-working': 'fa-solid fa-users',
    'Private': 'fa-solid fa-lock',
    'Shared': 'fa-solid fa-share-nodes',
    'Meeting Room': 'fa-solid fa-people-group',
    'Innovation Lab': 'fa-solid fa-flask',
  };
  return icons[type] || 'fa-solid fa-building';
}

function getColorForOfficeType(type) {
  const colors = {
    'Consulting': 'green',
    'Co-working': 'blue',
    'Private': 'purple',
    'Shared': 'teal',
    'Meeting Room': 'orange',
    'Innovation Lab': 'pink',
  };
  return colors[type] || 'gray';
}

function getShortName(name) {
  // Extract type from name
  if (name.includes('المالية')) return 'مالية';
  if (name.includes('التسويق')) return 'تسويق';
  if (name.includes('البرمجيات')) return 'برمجة';
  if (name.includes('الريادة')) return 'ريادة';
  if (name.includes('الاستشار')) return 'استشارات';
  
  // Get first 2-3 words
  const words = name.split(' ');
  if (words.length <= 2) return name;
  return words.slice(0, 2).join(' ');
}

setupRealOfficesCredentials().catch(console.error);
