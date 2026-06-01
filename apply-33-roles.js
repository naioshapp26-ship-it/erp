const { Pool } = require('pg');
const fs = require('fs');

const pool = new Pool({
  connectionString: 'postgresql://postgres:PddzJpAQYezqknsntSzmCUlQYuYJldcT@crossover.proxy.rlwy.net:44255/railway',
  ssl: { rejectUnauthorized: false }
});

async function add33Roles() {
  try {
    console.log('🔄 إضافة الأدوار الـ 33 الجديدة...\n');

    // قراءة ملف SQL
    const sqlContent = fs.readFileSync('add-33-roles.sql', 'utf8');
    
    // تنفيذ SQL
    await pool.query(sqlContent);
    
    console.log('✅ تم تطبيق جميع التحديثات بنجاح!\n');
    
    // التحقق من النتائج
    console.log('📊 التحقق من الأدوار الجديدة...\n');
    
    const allRoles = await pool.query(`
      SELECT name, name_ar, level
      FROM roles
      ORDER BY 
        CASE level
          WHEN 'HQ' THEN 1
          WHEN 'BRANCH' THEN 2
          WHEN 'INCUBATOR' THEN 3
          WHEN 'PLATFORM' THEN 4
          WHEN 'OFFICE' THEN 5
          WHEN 'ALL' THEN 6
          ELSE 7
        END,
        name_ar
    `);
    
    console.log(`إجمالي الأدوار: ${allRoles.rowCount}\n`);
    
    // تجميع حسب المستوى
    const byLevel = {};
    allRoles.rows.forEach(role => {
      if (!byLevel[role.level]) {
        byLevel[role.level] = [];
      }
      byLevel[role.level].push(role);
    });
    
    // عرض حسب المستوى
    const levelNames = {
      'HQ': 'المكتب الرئيسي',
      'BRANCH': 'الفرع',
      'INCUBATOR': 'الحاضنة',
      'PLATFORM': 'المنصة',
      'OFFICE': 'المكتب',
      'ALL': 'جميع المستويات'
    };
    
    for (const [level, roles] of Object.entries(byLevel)) {
      console.log(`\n📍 ${levelNames[level] || level} (${roles.length}):`);
      roles.forEach((role, index) => {
        console.log(`   ${index + 1}. ${role.name_ar} (${role.name})`);
      });
    }
    
    // التحقق من عدم وجود تكرارات
    const duplicates = await pool.query(`
      SELECT name, COUNT(*) as count
      FROM roles
      GROUP BY name
      HAVING COUNT(*) > 1
    `);
    
    if (duplicates.rowCount > 0) {
      console.log('\n⚠️ تكرارات موجودة:');
      duplicates.rows.forEach(dup => {
        console.log(`   - ${dup.name}: ${dup.count} مرات`);
      });
    } else {
      console.log('\n✅ لا توجد تكرارات');
    }

  } catch (error) {
    console.error('\n❌ خطأ:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

add33Roles();
