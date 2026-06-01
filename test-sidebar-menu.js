/**
 * اختبار نظام القائمة الجانبية
 */

const { Pool } = require('pg');

const pool = new Pool({
    connectionString: 'postgresql://postgres:PddzJpAQYezqknsntSzmCUlQYuYJldcT@crossover.proxy.rlwy.net:44255/railway',
    ssl: false
});

const colors = {
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    reset: '\x1b[0m'
};

function log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
}

async function runTests() {
    let passedTests = 0;
    let failedTests = 0;
    let totalTests = 0;

    log('\n========================================', 'blue');
    log('🧪 بدء اختبار نظام القائمة الجانبية', 'blue');
    log('========================================\n', 'blue');

    try {
        // ========== اختبار 1: التحقق من وجود جدول sidebar_menu ==========
        totalTests++;
        log('📋 اختبار 1: التحقق من وجود جدول sidebar_menu...', 'yellow');
        try {
            const result = await pool.query('SELECT COUNT(*) as count FROM sidebar_menu');
            const count = parseInt(result.rows[0].count);
            
            if (count >= 11) {
                log(`✓ النتيجة: ${count} عنصر في القائمة`, 'green');
                passedTests++;
            } else {
                log(`✗ النتيجة: ${count} عنصر فقط (متوقع >= 11)`, 'red');
                failedTests++;
            }
        } catch (error) {
            log(`✗ خطأ: ${error.message}`, 'red');
            failedTests++;
        }

        // ========== اختبار 2: التحقق من عنصر Super Admin ==========
        totalTests++;
        log('\n🔐 اختبار 2: التحقق من وجود عنصر Super Admin...', 'yellow');
        try {
            const result = await pool.query(`
                SELECT * FROM sidebar_menu 
                WHERE title_ar = 'Super Admin' 
                AND required_entity_id = 'HQ001'
            `);
            
            if (result.rows.length > 0) {
                const item = result.rows[0];
                log(`✓ عنصر Super Admin موجود`, 'green');
                log(`  - العنوان: ${item.title_ar}`, 'blue');
                log(`  - الرابط: ${item.url}`, 'blue');
                log(`  - الأيقونة: ${item.icon}`, 'blue');
                log(`  - مخصص لـ: ${item.required_entity_id}`, 'blue');
                passedTests++;
            } else {
                log(`✗ عنصر Super Admin غير موجود`, 'red');
                failedTests++;
            }
        } catch (error) {
            log(`✗ خطأ: ${error.message}`, 'red');
            failedTests++;
        }

        // ========== اختبار 3: التحقق من المستخدم HQ001 ==========
        totalTests++;
        log('\n👤 اختبار 3: التحقق من المستخدم HQ001...', 'yellow');
        try {
            const result = await pool.query(`
                SELECT * FROM users 
                WHERE entity_id = 'HQ001' 
                AND is_active = true
            `);
            
            if (result.rows.length > 0) {
                const user = result.rows[0];
                log(`✓ المستخدم موجود`, 'green');
                log(`  - ID: ${user.id}`, 'blue');
                log(`  - الاسم: ${user.name}`, 'blue');
                log(`  - Entity ID: ${user.entity_id}`, 'blue');
                log(`  - الدور: ${user.role}`, 'blue');
                passedTests++;
            } else {
                log(`✗ المستخدم HQ001 غير موجود`, 'red');
                failedTests++;
            }
        } catch (error) {
            log(`✗ خطأ: ${error.message}`, 'red');
            failedTests++;
        }

        // ========== اختبار 4: محاكاة جلب القائمة لمستخدم HQ001 ==========
        totalTests++;
        log('\n📱 اختبار 4: جلب القائمة للمستخدم HQ001...', 'yellow');
        try {
            const userResult = await pool.query(`
                SELECT id, entity_id FROM users 
                WHERE entity_id = 'HQ001' 
                AND is_active = true
                LIMIT 1
            `);
            
            if (userResult.rows.length > 0) {
                const userId = userResult.rows[0].id;
                const entityId = userResult.rows[0].entity_id;
                
                // جلب المستوى الهرمي
                let hierarchyLevel = 4;
                const roleResult = await pool.query(`
                    SELECT r.hierarchy_level
                    FROM user_roles ur
                    JOIN roles r ON ur.role_id = r.id
                    WHERE ur.user_id = $1 AND ur.is_active = true
                    ORDER BY r.hierarchy_level ASC
                    LIMIT 1
                `, [userId]);

                if (roleResult.rows.length > 0) {
                    hierarchyLevel = roleResult.rows[0].hierarchy_level;
                }

                // جلب القائمة
                const menuResult = await pool.query(`
                    SELECT title_ar, url, icon
                    FROM sidebar_menu
                    WHERE is_active = true
                    AND (
                        (required_entity_id IS NULL AND min_hierarchy_level IS NULL)
                        OR (required_entity_id = $1)
                        OR (min_hierarchy_level IS NOT NULL AND $2 <= min_hierarchy_level)
                    )
                    ORDER BY display_order
                `, [entityId, hierarchyLevel]);

                const superAdminVisible = menuResult.rows.some(item => item.title_ar === 'Super Admin');
                
                log(`✓ تم جلب ${menuResult.rows.length} عنصر للمستخدم`, 'green');
                log(`  - عناصر القائمة:`, 'blue');
                menuResult.rows.forEach(item => {
                    log(`    ${item.icon} ${item.title_ar}`, 'blue');
                });
                
                if (superAdminVisible) {
                    log(`\n  ✅ عنصر Super Admin ظاهر للمستخدم HQ001`, 'green');
                } else {
                    log(`\n  ⚠️  عنصر Super Admin غير ظاهر`, 'yellow');
                }
                
                passedTests++;
            } else {
                log(`✗ المستخدم HQ001 غير موجود`, 'red');
                failedTests++;
            }
        } catch (error) {
            log(`✗ خطأ: ${error.message}`, 'red');
            failedTests++;
        }

        // ========== اختبار 5: محاكاة جلب القائمة لمستخدم عادي ==========
        totalTests++;
        log('\n👥 اختبار 5: جلب القائمة لمستخدم عادي (غير HQ001)...', 'yellow');
        try {
            const userResult = await pool.query(`
                SELECT id, entity_id FROM users 
                WHERE entity_id != 'HQ001' 
                AND is_active = true
                LIMIT 1
            `);
            
            if (userResult.rows.length > 0) {
                const userId = userResult.rows[0].id;
                const entityId = userResult.rows[0].entity_id;
                
                // جلب المستوى الهرمي
                let hierarchyLevel = 4;
                const roleResult = await pool.query(`
                    SELECT r.hierarchy_level
                    FROM user_roles ur
                    JOIN roles r ON ur.role_id = r.id
                    WHERE ur.user_id = $1 AND ur.is_active = true
                    ORDER BY r.hierarchy_level ASC
                    LIMIT 1
                `, [userId]);

                if (roleResult.rows.length > 0) {
                    hierarchyLevel = roleResult.rows[0].hierarchy_level;
                }

                // جلب القائمة
                const menuResult = await pool.query(`
                    SELECT title_ar, url
                    FROM sidebar_menu
                    WHERE is_active = true
                    AND (
                        (required_entity_id IS NULL AND min_hierarchy_level IS NULL)
                        OR (required_entity_id = $1)
                        OR (min_hierarchy_level IS NOT NULL AND $2 <= min_hierarchy_level)
                    )
                    ORDER BY display_order
                `, [entityId, hierarchyLevel]);

                const superAdminVisible = menuResult.rows.some(item => item.title_ar === 'Super Admin');
                
                log(`✓ تم جلب ${menuResult.rows.length} عنصر للمستخدم العادي`, 'green');
                
                if (!superAdminVisible) {
                    log(`  ✅ عنصر Super Admin مخفي عن المستخدمين العاديين`, 'green');
                    passedTests++;
                } else {
                    log(`  ✗ عنصر Super Admin ظاهر للمستخدم العادي (خطأ!)`, 'red');
                    failedTests++;
                }
            } else {
                log(`⚠️  لا يوجد مستخدم عادي للاختبار`, 'yellow');
                passedTests++;
            }
        } catch (error) {
            log(`✗ خطأ: ${error.message}`, 'red');
            failedTests++;
        }

        // ========== اختبار 6: التحقق من ترتيب القائمة ==========
        totalTests++;
        log('\n📊 اختبار 6: التحقق من ترتيب عناصر القائمة...', 'yellow');
        try {
            const result = await pool.query(`
                SELECT title_ar, display_order
                FROM sidebar_menu
                WHERE is_active = true
                ORDER BY display_order
            `);
            
            let correctOrder = true;
            for (let i = 1; i < result.rows.length; i++) {
                if (result.rows[i].display_order < result.rows[i-1].display_order) {
                    correctOrder = false;
                    break;
                }
            }
            
            if (correctOrder) {
                log(`✓ جميع العناصر مرتبة بشكل صحيح`, 'green');
                passedTests++;
            } else {
                log(`✗ الترتيب غير صحيح`, 'red');
                failedTests++;
            }
        } catch (error) {
            log(`✗ خطأ: ${error.message}`, 'red');
            failedTests++;
        }

    } catch (error) {
        log(`\n❌ خطأ عام في الاختبارات: ${error.message}`, 'red');
    } finally {
        await pool.end();
    }

    // ========== النتيجة النهائية ==========
    log('\n========================================', 'blue');
    log('📊 النتيجة النهائية', 'blue');
    log('========================================', 'blue');
    log(`إجمالي الاختبارات: ${totalTests}`, 'blue');
    log(`اختبارات ناجحة: ${passedTests}`, 'green');
    log(`اختبارات فاشلة: ${failedTests}`, 'red');
    
    const successRate = ((passedTests / totalTests) * 100).toFixed(2);
    log(`نسبة النجاح: ${successRate}%`, successRate == 100 ? 'green' : 'yellow');
    
    if (failedTests === 0) {
        log('\n✅ جميع الاختبارات نجحت! النظام جاهز للنشر.', 'green');
    } else {
        log(`\n⚠️  ${failedTests} اختبار فشل. يرجى مراجعة الأخطاء.`, 'yellow');
    }
    
    log('========================================\n', 'blue');
}

runTests().catch(error => {
    console.error('خطأ في تشغيل الاختبارات:', error);
    process.exit(1);
});
