const { Client } = require('pg');

const client = new Client({
    connectionString: 'postgresql://postgres:PddzJpAQYezqknsntSzmCUlQYuYJldcT@crossover.proxy.rlwy.net:44255/railway'
});

async function seedRBACData() {
    try {
        await client.connect();
        console.log('✅ Connected to database\n');

        console.log('📊 Seeding RBAC Data...\n');
        console.log('='.repeat(60));

        // 1. إضافة الأدوار (Roles)
        console.log('\n1️⃣ Adding Roles...');
        const roles = [
            { name: 'SUPER_ADMIN', name_ar: 'مدير النظام الرئيسي', level: 'HQ', is_system: true, description: 'صلاحيات كاملة على النظام بالكامل' },
            { name: 'HQ_ADMIN', name_ar: 'مدير المكتب الرئيسي', level: 'HQ', is_system: true, description: 'إدارة المكتب الرئيسي' },
            { name: 'BRANCH_ADMIN', name_ar: 'مدير الفرع', level: 'BRANCH', is_system: true, description: 'إدارة فرع معين' },
            { name: 'INCUBATOR_ADMIN', name_ar: 'مدير الحاضنة', level: 'INCUBATOR', is_system: true, description: 'إدارة حاضنة معينة' },
            { name: 'PLATFORM_ADMIN', name_ar: 'مدير المنصة', level: 'PLATFORM', is_system: true, description: 'إدارة منصة معينة' },
            { name: 'OFFICE_ADMIN', name_ar: 'مدير المكتب', level: 'OFFICE', is_system: true, description: 'إدارة مكتب معين' },
            { name: 'MANAGER', name_ar: 'مدير', level: 'ALL', is_system: true, description: 'مدير عام' },
            { name: 'ACCOUNTANT', name_ar: 'محاسب', level: 'ALL', is_system: true, description: 'إدارة الحسابات والفواتير' },
            { name: 'HR_MANAGER', name_ar: 'مدير موارد بشرية', level: 'ALL', is_system: true, description: 'إدارة الموظفين والطلبات' },
            { name: 'EMPLOYEE', name_ar: 'موظف', level: 'ALL', is_system: true, description: 'موظف عادي' },
            { name: 'AUDITOR', name_ar: 'مدقق', level: 'ALL', is_system: true, description: 'مراجعة العمليات فقط' },
            { name: 'VIEWER', name_ar: 'مشاهد', level: 'ALL', is_system: true, description: 'عرض البيانات فقط' }
        ];

        for (const role of roles) {
            await client.query(
                `INSERT INTO roles (name, name_ar, level, is_system, description) 
                 VALUES ($1, $2, $3, $4, $5) 
                 ON CONFLICT (name) DO NOTHING`,
                [role.name, role.name_ar, role.level, role.is_system, role.description]
            );
        }
        console.log(`✅ Added ${roles.length} roles`);

        // 2. إضافة الصلاحيات (Permissions)
        console.log('\n2️⃣ Adding Permissions...');
        const permissions = [
            // Users
            { name: 'users.create', name_ar: 'إنشاء مستخدم', resource: 'users', action: 'CREATE' },
            { name: 'users.read', name_ar: 'عرض المستخدمين', resource: 'users', action: 'READ' },
            { name: 'users.update', name_ar: 'تعديل مستخدم', resource: 'users', action: 'UPDATE' },
            { name: 'users.delete', name_ar: 'حذف مستخدم', resource: 'users', action: 'DELETE' },
            
            // Entities
            { name: 'entities.create', name_ar: 'إنشاء كيان', resource: 'entities', action: 'CREATE' },
            { name: 'entities.read', name_ar: 'عرض الكيانات', resource: 'entities', action: 'READ' },
            { name: 'entities.update', name_ar: 'تعديل كيان', resource: 'entities', action: 'UPDATE' },
            { name: 'entities.delete', name_ar: 'حذف كيان', resource: 'entities', action: 'DELETE' },
            
            // Invoices
            { name: 'invoices.create', name_ar: 'إنشاء فاتورة', resource: 'invoices', action: 'CREATE' },
            { name: 'invoices.read', name_ar: 'عرض الفواتير', resource: 'invoices', action: 'READ' },
            { name: 'invoices.update', name_ar: 'تعديل فاتورة', resource: 'invoices', action: 'UPDATE' },
            { name: 'invoices.delete', name_ar: 'حذف فاتورة', resource: 'invoices', action: 'DELETE' },
            { name: 'invoices.approve', name_ar: 'الموافقة على فاتورة', resource: 'invoices', action: 'APPROVE' },
            
            // Transactions
            { name: 'transactions.create', name_ar: 'إنشاء معاملة', resource: 'transactions', action: 'CREATE' },
            { name: 'transactions.read', name_ar: 'عرض المعاملات', resource: 'transactions', action: 'READ' },
            { name: 'transactions.approve', name_ar: 'الموافقة على معاملة', resource: 'transactions', action: 'APPROVE' },
            
            // Employees
            { name: 'employees.create', name_ar: 'إنشاء موظف', resource: 'employees', action: 'CREATE' },
            { name: 'employees.read', name_ar: 'عرض الموظفين', resource: 'employees', action: 'READ' },
            { name: 'employees.update', name_ar: 'تعديل موظف', resource: 'employees', action: 'UPDATE' },
            { name: 'employees.delete', name_ar: 'حذف موظف', resource: 'employees', action: 'DELETE' },
            
            // Reports
            { name: 'reports.read', name_ar: 'عرض التقارير', resource: 'reports', action: 'READ' },
            { name: 'reports.export', name_ar: 'تصدير التقارير', resource: 'reports', action: 'EXPORT' },
            
            // Audit Logs
            { name: 'audit.read', name_ar: 'عرض سجل المراجعات', resource: 'audit_logs', action: 'READ' },
            
            // Settings
            { name: 'settings.read', name_ar: 'عرض الإعدادات', resource: 'settings', action: 'READ' },
            { name: 'settings.update', name_ar: 'تعديل الإعدادات', resource: 'settings', action: 'UPDATE' },
            
            // Roles & Permissions
            { name: 'roles.manage', name_ar: 'إدارة الأدوار', resource: 'roles', action: 'MANAGE' },
            { name: 'permissions.manage', name_ar: 'إدارة الصلاحيات', resource: 'permissions', action: 'MANAGE' }
        ];

        for (const perm of permissions) {
            await client.query(
                `INSERT INTO permissions (name, name_ar, resource, action, description) 
                 VALUES ($1, $2, $3, $4, $5) 
                 ON CONFLICT (name) DO NOTHING`,
                [perm.name, perm.name_ar, perm.resource, perm.action, perm.description || `${perm.action} on ${perm.resource}`]
            );
        }
        console.log(`✅ Added ${permissions.length} permissions`);

        // 3. ربط الأدوار بالصلاحيات
        console.log('\n3️⃣ Mapping Roles to Permissions...');
        
        // SUPER_ADMIN - جميع الصلاحيات
        const superAdminRole = await client.query(`SELECT id FROM roles WHERE name = 'SUPER_ADMIN'`);
        const allPermissions = await client.query(`SELECT id FROM permissions`);
        
        for (const perm of allPermissions.rows) {
            await client.query(
                `INSERT INTO role_permissions (role_id, permission_id) 
                 VALUES ($1, $2) 
                 ON CONFLICT (role_id, permission_id) DO NOTHING`,
                [superAdminRole.rows[0].id, perm.id]
            );
        }
        console.log(`✅ SUPER_ADMIN: All ${allPermissions.rows.length} permissions`);

        // 4. إضافة قواعد الحوكمة
        console.log('\n4️⃣ Adding Governance Rules...');
        const governanceRules = [
            {
                name: 'INVOICE_APPROVAL_10K',
                name_ar: 'الموافقة على الفواتير أكبر من 10,000 ريال',
                rule_type: 'APPROVAL_REQUIRED',
                resource: 'invoices',
                conditions: JSON.stringify({ amount_greater_than: 10000 }),
                action_required: 'APPROVE',
                threshold_value: 10000,
                approvers_required: 1
            },
            {
                name: 'INVOICE_APPROVAL_50K',
                name_ar: 'الموافقة على الفواتير أكبر من 50,000 ريال',
                rule_type: 'APPROVAL_REQUIRED',
                resource: 'invoices',
                conditions: JSON.stringify({ amount_greater_than: 50000 }),
                action_required: 'APPROVE',
                threshold_value: 50000,
                approvers_required: 2
            },
            {
                name: 'TRANSACTION_DUAL_CONTROL',
                name_ar: 'رقابة ثنائية على المعاملات المالية',
                rule_type: 'DUAL_CONTROL',
                resource: 'transactions',
                conditions: JSON.stringify({ amount_greater_than: 5000 }),
                action_required: 'APPROVE',
                threshold_value: 5000,
                approvers_required: 2
            }
        ];

        for (const rule of governanceRules) {
            await client.query(
                `INSERT INTO governance_rules (name, name_ar, rule_type, resource, conditions, action_required, threshold_value, approvers_required) 
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8) 
                 ON CONFLICT (name) DO NOTHING`,
                [rule.name, rule.name_ar, rule.rule_type, rule.resource, rule.conditions, rule.action_required, rule.threshold_value, rule.approvers_required]
            );
        }
        console.log(`✅ Added ${governanceRules.length} governance rules`);

        console.log('\n🎉 RBAC System initialized successfully!\n');

    } catch (error) {
        console.error('❌ Error:', error.message);
        throw error;
    } finally {
        await client.end();
    }
}

seedRBACData();
