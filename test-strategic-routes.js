// اختبار شامل لجميع routes الإدارة الاستراتيجية
const http = require('http');

const testRoutes = [
    { name: 'الإدارة التنفيذية', route: 'executive-management', api: '/api/executive-kpis' },
    { name: 'الأنظمة الذكية', route: 'smart-systems', api: '/api/digital-marketing' },
    { name: 'إدارة الاشتراكات', route: 'subscription-management', api: '/api/subscription-tiers' },
    { name: 'الموافقات المالية', route: 'financial-approvals', api: '/api/approval-workflows' },
    { name: 'التدريب والتطوير', route: 'training-development', api: '/api/training-programs' },
    { name: 'الجودة والتدقيق', route: 'quality-audit', api: '/api/quality-audits' },
    { name: 'التقييم', route: 'evaluation', api: '/api/evaluations' },
    { name: 'مركز المعلومات', route: 'information-center', api: '/api/information-resources' }
];

console.log('🧪 بدء اختبار routes الإدارة الاستراتيجية\n');

async function testAPI(path) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'localhost',
            port: 3000,
            path: path,
            method: 'GET'
        };

        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    resolve({ success: true, count: json.length || 0 });
                } catch (e) {
                    resolve({ success: false, error: 'Invalid JSON' });
                }
            });
        });

        req.on('error', (e) => {
            resolve({ success: false, error: e.message });
        });

        req.setTimeout(5000, () => {
            req.destroy();
            resolve({ success: false, error: 'Timeout' });
        });

        req.end();
    });
}

async function runTests() {
    console.log('📡 اختبار الـ APIs:\n');
    
    for (const test of testRoutes) {
        const result = await testAPI(test.api);
        if (result.success) {
            console.log(`✅ ${test.name}: ${result.count} records`);
        } else {
            console.log(`❌ ${test.name}: ${result.error}`);
        }
    }
    
    console.log('\n✅ انتهى الاختبار');
    process.exit(0);
}

// انتظر ثانيتين للتأكد من أن السيرفر يعمل
setTimeout(runTests, 2000);
