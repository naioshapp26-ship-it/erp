/**
 * Prove first logical Arabic chars sit on the physical RIGHT of the track (RTL),
 * and that the RIGHT edge enters the LEFT banner edge first.
 */
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');
const { spawnSync } = require('child_process');

const OUT = '/opt/cursor/artifacts';
const REAL = '🔥 خصومات على الخدمات 🔥 | 🚀 ابدأ الآن | 📢 عروض محدودة';
const FRAMES = path.join(OUT, 'announcement-real-frames');
const CSS = fs.readFileSync('/workspace/newhome/styles.css', 'utf8');

fs.mkdirSync(FRAMES, { recursive: true });

const fixture = path.join(OUT, '_announcement-real-fixture.html');
fs.writeFileSync(fixture, `<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<style>
${CSS.match(/body\.homepage \.announcement-bar[\s\S]*?@keyframes homepageAnnouncementSlide[\s\S]*?\n\}/)[0]}
:root{--announcement-speed:10s;--announcement-bar-height:50px;--announcement-bg:#1a0208;--announcement-text:#fff}
body{margin:0;background:#0b0b0b;font-family:Cairo,Tahoma,sans-serif}
.marker{position:fixed;left:0;top:0;bottom:0;width:3px;background:#22c55e;z-index:9}
.caption{color:#ddd;padding:14px 16px;font-size:14px;line-height:1.7}
</style></head>
<body class="homepage">
<div class="announcement-bar" id="bar"><div class="announcement-track" id="track">${REAL}</div></div>
<div class="marker"></div>
<p class="caption">الخط الأخضر = الطرف الأيسر. يجب أن تدخل «خصومات» (بداية الجملة) من اليسار أولًا.</p>
</body></html>`);

(async () => {
  const browser = await puppeteer.launch({
    executablePath: '/usr/local/bin/google-chrome',
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1100,260']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1100, height: 240 });
  await page.goto('file://' + fixture, { waitUntil: 'domcontentloaded' });

  const order = await page.evaluate(() => {
    const track = document.getElementById('track');
    const text = track.firstChild;
    const rFirst = document.createRange();
    // first Arabic letter after emoji: خصومات starts around index of خ
    const full = track.textContent;
    const idxKhasm = full.indexOf('خ');
    const idxMahdooda = full.indexOf('م', full.indexOf('محدودة'));
    rFirst.setStart(text, idxKhasm);
    rFirst.setEnd(text, idxKhasm + 1);
    const rLast = document.createRange();
    rLast.setStart(text, idxMahdooda);
    rLast.setEnd(text, idxMahdooda + 1);
    const a = rFirst.getBoundingClientRect();
    const b = rLast.getBoundingClientRect();
    const cs = getComputedStyle(track);
    const bar = getComputedStyle(document.getElementById('bar'));
    return {
      barDir: bar.direction,
      trackDir: cs.direction,
      khasemX: a.left,
      mahdoodaX: b.left,
      startIsOnRight: a.left > b.left,
      full
    };
  });

  // Pause near entry: right edge of track just inside left
  await page.evaluate(() => {
    const track = document.getElementById('track');
    track.getAnimations().forEach((a) => a.cancel());
    const anim = track.animate(
      [{ transform: 'translateX(-100%)' }, { transform: 'translateX(100vw)' }],
      { duration: 10000, fill: 'forwards', easing: 'linear' }
    );
    anim.pause();
    anim.currentTime = 900; // early entry
    window.__anim = anim;
  });

  const early = await page.evaluate(() => {
    const bar = document.getElementById('bar').getBoundingClientRect();
    const track = document.getElementById('track').getBoundingClientRect();
    const full = document.getElementById('track').textContent;
    const text = document.getElementById('track').firstChild;
    const idx = full.indexOf('خ');
    const r = document.createRange();
    r.setStart(text, idx);
    r.setEnd(text, idx + 6); // خصومات
    const khasem = r.getBoundingClientRect();
    return {
      trackLeft: track.left,
      trackRight: track.right,
      khasemLeft: khasem.left,
      khasemRight: khasem.right,
      barLeft: bar.left,
      khasemVisibleNearLeft: khasem.left < 180 && khasem.right > 0
    };
  });

  await page.screenshot({ path: path.join(OUT, 'announcement-real-early-entry.png') });
  const barEl = await page.$('#bar');
  await barEl.screenshot({ path: path.join(FRAMES, 'early.png') });

  // Record frames 0→entry
  await page.evaluate(() => {
    window.__anim.cancel();
    window.__anim = document.getElementById('track').animate(
      [{ transform: 'translateX(-100%)' }, { transform: 'translateX(100vw)' }],
      { duration: 7000, fill: 'forwards', easing: 'linear' }
    );
  });

  for (let i = 0; i < 40; i++) {
    await page.screenshot({ path: path.join(FRAMES, `f${String(i).padStart(3, '0')}.png`) });
    await new Promise((r) => setTimeout(r, 100));
  }

  const video = path.join(OUT, 'announcement-marquee-left-entry-demo.mp4');
  const ff = spawnSync('ffmpeg', [
    '-y', '-framerate', '10',
    '-i', path.join(FRAMES, 'f%03d.png'),
    '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2',
    '-pix_fmt', 'yuv420p', video
  ], { encoding: 'utf8' });

  const report = {
    ok: order.startIsOnRight && early.khasemVisibleNearLeft && ff.status === 0,
    order,
    early,
    video,
    ffmpeg: ff.status
  };
  fs.writeFileSync(path.join(OUT, 'announcement-char-order-uat.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  await browser.close();
  if (!report.ok) process.exit(1);
})().catch((e) => { console.error(e); process.exit(1); });
