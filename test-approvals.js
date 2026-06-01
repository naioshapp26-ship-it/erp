const http = require('http');

function testAPI(endpoint, label, method = 'GET', body = null) {
  return new Promise((resolve) => {
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: `/api${endpoint}`,
      method: method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          console.log(`✅ ${label}: ${Array.isArray(json) ? json.length + ' سجل' : json.success ? 'نجح' : 'نجح'}`);
          if (Array.isArray(json) && json.length > 0 && json.length <= 3) {
            console.log(`   عينة:`, JSON.stringify(json[0], null, 2).substring(0, 200) + '...');
          }
        } catch (e) {
          console.log(`⚠️  ${label}: ${data.substring(0, 100)}`);
        }
        resolve();
      });
    });

    req.on('error', (e) => {
      console.error(`❌ ${label}: ${e.message}`);
      resolve();
    });

    if (body) {
      req.write(JSON.stringify(body));
    }

    req.end();
  });
}

async function runTests() {
  console.log('🔄 جاري اختبار نظام الموافقات المالية...\n');

  // Basic endpoints
  await testAPI('/health', 'Health Check');
  
  console.log('\n📊 اختبار Endpoints الأساسية:');
  await testAPI('/entities', 'Entities');
  await testAPI('/users', 'Users');
  
  console.log('\n✅ اختبار نظام الموافقات:');
  await testAPI('/approvals', 'جميع الموافقات');
  await testAPI('/approvals?status=PENDING', 'الموافقات المعلقة');
  await testAPI('/approvals/1', 'موافقة محددة');
  
  console.log('\n🔔 اختبار نظام التنبيهات:');
  await testAPI('/notifications', 'جميع التنبيهات');
  await testAPI('/notifications?user_id=1', 'تنبيهات مستخدم محدد');
  await testAPI('/notifications?is_read=false', 'التنبيهات غير المقروءة');
  await testAPI('/notifications/unread-count?user_id=6', 'عدد التنبيهات غير المقروءة');

  console.log('\n✨ اكتملت جميع الاختبارات!');
  process.exit(0);
}

runTests();
