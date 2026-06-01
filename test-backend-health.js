const { Pool } = require('pg');

const pool = new Pool({
    connectionString: 'postgresql://postgres:PddzJpAQYezqknsntSzmCUlQYuYJldcT@crossover.proxy.rlwy.net:44255/railway',
    ssl: { rejectUnauthorized: false }
});

async function testBackendHealth() {
    console.log('🧪 اختبار صحة الخلفية...\n');
    
    const tests = [
        {
            name: 'اتصال قاعدة البيانات',
            fn: async () => {
                const result = await pool.query('SELECT NOW()');
                return `متصل - الوقت: ${result.rows[0].now}`;
            }
        },
        {
            name: 'عدد الفروع',
            fn: async () => {
                const result = await pool.query('SELECT COUNT(*) FROM branches');
                return `${result.rows[0].count} فرع`;
            }
        },
        {
            name: 'عدد الحاضنات',
            fn: async () => {
                const result = await pool.query('SELECT COUNT(*) FROM incubators');
                return `${result.rows[0].count} حاضنة`;
            }
        },
        {
            name: 'عدد المنصات',
            fn: async () => {
                const result = await pool.query('SELECT COUNT(*) FROM platforms');
                return `${result.rows[0].count} منصة`;
            }
        },
        {
            name: 'اختبار endpoint بسيط',
            fn: async () => {
                const result = await pool.query(`
                    SELECT 
                        (SELECT COUNT(*) FROM branches) as branches,
                        (SELECT COUNT(*) FROM incubators WHERE is_active = true) as active_incubators,
                        (SELECT COUNT(*) FROM platforms WHERE is_active = true) as active_platforms
                `);
                return `${result.rows[0].branches} فرع، ${result.rows[0].active_incubators} حاضنة نشطة، ${result.rows[0].active_platforms} منصة نشطة`;
            }
        },
        {
            name: 'اختبار سرعة استعلام الحاضنات بفرع',
            fn: async () => {
                const start = Date.now();
                const result = await pool.query(`
                    SELECT COUNT(*) FROM incubators WHERE branch_id = 1 AND is_active = true
                `);
                const time = Date.now() - start;
                return `${result.rows[0].count} حاضنة في ${time}ms`;
            }
        },
        {
            name: 'اختبار سرعة استعلام المنصات بفرع',
            fn: async () => {
                const start = Date.now();
                const result = await pool.query(`
                    SELECT COUNT(*) 
                    FROM platforms p
                    JOIN incubators i ON p.incubator_id = i.id
                    WHERE i.branch_id = 1 AND p.is_active = true
                `);
                const time = Date.now() - start;
                return `${result.rows[0].count} منصة في ${time}ms`;
            }
        }
    ];
    
    let passed = 0;
    let failed = 0;
    
    for (const test of tests) {
        try {
            const start = Date.now();
            const result = await test.fn();
            const time = Date.now() - start;
            console.log(`✅ ${test.name}: ${result} (${time}ms)`);
            passed++;
        } catch (error) {
            console.error(`❌ ${test.name}: ${error.message}`);
            failed++;
        }
    }
    
    console.log('\n═══════════════════════════════════════');
    console.log(`📊 النتيجة: ${passed}/${tests.length} نجح`);
    if (failed > 0) {
        console.log(`❌ ${failed} اختبار فشل`);
    } else {
        console.log('✅ جميع الاختبارات نجحت!');
    }
    console.log('═══════════════════════════════════════');
    
    await pool.end();
}

testBackendHealth().catch(console.error);
