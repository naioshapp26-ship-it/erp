/**
 * UAT: ERP public landing mobile layout fix (header row, no white gap, no H-scroll).
 */
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');

const BASE = process.env.APP_BASE_URL || 'http://127.0.0.1:3083';
const OUT = process.env.UAT_OUT || '/opt/cursor/artifacts';

async function measure(page, label) {
  return page.evaluate((labelInner) => {
    const ann = document.querySelector('.announcement-bar');
    const nav = document.querySelector('header.top-nav');
    const inner = document.querySelector('header.top-nav .inner');
    const hero = document.querySelector('.hero');
    const chip = document.querySelector('a.nav-data-analysis');
    const float = document.querySelector('.floating-actions');
    const welcome = document.querySelector('.hero-content::before'); // can't query pseudo
    const h1 = document.querySelector('.hero-content h1');
    const ctas = [...document.querySelectorAll('.hero-ctas .btn, .hero-ctas .hero-cta-pill')];
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const annR = ann?.getBoundingClientRect();
    const navR = nav?.getBoundingClientRect();
    const heroR = hero?.getBoundingClientRect();
    const h1R = h1?.getBoundingClientRect();
    const floatR = float?.getBoundingClientRect();
    const gapAnnToNav = annR && navR ? Math.round(navR.top - annR.bottom) : null;
    const whiteBand = navR ? Math.round(navR.height) : null;
    const chipVisible = chip ? getComputedStyle(chip).display !== 'none' : false;
    const innerH = inner ? Math.round(inner.getBoundingClientRect().height) : null;
    const hScroll = document.documentElement.scrollWidth > document.documentElement.clientWidth + 1;
    const floatFixed = float ? getComputedStyle(float).position === 'fixed' : false;
    const ctaCovered = floatFixed && floatR && ctas.some((b) => {
      const r = b.getBoundingClientRect();
      return r.bottom > floatR.top && r.top < floatR.bottom && r.left < floatR.right && r.right > floatR.left;
    });
    const h1Clipped = h1R ? h1R.top < (navR?.bottom || 0) - 2 : false;
    return {
      label: labelInner,
      vw,
      vh,
      gapAnnToNav,
      whiteBand,
      innerH,
      chipVisible,
      hScroll,
      floatFixed,
      ctaCovered: !!ctaCovered,
      h1Clipped,
      annHeight: annR ? Math.round(annR.height) : null,
      navTop: navR ? Math.round(navR.top) : null,
      heroTop: heroR ? Math.round(heroR.top) : null,
      dir: document.documentElement.getAttribute('dir')
    };
  }, label);
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const report = { ok: true, steps: [], artifacts: [] };
  const browser = await puppeteer.launch({
    executablePath: process.env.CHROME_PATH || '/usr/local/bin/google-chrome',
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=430,932']
  });

  const widths = [320, 375, 390, 430];
  for (const w of widths) {
    const page = await browser.newPage();
    await page.setCacheEnabled(false);
    await page.setViewport({ width: w, height: w <= 390 ? 844 : 932 });
    await page.goto(`${BASE}/`, { waitUntil: 'networkidle2', timeout: 60000 });
    await page.waitForSelector('header.top-nav', { timeout: 20000 });
    await new Promise((r) => setTimeout(r, 600));
    const m = await measure(page, `${w}px`);
    const ok = m.gapAnnToNav !== null && m.gapAnnToNav <= 2
      && m.innerH !== null && m.innerH <= 60
      && m.chipVisible === false
      && m.hScroll === false
      && m.floatFixed === false
      && m.ctaCovered === false
      && m.h1Clipped === false
      && m.dir === 'rtl';
    report.steps.push({ step: `layout_${w}`, ok, ...m });
    const shot = path.join(OUT, `erp-landing-mobile-after-${w}.png`);
    await page.screenshot({ path: shot, fullPage: false });
    report.artifacts.push(shot);
    if (w === 390) {
      const full = path.join(OUT, 'erp-landing-mobile-after-390-full.png');
      await page.screenshot({ path: full, fullPage: true });
      report.artifacts.push(full);
    }
    await page.close();
  }

  // Menu open/close at 390
  const page = await browser.newPage();
  await page.setCacheEnabled(false);
  await page.setViewport({ width: 390, height: 844 });
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle2', timeout: 60000 });
  await page.waitForSelector('.mobile-nav-toggle', { timeout: 15000 });
  await page.click('.mobile-nav-toggle');
  await new Promise((r) => setTimeout(r, 500));
  const openState = await page.evaluate(() => {
    const nav = document.querySelector('header.top-nav');
    const links = document.querySelector('.nav-links');
    const da = [...document.querySelectorAll('.nav-links a')].find((a) => /تحليل البيانات/.test(a.textContent || ''));
    return {
      open: nav?.classList.contains('is-mobile-nav-open'),
      linksVisible: links ? getComputedStyle(links).display !== 'none' : false,
      hasDataAnalysis: !!da,
      daHref: da?.getAttribute('href') || null
    };
  });
  report.steps.push({
    step: 'menu_open',
    ok: openState.open && openState.linksVisible && openState.hasDataAnalysis,
    ...openState
  });
  const menuShot = path.join(OUT, 'erp-landing-mobile-menu-open-390.png');
  await page.screenshot({ path: menuShot, fullPage: false });
  report.artifacts.push(menuShot);
  await page.click('.mobile-nav-toggle');
  await new Promise((r) => setTimeout(r, 400));
  const closed = await page.evaluate(() => !document.querySelector('header.top-nav')?.classList.contains('is-mobile-nav-open'));
  report.steps.push({ step: 'menu_close', ok: closed });

  // Dark mode
  await page.evaluate(() => document.body.classList.add('dark-mode'));
  await new Promise((r) => setTimeout(r, 300));
  const dark = await measure(page, '390-dark');
  report.steps.push({
    step: 'dark_mode_390',
    ok: dark.hScroll === false && dark.chipVisible === false && dark.innerH <= 60,
    ...dark
  });
  const darkShot = path.join(OUT, 'erp-landing-mobile-dark-390.png');
  await page.screenshot({ path: darkShot, fullPage: false });
  report.artifacts.push(darkShot);

  // Before/after compare
  const before = path.join(OUT, 'erp-landing-mobile-before-390.png');
  const after = path.join(OUT, 'erp-landing-mobile-after-390.png');
  if (fs.existsSync(before) && fs.existsSync(after)) {
    const cmp = path.join(OUT, '_erp-landing-mobile-compare.html');
    fs.writeFileSync(cmp, `<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8"/>
<title>قبل / بعد — هبوط ERP موبايل</title>
<style>body{margin:0;background:#0f172a;color:#fff;font-family:Cairo,sans-serif}
h1{margin:16px 20px;font-size:18px}.row{display:grid;grid-template-columns:1fr 1fr;gap:12px;padding:0 16px 20px}
figure{margin:0;background:#1e293b;border-radius:12px;overflow:hidden}
figcaption{padding:10px;font-weight:800;background:#334155}img{width:100%;display:block}</style></head>
<body><h1>مقارنة قبل / بعد — هبوط ERP موبايل (390px)</h1>
<div class="row">
<figure><figcaption>قبل</figcaption><img src="erp-landing-mobile-before-390.png"/></figure>
<figure><figcaption>بعد</figcaption><img src="erp-landing-mobile-after-390.png"/></figure>
</div></body></html>`);
    await page.setViewport({ width: 900, height: 900 });
    await page.goto('file://' + cmp, { waitUntil: 'networkidle2' });
    const cmpShot = path.join(OUT, 'erp-landing-mobile-before-after-compare.png');
    await page.screenshot({ path: cmpShot, fullPage: true });
    report.artifacts.push(cmpShot);
  }

  // LAW reference if available as user asset (copy note only)
  report.artifacts.push('/home/ubuntu/.cursor/projects/workspace/assets/bce12047-76b4-490d-9033-5cbcc64922a4.png');

  await browser.close();
  report.ok = report.steps.every((s) => s.ok !== false);
  fs.writeFileSync(path.join(OUT, 'erp-landing-mobile-fix-uat.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  if (!report.ok) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
