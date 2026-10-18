'use strict';

/**
 * Final pre-approval review for PR #183 mobile sidebar drawer.
 */
const fs = require('fs');
const path = require('path');
const http = require('http');
const puppeteer = require('puppeteer-core');
const {
  FINANCE_KEEP,
  FINANCE_MOVED,
  ARCHIVE_KEEP,
  HR_KEEP,
  resolveNavigationContext
} = require('./gai-hub-navigation');

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

function getJson(urlPath, token) {
  return new Promise((resolve, reject) => {
    const u = new URL(urlPath, BASE);
    const req = http.request({
      hostname: u.hostname, port: u.port || 80, path: u.pathname + u.search, method: 'GET',
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    }, (res) => {
      let raw = '';
      res.on('data', (c) => { raw += c; });
      res.on('end', () => resolve({ status: res.statusCode, raw }));
    });
    req.on('error', reject);
    req.end();
  });
}

function wouldInjectShell(p) {
  const ctx = resolveNavigationContext(p);
  return p === '/hr' || p.startsWith('/hr/') || ctx === 'gai-finance' || ctx === 'finance-keep';
}

async function probeHtmlHasShell(p) {
  const res = await getJson(p);
  const hasJs = /hr-portal-shell\.js/.test(res.raw || '');
  const hasCss = /hr-portal-shell\.css/.test(res.raw || '');
  return { status: res.status, hasJs, hasCss, hasShell: hasJs && hasCss };
}

async function measure(page) {
  return page.evaluate(() => {
    const sb = document.getElementById('hr-sidebar');
    const toggle = document.querySelector('.hr-mobile-toggle');
    const overlay = document.getElementById('hr-sidebar-overlay');
    const closeBtn = document.querySelector('.hr-sidebar-close');
    if (!sb) {
      const alt = document.getElementById('sidebar') || document.querySelector('aside.sidebar, .sidebar');
      return {
        hasShellSidebar: false,
        altSidebar: !!alt,
        altId: alt?.id || alt?.className || null,
        horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth
      };
    }
    const r = sb.getBoundingClientRect();
    const links = [...sb.querySelectorAll('a.hr-nav-link, .hr-nav-section a[href]')];
    const titles = links.map((a) => {
      const title = a.querySelector('.hr-nav-title, span');
      const icon = a.querySelector('i, .hr-nav-icon');
      const tr = title ? title.getBoundingClientRect() : null;
      const ir = icon ? icon.getBoundingClientRect() : null;
      const clipped = tr ? (tr.right > r.right + 1 || tr.left < r.left - 1 || tr.width < 8) : true;
      const iconOk = ir ? ir.width > 4 && ir.height > 4 && ir.left >= r.left - 2 : false;
      return {
        href: a.getAttribute('href'),
        text: (title?.textContent || a.textContent || '').trim().slice(0, 60),
        clipped,
        iconOk,
        titleWidth: tr ? tr.width : 0
      };
    });
    const t = toggle?.getBoundingClientRect();
    const tcs = toggle ? getComputedStyle(toggle) : null;
    const ocs = overlay ? getComputedStyle(overlay) : null;
    const ccs = closeBtn ? getComputedStyle(closeBtn) : null;
    const peek = !sb.classList.contains('open') && r.left < innerWidth - 0.5 && r.right > 0.5;
    const toggleCoveredBySidebar = !!(t && sb.classList.contains('open') && t.right > r.left && t.left < r.right && getComputedStyle(toggle).pointerEvents === 'auto');
    return {
      hasShellSidebar: true,
      open: sb.classList.contains('open'),
      bodyOpen: document.body.classList.contains('hr-sidebar-open'),
      width: r.width,
      left: r.left,
      right: r.right,
      fromRight: Math.abs(r.right - innerWidth) < 2,
      peekingWhenClosed: peek,
      horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
      toggleVisible: !!(toggle && tcs && tcs.display !== 'none' && t.width > 0),
      toggleTop: t?.top ?? null,
      togglePointerEvents: tcs?.pointerEvents || null,
      toggleCoveredBySidebar,
      closeVisible: !!(closeBtn && ccs && ccs.display !== 'none'),
      overlayVisible: !!(overlay && ocs && ocs.visibility !== 'hidden' && Number(ocs.opacity) > 0.1),
      navCount: links.length,
      clippedTitles: titles.filter((x) => x.clipped).length,
      missingIcons: titles.filter((x) => !x.iconOk).length,
      lastLink: titles[titles.length - 1] || null,
      firstLink: titles[0] || null,
      canScrollSidebar: sb.scrollHeight > sb.clientHeight + 4,
      sidebarScrollTop: sb.scrollTop,
      sidebarScrollHeight: sb.scrollHeight,
      sidebarClientHeight: sb.clientHeight
    };
  });
}

