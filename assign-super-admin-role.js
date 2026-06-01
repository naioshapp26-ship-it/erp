/**
 * تعيين دور Super Admin للمستخدم HQ001
 */

const { Pool } = require('pg');

const pool = new Pool({
    connectionString: 'postgresql://postgres:PddzJpAQYezqknsntSzmCUlQYuYJldcT@crossover.proxy.rlwy.net:44255/railway',
    ssl: false
});

async function assignSuperAdminRole() {
    try {
        console.log('🔧 تعيين دور Super Admin للمستخدم HQ001...\n');

        // 1. التحقق من وجود دور SUPER_ADMIN
        const roleCheck = await pool.query(`
            SELECT id, name, job_title_ar, hierarchy_level 
            FROM roles 
            WHERE name = 'SUPER_ADMIN'
        `);

        if (roleCheck.rows.length === 0) {
            console.log('❌ دور SUPER_ADMIN غير موجود!');
            return;
        }

        const superAdminRole = roleCheck.rows[0];
        console.log(`✅ دور SUPER_ADMIN موجود:`);
        console.log(`   ID: ${superAdminRole.id}`);
        console.log(`   الاسم: ${superAdminRole.job_title_ar}`);
        console.log(`   المستوى: ${superAdminRole.hierarchy_level}\n`);

        // 2. التحقق من التعيين الحالي
        const existingAssignment = await pool.query(`
            SELECT * FROM user_roles 
            WHERE user_id = 1 AND role_id = $1
        `, [superAdminRole.id]);

        if (existingAssignment.rows.length > 0) {
            console.log('⚠️  المستخدم HQ001 لديه بالفعل دور SUPER_ADMIN');
            
            // تحديث ليكون نشط
            await pool.query(`
                UPDATE user_roles 
                SET is_active = true 
                WHERE user_id = 1 AND role_id = $1
            `, [superAdminRole.id]);
            
            console.log('✅ تم تفعيل الدور');
        } else {
            // إضافة تعيين جديد
            await pool.query(`
                INSERT INTO user_roles (user_id, role_id, is_active, granted_at)
                VALUES (1, $1, true, NOW())
            `, [superAdminRole.id]);
            
            console.log('✅ تم تعيين دور SUPER_ADMIN للمستخدم HQ001');
        }

        // 3. التحقق من النتيجة
        const verifyResult = await pool.query(`
            SELECT ur.*, r.job_title_ar, r.hierarchy_level
            FROM user_roles ur
            JOIN roles r ON ur.role_id = r.id
            WHERE ur.user_id = 1 AND ur.is_active = true
        `);

        console.log(`\n✅ الأدوار النشطة للمستخدم HQ001 (${verifyResult.rows.length} دور):`);
        verifyResult.rows.forEach(ur => {
            console.log(`   - ${ur.job_title_ar} (Level ${ur.hierarchy_level})`);
        });

    } catch (error) {
        console.error('❌ خطأ:', error.message);
    } finally {
        await pool.end();
    }
}

assignSuperAdminRole();
