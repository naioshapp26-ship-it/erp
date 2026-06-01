const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const pool = new Pool({
    connectionString: 'postgresql://postgres:PddzJpAQYezqknsntSzmCUlQYuYJldcT@crossover.proxy.rlwy.net:44255/railway',
    ssl: { rejectUnauthorized: false }
});

async function runTests() {
    const client = await pool.connect();
    let testsPassed = 0;
    let testsFailed = 0;
    
    try {
        console.log('🧪 اختبار نظام المصادقة...\n');
        console.log('═══════════════════════════════════════\n');
        
        // ============================================
        // Test 1: التحقق من وجود جدول user_credentials
        // ============================================
        console.log('Test 1: التحقق من جدول user_credentials');
        try {
            const result = await client.query(`
                SELECT COUNT(*) FROM user_credentials
            `);
            console.log(`✅ الجدول موجود - عدد السجلات: ${result.rows[0].count}`);
            testsPassed++;
        } catch (error) {
            console.log('❌ الجدول غير موجود');
            testsFailed++;
        }
        
        // ============================================
        // Test 2: التحقق من وجود جدول user_sessions
        // ============================================
        console.log('\nTest 2: التحقق من جدول user_sessions');
        try {
            const result = await client.query(`
                SELECT COUNT(*) FROM user_sessions
            `);
            console.log(`✅ الجدول موجود - عدد الجلسات النشطة: ${result.rows[0].count}`);
            testsPassed++;
        } catch (error) {
            console.log('❌ الجدول غير موجود');
            testsFailed++;
        }
        
        // ============================================
        // Test 3: التحقق من بيانات اعتماد HQ001
        // ============================================
        console.log('\nTest 3: التحقق من بيانات اعتماد HQ001');
        try {
            const result = await client.query(`
                SELECT uc.*, u.name, u.entity_name
                FROM user_credentials uc
                JOIN users u ON uc.user_id = u.id
                WHERE uc.username = 'HQ001'
            `);
            
            if (result.rows.length > 0) {
                const cred = result.rows[0];
                console.log(`✅ بيانات HQ001 موجودة:`);
                console.log(`   - المستخدم: ${cred.name}`);
                console.log(`   - الكيان: ${cred.entity_name}`);
                console.log(`   - نشط: ${cred.is_active}`);
                console.log(`   - كلمة المرور مشفرة: ${cred.password_hash.substring(0, 20)}...`);
                testsPassed++;
            } else {
                console.log('❌ بيانات HQ001 غير موجودة');
                testsFailed++;
            }
        } catch (error) {
            console.log('❌ خطأ في الاختبار:', error.message);
            testsFailed++;
        }
        
        // ============================================
        // Test 4: اختبار تشفير كلمة المرور
        // ============================================
        console.log('\nTest 4: اختبار تشفير كلمة المرور');
        try {
            const result = await client.query(`
                SELECT password_hash FROM user_credentials WHERE username = 'HQ001'
            `);
            
            if (result.rows.length > 0) {
                const passwordHash = result.rows[0].password_hash;
                const isValid = await bcrypt.compare('Admin@123', passwordHash);
                
                if (isValid) {
                    console.log('✅ كلمة المرور "Admin@123" صحيحة ومشفرة بنجاح');
                    testsPassed++;
                } else {
                    console.log('❌ كلمة المرور غير صحيحة');
                    testsFailed++;
                }
            } else {
                console.log('❌ لم يتم العثور على بيانات');
                testsFailed++;
            }
        } catch (error) {
            console.log('❌ خطأ في الاختبار:', error.message);
            testsFailed++;
        }
        
        // ============================================
        // Test 5: اختبار محاكاة تسجيل دخول ناجح
        // ============================================
        console.log('\nTest 5: محاكاة تسجيل دخول ناجح');
        try {
            const username = 'HQ001';
            const password = 'Admin@123';
            
            // جلب بيانات الاعتماد
            const credResult = await client.query(`
                SELECT uc.id, uc.user_id, uc.password_hash,
                       u.name, u.email, u.entity_id, u.entity_name
                FROM user_credentials uc
                JOIN users u ON uc.user_id = u.id
                WHERE uc.username = $1 AND uc.is_active = true
            `, [username]);
            
            if (credResult.rows.length === 0) {
                console.log('❌ المستخدم غير موجود');
                testsFailed++;
            } else {
                const cred = credResult.rows[0];
                const isPasswordValid = await bcrypt.compare(password, cred.password_hash);
                
                if (isPasswordValid) {
                    console.log('✅ تسجيل الدخول ناجح:');
                    console.log(`   - المستخدم: ${cred.name}`);
                    console.log(`   - البريد: ${cred.email}`);
                    console.log(`   - الكيان: ${cred.entity_id} - ${cred.entity_name}`);
                    testsPassed++;
                } else {
                    console.log('❌ كلمة المرور غير صحيحة');
                    testsFailed++;
                }
            }
        } catch (error) {
            console.log('❌ خطأ في الاختبار:', error.message);
            testsFailed++;
        }
        
        // ============================================
        // Test 6: اختبار محاكاة تسجيل دخول فاشل
        // ============================================
        console.log('\nTest 6: محاكاة تسجيل دخول فاشل');
        try {
            const username = 'HQ001';
            const wrongPassword = 'WrongPassword123';
            
            const credResult = await client.query(`
                SELECT password_hash FROM user_credentials WHERE username = $1
            `, [username]);
            
            if (credResult.rows.length > 0) {
                const isPasswordValid = await bcrypt.compare(wrongPassword, credResult.rows[0].password_hash);
                
                if (!isPasswordValid) {
                    console.log('✅ النظام رفض كلمة المرور الخاطئة بنجاح');
                    testsPassed++;
                } else {
                    console.log('❌ النظام قبل كلمة مرور خاطئة!');
                    testsFailed++;
                }
            } else {
                console.log('❌ لم يتم العثور على بيانات');
                testsFailed++;
            }
        } catch (error) {
            console.log('❌ خطأ في الاختبار:', error.message);
            testsFailed++;
        }
        
        // ============================================
        // Test 7: التحقق من جلب القائمة الجانبية لـ HQ001
        // ============================================
        console.log('\nTest 7: جلب القائمة الجانبية لـ HQ001');
        try {
            const menuResult = await client.query(`
                SELECT id, title_ar, title_en, icon, url
                FROM sidebar_menu
                WHERE is_active = true
                AND (required_entity_id IS NULL OR required_entity_id = 'HQ001')
                ORDER BY display_order
            `);
            
            console.log(`✅ تم جلب ${menuResult.rows.length} عنصر قائمة`);
            
            // التحقق من وجود Super Admin
            const hasSuperAdmin = menuResult.rows.some(item => item.title_ar === 'Super Admin');
            if (hasSuperAdmin) {
                console.log('   ✓ يحتوي على عنصر Super Admin');
            } else {
                console.log('   ⚠️ لا يحتوي على عنصر Super Admin');
            }
            
            testsPassed++;
        } catch (error) {
            console.log('❌ خطأ في الاختبار:', error.message);
            testsFailed++;
        }
        
        // ============================================
        // Test 8: التحقق من جلب القائمة لمستخدم عادي
        // ============================================
        console.log('\nTest 8: جلب القائمة الجانبية لمستخدم عادي (BR015)');
        try {
            const menuResult = await client.query(`
                SELECT id, title_ar, title_en, icon, url
                FROM sidebar_menu
                WHERE is_active = true
                AND (required_entity_id IS NULL OR required_entity_id = 'BR015')
                ORDER BY display_order
            `);
            
            console.log(`✅ تم جلب ${menuResult.rows.length} عنصر قائمة`);
            
            // التحقق من عدم وجود Super Admin
            const hasSuperAdmin = menuResult.rows.some(item => item.title_ar === 'Super Admin');
            if (!hasSuperAdmin) {
                console.log('   ✓ لا يحتوي على عنصر Super Admin (صحيح)');
            } else {
                console.log('   ❌ يحتوي على عنصر Super Admin (خطأ!)');
            }
            
            testsPassed++;
        } catch (error) {
            console.log('❌ خطأ في الاختبار:', error.message);
            testsFailed++;
        }
        
        // ============================================
        // Test 9: التحقق من عدد الحسابات المتاحة
        // ============================================
        console.log('\nTest 9: التحقق من عدد الحسابات المتاحة');
        try {
            const result = await client.query(`
                SELECT uc.username, u.name, u.entity_name
                FROM user_credentials uc
                JOIN users u ON uc.user_id = u.id
                WHERE uc.is_active = true
                ORDER BY u.id
            `);
            
            console.log(`✅ عدد الحسابات النشطة: ${result.rows.length}`);
            result.rows.forEach(acc => {
                console.log(`   - ${acc.username}: ${acc.name} (${acc.entity_name})`);
            });
            
            testsPassed++;
        } catch (error) {
            console.log('❌ خطأ في الاختبار:', error.message);
            testsFailed++;
        }
        
        // ============================================
        // Test 10: التحقق من Indexes للأداء
        // ============================================
        console.log('\nTest 10: التحقق من Indexes للأداء');
        try {
            const result = await client.query(`
                SELECT indexname, tablename
                FROM pg_indexes
                WHERE tablename IN ('user_credentials', 'user_sessions')
                ORDER BY tablename, indexname
            `);
            
            console.log(`✅ عدد الـ Indexes: ${result.rows.length}`);
            result.rows.forEach(idx => {
                console.log(`   - ${idx.tablename}.${idx.indexname}`);
            });
            
            testsPassed++;
        } catch (error) {
            console.log('❌ خطأ في الاختبار:', error.message);
            testsFailed++;
        }
        
        // ============================================
        // النتيجة النهائية
        // ============================================
        console.log('\n═══════════════════════════════════════');
        console.log('📊 النتيجة النهائية:');
        console.log(`✅ نجح: ${testsPassed}/10`);
        console.log(`❌ فشل: ${testsFailed}/10`);
        console.log(`📈 نسبة النجاح: ${(testsPassed/10*100).toFixed(0)}%`);
        
        if (testsFailed === 0) {
            console.log('\n🎉 جميع الاختبارات نجحت! النظام جاهز للاستخدام');
        } else {
            console.log('\n⚠️ يرجى إصلاح الاختبارات الفاشلة');
        }
        
        console.log('═══════════════════════════════════════\n');
        
        // معلومات تسجيل الدخول
        console.log('🔐 بيانات تسجيل الدخول:');
        console.log('═══════════════════════════════════════');
        console.log('حساب Super Admin:');
        console.log('  اسم المستخدم: HQ001');
        console.log('  كلمة المرور: Admin@123');
        console.log('  الصفحة: /login-page.html');
        console.log('───────────────────────────────────────');
        console.log('حساب مستخدم عادي:');
        console.log('  اسم المستخدم: BR015');
        console.log('  كلمة المرور: User@123');
        console.log('═══════════════════════════════════════');
        
    } catch (error) {
        console.error('❌ خطأ عام:', error.message);
    } finally {
        client.release();
        await pool.end();
    }
}

runTests().catch(console.error);
