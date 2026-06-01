const { Pool } = require('pg');

const pool = new Pool({
    connectionString: 'postgresql://postgres:PddzJpAQYezqknsntSzmCUlQYuYJldcT@crossover.proxy.rlwy.net:44255/railway',
    ssl: { rejectUnauthorized: false }
});

async function addPerformanceIndexes() {
    try {
        console.log('🚀 إضافة Indexes لتحسين الأداء...\n');
        
        // Index for incubators by branch
        console.log('1️⃣ إضافة Index على incubators.branch_id...');
        await pool.query(`
            CREATE INDEX IF NOT EXISTS idx_incubators_branch 
            ON incubators(branch_id) 
            WHERE is_active = true
        `);
        console.log('   ✅ تم');
        
        // Index for platforms by incubator
        console.log('\n2️⃣ إضافة Index على platforms.incubator_id...');
        await pool.query(`
            CREATE INDEX IF NOT EXISTS idx_platforms_incubator 
            ON platforms(incubator_id) 
            WHERE is_active = true
        `);
        console.log('   ✅ تم');
        
        // Index for offices by incubator
        console.log('\n3️⃣ إضافة Index على offices.incubator_id...');
        await pool.query(`
            CREATE INDEX IF NOT EXISTS idx_offices_incubator 
            ON offices(incubator_id) 
            WHERE is_active = true
        `);
        console.log('   ✅ تم');
        
        // Index for employees by entity IDs
        console.log('\n4️⃣ إضافة Index على employees...');
        await pool.query(`
            CREATE INDEX IF NOT EXISTS idx_employees_branch 
            ON employees(branch_id) 
            WHERE is_active = true
        `);
        await pool.query(`
            CREATE INDEX IF NOT EXISTS idx_employees_incubator 
            ON employees(incubator_id) 
            WHERE is_active = true
        `);
        await pool.query(`
            CREATE INDEX IF NOT EXISTS idx_employees_platform 
            ON employees(platform_id) 
            WHERE is_active = true
        `);
        console.log('   ✅ تم');
        
        // Composite indexes for better performance
        console.log('\n5️⃣ إضافة Composite Indexes...');
        await pool.query(`
            CREATE INDEX IF NOT EXISTS idx_incubators_branch_active 
            ON incubators(branch_id, is_active)
        `);
        await pool.query(`
            CREATE INDEX IF NOT EXISTS idx_platforms_inc_active 
            ON platforms(incubator_id, is_active)
        `);
        console.log('   ✅ تم');
        
        // Analyze tables for better query planning
        console.log('\n6️⃣ تحليل الجداول لتحسين خطط الاستعلام...');
        await pool.query('ANALYZE incubators');
        await pool.query('ANALYZE platforms');
        await pool.query('ANALYZE offices');
        await pool.query('ANALYZE employees');
        console.log('   ✅ تم');
        
        console.log('\n\n✅ ═══════════════════════════════════════');
        console.log('✅ تم إضافة جميع Indexes بنجاح!');
        console.log('✅ ═══════════════════════════════════════');
        
        // Verify indexes
        console.log('\n📊 التحقق من Indexes...');
        const indexesResult = await pool.query(`
            SELECT 
                tablename,
                indexname,
                indexdef
            FROM pg_indexes
            WHERE schemaname = 'public'
            AND (
                indexname LIKE 'idx_incubators%' 
                OR indexname LIKE 'idx_platforms%'
                OR indexname LIKE 'idx_offices%'
                OR indexname LIKE 'idx_employees%'
            )
            ORDER BY tablename, indexname
        `);
        
        console.log(`\n✅ تم إنشاء ${indexesResult.rowCount} index:`);
        indexesResult.rows.forEach(row => {
            console.log(`   • ${row.indexname} على ${row.tablename}`);
        });
        
    } catch (error) {
        console.error('❌ خطأ:', error.message);
    } finally {
        await pool.end();
    }
}

addPerformanceIndexes();
