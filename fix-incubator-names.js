const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://postgres:PddzJpAQYezqknsntSzmCUlQYuYJldcT@crossover.proxy.rlwy.net:44255/railway',
  ssl: { rejectUnauthorized: false }
});

async function fixIncubatorNames() {
  try {
    console.log('تصحيح أسماء الحاضنات...\n');
    
    const updates = [
      { old: 'فريلانسر استشارات وتدريب', new: 'فريلانسر استشارات زتدريب' },
      { old: 'تحف وإكسسوارات', new: 'تحف و إكسسوارات' },
      { old: 'تجهيزات مطابخ صناعية', new: 'تجهيزات كطابخ صناعية' },
      { old: 'إكسسوارات وزينة سيارات', new: 'إكسسوارات ةزينة سيارات' }
    ];
    
    for (const update of updates) {
      const result = await pool.query(
        'UPDATE incubators SET name = $1 WHERE name = $2',
        [update.new, update.old]
      );
      console.log(`✓ تم تحديث: ${update.old} → ${update.new}`);
    }
    
    console.log('\n✅ تم تصحيح جميع أسماء الحاضنات بنجاح\n');
    
    await pool.end();
  } catch (err) {
    console.error('خطأ:', err);
    await pool.end();
  }
}

fixIncubatorNames();
