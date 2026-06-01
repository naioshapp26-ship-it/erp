#!/usr/bin/env node

/**
 * 🔄 إضافة جميع الأدوار الوظيفية (33 دور) من ملف Excel إلى قاعدة البيانات
 */

const XLSX = require('xlsx');
const { Client } = require('pg');
require('dotenv').config();

// قراءة ملف Excel
const workbook = XLSX.readFile('صلاحيات.xlsx');
const permissionsMatrix = XLSX.utils.sheet_to_json(workbook.Sheets['مصفوفة الصلاحيات']);
const approvalLimits = XLSX.utils.sheet_to_json(workbook.Sheets['حدود الموافقات المالية']);

// تحويل اسم الدور إلى كود إنجليزي
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

// تحديد المستوى التنظيمي
function getHierarchyLevel(scope) {
  if (scope === 'جميع الوحدات' || scope === 'جميع الفروع') return 0;
  if (scope === 'المكتب الرئيسي') return 0;
  if (scope === 'فرع محدد') return 1;
  if (scope === 'حاضنة محددة') return 2;
  if (scope === 'منصة محددة') return 3;
  if (scope === 'مكتب محدد') return 4;
  if (scope === 'قسم محدد') return 5;
  return 0;
}

// تحديد level
function getLevel(scope) {
  if (scope === 'جميع الوحدات' || scope === 'جميع الفروع') return 'HQ';
  if (scope === 'المكتب الرئيسي') return 'HQ';
  if (scope === 'فرع محدد') return 'BRANCH';
  if (scope === 'حاضنة محددة') return 'INCUBATOR';
  if (scope === 'منصة محددة') return 'PLATFORM';
  if (scope === 'مكتب محدد') return 'OFFICE';
  if (scope === 'قسم محدد') return 'DEPARTMENT';
  return 'HQ';
}

async function addAllRoles() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  
  try {
    await client.connect();
    console.log('✅ متصل بقاعدة البيانات\n');
    console.log('📊 بدء إضافة الأدوار...\n');
    
    let addedCount = 0;
    let updatedCount = 0;
    let existingCount = 0;
    
    for (const row of permissionsMatrix) {
      const nameAr = row['المسمى الوظيفي'];
      const nameEn = roleNameToCode(nameAr);
      const scope = row['نطاق الصلاحية'];
      const organizationalLevel = row['المستوى التنظيمي'];
      const level = getLevel(scope);
      const hierarchyLevel = getHierarchyLevel(scope);
      
      // البحث عن الحد المالي من ورقة الموافقات
      const approvalLimit = approvalLimits.find(a => a['المستوى الوظيفي'] === nameAr);
      const minLimit = '0.00';
      const maxLimit = approvalLimit ? (approvalLimit['الحد الأقصى (بالريال/دولار)'] === 'غير محدود' ? null : approvalLimit['الحد الأقصى (بالريال/دولار)']) : null;
      const notes = approvalLimit ? approvalLimit['ملاحظات'] : '';
      
      try {
        // محاولة الإدراج
        const result = await client.query(`
          INSERT INTO roles (
            name, name_ar, job_title_ar, job_title_en, description,
            level, hierarchy_level, 
            min_approval_limit, max_approval_limit,
            approval_notes_ar, approval_notes_en,
            is_system, is_active
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, false, true)
          ON CONFLICT (name) 
          DO UPDATE SET
            name_ar = EXCLUDED.name_ar,
            job_title_ar = EXCLUDED.job_title_ar,
            job_title_en = EXCLUDED.job_title_en,
            level = EXCLUDED.level,
            hierarchy_level = EXCLUDED.hierarchy_level,
            min_approval_limit = EXCLUDED.min_approval_limit,
            max_approval_limit = EXCLUDED.max_approval_limit,
            approval_notes_ar = EXCLUDED.approval_notes_ar,
            updated_at = CURRENT_TIMESTAMP
          RETURNING id, (xmax = 0) AS inserted
        `, [
          nameEn, nameAr, nameAr, nameEn, `${nameAr} - ${scope}`,
          level, hierarchyLevel,
          minLimit, maxLimit,
          notes, notes
        ]);
        
        if (result.rows[0].inserted) {
          addedCount++;
          console.log(`✅ أُضيف: ${nameAr} (${nameEn})`);
        } else {
          updatedCount++;
          console.log(`🔄 حُدّث: ${nameAr} (${nameEn})`);
        }
        
      } catch (error) {
        existingCount++;
        console.log(`⚠️  موجود: ${nameAr} - ${error.message}`);
      }
    }
    
    console.log('\n' + '='.repeat(60));
    console.log(`📊 ملخص الإضافة:`);
    console.log(`  ✅ أدوار مضافة: ${addedCount}`);
    console.log(`  🔄 أدوار محدثة: ${updatedCount}`);
    console.log(`  ⚠️  أدوار موجودة: ${existingCount}`);
    console.log('='.repeat(60));
    
    // عرض إجمالي الأدوار
    const total = await client.query('SELECT COUNT(*) FROM roles');
    console.log(`\n📈 إجمالي الأدوار في قاعدة البيانات: ${total.rows[0].count}`);
    
  } catch (error) {
    console.error('❌ خطأ:', error.message);
    throw error;
  } finally {
    await client.end();
    console.log('\n✅ تم إغلاق الاتصال بقاعدة البيانات');
  }
}

// تشغيل السكريبت
addAllRoles().catch(error => {
  console.error('❌ فشل تنفيذ السكريبت:', error);
  process.exit(1);
});
