/**
 * اختبار شامل لنظام Super Admin
 * يختبر جميع API endpoints
 */

const { Pool } = require('pg');

const pool = new Pool({
    connectionString: 'postgresql://postgres:PddzJpAQYezqknsntSzmCUlQYuYJldcT@crossover.proxy.rlwy.net:44255/railway',
    ssl: false
});

// ألوان للـ console
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
            
            if (count === 33) {
                log(`✓ النتيجة: ${count} دور (متوقع 33 دور)`, 'green');
                passedTests++;
            } else {
                log(`✗ النتيجة: ${count} دور (متوقع 33 دور)`, 'red');
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
            const result = await pool.query('SELECT COUNT(*) as count FROM role_permissions');
            const count = parseInt(result.rows[0].count);
            
            if (count >= 200) {
                log(`✓ النتيجة: ${count} صلاحية`, 'green');
                passedTests++;
            } else {
                log(`✗ النتيجة: ${count} صلاحية (متوقع >= 200)`, 'red');
                failedTests++;
            }
        } catch (error) {
            log(`✗ خطأ: ${error.message}`, 'red');
            failedTests++;
        }

        // ========== اختبار 3: التحقق من الأنظمة ==========
        totalTests++;
        log('\n💼 اختبار 3: التحقق من وجود الأنظمة...', 'yellow');
        try {
            const result = await pool.query('SELECT COUNT(*) as count FROM systems');
            const count = parseInt(result.rows[0].count);
            
            if (count === 8) {
                log(`✓ النتيجة: ${count} نظام (متوقع 8 أنظمة)`, 'green');
                passedTests++;
            } else {
                log(`✗ النتيجة: ${count} نظام (متوقع 8 أنظمة)`, 'red');
                failedTests++;
            }
        } catch (error) {
            log(`✗ خطأ: ${error.message}`, 'red');
            failedTests++;
        }

        // ========== اختبار 4: التحقق من مستويات الصلاحيات ==========
        totalTests++;
        log('\n📊 اختبار 4: التحقق من مستويات الصلاحيات...', 'yellow');
        try {
            const result = await pool.query('SELECT COUNT(*) as count FROM permission_levels');
            const count = parseInt(result.rows[0].count);
            
            if (count === 6) {
                log(`✓ النتيجة: ${count} مستوى (متوقع 6 مستويات)`, 'green');
                passedTests++;
            } else {
                log(`✗ النتيجة: ${count} مستوى (متوقع 6 مستويات)`, 'red');
                failedTests++;
            }
        } catch (error) {
            log(`✗ خطأ: ${error.message}`, 'red');
            failedTests++;
        }

        // ========== اختبار 5: التحقق من صلاحيات CEO ==========
        totalTests++;
        log('\n👔 اختبار 5: التحقق من صلاحيات CEO...', 'yellow');
        try {
            const result = await pool.query(`
                SELECT COUNT(*) as count 
                FROM role_permissions 
                WHERE role_code = 'CEO' AND permission_level = 'FULL'
            `);
            const count = parseInt(result.rows[0].count);
            
            if (count === 8) {
                log(`✓ النتيجة: CEO لديه ${count} صلاحية كاملة (متوقع 8)`, 'green');
                passedTests++;
            } else {
                log(`✗ النتيجة: CEO لديه ${count} صلاحية كاملة (متوقع 8)`, 'red');
                failedTests++;
            }
        } catch (error) {
            log(`✗ خطأ: ${error.message}`, 'red');
            failedTests++;
        }

        // ========== اختبار 6: اختبار إنشاء دور جديد ==========
        totalTests++;
        log('\n✏️ اختبار 6: اختبار إنشاء دور جديد...', 'yellow');
        try {
            const testRoleCode = 'TEST_ROLE_' + Date.now();
            
            await pool.query(`
                INSERT INTO roles (code, title_ar, title_en, hierarchy_level, is_active)
                VALUES ($1, 'دور اختباري', 'Test Role', 4, true)
            `, [testRoleCode]);
            
            const checkResult = await pool.query('SELECT * FROM roles WHERE code = $1', [testRoleCode]);
            
            if (checkResult.rows.length === 1) {
                log(`✓ تم إنشاء الدور ${testRoleCode} بنجاح`, 'green');
                
                // حذف الدور الاختباري
                await pool.query('DELETE FROM roles WHERE code = $1', [testRoleCode]);
                log(`  تم حذف الدور الاختباري`, 'blue');
                
                passedTests++;
            } else {
                log(`✗ فشل إنشاء الدور`, 'red');
                failedTests++;
            }
        } catch (error) {
            log(`✗ خطأ: ${error.message}`, 'red');
            failedTests++;
        }

        // ========== اختبار 7: اختبار تحديث صلاحيات دور ==========
        totalTests++;
        log('\n🔄 اختبار 7: اختبار تحديث صلاحيات دور...', 'yellow');
        try {
            // نستخدم دور موجود للاختبار
            const testRole = await pool.query(`
                SELECT code FROM roles WHERE is_active = true LIMIT 1
            `);
            
            if (testRole.rows.length > 0) {
                const roleCode = testRole.rows[0].code;
                
                // حفظ الصلاحية القديمة
                const oldPerm = await pool.query(`
                    SELECT * FROM role_permissions WHERE role_code = $1 AND system_code = 'HR'
                `, [roleCode]);
                
                const oldLevel = oldPerm.rows.length > 0 ? oldPerm.rows[0].permission_level : null;
                
                // تحديث الصلاحية
                await pool.query(`
                    INSERT INTO role_permissions (role_code, system_code, permission_level)
                    VALUES ($1, 'HR', 'VIEW')
                    ON CONFLICT (role_code, system_code) DO UPDATE SET permission_level = 'VIEW'
                `, [roleCode]);
                
                // التحقق
                const newPerm = await pool.query(`
                    SELECT * FROM role_permissions WHERE role_code = $1 AND system_code = 'HR'
                `, [roleCode]);
                
                if (newPerm.rows.length > 0 && newPerm.rows[0].permission_level === 'VIEW') {
                    log(`✓ تم تحديث صلاحيات ${roleCode} بنجاح`, 'green');
                    
                    // إعادة الصلاحية القديمة
                    if (oldLevel) {
                        await pool.query(`
                            UPDATE role_permissions SET permission_level = $1 
                            WHERE role_code = $2 AND system_code = 'HR'
                        `, [oldLevel, roleCode]);
                        log(`  تم استعادة الصلاحية القديمة`, 'blue');
                    }
                    
                    passedTests++;
                } else {
                    log(`✗ فشل تحديث الصلاحيات`, 'red');
                    failedTests++;
                }
            } else {
                log(`✗ لا توجد أدوار للاختبار`, 'red');
                failedTests++;
            }
        } catch (error) {
            log(`✗ خطأ: ${error.message}`, 'red');
            failedTests++;
        }

        // ========== اختبار 8: اختبار حدود الموافقة ==========
        totalTests++;
        log('\n💰 اختبار 8: التحقق من حدود الموافقة...', 'yellow');
        try {
            const result = await pool.query(`
                SELECT 
                    code,
                    title_ar,
                    min_approval_limit,
                    max_approval_limit
                FROM roles 
                WHERE code IN ('CEO', 'CFO', 'FINANCE_MANAGER', 'ACCOUNTANT')
                ORDER BY max_approval_limit DESC NULLS FIRST
            `);
            
            let allCorrect = true;
            result.rows.forEach(role => {
                const limit = role.max_approval_limit || 'غير محدود';
                log(`  ${role.title_ar}: ${limit}`, 'blue');
                
                // CEO يجب أن يكون غير محدود (null أو 0)
                if (role.code === 'CEO' && role.max_approval_limit !== null && role.max_approval_limit !== 0) {
                    allCorrect = false;
                }
            });
            
            if (allCorrect) {
                log(`✓ حدود الموافقة صحيحة`, 'green');
                passedTests++;
            } else {
                log(`✗ بعض حدود الموافقة غير صحيحة`, 'red');
                failedTests++;
            }
        } catch (error) {
            log(`✗ خطأ: ${error.message}`, 'red');
            failedTests++;
        }

        // ========== اختبار 9: اختبار المستويات الهرمية ==========
        totalTests++;
        log('\n🏢 اختبار 9: التحقق من المستويات الهرمية...', 'yellow');
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
            
            if (totalRoles === 33) {
                log(`✓ إجمالي الأدوار عبر المستويات: ${totalRoles}`, 'green');
                passedTests++;
            } else {
                log(`✗ إجمالي الأدوار: ${totalRoles} (متوقع 33)`, 'red');
                failedTests++;
            }
        } catch (error) {
            log(`✗ خطأ: ${error.message}`, 'red');
            failedTests++;
        }

        // ========== اختبار 10: اختبار جدول audit_log ==========
        totalTests++;
        log('\n📝 اختبار 10: التحقق من جدول سجل التعديلات...', 'yellow');
        try {
            const result = await pool.query(`
                SELECT COUNT(*) as count FROM audit_log 
                WHERE entity_type IN ('roles', 'role_permissions', 'user_roles')
            `);
            const count = parseInt(result.rows[0].count);
            
            log(`✓ عدد سجلات التعديلات: ${count}`, 'green');
            passedTests++;
        } catch (error) {
            log(`✗ خطأ: ${error.message}`, 'red');
            failedTests++;
        }

        // ========== اختبار 11: التحقق من عدم وجود أدوار مكررة ==========
        totalTests++;
        log('\n🔍 اختبار 11: التحقق من عدم وجود أدوار مكررة...', 'yellow');
        try {
            const result = await pool.query(`
                SELECT code, COUNT(*) as count
                FROM roles
                GROUP BY code
                HAVING COUNT(*) > 1
            `);
            
            if (result.rows.length === 0) {
                log(`✓ لا توجد أدوار مكررة`, 'green');
                passedTests++;
            } else {
                log(`✗ توجد ${result.rows.length} أدوار مكررة`, 'red');
                result.rows.forEach(row => {
                    log(`  ${row.code}: ${row.count} مرة`, 'red');
                });
                failedTests++;
            }
        } catch (error) {
            log(`✗ خطأ: ${error.message}`, 'red');
            failedTests++;
        }

        // ========== اختبار 12: التحقق من سلامة البيانات ==========
        totalTests++;
        log('\n🔗 اختبار 12: التحقق من سلامة البيانات...', 'yellow');
        try {
            // التحقق من عدم وجود صلاحيات لأدوار غير موجودة
            const orphanedPerms = await pool.query(`
                SELECT rp.role_code, COUNT(*) as count
                FROM role_permissions rp
                LEFT JOIN roles r ON rp.role_code = r.code
                WHERE r.code IS NULL
                GROUP BY rp.role_code
            `);
            
            if (orphanedPerms.rows.length === 0) {
                log(`✓ جميع الصلاحيات مرتبطة بأدوار موجودة`, 'green');
                passedTests++;
            } else {
                log(`✗ توجد ${orphanedPerms.rows.length} صلاحيات لأدوار غير موجودة`, 'red');
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
        log('\n⚠️  بعض الاختبارات فشلت. يرجى مراجعة الأخطاء.', 'yellow');
    }
    
    log('========================================\n', 'blue');
}

// تشغيل الاختبارات
runTests().catch(error => {
    console.error('خطأ في تشغيل الاختبارات:', error);
    process.exit(1);
});
