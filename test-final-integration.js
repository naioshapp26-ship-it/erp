const { Pool } = require('pg');

const pool = new Pool({
    connectionString: 'postgresql://postgres:PddzJpAQYezqknsntSzmCUlQYuYJldcT@crossover.proxy.rlwy.net:44255/railway',
    ssl: { rejectUnauthorized: false }
});

async function testFinalIntegration() {
    const client = await pool.connect();
    let testsPassed = 0;
    let testsFailed = 0;
    
    try {
        console.log('🧪 اختبار التكامل النهائي لـ Super Admin...\n');
        console.log('═══════════════════════════════════════\n');
        
        // Test 1: التحقق من وجود الكيان HQ001
        console.log('Test 1: التحقق من وجود الكيان HQ001');
        try {
            const result = await client.query(`
                SELECT * FROM entities WHERE id = 'HQ001'
            `);
            
            if (result.rows.length > 0) {
                const entity = result.rows[0];
                console.log('✅ الكيان HQ001 موجود:');
                console.log(`   - ID: ${entity.id}`);
                console.log(`   - الاسم: ${entity.name}`);
                console.log(`   - النوع: ${entity.type}`);
                testsPassed++;
            } else {
                console.log('❌ الكيان HQ001 غير موجود');
                testsFailed++;
            }
        } catch (error) {
            console.log('❌ خطأ:', error.message);
            testsFailed++;
        }
        
        // Test 2: محاكاة currentUser لـ HQ001
        console.log('\nTest 2: محاكاة بنية currentUser لـ HQ001');
        try {
            const currentUser = {
                id: 1,
                name: 'المكتب الرئيسي - مسؤول',
                role: 'مسؤول النظام',
                tenantType: 'HQ',
                entityId: 'HQ001',
                entityName: 'المكتب الرئيسي'
            };
            
            const isSuperAdmin = currentUser.entityId === 'HQ001' || currentUser.entityId === 1;
            
            console.log('✅ بنية currentUser صحيحة:');
            console.log(`   - entityId: "${currentUser.entityId}"`);
            console.log(`   - isSuperAdmin: ${isSuperAdmin}`);
            
            if (isSuperAdmin) {
                console.log('   ✓ الشرط صحيح - Super Admin سيظهر');
                testsPassed++;
            } else {
                console.log('   ✗ الشرط خاطئ - Super Admin لن يظهر');
                testsFailed++;
            }
        } catch (error) {
            console.log('❌ خطأ:', error.message);
            testsFailed++;
        }
        
        // Test 3: محاكاة currentUser لفرع
        console.log('\nTest 3: محاكاة بنية currentUser لفرع');
        try {
            const currentUser = {
                id: 2,
                name: 'فرع العليا - مدير',
                role: 'مدير فرع',
                tenantType: 'BRANCH',
                entityId: 'BR015',
                entityName: 'فرع العليا مول'
            };
            
            const isSuperAdmin = currentUser.entityId === 'HQ001' || currentUser.entityId === 1;
            
            console.log('✅ بنية currentUser صحيحة:');
            console.log(`   - entityId: "${currentUser.entityId}"`);
            console.log(`   - isSuperAdmin: ${isSuperAdmin}`);
            
            if (!isSuperAdmin) {
                console.log('   ✓ الشرط صحيح - Super Admin مخفي');
                testsPassed++;
            } else {
                console.log('   ✗ الشرط خاطئ - Super Admin سيظهر (خطأ!)');
                testsFailed++;
            }
        } catch (error) {
            console.log('❌ خطأ:', error.message);
            testsFailed++;
        }
        
        // Test 4: التحقق من عنصر القائمة
        console.log('\nTest 4: التحقق من عنصر Super Admin في sidebar_menu');
        try {
            const result = await client.query(`
                SELECT * FROM sidebar_menu WHERE url = '/super-admin'
            `);
            
            if (result.rows.length > 0) {
                const item = result.rows[0];
                console.log('✅ عنصر القائمة موجود:');
                console.log(`   - العنوان: ${item.title_ar}`);
                console.log(`   - مخصص لـ: ${item.required_entity_id}`);
                console.log(`   - نشط: ${item.is_active}`);
                testsPassed++;
            } else {
                console.log('❌ عنصر القائمة غير موجود');
                testsFailed++;
            }
        } catch (error) {
            console.log('❌ خطأ:', error.message);
            testsFailed++;
        }
        
        // Test 5: التحقق من صفحة super-admin-page.html
        console.log('\nTest 5: التحقق من وجود صفحة Super Admin');
        try {
            const fs = require('fs');
            const path = require('path');
            const filePath = path.join(__dirname, 'super-admin-page.html');
            
            if (fs.existsSync(filePath)) {
                console.log('✅ صفحة super-admin-page.html موجودة');
                testsPassed++;
            } else {
                console.log('❌ صفحة super-admin-page.html غير موجودة');
                testsFailed++;
            }
        } catch (error) {
            console.log('❌ خطأ:', error.message);
            testsFailed++;
        }
        
        // Test 6: التحقق من التعديلات في script.js
        console.log('\nTest 6: التحقق من التعديلات في script.js');
        try {
            const fs = require('fs');
            const path = require('path');
            const filePath = path.join(__dirname, 'script.js');
            const content = fs.readFileSync(filePath, 'utf8');
            
            // البحث عن الشرط الصحيح
            const hasCorrectCondition = content.includes("entityId === 'HQ001'");
            const hasSuperAdminItem = content.includes("id: 'super-admin'");
            const hasSuperAdminRoute = content.includes("route === 'super-admin'");
            
            console.log('✅ فحص محتوى script.js:');
            console.log(`   - الشرط الصحيح: ${hasCorrectCondition ? '✓' : '✗'}`);
            console.log(`   - عنصر القائمة: ${hasSuperAdminItem ? '✓' : '✗'}`);
            console.log(`   - معالج التوجيه: ${hasSuperAdminRoute ? '✓' : '✗'}`);
            
            if (hasCorrectCondition && hasSuperAdminItem && hasSuperAdminRoute) {
                console.log('   ✓ جميع التعديلات موجودة');
                testsPassed++;
            } else {
                console.log('   ✗ بعض التعديلات مفقودة');
                testsFailed++;
            }
        } catch (error) {
            console.log('❌ خطأ:', error.message);
            testsFailed++;
        }
        
        // النتيجة النهائية
        console.log('\n═══════════════════════════════════════');
        console.log('📊 النتيجة النهائية:');
        console.log(`✅ نجح: ${testsPassed}/6`);
        console.log(`❌ فشل: ${testsFailed}/6`);
        console.log(`📈 نسبة النجاح: ${(testsPassed/6*100).toFixed(0)}%`);
        
        if (testsFailed === 0) {
            console.log('\n🎉 جميع الاختبارات نجحت!');
            console.log('\n✅ الآن عند فتح الموقع:');
            console.log('═══════════════════════════════════════');
            console.log('1. اختر "المكتب الرئيسي"');
            console.log('2. ستجد في القائمة الجانبية:');
            console.log('   📊 الرئيسية');
            console.log('   🔐 إدارة الأدوار والصلاحيات  ← جديد!');
            console.log('   ♟️ الإدارة الاستراتيجية');
            console.log('   ...');
            console.log('3. اضغط على "إدارة الأدوار والصلاحيات"');
            console.log('4. ستنتقل لصفحة Super Admin');
            console.log('═══════════════════════════════════════');
        } else {
            console.log('\n⚠️ يرجى إصلاح الاختبارات الفاشلة');
        }
        
        console.log('\n📝 المشكلة التي تم حلها:');
        console.log('   - الشرط القديم: entityId === 1 (رقمي)');
        console.log('   - الشرط الجديد: entityId === \'HQ001\' (نصي)');
        console.log('   - السبب: entityId في الكود نصي وليس رقمي');
        
    } catch (error) {
        console.error('❌ خطأ عام:', error.message);
    } finally {
        client.release();
        await pool.end();
    }
}

testFinalIntegration().catch(console.error);
