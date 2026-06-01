const { chromium } = require('playwright');
const { spawn } = require('child_process');
const path = require('path');

const startServer = () => {
  return new Promise((resolve, reject) => {
    const serverProcess = spawn('node', ['server.js'], {
      cwd: path.join(__dirname, '..'),
      env: { ...process.env },
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let isReady = false;

    const handleStdout = data => {
      const text = data.toString();
      process.stdout.write(text);
      if (!isReady && text.includes('Server is ready to accept connections')) {
        isReady = true;
        resolve(serverProcess);
      }
    };

    serverProcess.stdout.on('data', handleStdout);
    serverProcess.stderr.on('data', data => process.stderr.write(data.toString()));

    serverProcess.on('error', reject);
    serverProcess.on('exit', code => {
      if (!isReady) {
        reject(new Error(`Server exited before it was ready (code ${code})`));
      }
    });
  });
};

const stopServer = async serverProcess => {
  if (!serverProcess || serverProcess.killed) return;
  return new Promise(resolve => {
    serverProcess.once('exit', () => resolve());
    serverProcess.kill('SIGINT');
    setTimeout(() => {
      if (!serverProcess.killed) {
        serverProcess.kill('SIGTERM');
      }
    }, 5000);
  });
};

const run = async () => {
  const serverProcess = await startServer();
  let browser;
  const loginEmail = process.env.PLAYWRIGHT_EMAIL || 'branch@nayosh.com';
  const loginPassword = process.env.PLAYWRIGHT_PASSWORD || 'demo123';
  const strategicRoutes = [
    'smart-systems',
    'subscription-management',
    'financial-approvals',
    'training-development',
    'quality-audit',
    'evaluation',
    'information-center'
  ];

  try {
    browser = await chromium.launch({
      channel: 'chromium',
      headless: true,
      args: ['--disable-gpu', '--disable-dev-shm-usage', '--no-sandbox']
    });
    const page = await browser.newPage();
    const events = [];

    page.on('console', msg => {
      const type = msg.type();
      if (['error', 'warning'].includes(type)) {
        events.push({ type: 'console', level: type, text: msg.text() });
      }
    });

    page.on('pageerror', error => {
      events.push({ type: 'pageerror', message: error.message, stack: error.stack });
    });

    await page.goto('http://127.0.0.1:3000/login-page.html', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#loginForm', { timeout: 15000 });
    await page.fill('#email', loginEmail);
    await page.fill('#password', loginPassword);
    await Promise.all([
      page.waitForURL('**/index.html', { timeout: 20000 }),
      page.click('#loginBtn')
    ]);

    await page.waitForSelector('#nav-menu', { timeout: 20000 });

    const strategicButtonSelector = 'button[onclick="app.toggleSubmenu(\'strategic-management\')"]';
    await page.click(strategicButtonSelector);

    for (const route of strategicRoutes) {
      const linkSelector = `a[href="#${route}"]`;
      await page.waitForSelector(linkSelector, { timeout: 5000 });
      await page.click(linkSelector);
      await page.waitForTimeout(1000);
    }

    console.log(JSON.stringify(events, null, 2));
  } finally {
    if (browser) {
      await browser.close();
    }
    await stopServer(serverProcess);
  }
};

run().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
