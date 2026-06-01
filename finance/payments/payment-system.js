const API_BASE = window.location.origin;
const ENTITY_ID = window.getFinanceEntityId ? window.getFinanceEntityId() : 'HQ001';

const STATUS_OPTIONS = ['مدفوع', 'متأخر', 'قيد التحصيل', 'قيد المراجعة', 'معلق', 'مغلق'];

const state = {
  records: [],
  modalMode: 'create',
  editingId: null
};

const config = window.PAYMENT_SYSTEM_CONFIG || {
  moduleType: 'tracking',
  moduleTitle: 'تتبع الدفعات',
  moduleDescription: 'متابعة جميع الدفعات وربطها بالحسابات.'
};

const elements = {
  title: document.getElementById('moduleTitle'),
  description: document.getElementById('moduleDescription'),
  statsTotalCount: document.getElementById('statTotalCount'),
  statsTotalAmount: document.getElementById('statTotalAmount'),
  statsOverdue: document.getElementById('statOverdue'),
  statsInProgress: document.getElementById('statInProgress'),
  tableBody: document.getElementById('recordsTableBody'),
  tableCount: document.getElementById('tableCount'),
  searchInput: document.getElementById('searchInput'),
  statusFilter: document.getElementById('statusFilter'),
  ownerFilter: document.getElementById('ownerFilter'),
  fromDate: document.getElementById('fromDate'),
  toDate: document.getElementById('toDate'),
  modal: document.getElementById('recordModal'),
  modalTitle: document.getElementById('recordModalTitle'),
  modalSave: document.getElementById('recordModalSave')
};

const formFields = {
  record_number: document.getElementById('recordNumber'),
  record_date: document.getElementById('recordDate'),
  customer_name: document.getElementById('customerName'),
  amount: document.getElementById('amount'),
  status: document.getElementById('status'),
  owner_employee: document.getElementById('ownerEmployee'),
  notes: document.getElementById('notes')
};

const formatMoney = (value) => {
  const numberValue = parseFloat(value || 0);
  return `${numberValue.toLocaleString('en-US')} SAR`;
};

const formatDate = (value) => {
  if (!value) return '-';
  const date = new Date(value);
  return date.toLocaleDateString('en-US');
};

const getStatusClass = (status) => {
  switch (status) {
    case 'مدفوع':
      return 'status-paid';
    case 'متأخر':
      return 'status-overdue';
    case 'قيد التحصيل':
      return 'status-progress';
    case 'قيد المراجعة':
      return 'status-review';
    case 'معلق':
      return 'status-hold';
    case 'مغلق':
      return 'status-closed';
    default:
      return 'status-closed';
  }
};

const renderStatusOptions = (selected) => {
  return STATUS_OPTIONS.map((option) => {
    const isSelected = option === selected ? 'selected' : '';
    return `<option value="${option}" ${isSelected}>${option}</option>`;
  }).join('');
};

const renderHeader = () => {
  if (elements.title) elements.title.textContent = config.moduleTitle;
  if (elements.description) elements.description.textContent = config.moduleDescription;
};

const renderStats = (records) => {
  const totalCount = records.length;
  const totalAmount = records.reduce((sum, r) => sum + parseFloat(r.amount || 0), 0);
  const overdueAmount = records
    .filter((r) => r.status === 'متأخر')
    .reduce((sum, r) => sum + parseFloat(r.amount || 0), 0);
  const inProgressCount = records.filter((r) => ['قيد التحصيل', 'قيد المراجعة', 'معلق'].includes(r.status)).length;

  if (elements.statsTotalCount) elements.statsTotalCount.textContent = totalCount.toLocaleString('en-US');
  if (elements.statsTotalAmount) elements.statsTotalAmount.textContent = formatMoney(totalAmount);
  if (elements.statsOverdue) elements.statsOverdue.textContent = formatMoney(overdueAmount);
  if (elements.statsInProgress) elements.statsInProgress.textContent = inProgressCount.toLocaleString('en-US');
};

