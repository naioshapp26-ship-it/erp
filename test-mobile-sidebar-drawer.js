'use strict';

/**
 * Mobile drawer regression for shared HR portal shell sidebar.
 */
const fs = require('fs');
const path = require('path');
const http = require('http');
const puppeteer = require('puppeteer-core');

const BASE = process.env.APP_BASE_URL || 'http://127.0.0.1:3010';
const ART = '/opt/cursor/artifacts';
fs.mkdirSync(ART, { recursive: true });

const WIDTHS = [320, 360, 375, 390, 430];
const PAGES = [
  { path: '/hr/e-archive', name: 'archive' },
  { path: '/hr', name: 'hr-home' },
  { path: '/hr/assets-custodies', name: 'finance-keep-custody' },
  { path: '/governed-administrative-integration', name: 'gai', optional: true }
];

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

async function measureSidebar(page) {
  return page.evaluate(() => {
    const sb = document.getElementById('hr-sidebar');
    const toggle = document.querySelector('.hr-mobile-toggle');
    const overlay = document.getElementById('hr-sidebar-overlay');
    const closeBtn = document.querySelector('.hr-sidebar-close');
    if (!sb) return { hasSidebar: false };
    const r = sb.getBoundingClientRect();
    const cs = getComputedStyle(sb);
    const t = toggle ? toggle.getBoundingClientRect() : null;
    const tcs = toggle ? getComputedStyle(toggle) : null;
    const ocs = overlay ? getComputedStyle(overlay) : null;
    const peek = r.left < window.innerWidth - 1 && r.right > 0 && !sb.classList.contains('open');
    return {
      hasSidebar: true,
      open: sb.classList.contains('open'),
      bodyOpen: document.body.classList.contains('hr-sidebar-open'),
      width: r.width,
      left: r.left,
      right: r.right,
      transform: cs.transform,
      visibility: cs.visibility,
      peekingWhenClosed: peek,
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
      horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      toggleVisible: !!(toggle && tcs && tcs.display !== 'none' && t.width > 0),
      toggleTop: t ? t.top : null,
      toggleLeft: t ? t.left : null,
      toggleZ: tcs ? tcs.zIndex : null,
      closeVisible: !!(closeBtn && getComputedStyle(closeBtn).display !== 'none'),
      overlayVisible: !!(overlay && ocs && ocs.visibility !== 'hidden' && Number(ocs.opacity) > 0.1),
      navCount: sb.querySelectorAll('a[href]').length
    };
  });
}

