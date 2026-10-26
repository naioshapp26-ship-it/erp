'use strict';
const fs = require('fs');
const http = require('http');
const puppeteer = require('puppeteer-core');
const BASE = process.env.APP_BASE_URL || 'http://127.0.0.1:3083';
const ART = '/opt/cursor/artifacts';
const CHROME = process.env.CHROME_PATH || '/usr/local/bin/google-chrome';
fs.mkdirSync(ART, { recursive: true });

function httpReq(method, urlPath, body, headers = {}) {
  const u = new URL(urlPath, BASE);
  const payload = body == null ? null : JSON.stringify(body);
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: u.hostname, port: u.port || 80, path: u.pathname + u.search, method,
      headers: { 'Content-Type': 'application/json', ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}), ...headers }
    }, (res) => {
      let raw = '';
      res.on('data', (c) => { raw += c; });
      res.on('end', () => {
        let json = null;
        try { json = raw ? JSON.parse(raw) : null; } catch { /* */ }
        resolve({ status: res.statusCode, json, headers: res.headers });
      });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

(async () => {
  const login = await httpReq('POST', '/api/auth/login', { email: 'admin@naiosh.com', password: 'Admin@123' });
  const token = login.json?.data?.session?.token || '';
  const browser = await puppeteer.launch({
    executablePath: CHROME, headless: 'new',
    args: ['--no-sandbox', '--disable-gpu', '--window-size=1440,1100']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 1100 });
  await page.evaluateOnNewDocument((t) => {
    localStorage.setItem('authToken', t);
    sessionStorage.setItem('authToken', t);
  }, token);
  const pages = [
    ['/finance/vendor-quotes.html', 'wave2-quotes-desktop.png'],
    ['/finance/purchase-vendors.html', 'wave2-vendors-desktop.png'],
    ['/finance/purchase-receiving.html', 'wave2-receiving-desktop.png']
  ];
  for (const [path, file] of pages) {
    await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle2', timeout: 60000 });
    await page.waitForSelector('.fw-hero', { timeout: 20000 });
    await new Promise((r) => setTimeout(r, 900));
    await page.screenshot({ path: `${ART}/${file}`, fullPage: false });
  }
  await page.setViewport({ width: 390, height: 844 });
  await page.goto(`${BASE}/finance/vendor-quotes.html`, { waitUntil: 'networkidle2', timeout: 60000 });
  await new Promise((r) => setTimeout(r, 700));
  await page.screenshot({ path: `${ART}/wave2-quotes-mobile.png`, fullPage: false });
  await browser.close();
  console.log('captured', pages.map((p) => p[1]).join(', '));
})().catch((e) => { console.error(e); process.exit(1); });
