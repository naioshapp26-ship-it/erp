// إضافة العلاقات بين الكيانات
// Add Entity Relationships Migration

const fs = require('fs');
const db = require('./db');

async function addEntityRelationships() {
    console.log('🔄 بدء إضافة العلاقات بين الكيانات...\n');

    try {
        // قراءة ملف SQL
        const sql = fs.readFileSync('./add-entity-relationships.sql', 'utf8');

        // تنفيذ SQL
        console.log('📝 تنفيذ استعلامات SQL...');
        await db.query(sql);

        console.log('\n✅ تم تحديث الجداول بنجاح!');
        console.log('━'.repeat(50));

        // عرض إحصائيات
        console.log('\n📊 الإحصائيات:');
        
        const employeesCount = await db.query('SELECT COUNT(*) FROM employees');
        console.log(`   👨‍💼 الموظفين: ${employeesCount.rows[0].count}`);

        const usersCount = await db.query('SELECT COUNT(*) FROM users');
        console.log(`   👥 المستخدمين: ${usersCount.rows[0].count}`);

        const invoicesCount = await db.query('SELECT COUNT(*) FROM invoices');
        console.log(`   📄 الفواتير: ${invoicesCount.rows[0].count}`);

        const adsCount = await db.query('SELECT COUNT(*) FROM ads');
        console.log(`   📢 الإعلانات: ${adsCount.rows[0].count}`);

        console.log('\n━'.repeat(50));
        console.log('\n📋 Views المُنشأة:');
        console.log('   • users_with_entity');
        console.log('   • employees_with_entity');
        console.log('   • invoices_with_details');
        console.log('   • ads_with_source');

        console.log('\n━'.repeat(50));
        console.log('\n🎯 الحقول الجديدة المضافة:');
        console.log('\n   📌 جدول users:');
        console.log('      - branch_id');
        console.log('      - incubator_id');
        console.log('      - platform_id');
        console.log('      - office_id');
        console.log('      - linked_entity_type');

        console.log('\n   📌 جدول invoices:');
        console.log('      - user_id (العميل)');
        console.log('      - branch_id');
        console.log('      - office_id');
        console.log('      - incubator_id');
        console.log('      - issuer_entity_type');

        console.log('\n   📌 جدول ads:');
        console.log('      - hq_id');
        console.log('      - new_branch_id');
        console.log('      - new_incubator_id');
        console.log('      - new_platform_id');
        console.log('      - new_office_id');
        console.log('      - ad_source_entity_type');

        console.log('\n   📌 جدول employees (جديد):');
        console.log('      - hq_id');
        console.log('      - branch_id');
        console.log('      - incubator_id');
        console.log('      - platform_id');
        console.log('      - office_id');
        console.log('      - assigned_entity_type');
        console.log('      - position, department, salary...');

        console.log('\n━'.repeat(50));
        console.log('\n✨ الآن يمكنك:');
        console.log('   1️⃣  ربط العملاء بـ Office/Platform/Incubator/Branch');
        console.log('   2️⃣  ربط الفواتير بالعميل + Office/Branch');
        console.log('   3️⃣  ربط الموظفين بـ Branch/Incubator/Platform/Office/HQ');
        console.log('   4️⃣  ربط الإعلانات بـ HQ/Branch/Incubator/Platform/Office');

        console.log('\n━'.repeat(50));
        console.log('\n🔍 اختبار البيانات:');

        // اختبار عرض الموظفين
        const employeesWithEntity = await db.query('SELECT * FROM employees_with_entity LIMIT 3');
        console.log('\n   👨‍💼 عينة من الموظفين:');
        employeesWithEntity.rows.forEach(emp => {
            console.log(`      • ${emp.full_name} - ${emp.position} في ${emp.entity_name || 'غير محدد'} (${emp.assigned_entity_type})`);
        });

        // اختبار عرض المستخدمين
        const usersWithEntity = await db.query('SELECT * FROM users_with_entity LIMIT 3');
        console.log('\n   👥 عينة من المستخدمين:');
        usersWithEntity.rows.forEach(user => {
            console.log(`      • ${user.name} - ${user.role} في ${user.entity_name}`);
        });

        console.log('\n━'.repeat(50));
        console.log('\n🎉 Migration اكتمل بنجاح!');
        console.log('\n💡 نصيحة: استخدم الـ Views لعرض البيانات بشكل أسهل');
        console.log('   مثال: SELECT * FROM employees_with_entity WHERE assigned_entity_type = \'BRANCH\'');

    } catch (error) {
        console.error('\n❌ خطأ في Migration:', error.message);
        console.error('\nالتفاصيل:', error);
        process.exit(1);
    } finally {
        // إغلاق الاتصال
        await db.end();
        console.log('\n🔌 تم إغلاق الاتصال بقاعدة البيانات');
    }
}

// تنفيذ Migration
addEntityRelationships();
