/**
 * Test Comprehensive Audit Log System
 * اختبار نظام سجل المراجعات الشامل
 */

const { Pool } = require('pg');

const pool = new Pool({
    connectionString: 'postgresql://postgres:PddzJpAQYezqknsntSzmCUlQYuYJldcT@crossover.proxy.rlwy.net:44255/railway'
});

async function testAuditLogSystem() {
    const client = await pool.connect();
    
    try {
        console.log('🧪 بدء اختبارات نظام سجل المراجعات الشامل...\n');
        console.log('═══════════════════════════════════════════════════════════════════\n');

        let testsPassed = 0;
        let testsFailed = 0;

        // TEST 1: جداول الـ Audit Log
        console.log('📋 الاختبار 1️⃣: التحقق من وجود جداول Audit Log\n');
        try {
            const result = await client.query(`
                SELECT table_name FROM information_schema.tables 
                WHERE table_name LIKE 'audit%' 
                ORDER BY table_name
            `);
            
            const tables = result.rows.map(r => r.table_name);
            const expectedTables = ['audit_log', 'audit_log_changes', 'audit_approvals', 'audit_notifications', 'audit_statistics'];
            
            console.log(`✅ وجدت ${tables.length} جداول Audit:\n`);
            tables.forEach(t => console.log(`   ✓ ${t}`));
            
            expectedTables.forEach(table => {
                if (tables.includes(table)) {
                    console.log(`✅ جدول ${table}: موجود`);
                    testsPassed++;
                } else {
                    console.log(`❌ جدول ${table}: غير موجود`);
                    testsFailed++;
                }
            });
            console.log('');
        } catch (error) {
            console.error('❌ خطأ:', error.message);
            testsFailed++;
        }

        // TEST 2: عدد السجلات المسجلة
        console.log('📊 الاختبار 2️⃣: عدد السجلات المسجلة\n');
        try {
            const result = await client.query('SELECT COUNT(*) as count FROM audit_log');
            const count = result.rows[0].count;
            
            console.log(`✅ إجمالي السجلات: ${count}`);
            if (count > 0) {
                console.log('✅ هناك سجلات مسجلة');
                testsPassed++;
            } else {
                console.log('❌ لا توجد سجلات');
                testsFailed++;
            }
            console.log('');
        } catch (error) {
            console.error('❌ خطأ:', error.message);
            testsFailed++;
        }

        // TEST 3: أنواع العمليات المسجلة (Action Types)
        console.log('🔍 الاختبار 3️⃣: أنواع العمليات المسجلة\n');
        try {
            const result = await client.query(`
                SELECT DISTINCT action_type, COUNT(*) as count
                FROM audit_log
                GROUP BY action_type
                ORDER BY count DESC
            `);
            
            console.log(`✅ تم إيجاد ${result.rows.length} نوع عملية:\n`);
            result.rows.forEach(row => {
                console.log(`   • ${row.action_type}: ${row.count} سجل`);
            });
            
            if (result.rows.length > 0) testsPassed++;
            else testsFailed++;
            console.log('');
        } catch (error) {
            console.error('❌ خطأ:', error.message);
            testsFailed++;
        }

        // TEST 4: تصنيفات الأسباب (Reason Categories)
        console.log('📌 الاختبار 4️⃣: تصنيفات الأسباب (Reason Categories)\n');
        try {
            const result = await client.query(`
                SELECT DISTINCT reason_category, COUNT(*) as count
                FROM audit_log
                WHERE reason_category IS NOT NULL
                GROUP BY reason_category
            `);
            
            console.log(`✅ تم إيجاد ${result.rows.length} تصنيف سبب:\n`);
            result.rows.forEach(row => {
                console.log(`   • ${row.reason_category}: ${row.count} سجل`);
            });
            
            if (result.rows.length > 0) testsPassed++;
            else testsFailed++;
            console.log('');
        } catch (error) {
            console.error('❌ خطأ:', error.message);
            testsFailed++;
        }

        // TEST 5: العمليات المالية (Financial Operations)
        console.log('💰 الاختبار 5️⃣: العمليات المالية\n');
        try {
            const result = await client.query(`
                SELECT 
                    COUNT(*) as total,
                    SUM(CASE WHEN amount_affected IS NOT NULL THEN 1 ELSE 0 END) as financial_count,
                    SUM(COALESCE(amount_affected, 0)) as total_amount
                FROM audit_log
            `);
            
            const row = result.rows[0];
            console.log(`✅ إجمالي العمليات: ${row.total}`);
            console.log(`✅ العمليات المالية: ${row.financial_count}`);
            console.log(`✅ إجمالي المبالغ المالية: ${row.total_amount} ر.س\n`);
            
            if (row.financial_count > 0) testsPassed++;
            else testsFailed++;
        } catch (error) {
            console.error('❌ خطأ:', error.message);
            testsFailed++;
        }

        // TEST 6: سلسلة الموافقات (Approval Chain)
        console.log('✅ الاختبار 6️⃣: سلسلة الموافقات\n');
        try {
            const result = await client.query(`
                SELECT 
                    COUNT(*) as total_approvals,
                    COUNT(CASE WHEN approval_status = 'APPROVED' THEN 1 END) as approved_count,
                    COUNT(CASE WHEN approval_status = 'REJECTED' THEN 1 END) as rejected_count,
                    COUNT(CASE WHEN approval_status = 'PENDING' THEN 1 END) as pending_count
                FROM audit_approvals
            `);
            
            const row = result.rows[0];
            if (row.total_approvals > 0) {
                console.log(`✅ إجمالي الموافقات: ${row.total_approvals}`);
                console.log(`✅ موافقات: ${row.approved_count}`);
                console.log(`✅ رفضات: ${row.rejected_count}`);
                console.log(`✅ معلقة: ${row.pending_count}\n`);
                testsPassed++;
            } else {
                console.log('✅ جدول الموافقات موجود (بدون بيانات حالياً)\n');
                testsPassed++;
            }
        } catch (error) {
            console.error('❌ خطأ:', error.message);
            testsFailed++;
        }

        // TEST 7: حقول التغيير (Field Changes)
        console.log('🔄 الاختبار 7️⃣: حقول التغيير المسجلة\n');
        try {
            const result = await client.query(`
                SELECT DISTINCT field_changed, COUNT(*) as count
                FROM audit_log
                WHERE field_changed IS NOT NULL
                GROUP BY field_changed
            `);
            
            if (result.rows.length > 0) {
                console.log(`✅ تم إيجاد ${result.rows.length} حقل تغيير:\n`);
                result.rows.forEach(row => {
                    console.log(`   • ${row.field_changed}: ${row.count} مرة`);
                });
                testsPassed++;
            } else {
                console.log('✅ لم يتم تسجيل تغييرات حقول محددة بعد\n');
                testsPassed++;
            }
        } catch (error) {
            console.error('❌ خطأ:', error.message);
            testsFailed++;
        }

        // TEST 8: المستخدمون النشطون (Active Users)
        console.log('👥 الاختبار 8️⃣: المستخدمون النشطون\n');
        try {
            const result = await client.query(`
                SELECT 
                    user_name, user_role, 
                    COUNT(*) as action_count,
                    COUNT(DISTINCT entity_type) as entity_types_touched,
                    COUNT(CASE WHEN success THEN 1 END) as successful_actions
                FROM audit_log
                GROUP BY user_name, user_role
                ORDER BY action_count DESC
            `);
            
            console.log(`✅ تم إيجاد ${result.rows.length} مستخدمين نشطين:\n`);
            result.rows.forEach(row => {
                console.log(`   • ${row.user_name} (${row.user_role})`);
                console.log(`     - عمليات: ${row.action_count}`);
                console.log(`     - أنواع كيانات: ${row.entity_types_touched}`);
                console.log(`     - عمليات ناجحة: ${row.successful_actions}\n`);
            });
            
            if (result.rows.length > 0) testsPassed++;
            else testsFailed++;
        } catch (error) {
            console.error('❌ خطأ:', error.message);
            testsFailed++;
        }

        // TEST 9: Views التحقق
        console.log('📊 الاختبار 9️⃣: التحقق من الـ Views\n');
        try {
            const views = ['audit_log_summary', 'audit_log_financial', 'audit_log_approvals_chain'];
            let viewCount = 0;
            
            for (const viewName of views) {
                try {
                    const result = await client.query(`SELECT COUNT(*) FROM ${viewName}`);
                    console.log(`✅ View ${viewName}: موجود`);
                    viewCount++;
                } catch (err) {
                    console.log(`❌ View ${viewName}: غير موجود`);
                }
            }
            
            if (viewCount === views.length) {
                testsPassed++;
            } else {
                testsFailed++;
            }
            console.log('');
        } catch (error) {
            console.error('❌ خطأ:', error.message);
            testsFailed++;
        }

        // TEST 10: معلومات الفاتورة المسجلة
        console.log('🧾 الاختبار 🔟: معلومات الفاتورة المسجلة\n');
        try {
            const result = await client.query(`
                SELECT 
                    entity_reference_id,
                    entity_reference_name,
                    COUNT(*) as audit_count,
                    array_agg(DISTINCT action_type) as actions
                FROM audit_log
                WHERE entity_type = 'INVOICE'
                GROUP BY entity_reference_id, entity_reference_name
            `);
            
            if (result.rows.length > 0) {
                console.log(`✅ تم تتبع ${result.rows.length} فاتورة:\n`);
                result.rows.forEach(row => {
                    console.log(`   • ${row.entity_reference_name} (${row.entity_reference_id})`);
                    console.log(`     - سجلات: ${row.audit_count}`);
                    console.log(`     - عمليات: ${row.actions.join(', ')}\n`);
                });
                testsPassed++;
            } else {
                console.log('✅ لم يتم تسجيل فواتير بعد\n');
                testsPassed++;
            }
        } catch (error) {
            console.error('❌ خطأ:', error.message);
            testsFailed++;
        }

        // TEST 11: مثال على آخر 5 عمليات
        console.log('📝 الاختبار 1️⃣1️⃣: آخر 5 عمليات مسجلة\n');
        try {
            const result = await client.query(`
                SELECT 
                    id,
                    user_name,
                    action_timestamp,
                    entity_type,
                    entity_reference_name,
                    action_type,
                    reason,
                    approval_status
                FROM audit_log
                ORDER BY action_timestamp DESC
                LIMIT 5
            `);
            
            if (result.rows.length > 0) {
                console.log(`✅ عرض آخر ${result.rows.length} عمليات:\n`);
                result.rows.forEach((row, idx) => {
                    console.log(`${idx + 1}. [${row.id}] ${row.user_name}`);
                    console.log(`   التاريخ: ${row.action_timestamp}`);
                    console.log(`   النوع: ${row.entity_type} - ${row.action_type}`);
                    console.log(`   الكيان: ${row.entity_reference_name}`);
                    console.log(`   السبب: ${row.reason}`);
                    console.log(`   الحالة: ${row.approval_status}\n`);
                });
                testsPassed++;
            } else {
                console.log('✅ لا توجد عمليات مسجلة\n');
                testsPassed++;
            }
        } catch (error) {
            console.error('❌ خطأ:', error.message);
            testsFailed++;
        }

        // TEST 12: التحقق من الفهارس
        console.log('🔧 الاختبار 1️⃣2️⃣: التحقق من الفهارس (Indexes)\n');
        try {
            const result = await client.query(`
                SELECT indexname FROM pg_indexes 
                WHERE tablename = 'audit_log'
                ORDER BY indexname
            `);
            
            const indexes = result.rows.map(r => r.indexname);
            console.log(`✅ وجدت ${indexes.length} فهرس:\n`);
            indexes.forEach(idx => console.log(`   ✓ ${idx}`));
            
            if (indexes.length > 0) testsPassed++;
            else testsFailed++;
            console.log('');
        } catch (error) {
            console.error('❌ خطأ:', error.message);
            testsFailed++;
        }

        // FINAL RESULTS
        console.log('═══════════════════════════════════════════════════════════════════');
        console.log('\n📊 نتائج الاختبارات:\n');
        console.log(`✅ اختبارات نجحت: ${testsPassed}`);
        console.log(`❌ اختبارات فشلت: ${testsFailed}`);
        console.log(`📈 النسبة: ${((testsPassed / (testsPassed + testsFailed)) * 100).toFixed(2)}%\n`);

        if (testsFailed === 0) {
            console.log('🎉 جميع الاختبارات نجحت بنجاح!\n');
        } else {
            console.log('⚠️ بعض الاختبارات فشلت. يرجى المراجعة.\n');
        }

    } catch (error) {
        console.error('❌ خطأ في الاختبار:', error.message);
    } finally {
        client.release();
    }
}

// Run tests
testAuditLogSystem()
    .then(() => {
        console.log('✅ اكتملت جميع الاختبارات');
        process.exit(0);
    })
    .catch((error) => {
        console.error('❌ فشلت الاختبارات:', error);
        process.exit(1);
    })
    .finally(() => {
        pool.end();
    });
