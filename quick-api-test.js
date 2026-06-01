const http = require('http');

// اختبار سريع للـ API
function testAPI(path, method = 'GET') {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        resolve({ status: res.statusCode, data: data });
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.end();
  });
}

async function runQuickTests() {
  console.log('🔍 اختبار سريع للـ APIs...\n');

  const tests = [
    { name: 'Health Check', path: '/api/health' },
    { name: 'Hierarchy Stats', path: '/api/hierarchy/stats' },
    { name: 'HeadQuarters', path: '/api/headquarters' },
    { name: 'Branches', path: '/api/branches' },
    { name: 'Incubators', path: '/api/incubators' },
    { name: 'Platforms', path: '/api/platforms' },
    { name: 'Offices', path: '/api/offices' }
  ];

  for (const test of tests) {
    try {
      const result = await testAPI(test.path);
      const status = result.status === 200 ? '✅' : '❌';
      console.log(`${status} ${test.name}: HTTP ${result.status}`);
      
      if (test.name === 'Hierarchy Stats' && result.status === 200) {
        const stats = JSON.parse(result.data);
        console.log(`   📊 إحصائيات:`);
        console.log(`      - مقرات: ${stats.active_hqs}`);
        console.log(`      - فروع: ${stats.active_branches}`);
        console.log(`      - حاضنات: ${stats.active_incubators}`);
        console.log(`      - منصات: ${stats.active_platforms}`);
        console.log(`      - مكاتب: ${stats.active_offices}`);
        console.log(`      - روابط: ${stats.active_links}`);
      }
    } catch (error) {
      console.log(`❌ ${test.name}: ${error.message}`);
    }
  }

  console.log('\n✅ اختبار APIs مكتمل!');
  process.exit(0);
}

// انتظر قليلاً قبل البدء
setTimeout(runQuickTests, 2000);
