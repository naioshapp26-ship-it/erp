const { Pool } = require('pg');

const pool = new Pool({
    connectionString: 'postgresql://postgres:PddzJpAQYezqknsntSzmCUlQYuYJldcT@crossover.proxy.rlwy.net:44255/railway'
});

async function testCreateRole() {
    try {
        console.log('🔍 فحص بنية جدول roles:\n');
        
        const schema = await pool.query(`
            SELECT column_name, data_type, is_nullable, column_default
            FROM information_schema.columns
            WHERE table_name = 'roles'
            ORDER BY ordinal_position
        `);
        
        console.log('الأعمدة الموجودة:');
        schema.rows.forEach(col => {
            console.log(`  - ${col.column_name} (${col.data_type}) ${col.is_nullable === 'NO' ? 'NOT NULL' : 'NULL'} ${col.column_default ? `DEFAULT ${col.column_default}` : ''}`);
        });
        
        console.log('\n\n🧪 محاولة إنشاء دور تجريبي:\n');
        
        const testData = {
            code: 'TEST_ROLE_001',
            title_ar: 'دور تجريبي',
            title_en: 'Test Role',
            description: 'دور للاختبار فقط',
            hierarchy_level: 10,
            min_approval_limit: 0,
            max_approval_limit: 0
        };
        
        console.log('البيانات المرسلة:');
        console.log(JSON.stringify(testData, null, 2));
        
        try {
            const result = await pool.query(`
                INSERT INTO roles (
                    code, title_ar, title_en, description,
                    hierarchy_level, min_approval_limit, max_approval_limit,
                    is_active
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, true)
                RETURNING *
            `, [
                testData.code,
                testData.title_ar,
                testData.title_en,
                testData.description,
                testData.hierarchy_level,
                testData.min_approval_limit,
                testData.max_approval_limit
            ]);
            
            console.log('\n❌ فشل! الأعمدة المستخدمة غير صحيحة');
            console.log('الخطأ:', result);
            
        } catch (insertError) {
            console.log('\n❌ خطأ في INSERT:');
            console.log('الرسالة:', insertError.message);
            console.log('\nالسبب المحتمل: أسماء الأعمدة غير متطابقة!');
        }
        
    } catch (error) {
        console.error('❌ خطأ:', error.message);
    } finally {
        await pool.end();
    }
}

testCreateRole();
