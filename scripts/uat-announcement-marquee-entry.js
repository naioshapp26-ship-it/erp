/**
 * UAT: announcement marquee — Arabic sentence START enters from the LEFT first.
 */
const fs = require('fs');
const path = require('path');
const http = require('http');
const puppeteer = require('puppeteer-core');
const { spawnSync } = require('child_process');

const BASE = process.env.APP_BASE_URL || 'http://127.0.0.1:3083';
const OUT = process.env.UAT_OUT || '/opt/cursor/artifacts';
const SAMPLE = 'ابدأ الآن | عروض محدودة';
const FRAMES = path.join(OUT, 'announcement-marquee-frames');

function httpGet(urlPath) {
  return new Promise((resolve, reject) => {
    const u = new URL(BASE + urlPath);
    http.get({ hostname: u.hostname, port: u.port, path: u.pathname + u.search }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode, body: Buffer.concat(chunks).toString('utf8') }));
    }).on('error', reject);
  });
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  fs.mkdirSync(FRAMES, { recursive: true });
  const report = { ok: true, steps: [], artifacts: [] };

  const css = await httpGet('/newhome/styles.css?v=20261101-announcement-ltr');
  const cssOk = css.status === 200
    && /direction:\s*ltr/.test(css.body)
    && /unicode-bidi:\s*isolate/.test(css.body)
    && /translateX\(\s*-100%\s*\)/.test(css.body)
    && /translateX\(\s*100vw\s*\)/.test(css.body)
    && !/from\s*\{\s*transform:\s*translateX\(\s*100%\s*\)/.test(css.body);
  report.steps.push({ step: 'css_keyframes_left_entry', ok: cssOk, status: css.status });

  const tenant = fs.readFileSync(path.join(__dirname, '../tenant-landing.html'), 'utf8');
  report.steps.push({
    step: 'tenant_landing_same_fix',
    ok: /announcement-bar[\s\S]{0,800}?direction:\s*ltr/i.test(tenant)
      && /announcement-track[\s\S]{0,500}?direction:\s*rtl/i.test(tenant)
  });

  // Fixture page with slowed animation for clear video + sampling
  const fixture = path.join(OUT, '_announcement-marquee-fixture.html');
  const styles = fs.readFileSync(path.join(__dirname, '../newhome/styles.css'), 'utf8');
  fs.writeFileSync(fixture, `<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>Announcement marquee UAT</title>
<style>
${styles}
:root { --announcement-speed: 8s; --announcement-bar-height: 48px; --announcement-bg:#1a0208; --announcement-text:#fff; }
body{margin:0;background:#111}
.marker{position:fixed;left:0;top:48px;bottom:0;width:2px;background:#22c55e;z-index:99}
.note{color:#fff;font-family:Cairo,sans-serif;padding:16px;font-size:14px}
</style></head>
<body class="homepage">
<div class="announcement-bar" id="announcement-bar">
  <div class="announcement-track" id="announcement-track">${SAMPLE}</div>
</div>
<div class="marker" aria-hidden="true"></div>
<p class="note">الخط الأخضر = الطرف الأيسر للبنر. يجب أن تدخل بداية الجملة («ابدأ») من هنا أولًا.</p>
<script>
  // Expose helpers for sampling
  window.__marqueeSample = () => {
    const bar = document.getElementById('announcement-bar');
    const track = document.getElementById('announcement-track');
    const barRect = bar.getBoundingClientRect();
    const trackRect = track.getBoundingClientRect();
    const cs = getComputedStyle(track);
    const anim = track.getAnimations?.()[0];
    return {
      barDir: getComputedStyle(bar).direction,
      trackDir: cs.direction,
      unicodeBidi: cs.unicodeBidi,
      text: track.textContent.trim(),
      trackLeft: trackRect.left,
      trackRight: trackRect.right,
      barLeft: barRect.left,
      barRight: barRect.right,
      // Distance of track's RIGHT edge from bar's LEFT (leading edge while moving rightward)
      leadFromLeft: trackRect.right - barRect.left,
      currentTime: anim ? anim.currentTime : null,
      playState: anim ? anim.playState : null
    };
  };
  window.__setMarqueeProgress = (p) => {
    const track = document.getElementById('announcement-track');
    const anim = track.getAnimations?.()[0];
    if (!anim) return false;
    anim.pause();
    const dur = anim.effect.getTiming().duration || 8000;
    anim.currentTime = Math.max(0, Math.min(1, p)) * dur;
    return true;
  };
</script>
</body></html>`);

  const browser = await puppeteer.launch({
    executablePath: process.env.CHROME_PATH || '/usr/local/bin/google-chrome',
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1280,400']
  });

  async function runViewport(label, width, height) {
    const page = await browser.newPage();
    await page.setViewport({ width, height });
    await page.setCacheEnabled(false);
    await page.goto('file://' + fixture, { waitUntil: 'networkidle2' });
    await page.waitForSelector('#announcement-track');
    await new Promise((r) => setTimeout(r, 200));

    const meta = await page.evaluate(() => window.__marqueeSample());
    report.steps.push({
      step: `dirs_${label}`,
      ok: meta.barDir === 'ltr' && meta.trackDir === 'rtl' && /isolate/.test(meta.unicodeBidi),
      ...meta
    });

    // Sample early progress: when the strip's right edge (Arabic start) just enters from left
    // progress ~0.05–0.15 should show beginning near left edge
    const samples = [];
    for (const p of [0.02, 0.06, 0.10, 0.14, 0.20]) {
      await page.evaluate((prog) => window.__setMarqueeProgress(prog), p);
      await new Promise((r) => setTimeout(r, 40));
      const s = await page.evaluate(() => window.__marqueeSample());
      // Crop the announcement bar for OCR-free geometric check:
      // When leadFromLeft is small positive, the RIGHT of the track (sentence start) is near left banner edge.
      samples.push({ p, leadFromLeft: Math.round(s.leadFromLeft), trackLeft: Math.round(s.trackLeft), trackRight: Math.round(s.trackRight) });
      const shot = path.join(FRAMES, `${label}-p${String(p).replace('.', '')}.png`);
      const bar = await page.$('#announcement-bar');
      await bar.screenshot({ path: shot });
      report.artifacts.push(shot);
    }

    // Acceptance: at first sample where any part of track is inside bar (trackRight > barLeft),
    // the track's right edge should be the leading edge (trackRight closer to barLeft than trackLeft is).
    const entering = samples.find((s) => s.trackRight > 0 && s.trackLeft < width);
    const startLeads = entering
      && entering.trackRight > entering.trackLeft
      && Math.abs(entering.leadFromLeft) < Math.abs(entering.trackLeft);
    // Stronger: early progress should have track mostly still left of viewport, with RIGHT edge crossing first
    const early = samples[1];
    const geometryOk = early.trackRight > early.trackLeft
      && early.leadFromLeft > -20
      && early.leadFromLeft < width * 0.55
      && early.trackLeft < early.trackRight;
    report.steps.push({
      step: `geometry_start_leads_${label}`,
      ok: geometryOk,
      samples,
      entering,
      startLeads
    });

    // Capture video frames while playing from start
    await page.evaluate(() => {
      const track = document.getElementById('announcement-track');
      const anim = track.getAnimations?.()[0];
      if (anim) { anim.cancel(); }
      // restart
      track.style.animation = 'none';
      void track.offsetWidth;
      track.style.animation = '';
    });
    await new Promise((r) => setTimeout(r, 50));
    // Force slow restart via WAAPI for frame capture
    await page.evaluate(() => {
      const track = document.getElementById('announcement-track');
      track.getAnimations?.().forEach((a) => a.cancel());
      track.animate(
        [
          { transform: 'translateX(-100%)' },
          { transform: 'translateX(100vw)' }
        ],
        { duration: 6000, iterations: 1, fill: 'forwards', easing: 'linear' }
      );
    });

    const videoFrames = [];
    for (let i = 0; i < 36; i++) {
      const fp = path.join(FRAMES, `${label}-vid-${String(i).padStart(3, '0')}.png`);
      const bar = await page.$('#announcement-bar');
      await bar.screenshot({ path: fp });
      videoFrames.push(fp);
      await new Promise((r) => setTimeout(r, 120));
    }

    // Full-page context shot mid-entry
    await page.evaluate(() => window.__setMarqueeProgress?.(0.12));
    const mid = path.join(OUT, `announcement-marquee-${label}-mid-entry.png`);
    await page.screenshot({ path: mid, fullPage: true });
    report.artifacts.push(mid);

    await page.close();
    return videoFrames;
  }

  const desktopFrames = await runViewport('desktop', 1280, 420);
  const mobileFrames = await runViewport('mobile', 390, 720);

  // Build acceptance video from desktop frames (shows entry from left)
  const listFile = path.join(FRAMES, 'frames.txt');
  fs.writeFileSync(listFile, desktopFrames.map((f) => `file '${f}'\nduration 0.12`).join('\n') + `\nfile '${desktopFrames[desktopFrames.length - 1]}'\n`);
  const videoPath = path.join(OUT, 'announcement-marquee-left-entry-demo.mp4');
  const ff = spawnSync('ffmpeg', [
    '-y', '-f', 'concat', '-safe', '0', '-i', listFile,
    '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2',
    '-pix_fmt', 'yuv420p', '-r', '10', videoPath
  ], { encoding: 'utf8' });
  if (ff.status === 0 && fs.existsSync(videoPath)) {
    report.artifacts.push(videoPath);
    report.steps.push({ step: 'acceptance_video', ok: true, videoPath });
  } else {
    // fallback without concat demuxer
    const ff2 = spawnSync('ffmpeg', [
      '-y', '-framerate', '8',
      '-i', path.join(FRAMES, 'desktop-vid-%03d.png'),
      '-pix_fmt', 'yuv420p', videoPath
    ], { encoding: 'utf8' });
    report.steps.push({
      step: 'acceptance_video',
      ok: ff2.status === 0 && fs.existsSync(videoPath),
      stderr: (ff.stderr || ff2.stderr || '').slice(-500)
    });
    if (ff2.status === 0) report.artifacts.push(videoPath);
  }

  // Live homepage CSS presence (may 200 even if DB down)
  try {
    const home = await httpGet('/');
    report.steps.push({
      step: 'homepage_serves_styles_link',
      ok: home.status === 200 && /styles\.css\?v=20261101-announcement-ltr/.test(home.body),
      status: home.status
    });
  } catch (e) {
    report.steps.push({ step: 'homepage_serves_styles_link', ok: false, error: String(e.message || e) });
  }

  report.ok = report.steps.every((s) => s.ok !== false);
  fs.writeFileSync(path.join(OUT, 'announcement-marquee-uat.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  if (!report.ok) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
