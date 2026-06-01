const { Pool } = require('pg');
const fs = require('fs');

const pool = new Pool({
  connectionString: 'postgresql://postgres:PddzJpAQYezqknsntSzmCUlQYuYJldcT@crossover.proxy.rlwy.net:44255/railway',
  ssl: { rejectUnauthorized: false }
});

async function keepOnly33Roles() {
  try {
    console.log('🔄 حذف الأدوار الزائدة والاحتفاظ بـ 33 دور فقط...\n');

    // عرض الأدوار الحالية
    const beforeCount = await pool.query('SELECT COUNT(*) as count FROM roles');
    console.log(`📊 عدد الأدوار قبل الحذف: ${beforeCount.rows[0].count}\n`);

    // عرض الأدوار التي سيتم حذفها
    const toDelete = await pool.query(`
      SELECT name, name_ar
      FROM roles 
      WHERE name NOT IN (
        'SUPER_ADMIN', 'IT_MANAGER', 'HQ_EXECUTIVE_MANAGER', 'HQ_FINANCIAL_MANAGER',
        'HQ_MARKETING_MANAGER', 'HQ_PROCUREMENT_MANAGER', 'HQ_PR_MANAGER', 'LEGAL_MANAGER',
        'CONTENT_MANAGER', 'INITIATIVES_MANAGER', 'FREELANCER_MANAGER', 'EXECUTIVE_DESIGNER',
        'EXECUTIVE_MARKETER', 'EXECUTIVE_SALES', 'EXECUTIVE_CALLCENTER', 'EXECUTIVE_SOCIAL_MEDIA',
        'EDITOR', 'BRANCH_MANAGER', 'ASSISTANT_BRANCH_MANAGER', 'BRANCH_ADMIN',
        'INCUBATOR_MANAGER', 'ASSISTANT_INCUBATOR_MANAGER', 'INCUBATOR_ADMIN',
        'PLATFORM_MANAGER', 'ASSISTANT_PLATFORM_MANAGER', 'PLATFORM_ADMIN',
        'OFFICE_EXECUTIVE', 'OFFICE_ADMIN', 'LOGISTICS_EMPLOYEE', 'PERMANENT_TRAINER',
        'FREELANCER_TRAINER', 'VOLUNTEER_TRAINER', 'INITIATIVES_VOLUNTEER'
      )
      ORDER BY name
    `);

    if (toDelete.rowCount > 0) {
      console.log(`🗑️ الأدوار التي سيتم حذفها (${toDelete.rowCount}):`);
      toDelete.rows.forEach((role, index) => {
        console.log(`   ${index + 1}. ${role.name_ar || role.name} (${role.name})`);
      });
      console.log('');
    } else {
      console.log('✅ لا توجد أدوار زائدة للحذف\n');
    }

    // قراءة وتنفيذ ملف SQL
    const sqlContent = fs.readFileSync('keep-only-33-roles.sql', 'utf8');
    await pool.query(sqlContent);
    
    console.log('✅ تم تطبيق جميع التحديثات بنجاح!\n');
    
    // التحقق من النتائج
    const afterCount = await pool.query('SELECT COUNT(*) as count FROM roles');
    console.log(`📊 عدد الأدوار بعد التحديث: ${afterCount.rows[0].count}\n`);
    
    // عرض الأدوار المتبقية
    const remaining = await pool.query(`
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
    
    console.log(`📋 الأدوار المتبقية (${remaining.rowCount}):\n`);
    
    // تجميع حسب المستوى
    const byLevel = {};
    remaining.rows.forEach(role => {
      if (!byLevel[role.level]) {
        byLevel[role.level] = [];
      }
      byLevel[role.level].push(role);
    });
    
    const levelNames = {
      'HQ': 'المكتب الرئيسي',
      'BRANCH': 'الفرع',
      'INCUBATOR': 'الحاضنة',
      'PLATFORM': 'المنصة',
      'OFFICE': 'المكتب',
      'ALL': 'جميع المستويات'
    };
    
    for (const [level, roles] of Object.entries(byLevel)) {
      console.log(`📍 ${levelNames[level] || level} (${roles.length}):`);
      roles.forEach((role, index) => {
        console.log(`   ${index + 1}. ${role.name_ar} (${role.name})`);
      });
      console.log('');
    }

    if (remaining.rowCount === 33) {
      console.log('✅ النجاح! تم الاحتفاظ بـ 33 دور فقط كما هو مطلوب');
    } else {
      console.log(`⚠️ تحذير: عدد الأدوار ${remaining.rowCount} بدلاً من 33`);
    }

  } catch (error) {
    console.error('\n❌ خطأ:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

keepOnly33Roles();
