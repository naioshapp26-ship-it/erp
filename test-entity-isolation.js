const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgresql://postgres:PddzJpAQYezqknsntSzmCUlQYuYJldcT@crossover.proxy.rlwy.net:44255/railway'
});

async function checkEntityIsolation() {
  try {
    console.log('🔍 اختبار entity isolation\n');
    await client.connect();

    // Check enrollments table structure
    console.log('📊 اختبار 1: هيكل جدول enrollments');
    const enrollmentsSchema = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'enrollments'
      ORDER BY ordinal_position;
    `);
    console.log('الأعمدة:');
    console.table(enrollmentsSchema.rows);
    console.log('');

    // Check if entity_id and entity_type columns exist
    const hasEntityColumns = enrollmentsSchema.rows.some(r => r.column_name === 'entity_id') &&
                            enrollmentsSchema.rows.some(r => r.column_name === 'entity_type');
    console.log(`✓ هل يوجد عمود entity_id؟ ${hasEntityColumns ? '✅ نعم' : '❌ لا'}\n`);

    // Show sample enrollment data with all columns
    console.log('📋 اختبار 2: بيانات المتدربين كاملة');
    const enrollmentData = await client.query(`
      SELECT * FROM enrollments LIMIT 3;
    `);
    console.log('النتائج:');
    console.log(JSON.stringify(enrollmentData.rows, null, 2));
    console.log('');

    // Check what entities have enrollments
    console.log('🏢 اختبار 3: الكيانات التي لها متدربون');
    const entitiesWithEnrollments = await client.query(`
      SELECT DISTINCT entity_id, entity_type, COUNT(*) as enrollment_count
      FROM enrollments
      GROUP BY entity_id, entity_type;
    `);
    console.log('النتائج:');
    console.table(entitiesWithEnrollments.rows);

  } catch (error) {
    console.error('❌ خطأ:', error.message);
  } finally {
    await client.end();
  }
}

checkEntityIsolation();
