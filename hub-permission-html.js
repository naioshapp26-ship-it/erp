const path = require('path');
const { filterHubHtml } = require('./hub-html-filter');

const HUB_PERMISSION_HTML_RELATIVE_PATHS = new Set([
  'finance/index.html',
  'finance/archive-home.html',
  'finance/hr-home.html'
]);

function resolveProjectHtmlPath(rootDir, requestPath = '') {
  const relative = String(requestPath || '').replace(/^\/+/, '');
  return path.join(rootDir, relative);
}

function isHubPermissionHtmlFile(rootDir, filePath) {
  const relative = path.relative(rootDir, filePath).split(path.sep).join('/');
  return HUB_PERMISSION_HTML_RELATIVE_PATHS.has(relative);
}

function applyHubPermissionFilterToHtml(html, filePath, req, rootDir = path.join(__dirname)) {
  if (!html || !req?.tenant || !req?.tenantPermissionBundle) {
    return html;
  }
  if (!isHubPermissionHtmlFile(rootDir, filePath)) {
    return html;
  }
  return filterHubHtml(html, req.tenant, req.tenantPermissionBundle);
}

module.exports = {
  HUB_PERMISSION_HTML_RELATIVE_PATHS,
  resolveProjectHtmlPath,
  isHubPermissionHtmlFile,
  applyHubPermissionFilterToHtml
};