const renderTable = (records) => {
  if (!elements.tableBody) return;

  const rows = records.map((record) => `
    <tr>
      <td>${record.record_number || '-'}</td>
      <td>${formatDate(record.record_date)}</td>
      <td>
        <div class="customer-cell">
          <span>${record.customer_name || '-'}</span>
          <select class="status-select" onchange="updateRecordStatus(${record.id}, this.value)">
            ${renderStatusOptions(record.status)}
          </select>
        </div>
      </td>
      <td>${formatMoney(record.amount)}</td>
      <td><span class="status-pill ${getStatusClass(record.status)}">${record.status || '-'}</span></td>
      <td>${record.owner_employee || '-'}</td>
      <td>${record.notes || '-'}</td>
      <td>${formatDate(record.updated_at)}</td>
      <td>
        <div class="row-actions">
          <button class="icon-btn" onclick="openRecordModal('view', ${record.id})" title="عرض"><i class="fas fa-eye"></i></button>
          <button class="icon-btn" onclick="openRecordModal('edit', ${record.id})" title="تعديل"><i class="fas fa-pen"></i></button>
          <button class="icon-btn" onclick="deleteRecord(${record.id})" title="حذف"><i class="fas fa-trash"></i></button>
        </div>
      </td>
    </tr>
  `).join('');

  elements.tableBody.innerHTML = rows || `
    <tr>
      <td colspan="9" style="text-align:center; padding: 24px; color: #64748b;">لا توجد سجلات متاحة</td>
    </tr>
  `;

  if (elements.tableCount) {
    elements.tableCount.textContent = `عدد السجلات المعروضة: ${records.length}`;
  }
};

const applyFilters = () => {
  const search = (elements.searchInput?.value || '').trim().toLowerCase();
  const status = elements.statusFilter?.value || '';
  const owner = (elements.ownerFilter?.value || '').trim();
  const fromDate = elements.fromDate?.value || '';
  const toDate = elements.toDate?.value || '';

  const filtered = state.records.filter((record) => {
    const matchSearch = !search ||
      (record.record_number || '').toLowerCase().includes(search) ||
      (record.customer_name || '').toLowerCase().includes(search) ||
      (record.notes || '').toLowerCase().includes(search) ||
      (record.owner_employee || '').toLowerCase().includes(search);

    const matchStatus = !status || record.status === status;
    const matchOwner = !owner || (record.owner_employee || '').includes(owner);
    const recordDate = record.record_date ? new Date(record.record_date) : null;

    const matchFrom = !fromDate || (recordDate && recordDate >= new Date(fromDate));
    const matchTo = !toDate || (recordDate && recordDate <= new Date(toDate));

    return matchSearch && matchStatus && matchOwner && matchFrom && matchTo;
  });

  renderStats(filtered);
  renderTable(filtered);
};

const resetFilters = () => {
  if (elements.searchInput) elements.searchInput.value = '';
  if (elements.statusFilter) elements.statusFilter.value = '';
  if (elements.ownerFilter) elements.ownerFilter.value = '';
  if (elements.fromDate) elements.fromDate.value = '';
  if (elements.toDate) elements.toDate.value = '';
  applyFilters();
};

const loadRecords = async () => {
  try {
    const res = await fetch(`${API_BASE}/finance/payment-system/records?entity_id=${ENTITY_ID}&module_type=${config.moduleType}`, {
      headers: window.getFinanceHeaders ? window.getFinanceHeaders() : {}
    });
    const data = await res.json();

    if (!data.success) {
      throw new Error(data.error || 'تعذر تحميل البيانات');
    }

    state.records = data.records || [];
    renderStats(state.records);
    renderTable(state.records);
  } catch (error) {
    console.error('Error loading records:', error);
    if (elements.tableBody) {
      elements.tableBody.innerHTML = `
        <tr>
          <td colspan="9" style="text-align:center; padding: 24px; color: #ef4444;">تعذر تحميل البيانات</td>
        </tr>
      `;
    }
  }
};

const openRecordModal = (mode, id = null) => {
  state.modalMode = mode;
  state.editingId = id;

  if (elements.modalTitle) {
    elements.modalTitle.textContent = mode === 'view' ? 'عرض السجل' : mode === 'edit' ? 'تعديل السجل' : 'إضافة سجل جديد';
  }

  if (elements.modalSave) {
    elements.modalSave.textContent = mode === 'edit' ? 'حفظ التعديل' : 'حفظ';
    elements.modalSave.style.display = mode === 'view' ? 'none' : 'inline-flex';
  }

  resetForm();
  setFormDisabled(mode === 'view');

  if (mode !== 'create' && id) {
    const record = state.records.find((r) => r.id === id);
    if (record) fillForm(record);
  }

  if (elements.modal) {
    elements.modal.classList.add('active');
  }
};