(async () => {
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

    // CSS/JS source markers
    const css = fs.readFileSync(path.join(__dirname, 'finance/hr-portal-shell.css'), 'utf8');
    const js = fs.readFileSync(path.join(__dirname, 'finance/hr-portal-shell.js'), 'utf8');
    /hr-sidebar-mobile-width:\s*min\(320px,\s*88vw\)/.test(css) ? pass('css-mobile-width') : fail('css-mobile-width');
    /translate3d\(105%/.test(css) ? pass('css-offcanvas-hide') : fail('css-offcanvas-hide');
    /\.hr-sidebar-overlay/.test(css) ? pass('css-overlay') : fail('css-overlay');
    /function openSidebar|function closeSidebar|function toggleSidebar/.test(js)
      ? pass('js-drawer-api')
      : fail('js-drawer-api');

    for (const width of WIDTHS) {
      await page.setViewport({ width, height: 844, isMobile: true, hasTouch: true });
      for (const target of PAGES) {
        const res = await page.goto(`${BASE}${target.path}`, { waitUntil: 'networkidle2', timeout: 60000 }).catch(() => null);
        if (!res || res.status() >= 400) {
          if (target.optional) {
            pass(`${width}-${target.name}-optional-skip`, String(res && res.status()));
            continue;
          }
          fail(`${width}-${target.name}-load`, String(res && res.status()));
          continue;
        }
        await page.waitForSelector('#hr-sidebar, .hr-mobile-toggle', { timeout: 20000 }).catch(() => null);
        await new Promise((r) => setTimeout(r, 500));

        let m = await measureSidebar(page);
        if (!m.hasSidebar) {
          if (target.optional) {
            pass(`${width}-${target.name}-no-shell-skip`);
            continue;
          }
          fail(`${width}-${target.name}-no-sidebar`);
          continue;
        }

        !m.open && !m.peekingWhenClosed
          ? pass(`${width}-${target.name}-closed-no-peek`)
          : fail(`${width}-${target.name}-closed-no-peek`, JSON.stringify(m));
        !m.horizontalOverflow
          ? pass(`${width}-${target.name}-no-hscroll`)
          : fail(`${width}-${target.name}-no-hscroll`, `${m.scrollWidth}>${m.clientWidth}`);
        m.toggleVisible && m.toggleTop != null && m.toggleTop < 80
          ? pass(`${width}-${target.name}-toggle-top`)
          : fail(`${width}-${target.name}-toggle-top`, JSON.stringify({ top: m.toggleTop, vis: m.toggleVisible }));

        await page.screenshot({
          path: path.join(ART, `mobile-sidebar-${width}-${target.name}-closed.png`),
          fullPage: false
        });

        // Open
        await page.click('.hr-mobile-toggle');
        await new Promise((r) => setTimeout(r, 350));
        m = await measureSidebar(page);
        m.open && m.bodyOpen
          ? pass(`${width}-${target.name}-opens`)
          : fail(`${width}-${target.name}-opens`, JSON.stringify(m));
        m.width >= Math.min(280, width * 0.8) && m.width <= Math.min(320, width * 0.88) + 2
          ? pass(`${width}-${target.name}-open-width`, String(Math.round(m.width)))
          : fail(`${width}-${target.name}-open-width`, String(m.width));
        m.closeVisible ? pass(`${width}-${target.name}-close-btn`) : fail(`${width}-${target.name}-close-btn`);
        m.overlayVisible ? pass(`${width}-${target.name}-overlay`) : fail(`${width}-${target.name}-overlay`);
        m.navCount > 3 ? pass(`${width}-${target.name}-nav-items`, String(m.navCount)) : fail(`${width}-${target.name}-nav-items`, String(m.navCount));

        await page.screenshot({
          path: path.join(ART, `mobile-sidebar-${width}-${target.name}-open.png`),
          fullPage: false
        });

        // Close via overlay (click the uncovered left strip, not under the drawer).
        await page.evaluate(() => {
          const overlay = document.getElementById('hr-sidebar-overlay');
          if (!overlay) return;
          const ev = new MouseEvent('click', { bubbles: true, cancelable: true, clientX: 8, clientY: 120 });
          overlay.dispatchEvent(ev);
        });
        await new Promise((r) => setTimeout(r, 300));
        m = await measureSidebar(page);
        !m.open && !m.peekingWhenClosed
          ? pass(`${width}-${target.name}-close-overlay`)
          : fail(`${width}-${target.name}-close-overlay`, JSON.stringify(m));

        // Re-open and close via X
        await page.evaluate(() => document.querySelector('.hr-mobile-toggle')?.click());
        await new Promise((r) => setTimeout(r, 300));
        await page.evaluate(() => document.querySelector('.hr-sidebar-close')?.click());
        await new Promise((r) => setTimeout(r, 300));
        m = await measureSidebar(page);
        !m.open ? pass(`${width}-${target.name}-close-x`) : fail(`${width}-${target.name}-close-x`);
      }
    }

    // Desktop unchanged: sidebar visible without toggle requirement
    await page.setViewport({ width: 1440, height: 900 });
    await page.goto(`${BASE}/hr`, { waitUntil: 'networkidle2', timeout: 60000 });
    await new Promise((r) => setTimeout(r, 500));
    const desk = await page.evaluate(() => {
      const sb = document.getElementById('hr-sidebar');
      const toggle = document.querySelector('.hr-mobile-toggle');
      const r = sb.getBoundingClientRect();
      const tcs = toggle ? getComputedStyle(toggle) : null;
      return {
        width: r.width,
        left: r.left,
        visible: r.width > 200 && r.left > 1000,
        toggleHidden: !toggle || tcs.display === 'none',
        openClass: sb.classList.contains('open'),
        bodyPad: getComputedStyle(document.body).paddingRight
      };
    });
    desk.visible && desk.toggleHidden
      ? pass('desktop-sidebar-stable', JSON.stringify(desk))
      : fail('desktop-sidebar-stable', JSON.stringify(desk));
    await page.screenshot({ path: path.join(ART, 'mobile-sidebar-desktop-hr.png'), fullPage: false });

    // Nav click closes drawer
    await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
    await page.goto(`${BASE}/hr/e-archive`, { waitUntil: 'networkidle2', timeout: 60000 });
    await new Promise((r) => setTimeout(r, 400));
    await page.click('.hr-mobile-toggle');
    await new Promise((r) => setTimeout(r, 300));
    await page.evaluate(() => {
      const link = [...document.querySelectorAll('#hr-sidebar a[href]')].find((a) => a.getAttribute('href') && a.getAttribute('href') !== '#');
      if (link) link.click();
    });
    await new Promise((r) => setTimeout(r, 800));
    const afterNav = await measureSidebar(page);
    !afterNav.open
      ? pass('nav-click-closes-drawer')
      : fail('nav-click-closes-drawer', JSON.stringify(afterNav));
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
  fs.writeFileSync(path.join(ART, 'mobile-sidebar-drawer-report.json'), JSON.stringify(summary, null, 2));
  console.log('\n=== SUMMARY ===');
  console.log(JSON.stringify({ passed: summary.passed, failed: summary.failed }, null, 2));
  process.exit(summary.failed ? 1 : 0);
})();
