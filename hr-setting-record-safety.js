'use strict';

function isReadableSettingText(value, { minReadableRatio = 0.45, maxLength = 300 } = {}) {
  const text = String(value ?? '').trim();
  if (!text) return false;
  if (text.length > maxLength) return false;
  if (text.includes('\uFFFD')) return false;

  let readable = 0;
  let control = 0;
  for (const ch of text) {
    const code = ch.charCodeAt(0);
    if (code < 32 && ch !== '\n' && ch !== '\r' && ch !== '\t') {
      control += 1;
      continue;
    }
    if (/[\p{L}\p{N}\s.,:;()%+\-_/\\'"@#&*]/u.test(ch)) readable += 1;
  }

  if (control > 0) return false;
  return readable / text.length >= minReadableRatio;
}

function isCorruptedSettingRecord(row = {}) {
  const name = row.name;
  const code = row.code;
  const nameOk = isReadableSettingText(name);
  const codeOk = !code || isReadableSettingText(code, { minReadableRatio: 0.6, maxLength: 80 });
  return !nameOk || !codeOk;
}

function normalizeSeedData(seed = {}, item = {}) {
  const data = { ...seed };
  if (!data.name) data.name = item.label || 'سجل تشغيلي';
  if (!data.status) data.status = 'نشط';
  return data;
}

module.exports = {
  isReadableSettingText,
  isCorruptedSettingRecord,
  normalizeSeedData
};
