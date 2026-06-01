const { Pool } = require('pg');

const db = new Pool({
  connectionString: 'postgresql://postgres:PddzJpAQYezqknsntSzmCUlQYuYJldcT@crossover.proxy.rlwy.net:44255/railway',
  ssl: { rejectUnauthorized: false }
});

async function testTrainingSession() {
  try {
    console.log('🔍 Testing training session creation...\n');

    // First, check if training_sessions table exists
    console.log('1️⃣ Checking table structure...');
    const tableInfo = await db.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'training_sessions'
      ORDER BY ordinal_position
    `);
    
    console.log('Training sessions table columns:');
    tableInfo.rows.forEach(col => {
      console.log(`  - ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable}, default: ${col.column_default})`);
    });
    console.log('');

    // Check if there are any training programs
    console.log('2️⃣ Checking available training programs...');
    const programs = await db.query('SELECT id, name, code, entity_id FROM training_programs LIMIT 5');
    console.log(`Found ${programs.rows.length} training programs:`);
    programs.rows.forEach(p => {
      console.log(`  - ID: ${p.id}, Name: ${p.name}, Code: ${p.code}, Entity: ${p.entity_id}`);
    });
    console.log('');

    if (programs.rows.length === 0) {
      console.log('⚠️  No training programs found! Need to create one first.');
      return;
    }

    // Try to insert a test session
    console.log('3️⃣ Testing training session insert...');
    const testData = {
      entity_id: programs.rows[0].entity_id,
      session_name: 'Test Session - ' + Date.now(),
      session_code: `SESSION-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      program_id: programs.rows[0].id,
      start_date: '2026-01-15',
      end_date: '2026-02-15',
      instructor_name: 'Test Instructor',
      location: 'Test Location',
      status: 'PLANNED',
      current_participants: 0,
      max_participants: 30
    };

    console.log('Test data:', testData);
    console.log('');

    const result = await db.query(
      `INSERT INTO training_sessions (
        entity_id, session_name, session_code, program_id, start_date, end_date, 
        instructor_name, location, status, current_participants, max_participants
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
      [
        testData.entity_id,
        testData.session_name,
        testData.session_code,
        testData.program_id,
        testData.start_date,
        testData.end_date,
        testData.instructor_name,
        testData.location,
        testData.status,
        testData.current_participants,
        testData.max_participants
      ]
    );

    console.log('✅ Training session created successfully!');
    console.log('Result:', result.rows[0]);
    console.log('');

    // Clean up - delete the test session
    console.log('4️⃣ Cleaning up test data...');
    await db.query('DELETE FROM training_sessions WHERE id = $1', [result.rows[0].id]);
    console.log('✅ Test data cleaned up\n');

    console.log('🎉 All tests passed!');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Details:', error.detail || error.hint || '');
    console.error('Full error:', error);
  } finally {
    await db.end();
  }
}

testTrainingSession();
