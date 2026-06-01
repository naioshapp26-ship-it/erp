const API_BASE = process.env.API_BASE || 'http://localhost:3000';
const ENTITY_ID = process.env.ENTITY_ID || 'HQ001';

async function testFranchiseAgenciesAPI() {
    console.log('🧪 اختبار واجهات وكالات الفرنشايز\n');

    const tests = [
        {
            name: 'العملاء',
            endpoint: `/finance/customers?entity_id=${ENTITY_ID}`,
            description: 'جلب بيانات العملاء'
        },
        {
            name: 'الفواتير',
            endpoint: `/finance/invoices?limit=50&entity_id=${ENTITY_ID}`,
            description: 'جلب جميع الفواتير'
        },
        {
            name: 'المدفوعات',
            endpoint: `/finance/payments?limit=50&entity_id=${ENTITY_ID}`,
            description: 'جلب جميع المدفوعات'
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

    try {
        console.log('🛠️ اختبار إنشاء/تعديل/حذف وكالة تجريبية');
        const createRes = await fetch(`${API_BASE}/finance/customers`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-entity-id': ENTITY_ID },
            body: JSON.stringify({
                customer_name_ar: 'وكالة اختبار ميدانية',
                customer_code: `TEST-${Date.now()}`,
                city: 'الرياض',
                credit_limit: 25000,
                credit_period_days: 30,
                entity_id: ENTITY_ID
            })
        });
        if (!createRes.ok) throw new Error('فشل إنشاء الوكالة');
        const created = await createRes.json();
        const newId = created.customer?.customer_id || created.customer_id || created.id;
        console.log(`   ✅ تم إنشاء الوكالة ID=${newId}`);

        const updateRes = await fetch(`${API_BASE}/finance/customers/${newId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'x-entity-id': ENTITY_ID },
            body: JSON.stringify({
                customer_name_ar: 'وكالة اختبار محدثة',
                entity_id: ENTITY_ID,
                risk_level: 'LOW'
            })
        });
        if (!updateRes.ok) throw new Error('فشل تحديث الوكالة');
        console.log('   ✅ تم تحديث بيانات الوكالة');

        const deleteRes = await fetch(`${API_BASE}/finance/customers/${newId}?entity_id=${ENTITY_ID}`, {
            method: 'DELETE',
            headers: { 'x-entity-id': ENTITY_ID }
        });
        if (!deleteRes.ok) throw new Error('فشل حذف الوكالة');
        console.log('   ✅ تم حذف الوكالة التجريبية');
    } catch (err) {
        console.error(`   ❌ فشل اختبار CRUD: ${err.message}`);
    }

    if (passedTests === tests.length) {
        console.log('🎉 جميع اختبارات وكالات الفرنشايز نجحت!\n');
        process.exit(0);
    } else {
        console.log('⚠️ بعض الاختبارات فشلت. يرجى مراجعة الأخطاء أعلاه.\n');
        process.exit(1);
    }
}

testFranchiseAgenciesAPI();
