'use strict';

const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, 'finance', 'hr-section.html'), 'utf8');

const checks = [
  ['custom type option marker', html.includes('ARCHIVE_CUSTOM_TYPE_VALUE') && html.includes('__custom_archive_type__')],
  ['custom type input field', html.includes('id="recordArchiveTypeCustom"') && html.includes('recordArchiveTypeCustomWrap')],
  ['add new type option label', html.includes('إضافة نوع جديد')],
  ['expanded archive types', html.includes('شهادات ومؤهلات') && html.includes('سلامة وصحة مهنية')],
  ['persist custom types', html.includes('hr_e_archive_custom_doc_types') && html.includes('rememberCustomArchiveType')],
  ['resolve selected type helper', html.includes('getSelectedArchiveDocType') && html.includes('setArchiveDocTypeValue')],
  ['save uses selected helper', html.includes('getSelectedArchiveDocType()')],
  ['refresh merges stored + records', html.includes('getArchiveTypeOptions') && html.includes('refreshArchiveTypeSelects')]
];

const failed = checks.filter(([, ok]) => !ok).map(([name]) => name);
if (failed.length) {
  console.error('test-hr-archive-custom-doc-type failed:', failed.join(', '));
  process.exit(1);
}

console.log('test-hr-archive-custom-doc-type: ok');
