const { Pool } = require('pg');

const pool = new Pool({
    connectionString: 'postgresql://postgres:PddzJpAQYezqknsntSzmCUlQYuYJldcT@crossover.proxy.rlwy.net:44255/railway',
    ssl: { rejectUnauthorized: false }
});

async function makeIncubatorsAvailableForAllBranches() {
    const client = await pool.connect();
    
    try {
        await client.query('BEGIN');
        
        console.log('🔄 جاري جعل الحاضنات متاحة لجميع الفروع...\n');
        
        // Get all unique incubator names (100 incubators)
        const incubatorsResult = await client.query(`
            SELECT DISTINCT name, code, description, program_type, capacity, 
                   contact_email, contact_phone, manager_name, is_active
            FROM incubators
            ORDER BY name
        `);
        
        const uniqueIncubators = incubatorsResult.rows;
        console.log(`📊 عدد الحاضنات الفريدة: ${uniqueIncubators.length}`);
        
        // Get all branches
        const branchesResult = await client.query('SELECT id, name FROM branches ORDER BY id');
        const branches = branchesResult.rows;
        console.log(`📊 عدد الفروع: ${branches.length}\n`);
        
        // Delete old incubators and their entities
        console.log('🗑️  حذف الحاضنات القديمة...');
        await client.query('DELETE FROM entities WHERE tenant_type = \'INCUBATOR\'');
        await client.query('DELETE FROM incubators');
        console.log('   ✅ تم الحذف\n');
        
        // Now create each incubator for each branch
        console.log('➕ إضافة الحاضنات لكل فرع...');
        
        let totalInserted = 0;
        let incubatorCounter = 0;
        
        for (const incubator of uniqueIncubators) {
            incubatorCounter++;
            
            for (const branch of branches) {
                const code = `INC-${branch.id}-${String(incubatorCounter).padStart(3, '0')}`;
                
                // Insert incubator for this branch
                const incResult = await client.query(`
                    INSERT INTO incubators (
                        branch_id, name, code, description, program_type, 
                        capacity, contact_email, contact_phone, manager_name, is_active
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                    RETURNING id
                `, [
                    branch.id,
                    incubator.name,
                    code,
                    `حاضنة ${incubator.name} - ${branch.name}`,
                    incubator.program_type || 'MIXED',
                    incubator.capacity || 100,
                    `${code.toLowerCase()}@nayosh.com`,
                    incubator.contact_phone || '+966 50 000 0000',
                    incubator.manager_name || 'مدير الحاضنة',
                    incubator.is_active !== false
                ]);
                
                const incubatorId = incResult.rows[0].id;
                
                // Create entity for this incubator
                const entityId = code;
                
                await client.query(`
                    INSERT INTO entities (
                        id, name, type, tenant_type, tenant_id, hq_id, branch_id, incubator_id,
                        status, balance, location, users_count, plan, theme
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
                `, [
                    entityId,
                    incubator.name,
                    'INCUBATOR',
                    'INCUBATOR',
                    incubatorId,
                    1, // HQ ID
                    branch.id,
                    incubatorId,
                    'Active',
                    0,
                    branch.name,
                    0,
                    'PRO',
                    'red'
                ]);
                
                totalInserted++;
            }
            
            // Progress indicator
            if (incubatorCounter % 10 === 0) {
                console.log(`   📈 تم معالجة ${incubatorCounter}/${uniqueIncubators.length} حاضنة...`);
            }
        }
        
        await client.query('COMMIT');
        
        console.log('\n✅ تمت العملية بنجاح!');
        console.log(`   📊 عدد الحاضنات الفريدة: ${uniqueIncubators.length}`);
        console.log(`   📊 عدد الفروع: ${branches.length}`);
        console.log(`   📊 إجمالي السجلات المضافة: ${totalInserted}`);
        console.log(`   📊 المتوقع: ${uniqueIncubators.length} × ${branches.length} = ${uniqueIncubators.length * branches.length}`);
        
        // Final verification
        const finalCount = await client.query(`
            SELECT 
                COUNT(*) as total,
                COUNT(DISTINCT name) as unique_names,
                COUNT(DISTINCT branch_id) as branches
            FROM incubators
        `);
        
        console.log(`\n🔍 التحقق النهائي:`);
        console.log(`   📊 إجمالي الحاضنات: ${finalCount.rows[0].total}`);
        console.log(`   📊 أسماء فريدة: ${finalCount.rows[0].unique_names}`);
        console.log(`   📊 عدد الفروع: ${finalCount.rows[0].branches}`);
        
        // Check entities
        const entitiesCount = await client.query(`
            SELECT COUNT(*) as count FROM entities WHERE tenant_type = 'INCUBATOR'
        `);
        console.log(`   📊 كيانات الحاضنات: ${entitiesCount.rows[0].count}`);
        
        console.log('\n🎉 الآن كل فرع يرى جميع الحاضنات!');
        
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ خطأ:', error.message);
        throw error;
    } finally {
        client.release();
        await pool.end();
    }
}

makeIncubatorsAvailableForAllBranches()
    .then(() => {
        console.log('\n✅ انتهت العملية بنجاح!');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n❌ فشلت العملية:', error);
        process.exit(1);
    });
