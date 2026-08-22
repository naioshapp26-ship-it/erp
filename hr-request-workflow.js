/**
 * HR multi-step approval workflow (Malachite/POSHA style).
 * Stages: Direct Manager → HR → General Supervisor → Executive → Finance
 */

const STAGE_DEFS = [
  { key: 'manager', label: 'المدير المباشر', role: 'manager' },
  { key: 'hr', label: 'الموارد البشرية', role: 'hr' },
  { key: 'supervisor', label: 'المشرف العام', role: 'supervisor' },
  { key: 'executive', label: 'المدير التنفيذي', role: 'executive' },
  { key: 'finance', label: 'المالية', role: 'finance' }
];

const STAGE_BY_KEY = Object.fromEntries(STAGE_DEFS.map((s) => [s.key, s]));

const LEAVE_TYPES = new Set(['إجازة', 'اجازة', 'leave', 'LEAVE', 'vacation', 'VACATION']);
const ADVANCE_TYPES = new Set(['سلفة', 'سلف', 'قرض', 'advance', 'ADVANCE', 'loan', 'LOAN', 'loan_request']);

function normalizeType(requestType = '') {
  return String(requestType || '').trim();
}

function isLeaveType(requestType) {
  return LEAVE_TYPES.has(normalizeType(requestType));
}

function isAdvanceType(requestType) {
  return ADVANCE_TYPES.has(normalizeType(requestType));
}

/**
 * Leave: manager → hr
 * Advance/loan: full chain including finance
 * Other: manager → hr
 */
function getStagesForRequestType(requestType) {
  if (isAdvanceType(requestType)) {
    return STAGE_DEFS.map((s) => s.key);
  }
  // leave + general employee requests
  return ['manager', 'hr'];
}

function getStageLabel(stageKey) {
  if (stageKey === 'completed') return 'مكتمل';
  if (stageKey === 'rejected') return 'مرفوض';
  return STAGE_BY_KEY[stageKey]?.label || stageKey || '—';
}

function buildInitialWorkflow(requestType) {
  const stages = getStagesForRequestType(requestType);
  return {
    current_stage: stages[0],
    workflow_stages: stages,
    workflow_history: []
  };
}

function nextStage(currentStage, stages) {
  const list = Array.isArray(stages) && stages.length ? stages : STAGE_DEFS.map((s) => s.key);
  const idx = list.indexOf(currentStage);
  if (idx < 0) return null;
  if (idx >= list.length - 1) return null;
  return list[idx + 1];
}

function parseWorkflowHistory(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (_) {
      return [];
    }
  }
  return [];
}

function parseWorkflowStages(raw, requestType) {
  if (Array.isArray(raw) && raw.length) return raw;
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length) return parsed;
    } catch (_) {
      /* fall through */
    }
  }
  return getStagesForRequestType(requestType);
}

/**
 * Apply approve/reject decision. Returns patch fields for UPDATE.
 */
function applyDecision(request, { decision, actorName, notes }) {
  const history = parseWorkflowHistory(request.workflow_history);
  const stages = parseWorkflowStages(request.workflow_stages, request.request_type);
  const current = request.current_stage || stages[0] || 'manager';
  const actor = (actorName || 'مسؤول النظام').trim();
  const noteText = (notes || '').trim() || null;
  const nowIso = new Date().toISOString();

  const entry = {
    stage: current,
    stage_label: getStageLabel(current),
    decision: decision === 'reject' ? 'rejected' : 'approved',
    actor_name: actor,
    notes: noteText,
    at: nowIso
  };

  if (decision === 'reject') {
    return {
      status: 'REJECTED',
      current_stage: 'rejected',
      workflow_stages: stages,
      workflow_history: [...history, entry],
      approver_name: actor,
      approval_notes: noteText,
      completion_date: nowIso.slice(0, 10)
    };
  }

  const upcoming = nextStage(current, stages);
  if (!upcoming) {
    return {
      status: 'APPROVED',
      current_stage: 'completed',
      workflow_stages: stages,
      workflow_history: [...history, entry],
      approver_name: actor,
      approval_notes: noteText,
      completion_date: nowIso.slice(0, 10)
    };
  }

  return {
    status: 'PENDING',
    current_stage: upcoming,
    workflow_stages: stages,
    workflow_history: [...history, entry],
    approver_name: actor,
    approval_notes: noteText,
    completion_date: null
  };
}

function isPendingAction(request) {
  const status = String(request.status || '').toUpperCase();
  if (!['PENDING', 'IN_PROGRESS'].includes(status)) return false;
  const stage = request.current_stage;
  return Boolean(stage) && stage !== 'completed' && stage !== 'rejected';
}

function enrichRequest(row) {
  if (!row) return row;
  const stages = parseWorkflowStages(row.workflow_stages, row.request_type);
  const history = parseWorkflowHistory(row.workflow_history);
  const current = row.current_stage || stages[0] || null;
  return {
    ...row,
    workflow_stages: stages,
    workflow_history: history,
    current_stage: current,
    current_stage_label: getStageLabel(current),
    stage_labels: stages.map((key) => ({ key, label: getStageLabel(key) })),
    is_pending_action: isPendingAction({ ...row, current_stage: current })
  };
}

const WORKFLOW_COLUMN_SQL = `
  ALTER TABLE employee_requests ADD COLUMN IF NOT EXISTS current_stage VARCHAR(40);
  ALTER TABLE employee_requests ADD COLUMN IF NOT EXISTS workflow_stages JSONB;
  ALTER TABLE employee_requests ADD COLUMN IF NOT EXISTS workflow_history JSONB DEFAULT '[]'::jsonb;
  CREATE INDEX IF NOT EXISTS idx_employee_requests_current_stage ON employee_requests(current_stage);
  CREATE INDEX IF NOT EXISTS idx_employee_requests_status_stage ON employee_requests(status, current_stage);
`;

async function ensureWorkflowColumns(queryFn) {
  await queryFn(WORKFLOW_COLUMN_SQL);
  // Backfill pending rows that lack a stage
  await queryFn(`
    UPDATE employee_requests
    SET current_stage = 'manager',
        workflow_stages = COALESCE(workflow_stages, '["manager","hr"]'::jsonb),
        workflow_history = COALESCE(workflow_history, '[]'::jsonb)
    WHERE status IN ('PENDING', 'IN_PROGRESS')
      AND (current_stage IS NULL OR current_stage = '')
  `);
}

module.exports = {
  STAGE_DEFS,
  getStagesForRequestType,
  getStageLabel,
  buildInitialWorkflow,
  applyDecision,
  enrichRequest,
  isPendingAction,
  isLeaveType,
  isAdvanceType,
  ensureWorkflowColumns,
  parseWorkflowHistory,
  parseWorkflowStages
};
