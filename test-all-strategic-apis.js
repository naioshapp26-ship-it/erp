// اختبار APIs الإدارة الاستراتيجية من السيرفر مباشرة
const http = require('http');

const APIs = [
    '/api/executive-kpis',
    '/api/executive-goals',
    '/api/executive-operations',
    '/api/digital-marketing',
    '/api/community-marketing',
    '/api/event-marketing',
    '/api/training-courses',
    '/api/skills',
    '/api/financial-policies',
    '/api/financial-manual',
    '/api/financial-news',
    '/api/development-programs',
    '/api/quality-standards',
    '/api/quality-audits',
    '/api/evaluations',
    '/api/information-repository',
    '/api/knowledge-base'
];

console.log('🧪 اختبار جميع APIs الإدارة الاستراتيجية\n');

function testAPI(path) {
    return new Promise((resolve) => {
        const options = {
            hostname: 'localhost',
            port: 3000,
            path: path,
            method: 'GET',
            headers: {
                'Accept': 'application/json'
            }
        };

        const req = http.request(options, (res) => {
            let data = '';
            
            res.on('data', (chunk) => {
                data += chunk;
            });
            
            res.on('end', () => {
                const contentType = res.headers['content-type'] || '';
                
                if (res.statusCode === 200) {
                    if (contentType.includes('application/json')) {
                        try {
                            const json = JSON.parse(data);
                            const count = Array.isArray(json) ? json.length : 'object';
                            console.log(`✅ ${path}: ${count} ${Array.isArray(json) ? 'items' : ''}`);
                            resolve({ success: true, count });
                        } catch (e) {
                            console.log(`❌ ${path}: JSON parse error - ${e.message}`);
                            console.log(`   Response starts with: ${data.substring(0, 100)}`);
                            resolve({ success: false, error: 'Invalid JSON' });
                        }
                    } else {
                        console.log(`❌ ${path}: Wrong content-type: ${contentType}`);
                        console.log(`   Response starts with: ${data.substring(0, 100)}`);
                        resolve({ success: false, error: `Wrong content-type: ${contentType}` });
                    }
                } else {
                    console.log(`❌ ${path}: HTTP ${res.statusCode}`);
                    console.log(`   Response: ${data.substring(0, 200)}`);
                    resolve({ success: false, error: `HTTP ${res.statusCode}` });
                }
            });
        });

        req.on('error', (e) => {
            console.log(`❌ ${path}: Request failed - ${e.message}`);
            resolve({ success: false, error: e.message });
        });

        req.setTimeout(5000, () => {
            req.destroy();
            console.log(`❌ ${path}: Timeout`);
            resolve({ success: false, error: 'Timeout' });
        });

        req.end();
    });
}

async function runTests() {
    console.log('📡 اختبار الاتصال بالسيرفر...\n');
    
    let successCount = 0;
    let failCount = 0;
    
    for (const api of APIs) {
        const result = await testAPI(api);
        if (result.success) {
            successCount++;
        } else {
            failCount++;
        }
    }
    
    console.log('\n' + '='.repeat(50));
    console.log(`📊 النتائج: ${successCount} ✅  |  ${failCount} ❌`);
    console.log('='.repeat(50));
    
    if (failCount > 0) {
        console.log('\n⚠️  بعض الـ APIs لا تعمل! تحقق من:');
        console.log('   1. هل السيرفر يعمل؟');
        console.log('   2. هل الجداول موجودة في قاعدة البيانات؟');
        console.log('   3. هل الـ routes مُعرفة في server.js؟');
    } else {
        console.log('\n✅ جميع الـ APIs تعمل بنجاح!');
    }
    
    process.exit(failCount > 0 ? 1 : 0);
}

// انتظر ثانيتين للتأكد من أن السيرفر جاهز
setTimeout(runTests, 2000);
