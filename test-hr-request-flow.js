/**
 * Automated API flow test for HR leave + advance requests.
 * Run: node test-hr-request-flow.js
 */
const BASE = process.env.TEST_BASE_URL || 'http://127.0.0.1:3000';
const headers = {
  'Content-Type': 'application/json',
  'x-entity-type': 'HQ',
  'x-entity-id': 'HQ001'
};

async function api(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, { headers, ...options });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`${options.method || 'GET'} ${path} -> ${res.status}: ${data.error || res.statusText}`);
  }
  return data;
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function main() {
  console.log('🔍 Health check...');
  await api('/api/health');

  const today = new Date();
  const start = today.toISOString().slice(0, 10);
  const endDate = new Date(today); endDate.setDate(today.getDate() + 2);
  const end = endDate.toISOString().slice(0, 10);

  console.log('📝 Submit leave request...');
  const leave = await api('/api/leave-requests', {
    method: 'POST',
    body: JSON.stringify({
      employee_name: 'موظف اختبار الإجازة',
      employee_id: 'EMP-TEST-LEAVE',
      department: 'الموارد البشرية',
      leave_type: 'سنوية',
      start_date: start,
      end_date: end,
      reason: 'اختبار تدفق الإجازة',
      entity_id: 'HQ001'
    })
  });
  assert(leave.id, 'leave id missing');
  const leaveReqId = `LR-${leave.id}`;

  console.log('💰 Submit advance request...');
  const advanceId = `ADV-TEST-${Date.now()}`;
  const advance = await api('/api/employee-requests', {
    method: 'POST',
    body: JSON.stringify({
      id: advanceId,
      entityId: 'HQ001',
      employeeId: 'EMP-TEST-ADV',
      employeeName: 'موظف اختبار السلفة',
      requestType: 'سلفة',
      requestTitle: 'طلب سلفة بمبلغ 2500 ر.س',
      description: 'اختبار تدفق السلفة',
      requestedDate: start,
      requestData: { amount: 2500, installments: 5, reason: 'اختبار' }
    })
  });
  assert(advance.success && advance.request, 'advance create failed');
  assert(advance.request.current_stage === 'manager', `advance stage expected manager got ${advance.request.current_stage}`);

  console.log('📬 Check pending actions...');
  const pending = await api('/api/hr/pending-actions');
  assert(pending.count >= 2, `expected >=2 pending, got ${pending.count}`);
  const hasLeave = pending.requests.some((r) => r.id === leaveReqId);
  const hasAdvance = pending.requests.some((r) => r.id === advanceId);
  assert(hasLeave, 'leave not in pending actions');
  assert(hasAdvance, 'advance not in pending actions');

  console.log('✅ Approve leave at manager stage...');
  const leaveStep1 = await api(`/api/employee-requests/${encodeURIComponent(leaveReqId)}/decide`, {
    method: 'POST',
    body: JSON.stringify({ decision: 'approve', actorName: 'المدير المباشر', notes: 'موافق مبدئياً' })
  });
  assert(leaveStep1.request.current_stage === 'hr', `leave should move to hr, got ${leaveStep1.request.current_stage}`);
  assert(leaveStep1.request.status === 'PENDING', 'leave should still be pending after manager');

  console.log('✅ Approve leave at HR stage (final)...');
  const leaveFinal = await api(`/api/employee-requests/${encodeURIComponent(leaveReqId)}/decide`, {
    method: 'POST',
    body: JSON.stringify({ decision: 'approve', actorName: 'الموارد البشرية', notes: 'معتمد' })
  });
  assert(leaveFinal.request.status === 'APPROVED', 'leave should be approved');
  assert(leaveFinal.request.current_stage === 'completed', 'leave stage should be completed');

  console.log('✅ Approve advance through full chain...');
  let current = advance.request;
  const actors = {
    manager: 'المدير المباشر',
    hr: 'الموارد البشرية',
    supervisor: 'المشرف العام',
    executive: 'المدير التنفيذي',
    finance: 'المالية'
  };
  while (current.status === 'PENDING') {
    const stage = current.current_stage;
    const decided = await api(`/api/employee-requests/${encodeURIComponent(advanceId)}/decide`, {
      method: 'POST',
      body: JSON.stringify({ decision: 'approve', actorName: actors[stage] || stage, notes: `موافقة ${stage}` })
    });
    current = decided.request;
    console.log(`   → after ${stage}: status=${current.status} stage=${current.current_stage}`);
  }
  assert(current.status === 'APPROVED', 'advance should be fully approved');

  const pendingAfter = await api('/api/hr/pending-actions?count_only=1');
  console.log(`🎉 Flow OK. Remaining pending count: ${pendingAfter.count}`);
}

main().catch((err) => {
  console.error('❌ TEST FAILED:', err.message);
  process.exit(1);
});