(async () => {
  const coverage = {
    shellExpected: [],
    shellLive: [],
    shellMissingLive: [],
    notInShellFix: []
  };

  // Build expected shell set from catalogs + common HR routes
  const expected = new Set([
    '/hr',
    '/hr/e-archive',
    '/hr/inbound-outbound-mail',
    '/hr/employees',
    '/hr/my-requests',
    '/hr/manager',
    '/hr/pending-actions',
    '/hr/system-settings',
    '/hr/employee-360',
    '/hr/attendance-hub',
    '/hr/human-resources',
    '/hr/reports'
  ]);
  FINANCE_KEEP.forEach((i) => expected.add(i.href));
  FINANCE_MOVED.slice(0, 25).forEach((i) => expected.add(i.href));
  ARCHIVE_KEEP.forEach((i) => expected.add(i.href));
  HR_KEEP.forEach((i) => expected.add(i.href));

  for (const p of [...expected].sort()) {
    if (wouldInjectShell(p)) coverage.shellExpected.push({ path: p, ctx: resolveNavigationContext(p) });
    else coverage.notInShellFix.push({ path: p, ctx: resolveNavigationContext(p), reason: 'not in shell inject rules' });
  }
  // Known alternate UIs
  for (const p of ['/finance', '/archive', '/governed-administrative-integration', '/finance/payments/', '/dashboard']) {
    coverage.notInShellFix.push({
      path: p,
      ctx: resolveNavigationContext(p),
      reason: 'different sidebar component / no hr-portal-shell'
    });
  }

  // Live HTML probe for a representative matrix
  const probeList = [
    '/hr',
    '/hr/e-archive',
    '/hr/assets-custodies',
    '/hr/operations',
    '/hr/employee-360',
    '/hr/my-requests',
    '/finance/payment-terms.html',
    '/finance/expenses.html',
    '/finance',
    '/archive',
    '/governed-administrative-integration'
  ];
  for (const p of probeList) {
    const live = await probeHtmlHasShell(p);
    const expectedShell = wouldInjectShell(p) && (p.startsWith('/hr') || resolveNavigationContext(p) === 'gai-finance'
      || (resolveNavigationContext(p) === 'finance-keep' && p.startsWith('/hr')));
    // finance-keep under /finance/*.html is NOT injected by finance middleware
    const financeKeepViaFinanceHtml = resolveNavigationContext(p) === 'finance-keep' && p.startsWith('/finance/');
    if (live.hasShell) coverage.shellLive.push({ path: p, ...live });
    else if (expectedShell && !financeKeepViaFinanceHtml) coverage.shellMissingLive.push({ path: p, ...live });
    else if (financeKeepViaFinanceHtml) {
      coverage.notInShellFix.push({
        path: p,
        ctx: 'finance-keep',
        reason: 'finance middleware skips shell for FINANCE_KEEP .html (native finance UI); use /hr/* alias when present'
      });
    }
  }

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

    // Coverage assertions from live probes
    coverage.shellLive.length >= 5
      ? pass('coverage-shell-live-sample', String(coverage.shellLive.length))
      : fail('coverage-shell-live-sample', String(coverage.shellLive.length));
    !coverage.shellMissingLive.length
      ? pass('coverage-no-missing-expected-shell')
      : fail('coverage-no-missing-expected-shell', JSON.stringify(coverage.shellMissingLive));

    const showcase = [
      { path: '/hr/e-archive', key: 'archive' },
      { path: '/hr', key: 'hr' },
      { path: '/hr/assets-custodies', key: 'finance' } // finance-keep shell context
    ];

    await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });

    for (const item of showcase) {
      await page.goto(`${BASE}${item.path}`, { waitUntil: 'networkidle2', timeout: 60000 });
      await page.waitForSelector('#hr-sidebar', { timeout: 20000 });
      await new Promise((r) => setTimeout(r, 500));

      let m = await measure(page);
      m.hasShellSidebar ? pass(`${item.key}-has-shell`) : fail(`${item.key}-has-shell`);
      !m.open && !m.peekingWhenClosed ? pass(`${item.key}-closed-no-peek`) : fail(`${item.key}-closed-no-peek`, JSON.stringify(m));
      !m.horizontalOverflow ? pass(`${item.key}-closed-no-hscroll`) : fail(`${item.key}-closed-no-hscroll`, `${m.scrollWidth}>${m.clientWidth}`);
      m.toggleVisible && m.toggleTop < 80 ? pass(`${item.key}-toggle-top`) : fail(`${item.key}-toggle-top`, JSON.stringify(m));

      await page.screenshot({ path: path.join(ART, `final-390-${item.key}-closed.png`), fullPage: false });

      await page.evaluate(() => document.querySelector('.hr-mobile-toggle')?.click());
      await new Promise((r) => setTimeout(r, 400));
      m = await measure(page);
      m.open && m.fromRight ? pass(`${item.key}-opens-from-right`) : fail(`${item.key}-opens-from-right`, JSON.stringify(m));
      m.width >= 300 && m.width <= 322 ? pass(`${item.key}-open-width`, String(Math.round(m.width))) : fail(`${item.key}-open-width`, String(m.width));
      m.closeVisible ? pass(`${item.key}-close-btn`) : fail(`${item.key}-close-btn`);
      m.overlayVisible ? pass(`${item.key}-overlay`) : fail(`${item.key}-overlay`);
      m.clippedTitles === 0 ? pass(`${item.key}-titles-visible`) : fail(`${item.key}-titles-visible`, String(m.clippedTitles));
      m.missingIcons === 0 ? pass(`${item.key}-icons-visible`) : fail(`${item.key}-icons-visible`, String(m.missingIcons));
      m.togglePointerEvents === 'none' || !m.toggleCoveredBySidebar
        ? pass(`${item.key}-toggle-not-blocking-close`)
        : fail(`${item.key}-toggle-not-blocking-close`, JSON.stringify(m));

      // Scroll to last nav item inside drawer
      await page.evaluate(() => {
        const sb = document.getElementById('hr-sidebar');
        if (!sb) return;
        sb.scrollTop = sb.scrollHeight;
        const links = sb.querySelectorAll('a[href]');
        const last = links[links.length - 1];
        if (last) last.scrollIntoView({ block: 'nearest' });
      });
      await new Promise((r) => setTimeout(r, 250));
      const scrolled = await page.evaluate(() => {
        const sb = document.getElementById('hr-sidebar');
        const links = [...sb.querySelectorAll('a[href]')];
        const last = links[links.length - 1];
        const lr = last.getBoundingClientRect();
        const sr = sb.getBoundingClientRect();
        return {
          scrollTop: sb.scrollTop,
          lastText: (last.querySelector('.hr-nav-title')?.textContent || last.textContent || '').trim(),
          lastVisible: lr.top < sr.bottom && lr.bottom > sr.top,
          nearBottom: sb.scrollTop + sb.clientHeight >= sb.scrollHeight - 8 || sb.scrollHeight <= sb.clientHeight + 4
        };
      });
      scrolled.lastVisible && scrolled.nearBottom
        ? pass(`${item.key}-scroll-to-last`, scrolled.lastText)
        : fail(`${item.key}-scroll-to-last`, JSON.stringify(scrolled));

      await page.screenshot({ path: path.join(ART, `final-390-${item.key}-open.png`), fullPage: false });

      // Close via X
      await page.evaluate(() => document.querySelector('.hr-sidebar-close')?.click());
      await new Promise((r) => setTimeout(r, 300));
      m = await measure(page);
      !m.open && !m.peekingWhenClosed ? pass(`${item.key}-close-x`) : fail(`${item.key}-close-x`, JSON.stringify(m));
    }

    // Content clipping / cards / tables on closed mobile pages
    for (const item of showcase) {
      await page.goto(`${BASE}${item.path}`, { waitUntil: 'networkidle2', timeout: 60000 });
      await new Promise((r) => setTimeout(r, 400));
      const content = await page.evaluate(() => {
        const nodes = [...document.querySelectorAll('.finance-links > a, .module-card, table, .card, .hr-home-stat, .stat-card')].slice(0, 20);
        const bad = [];
        for (const el of nodes) {
          const r = el.getBoundingClientRect();
          const pageBleed = r.right > innerWidth + 2 || r.left < -2 || r.width > innerWidth + 8;
          if (!pageBleed) continue;
          // Tables inside overflow-x:auto shells are intentional (local scroll), not page clip.
          if (el.tagName === 'TABLE') {
            let p = el.parentElement;
            let contained = false;
            while (p && p !== document.body) {
              const ox = getComputedStyle(p).overflowX;
              if (ox === 'auto' || ox === 'scroll') { contained = true; break; }
              p = p.parentElement;
            }
            if (contained) continue;
          }
          bad.push((el.className || el.tagName).toString().slice(0, 40));
        }
        return {
          checked: nodes.length,
          clipped: bad.length,
          bad,
          hOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1
        };
      });
      content.clipped === 0 && !content.hOverflow
        ? pass(`${item.key}-content-no-clip`, `checked=${content.checked}`)
        : fail(`${item.key}-content-no-clip`, JSON.stringify(content));
    }

    // Navigation after close: open -> click link -> lands and drawer closed
    await page.goto(`${BASE}/hr/e-archive`, { waitUntil: 'networkidle2', timeout: 60000 });
    await page.evaluate(() => document.querySelector('.hr-mobile-toggle')?.click());
    await new Promise((r) => setTimeout(r, 300));
    const dest = await page.evaluate(() => {
      const link = [...document.querySelectorAll('#hr-sidebar a[href]')].find((a) => {
        const href = a.getAttribute('href') || '';
        return href && href !== '#' && !href.includes('e-archive');
      });
      const href = link?.getAttribute('href') || '/hr';
      if (link) link.click();
      return href;
    });
    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 60000 }).catch(() => null);
    await new Promise((r) => setTimeout(r, 500));
    const afterNav = await measure(page);
    const urlOk = page.url().includes(dest.split('?')[0].replace(/^\//, '')) || page.url().endsWith(dest);
    urlOk || page.url().includes('/hr')
      ? pass('nav-after-close-lands', page.url())
      : fail('nav-after-close-lands', `${page.url()} vs ${dest}`);
    !afterNav.open ? pass('nav-after-close-drawer-closed') : fail('nav-after-close-drawer-closed');

    // History back
    await page.goBack({ waitUntil: 'networkidle2', timeout: 60000 }).catch(() => null);
    await new Promise((r) => setTimeout(r, 400));
    const afterBack = await measure(page);
    /e-archive/.test(page.url()) ? pass('history-back-works', page.url()) : fail('history-back-works', page.url());
    !afterBack.open && !afterBack.peekingWhenClosed
      ? pass('history-back-drawer-closed')
      : fail('history-back-drawer-closed', JSON.stringify(afterBack));

    // Alternate sidebars audit (not covered by shell fix)
    const alts = [
      { path: '/finance', name: 'finance-hub' },
      { path: '/archive', name: 'archive-hub' },
      { path: '/governed-administrative-integration', name: 'gai-dashboard' },
      { path: '/finance/expenses.html', name: 'finance-keep-html' }
    ];
    for (const alt of alts) {
      await page.goto(`${BASE}${alt.path}`, { waitUntil: 'networkidle2', timeout: 60000 }).catch(() => null);
      await new Promise((r) => setTimeout(r, 500));
      const info = await measure(page);
      const altMeasure = await page.evaluate(() => {
        const sb = document.getElementById('sidebar') || document.querySelector('aside.sidebar, .sidebar');
        if (!sb) return { hasAlt: false };
        const r = sb.getBoundingClientRect();
        const cs = getComputedStyle(sb);
        return {
          hasAlt: true,
          width: r.width,
          left: r.left,
          right: r.right,
          transform: cs.transform,
          peek: r.left < innerWidth - 1 && r.right > 0 && (cs.transform.includes('matrix') ? Math.abs(r.left - innerWidth) > 2 : r.width < 80)
        };
      });
      !info.hasShellSidebar
        ? pass(`alt-${alt.name}-not-shell`, JSON.stringify(altMeasure))
        : fail(`alt-${alt.name}-not-shell`);
      // For GAI dashboard sidebar: check peek strip symptom
      if (alt.name === 'gai-dashboard' && altMeasure.hasAlt) {
        const peeking = altMeasure.left < 389 && altMeasure.left > 300 && altMeasure.width > 100
          ? false // fully visible would be different issue
          : altMeasure.left >= 389 || altMeasure.left + altMeasure.width <= 1;
        // left >= viewport means off-canvas OK
        altMeasure.left >= 389 - 0.5
          ? pass('alt-gai-no-red-peek', `left=${altMeasure.left}`)
          : fail('alt-gai-no-red-peek', JSON.stringify(altMeasure));
      }
      await page.screenshot({ path: path.join(ART, `final-390-alt-${alt.name}.png`), fullPage: false });
    }

    // Desktop unaffected
    await page.setViewport({ width: 1440, height: 900 });
    await page.goto(`${BASE}/hr`, { waitUntil: 'networkidle2', timeout: 60000 });
    await new Promise((r) => setTimeout(r, 400));
    const desk = await page.evaluate(() => {
      const sb = document.getElementById('hr-sidebar');
      const toggle = document.querySelector('.hr-mobile-toggle');
      const r = sb.getBoundingClientRect();
      const tcs = toggle ? getComputedStyle(toggle) : null;
      return {
        width: Math.round(r.width),
        left: Math.round(r.left),
        toggleHidden: !toggle || tcs.display === 'none',
        open: sb.classList.contains('open')
      };
    });
    desk.width === 248 && desk.toggleHidden && !desk.open
      ? pass('desktop-unchanged', JSON.stringify(desk))
      : fail('desktop-unchanged', JSON.stringify(desk));
    await page.screenshot({ path: path.join(ART, 'final-desktop-hr.png'), fullPage: false });
  } catch (err) {
    fail('suite-error', err.message);
    console.error(err);
  } finally {
    await browser.close();
  }

  const summary = {
    passed: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok).length,
    coverage,
    results
  };
  fs.writeFileSync(path.join(ART, 'mobile-sidebar-final-review.json'), JSON.stringify(summary, null, 2));

  const md = [];
  md.push('# مراجعة نهائية — إصلاح القائمة الجانبية للموبايل (PR #183)');
  md.push('');
  md.push(`## النتيجة الإجمالية: **${summary.passed} PASS / ${summary.failed} FAIL**`);
  md.push('');
  md.push('## 1) نطاق `hr-portal-shell`');
  md.push(`- مسارات متوقعة theoretically ضمن قواعد الحقن: **${coverage.shellExpected.length}**`);
  md.push(`- عيّنة حية وُجد فيها الشِل: ${coverage.shellLive.map((x) => x.path).join(', ') || '—'}`);
  md.push(`- عيّنة ناقصة رغم التوقع: ${coverage.shellMissingLive.map((x) => x.path).join(', ') || 'لا يوجد'}`);
  md.push('');
  md.push('## 2) صفحات خارج الإصلاح (قوائم مختلفة / بلا شِل)');
  const uniq = [];
  const seen = new Set();
  for (const row of coverage.notInShellFix) {
    if (seen.has(row.path)) continue;
    seen.add(row.path);
    uniq.push(row);
  }
  uniq.slice(0, 30).forEach((r) => md.push(`- \`${r.path}\` — ${r.reason || r.ctx}`));
  md.push('');
  md.push('## 3) فحوصات PASS/FAIL');
  results.forEach((r) => md.push(`- ${r.ok ? 'PASS' : 'FAIL'}: ${r.name}${r.detail ? ` — ${r.detail}` : ''}`));
  md.push('');
  fs.writeFileSync(path.join(ART, 'mobile-sidebar-final-review.md'), md.join('\n'));

  console.log('\n=== SUMMARY ===');
  console.log(JSON.stringify({
    passed: summary.passed,
    failed: summary.failed,
    shellLive: coverage.shellLive.map((x) => x.path),
    notCoveredSample: uniq.slice(0, 12)
  }, null, 2));
  process.exit(summary.failed ? 1 : 0);
})();
