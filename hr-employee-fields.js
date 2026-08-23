'use strict';

const EMPLOYEE_NUMBER_KEY = 'employee_number';
const EMPLOYEE_ID_KEY = 'employee_id';
const EMPLOYEE_NUMBER_LABEL = 'رقم الموظف';

const EMPLOYEE_SCOPED_SETTING_KEYS = new Set([
  'users',
  'employee-export-templates',
  'employee-fields',
  'data-upload',
  'upload-employees',
  'upload-salaries',
  'upload-managers',
  'upload-dependents',
  'upload-assets',
  'upload-bank-accounts'
]);

function catalogEmployeeNumberField() {
  return {
    key: EMPLOYEE_NUMBER_KEY,
    label: EMPLOYEE_NUMBER_LABEL,
    type: 'text',
    required: true
  };
}

function opsEmployeeIdField() {
  return {
    key: EMPLOYEE_ID_KEY,
    label: EMPLOYEE_NUMBER_LABEL,
    type: 'text',
    required: true
  };
}

function withCatalogEmployeeNumber(fields = []) {
  if (!Array.isArray(fields)) return fields;
  if (fields.some((field) => field.key === EMPLOYEE_NUMBER_KEY || field.key === EMPLOYEE_ID_KEY)) {
    return fields.map((field) => (
      field.key === EMPLOYEE_ID_KEY
        ? { ...field, key: EMPLOYEE_NUMBER_KEY, label: EMPLOYEE_NUMBER_LABEL, required: true }
        : field.key === EMPLOYEE_NUMBER_KEY
          ? { ...field, label: EMPLOYEE_NUMBER_LABEL, required: true }
          : field
    ));
  }
  const codeIndex = fields.findIndex((field) => field.key === 'code');
  const insertAt = codeIndex >= 0 ? codeIndex + 1 : 0;
  return [
    ...fields.slice(0, insertAt),
    catalogEmployeeNumberField(),
    ...fields.slice(insertAt)
  ];
}

function withOpsEmployeeId(fields = []) {
  if (!Array.isArray(fields)) return fields;
  const hasEmployeeName = fields.some((field) => field.key === 'employee_name');
  if (!hasEmployeeName) return fields;

  let next = fields.map((field) => (
    field.key === EMPLOYEE_ID_KEY
      ? { ...field, label: EMPLOYEE_NUMBER_LABEL, required: true }
      : field
  ));

  if (!next.some((field) => field.key === EMPLOYEE_ID_KEY || field.key === EMPLOYEE_NUMBER_KEY)) {
    const nameIndex = next.findIndex((field) => field.key === 'employee_name');
    next.splice(nameIndex, 0, opsEmployeeIdField());
  }

  return next;
}

function settingRequiresEmployeeNumber(key) {
  return EMPLOYEE_SCOPED_SETTING_KEYS.has(String(key || '').trim());
}

function payloadEmployeeNumber(body = {}) {
  return String(
    body.employee_number
    || body.employee_id
    || body.employeeId
    || (body.data && (body.data.employee_number || body.data.employee_id))
    || ''
  ).trim();
}

function moduleRequiresEmployeeNumber(fields = []) {
  return fields.some((field) => field.key === 'employee_name');
}

module.exports = {
  EMPLOYEE_NUMBER_KEY,
  EMPLOYEE_ID_KEY,
  EMPLOYEE_NUMBER_LABEL,
  EMPLOYEE_SCOPED_SETTING_KEYS,
  catalogEmployeeNumberField,
  opsEmployeeIdField,
  withCatalogEmployeeNumber,
  withOpsEmployeeId,
  settingRequiresEmployeeNumber,
  payloadEmployeeNumber,
  moduleRequiresEmployeeNumber
};
