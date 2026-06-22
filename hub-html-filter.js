const { isPathAllowed } = require('./page-permissions-registry');
const { buildCentralTenantEntityId } = require('./tenant-directory-sync');

const HUB_CONTAINER_IDS = ['archive-cards', 'hr-cards', 'finance-cards'];

function normalizeHrefPath(href) {
  const raw = String(href || '').split('?')[0].trim();
  if (!raw || raw.startsWith('#') || raw.startsWith('javascript:')) {
    return null;
  }
  const pathOnly = raw.replace(/\/+$/, '') || '/';
  return pathOnly.startsWith('/') ? pathOnly : `/${pathOnly}`;
}

function buildPermissionContext(tenant, permissionBundle) {
  return {
    tenantType: 'TENANT',
    entityId: buildCentralTenantEntityId(tenant.id),
    allowedPages: permissionBundle.allowed_pages || permissionBundle.allowedPages || [],
    pageRestrictions: permissionBundle.page_restrictions || permissionBundle.pageRestrictions || {}
  };
}

function isHubLinkPath(normalizedPath) {
  return normalizedPath.startsWith('/hr/') || normalizedPath.startsWith('/finance/');
}

function filterAnchorIfNeeded(anchorHtml, permissionContext) {
  const hrefMatch = anchorHtml.match(/href=["']([^"']+)["']/i);
  if (!hrefMatch) {
    return anchorHtml;
  }
  const normalizedPath = normalizeHrefPath(hrefMatch[1]);
  if (!normalizedPath || !isHubLinkPath(normalizedPath)) {
    return anchorHtml;
  }
  return isPathAllowed(normalizedPath, permissionContext) ? anchorHtml : '';
}

function filterAnchorsInBlock(blockHtml, permissionContext) {
  return blockHtml.replace(/<a\b[\s\S]*?<\/a>/gi, (anchorHtml) => (
    filterAnchorIfNeeded(anchorHtml, permissionContext)
  ));
}

function filterHubContainer(html, containerId, permissionContext) {
  const pattern = new RegExp(
    `(<div[^>]*id=["']${containerId}["'][^>]*>)([\\s\\S]*?)(</div>)`,
    'i'
  );
  return html.replace(pattern, (full, open, content, close) => (
    `${open}${filterAnchorsInBlock(content, permissionContext)}${close}`
  ));
}

function filterHubHtml(html, tenant, permissionBundle) {
  if (!tenant || !permissionBundle || !html) {
    return html;
  }

  const permissionContext = buildPermissionContext(tenant, permissionBundle);
  let filtered = html;

  HUB_CONTAINER_IDS.forEach((containerId) => {
    filtered = filterHubContainer(filtered, containerId, permissionContext);
  });

  filtered = filtered.replace(
    /<a(\s[^>]*class=["'][^"']*hero-cta-secondary[^"']*["'][^>]*)href=["']([^"']+)["']([^>]*)>[\s\S]*?<\/a>/gi,
    (anchorHtml) => filterAnchorIfNeeded(anchorHtml, permissionContext)
  );

  filtered = filtered.replace(
    /<nav[^>]*class=["'][^"']*floating-actions[^"']*["'][^>]*>[\s\S]*?<\/nav>/gi,
    (navBlock) => filterAnchorsInBlock(navBlock, permissionContext)
  );

  return filtered;
}

module.exports = {
  filterHubHtml,
  normalizeHrefPath,
  buildPermissionContext
};
