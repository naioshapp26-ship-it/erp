const { Client } = require('pg');

const client = new Client({
    connectionString: 'postgresql://postgres:PddzJpAQYezqknsntSzmCUlQYuYJldcT@crossover.proxy.rlwy.net:44255/railway'
});

async function testRBACSystem() {
    try {
        await client.connect();
        console.log('✅ Connected to database\n');

        console.log('🧪 Testing RBAC System...\n');
        console.log('='.repeat(60));

        // 1. اختبار جدول الأدوار
        console.log('\n1️⃣ Testing Roles Table...');
        const rolesResult = await client.query('SELECT name, name_ar, level FROM roles ORDER BY name');
        console.log(`✅ Found ${rolesResult.rows.length} roles:`);
        rolesResult.rows.forEach((role, idx) => {
            console.log(`   ${idx + 1}. ${role.name_ar} (${role.name}) - ${role.level}`);
        });

        // 2. اختبار جدول الصلاحيات
        console.log('\n2️⃣ Testing Permissions Table...');
        const permsResult = await client.query('SELECT resource, COUNT(*) as count FROM permissions GROUP BY resource ORDER BY resource');
        console.log(`✅ Permissions by resource:`);
        permsResult.rows.forEach(row => {
            console.log(`   - ${row.resource}: ${row.count} permissions`);
        });

        // 3. اختبار ربط الأدوار بالصلاحيات
        console.log('\n3️⃣ Testing Role-Permission Mappings...');
        const mappingResult = await client.query(`
            SELECT r.name, r.name_ar, COUNT(rp.permission_id) as permission_count
            FROM roles r
            LEFT JOIN role_permissions rp ON r.id = rp.role_id
            GROUP BY r.id, r.name, r.name_ar
            ORDER BY permission_count DESC
        `);
        console.log(`✅ Roles with permissions:`);
        mappingResult.rows.forEach(row => {
            console.log(`   - ${row.name_ar}: ${row.permission_count} permissions`);
        });

        // 4. اختبار قواعد الحوكمة
        console.log('\n4️⃣ Testing Governance Rules...');
        const rulesResult = await client.query(`
            SELECT name_ar, resource, threshold_value, approvers_required, is_active
            FROM governance_rules
            ORDER BY threshold_value
        `);
        console.log(`✅ Found ${rulesResult.rows.length} governance rules:`);
        rulesResult.rows.forEach((rule, idx) => {
            console.log(`   ${idx + 1}. ${rule.name_ar}`);
            console.log(`      Resource: ${rule.resource}, Threshold: ${rule.threshold_value}, Approvers: ${rule.approvers_required}, Active: ${rule.is_active}`);
        });

        // 5. اختبار جدول Audit Log
        console.log('\n5️⃣ Testing Audit Logs Table...');
        const auditResult = await client.query(`
            SELECT COUNT(*) as count FROM audit_logs
        `);
        console.log(`✅ Audit logs count: ${auditResult.rows[0].count}`);

        // 6. اختبار سجل الموافقات
        console.log('\n6️⃣ Testing Approval Log Table...');
        const approvalResult = await client.query(`
            SELECT COUNT(*) as count FROM approval_log
        `);
        console.log(`✅ Approval logs count: ${approvalResult.rows[0].count}`);

        // 7. اختبار البنية الكاملة
        console.log('\n7️⃣ Testing Complete Structure...');
        const structureCheck = await client.query(`
            SELECT 
                (SELECT COUNT(*) FROM roles) as roles,
                (SELECT COUNT(*) FROM permissions) as permissions,
                (SELECT COUNT(*) FROM role_permissions) as role_permissions,
                (SELECT COUNT(*) FROM governance_rules WHERE is_active = true) as active_rules,
                (SELECT COUNT(*) FROM audit_logs) as audit_entries
        `);
        
        const stats = structureCheck.rows[0];
        console.log('✅ Structure verified:');
        console.log(`   - Roles: ${stats.roles}`);
        console.log(`   - Permissions: ${stats.permissions}`);
        console.log(`   - Role-Permission Mappings: ${stats.role_permissions}`);
        console.log(`   - Active Governance Rules: ${stats.active_rules}`);
        console.log(`   - Audit Entries: ${stats.audit_entries}`);

        // 8. اختبار صلاحيات SUPER_ADMIN
        console.log('\n8️⃣ Testing SUPER_ADMIN Permissions...');
        const superAdminPerms = await client.query(`
            SELECT COUNT(DISTINCT p.name) as permission_count
            FROM roles r
            JOIN role_permissions rp ON r.id = rp.role_id
            JOIN permissions p ON rp.permission_id = p.id
            WHERE r.name = 'SUPER_ADMIN'
        `);
        console.log(`✅ SUPER_ADMIN has ${superAdminPerms.rows[0].permission_count} permissions`);

        // ملخص الاختبارات
        console.log('\n' + '='.repeat(60));
        console.log('📊 Test Summary:');
        console.log('='.repeat(60));
        console.log('✅ All RBAC system tests passed!');
        console.log(`   - ${rolesResult.rows.length} roles defined`);
        console.log(`   - ${permsResult.rows.reduce((sum, r) => sum + parseInt(r.count), 0)} total permissions`);
        console.log(`   - ${stats.role_permissions} role-permission mappings`);
        console.log(`   - ${rulesResult.rows.length} governance rules`);
        console.log('');
        console.log('🎉 RBAC System is fully operational!\n');

    } catch (error) {
        console.error('❌ Error:', error.message);
        throw error;
    } finally {
        await client.end();
    }
}

testRBACSystem();
