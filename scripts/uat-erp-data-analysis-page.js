/**
 * UAT: ERP «نايوش لتحليل البيانات» landing — nav, CTA, RTL, mobile, LAW visual compare.
 */
const fs = require('fs');
const path = require('path');
const http = require('http');

const BASE = process.env.APP_BASE_URL || 'http://127.0.0.1:3083';
const OUT = process.env.UAT_OUT || '/opt/cursor/artifacts';
const ANALYSIS = 'https://www.naioshai.com/';

function httpReq(method, urlPath, body, headers = {}) {
  const u = new URL(urlPath.startsWith('http') ? urlPath : BASE + urlPath);
  const payload = body == null ? null : Buffer.from(JSON.stringify(body));
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: u.hostname, port: u.port, path: u.pathname + u.search, method,
        headers: {
          ...(payload ? { 'Content-Type': 'application/json', 'Content-Length': payload.length } : {}),
          ...headers
        }
      },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const buf = Buffer.concat(chunks);
          let json = null;
          try { json = JSON.parse(buf.toString('utf8')); } catch { /* */ }
          resolve({ status: res.statusCode, ok: res.statusCode >= 200 && res.statusCode < 300, json, buf, headers: res.headers });
        });
      }
    );
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const report = { ok: true, steps: [], artifacts: [] };

  const pageGet = await httpReq('GET', '/data-analysis');
  const html = pageGet.buf.toString('utf8');
  report.steps.push({
    step: 'page_serves',
    ok: pageGet.status === 200 && html.includes('نايوش لتحليل البيانات') && html.includes('da-erp-hero'),
    status: pageGet.status
  });
  const primaryHrefs = [...html.matchAll(/da-erp-btn primary[\s\S]{0,180}?href="([^"]+)"/g)].map((m) => m[1]);
  report.steps.push({
    step: 'primary_cta_only_to_naioshai',
    ok: primaryHrefs.length >= 1
      && primaryHrefs.every((h) => h === ANALYSIS)
      && !/<a[^>]*>\s*تسجيل الدخول/.test(html)
      && !/يدعم SSO|مع SSO|ربط تلقائي ببيانات ERP/.test(html),
    primaryHrefs
  });
  report.steps.push({
    step: 'erp_domains_not_legal',
    ok: /المبيعات|المشتريات|الرواتب|المخزون/.test(html) && !/قضايا نشطة|جلسات قادمة|موكلين/.test(html)
  });

  const login = await httpReq('POST', '/api/auth/login', { email: 'admin@naiosh.com', password: 'Admin@123' });
  const token = login.json?.data?.session?.token;
  if (!token) throw new Error('login failed');

  const puppeteer = require('puppeteer-core');
  const browser = await puppeteer.launch({
    executablePath: process.env.CHROME_PATH || '/usr/local/bin/google-chrome',
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1440,900']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto(`${BASE}/login-page.html`, { waitUntil: 'domcontentloaded' });
  await page.evaluate((t) => {
    localStorage.setItem('authToken', t);
    sessionStorage.setItem('authToken', t);
  }, token);
  await page.setCookie({ name: 'authToken', value: token, domain: '127.0.0.1', path: '/' });

  // Dashboard nav contains the link
  await page.goto(`${BASE}/dashboard.html`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await new Promise((r) => setTimeout(r, 2500));
  const navHit = await page.evaluate(() => {
    const links = [...document.querySelectorAll('a, button, [data-route], [onclick]')];
    const hit = links.find((el) => /نايوش لتحليل البيانات/.test(el.textContent || ''));
    return {
      found: !!hit,
      text: hit ? (hit.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 80) : null,
      route: hit?.getAttribute('data-route') || hit?.getAttribute('href') || null
    };
  });
  report.steps.push({ step: 'nav_link_in_dashboard_sidebar', ok: navHit.found, ...navHit });
  const dashShot = path.join(OUT, 'erp-da-01-dashboard-nav.png');
  await page.screenshot({ path: dashShot, fullPage: false });
  report.artifacts.push(dashShot);

  // Open page
  await page.goto(`${BASE}/data-analysis`, { waitUntil: 'networkidle2', timeout: 60000 });
  await page.waitForSelector('.da-erp-hero__title', { timeout: 15000 });
  const meta = await page.evaluate((expected) => {
    const title = document.querySelector('.da-erp-hero__title')?.textContent?.trim();
    const ctas = [...document.querySelectorAll('a.da-erp-btn.primary')].map((a) => ({
      text: (a.textContent || '').trim(),
      href: a.getAttribute('href'),
      target: a.getAttribute('target')
    }));
    const loginBtns = [...document.querySelectorAll('a, button')].filter((el) =>
      /تسجيل الدخول/.test(el.textContent || '')
    );
    const dir = document.documentElement.getAttribute('dir');
    return { title, ctas, loginBtns: loginBtns.length, dir };
  }, ANALYSIS);
  report.steps.push({
    step: 'hero_and_cta',
    ok: meta.title === 'نايوش لتحليل البيانات'
      && meta.ctas.length >= 1
      && meta.ctas.every((c) => c.href === ANALYSIS)
      && meta.loginBtns === 0
      && meta.dir === 'rtl',
    ...meta
  });
  const desktopShot = path.join(OUT, 'erp-da-02-page-desktop.png');
  await page.screenshot({ path: desktopShot, fullPage: true });
  report.artifacts.push(desktopShot);

  // Mobile
  await page.setViewport({ width: 390, height: 844 });
  await page.reload({ waitUntil: 'networkidle2' });
  await page.waitForSelector('.da-erp-hero__title', { timeout: 15000 });
  const mobileShot = path.join(OUT, 'erp-da-03-page-mobile.png');
  await page.screenshot({ path: mobileShot, fullPage: true });
  report.artifacts.push(mobileShot);

  // LAW compare static (from cloned repo CSS + landing markup)
  const lawHtmlPath = path.join(OUT, '_law-da-compare.html');
  const lawCss = fs.readFileSync('/tmp/naiosh-law/public/erp-app/data-analysis-law.css', 'utf8');
  const lawLanding = fs.readFileSync('/tmp/naiosh-law/src/components/data-analysis/landing.tsx', 'utf8');
  // Build a lightweight static LAW page for visual compare (hardcoded markup mirror)
  fs.writeFileSync(lawHtmlPath, `<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8"/>
<link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;700;800;900&display=swap" rel="stylesheet"/>
<style>${lawCss} body{margin:0;padding:24px;background:#f8fafc;font-family:Cairo,sans-serif}</style></head>
<body><div class="da-law" dir="rtl">
<section class="da-law-hero"><div class="da-law-hero__glow"></div>
<div class="da-law-hero__row"><div class="da-law-hero__copy">
<p class="da-law-hero__badge">NAIOSH LAW · تحليل قانوني</p>
<h1 class="da-law-hero__title">نايوش لتحليل البيانات</h1>
<p class="da-law-hero__tag">ذكاء يحوّل بياناتك القانونية إلى قرارات</p>
<p class="da-law-hero__lead">اكتشف قوة بياناتك مع أدوات التحليل والتقارير.</p>
<div class="da-law-hero__actions"><a class="da-law-btn primary" href="https://www.naioshai.com/" target="_blank" rel="noopener noreferrer">ابدأ التحليل</a></div>
</div>
<div class="da-law-visual"><div class="da-law-visual__brand"><span class="da-law-visual__brand-mark">LAW</span>نظام نايوش لتحليل البيانات القانونية</div>
<div class="da-law-visual__art"><div class="da-law-chart"><svg viewBox="0 0 220 90"><polyline fill="none" stroke="#b79a61" stroke-width="2.5" points="8,70 35,55 60,62 90,30 120,40 150,18 180,28 210,12"/><polyline fill="none" stroke="rgba(248,250,252,0.45)" stroke-width="1.5" points="8,78 35,74 60,70 90,66 120,60 150,58 180,50 210,46"/></svg></div>
<div class="da-law-kpi-stack"><div class="da-law-kpi"><strong>قضايا نشطة</strong><span>مؤشر من بياناتك</span></div><div class="da-law-kpi"><strong>جلسات قادمة</strong><span>جدول زمني</span></div><div class="da-law-kpi"><strong>تحصيل</strong><span>مالية قانونية</span></div></div></div>
<div class="da-law-visual__foot"><span>تصور توضيحي — داخل هوية NAIOSH LAW</span><b>من الموقع العام</b></div></div>
</div></section></div></body></html>`);
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto('file://' + lawHtmlPath, { waitUntil: 'networkidle2' });
  const lawShot = path.join(OUT, 'erp-da-04-law-compare-reference.png');
  await page.screenshot({ path: lawShot, fullPage: true });
  report.artifacts.push(lawShot);

  await browser.close();
  report.ok = report.steps.every((s) => s.ok !== false);
  fs.writeFileSync(path.join(OUT, 'erp-data-analysis-uat.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  if (!report.ok) process.exit(1);
}

main().catch((e) => { console.error(e); process.exit(1); });
