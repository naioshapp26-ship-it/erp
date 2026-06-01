const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://postgres:PddzJpAQYezqknsntSzmCUlQYuYJldcT@crossover.proxy.rlwy.net:44255/railway',
  ssl: { rejectUnauthorized: false }
});

const newIncubators = [
  { id: 1, name: 'الموظفين', description: '' },
  { id: 2, name: 'التوظيف', description: '' },
  { id: 3, name: 'الإجازات', description: '' },
  { id: 4, name: 'تقييمات الموظفين', description: '' },
  { id: 5, name: 'إحالة', description: '' },
  { id: 6, name: 'النقل', description: '' },
  { id: 7, name: 'أتمتة التسويق', description: '' },
  { id: 8, name: 'التسويق عبر البريد الإلكتروني', description: '' },
  { id: 9, name: 'التسويق عبر الرسائل النصية القصيرة', description: '' },
  { id: 10, name: 'التسويق الاجتماعي', description: '' },
  { id: 11, name: 'الفعاليات', description: '' },
  { id: 12, name: 'الاستطلاع', description: '' },
  { id: 13, name: 'الموقع الإلكتروني', description: '' },
  { id: 14, name: 'المتجر الإلكتروني', description: '' },
  { id: 15, name: 'المدونة', description: '' },
  { id: 16, name: 'المنتدى', description: '' },
  { id: 17, name: 'التعلُّم الإلكتروني', description: '' },
  { id: 18, name: 'الدردشة المباشرة', description: '' },
  { id: 19, name: 'إدارة علاقات العملاء', description: '' },
  { id: 20, name: 'المبيعات', description: '' },
  { id: 21, name: 'نقطة البيع', description: '' },
  { id: 22, name: 'الاشتراكات', description: '' },
  { id: 23, name: 'التأجير', description: '' },
  { id: 24, name: 'المحاسبة', description: '' },
  { id: 25, name: 'الفوترة', description: '' },
  { id: 26, name: 'النفقات', description: '' },
  { id: 27, name: 'المستندات', description: '' },
  { id: 28, name: 'الجداول الزمنية', description: '' },
  { id: 29, name: 'التوقيع الإلكتروني', description: '' },
  { id: 30, name: 'المخزون', description: '' },
  { id: 31, name: 'التصنيع', description: '' },
  { id: 32, name: 'إدارة منصات حياة المنتج', description: '' },
  { id: 33, name: 'أوامر الشراء والمناقصات والاتفاقيات', description: '' },
  { id: 34, name: 'الجودة', description: '' },
  { id: 35, name: 'المشروع', description: '' },
  { id: 36, name: 'الجدول الزمني', description: '' },
  { id: 37, name: 'الخدمة الميدانية', description: '' },
  { id: 38, name: 'مكتب المساعدة', description: '' },
  { id: 39, name: 'التخطيط', description: '' },
  { id: 40, name: 'المواعيد', description: '' },
  { id: 41, name: 'المناقشة', description: '' },
  { id: 42, name: 'الموافقات', description: '' },
  { id: 43, name: 'إنترنت الأشياء IoT', description: '' },
  { id: 44, name: 'بروتوكول استخدام الصوت عبر الإنترنت', description: '' },
  { id: 45, name: 'المعرفة', description: '' }
];

