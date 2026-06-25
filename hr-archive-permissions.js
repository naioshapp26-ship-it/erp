const ARCHIVE_ROLE_PERMISSIONS = {
  admin: new Set(['create', 'update', 'delete', 'upload', 'lock', 'share', 'review', 'archive', 'confidentiality', 'reorder']),
  manager: new Set(['create', 'update', 'upload', 'share', 'review', 'archive', 'confidentiality', 'reorder']),
  archivist: new Set(['create', 'update', 'upload', 'lock', 'share', 'review', 'archive', 'confidentiality', 'reorder']),
  reviewer: new Set(['review', 'share']),
  viewer: new Set([])
};

const ARCHIVE_ADMIN_ROLE_ALIASES = new Set([
  'admin',
  'tenant_admin',
  'super_admin',
  'superadmin',
  'hq admin',
  'super admin'
]);

function decodeRequestHeader(value) {
  if (!value) return '';
  const raw = Array.isArray(value) ? value[0] : value;
  try {
    return decodeURIComponent(String(raw));
  } catch (_) {
    return String(raw);
  }
}

function resolveArchiveRoleKey(rawRole) {
  const role = decodeRequestHeader(rawRole).trim().toLowerCase();
  if (!role) return null;
  if (ARCHIVE_ROLE_PERMISSIONS[role]) return role;
  if (ARCHIVE_ADMIN_ROLE_ALIASES.has(role)) return 'admin';
  if (role.includes('super') && role.includes('admin')) return 'admin';
  if (role.includes('tenant') && role.includes('admin')) return 'admin';
  if (role.includes('admin') || role.includes('hq admin')) return 'admin';
  if (role.includes('manager')) return 'manager';
  if (role.includes('archivist')) return 'archivist';
  if (role.includes('review')) return 'reviewer';
  if (role.includes('viewer')) return 'viewer';
  if (/مسؤول|مدير|مشرف|رئيس/i.test(role)) return 'admin';
  if (/أرشيف|archiv/i.test(role)) return 'archivist';
  if (/مراج/i.test(role)) return 'reviewer';
  if (/مشاهد/i.test(role)) return 'viewer';
  return null;
}

function getArchiveRequestActor(req) {
  const actorName = decodeRequestHeader(req.headers['x-user-name'] || req.headers['x-user']) || 'مستخدم النظام';
  const rawRole = req.headers['x-user-role'] || req.headers['x-role'] || '';
  const actorRole = resolveArchiveRoleKey(rawRole) || 'admin';
  return { actorName, actorRole };
}

function hasArchivePermission(actorRole, action) {
  const permissions = ARCHIVE_ROLE_PERMISSIONS[actorRole] || ARCHIVE_ROLE_PERMISSIONS.viewer;
  return permissions.has(action);
}

function canPerformArchiveAction(req, action, hasAuthToken = false) {
  const { actorRole } = getArchiveRequestActor(req);
  if (hasArchivePermission(actorRole, action)) {
    return true;
  }
  if (!hasAuthToken) {
    return false;
  }
  const authenticatedActions = new Set([
    'create',
    'update',
    'upload',
    'share',
    'review',
    'archive',
    'confidentiality',
    'reorder'
  ]);
  return authenticatedActions.has(action);
}

module.exports = {
  ARCHIVE_ROLE_PERMISSIONS,
  decodeRequestHeader,
  resolveArchiveRoleKey,
  getArchiveRequestActor,
  hasArchivePermission,
  canPerformArchiveAction
};
