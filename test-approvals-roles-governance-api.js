const API_BASE = 'http://localhost:3000';

async function testApprovalsRolesGovernanceAPI() {
    console.log('🧪 اختبار واجهات الموافقات والصلاحيات والحوكمة\n');

    const tests = [
        {
            name: 'الأدوار',
            endpoint: '/api/permissions/roles',
            description: 'جلب جميع الأدوار من النظام'
        },
        {
            name: 'إحصائيات الصلاحيات',
            endpoint: '/api/permissions/stats',
            description: 'جلب إحصائيات الأدوار والصلاحيات'
        },
        {
            name: 'مصفوفة الصلاحيات',
            endpoint: '/api/permissions/matrix',
            description: 'جلب مصفوفة الصلاحيات الكاملة'
        },
        {
            name: 'مستويات الصلاحيات',
            endpoint: '/api/permissions/levels',
            description: 'جلب مستويات الصلاحيات'
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
            console.log(`   ✅ نجح - استلام البيانات`);
            
            const dataArray = data.roles || data.permissions || data.rows || [];
            console.log(`   📊 عدد الصفوف: ${dataArray.length}`);
            
            if (dataArray.length > 0) {
                console.log(`   📄 عينة من البيانات:`, JSON.stringify(dataArray[0], null, 2).substring(0, 200));
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
    console.log(`📊 نسبة النجاح: ${((passedTests/tests.length)*100).toFixed(1)}%`);
    console.log('═══════════════════════════════════════\n');

    if (passedTests === tests.length) {
        console.log('🎉 جميع اختبارات واجهة الموافقات والصلاحيات نجحت!\n');
        process.exit(0);
    } else {
        console.log('⚠️ بعض الاختبارات فشلت. يرجى مراجعة الأخطاء أعلاه.\n');
        process.exit(1);
    }
}

testApprovalsRolesGovernanceAPI();
