const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://postgres:PddzJpAQYezqknsntSzmCUlQYuYJldcT@crossover.proxy.rlwy.net:44255/railway',
  ssl: { rejectUnauthorized: false }
});

const newBranches = [
  { id: 1, name_ar: 'المقر الرئيسي', name_en: 'Head Office' },
  { id: 2, name_ar: 'العراق', name_en: 'Iraq' },
  { id: 3, name_ar: 'مصر', name_en: 'Egypt' },
  { id: 4, name_ar: 'الاردن', name_en: 'Jordan' },
  { id: 5, name_ar: 'السعودية', name_en: 'Saudi Arabia' },
  { id: 6, name_ar: 'انجلترا', name_en: 'England' },
  { id: 7, name_ar: 'الجزائر', name_en: 'Algeria' },
  { id: 8, name_ar: 'فرع تجريبي', name_en: 'Test Branch' },
  { id: 9, name_ar: 'السويد', name_en: 'Sweden' },
  { id: 10, name_ar: 'ماليزيا', name_en: 'Malaysia' },
  { id: 11, name_ar: 'قطر', name_en: 'Qatar' },
  { id: 12, name_ar: 'تونس', name_en: 'Tunisia' },
  { id: 13, name_ar: 'المغرب', name_en: 'Morocco' },
  { id: 14, name_ar: 'ليبيا', name_en: 'Libya' },
  { id: 15, name_ar: 'البحرين', name_en: 'Bahrain' },
  { id: 16, name_ar: 'يمن', name_en: 'Yemen' },
  { id: 17, name_ar: 'السودان', name_en: 'Sudan' },
  { id: 18, name_ar: 'فلسطين', name_en: 'Palestine' },
  { id: 19, name_ar: 'تركيا', name_en: 'Turkey' },
  { id: 20, name_ar: 'عُمان', name_en: 'Oman' },
  { id: 21, name_ar: 'المانيا', name_en: 'Germany' },
  { id: 22, name_ar: 'الكويت', name_en: 'Kuwait' },
  { id: 23, name_ar: 'سوريا', name_en: 'Syria' },
  { id: 24, name_ar: 'الإمارات', name_en: 'Emirates' },
  { id: 25, name_ar: 'امريكا', name_en: 'America' },
  { id: 26, name_ar: 'كندا', name_en: 'Canada' },
  { id: 27, name_ar: 'لبنان', name_en: 'Lebanon' }
];

async function updateBranches() {
  const client = await pool.connect();
  
  try {
    console.log('🔄 Starting branches update...\n');
    
    await client.query('BEGIN');
    
    // 1. Get HQ ID
    console.log('1️⃣ Getting headquarters ID...');
    const hqResult = await client.query('SELECT id FROM headquarters LIMIT 1');
    
    if (hqResult.rows.length === 0) {
      throw new Error('No headquarters found! Please create headquarters first.');
    }
    
    const hqId = hqResult.rows[0].id;
    console.log(`   ✅ HQ ID: ${hqId}\n`);
    
    // 2. Check existing branches
    console.log('2️⃣ Checking existing branches...');
    const existingBranches = await client.query('SELECT * FROM branches ORDER BY id');
    console.log(`   Found ${existingBranches.rows.length} existing branches\n`);
    
    // 3. Delete all existing branches
    console.log('3️⃣ Deleting all existing branches...');
    const deleteResult = await client.query('DELETE FROM branches');
    console.log(`   ✅ Deleted ${deleteResult.rowCount} branches\n`);
    
    // 4. Reset the sequence
    console.log('4️⃣ Resetting ID sequence...');
    await client.query('ALTER SEQUENCE branches_id_seq RESTART WITH 1');
    console.log('   ✅ Sequence reset\n');
    
    // 5. Insert new branches (without entity_id first)
    console.log('5️⃣ Inserting new branches...');
    let insertCount = 0;
    
    for (const branch of newBranches) {
      const code = `BR-${branch.id.toString().padStart(3, '0')}`;
      
      await client.query(`
        INSERT INTO branches (
          id, hq_id, name, code, description, country, 
          is_active, created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        )
      `, [
        branch.id,
        hqId,
        branch.name_ar,
        code,
        branch.name_en,
        branch.name_en
      ]);
      
      insertCount++;
      console.log(`   ✅ Inserted: ${branch.id}. ${branch.name_ar} - ${branch.name_en} (${code})`);
    }
    
    console.log(`\n   Total inserted: ${insertCount} branches\n`);
    
    // 6. Insert entities for branches
    console.log('6️⃣ Inserting entities for branches...');
    let entityCount = 0;
    
    for (const branch of newBranches) {
      const entityId = `BR${branch.id.toString().padStart(3, '0')}`;
      
      // Check if entity already exists
      const existingEntity = await client.query(
        'SELECT id FROM entities WHERE id = $1',
        [entityId]
      );
      
      if (existingEntity.rows.length === 0) {
        await client.query(`
          INSERT INTO entities (
            id, type, name, status, balance, location, 
            hq_id, branch_id, created_at, updated_at
          )
          VALUES ($1, 'BRANCH', $2, 'Active', 0, $3, $4, $5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `, [entityId, branch.name_ar, branch.name_en, hqId, branch.id]);
        entityCount++;
      }
    }
    
    console.log(`   ✅ Created ${entityCount} entities\n`);
    
    // 7. Update branches with entity_id
    console.log('7️⃣ Updating branches with entity_id...');
    let updateCount = 0;
    
    for (const branch of newBranches) {
      const entityId = `BR${branch.id.toString().padStart(3, '0')}`;
      
      await client.query(`
        UPDATE branches 
        SET entity_id = $1, updated_at = CURRENT_TIMESTAMP 
        WHERE id = $2
      `, [entityId, branch.id]);
      
      updateCount++;
    }
    
    console.log(`   ✅ Updated ${updateCount} branches with entity_id\n`);
    
    // 8. Reset sequence to next value
    console.log('8️⃣ Setting sequence to next value...');
    await client.query(`SELECT setval('branches_id_seq', (SELECT MAX(id) FROM branches))`);
    console.log('   ✅ Sequence updated\n');
    
    // 9. Verify the results
    console.log('9️⃣ Verifying results...');
    const verifyResult = await client.query('SELECT id, name, code, country, entity_id FROM branches ORDER BY id');
    console.log(`   Total branches in database: ${verifyResult.rows.length}`);
    console.log('\n   First 5 branches:');
    verifyResult.rows.slice(0, 5).forEach(b => {
      console.log(`   ${b.id}. ${b.name} - ${b.country} (${b.code}) [${b.entity_id}]`);
    });
    console.log('\n   Last 5 branches:');
    verifyResult.rows.slice(-5).forEach(b => {
      console.log(`   ${b.id}. ${b.name} - ${b.country} (${b.code}) [${b.entity_id}]`);
    });
    
    await client.query('COMMIT');
    console.log('\n✅ Branches update completed successfully!');
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('\n❌ Error updating branches:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

updateBranches();
