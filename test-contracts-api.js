const API_BASE = 'http://localhost:3000';

async function testContractsAPI() {
    console.log('🧪 اختبار واجهات العقود\n');

    const tests = [
        {
            name: 'العملاء',
            endpoint: '/finance/customers',
            description: 'جلب بيانات العملاء'
        },
        {
            name: 'الفواتير',
            endpoint: '/finance/invoices',
            description: 'جلب جميع الفواتير'
        },
        {
            name: 'المدفوعات',
            endpoint: '/finance/payments',
            description: 'جلب جميع المدفوعات'
        },
        {
            name: 'طلبات الموظفين',
            endpoint: '/api/employee-requests',
            description: 'جلب طلبات الموظفين'
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
                const preview = JSON.stringify(data, null, 2).substring(0, 200);
                console.log('   📊 تم استلام كائن بيانات');
                console.log('   📄 عينة من البيانات:', preview);
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
        console.log('🎉 جميع اختبارات العقود نجحت!\n');
        process.exit(0);
    } else {
        console.log('⚠️ بعض الاختبارات فشلت. يرجى مراجعة الأخطاء أعلاه.\n');
        process.exit(1);
    }
}

testContractsAPI();
