const { Pool } = require('pg');

const pool = new Pool({
    connectionString: 'postgresql://postgres:PddzJpAQYezqknsntSzmCUlQYuYJldcT@crossover.proxy.rlwy.net:44255/railway'
});

async function testCreateRoleFixed() {
    try {
        console.log('🧪 اختبار إنشاء دور بالأعمدة الصحيحة:\n');
        
        const testData = {
            code: 'TEST_ROLE_002',
            title_ar: 'مدير اختبار',
            title_en: 'Test Manager',
            description: 'دور تجريبي للاختبار',
            level: 'OPERATIONAL',
            hierarchy_level: 15,
            min_approval_limit: 0,
            max_approval_limit: 50000
        };
        
        console.log('البيانات:');
        console.log(JSON.stringify(testData, null, 2));
        
        const result = await pool.query(`
            INSERT INTO roles (
                name, name_ar, job_title_ar, job_title_en, description,
                level, hierarchy_level, min_approval_limit, max_approval_limit,
                is_active
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true)
            RETURNING *
        `, [
            testData.code,
            testData.code,
            testData.title_ar,
            testData.title_en,
            testData.description,
            testData.level,
            testData.hierarchy_level,
            testData.min_approval_limit,
            testData.max_approval_limit
        ]);
        
        console.log('\n✅ نجح الإنشاء!');
        console.log('الدور المُنشأ:');
        console.log(`  ID: ${result.rows[0].id}`);
        console.log(`  Name: ${result.rows[0].name}`);
        console.log(`  Name AR: ${result.rows[0].name_ar}`);
        console.log(`  Job Title AR: ${result.rows[0].job_title_ar}`);
        console.log(`  Job Title EN: ${result.rows[0].job_title_en}`);
        console.log(`  Level: ${result.rows[0].level}`);
        console.log(`  Hierarchy: ${result.rows[0].hierarchy_level}`);
        
        // حذف الدور التجريبي
        await pool.query('DELETE FROM roles WHERE name = $1', [testData.code]);
        console.log('\n✅ تم حذف الدور التجريبي');
        
    } catch (error) {
        console.error('❌ خطأ:', error.message);
    } finally {
        await pool.end();
    }
}

testCreateRoleFixed();
