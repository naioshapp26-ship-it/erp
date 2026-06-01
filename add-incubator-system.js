const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:PddzJpAQYezqknsntSzmCUlQYuYJldcT@crossover.proxy.rlwy.net:44255/railway',
  ssl: { rejectUnauthorized: false }
});

async function addIncubatorSystem() {
  try {
    console.log('🚀 بدء إضافة نظام حاضنة السلامة...\n');
    
    const sql = fs.readFileSync(path.join(__dirname, 'add-incubator-system.sql'), 'utf8');
    await pool.query(sql);
    
    console.log('✅ تم إضافة نظام حاضنة السلامة بنجاح!\n');
    
    // Verify tables
    const result = await pool.query(`
      SELECT 
        (SELECT COUNT(*) FROM training_programs) as programs,
        (SELECT COUNT(*) FROM beneficiaries) as beneficiaries,
        (SELECT COUNT(*) FROM training_sessions) as sessions,
        (SELECT COUNT(*) FROM enrollments) as enrollments,
        (SELECT COUNT(*) FROM certificates) as certificates,
        (SELECT COUNT(*) FROM training_records) as training_records
    `);
    
    console.log('📊 إحصائيات النظام:');
    console.log(`   - البرامج التدريبية: ${result.rows[0].programs}`);
    console.log(`   - المستفيدون: ${result.rows[0].beneficiaries}`);
    console.log(`   - الدفعات التدريبية: ${result.rows[0].sessions}`);
    console.log(`   - التسجيلات: ${result.rows[0].enrollments}`);
    console.log(`   - الشهادات: ${result.rows[0].certificates}`);
    console.log(`   - السجلات التدريبية: ${result.rows[0].training_records}`);
    
  } catch (error) {
    console.error('❌ خطأ:', error.message);
    throw error;
  } finally {
    await pool.end();
  }
}

addIncubatorSystem();
