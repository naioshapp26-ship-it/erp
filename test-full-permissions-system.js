const { Pool } = require('pg');

// بيانات الاتصال بقاعدة البيانات
const pool = new Pool({
    connectionString: 'postgresql://postgres:PddzJpAQYezqknsntSzmCUlQYuYJldcT@crossover.proxy.rlwy.net:44255/railway',
    ssl: false
});

async function testFullPermissionsSystem() {
    const client = await pool.connect();
    
    try {
        console.log('\n' + '='.repeat(80));
        console.log('🧪 اختبار شامل لنظام مصفوفة الصلاحيات');
        console.log('='.repeat(80) + '\n');

        // ============================================================================
        // 1. اختبار مستويات الصلاحيات
        // ============================================================================
        console.log('📊 1. اختبار مستويات الصلاحيات الستة...');
        const levelsResult = await client.query(`
            SELECT level_code, level_name_ar, level_name_en, priority_order, color_code
            FROM permission_levels
            ORDER BY priority_order
        `);
        console.log(`   ✅ تم العثور على ${levelsResult.rows.length} مستوى صلاحية`);
        levelsResult.rows.forEach(row => {
            console.log(`      - ${row.level_name_ar} (${row.level_name_en}) - اللون: ${row.color_code}`);
        });

        // ============================================================================
        // 2. اختبار الأنظمة الثمانية
        // ============================================================================
        console.log('\n📊 2. اختبار الأنظمة الثمانية...');
        const systemsResult = await client.query(`
            SELECT system_code, system_name_ar, system_name_en, display_order
            FROM systems
            WHERE is_active = TRUE
            ORDER BY display_order
        `);
        console.log(`   ✅ تم العثور على ${systemsResult.rows.length} نظام نشط`);
        systemsResult.rows.forEach(row => {
            console.log(`      ${row.display_order}. ${row.system_name_ar} (${row.system_name_en})`);
        });

        // ============================================================================
        // 3. اختبار الـ 33 دور
        // ============================================================================
        console.log('\n📊 3. اختبار الـ 33 مسمى وظيفي...');
        const rolesResult = await client.query(`
            SELECT 
                name,
                job_title_ar,
                job_title_en,
                hierarchy_level,
                level,
                min_approval_limit,
                max_approval_limit
            FROM roles
            WHERE is_active = TRUE
            ORDER BY hierarchy_level, id
        `);
        console.log(`   ✅ تم العثور على ${rolesResult.rows.length} دور نشط`);
        
        const byLevel = {};
        rolesResult.rows.forEach(row => {
            if (!byLevel[row.hierarchy_level]) {
                byLevel[row.hierarchy_level] = [];
            }
            byLevel[row.hierarchy_level].push(row);
        });
        
        const levelNames = {
            0: 'المكتب الرئيسي (HQ)',
            1: 'فرع الدولة (BRANCH)',
            2: 'حاضنة قطاع الأعمال (INCUBATOR)',
            3: 'المنصة التشغيلية (PLATFORM)',
            4: 'المكتب التنفيذي (EXECUTIVE_OFFICE)'
        };
        
        Object.keys(byLevel).sort().forEach(level => {
            console.log(`\n      ${levelNames[level]}:`);
            byLevel[level].forEach(role => {
                const limit = role.max_approval_limit === null ? 'غير محدود' : 
                             role.max_approval_limit === 0 ? 'لا توجد' :
                             role.max_approval_limit.toLocaleString();
                console.log(`         - ${role.job_title_ar} (حد الموافقة: ${limit})`);
            });
        });

        // ============================================================================
        // 4. اختبار مصفوفة الصلاحيات
        // ============================================================================
        console.log('\n📊 4. اختبار مصفوفة الصلاحيات...');
        const matrixResult = await client.query(`
            SELECT COUNT(*) as total_permissions
            FROM role_system_permissions
            WHERE is_active = TRUE
        `);
        console.log(`   ✅ تم إنشاء ${matrixResult.rows[0].total_permissions} صلاحية في المصفوفة`);

        // عرض إحصائيات المصفوفة
        const statsResult = await client.query(`
            SELECT 
                pl.level_name_ar,
                COUNT(*) as count
            FROM role_system_permissions rsp
            JOIN permission_levels pl ON rsp.permission_level_id = pl.id
            WHERE rsp.is_active = TRUE
            GROUP BY pl.level_name_ar, pl.priority_order
            ORDER BY pl.priority_order
        `);
        console.log('\n      توزيع الصلاحيات حسب المستوى:');
        statsResult.rows.forEach(row => {
            console.log(`         - ${row.level_name_ar}: ${row.count} صلاحية`);
        });

        // ============================================================================
        // 5. اختبار سياسات الأمان
        // ============================================================================
        console.log('\n📊 5. اختبار سياسات الأمان والامتثال...');
        const policiesResult = await client.query(`
            SELECT policy_code, policy_name_ar, enforcement_type, responsible_role
            FROM security_policies
            WHERE is_active = TRUE
            ORDER BY id
        `);
        console.log(`   ✅ تم العثور على ${policiesResult.rows.length} سياسة أمان`);
        policiesResult.rows.forEach((row, index) => {
            console.log(`      ${index + 1}. ${row.policy_name_ar} (${row.enforcement_type}) - مسؤول: ${row.responsible_role}`);
        });

        // ============================================================================
        // 6. اختبار الدوال المساعدة
        // ============================================================================
        console.log('\n📊 6. اختبار الدوال المساعدة...');
        
        // اختبار دالة check_user_system_permission
        const functionCheck = await client.query(`
            SELECT proname, pronargs
            FROM pg_proc
            WHERE proname IN ('check_user_system_permission', 'check_user_approval_limit', 'get_user_permissions_summary')
        `);
        console.log(`   ✅ تم العثور على ${functionCheck.rows.length} دالة مساعدة`);
        functionCheck.rows.forEach(row => {
            console.log(`      - ${row.proname} (${row.pronargs} معاملات)`);
        });

        // ============================================================================
        // 7. اختبار الصلاحيات لأدوار محددة
        // ============================================================================
        console.log('\n📊 7. اختبار صلاحيات أدوار محددة...');
        
        // اختبار SUPER_ADMIN
        const superAdminPerms = await client.query(`
            SELECT COUNT(*) as total
            FROM role_system_permissions rsp
            JOIN roles r ON rsp.role_id = r.id
            WHERE r.name = 'SUPER_ADMIN' AND rsp.is_active = TRUE
        `);
        console.log(`   ✅ SUPER_ADMIN لديه ${superAdminPerms.rows[0].total} صلاحية (يجب أن يكون 8 - واحد لكل نظام)`);

        // اختبار مدير فرع
        const branchManagerPerms = await client.query(`
            SELECT s.system_name_ar, pl.level_name_ar
            FROM role_system_permissions rsp
            JOIN roles r ON rsp.role_id = r.id
            JOIN systems s ON rsp.system_id = s.id
            JOIN permission_levels pl ON rsp.permission_level_id = pl.id
            WHERE r.name = 'BRANCH_MANAGER' AND rsp.is_active = TRUE
            ORDER BY s.display_order
        `);
        console.log(`\n   مدير الفرع لديه صلاحيات على ${branchManagerPerms.rows.length} نظام:`);
        branchManagerPerms.rows.forEach(row => {
            console.log(`      - ${row.system_name_ar}: ${row.level_name_ar}`);
        });

        // اختبار موظف عادي
        const employeePerms = await client.query(`
            SELECT s.system_name_ar, pl.level_name_ar
            FROM role_system_permissions rsp
            JOIN roles r ON rsp.role_id = r.id
            JOIN systems s ON rsp.system_id = s.id
            JOIN permission_levels pl ON rsp.permission_level_id = pl.id
            WHERE r.name = 'EMPLOYEE' AND rsp.is_active = TRUE AND pl.level_code != 'NONE'
            ORDER BY s.display_order
        `);
        console.log(`\n   الموظف العادي لديه صلاحيات محدودة على ${employeePerms.rows.length} نظام:`);
        employeePerms.rows.forEach(row => {
            console.log(`      - ${row.system_name_ar}: ${row.level_name_ar}`);
        });

        // ============================================================================
        // 8. اختبار حدود الموافقات المالية
        // ============================================================================
        console.log('\n📊 8. اختبار حدود الموافقات المالية...');
        const approvalLimits = await client.query(`
            SELECT 
                job_title_ar,
                hierarchy_level,
                min_approval_limit,
                max_approval_limit,
                approval_notes_ar
            FROM roles
            WHERE is_active = TRUE
            ORDER BY 
                CASE 
                    WHEN max_approval_limit IS NULL THEN 999999999
                    ELSE max_approval_limit
                END DESC
            LIMIT 10
        `);
        console.log('   أعلى 10 حدود موافقات مالية:');
        approvalLimits.rows.forEach((row, index) => {
            const limit = row.max_approval_limit === null ? 'غير محدود' : 
                         row.max_approval_limit === 0 ? 'لا توجد' :
                         row.max_approval_limit.toLocaleString() + ' ريال/دولار';
            console.log(`      ${index + 1}. ${row.job_title_ar}: ${limit}`);
        });

        // ============================================================================
        // 9. اختبار المؤشرات
        // ============================================================================
        console.log('\n📊 9. اختبار المؤشرات (Indexes)...');
        const indexesResult = await client.query(`
            SELECT indexname, tablename
            FROM pg_indexes
            WHERE schemaname = 'public'
            AND (
                indexname LIKE 'idx_role_system%' OR
                indexname LIKE 'idx_roles_%' OR
                indexname LIKE 'idx_system_permissions%'
            )
            ORDER BY tablename, indexname
        `);
        console.log(`   ✅ تم العثور على ${indexesResult.rows.length} مؤشر`);
        indexesResult.rows.forEach(row => {
            console.log(`      - ${row.tablename}.${row.indexname}`);
        });

        // ============================================================================
        // 10. اختبار سلامة البيانات
        // ============================================================================
        console.log('\n📊 10. اختبار سلامة البيانات...');
        
        // التحقق من عدم وجود صلاحيات يتيمة
        const orphanedPerms = await client.query(`
            SELECT COUNT(*) as orphaned
            FROM role_system_permissions rsp
            WHERE NOT EXISTS (SELECT 1 FROM roles r WHERE r.id = rsp.role_id AND r.is_active = TRUE)
            OR NOT EXISTS (SELECT 1 FROM systems s WHERE s.id = rsp.system_id AND s.is_active = TRUE)
            OR NOT EXISTS (SELECT 1 FROM permission_levels pl WHERE pl.id = rsp.permission_level_id)
        `);
        console.log(`   ✅ صلاحيات يتيمة: ${orphanedPerms.rows[0].orphaned} (يجب أن يكون 0)`);

        // التحقق من عدم وجود تكرار في المصفوفة
        const duplicates = await client.query(`
            SELECT role_id, system_id, COUNT(*) as count
            FROM role_system_permissions
            WHERE is_active = TRUE
            GROUP BY role_id, system_id
            HAVING COUNT(*) > 1
        `);
        console.log(`   ✅ صلاحيات مكررة: ${duplicates.rows.length} (يجب أن يكون 0)`);

        // ============================================================================
        // التقرير النهائي
        // ============================================================================
        console.log('\n' + '='.repeat(80));
        console.log('✅ ملخص الاختبار النهائي');
        console.log('='.repeat(80));
        console.log(`✅ مستويات الصلاحيات: ${levelsResult.rows.length} / 6`);
        console.log(`✅ الأنظمة: ${systemsResult.rows.length} / 8`);
        console.log(`✅ الأدوار: ${rolesResult.rows.length} / 33`);
        console.log(`✅ إجمالي الصلاحيات في المصفوفة: ${matrixResult.rows[0].total_permissions}`);
        console.log(`✅ سياسات الأمان: ${policiesResult.rows.length} / 12`);
        console.log(`✅ الدوال المساعدة: ${functionCheck.rows.length} / 3`);
        console.log(`✅ المؤشرات: ${indexesResult.rows.length}`);
        console.log(`✅ صلاحيات يتيمة: ${orphanedPerms.rows[0].orphaned}`);
        console.log(`✅ صلاحيات مكررة: ${duplicates.rows.length}`);
        console.log('='.repeat(80));
        
        if (
            levelsResult.rows.length === 6 &&
            systemsResult.rows.length === 8 &&
            rolesResult.rows.length === 33 &&
            policiesResult.rows.length === 12 &&
            functionCheck.rows.length === 3 &&
            orphanedPerms.rows[0].orphaned === '0' &&
            duplicates.rows.length === 0
        ) {
            console.log('\n🎉 جميع الاختبارات نجحت! النظام جاهز للعمل ✅');
        } else {
            console.log('\n⚠️ بعض الاختبارات فشلت. يرجى مراجعة التقرير أعلاه');
        }
        console.log('='.repeat(80) + '\n');

    } catch (error) {
        console.error('❌ خطأ في الاختبار:', error.message);
        console.error(error.stack);
    } finally {
        client.release();
        await pool.end();
    }
}

// تشغيل الاختبار
testFullPermissionsSystem().catch(console.error);
