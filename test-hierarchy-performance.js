const { Pool } = require('pg');

const pool = new Pool({
    connectionString: 'postgresql://postgres:PddzJpAQYezqknsntSzmCUlQYuYJldcT@crossover.proxy.rlwy.net:44255/railway',
    ssl: { rejectUnauthorized: false }
});

async function testHierarchyPerformance() {
    try {
        console.log('⏱️  اختبار أداء صفحة الهيكل الهرمي...\n');
        
        const start = Date.now();
        
        // Simulate what the hierarchy page does
        console.log('📊 جلب الإحصائيات...');
        const statsStart = Date.now();
        const stats = await pool.query(`
            SELECT 
                (SELECT COUNT(*) FROM headquarters WHERE is_active = true) as active_hqs,
                (SELECT COUNT(*) FROM branches WHERE is_active = true) as active_branches,
                (SELECT COUNT(*) FROM incubators WHERE is_active = true) as active_incubators,
                (SELECT COUNT(*) FROM platforms WHERE is_active = true) as active_platforms,
                (SELECT COUNT(*) FROM offices WHERE is_active = true) as active_offices,
                (SELECT COUNT(*) FROM office_platforms WHERE is_active = true) as active_links
        `);
        console.log(`   ✅ الإحصائيات: ${Date.now() - statsStart}ms`);
        console.log('   النتائج:', stats.rows[0]);
        
        console.log('\n📋 جلب المقرات...');
        const hqStart = Date.now();
        const hq = await pool.query('SELECT * FROM headquarters');
        console.log(`   ✅ المقرات: ${Date.now() - hqStart}ms (${hq.rowCount} صف)`);
        
        console.log('\n📋 جلب الفروع...');
        const branchStart = Date.now();
        const branches = await pool.query('SELECT * FROM branches');
        console.log(`   ✅ الفروع: ${Date.now() - branchStart}ms (${branches.rowCount} صف)`);
        
        console.log('\n📋 جلب الحاضنات...');
        const incStart = Date.now();
        const incubators = await pool.query('SELECT * FROM incubators');
        console.log(`   ✅ الحاضنات: ${Date.now() - incStart}ms (${incubators.rowCount} صف)`);
        
        console.log('\n📋 جلب المنصات...');
        const platStart = Date.now();
        const platforms = await pool.query('SELECT * FROM platforms');
        console.log(`   ✅ المنصات: ${Date.now() - platStart}ms (${platforms.rowCount} صف)`);
        
        console.log('\n📋 جلب المكاتب...');
        const officeStart = Date.now();
        const offices = await pool.query('SELECT * FROM offices');
        console.log(`   ✅ المكاتب: ${Date.now() - officeStart}ms (${offices.rowCount} صف)`);
        
        const totalTime = Date.now() - start;
        
        console.log('\n\n═══════════════════════════════════════');
        console.log(`⏱️  إجمالي الوقت: ${totalTime}ms (${(totalTime/1000).toFixed(2)} ثانية)`);
        console.log('═══════════════════════════════════════');
        
        console.log('\n📊 إجمالي الصفوف المحملة:', 
            hq.rowCount + branches.rowCount + incubators.rowCount + 
            platforms.rowCount + offices.rowCount);
        
        if (totalTime > 3000) {
            console.log('\n⚠️  تحذير: الوقت أكثر من 3 ثواني - يحتاج لتحسين!');
        } else if (totalTime > 1000) {
            console.log('\n⚠️  تنبيه: الوقت أكثر من ثانية - يمكن تحسينه');
        } else {
            console.log('\n✅ الأداء جيد');
        }
        
    } catch (error) {
        console.error('❌ خطأ:', error.message);
    } finally {
        await pool.end();
    }
}

testHierarchyPerformance();
