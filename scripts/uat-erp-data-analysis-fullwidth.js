/**
 * UAT: ERP data-analysis full-width layout (no narrow max-width gutters).
 */
const fs = require('fs');
const path = require('path');
const http = require('http');

const BASE = process.env.APP_BASE_URL || 'http://127.0.0.1:3083';
const OUT = process.env.UAT_OUT || '/opt/cursor/artifacts';

function httpGet(urlPath) {
  const u = new URL(BASE + urlPath);
  return new Promise((resolve, reject) => {
    http.get(
      { hostname: u.hostname, port: u.port, path: u.pathname + u.search, headers: { Accept: 'text/html' } },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => resolve({ status: res.statusCode, body: Buffer.concat(chunks).toString('utf8') }));
      }
    ).on('error', reject);
  });
}

async function measure(page, label) {
  return page.evaluate((labelInner) => {
    const shell = document.querySelector('.da-erp-shell');
    const hero = document.querySelector('.da-erp-hero');
    const topbar = document.querySelector('.da-erp-topbar');
    const section = document.querySelector('.da-erp-section');
    const grid6 = document.querySelector('.da-erp-grid-6');
    const cards = grid6 ? [...grid6.querySelectorAll('.da-erp-card')] : [];
    const vw = window.innerWidth;
    const shellRect = shell?.getBoundingClientRect();
    const heroRect = hero?.getBoundingClientRect();
    const topRect = topbar?.getBoundingClientRect();
    const secRect = section?.getBoundingClientRect();
    const style = shell ? getComputedStyle(shell) : null;
    const maxW = style?.maxWidth || null;
    const padL = style ? parseFloat(style.paddingLeft) : null;
    const padR = style ? parseFloat(style.paddingRight) : null;
    // Gutters are shell padding — measure via hero inset from viewport edges
    const sideGapL = heroRect ? heroRect.left : null;
    const sideGapR = heroRect ? vw - heroRect.right : null;
    const contentUsage = heroRect ? heroRect.width / vw : 0;
    const cardWidths = cards.slice(0, 6).map((c) => Math.round(c.getBoundingClientRect().width));
    const equalFirstRow = cardWidths.length
      ? Math.max(...cardWidths) - Math.min(...cardWidths) <= 2
      : true;
    const cols = grid6 ? getComputedStyle(grid6).gridTemplateColumns.split(' ').filter(Boolean).length : 0;
    const hScroll = document.documentElement.scrollWidth > document.documentElement.clientWidth + 1;
    return {
      label: labelInner,
      vw,
      maxW,
      padL,
      padR,
      sideGapL: Math.round(sideGapL),
      sideGapR: Math.round(sideGapR),
      contentUsage: Number(contentUsage.toFixed(3)),
      heroWidth: Math.round(heroRect?.width || 0),
      topbarWidth: Math.round(topRect?.width || 0),
      sectionWidth: Math.round(secRect?.width || 0),
      aligned: Math.abs((heroRect?.left || 0) - (topRect?.left || 0)) < 2
        && Math.abs((secRect?.left || 0) - (topRect?.left || 0)) < 2,
      grid6Cols: cols,
      equalFirstRow,
      cardWidths,
      hScroll,
      dir: document.documentElement.getAttribute('dir')
    };
  }, label);
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const report = { ok: true, steps: [], artifacts: [] };

  const css = await httpGet('/public/data-analysis-erp.css?v=erp-da-fw-20261029b');
  const cssOk = css.status === 200
    && !/\.da-erp-shell\s*\{[^}]*max-width:\s*1180px/s.test(css.body)
    && /--da-erp-gutter:\s*24px/.test(css.body)
    && /\.da-erp-grid-6/.test(css.body);
  report.steps.push({ step: 'css_fullwidth', ok: cssOk, status: css.status });

  const pageHtml = await httpGet('/data-analysis');
  report.steps.push({
    step: 'page_uses_grid6',
    ok: pageHtml.status === 200 && /da-erp-grid-6/.test(pageHtml.body),
    status: pageHtml.status
  });

  const puppeteer = require('puppeteer-core');
  const browser = await puppeteer.launch({
    executablePath: process.env.CHROME_PATH || '/usr/local/bin/google-chrome',
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1920,1080']
  });
  const page = await browser.newPage();
  await page.setCacheEnabled(false);

  const viewports = [
    { w: 1920, h: 1080, expectCols: 6, minUsage: 0.95 },
    { w: 1440, h: 900, expectCols: 4, minUsage: 0.94 },
    { w: 1024, h: 768, expectCols: 3, minUsage: 0.92 },
    { w: 390, h: 844, expectCols: 1, minUsage: 0.88 }
  ];

  for (const vp of viewports) {
    await page.setViewport({ width: vp.w, height: vp.h });
    await page.goto(`${BASE}/data-analysis`, { waitUntil: 'networkidle2', timeout: 60000 });
    await page.waitForSelector('.da-erp-hero__title', { timeout: 15000 });
    const m = await measure(page, `${vp.w}px`);
    const ok = m.contentUsage >= vp.minUsage
      && m.sideGapL <= 28
      && m.sideGapR <= 28
      && Math.abs(m.sideGapL - m.sideGapR) <= 2
      && m.aligned
      && m.hScroll === false
      && m.dir === 'rtl'
      && (m.maxW === 'none' || m.maxW === '' || parseFloat(m.maxW) >= vp.w - 1 || m.maxW === '100%')
      && m.grid6Cols === vp.expectCols
      && m.equalFirstRow;
    report.steps.push({
      step: `layout_${vp.w}`,
      ok,
      expectCols: vp.expectCols,
      ...m
    });
    const shot = path.join(OUT, `erp-da-after-fullwidth-${vp.w}.png`);
    await page.screenshot({ path: shot, fullPage: true });
    report.artifacts.push(shot);
  }

  // Side-by-side compare panel (before vs after at 1920)
  const beforePath = path.join(OUT, 'erp-da-before-fullwidth-1920.png');
  const afterPath = path.join(OUT, 'erp-da-after-fullwidth-1920.png');
  if (fs.existsSync(beforePath) && fs.existsSync(afterPath)) {
    const compareHtml = path.join(OUT, '_erp-da-fw-compare.html');
    fs.writeFileSync(compareHtml, `<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8"/>
<title>قبل / بعد — عرض كامل</title>
<style>
body{margin:0;font-family:Cairo,sans-serif;background:#0f172a;color:#fff}
h1{margin:16px 24px;font-size:20px}
.row{display:grid;grid-template-columns:1fr 1fr;gap:12px;padding:0 16px 24px}
figure{margin:0;background:#1e293b;border-radius:12px;overflow:hidden}
figcaption{padding:10px 12px;font-weight:800;background:#334155}
img{display:block;width:100%;height:auto}
</style></head><body>
<h1>مقارنة قبل / بعد — اختفاء الفراغات الجانبية (1920px)</h1>
<div class="row">
<figure><figcaption>قبل — حاوية ضيقة ~1180px</figcaption><img src="erp-da-before-fullwidth-1920.png"/></figure>
<figure><figcaption>بعد — Full-width + هوامش 24px</figcaption><img src="erp-da-after-fullwidth-1920.png"/></figure>
</div></body></html>`);
    await page.setViewport({ width: 1920, height: 1080 });
    await page.goto('file://' + compareHtml, { waitUntil: 'networkidle2' });
    const cmp = path.join(OUT, 'erp-da-fullwidth-before-after-compare.png');
    await page.screenshot({ path: cmp, fullPage: true });
    report.artifacts.push(cmp);
  }

  await browser.close();
  report.ok = report.steps.every((s) => s.ok !== false);
  fs.writeFileSync(path.join(OUT, 'erp-data-analysis-fullwidth-uat.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  if (!report.ok) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
