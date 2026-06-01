const { Pool } = require('pg');

const pool = new Pool({
    connectionString: 'postgresql://postgres:PddzJpAQYezqknsntSzmCUlQYuYJldcT@crossover.proxy.rlwy.net:44255/railway',
    ssl: { rejectUnauthorized: false }
});

async function makeIncubatorsAndPlatformsAvailableForAll() {
    const client = await pool.connect();
    
    try {
        await client.query('BEGIN');
        
        console.log('🚀 بدء عملية جعل الحاضنات والمنصات متاحة لجميع الفروع...\n');
        
        // Get all branches
        const branchesResult = await client.query('SELECT id, name, code FROM branches ORDER BY id');
        const branches = branchesResult.rows;
        console.log(`📋 عدد الفروع: ${branches.length}\n`);
        
        // Get master incubators (from branch 1)
        const masterIncubatorsResult = await client.query(`
            SELECT name, code, description, program_type, capacity, 
                   contact_email, contact_phone, manager_name, is_active
            FROM incubators
            WHERE branch_id = 1
            ORDER BY id
        `);
        const masterIncubators = masterIncubatorsResult.rows;
        console.log(`🏢 عدد الحاضنات الأساسية: ${masterIncubators.length}\n`);
        
        // Get master platforms (linked to branch 1 incubators)
        const masterPlatformsResult = await client.query(`
            SELECT p.name, p.code, p.description, p.platform_type, 
                   p.pricing_model, p.base_price, p.currency, 
                   p.features, p.settings, p.is_active,
                   i.code as incubator_code
            FROM platforms p
            JOIN incubators i ON p.incubator_id = i.id
            WHERE i.branch_id = 1
            ORDER BY p.id
        `);
        const masterPlatforms = masterPlatformsResult.rows;
        console.log(`💻 عدد المنصات الأساسية: ${masterPlatforms.length}\n`);
        
        // Check existing incubators per branch
        const existingIncResult = await client.query(`
            SELECT branch_id, COUNT(*) as count
            FROM incubators
            GROUP BY branch_id
            ORDER BY branch_id
        `);
        console.log('📊 الحاضنات الموجودة حالياً:', existingIncResult.rows);
        
        // Now replicate for all branches
        let totalIncubatorsCreated = 0;
        let totalPlatformsCreated = 0;
        
        for (const branch of branches) {
            // Skip branch 1 as it already has the data
            if (branch.id === 1) {
                console.log(`✅ الفرع ${branch.name} (ID: ${branch.id}) - يحتوي بالفعل على البيانات\n`);
                continue;
            }
            
            console.log(`\n🔄 معالجة الفرع: ${branch.name} (ID: ${branch.id})`);
            
            // Check if this branch already has incubators
            const branchIncResult = await client.query(
                'SELECT COUNT(*) FROM incubators WHERE branch_id = $1',
                [branch.id]
            );
            
            if (parseInt(branchIncResult.rows[0].count) > 0) {
                console.log(`   ⚠️  الفرع يحتوي بالفعل على ${branchIncResult.rows[0].count} حاضنة - سيتم التخطي`);
                continue;
            }
            
            // Map to store old incubator code to new incubator id
            const incubatorMap = new Map();
            let incCounter = 0;
            
            // Create incubators for this branch
            for (const masterInc of masterIncubators) {
                incCounter++;
                const newCode = `INC-${branch.id}-${String(incCounter).padStart(3, '0')}`;
                
                const incResult = await client.query(`
                    INSERT INTO incubators (
                        branch_id, name, code, description, program_type, 
                        capacity, contact_email, contact_phone, manager_name, is_active
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                    RETURNING id
                `, [
                    branch.id,
                    masterInc.name,
                    newCode,
                    masterInc.description || `حاضنة ${masterInc.name} - ${branch.name}`,
                    masterInc.program_type || 'MIXED',
                    masterInc.capacity || 100,
                    masterInc.contact_email || `${newCode.toLowerCase()}@nayosh.com`,
                    masterInc.contact_phone || '+966 50 000 0000',
                    masterInc.manager_name || 'مدير الحاضنة',
                    masterInc.is_active !== false
                ]);
                
                const newIncubatorId = incResult.rows[0].id;
                incubatorMap.set(masterInc.code, newIncubatorId);
                totalIncubatorsCreated++;
                
                // Create entity for this incubator
                const entityId = newCode;
                
                await client.query(`
                    INSERT INTO entities (
                        id, name, type, tenant_type, tenant_id, hq_id, branch_id, incubator_id,
                        status, balance, location, users_count, plan, theme
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
                    ON CONFLICT (id) DO NOTHING
                `, [
                    entityId,
                    masterInc.name,
                    'INCUBATOR',
                    'INCUBATOR',
                    newIncubatorId,
                    1,
                    branch.id,
                    newIncubatorId,
                    'Active',
                    0,
                    branch.name,
                    0,
                    'PRO',
                    'red'
                ]);
            }
            
            console.log(`   ✅ تم إنشاء ${incCounter} حاضنة`);
            
            // Create platforms for this branch
            let platCounter = 0;
            for (const masterPlat of masterPlatforms) {
                const newIncubatorId = incubatorMap.get(masterPlat.incubator_code);
                
                if (!newIncubatorId) {
                    console.log(`   ⚠️  لم يتم العثور على الحاضنة ${masterPlat.incubator_code}`);
                    continue;
                }
                
                platCounter++;
                const newCode = `PLT-${branch.id}-${String(platCounter).padStart(3, '0')}`;
                
                const platResult = await client.query(`
                    INSERT INTO platforms (
                        incubator_id, name, code, description, platform_type,
                        pricing_model, base_price, currency, features, settings, is_active
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
                    RETURNING id
                `, [
                    newIncubatorId,
                    masterPlat.name,
                    newCode,
                    masterPlat.description || `منصة ${masterPlat.name} - ${branch.name}`,
                    masterPlat.platform_type || 'DIGITAL',
                    masterPlat.pricing_model || 'SUBSCRIPTION',
                    masterPlat.base_price || 0,
                    masterPlat.currency || 'SAR',
                    masterPlat.features || {},
                    masterPlat.settings || {},
                    masterPlat.is_active !== false
                ]);
                
                const newPlatformId = platResult.rows[0].id;
                totalPlatformsCreated++;
                
                // Create entity for this platform
                const entityId = newCode;
                
                await client.query(`
                    INSERT INTO entities (
                        id, name, type, tenant_type, tenant_id, hq_id, branch_id, 
                        incubator_id, platform_id,
                        status, balance, location, users_count, plan, theme
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
                    ON CONFLICT (id) DO NOTHING
                `, [
                    entityId,
                    masterPlat.name,
                    'PLATFORM',
                    'PLATFORM',
                    newPlatformId,
                    1,
                    branch.id,
                    newIncubatorId,
                    newPlatformId,
                    'Active',
                    0,
                    branch.name,
                    0,
                    'PRO',
                    'blue'
                ]);
            }
            
            console.log(`   ✅ تم إنشاء ${platCounter} منصة`);
        }
        
        await client.query('COMMIT');
        
        console.log('\n\n✅ ═══════════════════════════════════════');
        console.log('✅ تمت العملية بنجاح!');
        console.log('✅ ═══════════════════════════════════════');
        console.log(`📊 إجمالي الحاضنات المنشأة: ${totalIncubatorsCreated}`);
        console.log(`📊 إجمالي المنصات المنشأة: ${totalPlatformsCreated}`);
        
        // Final verification
        console.log('\n\n🔍 التحقق النهائي...');
        
        const finalIncResult = await pool.query(`
            SELECT branch_id, COUNT(*) as count
            FROM incubators
            GROUP BY branch_id
            ORDER BY branch_id
        `);
        console.log('\n📈 الحاضنات لكل فرع:', finalIncResult.rows);
        
        const finalPlatResult = await pool.query(`
            SELECT i.branch_id, COUNT(p.*) as count
            FROM platforms p
            JOIN incubators i ON p.incubator_id = i.id
            GROUP BY i.branch_id
            ORDER BY i.branch_id
        `);
        console.log('📈 المنصات لكل فرع:', finalPlatResult.rows);
        
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('\n❌ خطأ:', error.message);
        console.error(error.stack);
    } finally {
        client.release();
        await pool.end();
    }
}

makeIncubatorsAndPlatformsAvailableForAll();
