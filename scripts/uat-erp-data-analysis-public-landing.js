/**
 * UAT: guest (no ERP session) journey —
 * Landing header → /data-analysis → ابدأ التحليل → naioshai.com
 */
const fs = require('fs');
const path = require('path');
const http = require('http');

const BASE = process.env.APP_BASE_URL || 'http://127.0.0.1:3083';
const OUT = process.env.UAT_OUT || '/opt/cursor/artifacts';
const ANALYSIS = 'https://www.naioshai.com/';

function httpReq(method, urlPath, headers = {}) {
  const u = new URL(urlPath.startsWith('http') ? urlPath : BASE + urlPath);
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: u.hostname,
        port: u.port,
        path: u.pathname + u.search,
        method,
        headers: {
          Accept: 'text/html,application/xhtml+xml',
          ...headers
        }
      },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: Buffer.concat(chunks).toString('utf8'),
            location: res.headers.location || null
          });
        });
      }
    );
    req.on('error', reject);
    req.end();
  });
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const report = { ok: true, steps: [], artifacts: [] };

  // 1) Public HTML fetch without cookies must NOT redirect to login
  const pageGet = await httpReq('GET', '/data-analysis');
  const isPublic =
    pageGet.status === 200
    && !/login-page\.html/i.test(String(pageGet.location || ''))
    && pageGet.body.includes('نايوش لتحليل البيانات')
    && pageGet.body.includes('da-erp-hero')
    && !/<a[^>]*>\s*تسجيل الدخول/.test(pageGet.body);
  report.steps.push({
    step: 'public_page_no_auth',
    ok: isPublic,
    status: pageGet.status,
    location: pageGet.location
  });

  const primaryHrefs = [...pageGet.body.matchAll(/da-erp-btn primary[\s\S]{0,180}?href="([^"]+)"/g)].map((m) => m[1]);
  report.steps.push({
    step: 'cta_only_naioshai',
    ok: primaryHrefs.length >= 1 && primaryHrefs.every((h) => h === ANALYSIS),
    primaryHrefs
  });

  const landingGet = await httpReq('GET', '/');
  const landingHasLink =
    landingGet.status === 200
    && /href="\/data-analysis"[^>]*>[\s\S]*?نايوش لتحليل البيانات/.test(landingGet.body);
  report.steps.push({
    step: 'landing_header_link_in_html',
    ok: landingHasLink,
    status: landingGet.status
  });

  const puppeteer = require('puppeteer-core');
  const browser = await puppeteer.launch({
    executablePath: process.env.CHROME_PATH || '/usr/local/bin/google-chrome',
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1440,900']
  });

  // Incognito / guest context — no cookies, no localStorage auth
  const context = await browser.createBrowserContext();
  const page = await context.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  await page.setCacheEnabled(false);

  await page.goto(`${BASE}/`, { waitUntil: 'networkidle2', timeout: 60000 });
  await page.waitForSelector('a.nav-data-analysis', { timeout: 20000 });
  const headerMeta = await page.evaluate(() => {
    const link = document.querySelector('a.nav-data-analysis');
    const brand = document.querySelector('header.top-nav a.brand');
    return {
      text: (link?.textContent || '').replace(/\s+/g, ' ').trim(),
      href: link?.getAttribute('href') || null,
      nextToBrand: !!(brand && link && brand.nextElementSibling === link)
    };
  });
  report.steps.push({
    step: 'guest_landing_header_link',
    ok: headerMeta.href === '/data-analysis'
      && /نايوش لتحليل البيانات/.test(headerMeta.text)
      && headerMeta.nextToBrand === true,
    ...headerMeta
  });
  const headerShot = path.join(OUT, 'erp-da-public-01-landing-header.png');
  await page.screenshot({ path: headerShot, fullPage: false });
  report.artifacts.push(headerShot);

  await Promise.all([
    page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 60000 }),
    page.click('a.nav-data-analysis')
  ]);

  const guestPage = await page.evaluate((expected) => ({
    url: location.pathname,
    title: document.querySelector('.da-erp-hero__title')?.textContent?.trim() || null,
    dir: document.documentElement.getAttribute('dir'),
    backHref: document.getElementById('daErpBack')?.getAttribute('href') || null,
    backLabel: document.getElementById('daErpBackLabel')?.textContent?.trim() || null,
    ctas: [...document.querySelectorAll('a.da-erp-btn.primary')].map((a) => ({
      text: (a.textContent || '').trim(),
      href: a.getAttribute('href'),
      target: a.getAttribute('target')
    })),
    loginBtns: [...document.querySelectorAll('a, button')].filter((el) =>
      /تسجيل الدخول/.test(el.textContent || '')
    ).length,
    redirectedToLogin: /login-page\.html/i.test(location.pathname + location.search)
  }), ANALYSIS);

  report.steps.push({
    step: 'guest_opens_intro_page',
    ok: guestPage.url.replace(/\/$/, '') === '/data-analysis'
      && guestPage.title === 'نايوش لتحليل البيانات'
      && guestPage.dir === 'rtl'
      && guestPage.loginBtns === 0
      && guestPage.redirectedToLogin === false
      && guestPage.ctas.length >= 1
      && guestPage.ctas.every((c) => c.href === ANALYSIS),
    ...guestPage
  });

  const guestShot = path.join(OUT, 'erp-da-public-02-page-guest.png');
  await page.screenshot({ path: guestShot, fullPage: true });
  report.artifacts.push(guestShot);

  await page.setViewport({ width: 390, height: 844 });
  await page.reload({ waitUntil: 'networkidle2' });
  await page.waitForSelector('.da-erp-hero__title', { timeout: 15000 });
  const mobileShot = path.join(OUT, 'erp-da-public-03-page-mobile-guest.png');
  await page.screenshot({ path: mobileShot, fullPage: true });
  report.artifacts.push(mobileShot);

  await page.setViewport({ width: 1440, height: 900 });
  await page.reload({ waitUntil: 'networkidle2' });
  const ctaHref = await page.$eval('a.da-erp-btn.primary', (a) => a.href);
  report.steps.push({
    step: 'start_analysis_href',
    ok: ctaHref === ANALYSIS || ctaHref === ANALYSIS.replace(/\/$/, ''),
    ctaHref
  });

  // Click CTA in a way that captures intended navigation target without depending on external site
  const ctaTarget = await page.evaluate(() => {
    const a = document.querySelector('a.da-erp-btn.primary');
    return { href: a?.href || null, target: a?.getAttribute('target') || null, rel: a?.getAttribute('rel') || null };
  });
  report.steps.push({
    step: 'cta_opens_naioshai_blank',
    ok: (ctaTarget.href === ANALYSIS || ctaTarget.href === 'https://www.naioshai.com')
      && ctaTarget.target === '_blank',
    ...ctaTarget
  });

  await browser.close();
  report.ok = report.steps.every((s) => s.ok !== false);
  fs.writeFileSync(path.join(OUT, 'erp-data-analysis-public-uat.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  if (!report.ok) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