const closeRecordModal = () => {
  if (elements.modal) {
    elements.modal.classList.remove('active');
  }
};

const resetForm = () => {
  if (!formFields.record_number) return;
  formFields.record_number.value = '';
  formFields.record_date.value = '';
  formFields.customer_name.value = '';
  formFields.amount.value = '';
  formFields.status.value = STATUS_OPTIONS[0];
  formFields.owner_employee.value = '';
  formFields.notes.value = '';
};

const fillForm = (record) => {
  formFields.record_number.value = record.record_number || '';
  formFields.record_date.value = (record.record_date || '').slice(0, 10);
  formFields.customer_name.value = record.customer_name || '';
  formFields.amount.value = record.amount || 0;
  formFields.status.value = record.status || STATUS_OPTIONS[0];
  formFields.owner_employee.value = record.owner_employee || '';
  formFields.notes.value = record.notes || '';
};

const setFormDisabled = (disabled) => {
  Object.values(formFields).forEach((field) => {
    if (field) field.disabled = disabled;
  });
};

const submitRecord = async () => {
  const payload = {
    record_number: formFields.record_number.value.trim(),
    record_date: formFields.record_date.value,
    customer_name: formFields.customer_name.value.trim(),
    amount: parseFloat(formFields.amount.value || 0),
    status: formFields.status.value,
    owner_employee: formFields.owner_employee.value.trim(),
    notes: formFields.notes.value.trim(),
    module_type: config.moduleType,
    entity_id: ENTITY_ID,
    entity_type: window.getFinanceEntityType ? window.getFinanceEntityType() : 'HQ'
  };

  if (!payload.record_date || !payload.customer_name || !payload.amount || !payload.status || !payload.owner_employee) {
    alert('يرجى إدخال الحقول المطلوبة');
    return;
  }

  try {
    const url = state.modalMode === 'edit'
      ? `${API_BASE}/finance/payment-system/records/${state.editingId}`
      : `${API_BASE}/finance/payment-system/records`;
    const method = state.modalMode === 'edit' ? 'PUT' : 'POST';

    const res = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(window.getFinanceHeaders ? window.getFinanceHeaders() : {})
      },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (!data.success) {
      throw new Error(data.error || 'تعذر حفظ السجل');
    }

    closeRecordModal();
    await loadRecords();
  } catch (error) {
    console.error('Error saving record:', error);
    alert(error.message || 'تعذر حفظ السجل');
  }
};

const deleteRecord = async (id) => {
  if (!confirm('هل تريد حذف هذا السجل؟')) return;
  try {
    const res = await fetch(`${API_BASE}/finance/payment-system/records/${id}`, {
      method: 'DELETE',
      headers: window.getFinanceHeaders ? window.getFinanceHeaders() : {}
    });
    const data = await res.json();
    if (!data.success) {
      throw new Error(data.error || 'تعذر حذف السجل');
    }
    await loadRecords();
  } catch (error) {
    console.error('Error deleting record:', error);
    alert(error.message || 'تعذر حذف السجل');
  }
};

const updateRecordStatus = async (id, status) => {
  try {
    const res = await fetch(`${API_BASE}/finance/payment-system/records/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...(window.getFinanceHeaders ? window.getFinanceHeaders() : {})
      },
      body: JSON.stringify({ status })
    });
    const data = await res.json();
    if (!data.success) {
      throw new Error(data.error || 'تعذر تحديث الحالة');
    }

    state.records = state.records.map((record) =>
      record.id === id ? { ...record, status: data.record?.status || status, updated_at: data.record?.updated_at || record.updated_at } : record
    );
    renderStats(state.records);
    renderTable(state.records);
  } catch (error) {
    console.error('Error updating status:', error);
    alert(error.message || 'تعذر تحديث الحالة');
  }
};

window.openRecordModal = openRecordModal;
window.closeRecordModal = closeRecordModal;
window.submitRecord = submitRecord;
window.deleteRecord = deleteRecord;
window.applyFilters = applyFilters;
window.resetFilters = resetFilters;
window.loadRecords = loadRecords;
window.updateRecordStatus = updateRecordStatus;

renderHeader();
loadRecords();
