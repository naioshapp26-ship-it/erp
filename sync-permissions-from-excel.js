#!/usr/bin/env node

/**
 * 🔄 مزامنة الصلاحيات من ملف Excel إلى قاعدة البيانات
 * 
 * هذا السكريبت يقرأ ملف صلاحيات.xlsx ويحدّث قاعدة البيانات بالصلاحيات الكاملة
 * لكل دور وظيفي في النظام، مع ربطها بالأنظمة الثمانية.
 */

const XLSX = require('xlsx');
const { Client } = require('pg');
require('dotenv').config();

// قراءة ملف Excel
const workbook = XLSX.readFile('صلاحيات.xlsx');

// قراءة مصفوفة الصلاحيات
const permissionsMatrix = XLSX.utils.sheet_to_json(workbook.Sheets['مصفوفة الصلاحيات']);
const approvalLimits = XLSX.utils.sheet_to_json(workbook.Sheets['حدود الموافقات المالية']);

// الأنظمة الثمانية
const SYSTEMS = {
  'النظام الإداري والموارد البشرية': 'hr_admin',
  'النظام المالي والمحاسبي': 'finance',
  'نظام المشتريات': 'procurement',
  'نظام المبيعات': 'sales',
  'نظام التسويق': 'marketing',
  'نظام سلاسل الإمداد واللوجستيات': 'logistics',
  'نظام السلامة': 'safety',
  'نظام المخازن': 'warehouse'
};

// تحويل مستوى الصلاحية إلى قيمة رقمية
function permissionLevelToValue(level) {
  const mapping = {
    'كامل': 'FULL',
    'عرض+موافقة': 'VIEW_APPROVE',
    'تنفيذي': 'EXECUTIVE',
    'عرض': 'VIEW',
    'قراءة': 'VIEW',
    'محدود': 'LIMITED',
    'لا يوجد': 'NONE',
    'كامل (تقني)': 'FULL',
    'كامل (فرع)': 'FULL',
    'كامل (حاضنة)': 'FULL',
    'كامل (منصة)': 'FULL',
    'كامل (محتوى)': 'FULL',
    'عرض+موافقة محدودة': 'VIEW_APPROVE',
    'عرض ميزانية': 'VIEW',
    'عرض (محدود)': 'LIMITED',
    'تنفيذي (محتوى)': 'EXECUTIVE'
  };
  
  return mapping[level?.trim()] || 'NONE';
}

// تحويل اسم الدور إلى كود
function roleNameToCode(name) {
  const mapping = {
    'سوبر آدمن': 'SUPER_ADMIN',
    'مدير برمجيات وتكنولوجيا المعلومات': 'IT_MANAGER',
    'مدير تنفيذي - المكتب الرئيسي': 'CEO',
    'مدير مالي - المكتب الرئيسي': 'CFO',
    'مدير تسويق - المكتب الرئيسي': 'CMO',
    'مدير مشتريات - المكتب الرئيسي': 'CPO',
    'مدير علاقات عامة - المكتب الرئيسي': 'PR_MANAGER',
    'مدير القانونية والاستشارات': 'LEGAL_MANAGER',
    'مدير تحرير محتوى ومقالات': 'CONTENT_MANAGER',
    'مدير المبادرات': 'INITIATIVES_MANAGER',
    'مدير فريلانسر': 'FREELANCER_MANAGER',
    'إداري تنفيذي مصمم': 'EXECUTIVE_DESIGNER',
    'إداري تنفيذي مسوق': 'EXECUTIVE_MARKETER',
    'إداري تنفيذي مبيعات': 'EXECUTIVE_SALES',
    'إداري تنفيذي كول سنتر': 'EXECUTIVE_CALL_CENTER',
    'إداري تنفيذي منصات التواصل': 'EXECUTIVE_SOCIAL_MEDIA',
    'محرر': 'EDITOR',
    'مدير فرع': 'BRANCH_MANAGER',
    'مساعد مدير فرع': 'ASSISTANT_BRANCH_MANAGER',
    'إداري فرع': 'BRANCH_ADMIN',
    'مدير حاضنة': 'INCUBATOR_MANAGER',
    'مساعد مدير حاضنة': 'ASSISTANT_INCUBATOR_MANAGER',
    'إداري حاضنة': 'INCUBATOR_ADMIN',
    'مدير منصة': 'PLATFORM_MANAGER',
    'مساعد مدير منصة': 'ASSISTANT_PLATFORM_MANAGER',
    'إداري منصة': 'PLATFORM_ADMIN',
    'مسؤول تنفيذي مكاتب': 'OFFICE_SUPERVISOR',
    'إداري تنفيذي مكاتب': 'OFFICE_ADMIN',
    'موظف لوجستيات': 'LOGISTICS_EMPLOYEE',
    'مدرب دائم': 'PERMANENT_TRAINER',
    'مدرب فريلانسر': 'FREELANCE_TRAINER',
    'مدرب متطوع': 'VOLUNTEER_TRAINER',
    'متطوع مبادرات': 'INITIATIVES_VOLUNTEER'
  };
  
  return mapping[name] || name.toUpperCase().replace(/\s+/g, '_').replace(/-/g, '_');
}

