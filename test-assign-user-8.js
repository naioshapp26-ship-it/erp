const { Pool } = require('pg');
const pool = new Pool({
    connectionString: 'postgresql://postgres:PddzJpAQYezqknsntSzmCUlQYuYJldcT@crossover.proxy.rlwy.net:44255/railway',
    ssl: false
});

async function testAssignUser8() {
    try {
        console.log('🧪 اختبار تعيين دور للمستخدم رقم 8 (كريم)...\n');
        
        const userId = 8;
        const roleCode = 'FINANCIAL_MANAGER_HQ';
        
        // 1. الحالة قبل التعيين
        console.log('1️⃣  الحالة قبل التعيين:');
        let before = await pool.query(`
            SELECT COUNT(*) as count, 
                   COUNT(*) FILTER (WHERE is_active = true) as active_count
            FROM user_roles WHERE user_id = $1
        `, [userId]);
        console.log(`   إجمالي السجلات: ${before.rows[0].count}`);
        console.log(`   النشطة: ${before.rows[0].active_count}`);
        
        // 2. جلب role_id
        const roleCheck = await pool.query('SELECT id, job_title_ar FROM roles WHERE name = $1', [roleCode]);
        if (roleCheck.rows.length === 0) {
            console.log('❌ الدور غير موجود');
            return;
        }
        const roleId = roleCheck.rows[0].id;
        const roleName = roleCheck.rows[0].job_title_ar;
        console.log(`\n2️⃣  الدور المراد تعيينه: ${roleName} (ID: ${roleId})`);
        
        // 3. إلغاء الأدوار القديمة
        console.log('\n3️⃣  إلغاء تفعيل الأدوار القديمة...');
        await pool.query('UPDATE user_roles SET is_active = false WHERE user_id = $1', [userId]);
        
        // 4. البحث عن سجل موجود
        const existingRole = await pool.query(`
            SELECT id FROM user_roles 
            WHERE user_id = $1 AND role_id = $2 
            AND (entity_id IS NULL OR entity_id = '')
            LIMIT 1
        `, [userId, roleId]);
        
        let result;
        if (existingRole.rows.length > 0) {
            console.log(`   ✅ وُجد سجل موجود (ID: ${existingRole.rows[0].id}) - سيتم تحديثه`);
            result = await pool.query(`
                UPDATE user_roles 
                SET is_active = true, granted_at = NOW()
                WHERE id = $1
                RETURNING *
            `, [existingRole.rows[0].id]);
        } else {
            console.log('   ℹ️  لا يوجد سجل - سيتم إنشاء سجل جديد');
            result = await pool.query(`
                INSERT INTO user_roles (user_id, role_id, entity_id, is_active, granted_at)
                VALUES ($1, $2, NULL, true, NOW())
                RETURNING *
            `, [userId, roleId]);
        }
        
        console.log('\n4️⃣  النتيجة:');
        console.log(`   ✅ تم بنجاح! ID: ${result.rows[0].id}`);
        console.log(`   is_active: ${result.rows[0].is_active}`);
        console.log(`   granted_at: ${result.rows[0].granted_at}`);
        
        // 5. الحالة بعد التعيين
        console.log('\n5️⃣  الحالة بعد التعيين:');
        let after = await pool.query(`
            SELECT COUNT(*) as count, 
                   COUNT(*) FILTER (WHERE is_active = true) as active_count
            FROM user_roles WHERE user_id = $1
        `, [userId]);
        console.log(`   إجمالي السجلات: ${after.rows[0].count}`);
        console.log(`   النشطة: ${after.rows[0].active_count}`);
        
        // 6. عرض الأدوار النشطة
        const activeRoles = await pool.query(`
            SELECT r.job_title_ar
            FROM user_roles ur
            JOIN roles r ON ur.role_id = r.id
            WHERE ur.user_id = $1 AND ur.is_active = true
        `, [userId]);
        
        console.log('\n6️⃣  الأدوار النشطة:');
        activeRoles.rows.forEach(r => {
            console.log(`   ✓ ${r.job_title_ar}`);
        });
        
        console.log('\n✅ الاختبار اكتمل بنجاح!');
        
    } catch (error) {
        console.error('\n❌ خطأ:', error.message);
        console.error('Stack:', error.stack);
    } finally {
        await pool.end();
    }
}

testAssignUser8();
