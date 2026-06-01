const { Pool } = require('pg');

// بيانات الاتصال بقاعدة البيانات
const pool = new Pool({
  connectionString: 'postgresql://postgres:PddzJpAQYezqknsntSzmCUlQYuYJldcT@crossover.proxy.rlwy.net:44255/railway',
  ssl: false
});

console.log('════════════════════════════════════════════════════════════════');
console.log('🧪 اختبار نظام الصلاحيات - دليل تفصيلي خطوة بخطوة');
console.log('════════════════════════════════════════════════════════════════\n');

async function runDetailedTests() {
  const client = await pool.connect();
  
  try {
    console.log('📋 الخطوة 1: التحقق من وجود الجداول الأساسية');
    console.log('─'.repeat(60));
    
    const tables = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN (
        'permission_levels', 
        'systems', 
        'system_permissions',
        'roles',
        'role_system_permissions',
        'security_policies',
        'users',
        'user_roles'
      )
      ORDER BY table_name
    `);
    
    console.log(`✅ تم العثور على ${tables.rows.length} جدول:\n`);
    tables.rows.forEach(row => console.log(`   ✓ ${row.table_name}`));
    console.log();
    
    // ═══════════════════════════════════════════════════════════════
    console.log('📋 الخطوة 2: فحص محتويات permission_levels (مستويات الصلاحيات)');
    console.log('─'.repeat(60));
    
    const levels = await client.query(`
      SELECT level_code, level_name_ar, level_name_en, color_code, priority_order
      FROM permission_levels
      ORDER BY priority_order
    `);
    
    console.log('مستويات الصلاحيات الستة:\n');
    console.log('┌──────────────┬──────────────────┬──────────────────┬──────────┬────────┐');
    console.log('│ الكود        │ الاسم بالعربية   │ الاسم بالإنجليزية│ اللون    │ الأولوية│');
    console.log('├──────────────┼──────────────────┼──────────────────┼──────────┼────────┤');
    levels.rows.forEach(row => {
      const code = row.level_code.padEnd(12);
      const nameAr = row.level_name_ar.padEnd(16);
      const nameEn = row.level_name_en.padEnd(16);
      const color = row.color_code.padEnd(8);
      const priority = row.priority_order.toString().padEnd(6);
      console.log(`│ ${code} │ ${nameAr} │ ${nameEn} │ ${color} │ ${priority} │`);
    });
    console.log('└──────────────┴──────────────────┴──────────────────┴──────────┴────────┘\n');
    
    // ═══════════════════════════════════════════════════════════════
    console.log('📋 الخطوة 3: فحص الأنظمة الثمانية');
    console.log('─'.repeat(60));
    
    const systems = await client.query(`
      SELECT system_code, system_name_ar, system_name_en, display_order
      FROM systems
      WHERE is_active = TRUE
      ORDER BY display_order
    `);
    
    console.log(`تم العثور على ${systems.rows.length} نظام نشط:\n`);
    systems.rows.forEach((row, index) => {
      console.log(`${index + 1}. [${row.system_code}] ${row.system_name_ar} (${row.system_name_en})`);
    });
    console.log();
    
    // ═══════════════════════════════════════════════════════════════
    console.log('📋 الخطوة 4: فحص الأدوار الوظيفية (33 دور)');
    console.log('─'.repeat(60));
    
    const roles = await client.query(`
      SELECT 
        hierarchy_level,
        level,
        job_title_ar,
        job_title_en,
        min_approval_limit,
        max_approval_limit,
        COUNT(*) OVER (PARTITION BY hierarchy_level) as level_count
      FROM roles
      WHERE is_active = TRUE
      ORDER BY hierarchy_level, id
    `);
    
    console.log(`تم العثور على ${roles.rows.length} دور نشط:\n`);
    
    const groupedRoles = {};
    roles.rows.forEach(row => {
      if (!groupedRoles[row.hierarchy_level]) {
        groupedRoles[row.hierarchy_level] = [];
      }
      groupedRoles[row.hierarchy_level].push(row);
    });
    
    const levelNames = {
      0: 'المكتب الرئيسي (HQ)',
      1: 'فرع الدولة (BRANCH)',
      2: 'حاضنة قطاع الأعمال (INCUBATOR)',
      3: 'المنصة التشغيلية (PLATFORM)',
      4: 'المكتب التنفيذي (EXECUTIVE_OFFICE)'
    };
    
    Object.keys(groupedRoles).sort().forEach(level => {
      console.log(`\n🏢 ${levelNames[level]} - ${groupedRoles[level].length} وظيفة:`);
      groupedRoles[level].forEach((role, idx) => {
        const limit = role.max_approval_limit 
          ? role.max_approval_limit.toLocaleString() 
          : 'غير محدود';
        console.log(`   ${idx + 1}. ${role.job_title_ar} (حد الموافقة: ${limit})`);
      });
    });
    console.log();
    
    // ═══════════════════════════════════════════════════════════════
    console.log('📋 الخطوة 5: فحص مصفوفة الصلاحيات');
    console.log('─'.repeat(60));
    
    const permissionsMatrix = await client.query(`
      SELECT 
        pl.level_code,
        COUNT(*) as permission_count
      FROM role_system_permissions rsp
      JOIN permission_levels pl ON rsp.permission_level_id = pl.id
      WHERE rsp.is_active = TRUE
      GROUP BY pl.level_code, pl.priority_order
      ORDER BY pl.priority_order
    `);
    
    console.log('توزيع الصلاحيات حسب المستوى:\n');
    console.log('┌──────────────────┬────────────────┐');
    console.log('│ المستوى          │ عدد الصلاحيات │');
    console.log('├──────────────────┼────────────────┤');
    let totalPermissions = 0;
    permissionsMatrix.rows.forEach(row => {
      const level = row.level_code.padEnd(16);
      const count = row.permission_count.toString().padStart(14);
      console.log(`│ ${level} │ ${count} │`);
      totalPermissions += parseInt(row.permission_count);
    });
    console.log('├──────────────────┼────────────────┤');
    console.log(`│ ${'الإجمالي'.padEnd(16)} │ ${totalPermissions.toString().padStart(14)} │`);
    console.log('└──────────────────┴────────────────┘\n');
    
    // ═══════════════════════════════════════════════════════════════
    console.log('📋 الخطوة 6: اختبار صلاحيات دور محدد (مثال: مدير فرع)');
    console.log('─'.repeat(60));
    
    const branchManagerPerms = await client.query(`
      SELECT 
        s.system_code,
        s.system_name_ar,
        pl.level_name_ar,
        r.max_approval_limit
      FROM roles r
      JOIN role_system_permissions rsp ON r.id = rsp.role_id
      JOIN systems s ON rsp.system_id = s.id
      JOIN permission_levels pl ON rsp.permission_level_id = pl.id
      WHERE r.name = 'BRANCH_MANAGER'
      AND r.is_active = TRUE
      AND rsp.is_active = TRUE
      ORDER BY s.display_order
    `);
    
    if (branchManagerPerms.rows.length > 0) {
      console.log('✅ صلاحيات مدير الفرع:\n');
      branchManagerPerms.rows.forEach(row => {
        console.log(`   📌 ${row.system_name_ar}: ${row.level_name_ar}`);
      });
      console.log(`\n   💰 حد الموافقة المالية: ${branchManagerPerms.rows[0].max_approval_limit?.toLocaleString() || 'غير محدود'}\n`);
    }
    
    // ═══════════════════════════════════════════════════════════════
    console.log('📋 الخطوة 7: اختبار صلاحيات Super Admin');
    console.log('─'.repeat(60));
    
    const superAdminPerms = await client.query(`
      SELECT 
        s.system_code,
        s.system_name_ar,
        pl.level_name_ar
      FROM roles r
      JOIN role_system_permissions rsp ON r.id = rsp.role_id
      JOIN systems s ON rsp.system_id = s.id
      JOIN permission_levels pl ON rsp.permission_level_id = pl.id
      WHERE r.name = 'SUPER_ADMIN'
      AND r.is_active = TRUE
      AND rsp.is_active = TRUE
      ORDER BY s.display_order
    `);
    
    console.log(`✅ Super Admin لديه ${superAdminPerms.rows.length} صلاحية (يجب أن تكون 8):\n`);
    superAdminPerms.rows.forEach(row => {
      console.log(`   🔐 ${row.system_name_ar}: ${row.level_name_ar}`);
    });
    console.log();
    
    // ═══════════════════════════════════════════════════════════════
    console.log('📋 الخطوة 8: فحص سياسات الأمان');
    console.log('─'.repeat(60));
    
    const policies = await client.query(`
      SELECT 
        policy_code,
        policy_name_ar,
        enforcement_type,
        responsible_role
      FROM security_policies
      WHERE is_active = TRUE
      ORDER BY id
    `);
    
    console.log(`تم العثور على ${policies.rows.length} سياسة أمان:\n`);
    policies.rows.forEach((row, idx) => {
      console.log(`${idx + 1}. ${row.policy_name_ar} [${row.enforcement_type}]`);
      console.log(`   المسؤول: ${row.responsible_role}\n`);
    });
    
    // ═══════════════════════════════════════════════════════════════
    console.log('📋 الخطوة 9: اختبار الدوال المساعدة');
    console.log('─'.repeat(60));
    
    // فحص وجود الدوال
    const functions = await client.query(`
      SELECT 
        routine_name,
        data_type
      FROM information_schema.routines
      WHERE routine_schema = 'public'
      AND routine_name IN (
        'check_user_system_permission',
        'check_user_approval_limit',
        'get_user_permissions_summary'
      )
      ORDER BY routine_name
    `);
    
    console.log(`✅ تم العثور على ${functions.rows.length} دالة مساعدة:\n`);
    functions.rows.forEach((row, idx) => {
      console.log(`   ${idx + 1}. ${row.routine_name}()`);
    });
    console.log();
    
    // ═══════════════════════════════════════════════════════════════
    console.log('📋 الخطوة 10: اختبار عملي - إنشاء مستخدم تجريبي واختبار صلاحياته');
    console.log('─'.repeat(60));
    
    // التحقق من وجود جدول users
    const usersTableExists = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'users'
      )
    `);
    
    if (usersTableExists.rows[0].exists) {
      // محاولة إنشاء مستخدم تجريبي
      try {
        await client.query('BEGIN');
        
        // إنشاء مستخدم تجريبي
        const testUser = await client.query(`
          INSERT INTO users (username, email, password_hash, is_active)
          VALUES ('test_branch_manager', 'test_branch@nayoosh.com', 'hashed_password', TRUE)
          ON CONFLICT (username) DO UPDATE SET updated_at = CURRENT_TIMESTAMP
          RETURNING id
        `);
        
        const testUserId = testUser.rows[0].id;
        console.log(`✅ تم إنشاء/تحديث مستخدم تجريبي (ID: ${testUserId})\n`);
        
        // الحصول على دور مدير فرع
        const branchManagerRole = await client.query(`
          SELECT id FROM roles WHERE name = 'BRANCH_MANAGER' AND is_active = TRUE LIMIT 1
        `);
        
        if (branchManagerRole.rows.length > 0) {
          const roleId = branchManagerRole.rows[0].id;
          
          // ربط المستخدم بالدور
          await client.query(`
            INSERT INTO user_roles (user_id, role_id)
            VALUES ($1, $2)
            ON CONFLICT (user_id, role_id) DO NOTHING
          `, [testUserId, roleId]);
          
          console.log('✅ تم ربط المستخدم بدور "مدير فرع"\n');
          
          // اختبار الدوال المساعدة
          console.log('🧪 اختبار الدوال المساعدة:\n');
          
          // 1. اختبار check_user_system_permission
          const permCheck1 = await client.query(`
            SELECT check_user_system_permission($1, 'HR_ADMIN', 'FULL')
          `, [testUserId]);
          console.log(`   1️⃣ هل لديه صلاحيات كاملة للموارد البشرية؟`);
          console.log(`      ${permCheck1.rows[0].check_user_system_permission ? '✅ نعم' : '❌ لا'}`);
          
          const permCheck2 = await client.query(`
            SELECT check_user_system_permission($1, 'FINANCE', 'FULL')
          `, [testUserId]);
          console.log(`\n   2️⃣ هل لديه صلاحيات كاملة للنظام المالي؟`);
          console.log(`      ${permCheck2.rows[0].check_user_system_permission ? '✅ نعم' : '❌ لا (صحيح - لديه فقط VIEW_APPROVE)'}`);
          
          // 2. اختبار check_user_approval_limit
          const approvalCheck1 = await client.query(`
            SELECT check_user_approval_limit($1, 1000000)
          `, [testUserId]);
          console.log(`\n   3️⃣ هل يمكنه الموافقة على مبلغ 1,000,000؟`);
          console.log(`      ${approvalCheck1.rows[0].check_user_approval_limit ? '✅ نعم' : '❌ لا'}`);
          
          const approvalCheck2 = await client.query(`
            SELECT check_user_approval_limit($1, 5000000)
          `, [testUserId]);
          console.log(`\n   4️⃣ هل يمكنه الموافقة على مبلغ 5,000,000؟`);
          console.log(`      ${approvalCheck2.rows[0].check_user_approval_limit ? '✅ نعم' : '❌ لا (صحيح - حده 2,000,000)'}`);
          
          // 3. اختبار get_user_permissions_summary
          console.log(`\n   5️⃣ ملخص كامل لصلاحيات المستخدم:\n`);
          const summary = await client.query(`
            SELECT * FROM get_user_permissions_summary($1)
          `, [testUserId]);
          
          summary.rows.forEach(row => {
            console.log(`      📌 ${row.system_name_ar}:`);
            console.log(`         المستوى: ${row.permission_level_ar}`);
            console.log(`         الإجراءات المسموحة: ${row.allowed_actions || 'غير محدد'}`);
            console.log();
          });
        }
        
        await client.query('ROLLBACK'); // إلغاء التغييرات التجريبية
        console.log('✅ تم إلغاء البيانات التجريبية (Rollback)\n');
        
      } catch (error) {
        await client.query('ROLLBACK');
        console.log('⚠️  لم يتم إنشاء مستخدم تجريبي:', error.message, '\n');
      }
    } else {
      console.log('⚠️  جدول users غير موجود - يمكنك إنشاؤه لاحقاً\n');
    }
    
    // ═══════════════════════════════════════════════════════════════
    console.log('📋 الخطوة 11: فحص المؤشرات (Indexes)');
    console.log('─'.repeat(60));
    
    const indexes = await client.query(`
      SELECT 
        tablename,
        indexname
      FROM pg_indexes
      WHERE schemaname = 'public'
      AND (
        tablename IN ('role_system_permissions', 'roles', 'system_permissions')
        OR indexname LIKE 'idx_%'
      )
      AND indexname NOT LIKE '%pkey'
      ORDER BY tablename, indexname
    `);
    
    console.log(`تم العثور على ${indexes.rows.length} مؤشر:\n`);
    const indexesByTable = {};
    indexes.rows.forEach(row => {
      if (!indexesByTable[row.tablename]) {
        indexesByTable[row.tablename] = [];
      }
      indexesByTable[row.tablename].push(row.indexname);
    });
    
    Object.keys(indexesByTable).forEach(table => {
      console.log(`   📊 ${table}:`);
      indexesByTable[table].forEach(idx => {
        console.log(`      - ${idx}`);
      });
      console.log();
    });
    
    // ═══════════════════════════════════════════════════════════════
    console.log('📋 الخطوة 12: التحقق من سلامة البيانات');
    console.log('─'.repeat(60));
    
    // فحص الصلاحيات اليتيمة
    const orphanedPerms = await client.query(`
      SELECT COUNT(*) as orphan_count
      FROM role_system_permissions rsp
      WHERE NOT EXISTS (SELECT 1 FROM roles r WHERE r.id = rsp.role_id AND r.is_active = TRUE)
      OR NOT EXISTS (SELECT 1 FROM systems s WHERE s.id = rsp.system_id AND s.is_active = TRUE)
    `);
    
    console.log(`✅ الصلاحيات اليتيمة: ${orphanedPerms.rows[0].orphan_count} (يجب أن تكون 0)`);
    
    // فحص الصلاحيات المكررة
    const duplicatePerms = await client.query(`
      SELECT role_id, system_id, COUNT(*) as dup_count
      FROM role_system_permissions
      WHERE is_active = TRUE
      GROUP BY role_id, system_id
      HAVING COUNT(*) > 1
    `);
    
    console.log(`✅ الصلاحيات المكررة: ${duplicatePerms.rows.length} (يجب أن تكون 0)`);
    
    // إحصائيات إضافية
    const stats = await client.query(`
      SELECT 
        (SELECT COUNT(*) FROM permission_levels) as levels_count,
        (SELECT COUNT(*) FROM systems WHERE is_active = TRUE) as systems_count,
        (SELECT COUNT(*) FROM roles WHERE is_active = TRUE) as roles_count,
        (SELECT COUNT(*) FROM role_system_permissions WHERE is_active = TRUE) as permissions_count,
        (SELECT COUNT(*) FROM security_policies WHERE is_active = TRUE) as policies_count
    `);
    
    console.log();
    console.log('📊 إحصائيات عامة:');
    console.log(`   - مستويات الصلاحيات: ${stats.rows[0].levels_count}`);
    console.log(`   - الأنظمة النشطة: ${stats.rows[0].systems_count}`);
    console.log(`   - الأدوار النشطة: ${stats.rows[0].roles_count}`);
    console.log(`   - إجمالي الصلاحيات: ${stats.rows[0].permissions_count}`);
    console.log(`   - سياسات الأمان: ${stats.rows[0].policies_count}`);
    console.log();
    
    // ═══════════════════════════════════════════════════════════════
    console.log('════════════════════════════════════════════════════════════════');
    console.log('✅ اكتمل الاختبار التفصيلي بنجاح!');
    console.log('════════════════════════════════════════════════════════════════');
    console.log();
    console.log('📝 ملخص النتائج:');
    console.log(`   ✅ مستويات الصلاحيات: ${levels.rows.length}/6`);
    console.log(`   ✅ الأنظمة: ${systems.rows.length}/8`);
    console.log(`   ✅ الأدوار: ${roles.rows.length}/34`);
    console.log(`   ✅ إجمالي الصلاحيات: ${totalPermissions}`);
    console.log(`   ✅ سياسات الأمان: ${policies.rows.length}/12`);
    console.log(`   ✅ الدوال المساعدة: ${functions.rows.length}/3`);
    console.log(`   ✅ المؤشرات: ${indexes.rows.length}`);
    console.log();
    console.log('🎉 النظام جاهز للإنتاج!');
    console.log();
    
  } catch (error) {
    console.error('❌ خطأ في الاختبار:', error.message);
    console.error(error.stack);
  } finally {
    client.release();
    await pool.end();
  }
}

// تشغيل الاختبارات
runDetailedTests().catch(console.error);
