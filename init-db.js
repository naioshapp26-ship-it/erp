const db = require('./db');
const fs = require('fs');

async function initDatabase() {
  console.log('🔄 جاري تهيئة قاعدة البيانات...\n');

  try {
    // Read SQL file
    const sql = fs.readFileSync('./init-db.sql', 'utf8');
    
    console.log(`📝 تنفيذ سكريبت SQL الكامل...\n`);
    
    // Execute the entire SQL file
    await db.query(sql);
    
    console.log('✅ تم تنفيذ جميع العبارات SQL بنجاح!\n');
    
    // Verify
    const entitiesCount = await db.query('SELECT COUNT(*) FROM entities');
    const usersCount = await db.query('SELECT COUNT(*) FROM users');
    const adsCount = await db.query('SELECT COUNT(*) FROM ads');
    const invoicesCount = await db.query('SELECT COUNT(*) FROM invoices');
    
    console.log('📊 التحقق من البيانات:');
    console.log(`   ✅ entities: ${entitiesCount.rows[0].count} سجل`);
    console.log(`   ✅ users: ${usersCount.rows[0].count} سجل`);
    console.log(`   ✅ invoices: ${invoicesCount.rows[0].count} سجل`);
    console.log(`   ✅ ads: ${adsCount.rows[0].count} سجل`);
    console.log('\n✨ قاعدة البيانات جاهزة للاستخدام! 🎉\n');

  } catch (error) {
    console.error('❌ خطأ في التهيئة:', error.message);
    console.error(error);
  } finally {
    await db.pool.end();
    process.exit(0);
  }
}

initDatabase();
