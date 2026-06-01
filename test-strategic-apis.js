// اختبار جميع APIs الخاصة بالإدارة الاستراتيجية
const fetch = require('node-fetch');

const BASE_URL = 'http://localhost:3000/api';

async function testAPIs() {
    console.log('🧪 بدء اختبار APIs الإدارة الاستراتيجية\n');
    console.log('=' .repeat(60));

    const endpoints = [
        { name: 'مؤشرات الأداء التنفيذي', url: '/executive-kpis' },
        { name: 'الأهداف التنفيذية', url: '/executive-goals' },
        { name: 'العمليات التنفيذية', url: '/executive-operations' },
        { name: 'التسويق الإلكتروني', url: '/digital-marketing' },
        { name: 'التسويق المجتمعي', url: '/community-marketing' },
        { name: 'التسويق عبر الفعاليات', url: '/event-marketing' },
        { name: 'الدورات التدريبية', url: '/training-courses' },
        { name: 'المهارات', url: '/skills' },
        { name: 'السياسات المالية', url: '/financial-policies' },
        { name: 'دليل التشغيل المالي', url: '/financial-manual' },
        { name: 'الأخبار المالية', url: '/financial-news' },
        { name: 'البرامج التطويرية', url: '/development-programs' },
        { name: 'معايير الجودة', url: '/quality-standards' },
        { name: 'عمليات التدقيق', url: '/quality-audits' },
        { name: 'التقييمات', url: '/evaluations' },
        { name: 'مستودع المعلومات', url: '/information-repository' },
        { name: 'قاعدة المعرفة', url: '/knowledge-base' }
    ];

    let passed = 0;
    let failed = 0;

    for (const endpoint of endpoints) {
        try {
            const response = await fetch(`${BASE_URL}${endpoint.url}`);
            
            if (!response.ok) {
                console.log(`❌ ${endpoint.name}: فشل (Status: ${response.status})`);
                failed++;
                continue;
            }

            const data = await response.json();
            console.log(`✅ ${endpoint.name}: نجح (${data.length} سجل)`);
            passed++;

            // عرض مثال من البيانات
            if (data.length > 0) {
                const sample = data[0];
                const keys = Object.keys(sample).slice(0, 3);
                console.log(`   مثال: ${keys.map(k => `${k}=${sample[k]}`).join(', ')}`);
            }

        } catch (error) {
            console.log(`❌ ${endpoint.name}: خطأ - ${error.message}`);
            failed++;
        }

        console.log('');
    }

    console.log('=' .repeat(60));
    console.log(`\n📊 ملخص الاختبارات:`);
    console.log(`   ✅ نجح: ${passed}`);
    console.log(`   ❌ فشل: ${failed}`);
    console.log(`   📈 النسبة: ${((passed / endpoints.length) * 100).toFixed(1)}%`);

    if (failed === 0) {
        console.log('\n🎉 جميع الاختبارات نجحت!');
    } else {
        console.log(`\n⚠️  ${failed} اختبار فشل. يرجى المراجعة.`);
    }
}

// تأكد من تشغيل الخادم أولاً
setTimeout(() => {
    testAPIs().catch(error => {
        console.error('خطأ في التشغيل:', error);
        process.exit(1);
    });
}, 2000); // انتظر ثانيتين للتأكد من تشغيل الخادم
