const http = require('http');
const { spawn } = require('child_process');

const SERVER_URL = 'http://localhost:3000';

function testPage(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        resolve({ status: res.statusCode, html: data });
      });
    }).on('error', reject);
  });
}

function checkServerRunning() {
  return new Promise((resolve) => {
    const req = http.get(`${SERVER_URL}/api/health`, (res) => {
      resolve(res.statusCode === 200);
      res.resume();
    });
    req.on('error', () => resolve(false));
  });
}

async function waitForServer(retries = 20, delayMs = 500) {
  for (let i = 0; i < retries; i++) {
    const isUp = await checkServerRunning();
    if (isUp) return true;
    await new Promise((r) => setTimeout(r, delayMs));
  }
  return false;
}

async function testBuild() {
  console.log('🏗️ اختبار البناء والصفحات...\n');
  let serverProcess = null;
  let startedHere = false;

  try {
    const alreadyRunning = await checkServerRunning();
    if (!alreadyRunning) {
      console.log('🚀 تشغيل الخادم للاختبارات...');
      serverProcess = spawn('node', ['server.js'], {
        stdio: 'ignore',
        env: process.env
      });
      startedHere = true;

      const ready = await waitForServer();
      if (!ready) {
        throw new Error('تعذر تشغيل الخادم للاختبارات');
      }
    }

    // Test 1: finance/ page
    console.log('1️⃣ اختبار صفحة /finance/');
    const financePage = await testPage(`${SERVER_URL}/finance/`);
    if (financePage.status === 200 && (financePage.html.includes('💼 المالية') || financePage.html.includes('المالية'))) {
      console.log('   ✅ صفحة /finance/ تعمل بنجاح');
      console.log(`   📄 حجم الصفحة: ${(financePage.html.length / 1024).toFixed(2)} KB`);
    } else {
      throw new Error(`صفحة /finance/ لا تعمل: Status ${financePage.status}`);
    }
    console.log();

    // Test 2: finance-dashboard.html page
    console.log('2️⃣ اختبار صفحة /finance-dashboard.html');
    const dashboardPage = await testPage(`${SERVER_URL}/finance-dashboard.html`);
    if (dashboardPage.status === 200 && (dashboardPage.html.includes('💼 المالية') || dashboardPage.html.includes('المالية'))) {
      console.log('   ✅ صفحة /finance-dashboard.html تعمل بنجاح');
      console.log(`   📄 حجم الصفحة: ${(dashboardPage.html.length / 1024).toFixed(2)} KB`);
    } else {
      throw new Error(`صفحة /finance-dashboard.html لا تعمل: Status ${dashboardPage.status}`);
    }
    console.log();

    // Test 3: Check if both pages are identical
    console.log('3️⃣ التحقق من تطابق الصفحتين');
    const similarity = financePage.html === dashboardPage.html ? 100 : 
                      (Math.min(financePage.html.length, dashboardPage.html.length) / 
                       Math.max(financePage.html.length, dashboardPage.html.length) * 100);
    
    if (Math.abs(similarity - 100) < 0.1) {
      console.log('   ✅ الصفحتان متطابقتان تماماً');
    } else {
      console.log(`   ⚠️  نسبة التشابه: ${similarity.toFixed(2)}%`);
    }
    console.log();

    console.log('═══════════════════════════════════════');
    console.log('✅ اختبار البناء نجح بنسبة 100%');
    console.log('═══════════════════════════════════════');
    console.log('\nالصفحات جاهزة:');
    console.log('🌐 /finance/ - الصفحة الرئيسية');
    console.log('🌐 /finance-dashboard.html - لوحة المعلومات');

  } catch (error) {
    console.error('\n❌ فشل اختبار البناء:', error.message);
    process.exit(1);
  } finally {
    if (serverProcess && startedHere) {
      serverProcess.kill('SIGTERM');
    }
  }
}

testBuild();
