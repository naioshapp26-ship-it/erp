const { Pool } = require('pg');

const pool = new Pool({
    connectionString: 'postgresql://postgres:PddzJpAQYezqknsntSzmCUlQYuYJldcT@crossover.proxy.rlwy.net:44255/railway',
    ssl: { rejectUnauthorized: false }
});

async function checkHQ001Credentials() {
    const client = await pool.connect();
    
    try {
        console.log('🔍 فحص بيانات المستخدم HQ001...\n');
        
        // 1. فحص بيانات المستخدم الأساسية
        console.log('1️⃣ بيانات المستخدم:');
        const userQuery = `
            SELECT id, name, email, entity_id, entity_name, 
                   role, tenant_type, is_active,
                   created_at
            FROM users 
            WHERE entity_id = 'HQ001'
        `;
        const userResult = await client.query(userQuery);
        
        if (userResult.rows.length === 0) {
            console.log('❌ المستخدم HQ001 غير موجود!');
            return;
        }
        
        const user = userResult.rows[0];
        console.log('✅ المستخدم موجود:');
        console.log({
            id: user.id,
            name: user.name,
            email: user.email,
            entity_id: user.entity_id,
            entity_name: user.entity_name,
            role: user.role,
            tenant_type: user.tenant_type,
            is_active: user.is_active,
            created_at: user.created_at
        });
        
        // 2. فحص الأدوار المرتبطة
        console.log('\n2️⃣ الأدوار المرتبطة:');
        const rolesQuery = `
            SELECT r.id, r.name, r.name_ar, r.job_title_ar, 
                   r.hierarchy_level, r.min_approval_limit, r.max_approval_limit,
                   ur.is_active as role_active
            FROM user_roles ur
            JOIN roles r ON ur.role_id = r.id
            WHERE ur.user_id = $1
            ORDER BY r.hierarchy_level
        `;
        const rolesResult = await client.query(rolesQuery, [user.id]);
        
        if (rolesResult.rows.length === 0) {
            console.log('⚠️ لا توجد أدوار مرتبطة!');
        } else {
            console.log(`✅ عدد الأدوار: ${rolesResult.rows.length}`);
            rolesResult.rows.forEach(role => {
                console.log({
                    id: role.id,
                    name: role.name,
                    name_ar: role.name_ar,
                    job_title: role.job_title_ar,
                    level: role.hierarchy_level,
                    approval_limit: `${role.min_approval_limit} - ${role.max_approval_limit}`,
                    active: role.role_active
                });
            });
        }
        
        // 3. فحص الصلاحيات
        console.log('\n3️⃣ الصلاحيات:');
        const permissionsQuery = `
            SELECT DISTINCT p.id, p.name, p.resource, p.action
            FROM role_permissions rp
            JOIN permissions p ON rp.permission_id = p.id
            JOIN user_roles ur ON rp.role_id = ur.role_id
            WHERE ur.user_id = $1
            ORDER BY p.resource, p.action
        `;
        const permissionsResult = await client.query(permissionsQuery, [user.id]);
        console.log(`✅ عدد الصلاحيات: ${permissionsResult.rows.length}`);
        
        // عرض أول 10 صلاحيات
        const samplePermissions = permissionsResult.rows.slice(0, 10);
        samplePermissions.forEach(perm => {
            console.log(`   - ${perm.resource}:${perm.action} (${perm.name})`);
        });
        if (permissionsResult.rows.length > 10) {
            console.log(`   ... و ${permissionsResult.rows.length - 10} صلاحية أخرى`);
        }
        
        // 4. التحقق من وجود عمود كلمة المرور
        console.log('\n4️⃣ حالة كلمة المرور:');
        const columnsQuery = `
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'users' AND column_name = 'password'
        `;
        const columnsResult = await client.query(columnsQuery);
        
        if (columnsResult.rows.length === 0) {
            console.log('⚠️ عمود password غير موجود في جدول users');
            console.log('💡 سيتم إنشاء نظام مصادقة منفصل');
        } else {
            console.log('✅ عمود password موجود');
        }
        
        // 5. بيانات تسجيل الدخول المقترحة
        console.log('\n5️⃣ بيانات الدخول المقترحة:');
        console.log('═══════════════════════════════════════');
        console.log('البريد الإلكتروني:', user.email || 'admin@hq.com');
        console.log('كلمة المرور المؤقتة: Admin@123');
        console.log('رمز الكيان: HQ001');
        console.log('الدور:', user.role);
        console.log('═══════════════════════════════════════');
        
        return user;
        
    } catch (error) {
        console.error('❌ خطأ:', error.message);
        throw error;
    } finally {
        client.release();
        await pool.end();
    }
}

checkHQ001Credentials().catch(console.error);
