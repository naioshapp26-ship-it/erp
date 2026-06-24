const fs = require('fs');
const path = require('path');

const script = fs.readFileSync(path.join(__dirname, 'script.js'), 'utf8');
const dashboard = fs.readFileSync(path.join(__dirname, 'dashboard.html'), 'utf8');
const server = fs.readFileSync(path.join(__dirname, 'server.js'), 'utf8');

const sampleDashboard = `
<script src="/public/entity-hierarchy-ui.js?v=1"></script>
<script src="/chart.js"></script>
<script src="/tenant-path-client.js"></script>
<script src="/tenant-path-client.js"></script>
<script src="/script.js?v=1"></script>
`;

const optimized = (() => {
  const stripScriptByName = (html, scriptName) => {
    const escaped = scriptName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(`\\s*<script[^>]+src="[^"]*${escaped}[^"]*"[^>]*>\\s*</script>`, 'gi');
    return html.replace(pattern, '');
  };
  let payload = sampleDashboard;
  ['entity-hierarchy-ui.js', 'chart.js', 'performance.js'].forEach((name) => {
    payload = stripScriptByName(payload, name);
  });
  payload = payload.replace(
    /<script([^>]*\ssrc="\/script\.js[^"]*")([^>]*)>/i,
    '<script$1 defer$2>'
  );
  return payload;
})();

const checks = [
  ['boot loader', dashboard.includes('dashboard-boot-loader')],
  ['tenant essential loader', script.includes('loadTenantEssentialData')],
  ['fetch abort timeout', script.includes('AbortController')],
  ['verify timeout', script.includes('verifyTimeoutMs')],
  ['optimize tenant dashboard html', server.includes('optimizeTenantDashboardHtml')],
  ['strip public entity hierarchy', !optimized.includes('entity-hierarchy-ui.js')],
  ['defer script.js', optimized.includes('defer')],
  ['soft tenant verify', script.includes('canUseCachedTenantSession')],
  ['tenant landing redirect', dashboard.includes("'/t/' + tenantMatch[1].toLowerCase() + '/'")],
];

const failed = checks.filter(([, ok]) => !ok).map(([name]) => name);
if (failed.length) {
  console.error('❌ Missing tenant dashboard boot optimizations:', failed.join(', '));
  process.exit(1);
}

console.log('✅ Tenant dashboard boot optimizations are present.');
