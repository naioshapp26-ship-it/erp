const { Pool } = require('pg');

const pool = new Pool({
    connectionString: 'postgresql://postgres:PddzJpAQYezqknsntSzmCUlQYuYJldcT@crossover.proxy.rlwy.net:44255/railway',
    ssl: false
});

async function countByLevel() {
    const client = await pool.connect();
    
    try {
        const result = await client.query(`
            SELECT 
                hierarchy_level,
                COUNT(*) as count,
                array_agg(name ORDER BY id) as roles
            FROM roles
            GROUP BY hierarchy_level
            ORDER BY hierarchy_level
        `);
        
        console.log('\n📊 الأدوار حسب المستوى:\n');
        
        const levelNames = {
            0: 'المكتب الرئيسي (HQ)',
            1: 'فرع الدولة (BRANCH)',
            2: 'حاضنة (INCUBATOR)',
            3: 'منصة (PLATFORM)',
            4: 'مكتب تنفيذي (OFFICE)'
        };
        
        result.rows.forEach(row => {
            console.log(`${levelNames[row.hierarchy_level] || 'غير محدد'}:`);
            console.log(`  العدد: ${row.count}`);
            console.log(`  الأدوار:`);
            row.roles.forEach((role, i) => {
                console.log(`    ${i + 1}. ${role}`);
            });
            console.log('');
        });
        
        const total = result.rows.reduce((sum, row) => sum + parseInt(row.count), 0);
        console.log(`إجمالي الأدوار: ${total}`);
        console.log(`المتوقع: 33`);
        console.log(`الفرق: ${total - 33}`);
        
    } catch (error) {
        console.error('❌ خطأ:', error.message);
    } finally {
        client.release();
        await pool.end();
    }
}

countByLevel();
