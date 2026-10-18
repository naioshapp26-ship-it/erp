'use strict';

/**
 * Archive home banner identity: «الأرشيف الذكي 360»
 */
const fs = require('fs');
const path = require('path');
const http = require('http');
const puppeteer = require('puppeteer-core');

const BASE = process.env.APP_BASE_URL || 'http://127.0.0.1:3010';
const ART = '/opt/cursor/artifacts';
fs.mkdirSync(ART, { recursive: true });

const results = [];
function pass(name, detail = '') {
  results.push({ name, ok: true, detail });
  console.log(`PASS  ${name}${detail ? ` — ${detail}` : ''}`);
}
function fail(name, detail = '') {
  results.push({ name, ok: false, detail });
  console.log(`FAIL  ${name}${detail ? ` — ${detail}` : ''}`);
}

function postJson(urlPath, body) {
  return new Promise((resolve, reject) => {
    const u = new URL(urlPath, BASE);
    const payload = JSON.stringify(body);
    const req = http.request({
      hostname: u.hostname, port: u.port || 80, path: u.pathname, method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) }
    }, (res) => {
      let raw = '';
      res.on('data', (c) => { raw += c; });
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(raw); } catch { /* */ }
        resolve({ status: res.statusCode, json });
      });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

(async () => {
  const src = fs.readFileSync(path.join(__dirname, 'finance/archive-home.html'), 'utf8');
  /الأرشيف الذكي 360/.test(src) ? pass('src-title') : fail('src-title');
  /NAIOSH ARCHIVE 360/.test(src) ? pass('src-eyebrow') : fail('src-eyebrow');
  /منظومة ذكية لإدارة الوثائق والسجلات والأرشفة الإلكترونية، مع حفظ المعلومات وتنظيم الوصول إليها بأمان\./.test(src)
    ? pass('src-lead')
    : fail('src-lead');
  !/إدارة السجلات والأرشفة بأسلوب أكثر وضوحًا وأناقة/.test(src) ? pass('src-old-title-removed') : fail('src-old-title-removed');
  !/الذاكرة المؤسسية 360/.test(src) ? pass('src-prior-title-removed') : fail('src-prior-title-removed');
  /<h1[^>]*>\s*🗂️ السجلات والأرشفة\s*<\/h1>/.test(src) ? pass('src-section-heading-kept') : fail('src-section-heading-kept');
  /id="archive-cards"/.test(src) ? pass('src-archive-cards-kept') : fail('src-archive-cards-kept');
  /href="#archive-cards"/.test(src) ? pass('src-explore-cta') : fail('src-explore-cta');
  /href="\/hr\/e-archive"/.test(src) ? pass('src-start-archive-cta') : fail('src-start-archive-cta');

  const browser = await puppeteer.launch({
    executablePath: process.env.CHROME_PATH || '/usr/local/bin/google-chrome',
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();

  try {
    const login = await postJson('/api/auth/login', { email: 'admin@naiosh.com', password: 'Admin@123' });
    if (!login.json?.success) throw new Error('login failed');
    const session = login.json.data.session;
    const token = (session && typeof session === 'object' ? session.token : session) || login.json.data.token;
    const user = login.json.data.user;

    await page.goto(`${BASE}/login-page.html`, { waitUntil: 'domcontentloaded' });
    await page.evaluate((t, u) => {
      localStorage.setItem('authToken', t);
      sessionStorage.setItem('authToken', t);
      localStorage.setItem('user', JSON.stringify(u));
      sessionStorage.setItem('user', JSON.stringify(u));
      document.cookie = `authToken=${encodeURIComponent(t)}; path=/`;
    }, token, user);

    async function audit(label, width, height, shotName) {
      await page.setViewport({ width, height, isMobile: width < 800, hasTouch: width < 800 });
      await page.goto(`${BASE}/archive`, { waitUntil: 'networkidle2', timeout: 60000 });
      await page.waitForSelector('.hero-section, .hero-title', { timeout: 20000 });
      await new Promise((r) => setTimeout(r, 400));
      await page.$eval('.hero-section', (el) => el.scrollIntoView({ block: 'center' }));
      await new Promise((r) => setTimeout(r, 200));
      await page.screenshot({ path: path.join(ART, shotName), fullPage: false });

      const state = await page.evaluate(() => {
        const title = document.querySelector('.hero-title');
        const eyebrow = document.querySelector('.hero-eyebrow');
        const lead = document.querySelector('.hero-lead');
        const logo = document.querySelector('.hero-image-wrap img');
        const cta = document.querySelector('.hero-cta-primary');
        const sectionH1 = document.querySelector('h1');
        const cards = document.querySelectorAll('#archive-cards a[href]');
        const tr = title?.getBoundingClientRect();
        const lr = lead?.getBoundingClientRect();
        const logr = logo?.getBoundingClientRect();
        const hero = document.querySelector('.hero-section')?.getBoundingClientRect();
        const tcs = title ? getComputedStyle(title) : null;
        const lcs = lead ? getComputedStyle(lead) : null;
        const overlapLogo = !!(tr && logr && tr.right > logr.left + 8 && tr.left < logr.right - 8 && tr.bottom > logr.top + 8 && tr.top < logr.bottom - 8);
        const titleOutsideHero = !!(tr && hero && (tr.left < hero.left - 2 || tr.right > hero.right + 2));
        const whiteTitle = tcs && /rgb\(\s*255,\s*255,\s*255\s*\)|#fff/i.test(tcs.color);
        return {
          titleText: title?.textContent?.trim() || '',
          eyebrowText: eyebrow?.textContent?.replace(/\s+/g, ' ').trim() || '',
          leadText: lead?.textContent?.trim() || '',
          sectionHeading: sectionH1?.textContent?.replace(/\s+/g, ' ').trim() || '',
          titleVisible: !!(tr && tr.width > 40 && tr.height > 20),
          titleClipped: !!(tr && (tr.left < -2 || tr.right > innerWidth + 2)),
          leadClipped: !!(lr && (lr.left < -2 || lr.right > innerWidth + 2)),
          titleOutsideHero,
          eyebrowOk: /NAIOSH ARCHIVE 360/i.test(eyebrow?.textContent || ''),
          whiteTitle,
          leadColor: lcs?.color || null,
          overlapLogo,
          ctaVisible: !!(cta && cta.getBoundingClientRect().width > 40),
          cardLinks: cards.length,
          hOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
          scrollWidth: document.documentElement.scrollWidth,
          clientWidth: document.documentElement.clientWidth
        };
      });

      state.titleText === 'الأرشيف الذكي 360' ? pass(`${label}-title`) : fail(`${label}-title`, state.titleText);
      state.eyebrowOk ? pass(`${label}-eyebrow`) : fail(`${label}-eyebrow`, state.eyebrowText);
      /منظومة ذكية لإدارة الوثائق والسجلات والأرشفة الإلكترونية/.test(state.leadText) ? pass(`${label}-lead`) : fail(`${label}-lead`, state.leadText.slice(0, 80));
      /السجلات والأرشفة/.test(state.sectionHeading) ? pass(`${label}-section-heading`) : fail(`${label}-section-heading`, state.sectionHeading);
      state.whiteTitle ? pass(`${label}-title-white`) : fail(`${label}-title-white`, String(state.whiteTitle));
      state.titleVisible && !state.titleClipped && !state.titleOutsideHero
        ? pass(`${label}-title-fit`)
        : fail(`${label}-title-fit`, JSON.stringify({ clipped: state.titleClipped, outside: state.titleOutsideHero, visible: state.titleVisible }));
      !state.leadClipped ? pass(`${label}-lead-fit`) : fail(`${label}-lead-fit`);
      !state.overlapLogo ? pass(`${label}-no-logo-overlap`) : fail(`${label}-no-logo-overlap`);
      state.ctaVisible ? pass(`${label}-cta`) : fail(`${label}-cta`);
      !state.hOverflow ? pass(`${label}-no-hscroll`) : fail(`${label}-no-hscroll`, `${state.scrollWidth}>${state.clientWidth}`);
      state.cardLinks > 0 ? pass(`${label}-cards-intact`) : fail(`${label}-cards-intact`, String(state.cardLinks));
    }

    await audit('desktop', 1440, 900, 'archive-banner-desktop.png');
    await audit('mobile-390', 390, 844, 'archive-banner-mobile-390.png');
    await audit('mobile-320', 320, 720, 'archive-banner-mobile-320.png');
  } catch (err) {
    fail('suite-error', err.message);
    console.error(err);
  } finally {
    await browser.close();
  }

  const summary = {
    passed: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok).length,
    results
  };
  fs.writeFileSync(path.join(ART, 'archive-banner-memory-report.json'), JSON.stringify(summary, null, 2));
  console.log('\n=== SUMMARY ===');
  console.log(JSON.stringify({ passed: summary.passed, failed: summary.failed }, null, 2));
  process.exit(summary.failed ? 1 : 0);
})();
