const { Pool } = require('pg');

const pool = new Pool({
    connectionString: 'postgresql://postgres:PddzJpAQYezqknsntSzmCUlQYuYJldcT@crossover.proxy.rlwy.net:44255/railway',
    ssl: false
});

async function checkCurrentRoles() {
    const client = await pool.connect();
    
    try {
        console.log('\n📊 فحص الأدوار الحالية...\n');
        
        const result = await client.query(`
            SELECT 
                id,
                name,
                name_ar,
                job_title_ar,
                hierarchy_level,
                level
            FROM roles
            ORDER BY id
        `);
        
        console.log(`إجمالي الأدوار: ${result.rows.length}\n`);
        
        const nameCount = {};
        result.rows.forEach(row => {
            if (!nameCount[row.name]) {
                nameCount[row.name] = [];
            }
            nameCount[row.name].push(row);
        });
        
        console.log('🔍 الأدوار المكررة:\n');
        let duplicatesFound = false;
        Object.keys(nameCount).forEach(name => {
            if (nameCount[name].length > 1) {
                duplicatesFound = true;
                console.log(`❌ ${name} - مكرر ${nameCount[name].length} مرة:`);
                nameCount[name].forEach(role => {
                    console.log(`   ID: ${role.id} | ${role.job_title_ar || role.name_ar || 'لا يوجد'}`);
                });
                console.log('');
            }
        });
        
        if (!duplicatesFound) {
            console.log('✅ لا توجد تكرارات\n');
        }
        
        const correctRoles = [
            'SUPER_ADMIN',
            'FINANCIAL_MANAGER_HQ', 'EXECUTIVE_MANAGER_HQ', 'HR_MANAGER_HQ',
            'PROCUREMENT_MANAGER_HQ', 'SALES_MANAGER_HQ', 'MARKETING_MANAGER_HQ',
            'SUPPLY_CHAIN_MANAGER_HQ', 'SAFETY_MANAGER_HQ', 'WAREHOUSE_MANAGER_HQ',
            'ACCOUNTANT_HQ',
            'BRANCH_MANAGER', 'ASSISTANT_BRANCH_MANAGER', 'HR_OFFICER_BRANCH',
            'FINANCE_OFFICER_BRANCH', 'SALES_OFFICER_BRANCH',
            'INCUBATOR_MANAGER', 'ASSISTANT_INCUBATOR_MANAGER',
            'HR_SPECIALIST_INCUBATOR', 'FINANCE_SPECIALIST_INCUBATOR',
            'PLATFORM_MANAGER', 'ASSISTANT_PLATFORM_MANAGER', 'PLATFORM_COORDINATOR',
            'EXECUTIVE_OFFICE_MANAGER', 'ADMINISTRATIVE_EXECUTIVE',
            'HR_EXECUTIVE', 'FINANCE_EXECUTIVE', 'PROCUREMENT_EXECUTIVE',
            'SALES_EXECUTIVE', 'MARKETING_EXECUTIVE', 'LOGISTICS_EXECUTIVE',
            'SAFETY_EXECUTIVE', 'WAREHOUSE_EXECUTIVE', 'EMPLOYEE'
        ];
        
        console.log('\n📋 الأدوار الزائدة (يجب حذفها):\n');
        const extraRoles = result.rows.filter(r => !correctRoles.includes(r.name));
        if (extraRoles.length > 0) {
            extraRoles.forEach(role => {
                console.log(`❌ ID: ${role.id} | ${role.name} | ${role.job_title_ar || role.name_ar || 'لا يوجد'}`);
            });
            console.log(`\nإجمالي الأدوار الزائدة: ${extraRoles.length}`);
        } else {
            console.log('✅ لا توجد أدوار زائدة\n');
        }
        
    } catch (error) {
        console.error('❌ خطأ:', error.message);
    } finally {
        client.release();
        await pool.end();
    }
}

checkCurrentRoles();
