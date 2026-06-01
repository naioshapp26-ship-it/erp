const { Pool } = require('pg');

async function testDropdowns() {
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });

    try {
        console.log('🧪 اختبار القوائم المنسدلة...\n');

        // Get first branch
        const branchResult = await pool.query(
            "SELECT id, code, name FROM entities WHERE type = 'BRANCH' LIMIT 1"
        );
        
        if (branchResult.rows.length === 0) {
            console.log('❌ لا يوجد فروع في قاعدة البيانات');
            return;
        }

        const branch = branchResult.rows[0];
        console.log(`📍 الفرع المختار: ${branch.name} (${branch.code})\n`);

        // Test incubators API
        console.log('1️⃣ اختبار API الحاضنات:');
        const incubatorsQuery = `
            SELECT DISTINCT i.id, i.code, i.name
            FROM entities i
            INNER JOIN branch_incubators bi ON i.id = bi.incubator_id
            WHERE bi.branch_id = $1
            AND i.type = 'INCUBATOR'
            AND bi.relationship_status = 'ACTIVE'
            ORDER BY i.name
        `;
        
        const incResult = await pool.query(incubatorsQuery, [branch.id]);
        console.log(`   ✅ عدد الحاضنات: ${incResult.rows.length}`);
        
        if (incResult.rows.length > 0) {
            console.log('   🔹 أول 5 حاضنات:');
            incResult.rows.slice(0, 5).forEach(inc => {
                console.log(`      - ${inc.name} (${inc.code})`);
            });
        }

        // Test platforms API
        console.log('\n2️⃣ اختبار API المنصات:');
        const platformsQuery = `
            SELECT DISTINCT p.id, p.code, p.name
            FROM entities p
            INNER JOIN branch_platforms bp ON p.id = bp.platform_id
            WHERE bp.branch_id = $1
            AND p.type = 'PLATFORM'
            AND bp.relationship_status = 'ACTIVE'
            ORDER BY p.name
        `;
        
        const platResult = await pool.query(platformsQuery, [branch.id]);
        console.log(`   ✅ عدد المنصات: ${platResult.rows.length}`);
        
        if (platResult.rows.length > 0) {
            console.log('   🔸 أول 5 منصات:');
            platResult.rows.slice(0, 5).forEach(plat => {
                console.log(`      - ${plat.name} (${plat.code})`);
            });
        }

        // Test all branches
        console.log('\n3️⃣ اختبار جميع الفروع:');
        const allBranchesResult = await pool.query(
            "SELECT id, code, name FROM entities WHERE type = 'BRANCH' ORDER BY code"
        );
        
        console.log(`   📊 إجمالي الفروع: ${allBranchesResult.rows.length}\n`);
        
        for (const b of allBranchesResult.rows.slice(0, 10)) {
            const incCount = await pool.query(
                `SELECT COUNT(*) FROM branch_incubators 
                 WHERE branch_id = $1 AND relationship_status = 'ACTIVE'`,
                [b.id]
            );
            
            const platCount = await pool.query(
                `SELECT COUNT(*) FROM branch_platforms 
                 WHERE branch_id = $1 AND relationship_status = 'ACTIVE'`,
                [b.id]
            );
            
            console.log(`   ${b.code}: ${incCount.rows[0].count} حاضنة, ${platCount.rows[0].count} منصة`);
        }

        console.log('\n✅ الاختبار اكتمل بنجاح!');

    } catch (error) {
        console.error('❌ خطأ:', error.message);
        throw error;
    } finally {
        await pool.end();
    }
}

testDropdowns();
