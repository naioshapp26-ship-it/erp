'use strict';

/**
 * Resolve entity scope from trusted server session first.
 * Never invent HQ001 for non-HQ sessions.
 * HQ may optionally target another entity via explicit query/body/header.
 */

const { getRequestEntityContext } = require('../../entity-context');

function resolveScopedEntityId(req, explicitEntityId = null) {
  const context = getRequestEntityContext(req);
  if (context.type !== 'HQ') {
    return context.id;
  }
  const explicit =
    explicitEntityId ||
    (req.query && req.query.entity_id) ||
    (req.body && req.body.entity_id) ||
    req.headers['x-entity-id'] ||
    null;
  const trimmed = explicit != null ? String(explicit).trim() : '';
  return trimmed || context.id || null;
}

function resolveScopedEntityType(req, explicitEntityType = null) {
  const context = getRequestEntityContext(req);
  if (context.type !== 'HQ') {
    return context.type;
  }
  const explicit =
    explicitEntityType ||
    (req.query && req.query.entity_type) ||
    (req.body && req.body.entity_type) ||
    req.headers['x-entity-type'] ||
    null;
  const trimmed = explicit != null ? String(explicit).trim().toUpperCase() : '';
  return trimmed || context.type || null;
}

module.exports = {
  resolveScopedEntityId,
  resolveScopedEntityType
};
