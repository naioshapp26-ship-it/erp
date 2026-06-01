const db = require('./db');
const fs = require('fs');

async function addApprovalSystem() {
  console.log('🔄 جاري إضافة نظام الموافقات المالية...\n');

  try {
    // Read SQL file
    const sql = fs.readFileSync('./add-approval-system.sql', 'utf8');
    
    console.log('📝 تنفيذ سكريبت SQL...\n');
    
    // Execute the entire SQL file
    await db.query(sql);
    
    console.log('✅ تم تنفيذ جميع العبارات SQL بنجاح!\n');
    
    // Verify
    const workflowsCount = await db.query('SELECT COUNT(*) FROM approval_workflows');
    const stepsCount = await db.query('SELECT COUNT(*) FROM approval_steps');
    const notificationsCount = await db.query('SELECT COUNT(*) FROM notifications');
    
    console.log('📊 التحقق من البيانات:');
    console.log(`   ✅ approval_workflows: ${workflowsCount.rows[0].count} سجل`);
    console.log(`   ✅ approval_steps: ${stepsCount.rows[0].count} سجل`);
    console.log(`   ✅ notifications: ${notificationsCount.rows[0].count} سجل`);
    console.log('\n✨ نظام الموافقات المالية جاهز للاستخدام! 🎉\n');

  } catch (error) {
    console.error('❌ خطأ في التهيئة:', error.message);
    console.error(error);
  } finally {
    await db.pool.end();
    process.exit(0);
  }
}

addApprovalSystem();
