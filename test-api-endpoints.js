const { Pool } = require('pg');
const pool = new Pool({
    connectionString: 'postgresql://postgres:PddzJpAQYezqknsntSzmCUlQYuYJldcT@crossover.proxy.rlwy.net:44255/railway'
});

async function testEndpoints() {
    try {
        console.log('🧪 اختبار استعلامات permission_levels:\n');
        
        const result = await pool.query(`
            SELECT level_code as code, level_name_ar as name_ar, level_name_en as name_en, 
                   color_code as color, description_ar as description, priority_order as priority
            FROM permission_levels
            ORDER BY priority_order DESC
            LIMIT 3
        `);
        
        console.log('✅ نجح الاستعلام!');
        console.log('عدد النتائج:', result.rows.length);
        result.rows.forEach(row => {
            console.log(`  - ${row.code}: ${row.name_ar} (priority: ${row.priority})`);
        });
        
        console.log('\n🧪 اختبار INSERT في audit_log:\n');
        
        const auditResult = await pool.query(`
            INSERT INTO audit_log (
                entity_type, entity_reference_id, action_type, 
                user_name, description
            ) VALUES ($1, $2, $3, $4, $5)
            RETURNING id, entity_type, action_type
        `, [
            'test',
            'TEST001',
            'TEST_ACTION',
            'test-user',
            JSON.stringify({ test: true })
        ]);
        
        console.log('✅ نجح INSERT في audit_log!');
        console.log('ID:', auditResult.rows[0].id);
        console.log('Entity Type:', auditResult.rows[0].entity_type);
        console.log('Action Type:', auditResult.rows[0].action_type);
        
        // احذف السجل التجريبي
        await pool.query('DELETE FROM audit_log WHERE entity_type = $1', ['test']);
        console.log('✅ تم حذف السجل التجريبي');
        
        console.log('\n✅ جميع الاختبارات نجحت!');
        
    } catch (error) {
        console.error('❌ خطأ:', error.message);
    } finally {
        await pool.end();
    }
}

testEndpoints();
