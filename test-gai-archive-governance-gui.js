'use strict';
/**
 * GUI E2E: archive hub (2 cards) + GAI document governance section.
 */
const fs = require('fs');
const path = require('path');
const http = require('http');
const puppeteer = require('puppeteer-core');

const BASE = process.env.GAI_GUI_BASE || 'http://127.0.0.1:3010';
const OUT = '/opt/cursor/artifacts/gai-archive';
const EMAIL = process.env.IPP_GUI_EMAIL || 'admin@naiosh.com';
const PASSWORD = process.env.IPP_GUI_PASSWORD || 'Admin@123';

fs.mkdirSync(OUT, { recursive: true });

const results = [];
function record(name, pass, detail) {
  const status = pass ? 'PASS' : 'FAIL';
  results.push({ name, status, detail: detail || null });
  console.log(`${status} ${name}${detail ? ' — ' + detail : ''}`);
}

function postJson(urlPath, body) {
  return new Promise((resolve, reject) => {
    const u = new URL(urlPath, BASE);
    const payload = JSON.stringify(body);
    const req = http.request({
      hostname: u.hostname,
      port: u.port || 80,
      path: u.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    }, (res) => {
      let raw = '';
      res.on('data', (c) => { raw += c; });
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(raw); } catch { /* */ }
        resolve({ status: res.statusCode, json, raw });
      });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

async function injectSession(page, token, user) {
  await page.goto(`${BASE}/dashboard.html`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.evaluate((t, u) => {
    localStorage.setItem('authToken', t);
    sessionStorage.setItem('authToken', t);
    localStorage.setItem('user', JSON.stringify(u));
    sessionStorage.setItem('user', JSON.stringify(u));
    document.cookie = `authToken=${encodeURIComponent(t)}; path=/`;
  }, token, user);
}

async function main() {
  const login = await postJson('/api/auth/login', { email: EMAIL, password: PASSWORD });
  if (!login.json?.success) {
    record('login', 'FAIL', login.raw?.slice(0, 300));
    process.exit(1);
  }
  const session = login.json.data.session;
  const token = (session && typeof session === 'object' ? session.token : session)
    || login.json.data.token
    || login.json.token;
  const user = login.json.data.user;
  if (!token) {
    record('login-token', 'FAIL', 'missing token');
    process.exit(1);
  }
  record('login', 'PASS', user.email || user.username);

  const browser = await puppeteer.launch({
    executablePath: process.env.CHROME_PATH || '/usr/local/bin/google-chrome',
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1440,900']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  try {
    await injectSession(page, token, user);

    // --- Archive hub: exactly 2 cards ---
    await page.goto(`${BASE}/archive`, { waitUntil: 'networkidle2', timeout: 60000 });
    await new Promise((r) => setTimeout(r, 1500));
    // Wait for hub permission filter to settle, then read visible cards
    await page.waitForSelector('#archive-cards', { timeout: 15000 });
    await new Promise((r) => setTimeout(r, 2500));
    const archiveInfo = await page.evaluate(() => {
      const container = document.getElementById('archive-cards');
      const all = Array.from(container ? container.querySelectorAll('a[href]') : []);
      const links = all
        .filter((a) => {
          if (a.getAttribute('data-hub-hidden') === 'true') return false;
          const style = window.getComputedStyle(a);
          return style.display !== 'none' && style.visibility !== 'hidden';
        })
        .map((a) => ({
          href: a.getAttribute('href'),
          label: (a.querySelector('.flex-1') || a).textContent.replace(/\s+/g, ' ').trim()
        }));
      const text = document.body.innerText || '';
      return {
        path: location.pathname,
        links,
        allCount: all.length,
        hasEArchiveText: text.includes('الأرشفة الإلكترونية'),
        hasMailText: text.includes('إدارة مراسلات الصادر والوارد'),
        hasOcrText: text.includes('حزمة OCR') || text.includes('ocr-suite'),
        textSample: text.slice(0, 400)
      };
    });
    record('archive-open', archiveInfo.path.includes('archive') || archiveInfo.hasEArchiveText, archiveInfo.path);
    record('archive-two-cards', archiveInfo.links.length === 2 || (archiveInfo.hasEArchiveText && archiveInfo.hasMailText && !archiveInfo.hasOcrText && archiveInfo.allCount === 2),
      JSON.stringify({ links: archiveInfo.links, allCount: archiveInfo.allCount }));
    record('archive-has-e-archive', archiveInfo.links.some((l) => String(l.href).includes('e-archive')) || archiveInfo.hasEArchiveText);
    record('archive-has-mail', archiveInfo.links.some((l) => String(l.href).includes('inbound-outbound-mail')) || archiveInfo.hasMailText);
    record('archive-no-ocr', !archiveInfo.links.some((l) => String(l.href).includes('ocr')) && !archiveInfo.hasOcrText);
    await page.screenshot({ path: path.join(OUT, '02-archive-after-two-cards.png'), fullPage: true });

    // Click e-archive card
    const eArchiveHandle = await page.$('#archive-cards a[href*="e-archive"]')
      || await page.$('a[href*="e-archive"]');
    if (eArchiveHandle) {
      await Promise.all([
        page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 60000 }).catch(() => null),
        eArchiveHandle.click()
      ]);
      await new Promise((r) => setTimeout(r, 800));
      record('open-e-archive', /e-archive/.test(page.url()), page.url());
      await page.screenshot({ path: path.join(OUT, '02b-e-archive-from-hub.png'), fullPage: false });
      await page.goBack({ waitUntil: 'networkidle2' }).catch(() => null);
    } else {
      record('open-e-archive', false, 'link not found');
    }

    // --- GAI page ---
    await page.goto(`${BASE}/governed-administrative-integration`, { waitUntil: 'networkidle2', timeout: 60000 });
    await page.waitForFunction(() => document.body.innerText.includes('التكامل الإداري المحكوم'), { timeout: 30000 }).catch(() => null);
    await new Promise((r) => setTimeout(r, 2000));
    // Force SPA route if still on dashboard shell
    await page.evaluate(() => {
      if (typeof window.app?.loadRoute === 'function') {
        window.app.loadRoute('governed-administrative-integration');
      }
    });
    await new Promise((r) => setTimeout(r, 1500));
    const gaiInfo = await page.evaluate(() => {
      const root = document.getElementById('content') || document.body;
      const text = root.innerText || '';
      const docs = document.getElementById('gai-docs-governance');
      const finance = document.getElementById('gai-finance-governance');
      const hr = document.getElementById('gai-hr-governance');
      const docLinks = docs
        ? Array.from(docs.querySelectorAll('a[href]')).map((a) => ({
          href: a.getAttribute('href'),
          label: (a.querySelector('.flex-1') || a).textContent.replace(/\s+/g, ' ').trim()
        }))
        : [];
      return {
        path: location.pathname,
        hasTitle: text.includes('التكامل الإداري المحكوم'),
        hasDocs: text.includes('حوكمة الوثائق والإجراءات'),
        hasFinance: text.includes('الحوكمة المالية والإجراءات'),
        hasHr: text.includes('حوكمة الموارد البشرية'),
        placeholderCount: (text.match(/سيتم تحديد صفحات هذا القسم لاحقًا/g) || []).length,
        docLinkCount: docLinks.length,
        docLinks,
        financeHasLinks: finance ? finance.querySelectorAll('a[href]').length : -1,
        hrHasLinks: hr ? hr.querySelectorAll('a[href]').length : -1
      };
    });
    record('gai-open', gaiInfo.hasTitle, gaiInfo.path);
    record('gai-docs-section', gaiInfo.hasDocs);
    record('gai-finance-section', gaiInfo.hasFinance);
    record('gai-hr-section', gaiInfo.hasHr);
    record('gai-doc-cards-14', gaiInfo.docLinkCount === 14, `count=${gaiInfo.docLinkCount}`);
    record('gai-placeholders', gaiInfo.placeholderCount >= 2, `count=${gaiInfo.placeholderCount}`);
    record('gai-finance-empty', gaiInfo.financeHasLinks === 0);
    record('gai-hr-empty', gaiInfo.hrHasLinks === 0);
    await page.screenshot({ path: path.join(OUT, '03-gai-docs-governance.png'), fullPage: true });

    // Click OCR card
    const ocrSel = '#gai-docs-governance a[href*="ocr-suite"]';
    if (await page.$(ocrSel)) {
      await Promise.all([
        page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 60000 }).catch(() => null),
        page.click(ocrSel)
      ]);
      await new Promise((r) => setTimeout(r, 1000));
      record('open-ocr-from-gai', /ocr-suite/.test(page.url()), page.url());
      await page.screenshot({ path: path.join(OUT, '04-ocr-page-from-gai.png'), fullPage: false });
    } else {
      record('open-ocr-from-gai', 'FAIL', 'selector missing');
    }

    // Deep link old path still works
    await page.goto(`${BASE}/hr/workflow-engine`, { waitUntil: 'networkidle2', timeout: 60000 });
    await new Promise((r) => setTimeout(r, 800));
    record('deep-link-workflow', /workflow-engine/.test(page.url()) && !/login/.test(page.url()), page.url());
    await page.screenshot({ path: path.join(OUT, '05-workflow-deep-link.png'), fullPage: false });

    // Back to GAI via SPA
    await page.goto(`${BASE}/governed-administrative-integration`, { waitUntil: 'networkidle2', timeout: 60000 });
    await page.evaluate(() => window.app?.loadRoute?.('governed-administrative-integration'));
    await new Promise((r) => setTimeout(r, 1200));
    const backOk = await page.evaluate(() => document.body.innerText.includes('حوكمة الوثائق والإجراءات'));
    record('nav-back-gai', backOk);
  } catch (err) {
    record('suite-error', 'FAIL', err.message);
  } finally {
    await browser.close();
  }

  const failed = results.filter((r) => r.status === 'FAIL');
  const report = { passed: results.length - failed.length, total: results.length, results };
  fs.writeFileSync(path.join(OUT, 'gui-results.json'), JSON.stringify(report, null, 2));
  console.log('\n=== GAI Archive GUI ===');
  console.log('passed:', report.passed, '/', report.total);
  if (failed.length) {
    failed.forEach((f) => console.log(' -', f.name, f.detail));
    process.exit(1);
  }
  console.log('VERDICT: GO');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
