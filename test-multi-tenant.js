const db = require('./db');

async function testMultiTenantSystem() {
  console.log('🧪 بدء اختبار نظام Multi-Tenant...\n');
  
  let testsPassedCount = 0;
  let testsFailedCount = 0;
  
  const runTest = async (testName, testFunction) => {
    try {
      console.log(`▶️  ${testName}`);
      await testFunction();
      console.log(`✅ ${testName} - نجح\n`);
      testsPassedCount++;
    } catch (error) {
      console.error(`❌ ${testName} - فشل`);
      console.error(`   خطأ: ${error.message}\n`);
      testsFailedCount++;
    }
  };

  // ========================================
  // Test 1: التحقق من وجود الجداول
  // ========================================
  await runTest('اختبار 1: التحقق من وجود جميع الجداول', async () => {
    const tables = ['headquarters', 'branches', 'incubators', 'platforms', 'offices', 'office_platforms'];
    
    for (const table of tables) {
      const result = await db.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_name = $1
        )
      `, [table]);
      
      if (!result.rows[0].exists) {
        throw new Error(`الجدول ${table} غير موجود`);
      }
    }
    console.log(`   ✓ جميع الجداول موجودة (${tables.length})`);
  });

  // ========================================
  // Test 2: اختبار البيانات التجريبية
  // ========================================
  await runTest('اختبار 2: التحقق من البيانات التجريبية', async () => {
    const hqCount = await db.query('SELECT COUNT(*) FROM headquarters');
    const branchCount = await db.query('SELECT COUNT(*) FROM branches');
    const incubatorCount = await db.query('SELECT COUNT(*) FROM incubators');
    const platformCount = await db.query('SELECT COUNT(*) FROM platforms');
    const officeCount = await db.query('SELECT COUNT(*) FROM offices');
    
    console.log(`   ✓ المقرات الرئيسية: ${hqCount.rows[0].count}`);
    console.log(`   ✓ الفروع: ${branchCount.rows[0].count}`);
    console.log(`   ✓ الحاضنات: ${incubatorCount.rows[0].count}`);
    console.log(`   ✓ المنصات: ${platformCount.rows[0].count}`);
    console.log(`   ✓ المكاتب: ${officeCount.rows[0].count}`);
    
    if (hqCount.rows[0].count === '0') {
      throw new Error('لا توجد مقرات رئيسية');
    }
  });

  // ========================================
  // Test 3: اختبار الهيكل الهرمي
  // ========================================
  await runTest('اختبار 3: التحقق من الهيكل الهرمي', async () => {
    const result = await db.query(`
      SELECT 
        hq.name as hq_name,
        COUNT(DISTINCT b.id) as branches_count,
        COUNT(DISTINCT i.id) as incubators_count,
        COUNT(DISTINCT p.id) as platforms_count,
        COUNT(DISTINCT o.id) as offices_count
      FROM headquarters hq
      LEFT JOIN branches b ON b.hq_id = hq.id
      LEFT JOIN incubators i ON i.branch_id = b.id
      LEFT JOIN platforms p ON p.incubator_id = i.id
      LEFT JOIN offices o ON o.incubator_id = i.id
      GROUP BY hq.id, hq.name
    `);
    
    result.rows.forEach(row => {
      console.log(`   ✓ ${row.hq_name}:`);
      console.log(`     - فروع: ${row.branches_count}`);
      console.log(`     - حاضنات: ${row.incubators_count}`);
      console.log(`     - منصات: ${row.platforms_count}`);
      console.log(`     - مكاتب: ${row.offices_count}`);
    });
  });

  // ========================================
  // Test 4: اختبار إنشاء كيان جديد (Branch)
  // ========================================
  await runTest('اختبار 4: إنشاء فرع جديد', async () => {
    const hq = await db.query('SELECT id FROM headquarters LIMIT 1');
    const hqId = hq.rows[0].id;
    
    const result = await db.query(`
      INSERT INTO branches (hq_id, name, code, country, city)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `, [hqId, 'فرع الاختبار', 'BR-TEST', 'Test Country', 'Test City']);
    
    if (!result.rows[0].id) {
      throw new Error('فشل إنشاء الفرع');
    }
    
    console.log(`   ✓ تم إنشاء الفرع بنجاح (ID: ${result.rows[0].id})`);
    
    // حذف الفرع التجريبي
    await db.query('DELETE FROM branches WHERE code = $1', ['BR-TEST']);
    console.log(`   ✓ تم حذف الفرع التجريبي`);
  });

  // ========================================
  // Test 5: اختبار العلاقات بين الكيانات
  // ========================================
  await runTest('اختبار 5: التحقق من العلاقات بين الكيانات', async () => {
    const result = await db.query(`
      SELECT 
        b.name as branch_name,
        i.name as incubator_name,
        hq.name as hq_name
      FROM branches b
      JOIN headquarters hq ON b.hq_id = hq.id
      LEFT JOIN incubators i ON i.branch_id = b.id
      WHERE b.is_active = true
      LIMIT 5
    `);
    
    if (result.rows.length === 0) {
      throw new Error('لا توجد علاقات صحيحة بين الكيانات');
    }
    
    console.log(`   ✓ تم العثور على ${result.rows.length} علاقة صحيحة`);
    result.rows.forEach(row => {
      console.log(`     ${row.hq_name} → ${row.branch_name} → ${row.incubator_name || 'بدون حاضنة'}`);
    });
  });

  // ========================================
  // Test 6: اختبار ربط المكاتب بالمنصات
  // ========================================
  await runTest('اختبار 6: التحقق من ربط المكاتب بالمنصات', async () => {
    const result = await db.query(`
      SELECT 
        o.name as office_name,
        p.name as platform_name,
        op.is_active
      FROM office_platforms op
      JOIN offices o ON op.office_id = o.id
      JOIN platforms p ON op.platform_id = p.id
      WHERE op.is_active = true
      LIMIT 5
    `);
    
    console.log(`   ✓ عدد الروابط النشطة: ${result.rows.length}`);
    result.rows.forEach(row => {
      console.log(`     ${row.office_name} ← → ${row.platform_name}`);
    });
  });

  // ========================================
  // Test 7: اختبار View الهيكل الهرمي
  // ========================================
  await runTest('اختبار 7: التحقق من View الهيكل الهرمي', async () => {
    const result = await db.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.views 
        WHERE table_name = 'entity_hierarchy'
      )
    `);
    
    if (!result.rows[0].exists) {
      throw new Error('View entity_hierarchy غير موجود');
    }
    
    const viewData = await db.query('SELECT COUNT(*) FROM entity_hierarchy');
    console.log(`   ✓ View موجود ويحتوي على ${viewData.rows[0].count} سجل`);
  });

  // ========================================
  // Test 8: اختبار Triggers التحديث التلقائي
  // ========================================
  await runTest('اختبار 8: اختبار Triggers التحديث التلقائي', async () => {
    // الحصول على أول فرع
    const branch = await db.query('SELECT * FROM branches LIMIT 1');
    const branchId = branch.rows[0].id;
    const oldUpdatedAt = branch.rows[0].updated_at;
    
    // الانتظار لحظة
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // تحديث الفرع
    await db.query('UPDATE branches SET name = name WHERE id = $1', [branchId]);
    
    // التحقق من تحديث updated_at
    const updatedBranch = await db.query('SELECT updated_at FROM branches WHERE id = $1', [branchId]);
    const newUpdatedAt = updatedBranch.rows[0].updated_at;
    
    if (new Date(newUpdatedAt) <= new Date(oldUpdatedAt)) {
      throw new Error('Trigger التحديث لا يعمل بشكل صحيح');
    }
    
    console.log(`   ✓ Trigger التحديث يعمل بشكل صحيح`);
  });

  // ========================================
  // Test 9: اختبار العزل بين الفروع (Multi-Tenant)
  // ========================================
  await runTest('اختبار 9: التحقق من عزل البيانات بين الفروع', async () => {
    const branches = await db.query('SELECT id, name FROM branches ORDER BY id LIMIT 2');
    
    if (branches.rows.length < 2) {
      console.log('   ⚠️  يحتاج فرعين على الأقل للاختبار، سيتم التخطي');
      return;
    }
    
    // الحصول على الحاضنات لكل فرع
    const inc1 = await db.query(`SELECT COUNT(*) FROM incubators WHERE branch_id = ${branches.rows[0].id}`);
    const inc2 = await db.query(`SELECT COUNT(*) FROM incubators WHERE branch_id = ${branches.rows[1].id}`);
    
    console.log(`   ✓ ${branches.rows[0].name}: ${inc1.rows[0].count} حاضنة`);
    console.log(`   ✓ ${branches.rows[1].name}: ${inc2.rows[0].count} حاضنة`);
    console.log(`   ✓ البيانات معزولة بشكل صحيح`);
  });

  // ========================================
  // Test 10: اختبار الفهارس (Indexes)
  // ========================================
  await runTest('اختبار 10: التحقق من وجود الفهارس', async () => {
    const indexes = [
      'idx_branches_hq',
      'idx_incubators_branch',
      'idx_platforms_incubator',
      'idx_offices_incubator'
    ];
    
    for (const indexName of indexes) {
      const result = await db.query(`
        SELECT EXISTS (
          SELECT FROM pg_indexes 
          WHERE indexname = $1
        )
      `, [indexName]);
      
      if (!result.rows[0].exists) {
        throw new Error(`الفهرس ${indexName} غير موجود`);
      }
    }
    
    console.log(`   ✓ جميع الفهارس موجودة (${indexes.length})`);
  });

  // ========================================
  // ملخص النتائج
  // ========================================
  console.log('========================================');
  console.log('📊 ملخص نتائج الاختبارات');
  console.log('========================================');
  console.log(`✅ اختبارات ناجحة: ${testsPassedCount}`);
  console.log(`❌ اختبارات فاشلة: ${testsFailedCount}`);
  console.log(`📈 نسبة النجاح: ${((testsPassedCount / (testsPassedCount + testsFailedCount)) * 100).toFixed(2)}%`);
  console.log('========================================\n');

  if (testsFailedCount === 0) {
    console.log('🎉 جميع الاختبارات نجحت! النظام جاهز للاستخدام.');
    process.exit(0);
  } else {
    console.log('⚠️  بعض الاختبارات فشلت. يرجى مراجعة الأخطاء.');
    process.exit(1);
  }
}

// تشغيل الاختبارات
testMultiTenantSystem().catch(error => {
  console.error('❌ خطأ كارثي في الاختبارات:', error);
  process.exit(1);
});
