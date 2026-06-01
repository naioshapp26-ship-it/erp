const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://postgres:PddzJpAQYezqknsntSzmCUlQYuYJldcT@crossover.proxy.rlwy.net:44255/railway',
  ssl: { rejectUnauthorized: false }
});

async function removeDuplicate() {
  try {
    const r = await pool.query('SELECT id, name FROM entities WHERE type = \'INCUBATOR\' AND name = \'النقل\' ORDER BY id');
    
    console.log('عدد "النقل":', r.rows.length);
    r.rows.forEach(row => console.log('  - ID: ' + row.id));
    
    if (r.rows.length > 1) {
      const toDelete = r.rows[1].id;
      console.log('\nحذف ID:', toDelete);
      await pool.query('DELETE FROM entities WHERE id = $1', [toDelete]);
      console.log('✓ تم الحذف');
    }
    
    await pool.end();
  } catch (err) {
    console.error('خطأ:', err);
    await pool.end();
  }
}

removeDuplicate();
