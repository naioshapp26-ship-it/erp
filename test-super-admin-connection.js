/**
 * اختبار الاتصال بقاعدة البيانات و API الخاص بـ Super Admin
 */

const { Pool } = require('pg');

const pool = new Pool({
    connectionString: 'postgresql://postgres:PddzJpAQYezqknsntSzmCUlQYuYJldcT@crossover.proxy.rlwy.net:44255/railway',
    ssl: false
});

async function testDatabaseConnection() {
    console.log('🔍 اختبار الاتصال بقاعدة البيانات...\n');
    
    try {
        // 1. اختبار الاتصال الأساسي
        const timeResult = await pool.query('SELECT NOW()');
        console.log('✅ الاتصال بقاعدة البيانات ناجح');
        console.log('   الوقت الحالي:', timeResult.rows[0].now);
        console.log('');

        // 2. التحقق من جدول roles
        console.log('📋 فحص جدول الأدوار (roles)...');
        const rolesCheck = await pool.query(`
            SELECT COUNT(*) as count FROM information_schema.tables 
            WHERE table_name = 'roles'
        `);
        
        if (parseInt(rolesCheck.rows[0].count) > 0) {
            console.log('✅ جدول roles موجود');
            
            // جلب عدد الأدوار
            const rolesCount = await pool.query('SELECT COUNT(*) as count FROM roles');
            console.log(`   عدد الأدوار: ${rolesCount.rows[0].count}`);
            
            // جلب بعض الأدوار كمثال
            const rolesData = await pool.query(`
                SELECT code, job_title_ar, hierarchy_level, is_active 
                FROM roles 
                ORDER BY hierarchy_level 
                LIMIT 5
            `);
            console.log('   أمثلة على الأدوار:');
            rolesData.rows.forEach(role => {
                console.log(`     - ${role.job_title_ar} (${role.code}) - المستوى ${role.hierarchy_level} - ${role.is_active ? 'نشط' : 'غير نشط'}`);
            });
        } else {
            console.log('❌ جدول roles غير موجود!');
        }
        console.log('');

        // 3. التحقق من جدول user_roles
        console.log('👥 فحص جدول تعيين الأدوار (user_roles)...');
        const userRolesCheck = await pool.query(`
            SELECT COUNT(*) as count FROM information_schema.tables 
            WHERE table_name = 'user_roles'
        `);
        
        if (parseInt(userRolesCheck.rows[0].count) > 0) {
            console.log('✅ جدول user_roles موجود');
            
            const userRolesCount = await pool.query('SELECT COUNT(*) as count FROM user_roles WHERE is_active = true');
            console.log(`   عدد التعيينات النشطة: ${userRolesCount.rows[0].count}`);
        } else {
            console.log('❌ جدول user_roles غير موجود!');
        }
        console.log('');

        // 4. التحقق من جدول systems
        console.log('🔧 فحص جدول الأنظمة (systems)...');
        const systemsCheck = await pool.query(`
            SELECT COUNT(*) as count FROM information_schema.tables 
            WHERE table_name = 'systems'
        `);
        
        if (parseInt(systemsCheck.rows[0].count) > 0) {
            console.log('✅ جدول systems موجود');
            
            const systemsCount = await pool.query('SELECT COUNT(*) as count FROM systems');
            console.log(`   عدد الأنظمة: ${systemsCount.rows[0].count}`);
            
            const systemsData = await pool.query(`
                SELECT code, name_ar, name_en 
                FROM systems 
                ORDER BY code 
                LIMIT 5
            `);
            console.log('   أمثلة على الأنظمة:');
            systemsData.rows.forEach(sys => {
                console.log(`     - ${sys.name_ar} (${sys.code})`);
            });
        } else {
            console.log('❌ جدول systems غير موجود!');
        }
        console.log('');

        // 5. التحقق من جدول permission_levels
        console.log('🔐 فحص جدول مستويات الصلاحيات (permission_levels)...');
        const permLevelsCheck = await pool.query(`
            SELECT COUNT(*) as count FROM information_schema.tables 
            WHERE table_name = 'permission_levels'
        `);
        
        if (parseInt(permLevelsCheck.rows[0].count) > 0) {
            console.log('✅ جدول permission_levels موجود');
            
            const levelsData = await pool.query(`
                SELECT code, name_ar, priority 
                FROM permission_levels 
                ORDER BY priority DESC
            `);
            console.log('   مستويات الصلاحيات:');
            levelsData.rows.forEach(level => {
                console.log(`     - ${level.name_ar} (${level.code}) - الأولوية ${level.priority}`);
            });
        } else {
            console.log('❌ جدول permission_levels غير موجود!');
        }
        console.log('');

        // 6. اختبار المستخدم HQ001
        console.log('👤 فحص المستخدم HQ001...');
        const userCheck = await pool.query(`
            SELECT ur.user_id, ur.role_code, r.job_title_ar, ur.is_active
            FROM user_roles ur
            LEFT JOIN roles r ON ur.role_code = r.code
            WHERE ur.user_id = 1
            ORDER BY r.hierarchy_level
            LIMIT 5
        `);
        
        if (userCheck.rows.length > 0) {
            console.log('✅ المستخدم HQ001 (user_id = 1) موجود');
            console.log('   الأدوار المعينة:');
            userCheck.rows.forEach(ur => {
                console.log(`     - ${ur.job_title_ar} (${ur.role_code}) - ${ur.is_active ? 'نشط' : 'غير نشط'}`);
            });
        } else {
            console.log('⚠️  المستخدم HQ001 ليس لديه أدوار معينة');
        }
        console.log('');

        console.log('✅ جميع الاختبارات اكتملت بنجاح!');

    } catch (error) {
        console.error('❌ خطأ في الاتصال أو الاستعلام:');
        console.error('   الرسالة:', error.message);
        console.error('   التفاصيل:', error.stack);
    } finally {
        await pool.end();
    }
}

testDatabaseConnection();
