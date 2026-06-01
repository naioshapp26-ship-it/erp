const { Pool } = require('pg');

// Database connection using provided credentials
const pool = new Pool({
  connectionString: 'postgresql://postgres:PddzJpAQYezqknsntSzmCUlQYuYJldcT@crossover.proxy.rlwy.net:44255/railway'
});

async function updatePlatformTypes() {
  const client = await pool.connect();
  
  try {
    console.log('🔄 جاري تحديث أنواع المنصات...\n');
    
    // تحديث الأنواع القديمة
    const updateResult = await client.query(`
      UPDATE platforms 
      SET platform_type = CASE 
          WHEN platform_type = 'ECOMMERCE' THEN 'STORES'
          WHEN platform_type = 'MARKETPLACE' THEN 'STORES'
          WHEN platform_type = 'SAAS' THEN 'PROFESSIONAL'
          WHEN platform_type = 'EDUCATION' THEN 'EDUCATION'
          WHEN platform_type = 'OTHER' THEN 'OTHER'
          ELSE platform_type
      END
      RETURNING id, name, platform_type
    `);
    
    console.log(`✅ تم تحديث ${updateResult.rowCount} منصة\n`);
    
    if (updateResult.rowCount > 0) {
      console.log('المنصات المحدثة:');
      updateResult.rows.forEach(row => {
        console.log(`  - ${row.name} (ID: ${row.id}): ${row.platform_type}`);
      });
    }
    
    console.log('\n✅ الأنواع الجديدة المتاحة:');
    console.log('1. RESTAURANTS - مطاعم وأغذية');
    console.log('2. STORES - متاجر');
    console.log('3. SERVICES - خدمات');
    console.log('4. EDUCATION - تعليم');
    console.log('5. HEALTH - صحة');
    console.log('6. SPORTS - رياضة وترفيه');
    console.log('7. EVENTS - فعاليات وترفيه');
    console.log('8. REAL_ESTATE - عقارات وإسكان');
    console.log('9. TOURISM - سياحة');
    console.log('10. MANUFACTURING - تصنيع وصناعة');
    console.log('11. PROFESSIONAL - احترافية');
    console.log('12. ORGANIZATIONS - منظمات');
    console.log('13. OTHER - أخرى');
    
  } catch (error) {
    console.error('❌ خطأ في تحديث أنواع المنصات:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// تشغيل التحديث
updatePlatformTypes()
  .then(() => {
    console.log('\n✅ اكتمل التحديث بنجاح');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ فشل التحديث:', error);
    process.exit(1);
  });
