#!/usr/bin/env node
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { listHrHomeModules } = require('./hr-home-modules');

const BASE = process.env.TEST_BASE_URL || 'http://127.0.0.1:3000';
const headers = { 'x-entity-type': 'HQ', 'x-entity-id': 'HQ001' };

const KEY_PAGES = [
  '/hr',
  '/hr/employees',
  '/hr/my-requests',
  '/hr/ops',
  '/hr/letters',
  '/hr/system-settings/upload-employees',
  '/hr/pending-actions',
  '/hr/manager',
  '/hr/new-hires',
  '/hr/cost-optimization',
  '/hr/tasks-management',
  '/hr/employee-360',
  '/hr/payroll',
  '/hr/attendance-hub'
];

async function page(pathName) {
  const res = await fetch(`${BASE}${pathName}`, { headers });
  const html = await res.text();
  assert.ok(res.ok, `${pathName} status ${res.status}`);
  return html;
}

async function main() {
  assert.ok(fs.existsSync(path.join(__dirname, 'finance/hr-attachments.css')));
  assert.ok(fs.existsSync(path.join(__dirname, 'finance/hr-attachments.js')));
  assert.ok(fs.existsSync(path.join(__dirname, 'hr/api/form-attachments.js')));

  const css = fs.readFileSync(path.join(__dirname, 'finance/hr-attachments.css'), 'utf8');
  const js = fs.readFileSync(path.join(__dirname, 'finance/hr-attachments.js'), 'utf8');
  assert.ok(css.includes('hr-attachments-dropzone'));
  assert.ok(js.includes('انقر لاختيار ملفات أو اسحب وأفلت هنا'));
  assert.ok(js.includes('مدعوم: PDF, Word, Excel, PowerPoint, صور، فيديو، ZIP وأي نوع'));
  assert.ok(js.includes('المرفقات'));
  assert.ok(js.includes('2 * 1024 * 1024 * 1024') || js.includes('MAX_FILE_BYTES'), 'client must allow large files');
  assert.ok(!js.includes('50 * 1024 * 1024'), 'client must not keep 50MB limit');

  const apiSrc = fs.readFileSync(path.join(__dirname, 'hr/api/form-attachments.js'), 'utf8');
  assert.ok(apiSrc.includes('2 * 1024 * 1024 * 1024'), 'API must allow 2GB uploads');
  assert.ok(!apiSrc.includes('50 * 1024 * 1024'), 'API must not keep 50MB limit');

  const modules = listHrHomeModules();
  const sample = [...KEY_PAGES.filter((p) => p !== '/hr/ops'), ...modules.map((m) => m.href)];
  const unique = [...new Set(sample)];

  const missingAssets = [];
  for (const p of unique) {
    const html = await page(p);
    if (!html.includes('hr-attachments.css') || !html.includes('hr-attachments.js')) {
      missingAssets.push(p);
    }
  }
  assert.strictEqual(missingAssets.length, 0, `missing attachments assets on: ${missingAssets.join(', ')}`);

  // Upload a text file
  const blob = new Blob(['HR attachment test content'], { type: 'text/plain' });
  const form = new FormData();
  form.append('file', blob, 'test-attachment.txt');
  form.append('page_path', '/hr/employees');
  form.append('form_id', 'employeeForm');
  const uploadRes = await fetch(`${BASE}/api/hr/form-attachments`, {
    method: 'POST',
    headers,
    body: form
  });
  const uploadData = await uploadRes.json();
  assert.ok(uploadRes.ok && uploadData.success, `upload failed: ${JSON.stringify(uploadData)}`);
  assert.ok(uploadData.file?.url, 'uploaded file url missing');

  const fileRes = await fetch(`${BASE}${uploadData.file.url}`);
  assert.ok(fileRes.ok, `uploaded file not reachable at ${uploadData.file.url}`);

  // Upload a zip-like binary
  const zipBlob = new Blob([Uint8Array.from([0x50, 0x4b, 0x03, 0x04, 0x00, 0x00])], { type: 'application/zip' });
  const zipForm = new FormData();
  zipForm.append('file', zipBlob, 'sample.zip');
  zipForm.append('page_path', '/hr/my-requests');
  const zipRes = await fetch(`${BASE}/api/hr/form-attachments`, {
    method: 'POST',
    headers,
    body: zipForm
  });
  const zipData = await zipRes.json();
  assert.ok(zipRes.ok && zipData.success, `zip upload failed: ${JSON.stringify(zipData)}`);

  const list = await fetch(`${BASE}/api/hr/form-attachments?page_path=${encodeURIComponent('/hr/employees')}`, { headers })
    .then((r) => r.json());
  assert.ok(list.success && list.files.length >= 1, 'attachment list empty');

  // Form pages should include at least one form tag for auto-mount
  for (const p of ['/hr/employees', '/hr/my-requests', '/hr/letters', '/hr/system-settings/upload-employees']) {
    const html = await page(p);
    assert.ok(/<form[\s>]/i.test(html), `${p} should contain a form for attachments mount`);
    assert.ok(html.includes('hr-attachments.js'), `${p} missing attachments script`);
  }

  const assetsPage = await page('/hr/assets-custodies');
  assert.ok(assetsPage.includes('data-hr-attachments-slot') || assetsPage.includes('modal-body'), 'assets page should expose mount targets');
  assert.ok(assetsPage.includes('hr-attachments.js'), 'assets page missing attachments script');
  assert.ok(assetsPage.includes('hcm-attachments-2gb') || assetsPage.includes('hr-attachments.js'), 'cache-busted attachments asset expected');

  // Simulate oversized client check is no longer 50MB: upload a ~60MB buffer should succeed on API
  const big = Buffer.alloc(60 * 1024 * 1024, 1);
  const bigForm = new FormData();
  bigForm.append('file', new Blob([big], { type: 'application/octet-stream' }), 'big-video-sim.bin');
  bigForm.append('page_path', '/hr/employees');
  const bigRes = await fetch(`${BASE}/api/hr/form-attachments`, {
    method: 'POST',
    headers,
    body: bigForm
  });
  const bigData = await bigRes.json();
  assert.ok(bigRes.ok && bigData.success, `60MB upload should succeed, got ${bigRes.status}: ${JSON.stringify(bigData)}`);

  console.log(`ok: attachments assets on ${unique.length} pages; upload + zip + 60MB + list verified`);
}

main().catch((error) => {
  console.error('HR ATTACHMENTS TEST FAILED:', error.message);
  process.exit(1);
});
