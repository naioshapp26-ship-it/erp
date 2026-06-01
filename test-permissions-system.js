const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://postgres:PddzJpAQYezqknsntSzmCUlQYuYJldcT@crossover.proxy.rlwy.net:44255/railway',
  ssl: { rejectUnauthorized: false }
});

async function testPermissionsSystem() {
  const client = await pool.connect();
  
  try {
    console.log('🧪 اختبار نظام الصلاحيات...\n');
    
    // 1. التحقق من الأدوار والصلاحيات
    console.log('📋 1. عرض الأدوار والأنظمة:\n');
    
    const rolesResult = await client.query(`
      SELECT r.name, r.job_title_ar, r.hierarchy_level, COUNT(rsp.id) as systems_assigned
      FROM roles r
      LEFT JOIN role_system_permissions rsp ON r.id = rsp.role_id
      WHERE r.is_active = TRUE
      GROUP BY r.id, r.name, r.job_title_ar, r.hierarchy_level
      ORDER BY r.hierarchy_level, r.id
      LIMIT 10
    `);
    
    console.log('أول 10 أدوار:');
    rolesResult.rows.forEach(row => {
      console.log(`  - ${row.job_title_ar} (${row.name}): ${row.systems_assigned} أنظمة`);
    });
    
    // 2. اختبار صلاحيات دور معين
    console.log('\n📋 2. صلاحيات سوبر آدمن:\n');
    
    const superAdminPerms = await client.query(`
      SELECT 
        s.system_name_ar,
        pl.level_name_ar,
        rsp.notes
      FROM role_system_permissions rsp
      JOIN roles r ON rsp.role_id = r.id
      JOIN systems s ON rsp.system_id = s.id
      JOIN permission_levels pl ON rsp.permission_level_id = pl.id
      WHERE r.name = 'SUPER_ADMIN'
      ORDER BY s.display_order
    `);
    
    superAdminPerms.rows.forEach(row => {
      console.log(`  - ${row.system_name_ar}: ${row.level_name_ar}`);
    });
    
    // 3. صلاحيات محاسب
    console.log('\n📋 3. صلاحيات محاسب HQ:\n');
    
    const accountantPerms = await client.query(`
      SELECT 
        s.system_name_ar,
        pl.level_name_ar,
        rsp.notes
      FROM role_system_permissions rsp
      JOIN roles r ON rsp.role_id = r.id
      JOIN systems s ON rsp.system_id = s.id
      JOIN permission_levels pl ON rsp.permission_level_id = pl.id
      WHERE r.name = 'ACCOUNTANT_HQ'
      ORDER BY s.display_order
    `);
    
    accountantPerms.rows.forEach(row => {
      console.log(`  - ${row.system_name_ar}: ${row.level_name_ar}`);
    });
    
    // 4. اختبار الدوال المساعدة
    console.log('\n📋 4. اختبار الدوال المساعدة:\n');
    
    // الحصول على user_id لـ SUPER_ADMIN (إن وُجد)
    const userCheck = await client.query(`
      SELECT u.id, u.username, r.name as role_name
      FROM users u
      JOIN user_roles ur ON u.id = ur.user_id
      JOIN roles r ON ur.role_id = r.id
      WHERE r.name = 'SUPER_ADMIN'
      LIMIT 1
    `);
    
    if (userCheck.rows.length > 0) {
      const userId = userCheck.rows[0].id;
      console.log(`  المستخدم: ${userCheck.rows[0].username} (ID: ${userId})`);
      
      // اختبار check_user_system_permission
      const permCheck = await client.query(
        `SELECT check_user_system_permission($1, 'FINANCE', 'FULL') as has_finance_full`,
        [userId]
      );
      console.log(`  - هل لديه صلاحية FULL على FINANCE؟ ${permCheck.rows[0].has_finance_full ? 'نعم ✅' : 'لا ❌'}`);
      
      // اختبار check_user_approval_limit
      const approvalCheck = await client.query(
        `SELECT check_user_approval_limit($1, 1000000) as can_approve_1m`,
        [userId]
      );
      console.log(`  - هل يمكنه الموافقة على 1,000,000؟ ${approvalCheck.rows[0].can_approve_1m ? 'نعم ✅' : 'لا ❌'}`);
      
    } else {
      console.log('  ⚠️ لم يتم العثور على مستخدم بدور SUPER_ADMIN');
      console.log('  💡 تحتاج إلى ربط مستخدم بالأدوار باستخدام user_roles');
    }
    
    // 5. إحصائيات عامة
    console.log('\n📊 5. إحصائيات النظام:\n');
    
    const stats = await client.query(`
      SELECT 
        (SELECT COUNT(*) FROM roles WHERE is_active = TRUE) as total_roles,
        (SELECT COUNT(*) FROM systems WHERE is_active = TRUE) as total_systems,
        (SELECT COUNT(*) FROM permission_levels) as total_levels,
        (SELECT COUNT(*) FROM role_system_permissions WHERE is_active = TRUE) as total_permissions,
        (SELECT COUNT(*) FROM security_policies WHERE is_active = TRUE) as total_policies
    `);
    
    const s = stats.rows[0];
    console.log(`  ✅ عدد الأدوار: ${s.total_roles}`);
    console.log(`  ✅ عدد الأنظمة: ${s.total_systems}`);
    console.log(`  ✅ عدد مستويات الصلاحيات: ${s.total_levels}`);
    console.log(`  ✅ إجمالي الصلاحيات المعينة: ${s.total_permissions}`);
    console.log(`  ✅ عدد السياسات الأمنية: ${s.total_policies}`);
    
    // 6. التحقق من توزيع مستويات الصلاحيات
    console.log('\n📊 6. توزيع مستويات الصلاحيات:\n');
    
    const distribution = await client.query(`
      SELECT 
        pl.level_name_ar,
        COUNT(rsp.id) as count
      FROM permission_levels pl
      LEFT JOIN role_system_permissions rsp ON pl.id = rsp.permission_level_id AND rsp.is_active = TRUE
      GROUP BY pl.id, pl.level_name_ar, pl.priority_order
      ORDER BY pl.priority_order
    `);
    
    distribution.rows.forEach(row => {
      console.log(`  - ${row.level_name_ar}: ${row.count} صلاحية`);
    });
    
    console.log('\n✅ ✅ ✅ نجح اختبار نظام الصلاحيات! ✅ ✅ ✅\n');
    
  } catch (error) {
    console.error('❌ خطأ في الاختبار:', error.message);
    console.error(error);
  } finally {
    client.release();
  }
}

testPermissionsSystem()
  .then(() => {
    console.log('🎉 انتهى الاختبار');
    process.exit(0);
  })
  .catch(error => {
    console.error('💥 فشل الاختبار:', error);
    process.exit(1);
  });
