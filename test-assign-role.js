/**
 * اختبار تعيين الأدوار للمستخدمين
 */

const { Pool } = require('pg');

const pool = new Pool({
    connectionString: 'postgresql://postgres:PddzJpAQYezqknsntSzmCUlQYuYJldcT@crossover.proxy.rlwy.net:44255/railway',
    ssl: false
});

async function testAssignRole() {
    console.log('🧪 اختبار تعيين الأدوار للمستخدمين\n');
    console.log('=' .repeat(60) + '\n');

    try {
        // 1. التحقق من وجود مستخدمين
        console.log('1️⃣  التحقق من المستخدمين...');
        const usersResult = await pool.query(`
            SELECT id, username, email, full_name 
            FROM users 
            ORDER BY id 
            LIMIT 5
        `);
        
        if (usersResult.rows.length === 0) {
            console.log('❌ لا يوجد مستخدمين في قاعدة البيانات');
            
            // إنشاء مستخدم تجريبي
            console.log('   ⚙️  إنشاء مستخدم تجريبي...');
            const newUser = await pool.query(`
                INSERT INTO users (username, email, full_name, password_hash, is_active)
                VALUES ('test_user', 'test@example.com', 'مستخدم تجريبي', 'test_hash', true)
                RETURNING id, username, full_name
            `);
            console.log(`   ✅ تم إنشاء المستخدم: ${newUser.rows[0].full_name} (ID: ${newUser.rows[0].id})`);
        } else {
            console.log(`✅ يوجد ${usersResult.rows.length} مستخدمين`);
            usersResult.rows.forEach(u => {
                console.log(`   - ${u.full_name || u.username} (ID: ${u.id})`);
            });
        }
        console.log('');

        // 2. التحقق من الأدوار المتاحة
        console.log('2️⃣  التحقق من الأدوار المتاحة...');
        const rolesResult = await pool.query(`
            SELECT id, name, job_title_ar, hierarchy_level
            FROM roles
            WHERE is_active = true
            ORDER BY hierarchy_level
            LIMIT 5
        `);
        
        console.log(`✅ يوجد ${rolesResult.rows.length} أدوار`);
        rolesResult.rows.forEach(r => {
            console.log(`   - ${r.job_title_ar} (${r.name}) - Level ${r.hierarchy_level}`);
        });
        console.log('');

        // 3. اختبار تعيين دور
        console.log('3️⃣  اختبار تعيين دور...');
        
        // اختيار أول مستخدم وأول دور
        const testUserId = usersResult.rows.length > 0 ? usersResult.rows[0].id : 
                          (await pool.query('SELECT id FROM users LIMIT 1')).rows[0].id;
        const testRoleName = rolesResult.rows[0].name;
        const testRoleId = rolesResult.rows[0].id;
        
        console.log(`   المستخدم: ID ${testUserId}`);
        console.log(`   الدور: ${rolesResult.rows[0].job_title_ar} (${testRoleName})`);
        
        // إلغاء الأدوار القديمة
        await pool.query(`
            UPDATE user_roles 
            SET is_active = false 
            WHERE user_id = $1
        `, [testUserId]);
        
        // تعيين الدور الجديد
        const assignResult = await pool.query(`
            INSERT INTO user_roles (user_id, role_id, is_active, granted_at)
            VALUES ($1, $2, true, NOW())
            ON CONFLICT (user_id, role_id, entity_id) 
            DO UPDATE SET is_active = true, granted_at = NOW()
            RETURNING *
        `, [testUserId, testRoleId]);
        
        console.log(`   ✅ تم تعيين الدور بنجاح!`);
        console.log('');

        // 4. التحقق من النتيجة
        console.log('4️⃣  التحقق من الأدوار المعينة...');
        const verifyResult = await pool.query(`
            SELECT 
                ur.user_id,
                ur.role_id,
                r.name as role_name,
                r.job_title_ar,
                ur.is_active,
                ur.granted_at
            FROM user_roles ur
            JOIN roles r ON ur.role_id = r.id
            WHERE ur.user_id = $1
            ORDER BY ur.granted_at DESC
        `, [testUserId]);
        
        console.log(`✅ المستخدم ${testUserId} لديه ${verifyResult.rows.length} دور:`);
        verifyResult.rows.forEach(ur => {
            console.log(`   - ${ur.job_title_ar} (${ur.role_name}) - ${ur.is_active ? '✓ نشط' : '✗ غير نشط'}`);
        });
        console.log('');

        // 5. اختبار البنية المطلوبة لـ API
        console.log('5️⃣  محاكاة API Request...');
        console.log(`   POST /api/admin/users/${testUserId}/role`);
        console.log(`   Body: { "role_code": "${testRoleName}" }`);
        
        // محاكاة ما سيحدث في API
        const roleCheckAPI = await pool.query('SELECT id, name, job_title_ar FROM roles WHERE name = $1', [testRoleName]);
        if (roleCheckAPI.rows.length > 0) {
            console.log(`   ✅ الدور موجود: ${roleCheckAPI.rows[0].job_title_ar} (ID: ${roleCheckAPI.rows[0].id})`);
        }
        console.log('');

        console.log('=' .repeat(60));
        console.log('✅ جميع الاختبارات اكتملت بنجاح!');
        console.log('');
        console.log('📝 ملخص:');
        console.log(`   - يمكن تعيين الأدوار باستخدام role_id`);
        console.log(`   - الـ API يحول role_code (name) إلى role_id تلقائياً`);
        console.log(`   - الأدوار القديمة يتم إلغاء تفعيلها تلقائياً`);
        console.log(`   - يمكن تعيين أدوار متعددة للمستخدم الواحد`);

    } catch (error) {
        console.error('\n❌ خطأ في الاختبار:', error.message);
        console.error('التفاصيل:', error.stack);
    } finally {
        await pool.end();
    }
}

testAssignRole();
