const http = require('http');

function testAPI(endpoint, label) {
  return new Promise((resolve) => {
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: `/api${endpoint}`,
      method: 'GET'
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          console.log(`✅ ${label}: ${Array.isArray(json) ? json.length + ' سجل' : 'نجح'}`);
          if (Array.isArray(json) && json.length > 0) {
            console.log(`   مثال:`, json[0]);
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

    req.end();
  });
}

async function runTests() {
  console.log('🔄 جاري اختبار API endpoints...\n');

  await testAPI('/health', 'Health Check');
  await testAPI('/entities', 'Entities');
  await testAPI('/users', 'Users');
  await testAPI('/invoices', 'Invoices');
  await testAPI('/ads', 'Ads');
  await testAPI('/stats', 'Stats');

  console.log('\n✅ اكتملت الاختبارات!');
  process.exit(0);
}

runTests();
