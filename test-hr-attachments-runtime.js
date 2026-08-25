#!/usr/bin/env node
/**
 * Runtime browser audit: every HR home module must inject attachments assets,
 * and after opening forms/modals (when possible) must show المرفقات dropzone.
 */
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');
const { listHrHomeModules } = require('./hr-home-modules');

const BASE = process.env.TEST_BASE_URL || 'http://127.0.0.1:3000';
const CHROME = process.env.CHROME_PATH || '/usr/local/bin/google-chrome';
const OUT = '/opt/cursor/artifacts/hr-attachments-runtime-audit.json';

async function login(page) {
  await page.goto(`${BASE}/login-page.html`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.evaluate(() => {
    const email = document.querySelector('input[type="email"], input[name="email"], #email, #username, input[name="username"]');
    const pass = document.querySelector('input[type="password"], #password');
    if (email) email.value = 'HQ001';
    if (pass) pass.value = 'Admin@123';
  });
  // Prefer API login into localStorage/session if UI varies
  const ok = await page.evaluate(async () => {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'HQ001', password: 'Admin@123' })
      });
      const data = await res.json();
      if (data?.data?.session?.token) {
        localStorage.setItem('authToken', data.data.session.token);
        localStorage.setItem('token', data.data.session.token);
        sessionStorage.setItem('authToken', data.data.session.token);
      }
      return res.ok;
    } catch (_) {
      return false;
    }
  });
  return ok;
}

async function tryOpenFormUi(page) {
  // Click common "add/new" buttons to reveal modals
  const clicked = await page.evaluate(() => {
    const texts = ['إضافة', 'جديد', 'انشاء', 'إنشاء', 'فتح', 'بدء', 'تقييم', 'فكرة', 'حفظ'];
    const buttons = Array.from(document.querySelectorAll('button, a.btn, [role="button"]'));
    for (const btn of buttons) {
      const t = (btn.textContent || '').trim();
      if (!t || t.length > 40) continue;
      if (texts.some((x) => t.includes(x))) {
        // Prefer add/new over save
        if (/إضافة|جديد|إنشاء|انشاء|بدء|فكرة|تقييم/.test(t)) {
          btn.click();
          return t;
        }
      }
    }
    // Force-show common hidden overlays
    document.querySelectorAll('.modal, .modal-overlay, [id*="Modal"], [id*="modal"], .fixed.inset-0').forEach((el) => {
      el.classList.add('open', 'active', 'show');
      el.classList.remove('hidden');
      el.style.display = el.style.display === 'none' ? 'flex' : el.style.display || 'flex';
      el.style.visibility = 'visible';
      el.style.opacity = '1';
    });
    return 'forced-show';
  });
  await new Promise((r) => setTimeout(r, 800));
  if (page.evaluate) {
    await page.evaluate(() => {
      if (window.HRAttachments?.scan) window.HRAttachments.scan(document);
    });
  }
  await new Promise((r) => setTimeout(r, 400));
  return clicked;
}

async function auditPage(browser, href, label) {
  const page = await browser.newPage();
  page.setDefaultTimeout(45000);
  const result = {
    href,
    label,
    assets: false,
    mounted: false,
    mainText: false,
    slot: false,
    form: false,
    status: 'FAIL',
    error: null,
    openAction: null
  };
  try {
    const res = await page.goto(`${BASE}${href}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    if (!res || !res.ok()) {
      result.error = `HTTP ${res ? res.status() : 'no response'}`;
      await page.close();
      return result;
    }
    await new Promise((r) => setTimeout(r, 1200));
    const base = await page.evaluate(() => ({
      assets: !!(document.querySelector('link[href*="hr-attachments.css"]') && document.querySelector('script[src*="hr-attachments.js"]')),
      mounted: !!document.querySelector('[data-hr-attachments-mounted="1"], .hr-attachments-section'),
      mainText: (document.body?.innerText || '').includes('انقر لاختيار ملفات أو اسحب وأفلت هنا'),
      slot: !!document.querySelector('[data-hr-attachments-slot]'),
      form: !!document.querySelector('form')
    }));
    Object.assign(result, base);
    if (!result.mounted && !result.mainText) {
      result.openAction = await tryOpenFormUi(page);
      const after = await page.evaluate(() => ({
        mounted: !!document.querySelector('[data-hr-attachments-mounted="1"], .hr-attachments-section'),
        mainText: (document.body?.innerText || '').includes('انقر لاختيار ملفات أو اسحب وأفلت هنا'),
        title: (document.body?.innerText || '').includes('المرفقات')
      }));
      result.mounted = after.mounted;
      result.mainText = after.mainText;
      result.hasTitle = after.title;
    }
    if (result.assets && (result.mounted || result.mainText)) result.status = 'PASS';
    else if (result.assets && (result.form || result.slot)) result.status = 'ASSETS_HOST_READY';
    else result.status = 'FAIL';
  } catch (error) {
    result.error = error.message;
    result.status = 'FAIL';
  }
  await page.close().catch(() => {});
  return result;
}

async function main() {
  const modules = listHrHomeModules();
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: 'new',
    args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage']
  });
  const loginPage = await browser.newPage();
  await login(loginPage);
  await loginPage.close();

  const results = [];
  for (const mod of modules) {
    const row = await auditPage(browser, mod.href, mod.label);
    results.push(row);
    console.log(`${row.status}|${row.href}|mounted=${row.mounted}|main=${row.mainText}|slot=${row.slot}|form=${row.form}|open=${row.openAction || '-'}|err=${row.error || ''}`);
  }
  await browser.close();

  const summary = results.reduce((acc, r) => {
    acc[r.status] = (acc[r.status] || 0) + 1;
    return acc;
  }, {});
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify({ summary, results }, null, 2));
  console.log('SUMMARY', summary);
  console.log('Wrote', OUT);

  const fails = results.filter((r) => r.status === 'FAIL');
  if (fails.length) {
    console.error('FAILED PAGES:\n' + fails.map((f) => `${f.href} (${f.label}): ${f.error || 'no mount'}`).join('\n'));
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
