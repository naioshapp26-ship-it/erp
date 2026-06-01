const db = require('./db');
const fs = require('fs');
const path = require('path');

async function runMultiTenantMigration() {
  console.log('🚀 بدء إنشاء نظام Multi-Tenant...');
  
  try {
    // قراءة ملف SQL
    const sqlFile = path.join(__dirname, 'add-multi-tenant-system.sql');
    const sql = fs.readFileSync(sqlFile, 'utf8');
    
    console.log('📋 تنفيذ SQL Migration...');
    await db.query(sql);
    
    console.log('✅ تم إنشاء نظام Multi-Tenant بنجاح!');
    
    // التحقق من البيانات
    console.log('\n📊 التحقق من البيانات...');
    
    const hqResult = await db.query('SELECT COUNT(*) as count FROM headquarters');
    console.log(`   - المقرات الرئيسية: ${hqResult.rows[0].count}`);
    
    const branchResult = await db.query('SELECT COUNT(*) as count FROM branches');
    console.log(`   - الفروع: ${branchResult.rows[0].count}`);
    
    const incubatorResult = await db.query('SELECT COUNT(*) as count FROM incubators');
    console.log(`   - الحاضنات: ${incubatorResult.rows[0].count}`);
    
    const platformResult = await db.query('SELECT COUNT(*) as count FROM platforms');
    console.log(`   - المنصات: ${platformResult.rows[0].count}`);
    
    const officeResult = await db.query('SELECT COUNT(*) as count FROM offices');
    console.log(`   - المكاتب: ${officeResult.rows[0].count}`);
    
    console.log('\n🎉 النظام جاهز للاستخدام!');
    
    // عرض بيانات تجريبية
    console.log('\n📋 البيانات التجريبية:');
    const hierarchyResult = await db.query(`
      SELECT 
        hq.name as hq_name,
        b.name as branch_name,
        i.name as incubator_name,
        p.name as platform_name
      FROM headquarters hq
      LEFT JOIN branches b ON b.hq_id = hq.id
      LEFT JOIN incubators i ON i.branch_id = b.id
      LEFT JOIN platforms p ON p.incubator_id = i.id
      ORDER BY hq.id, b.id, i.id, p.id
      LIMIT 10
    `);
    
    console.log('\nالهيكل الهرمي:');
    hierarchyResult.rows.forEach(row => {
      console.log(`   ${row.hq_name} → ${row.branch_name} → ${row.incubator_name} → ${row.platform_name}`);
    });
    
    process.exit(0);
  } catch (error) {
    console.error('❌ خطأ في إنشاء النظام:', error.message);
    console.error(error);
    process.exit(1);
  }
}

// تشغيل الـ migration
runMultiTenantMigration();
