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
    if (String(uploadsRootDir).includes('/data')) return false;
    return Boolean(process.env.RAILWAY_ENVIRONMENT);
}

module.exports = {
    resolveUploadsRootDir,
    isEphemeralUploadStorage
};
