const { Pool } = require('pg');

// بيانات الاتصال بقاعدة البيانات
const pool = new Pool({
  connectionString: 'postgresql://postgres:PddzJpAQYezqknsntSzmCUlQYuYJldcT@crossover.proxy.rlwy.net:44255/railway',
  ssl: {
    rejectUnauthorized: false
  }
});

async function executePermissionsSystem() {
  const client = await pool.connect();
  
  try {
    console.log('🚀 بدء تنفيذ نظام الصلاحيات الكامل...\n');
    
    // 1. تنفيذ البنية الأساسية
    console.log('📋 المرحلة 1: إنشاء البنية الأساسية للصلاحيات...');
    const fs = require('fs');
    const implementSQL = fs.readFileSync('implement-full-permissions-matrix.sql', 'utf8');
    await client.query(implementSQL);
    console.log('✅ تم إنشاء البنية الأساسية بنجاح\n');
    
    // 2. ملء مصفوفة الصلاحيات
    console.log('📋 المرحلة 2: ملء مصفوفة الصلاحيات (33 دور × 8 أنظمة)...');
    const fillSQL = fs.readFileSync('fill-permissions-matrix.sql', 'utf8');
    await client.query(fillSQL);
    console.log('✅ تم ملء مصفوفة الصلاحيات بنجاح\n');
    
    // 3. التحقق من البيانات
    console.log('📊 المرحلة 3: التحقق من البيانات...\n');
    
    // عدد الأدوار
    const rolesResult = await client.query('SELECT COUNT(*) FROM roles WHERE is_active = TRUE');
    console.log(`✅ عدد الأدوار النشطة: ${rolesResult.rows[0].count}`);
    
    // عدد الأنظمة
    const systemsResult = await client.query('SELECT COUNT(*) FROM systems WHERE is_active = TRUE');
    console.log(`✅ عدد الأنظمة النشطة: ${systemsResult.rows[0].count}`);
    
    // عدد مستويات الصلاحيات
    const levelsResult = await client.query('SELECT COUNT(*) FROM permission_levels');
    console.log(`✅ عدد مستويات الصلاحيات: ${levelsResult.rows[0].count}`);
    
    // عدد السياسات الأمنية
    const policiesResult = await client.query('SELECT COUNT(*) FROM security_policies WHERE is_active = TRUE');
    console.log(`✅ عدد السياسات الأمنية: ${policiesResult.rows[0].count}`);
    
    // إجمالي الصلاحيات في المصفوفة
    const permissionsResult = await client.query('SELECT COUNT(*) FROM role_system_permissions WHERE is_active = TRUE');
    console.log(`✅ إجمالي الصلاحيات في المصفوفة: ${permissionsResult.rows[0].count}\n`);
    
    // 4. عرض ملخص الصلاحيات لكل دور
    console.log('📋 ملخص الصلاحيات لكل دور:\n');
    const summary = await client.query(`
      SELECT 
        r.job_title_ar,
        r.hierarchy_level,
        COUNT(rsp.id) AS systems_count,
        r.min_approval_limit,
        r.max_approval_limit
      FROM roles r
      LEFT JOIN role_system_permissions rsp ON r.id = rsp.role_id
      WHERE r.is_active = TRUE
      GROUP BY r.id, r.job_title_ar, r.hierarchy_level, r.min_approval_limit, r.max_approval_limit
      ORDER BY r.hierarchy_level, r.id
    `);
    
    console.log('┌──────────────────────────────────────┬────────┬──────────┬──────────────┬──────────────┐');
    console.log('│ الوظيفة                             │ المستوى│ الأنظمة  │ حد أدنى      │ حد أقصى      │');
    console.log('├──────────────────────────────────────┼────────┼──────────┼──────────────┼──────────────┤');
    
    summary.rows.forEach(row => {
      const title = (row.job_title_ar || '').padEnd(36);
      const level = row.hierarchy_level.toString().padEnd(6);
      const systems = row.systems_count.toString().padEnd(8);
      const min = (row.min_approval_limit || '0').toString().padEnd(12);
      const max = (row.max_approval_limit ? row.max_approval_limit.toString() : 'غير محدود').padEnd(12);
      console.log(`│ ${title} │ ${level} │ ${systems} │ ${min} │ ${max} │`);
    });
    
    console.log('└──────────────────────────────────────┴────────┴──────────┴──────────────┴──────────────┘\n');
    
    // 5. عرض الدوال المساعدة
    console.log('📋 الدوال المساعدة المتاحة:');
    console.log('  - check_user_system_permission(user_id, system_code, required_level)');
    console.log('  - check_user_approval_limit(user_id, amount)');
    console.log('  - get_user_permissions_summary(user_id)\n');
    
    console.log('✅ ✅ ✅ تم تنفيذ نظام الصلاحيات بنجاح! ✅ ✅ ✅\n');
    
  } catch (error) {
    console.error('❌ خطأ في التنفيذ:', error.message);
    console.error(error.stack);
    throw error;
  } finally {
    client.release();
  }
}

// تشغيل السكريبت
executePermissionsSystem()
  .then(() => {
    console.log('🎉 انتهى التنفيذ بنجاح');
    process.exit(0);
  })
  .catch(error => {
    console.error('💥 فشل التنفيذ:', error);
    process.exit(1);
  });
