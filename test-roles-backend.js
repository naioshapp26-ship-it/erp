const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://postgres:PddzJpAQYezqknsntSzmCUlQYuYJldcT@crossover.proxy.rlwy.net:44255/railway',
  ssl: { rejectUnauthorized: false }
});

async function testRolesBackend() {
  try {
    console.log('🧪 اختبار الخلفية لجدول الأدوار...\n');

    // 1. التحقق من العدد الإجمالي
    console.log('1️⃣ عدد الأدوار:');
    const totalCount = await pool.query('SELECT COUNT(*) as count FROM roles');
    console.log(`   ✅ إجمالي الأدوار: ${totalCount.rows[0].count}`);
    
    if (totalCount.rows[0].count < 33) {
      console.log('   ❌ العدد أقل من 33 دور مطلوب!');
      process.exit(1);
    }

    // 2. التحقق من الأدوار المطلوبة
    console.log('\n2️⃣ التحقق من الأدوار الـ 33 المطلوبة:');
    const requiredRoles = [
      'SUPER_ADMIN',
      'IT_MANAGER',
      'HQ_EXECUTIVE_MANAGER',
      'HQ_FINANCIAL_MANAGER',
      'HQ_MARKETING_MANAGER',
      'HQ_PROCUREMENT_MANAGER',
      'HQ_PR_MANAGER',
      'LEGAL_MANAGER',
      'CONTENT_MANAGER',
      'INITIATIVES_MANAGER',
      'FREELANCER_MANAGER',
      'EXECUTIVE_DESIGNER',
      'EXECUTIVE_MARKETER',
      'EXECUTIVE_SALES',
      'EXECUTIVE_CALLCENTER',
      'EXECUTIVE_SOCIAL_MEDIA',
      'EDITOR',
      'BRANCH_MANAGER',
      'ASSISTANT_BRANCH_MANAGER',
      'BRANCH_ADMIN',
      'INCUBATOR_MANAGER',
      'ASSISTANT_INCUBATOR_MANAGER',
      'INCUBATOR_ADMIN',
      'PLATFORM_MANAGER',
      'ASSISTANT_PLATFORM_MANAGER',
      'PLATFORM_ADMIN',
      'OFFICE_EXECUTIVE',
      'OFFICE_ADMIN',
      'LOGISTICS_EMPLOYEE',
      'PERMANENT_TRAINER',
      'FREELANCER_TRAINER',
      'VOLUNTEER_TRAINER',
      'INITIATIVES_VOLUNTEER'
    ];

    let allFound = true;
    for (const roleName of requiredRoles) {
      const result = await pool.query(
        'SELECT name, name_ar FROM roles WHERE name = $1',
        [roleName]
      );
      
      if (result.rowCount > 0) {
        console.log(`   ✅ ${result.rows[0].name_ar} (${roleName})`);
      } else {
        console.log(`   ❌ ${roleName} - غير موجود!`);
        allFound = false;
      }
    }

    if (!allFound) {
      console.log('\n❌ بعض الأدوار المطلوبة غير موجودة!');
      process.exit(1);
    }

    // 3. التحقق من عدم وجود تكرارات
    console.log('\n3️⃣ فحص التكرارات:');
    const duplicates = await pool.query(`
      SELECT name, COUNT(*) as count
      FROM roles
      GROUP BY name
      HAVING COUNT(*) > 1
    `);

    if (duplicates.rowCount > 0) {
      console.log('   ❌ توجد تكرارات:');
      duplicates.rows.forEach(dup => {
        console.log(`      - ${dup.name}: ${dup.count} مرات`);
      });
      process.exit(1);
    } else {
      console.log('   ✅ لا توجد تكرارات');
    }

    // 4. التحقق من الحقول المطلوبة
    console.log('\n4️⃣ التحقق من الحقول:');
    const nullChecks = await pool.query(`
      SELECT 
        COUNT(*) FILTER (WHERE name IS NULL) as null_name,
        COUNT(*) FILTER (WHERE name_ar IS NULL) as null_name_ar,
        COUNT(*) FILTER (WHERE level IS NULL) as null_level
      FROM roles
    `);

    const checks = nullChecks.rows[0];
    if (checks.null_name > 0) {
      console.log(`   ❌ ${checks.null_name} أدوار بدون اسم إنجليزي`);
      process.exit(1);
    }
    if (checks.null_name_ar > 0) {
      console.log(`   ❌ ${checks.null_name_ar} أدوار بدون اسم عربي`);
      process.exit(1);
    }
    if (checks.null_level > 0) {
      console.log(`   ❌ ${checks.null_level} أدوار بدون مستوى`);
      process.exit(1);
    }
    console.log('   ✅ جميع الحقول مكتملة');

    // 5. عرض الإحصائيات حسب المستوى
    console.log('\n5️⃣ إحصائيات حسب المستوى:');
    const byLevel = await pool.query(`
      SELECT level, COUNT(*) as count
      FROM roles
      GROUP BY level
      ORDER BY 
        CASE level
          WHEN 'HQ' THEN 1
          WHEN 'BRANCH' THEN 2
          WHEN 'INCUBATOR' THEN 3
          WHEN 'PLATFORM' THEN 4
          WHEN 'OFFICE' THEN 5
          WHEN 'ALL' THEN 6
          ELSE 7
        END
    `);

    const levelNames = {
      'HQ': 'المكتب الرئيسي',
      'BRANCH': 'الفرع',
      'INCUBATOR': 'الحاضنة',
      'PLATFORM': 'المنصة',
      'OFFICE': 'المكتب',
      'ALL': 'جميع المستويات'
    };

    byLevel.rows.forEach(row => {
      console.log(`   - ${levelNames[row.level] || row.level}: ${row.count} دور`);
    });

    console.log('\n✅ جميع اختبارات الخلفية نجحت!');

  } catch (error) {
    console.error('\n❌ خطأ في الاختبار:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

testRolesBackend();
