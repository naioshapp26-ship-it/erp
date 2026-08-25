const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, 'finance', 'hr-my-requests.html'), 'utf8');

const checks = [
  ['HR shell page flag', html.includes('data-hr-page="my-requests"')],
  ['request type cards grid', html.includes('id="requestTypesGrid"')],
  ['unified request modal', html.includes('id="requestModal"') && html.includes('id="unifiedRequestForm"')],
  ['card open helper', html.includes('openRequestModal')],
  ['leave + advance extras', html.includes('id="leaveExtra"') && html.includes('id="advanceExtra"')],
  ['attachments slot in form', html.includes('data-hr-attachments-slot')],
  ['my requests list kept', html.includes('id="requestsList"') && html.includes('طلباتي')],
  ['leave API path', html.includes("/api/leave-requests")],
  ['employee requests API path', html.includes("/api/employee-requests")],
  ['no old leave/advance tabs', !html.includes('id="tabLeave"') && !html.includes('id="leaveForm"')],
  ['includes salary certificate card', html.includes('طلب تعريف بالراتب')],
  ['includes leave card', html.includes("label: 'طلب إجازة'")],
  ['includes advance card', html.includes("label: 'طلب سلفة'")],
];

const failed = checks.filter(([, ok]) => !ok).map(([name]) => name);
if (failed.length) {
  console.error('❌ HR requests cards page missing:', failed.join(', '));
  process.exit(1);
}

console.log('✅ HR requests cards + unified form wiring is present.');
