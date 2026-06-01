const { Pool } = require('pg');
const pool = new Pool({
    connectionString: 'postgresql://postgres:PddzJpAQYezqknsntSzmCUlQYuYJldcT@crossover.proxy.rlwy.net:44255/railway',
    ssl: false
});

async function testChangeRole() {
    try {
        console.log('🧪 اختبار تغيير الدور مرتين للمستخدم رقم 8...\n');
        
        const userId = 8;
        
        // الدور الأول
        console.log('1️⃣  تعيين الدور الأول: SALES_MANAGER_HQ');
        await assignRole(userId, 'SALES_MANAGER_HQ');
        
        // الدور الثاني (نفس الدور مرة أخرى)
        console.log('\n2️⃣  إعادة تعيين نفس الدور: SALES_MANAGER_HQ');
        await assignRole(userId, 'SALES_MANAGER_HQ');
        
        // الدور الثالث (دور مختلف)
        console.log('\n3️⃣  تعيين دور مختلف: MARKETING_MANAGER_HQ');
        await assignRole(userId, 'MARKETING_MANAGER_HQ');
        
        // التحقق النهائي
        const final = await pool.query(`
            SELECT COUNT(*) as total,
                   COUNT(*) FILTER (WHERE is_active = true) as active
            FROM user_roles WHERE user_id = $1
        `, [userId]);
        
        console.log('\n✅ النتيجة النهائية:');
        console.log(`   إجمالي السجلات: ${final.rows[0].total}`);
        console.log(`   النشطة: ${final.rows[0].active}`);
        
        if (final.rows[0].active == 1) {
            console.log('   ✅ ممتاز! دور واحد فقط نشط');
        } else {
            console.log(`   ❌ مشكلة! يوجد ${final.rows[0].active} أدوار نشطة`);
        }
        
    } catch (error) {
        console.error('❌ خطأ:', error.message);
    } finally {
        await pool.end();
    }
}

async function assignRole(userId, roleCode) {
    const roleCheck = await pool.query('SELECT id, job_title_ar FROM roles WHERE name = $1', [roleCode]);
    const roleId = roleCheck.rows[0].id;
    const roleName = roleCheck.rows[0].job_title_ar;
    
    await pool.query('UPDATE user_roles SET is_active = false WHERE user_id = $1', [userId]);
    
    const existingRole = await pool.query(`
        SELECT id FROM user_roles 
        WHERE user_id = $1 AND role_id = $2 
        AND (entity_id IS NULL OR entity_id = '')
        LIMIT 1
    `, [userId, roleId]);
    
    if (existingRole.rows.length > 0) {
        await pool.query(`
            UPDATE user_roles 
            SET is_active = true, granted_at = NOW()
            WHERE id = $1
        `, [existingRole.rows[0].id]);
        console.log(`   ✅ تم تحديث الدور: ${roleName}`);
    } else {
        const result = await pool.query(`
            INSERT INTO user_roles (user_id, role_id, entity_id, is_active, granted_at)
            VALUES ($1, $2, NULL, true, NOW())
        `, [userId, roleId]);
        console.log(`   ✅ تم إنشاء دور جديد: ${roleName}`);
    }
}

testChangeRole();
