const { Pool } = require('pg');

const pool = new Pool({
    connectionString: 'postgresql://postgres:PddzJpAQYezqknsntSzmCUlQYuYJldcT@crossover.proxy.rlwy.net:44255/railway',
    ssl: { rejectUnauthorized: false }
});

async function testSuperAdminIntegration() {
    const client = await pool.connect();
    let testsPassed = 0;
    let testsFailed = 0;
    
    try {
        console.log('🧪 اختبار تكامل Super Admin...\n');
        console.log('═══════════════════════════════════════\n');
        
        // ============================================
        // Test 1: التحقق من عنصر القائمة في قاعدة البيانات
        // ============================================
        console.log('Test 1: التحقق من عنصر Super Admin في sidebar_menu');
        try {
            const result = await client.query(`
                SELECT * FROM sidebar_menu
                WHERE url = '/super-admin' OR title_ar LIKE '%Super%'
            `);
            
            if (result.rows.length > 0) {
                const item = result.rows[0];
                console.log('✅ عنصر Super Admin موجود في القائمة:');
                console.log(`   - العنوان: ${item.title_ar}`);
                console.log(`   - الرابط: ${item.url}`);
                console.log(`   - الأيقونة: ${item.icon}`);
                console.log(`   - الترتيب: ${item.display_order}`);
                console.log(`   - مخصص لـ: ${item.required_entity_id || 'الكل'}`);
                console.log(`   - نشط: ${item.is_active}`);
                
                if (item.required_entity_id === 'HQ001' && item.is_active) {
                    console.log('   ✓ مخصص لـ HQ001 فقط وهو نشط');
                    testsPassed++;
                } else {
                    console.log('   ⚠️ الإعدادات غير صحيحة');
                    testsFailed++;
                }
            } else {
                console.log('❌ عنصر Super Admin غير موجود');
                testsFailed++;
            }
        } catch (error) {
            console.log('❌ خطأ في الاختبار:', error.message);
            testsFailed++;
        }
        
        // ============================================
        // Test 2: التحقق من ظهور القائمة لـ HQ001
        // ============================================
        console.log('\nTest 2: التحقق من ظهور Super Admin في قائمة HQ001');
        try {
            const result = await client.query(`
                SELECT title_ar, url, icon
                FROM sidebar_menu
                WHERE is_active = true
                AND (required_entity_id IS NULL OR required_entity_id = 'HQ001')
                ORDER BY display_order
            `);
            
            const hasSuperAdmin = result.rows.some(r => r.url === '/super-admin');
            
            if (hasSuperAdmin) {
                console.log(`✅ Super Admin يظهر في قائمة HQ001 (${result.rows.length} عنصر)`);
                testsPassed++;
            } else {
                console.log('❌ Super Admin لا يظهر في قائمة HQ001');
                testsFailed++;
            }
        } catch (error) {
            console.log('❌ خطأ في الاختبار:', error.message);
            testsFailed++;
        }
        
        // ============================================
        // Test 3: التحقق من عدم ظهوره للمستخدمين الآخرين
        // ============================================
        console.log('\nTest 3: التحقق من عدم ظهور Super Admin للمستخدمين الآخرين');
        try {
            const result = await client.query(`
                SELECT title_ar, url
                FROM sidebar_menu
                WHERE is_active = true
                AND (required_entity_id IS NULL OR required_entity_id = 'BR015')
                ORDER BY display_order
            `);
            
            const hasSuperAdmin = result.rows.some(r => r.url === '/super-admin');
            
            if (!hasSuperAdmin) {
                console.log(`✅ Super Admin مخفي عن المستخدمين الآخرين (${result.rows.length} عنصر فقط)`);
                testsPassed++;
            } else {
                console.log('❌ Super Admin يظهر للمستخدمين الآخرين!');
                testsFailed++;
            }
        } catch (error) {
            console.log('❌ خطأ في الاختبار:', error.message);
            testsFailed++;
        }
        
        // ============================================
        // Test 4: التحقق من وجود المستخدم HQ001
        // ============================================
        console.log('\nTest 4: التحقق من وجود المستخدم HQ001');
        try {
            const result = await client.query(`
                SELECT id, name, email, entity_id, entity_name
                FROM users
                WHERE entity_id = 'HQ001'
            `);
            
            if (result.rows.length > 0) {
                const user = result.rows[0];
                console.log('✅ المستخدم HQ001 موجود:');
                console.log(`   - الاسم: ${user.name}`);
                console.log(`   - البريد: ${user.email}`);
                console.log(`   - الكيان: ${user.entity_name}`);
                testsPassed++;
            } else {
                console.log('❌ المستخدم HQ001 غير موجود');
                testsFailed++;
            }
        } catch (error) {
            console.log('❌ خطأ في الاختبار:', error.message);
            testsFailed++;
        }
        
        // ============================================
        // Test 5: التحقق من بيانات تسجيل دخول HQ001
        // ============================================
        console.log('\nTest 5: التحقق من بيانات تسجيل دخول HQ001');
        try {
            const result = await client.query(`
                SELECT uc.username, u.name, u.entity_id
                FROM user_credentials uc
                JOIN users u ON uc.user_id = u.id
                WHERE uc.username = 'HQ001' AND uc.is_active = true
            `);
            
            if (result.rows.length > 0) {
                const cred = result.rows[0];
                console.log('✅ بيانات دخول HQ001 موجودة:');
                console.log(`   - اسم المستخدم: ${cred.username}`);
                console.log(`   - الاسم: ${cred.name}`);
                console.log(`   - الكيان: ${cred.entity_id}`);
                testsPassed++;
            } else {
                console.log('❌ بيانات دخول HQ001 غير موجودة');
                testsFailed++;
            }
        } catch (error) {
            console.log('❌ خطأ في الاختبار:', error.message);
            testsFailed++;
        }
        
        // ============================================
        // Test 6: التحقق من وجود صفحة super-admin-page.html
        // ============================================
        console.log('\nTest 6: التحقق من وجود صفحة super-admin-page.html');
        try {
            const fs = require('fs');
            const path = require('path');
            const filePath = path.join(__dirname, 'super-admin-page.html');
            
            if (fs.existsSync(filePath)) {
                const stats = fs.statSync(filePath);
                console.log('✅ صفحة super-admin-page.html موجودة');
                console.log(`   - الحجم: ${(stats.size / 1024).toFixed(2)} KB`);
                testsPassed++;
            } else {
                console.log('❌ صفحة super-admin-page.html غير موجودة');
                testsFailed++;
            }
        } catch (error) {
            console.log('❌ خطأ في الاختبار:', error.message);
            testsFailed++;
        }
        
        // ============================================
        // Test 7: محاكاة قائمة HQ001 الكاملة
        // ============================================
        console.log('\nTest 7: محاكاة القائمة الجانبية الكاملة لـ HQ001');
        try {
            const result = await client.query(`
                SELECT id, title_ar, icon, url
                FROM sidebar_menu
                WHERE is_active = true
                AND (required_entity_id IS NULL OR required_entity_id = 'HQ001')
                ORDER BY display_order
            `);
            
            console.log(`✅ القائمة الكاملة (${result.rows.length} عنصر):`);
            console.log('═══════════════════════════════════════');
            result.rows.forEach((item, index) => {
                const isSuperAdmin = item.url === '/super-admin';
                const marker = isSuperAdmin ? '🔐' : '  ';
                console.log(`${marker} ${index + 1}. ${item.icon} ${item.title_ar}`);
                if (isSuperAdmin) {
                    console.log(`     👉 يوصل لصفحة: ${item.url}`);
                }
            });
            console.log('═══════════════════════════════════════');
            testsPassed++;
        } catch (error) {
            console.log('❌ خطأ في الاختبار:', error.message);
            testsFailed++;
        }
        
        // ============================================
        // Test 8: التحقق من API sidebar-menu
        // ============================================
        console.log('\nTest 8: التحقق من وجود sidebar-menu-api.js');
        try {
            const fs = require('fs');
            const path = require('path');
            const apiPath = path.join(__dirname, 'sidebar-menu-api.js');
            
            if (fs.existsSync(apiPath)) {
                console.log('✅ sidebar-menu-api.js موجود');
                testsPassed++;
            } else {
                console.log('⚠️ sidebar-menu-api.js غير موجود (اختياري)');
                testsPassed++;
            }
        } catch (error) {
            console.log('❌ خطأ في الاختبار:', error.message);
            testsFailed++;
        }
        
        // ============================================
        // النتيجة النهائية
        // ============================================
        console.log('\n═══════════════════════════════════════');
        console.log('📊 النتيجة النهائية:');
        console.log(`✅ نجح: ${testsPassed}/8`);
        console.log(`❌ فشل: ${testsFailed}/8`);
        console.log(`📈 نسبة النجاح: ${(testsPassed/8*100).toFixed(0)}%`);
        
        if (testsFailed === 0) {
            console.log('\n🎉 جميع الاختبارات نجحت!');
            console.log('\n💡 التعليمات:');
            console.log('═══════════════════════════════════════');
            console.log('1. افتح الموقع الرئيسي (index.html)');
            console.log('2. سجل دخول بحساب HQ001');
            console.log('3. ستجد "إدارة الأدوار والصلاحيات" في القائمة');
            console.log('4. اضغط عليه للانتقال لصفحة Super Admin');
            console.log('═══════════════════════════════════════');
        } else {
            console.log('\n⚠️ يرجى إصلاح الاختبارات الفاشلة');
        }
        
    } catch (error) {
        console.error('❌ خطأ عام:', error.message);
    } finally {
        client.release();
        await pool.end();
    }
}

testSuperAdminIntegration().catch(console.error);