async function updateIncubators() {
  const client = await pool.connect();
  
  try {
    console.log('🔄 Starting incubators update...\n');
    
    await client.query('BEGIN');
    
    // 1. Get first branch ID
    console.log('1️⃣ Getting first branch ID...');
    const branchResult = await client.query('SELECT id FROM branches ORDER BY id LIMIT 1');
    
    if (branchResult.rows.length === 0) {
      throw new Error('No branches found! Please create branches first.');
    }
    
    const branchId = branchResult.rows[0].id;
    console.log(`   ✅ Branch ID: ${branchId}\n`);
    
    // 2. Check existing incubators
    console.log('2️⃣ Checking existing incubators...');
    const existingIncubators = await client.query('SELECT * FROM incubators ORDER BY id');
    console.log(`   Found ${existingIncubators.rows.length} existing incubators\n`);
    
    // 3. Delete all existing incubators
    console.log('3️⃣ Deleting all existing incubators...');
    const deleteResult = await client.query('DELETE FROM incubators');
    console.log(`   ✅ Deleted ${deleteResult.rowCount} incubators\n`);
    
    // 4. Reset the sequence
    console.log('4️⃣ Resetting ID sequence...');
    await client.query('ALTER SEQUENCE incubators_id_seq RESTART WITH 1');
    console.log('   ✅ Sequence reset\n');
    
    // 5. Insert new incubators (without entity_id first)
    console.log('5️⃣ Inserting new incubators...');
    let insertCount = 0;
    
    for (const incubator of newIncubators) {
      const code = `INC-${incubator.id.toString().padStart(3, '0')}`;
      
      await client.query(`
        INSERT INTO incubators (
          id, branch_id, name, code, description, 
          is_active, created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        )
      `, [
        incubator.id,
        branchId,
        incubator.name,
        code,
        incubator.description || incubator.name
      ]);
      
      insertCount++;
      console.log(`   ✅ Inserted: ${incubator.id}. ${incubator.name} (${code})`);
    }
    
    console.log(`\n   Total inserted: ${insertCount} incubators\n`);
    
    // 6. Insert entities for incubators
    console.log('6️⃣ Inserting entities for incubators...');
    let entityCount = 0;
    
    for (const incubator of newIncubators) {
      const entityId = `INC${incubator.id.toString().padStart(3, '0')}`;
      
      // Check if entity already exists
      const existingEntity = await client.query(
        'SELECT id FROM entities WHERE id = $1',
        [entityId]
      );
      
      if (existingEntity.rows.length === 0) {
        await client.query(`
          INSERT INTO entities (
            id, type, name, status, balance, location, 
            branch_id, incubator_id, created_at, updated_at
          )
          VALUES ($1, 'INCUBATOR', $2, 'Active', 0, $3, $4, $5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `, [entityId, incubator.name, incubator.name, branchId, incubator.id]);
        entityCount++;
      }
    }
    
    console.log(`   ✅ Created ${entityCount} entities\n`);
    
    // 7. Update incubators with entity_id
    console.log('7️⃣ Updating incubators with entity_id...');
    let updateCount = 0;
    
    for (const incubator of newIncubators) {
      const entityId = `INC${incubator.id.toString().padStart(3, '0')}`;
      
      await client.query(`
        UPDATE incubators 
        SET entity_id = $1, updated_at = CURRENT_TIMESTAMP 
        WHERE id = $2
      `, [entityId, incubator.id]);
      
      updateCount++;
    }
    
    console.log(`   ✅ Updated ${updateCount} incubators with entity_id\n`);
    
    // 8. Reset sequence to next value
    console.log('8️⃣ Setting sequence to next value...');
    await client.query(`SELECT setval('incubators_id_seq', (SELECT MAX(id) FROM incubators))`);
    console.log('   ✅ Sequence updated\n');
    
    // 9. Verify the results
    console.log('9️⃣ Verifying results...');
    const verifyResult = await client.query('SELECT id, name, code, entity_id FROM incubators ORDER BY id');
    console.log(`   Total incubators in database: ${verifyResult.rows.length}`);
    console.log('\n   First 5 incubators:');
    verifyResult.rows.slice(0, 5).forEach(inc => {
      console.log(`   ${inc.id}. ${inc.name} (${inc.code}) [${inc.entity_id}]`);
    });
    console.log('\n   Last 5 incubators:');
    verifyResult.rows.slice(-5).forEach(inc => {
      console.log(`   ${inc.id}. ${inc.name} (${inc.code}) [${inc.entity_id}]`);
    });
    
    await client.query('COMMIT');
    console.log('\n✅ Incubators update completed successfully!');
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('\n❌ Error updating incubators:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

updateIncubators();
