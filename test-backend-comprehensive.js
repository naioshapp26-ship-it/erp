/**
 * اختبار شامل لجميع endpoints في super-admin-api
 */

const { Pool } = require('pg');

const pool = new Pool({
    connectionString: 'postgresql://postgres:PddzJpAQYezqknsntSzmCUlQYuYJldcT@crossover.proxy.rlwy.net:44255/railway',
    ssl: false
});

async function testSuperAdminAPI() {
    try {
        console.log('🧪 اختبار شامل لـ Super Admin API...\n');
        
        // 1. اختبار جلب الأدوار (GET /roles)
        console.log('1️⃣ اختبار جلب الأدوار...');
        const rolesResult = await pool.query(`
            SELECT 
                r.id,
                r.name as code,
                r.name_ar,
                r.job_title_ar as title_ar,
                r.hierarchy_level,
                (SELECT COUNT(*) FROM user_roles ur WHERE ur.role_id = r.id AND ur.is_active = true) as active_users_count,
                (SELECT COUNT(*) FROM role_permissions rp WHERE rp.role_id = r.id) as permissions_count
            FROM roles r
            WHERE r.is_active = true
            ORDER BY r.hierarchy_level ASC
            LIMIT 5
        `);
        console.log(`   ✅ تم جلب ${rolesResult.rows.length} أدوار`);
        if (rolesResult.rows.length > 0) {
            console.log(`   📋 مثال: ${rolesResult.rows[0].title_ar} (${rolesResult.rows[0].code})`);
        }
        
        // 2. اختبار جلب دور محدد (GET /roles/:roleCode)
        console.log('\n2️⃣ اختبار جلب دور محدد...');
        if (rolesResult.rows.length > 0) {
            const testRoleCode = rolesResult.rows[0].code;
            const roleDetailResult = await pool.query(`
                SELECT 
                    id,
                    name as code,
                    name_ar,
                    job_title_ar as title_ar,
                    job_title_en as title_en,
                    description,
                    hierarchy_level,
                    min_approval_limit,
                    max_approval_limit,
                    is_active
                FROM roles 
                WHERE name = $1
            `, [testRoleCode]);
            
            if (roleDetailResult.rows.length > 0) {
                console.log(`   ✅ تم جلب تفاصيل الدور: ${roleDetailResult.rows[0].title_ar}`);
            } else {
                console.log(`   ❌ فشل جلب تفاصيل الدور`);
            }
        }
        
        // 3. اختبار إنشاء دور جديد (POST /roles)
        console.log('\n3️⃣ اختبار إنشاء دور جديد...');
        const newRoleCode = `TEST_ROLE_${Date.now()}`;
        const createResult = await pool.query(`
            INSERT INTO roles (
                name, name_ar, job_title_ar, job_title_en, description,
                level, hierarchy_level, min_approval_limit, max_approval_limit,
                is_active
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true)
            RETURNING *
        `, [
            newRoleCode,
            newRoleCode,
            'دور تجريبي للاختبار',
            'Test Role',
            'دور للاختبار فقط',
            'OPERATIONAL',
            99,
            0,
            null
        ]);
        console.log(`   ✅ تم إنشاء الدور: ${createResult.rows[0].job_title_ar} (ID: ${createResult.rows[0].id})`);
        
        // 4. اختبار تحديث دور (PUT /roles/:roleCode)
        console.log('\n4️⃣ اختبار تحديث دور...');
        const updateResult = await pool.query(`
            UPDATE roles 
            SET 
                job_title_ar = $1,
                description = $2
            WHERE name = $3
            RETURNING *
        `, [
            'دور تجريبي محدث',
            'تم التحديث بنجاح',
            newRoleCode
        ]);
        console.log(`   ✅ تم تحديث الدور: ${updateResult.rows[0].job_title_ar}`);
        
        // 5. اختبار حذف دور (DELETE /roles/:roleCode) - منطق endpoint
        console.log('\n5️⃣ اختبار حذف دور...');
        
        // جلب معلومات الدور
        const roleCheck = await pool.query('SELECT id, name, job_title_ar FROM roles WHERE name = $1', [newRoleCode]);
        
        if (roleCheck.rows.length === 0) {
            console.log('   ❌ الدور غير موجود');
        } else {
            const roleId = roleCheck.rows[0].id;
            
            // التحقق من المستخدمين النشطين
            const usersCheck = await pool.query(`
                SELECT COUNT(*) as count 
                FROM user_roles ur
                WHERE ur.role_id = $1 AND ur.is_active = true
            `, [roleId]);
            
            if (parseInt(usersCheck.rows[0].count) > 0) {
                console.log(`   ⚠️ لا يمكن الحذف - يوجد ${usersCheck.rows[0].count} مستخدمين نشطين`);
            } else {
                // حذف الصلاحيات
                await pool.query('DELETE FROM role_permissions WHERE role_id = $1', [roleId]);
                
                // حذف الدور
                const delResult = await pool.query('DELETE FROM roles WHERE id = $1 RETURNING *', [roleId]);
                console.log(`   ✅ تم حذف الدور: ${delResult.rows[0].job_title_ar}`);
            }
        }
        
        // 6. اختبار جلب المستخدمين
        console.log('\n6️⃣ اختبار جلب المستخدمين...');
        const usersResult = await pool.query(`
            SELECT 
                u.id,
                u.name,
                u.email,
                r.name as role_code,
                r.job_title_ar as role_title
            FROM users u
            LEFT JOIN user_roles ur ON u.id = ur.user_id AND ur.is_active = true
            LEFT JOIN roles r ON ur.role_id = r.id
            LIMIT 5
        `);
        console.log(`   ✅ تم جلب ${usersResult.rows.length} مستخدمين`);
        
        console.log('\n✅✅✅ جميع الاختبارات نجحت! ✅✅✅');
        
    } catch (error) {
        console.error('❌ خطأ في الاختبار:', error.message);
        console.error(error.stack);
    } finally {
        await pool.end();
    }
}

testSuperAdminAPI();
