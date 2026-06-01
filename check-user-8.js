const { Pool } = require('pg');
const pool = new Pool({
    connectionString: 'postgresql://postgres:PddzJpAQYezqknsntSzmCUlQYuYJldcT@crossover.proxy.rlwy.net:44255/railway',
    ssl: false
});

async function checkUser8() {
    try {
        console.log('📊 فحص المستخدم رقم 8 (كريم)...\n');
        
        // 1. معلومات المستخدم
        const user = await pool.query('SELECT * FROM users WHERE id = 8');
        if (user.rows.length === 0) {
            console.log('❌ المستخدم رقم 8 غير موجود!');
            return;
        }
        
        console.log('✅ معلومات المستخدم:');
        console.log('   ID:', user.rows[0].id);
        console.log('   الاسم:', user.rows[0].name);
        console.log('   البريد:', user.rows[0].email);
        console.log('   Entity ID:', user.rows[0].entity_id);
        console.log('');
        
        // 2. الأدوار المعينة
        const roles = await pool.query(`
            SELECT 
                ur.id,
                ur.user_id,
                ur.role_id,
                ur.entity_id,
                ur.is_active,
                ur.granted_at,
                r.name as role_name,
                r.job_title_ar
            FROM user_roles ur
            LEFT JOIN roles r ON ur.role_id = r.id
            WHERE ur.user_id = 8
            ORDER BY ur.granted_at DESC
        `);
        
        console.log(`📋 الأدوار المعينة (${roles.rows.length} سجل):`);
        roles.rows.forEach((role, i) => {
            console.log(`\n${i + 1}.`);
            console.log(`   ID: ${role.id}`);
            console.log(`   الدور: ${role.job_title_ar} (${role.role_name})`);
            console.log(`   entity_id: ${role.entity_id}`);
            console.log(`   نشط: ${role.is_active ? '✓' : '✗'}`);
            console.log(`   تاريخ التعيين: ${role.granted_at}`);
        });
        
        // 3. الأدوار النشطة فقط
        const activeRoles = roles.rows.filter(r => r.is_active);
        console.log(`\n✓ الأدوار النشطة: ${activeRoles.length}`);
        activeRoles.forEach(r => {
            console.log(`   - ${r.job_title_ar}`);
        });
        
    } catch (error) {
        console.error('❌ خطأ:', error.message);
    } finally {
        await pool.end();
    }
}

checkUser8();