async function syncPermissions() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  
  try {
    await client.connect();
    console.log('✅ متصل بقاعدة البيانات\n');
    
    // تحميل الأنظمة ومستويات الصلاحيات من قاعدة البيانات
    const systemsResult = await client.query('SELECT id, system_code, system_name_ar FROM systems ORDER BY id');
    const systemsMap = {};
    systemsResult.rows.forEach(s => {
      systemsMap[s.system_name_ar] = s.id;
    });
    
    const permLevelsResult = await client.query('SELECT id, level_code, level_name_ar FROM permission_levels');
    const permLevelsMap = {};
    permLevelsResult.rows.forEach(p => {
      permLevelsMap[p.level_code] = p.id;
    });
    
    console.log(`📊 تم تحميل ${systemsResult.rows.length} نظام و ${permLevelsResult.rows.length} مستوى صلاحية\n`);
    console.log('📊 بدء مزامنة الصلاحيات...\n');
    
    let successCount = 0;
    let skipCount = 0;
    let updateCount = 0;
    
    for (const row of permissionsMatrix) {
      const roleName = row['المسمى الوظيفي'];
      const roleCode = roleNameToCode(roleName);
      const scope = row['نطاق الصلاحية'];
      
      // البحث عن الدور في قاعدة البيانات
      const roleResult = await client.query(
        'SELECT id FROM roles WHERE name = $1 OR name_ar = $2',
        [roleCode, roleName]
      );
      
      if (roleResult.rows.length === 0) {
        console.log(`⚠️  تخطي: ${roleName} - غير موجود في قاعدة البيانات`);
        skipCount++;
        continue;
      }
      
      const roleId = roleResult.rows[0].id;
      
      // معالجة كل نظام من الأنظمة الثمانية
      for (const [systemNameAr, systemId] of Object.entries(systemsMap)) {
        const permissionLevel = row[systemNameAr];
        if (!permissionLevel) continue;
        
        const permValue = permissionLevelToValue(permissionLevel);
        const permLevelId = permLevelsMap[permValue];
        
        if (!permLevelId) {
          console.log(`⚠️  مستوى صلاحية غير معروف: ${permValue} لـ ${roleName}`);
          continue;
        }
        
        // إدراج أو تحديث الصلاحيات
        try {
          const result = await client.query(`
            INSERT INTO role_system_permissions (
              role_id, system_id, permission_level_id, is_active, notes
            ) VALUES ($1, $2, $3, true, $4)
            ON CONFLICT (role_id, system_id) 
            DO UPDATE SET
              permission_level_id = EXCLUDED.permission_level_id,
              is_active = true,
              notes = EXCLUDED.notes,
              updated_at = CURRENT_TIMESTAMP
            RETURNING id
          `, [roleId, systemId, permLevelId, `نطاق: ${scope} | مستوى: ${permissionLevel}`]);
          
          if (result.rowCount > 0) {
            updateCount++;
          }
        } catch (err) {
          console.log(`⚠️  خطأ في إدراج: ${roleName} - ${systemNameAr}: ${err.message}`);
        }
      }
      
      successCount++;
      console.log(`✅ ${roleName}`);
    }
    
    console.log('\n' + '='.repeat(60));
    console.log(`📊 ملخص المزامنة:`);
    console.log(`  ✅ أدوار نجحت: ${successCount}`);
    console.log(`  ⚠️  أدوار متخطاة: ${skipCount}`);
    console.log(`  📝 صلاحيات محدثة/مضافة: ${updateCount}`);
    console.log('='.repeat(60));
    
    // عرض إحصائيات
    const stats = await client.query(`
      SELECT COUNT(DISTINCT role_id) as total_roles, COUNT(*) as total_permissions
      FROM role_system_permissions
    `);
    
    console.log(`\n📈 الإحصائيات النهائية:`);
    console.log(`  - إجمالي الأدوار بصلاحيات: ${stats.rows[0].total_roles}`);
    console.log(`  - إجمالي الصلاحيات: ${stats.rows[0].total_permissions}`);
    
  } catch (error) {
    console.error('❌ خطأ:', error.message);
    throw error;
  } finally {
    await client.end();
    console.log('\n✅ تم إغلاق الاتصال بقاعدة البيانات');
  }
}

// تشغيل السكريبت
syncPermissions().catch(error => {
  console.error('❌ فشل تنفيذ السكريبت:', error);
  process.exit(1);
});
