const API_BASE = 'http://localhost:3000';

async function testAdminErpHrAPI() {
    console.log('🧪 اختبار واجهات النظام الإداري والموارد البشرية\n');

    const tests = [
        {
            name: 'الموظفون',
            endpoint: '/api/employees',
            description: 'جلب جميع الموظفين'
        },
        {
            name: 'طلبات الموظفين',
            endpoint: '/api/employee-requests',
            description: 'جلب جميع طلبات الموظفين'
        },
        {
            name: 'أنواع الطلبات',
            endpoint: '/api/request-types',
            description: 'جلب أنواع الطلبات'
        },
        {
            name: 'إحصائيات الهيكل',
            endpoint: '/api/hierarchy/stats',
            description: 'جلب مؤشرات الهيكل الإداري'
        }
    ];

    let passedTests = 0;
    let failedTests = 0;

    for (const test of tests) {
        try {
            console.log(`📡 اختبار: ${test.name}`);
            console.log(`   الوصف: ${test.description}`);
            console.log(`   الرابط: ${API_BASE}${test.endpoint}`);

            const response = await fetch(`${API_BASE}${test.endpoint}`);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            console.log('   ✅ نجح - استلام البيانات');

            if (Array.isArray(data)) {
                console.log(`   📊 عدد الصفوف: ${data.length}`);
                if (data.length > 0) {
                    console.log('   📄 عينة من البيانات:', JSON.stringify(data[0], null, 2).substring(0, 200));
                }
            } else {
                console.log('   📊 تم استلام كائن بيانات');
            }

            passedTests++;
        } catch (error) {
            console.error(`   ❌ فشل - ${error.message}`);
            failedTests++;
        }
        console.log('');
    }

    console.log('═══════════════════════════════════════');
    console.log(`✅ نجح: ${passedTests}/${tests.length}`);
    console.log(`❌ فشل: ${failedTests}/${tests.length}`);
    console.log(`📊 نسبة النجاح: ${((passedTests / tests.length) * 100).toFixed(1)}%`);
    console.log('═══════════════════════════════════════\n');

    if (passedTests === tests.length) {
        console.log('🎉 جميع اختبارات النظام الإداري والموارد البشرية نجحت!\n');
        process.exit(0);
    } else {
        console.log('⚠️ بعض الاختبارات فشلت. يرجى مراجعة الأخطاء أعلاه.\n');
        process.exit(1);
    }
}

testAdminErpHrAPI();
