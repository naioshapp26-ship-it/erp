const { Pool } = require('pg');

const pool = new Pool({
    connectionString: 'postgresql://postgres:PddzJpAQYezqknsntSzmCUlQYuYJldcT@crossover.proxy.rlwy.net:44255/railway',
    ssl: { rejectUnauthorized: false }
});

async function testOfficeCreationFlow() {
    try {
        console.log('🧪 اختبار تدفق إنشاء مكتب...\n');
        
        // Test 1: Get branches
        console.log('1️⃣ جلب الفروع...');
        const branchesResult = await pool.query('SELECT id, name, code FROM branches LIMIT 5');
        console.log(`   ✅ عدد الفروع: ${branchesResult.rowCount}`);
        console.log('   الفروع:', branchesResult.rows);
        
        const testBranchId = branchesResult.rows[0].id;
        console.log(`\n📌 سنختبر باستخدام الفرع: ${branchesResult.rows[0].name} (ID: ${testBranchId})\n`);
        
        // Test 2: Get incubators for branch
        console.log('2️⃣ جلب الحاضنات للفرع...');
        const incubatorsResult = await pool.query(`
            SELECT i.id, i.name, i.code, i.branch_id, b.name as branch_name
            FROM incubators i
            LEFT JOIN branches b ON i.branch_id = b.id
            WHERE i.branch_id = $1 AND i.is_active = true
            LIMIT 10
        `, [testBranchId]);
        console.log(`   ✅ عدد الحاضنات: ${incubatorsResult.rowCount}`);
        console.log('   الحاضنات:', incubatorsResult.rows.map(i => ({ id: i.id, name: i.name, code: i.code })));
        
        if (incubatorsResult.rowCount === 0) {
            console.log('\n❌ لا توجد حاضنات في هذا الفرع!');
            return;
        }
        
        // Test 3: Get platforms for branch
        console.log('\n3️⃣ جلب المنصات للفرع...');
        const platformsResult = await pool.query(`
            SELECT p.id, p.name, p.code, p.incubator_id
            FROM platforms p
            JOIN incubators i ON p.incubator_id = i.id
            WHERE i.branch_id = $1 AND p.is_active = true
            LIMIT 10
        `, [testBranchId]);
        console.log(`   ✅ عدد المنصات: ${platformsResult.rowCount}`);
        console.log('   المنصات:', platformsResult.rows.map(p => ({ id: p.id, name: p.name, code: p.code })));
        
        if (platformsResult.rowCount === 0) {
            console.log('\n❌ لا توجد منصات في هذا الفرع!');
            return;
        }
        
        // Test 4: Simulate API calls
        console.log('\n4️⃣ محاكاة API calls التي يقوم بها المتصفح:\n');
        
        console.log('   GET /api/branches');
        console.log(`   ✅ النتيجة: ${branchesResult.rowCount} فرع\n`);
        
        console.log(`   GET /api/branches/${testBranchId}/incubators`);
        console.log(`   ✅ النتيجة: ${incubatorsResult.rowCount} حاضنة\n`);
        
        console.log(`   GET /api/branches/${testBranchId}/platforms`);
        console.log(`   ✅ النتيجة: ${platformsResult.rowCount} منصة\n`);
        
        console.log('\n═══════════════════════════════════════');
        console.log('✅ جميع الاستعلامات تعمل بشكل صحيح!');
        console.log('═══════════════════════════════════════');
        
        console.log('\n📋 ملخص:');
        console.log(`   • عند اختيار الفرع "${branchesResult.rows[0].name}"`);
        console.log(`   • يجب أن تظهر ${incubatorsResult.rowCount} حاضنة في القائمة المنسدلة`);
        console.log(`   • يجب أن تظهر ${platformsResult.rowCount} منصة في القائمة المنسدلة`);
        
    } catch (error) {
        console.error('❌ خطأ:', error.message);
        console.error(error.stack);
    } finally {
        await pool.end();
    }
}

testOfficeCreationFlow();
