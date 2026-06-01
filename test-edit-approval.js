const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://postgres:PddzJpAQYezqknsntSzmCUlQYuYJldcT@crossover.proxy.rlwy.net:44255/railway',
  ssl: {
    rejectUnauthorized: false
  }
});

async function testEditApproval() {
  console.log('🧪 اختبار تعديل الموافقات...\n');
  
  try {
    // 1. Get existing approvals
    console.log('1️⃣ جلب الموافقات الحالية...');
    const approvals = await pool.query('SELECT * FROM approval_workflows LIMIT 1');
    
    if (approvals.rows.length === 0) {
      console.log('❌ لا توجد موافقات للاختبار');
      return;
    }
    
    const approval = approvals.rows[0];
    console.log(`✅ تم العثور على موافقة: ${approval.item_title} (${approval.amount} ر.س)`);
    console.log(`   ID: ${approval.id}`);
    console.log(`   الحالة: ${approval.status}\n`);
    
    // 2. Test update
    const newTitle = `${approval.item_title} - محدث`;
    const newAmount = parseFloat(approval.amount) + 100;
    
    console.log('2️⃣ اختبار تحديث الموافقة...');
    console.log(`   العنوان الجديد: ${newTitle}`);
    console.log(`   المبلغ الجديد: ${newAmount} ر.س`);
    
    const updateResult = await pool.query(
      `UPDATE approval_workflows 
       SET item_title = $1, amount = $2, updated_at = NOW()
       WHERE id = $3
       RETURNING *`,
      [newTitle, newAmount, approval.id]
    );
    
    console.log('✅ تم التحديث بنجاح!\n');
    
    // 3. Verify update
    console.log('3️⃣ التحقق من التحديث...');
    const updated = updateResult.rows[0];
    console.log(`   العنوان الحالي: ${updated.item_title}`);
    console.log(`   المبلغ الحالي: ${updated.amount} ر.س`);
    console.log(`   تاريخ التحديث: ${updated.updated_at}\n`);
    
    // 4. Rollback to original values
    console.log('4️⃣ إعادة القيم الأصلية...');
    await pool.query(
      `UPDATE approval_workflows 
       SET item_title = $1, amount = $2
       WHERE id = $3`,
      [approval.item_title, approval.amount, approval.id]
    );
    console.log('✅ تمت إعادة القيم الأصلية\n');
    
    console.log('✅ اجتاز الاختبار بنجاح! 🎉\n');
    
    // Summary
    console.log('📊 ملخص الاختبار:');
    console.log('   ✓ قراءة الموافقات');
    console.log('   ✓ تحديث الموافقة');
    console.log('   ✓ التحقق من التحديث');
    console.log('   ✓ إعادة القيم الأصلية\n');
    
  } catch (error) {
    console.error('❌ خطأ في الاختبار:', error.message);
    throw error;
  } finally {
    await pool.end();
  }
}

testEditApproval().catch(console.error);
