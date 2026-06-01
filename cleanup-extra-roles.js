const { Pool } = require('pg');

const pool = new Pool({
    connectionString: 'postgresql://postgres:PddzJpAQYezqknsntSzmCUlQYuYJldcT@crossover.proxy.rlwy.net:44255/railway',
    ssl: false
});

async function cleanupRoles() {
    const client = await pool.connect();
    
    try {
        console.log('\n🧹 تنظيف الأدوار وحذف الزائدة...\n');
        
        // الأدوار الـ 33 الصحيحة فقط
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
        
        // 1. عرض الأدوار التي سيتم حذفها
        const toDeleteResult = await client.query(`
            SELECT id, name, name_ar, job_title_ar
            FROM roles
            WHERE name NOT IN (${correctRoles.map((_, i) => `$${i + 1}`).join(',')})
            ORDER BY id
        `, correctRoles);
        
        console.log(`📋 الأدوار التي سيتم حذفها (${toDeleteResult.rows.length}):\n`);
        toDeleteResult.rows.forEach(role => {
            console.log(`   ❌ ID: ${role.id} | ${role.name} | ${role.job_title_ar || role.name_ar || 'لا يوجد'}`);
        });
        
        if (toDeleteResult.rows.length === 0) {
            console.log('✅ لا توجد أدوار للحذف\n');
            return;
        }
        
        console.log('\n⏳ جاري الحذف...\n');
        
        // 2. حذف الصلاحيات المرتبطة بالأدوار الزائدة أولاً
        const deletePermissionsResult = await client.query(`
            DELETE FROM role_system_permissions
            WHERE role_id IN (
                SELECT id FROM roles
                WHERE name NOT IN (${correctRoles.map((_, i) => `$${i + 1}`).join(',')})
            )
        `, correctRoles);
        
        console.log(`✅ تم حذف ${deletePermissionsResult.rowCount} صلاحية مرتبطة بالأدوار الزائدة`);
        
        // 3. حذف العلاقات من user_roles
        const deleteUserRolesResult = await client.query(`
            DELETE FROM user_roles
            WHERE role_id IN (
                SELECT id FROM roles
                WHERE name NOT IN (${correctRoles.map((_, i) => `$${i + 1}`).join(',')})
            )
        `, correctRoles);
        
        console.log(`✅ تم حذف ${deleteUserRolesResult.rowCount} علاقة من user_roles`);
        
        // 4. حذف الأدوار الزائدة
        const deleteRolesResult = await client.query(`
            DELETE FROM roles
            WHERE name NOT IN (${correctRoles.map((_, i) => `$${i + 1}`).join(',')})
        `, correctRoles);
        
        console.log(`✅ تم حذف ${deleteRolesResult.rowCount} دور زائد`);
        
        // 5. التحقق من النتيجة النهائية
        const finalCountResult = await client.query(`SELECT COUNT(*) as count FROM roles`);
        
        console.log('\n' + '='.repeat(60));
        console.log('✅ اكتمل التنظيف بنجاح!');
        console.log('='.repeat(60));
        console.log(`📊 عدد الأدوار الحالي: ${finalCountResult.rows[0].count}`);
        console.log(`📊 عدد الأدوار المتوقع: 33`);
        
        if (finalCountResult.rows[0].count === '33') {
            console.log('\n🎉 ممتاز! العدد صحيح - 33 دور فقط ✅');
        } else {
            console.log(`\n⚠️ تحذير: العدد غير متطابق (${finalCountResult.rows[0].count} بدلاً من 33)`);
        }
        console.log('='.repeat(60) + '\n');
        
    } catch (error) {
        console.error('❌ خطأ:', error.message);
        console.error(error.stack);
    } finally {
        client.release();
        await pool.end();
    }
}

cleanupRoles();
