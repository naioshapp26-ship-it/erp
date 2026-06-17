'use strict';

const crypto = require('crypto');
const { decryptDbUrl } = require('../tenant-connection-manager');

const ALGORITHM = 'aes-256-gcm';

function getTenantSettingsKey() {
  const hex = process.env.TENANT_DB_ENCRYPTION_KEY || '';
  if (!hex || hex.length !== 64 || !/^[0-9a-fA-F]{64}$/.test(hex)) {
    return null;
  }
  return Buffer.from(hex, 'hex');
}

function decryptTenantSecret(encrypted) {
  if (!encrypted) return null;
  const key = getTenantSettingsKey();
  if (!key) return null;
  try {
    const parts = String(encrypted).split(':');
    if (parts.length !== 3) return null;
    const [ivHex, tagHex, ctHex] = parts;
    const decipher = crypto.createDecipheriv(ALGORITHM, key, Buffer.from(ivHex, 'hex'));
    decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
    const plain = Buffer.concat([
      decipher.update(Buffer.from(ctHex, 'hex')),
      decipher.final()
    ]);
    return plain.toString('utf8');
  } catch {
    return null;
  }
}

function decryptPlatformSecret(encrypted) {
  if (!encrypted) return null;
  try {
    return decryptDbUrl(encrypted);
  } catch {
    return String(encrypted);
  }
}

function decryptSecretForContext(encrypted, context = 'platform') {
  if (!encrypted) return null;
  if (context === 'tenant') {
    return decryptTenantSecret(encrypted) || decryptPlatformSecret(encrypted);
  }
  return decryptPlatformSecret(encrypted) || decryptTenantSecret(encrypted);
}

module.exports = {
  decryptPlatformSecret,
  decryptTenantSecret,
  decryptSecretForContext,
};
