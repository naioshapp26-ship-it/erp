const fs = require('fs');
const path = require('path');

function resolveUploadsRootDir(fallbackDir = path.join(__dirname, 'uploads')) {
    if (process.env.UPLOADS_ROOT_DIR) {
        return path.resolve(process.env.UPLOADS_ROOT_DIR);
    }
    if (process.env.RAILWAY_ENVIRONMENT && fs.existsSync('/data')) {
        return '/data/uploads';
    }
    return path.resolve(fallbackDir);
}

function isEphemeralUploadStorage(uploadsRootDir = '') {
    if (process.env.UPLOADS_PERSISTENT === 'true') return false;
    const root = String(uploadsRootDir || '');
    if (root.includes('/data')) return false;
    // Explicit durable mounts / named volumes
    if (process.env.UPLOADS_VOLUME_MOUNTED === 'true') return false;
    // Common ephemeral locations (container local disk, tmp)
    if (root.startsWith('/tmp') || root.includes('/tmp/')) return true;
    return Boolean(process.env.RAILWAY_ENVIRONMENT);
}

module.exports = {
    resolveUploadsRootDir,
    isEphemeralUploadStorage
};
