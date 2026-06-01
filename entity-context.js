'use strict';

const DEFAULT_ENTITY_CONTEXT = Object.freeze({
  type: 'HQ',
  id: 'HQ001'
});

const normalizeEntityType = (value) => {
  const normalized = String(value || DEFAULT_ENTITY_CONTEXT.type).trim().toUpperCase();
  return normalized || DEFAULT_ENTITY_CONTEXT.type;
};

const normalizeEntityId = (value, fallback = DEFAULT_ENTITY_CONTEXT.id) => {
  const normalized = String(value || fallback).trim();
  return normalized || fallback;
};

const normalizeEntityContext = (context = {}) => ({
  type: normalizeEntityType(context.type),
  id: normalizeEntityId(context.id)
});

const getRequestEntityContext = (req) => normalizeEntityContext(req?.userEntity || DEFAULT_ENTITY_CONTEXT);

const buildEntityScopeCondition = (context, column = 'entity_id', paramIndex = 1, options = {}) => {
  const { includeGlobalForHq = true } = options;
  const entityContext = normalizeEntityContext(context);
  if (includeGlobalForHq && entityContext.type === 'HQ') {
    return `(${column} = $${paramIndex} OR ${column} IS NULL)`;
  }
  return `${column} = $${paramIndex}`;
};

module.exports = {
  DEFAULT_ENTITY_CONTEXT,
  normalizeEntityContext,
  getRequestEntityContext,
  buildEntityScopeCondition
};
