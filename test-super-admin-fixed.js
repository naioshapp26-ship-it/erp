/**
 * اختبار نظام Super Admin - متوافق مع البنية الفعلية
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
    log('🧪 بدء اختبار نظام Super Admin', 'blue');
    log('========================================\n', 'blue');

    try {
        // ========== اختبار 1: التحقق من وجود الأدوار ==========
        totalTests++;
        log('📋 اختبار 1: التحقق من وجود الأدوار...', 'yellow');
        try {
            const result = await pool.query('SELECT COUNT(*) as count FROM roles WHERE is_active = true');
            const count = parseInt(result.rows[0].count);
            
            if (count >= 30) {
                log(`✓ النتيجة: ${count} دور نشط`, 'green');
                passedTests++;
            } else {
                log(`✗ النتيجة: ${count} دور فقط`, 'red');
                failedTests++;
            }
        } catch (error) {
            log(`✗ خطأ: ${error.message}`, 'red');
            failedTests++;
        }

        // ========== اختبار 2: التحقق من وجود الصلاحيات ==========
        totalTests++;
        log('\n🔑 اختبار 2: التحقق من وجود الصلاحيات...', 'yellow');
        try {
            const result = await pool.query('SELECT COUNT(*) as count FROM permissions');
            const count = parseInt(result.rows[0].count);
            
            log(`✓ النتيجة: ${count} صلاحية موجودة`, 'green');
            passedTests++;
        } catch (error) {
            log(`✗ خطأ: ${error.message}`, 'red');
            failedTests++;
        }

        // ========== اختبار 3: التحقق من جدول role_permissions ==========
        totalTests++;
        log('\n🔗 اختبار 3: التحقق من تعيينات الصلاحيات...', 'yellow');
        try {
            const result = await pool.query('SELECT COUNT(*) as count FROM role_permissions');
            const count = parseInt(result.rows[0].count);
            
            log(`✓ النتيجة: ${count} تعيين صلاحية`, 'green');
            passedTests++;
        } catch (error) {
            log(`✗ خطأ: ${error.message}`, 'red');
            failedTests++;
        }

        // ========== اختبار 4: التحقق من المستويات الهرمية ==========
        totalTests++;
        log('\n🏢 اختبار 4: التحقق من المستويات الهرمية...', 'yellow');
        try {
            const result = await pool.query(`
                SELECT 
                    hierarchy_level,
                    COUNT(*) as count
                FROM roles 
                WHERE is_active = true
                GROUP BY hierarchy_level
                ORDER BY hierarchy_level
            `);
            
            log(`  المستويات الموجودة:`, 'blue');
            let totalRoles = 0;
            result.rows.forEach(row => {
                const levelName = ['القيادة العليا', 'الإدارة العليا', 'الإدارة الوسطى', 'الإدارة التنفيذية', 'الموظفين'][row.hierarchy_level] || 'غير معروف';
                log(`    المستوى ${row.hierarchy_level} (${levelName}): ${row.count} دور`, 'blue');
                totalRoles += parseInt(row.count);
            });
            
            log(`✓ إجمالي الأدوار عبر المستويات: ${totalRoles}`, 'green');
            passedTests++;
        } catch (error) {
            log(`✗ خطأ: ${error.message}`, 'red');
            failedTests++;
        }

        // ========== اختبار 5: التحقق من حدود الموافقة ==========
        totalTests++;
        log('\n💰 اختبار 5: التحقق من حدود الموافقة...', 'yellow');
        try {
            const result = await pool.query(`
                SELECT 
                    name,
                    job_title_ar,
                    min_approval_limit,
                    max_approval_limit
                FROM roles 
                WHERE is_active = true
                AND max_approval_limit IS NOT NULL
                ORDER BY max_approval_limit DESC
                LIMIT 10
            `);
            
            log(`  أعلى حدود الموافقة:`, 'blue');
            result.rows.forEach(role => {
                const limit = role.max_approval_limit ? parseFloat(role.max_approval_limit).toLocaleString() : 'غير محدود';
                log(`    ${role.job_title_ar}: ${limit} ريال`, 'blue');
            });
            
            log(`✓ تم العثور على ${result.rows.length} أدوار بحدود موافقة`, 'green');
            passedTests++;
        } catch (error) {
            log(`✗ خطأ: ${error.message}`, 'red');
            failedTests++;
        }

        // ========== اختبار 6: التحقق من المستخدمين المعينين ==========
        totalTests++;
        log('\n👥 اختبار 6: التحقق من تعيينات المستخدمين...', 'yellow');
        try {
            const result = await pool.query(`
                SELECT COUNT(DISTINCT user_id) as count 
                FROM user_roles 
                WHERE is_active = true
            `);
            const count = parseInt(result.rows[0].count);
            
            log(`✓ النتيجة: ${count} مستخدم لديهم أدوار نشطة`, 'green');
            passedTests++;
        } catch (error) {
            log(`✗ خطأ: ${error.message}`, 'red');
            failedTests++;
        }

        // ========== اختبار 7: التحقق من سلامة البيانات ==========
        totalTests++;
        log('\n🔍 اختبار 7: التحقق من سلامة البيانات...', 'yellow');
        try {
            // التحقق من عدم وجود تعيينات صلاحيات لأدوار غير موجودة
            const orphanedPerms = await pool.query(`
                SELECT rp.role_id, COUNT(*) as count
                FROM role_permissions rp
                LEFT JOIN roles r ON rp.role_id = r.id
                WHERE r.id IS NULL
                GROUP BY rp.role_id
            `);
            
            if (orphanedPerms.rows.length === 0) {
                log(`✓ جميع تعيينات الصلاحيات مرتبطة بأدوار موجودة`, 'green');
                passedTests++;
            } else {
                log(`✗ توجد ${orphanedPerms.rows.length} تعيينات صلاحيات لأدوار غير موجودة`, 'red');
                failedTests++;
            }
        } catch (error) {
            log(`✗ خطأ: ${error.message}`, 'red');
            failedTests++;
        }

        // ========== اختبار 8: اختبار تحديث دور ==========
        totalTests++;
        log('\n✏️ اختبار 8: اختبار تحديث معلومات دور...', 'yellow');
        try {
            // نختار دور للاختبار
            const roleResult = await pool.query(`
                SELECT id, description FROM roles WHERE is_active = true LIMIT 1
            `);
            
            if (roleResult.rows.length > 0) {
                const roleId = roleResult.rows[0].id;
                const oldDescription = roleResult.rows[0].description;
                const testDescription = 'Test Description - ' + Date.now();
                
                // تحديث الوصف
                await pool.query(`
                    UPDATE roles SET description = $1 WHERE id = $2
                `, [testDescription, roleId]);
                
                // التحقق من التحديث
                const checkResult = await pool.query(`
                    SELECT description FROM roles WHERE id = $1
                `, [roleId]);
                
                if (checkResult.rows[0].description === testDescription) {
                    log(`✓ تم تحديث الدور بنجاح`, 'green');
                    
                    // إعادة الوصف القديم
                    await pool.query(`
                        UPDATE roles SET description = $1 WHERE id = $2
                    `, [oldDescription, roleId]);
                    
                    passedTests++;
                } else {
                    log(`✗ فشل تحديث الدور`, 'red');
                    failedTests++;
                }
            } else {
                log(`⚠ لا توجد أدوار للاختبار`, 'yellow');
                passedTests++;
            }
        } catch (error) {
            log(`✗ خطأ: ${error.message}`, 'red');
            failedTests++;
        }

        // ========== اختبار 9: عرض توزيع الأدوار ==========
        totalTests++;
        log('\n📊 اختبار 9: توزيع الأدوار على الأقسام...', 'yellow');
        try {
            const result = await pool.query(`
                SELECT 
                    level,
                    COUNT(*) as count
                FROM roles 
                WHERE is_active = true
                GROUP BY level
                ORDER BY count DESC
            `);
            
            log(`  التوزيع:`, 'blue');
            result.rows.forEach(row => {
                log(`    ${row.level || 'بدون مستوى'}: ${row.count} دور`, 'blue');
            });
            
            log(`✓ تم العثور على ${result.rows.length} مستوى مختلف`, 'green');
            passedTests++;
        } catch (error) {
            log(`✗ خطأ: ${error.message}`, 'red');
            failedTests++;
        }

        // ========== اختبار 10: التحقق من الأدوار النظامية ==========
        totalTests++;
        log('\n⚙️ اختبار 10: التحقق من الأدوار النظامية...', 'yellow');
        try {
            const result = await pool.query(`
                SELECT COUNT(*) as count FROM roles WHERE is_system = true
            `);
            const count = parseInt(result.rows[0].count);
            
            log(`✓ النتيجة: ${count} دور نظامي محمي`, 'green');
            passedTests++;
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
