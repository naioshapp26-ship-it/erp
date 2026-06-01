(() => {
  const ADD_BUTTON_CLASS = 'finance-related-add-btn';
  const VIEW_BUTTON_CLASS = 'finance-related-view-btn';
  const BADGE_CLASS = 'finance-related-badge';
  const STYLE_ID = 'finance-related-add-style';
  const DETAILS_MODAL_ID = 'finance-related-details-modal';
  const DETAILS_LIST_MODAL_ID = 'finance-related-list-modal';
  const API_ENDPOINT = '/finance/related-details';
  const CREATE_SELECTOR = "button[onclick*='\"create\"'], button[onclick*=" + "'create'" + "'], button[onclick*='\"add\"'], button[onclick*=" + "'add'" + "']";
  const VIEW_TOKENS = new Set(['view', 'preview', 'show', 'open']);
  const EDIT_TOKENS = new Set(['edit', 'update']);
  const DELETE_TOKENS = new Set(['delete', 'remove']);
  const IGNORE_TOKENS = new Set(['view', 'preview', 'edit', 'update', 'delete', 'remove']);
  const ID_FIELDS = [
    'parent_id',
    'related_id',
    'reference_id',
    'customer_id',
    'invoice_id',
    'payment_id',
    'plan_id',
    'installment_id',
    'allocation_id',
    'account_id',
    'asset_id',
    'expense_id',
    'vendor_id',
    'employee_id',
    'cashflow_id',
    'transaction_id',
    'settlement_id',
    'forecast_id',
    'risk_id',
    'order_id',
    'request_id',
    'line_id',
    'entry_id'
  ];

  const detailsCache = new Map();

  const hasIcon = (button, className) => !!button.querySelector(`.${className}`);

  const hasKeyword = (value, keywords) => {
    if (!value) return false;
    const normalized = value.toLowerCase();
    return keywords.some((keyword) => normalized.includes(keyword));
  };

  const isViewButton = (button) =>
    hasIcon(button, 'fa-eye') ||
    hasKeyword(button.getAttribute('title'), ['عرض', 'معاينة']) ||
    hasKeyword(button.textContent, ['معاينة', 'عرض']);

  const isEditButton = (button) =>
    hasIcon(button, 'fa-pen') ||
    hasIcon(button, 'fa-pen-to-square') ||
    hasKeyword(button.getAttribute('title'), ['تعديل']) ||
    hasKeyword(button.textContent, ['تعديل']);

  const isDeleteButton = (button) =>
    hasIcon(button, 'fa-trash') ||
    hasIcon(button, 'fa-trash-can') ||
    hasKeyword(button.getAttribute('title'), ['حذف']) ||
    hasKeyword(button.textContent, ['حذف']);

  const findActionContainer = (cell) =>
    cell.querySelector('.row-actions') ||
    cell.querySelector('.action-buttons') ||
    cell.querySelector('.actions') ||
    cell.querySelector('.flex') ||
    cell;

  const extractTokens = (onclick) => {
    const tokens = [];
    if (!onclick) return tokens;
    const tokenRegex = /'([^']*)'|"([^"]*)"|(\d+)/g;
    let match = null;
    while ((match = tokenRegex.exec(onclick)) !== null) {
      const token = match[1] || match[2] || match[3];
      if (!token) continue;
      tokens.push(token);
    }
    return tokens;
  };

  const extractRecordId = (cell) => {
    const buttons = Array.from(cell.querySelectorAll('button'));
    for (const button of buttons) {
      if (button.dataset && button.dataset.id) return button.dataset.id;
      const onclick = button.getAttribute('onclick');
      const tokens = extractTokens(onclick);
      for (const token of tokens) {
        if (IGNORE_TOKENS.has(token.toLowerCase())) continue;
        return token;
      }
    }
    return null;
  };

  const findCreateButton = () => {
    const candidates = Array.from(document.querySelectorAll(`${CREATE_SELECTOR}, [onclick*="create"], [onclick*="add"]`));
    if (candidates.length) return candidates[0];
    const textCandidates = Array.from(document.querySelectorAll('button')).filter((button) => {
      const label = (button.textContent || '').trim();
      return label.includes('+') || label.includes('إضافة') || label.includes('اضافة');
    });
    return textCandidates[0] || null;
  };

  const parseFunctionName = (onclick) => {
    if (!onclick) return null;
    const match = onclick.match(/([a-zA-Z_$][\w$]*)\s*\(/);
    return match ? match[1] : null;
  };

  const parseCallArguments = (onclick) => {
    if (!onclick) return [];
    const match = onclick.match(/\((.*)\)/);
    if (!match) return [];
    const raw = match[1];
    if (!raw) return [];
    const tokens = [];
    const tokenRegex = /'([^']*)'|"([^"]*)"|(\d+)/g;
    let tokenMatch = null;
    while ((tokenMatch = tokenRegex.exec(raw)) !== null) {
      const token = tokenMatch[1] || tokenMatch[2] || tokenMatch[3];
      if (!token) continue;
      tokens.push(token);
    }
    return tokens;
  };

  const parseCreateMode = (onclick) => {
    if (!onclick) return 'create';
    const tokens = extractTokens(onclick).map((token) => token.toLowerCase());
    if (tokens.some((token) => token === 'add')) return 'add';
    return 'create';
  };

  const ensureStyles = () => {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .${ADD_BUTTON_CLASS} {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
      }
      .${ADD_BUTTON_CLASS} i {
        color: currentColor;
      }
      .finance-related-modal {
        position: fixed;
        inset: 0;
        background: rgba(15, 23, 42, 0.45);
        display: none;
        align-items: center;
        justify-content: center;
        z-index: 60;
        padding: 16px;
      }
      .finance-related-modal.active {
        display: flex;
      }
      .finance-related-card {
        background: #ffffff;
        border-radius: 16px;
        width: min(720px, 96vw);
        box-shadow: 0 22px 50px rgba(15, 23, 42, 0.2);
        padding: 20px;
      }
      .finance-related-card h3 {
        font-size: 18px;
        font-weight: 800;
        margin-bottom: 12px;
        color: #0f172a;
      }
      .finance-related-card label {
        display: block;
        font-weight: 700;
        margin-bottom: 6px;
        color: #0f172a;
      }
      .finance-related-card input,
      .finance-related-card textarea {
        width: 100%;
        border: 1px solid #e2e8f0;
        border-radius: 10px;
        padding: 10px 12px;
        font-size: 14px;
        color: #0f172a;
      }
      .finance-related-card textarea {
        min-height: 120px;
        resize: vertical;
      }
      .finance-related-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
        justify-content: flex-end;
        margin-top: 16px;
      }
      .finance-related-actions button {
        padding: 8px 16px;
        border-radius: 10px;
        font-weight: 700;
        border: 1px solid #e2e8f0;
        background: #f8fafc;
        color: #0f172a;
      }
      .finance-related-actions .primary {
        background: #0f172a;
        color: #ffffff;
        border-color: #0f172a;
      }
      .finance-related-meta {
        font-size: 12px;
        color: #64748b;
        margin-bottom: 12px;
      }
      .${BADGE_CLASS} {
        background: #ef4444;
        color: #ffffff;
        border-radius: 999px;
        font-size: 11px;
        font-weight: 700;
        padding: 2px 6px;
        margin-inline-start: 6px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-width: 20px;
      }
      .finance-related-error {
        margin-bottom: 10px;
        font-size: 13px;
        color: #b91c1c;
      }
      .finance-related-list {
        display: flex;
        flex-direction: column;
        gap: 12px;
        max-height: 60vh;
        overflow-y: auto;
        padding-right: 4px;
      }
      .finance-related-item {
        border: 1px solid #e2e8f0;
        border-radius: 12px;
        padding: 12px;
        background: #f8fafc;
      }
      .finance-related-item h4 {
        margin: 0 0 6px;
        font-size: 15px;
        color: #0f172a;
      }
      .finance-related-item p {
        margin: 0;
        font-size: 13px;
        color: #334155;
        white-space: pre-wrap;
      }
      .finance-related-empty {
        font-size: 14px;
        color: #64748b;
      }
    `;
    document.head.appendChild(style);
  };

  const buildRecordKey = (pageKey, recordId) => `${pageKey}::${recordId}`;

  const getHeaders = () => {
    const baseHeaders = window.getFinanceHeaders ? window.getFinanceHeaders() : {};
    return { ...baseHeaders, 'Content-Type': 'application/json' };
  };

  const fetchJson = async (url, options) => {
    const response = await fetch(url, options);
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message = data && data.error ? data.error : 'تعذر حفظ البيانات الآن.';
      throw new Error(message);
    }
    return data;
  };

  const loadRelatedDetails = async (pageKey, recordId) => {
    if (!recordId) return [];
    const key = buildRecordKey(pageKey, recordId);
    if (detailsCache.has(key)) return detailsCache.get(key);
    const url = new URL(API_ENDPOINT, window.location.origin);
    url.searchParams.set('page_key', pageKey);
    url.searchParams.set('record_id', recordId);
    const data = await fetchJson(url.toString(), { headers: getHeaders() });
    const list = Array.isArray(data.details) ? data.details : [];
    detailsCache.set(key, list);
    return list;
  };

  const saveRelatedDetail = async (payload) => {
    const data = await fetchJson(API_ENDPOINT, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(payload)
    });
    return data.detail;
  };

  const ensureDetailsModal = () => {
    if (document.getElementById(DETAILS_MODAL_ID)) return;

    const modal = document.createElement('div');
    modal.id = DETAILS_MODAL_ID;
    modal.className = 'finance-related-modal';
    modal.innerHTML = `
      <div class="finance-related-card" role="dialog" aria-modal="true">
        <h3>إضافة بيانات إضافية</h3>
        <div class="finance-related-meta" id="financeRelatedMeta"></div>
        <div class="finance-related-error" id="financeRelatedError" role="alert"></div>
        <div>
          <label for="financeRelatedTitle">العنوان</label>
          <input id="financeRelatedTitle" type="text" placeholder="عنوان مختصر للمعلومة الإضافية" />
        </div>
        <div style="margin-top: 12px;">
          <label for="financeRelatedNotes">التفاصيل / الملاحظات</label>
          <textarea id="financeRelatedNotes" placeholder="اكتب التفاصيل الإضافية هنا..."></textarea>
        </div>
        <div style="margin-top: 12px;">
          <label for="financeRelatedTags">وسوم (اختياري)</label>
          <input id="financeRelatedTags" type="text" placeholder="مثال: متابعة، توضيح، تنبيه" />
        </div>
        <div class="finance-related-actions">
          <button type="button" id="financeRelatedCancel">إلغاء</button>
          <button type="button" class="primary" id="financeRelatedSave">حفظ البيانات</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    modal.addEventListener('click', (event) => {
      if (event.target === modal) modal.classList.remove('active');
    });
    modal.querySelector('#financeRelatedCancel').addEventListener('click', () => {
      modal.classList.remove('active');
    });
  };

  const ensureDetailsListModal = () => {
    if (document.getElementById(DETAILS_LIST_MODAL_ID)) return;

    const modal = document.createElement('div');
    modal.id = DETAILS_LIST_MODAL_ID;
    modal.className = 'finance-related-modal';
    modal.innerHTML = `
      <div class="finance-related-card" role="dialog" aria-modal="true">
        <h3>البيانات الإضافية</h3>
        <div class="finance-related-meta" id="financeRelatedListMeta"></div>
        <div id="financeRelatedListBody"></div>
        <div class="finance-related-actions">
          <button type="button" id="financeRelatedListClose">إغلاق</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    modal.addEventListener('click', (event) => {
      if (event.target === modal) modal.classList.remove('active');
    });
    modal.querySelector('#financeRelatedListClose').addEventListener('click', () => {
      modal.classList.remove('active');
    });
  };

  const updateDetailsBadge = (recordKey, count) => {
    if (!recordKey) return;
    const targets = Array.from(document.querySelectorAll(`[data-related-key="${recordKey}"]`));
    targets.forEach((button) => {
      const badge = button.querySelector(`.${BADGE_CLASS}`);
      if (!badge) return;
      if (count > 0) {
        badge.textContent = String(count);
        badge.hidden = false;
      } else {
        badge.hidden = true;
      }
    });
  };

  const openDetailsModal = ({ recordId, pageKey }) => {
    ensureDetailsModal();
    const modal = document.getElementById(DETAILS_MODAL_ID);
    const titleInput = document.getElementById('financeRelatedTitle');
    const notesInput = document.getElementById('financeRelatedNotes');
    const tagsInput = document.getElementById('financeRelatedTags');
    const meta = document.getElementById('financeRelatedMeta');
    const errorEl = document.getElementById('financeRelatedError');
    const recordKey = recordId ? buildRecordKey(pageKey, recordId) : '';

    titleInput.value = '';
    notesInput.value = '';
    tagsInput.value = '';
    meta.textContent = `السجل: ${recordId || '-'} | الصفحة: ${pageKey}`;
    errorEl.textContent = '';

    const saveButton = document.getElementById('financeRelatedSave');
    saveButton.disabled = !recordId;

    if (!recordId) {
      errorEl.textContent = 'لا يمكن حفظ البيانات بدون رقم سجل واضح.';
    }

    saveButton.replaceWith(saveButton.cloneNode(true));
    const newSaveButton = document.getElementById('financeRelatedSave');
    newSaveButton.disabled = !recordId;

    const saveHandler = async () => {
      if (!recordId) return;
      const title = titleInput.value.trim();
      const notes = notesInput.value.trim();
      const tags = tagsInput.value.trim();

      if (!title && !notes) {
        errorEl.textContent = 'يرجى إدخال عنوان أو تفاصيل على الأقل.';
        return;
      }

      errorEl.textContent = '';
      newSaveButton.disabled = true;
      const originalText = newSaveButton.textContent;
      newSaveButton.textContent = 'جارٍ الحفظ...';

      try {
        const detail = await saveRelatedDetail({
          page_key: pageKey,
          record_id: recordId,
          title,
          notes,
          tags
        });

        const list = detailsCache.get(recordKey) || [];
        list.unshift(detail);
        detailsCache.set(recordKey, list);
        updateDetailsBadge(recordKey, list.length);
        modal.classList.remove('active');
      } catch (error) {
        errorEl.textContent = error.message || 'تعذر حفظ البيانات الآن.';
      } finally {
        newSaveButton.disabled = false;
        newSaveButton.textContent = originalText;
      }
    };
    newSaveButton.addEventListener('click', saveHandler);

    modal.classList.add('active');
  };

  const openDetailsListModal = async ({ recordId, pageKey }) => {
    ensureDetailsListModal();
    const modal = document.getElementById(DETAILS_LIST_MODAL_ID);
    const meta = document.getElementById('financeRelatedListMeta');
    const body = document.getElementById('financeRelatedListBody');
    meta.textContent = `السجل: ${recordId || '-'} | الصفحة: ${pageKey}`;
    body.innerHTML = '<div class="finance-related-empty">جارٍ تحميل البيانات...</div>';

    try {
      const list = await loadRelatedDetails(pageKey, recordId);
      const recordKey = recordId ? buildRecordKey(pageKey, recordId) : '';
      updateDetailsBadge(recordKey, list.length);

      if (!list.length) {
        body.innerHTML = '<div class="finance-related-empty">لا توجد بيانات إضافية لهذا السجل.</div>';
      } else {
        const items = list.map((item) => {
          const title = item.title && item.title.trim() ? item.title : 'بيان إضافي';
          const notes = item.notes && item.notes.trim() ? item.notes : '-';
          const tags = item.tags && item.tags.trim() ? `وسوم: ${item.tags}` : '';
          return `
            <div class="finance-related-item">
              <h4>${title}</h4>
              <p>${notes}</p>
              ${tags ? `<p style="margin-top: 6px; color: #64748b;">${tags}</p>` : ''}
            </div>
          `;
        }).join('');
        body.innerHTML = `<div class="finance-related-list">${items}</div>`;
      }
    } catch (error) {
      body.innerHTML = `<div class="finance-related-empty">${error.message || 'تعذر تحميل البيانات.'}</div>`;
    }

    modal.classList.add('active');
  };

  const applyRelatedDefaults = (recordId, container) => {
    if (!recordId) return;
    const root = container || document;
    for (const field of ID_FIELDS) {
      const input = root.querySelector(`#${field}, [name="${field}"]`);
      if (!input || input.value) continue;
      input.value = recordId;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
      break;
    }
  };

  const openRelatedCreate = (cell) => {
    const recordId = extractRecordId(cell);
    const pageKey = window.location.pathname || 'finance';
    openDetailsModal({ recordId, pageKey });
    return;
  };

  const buildIconFromTemplate = (templateIcon) => {
    const icon = document.createElement('i');
    if (!templateIcon) {
      icon.className = 'fas fa-plus';
      return icon;
    }

    const classes = Array.from(templateIcon.classList).filter((name) => !name.startsWith('fa-') || name === 'fas' || name === 'far' || name === 'fal' || name === 'fab');
    classes.push('fas', 'fa-plus');
    icon.className = Array.from(new Set(classes)).join(' ');
    return icon;
  };

  const buildAddButton = (template, cell) => {
    const addButton = template ? template.cloneNode(true) : document.createElement('button');
    const templateIcon = template ? template.querySelector('i') : null;
    addButton.type = 'button';
    addButton.classList.add(ADD_BUTTON_CLASS);
    addButton.setAttribute('title', 'إضافة');
    addButton.setAttribute('aria-label', 'إضافة');
    addButton.removeAttribute('onclick');
    addButton.removeAttribute('disabled');
    addButton.innerHTML = '';
    if (templateIcon) {
      addButton.appendChild(buildIconFromTemplate(templateIcon));
    } else {
      addButton.textContent = '+ إضافة';
    }
    addButton.addEventListener('click', (event) => {
      event.stopPropagation();
      openRelatedCreate(cell);
    });
    return addButton;
  };

  const buildViewButton = (template, cell) => {
    const viewButton = template ? template.cloneNode(true) : document.createElement('button');
    const templateIcon = template ? template.querySelector('i') : null;
    viewButton.type = 'button';
    viewButton.classList.add(VIEW_BUTTON_CLASS);
    viewButton.setAttribute('title', 'عرض البيانات الإضافية');
    viewButton.setAttribute('aria-label', 'عرض البيانات الإضافية');
    viewButton.removeAttribute('onclick');
    viewButton.removeAttribute('disabled');
    viewButton.innerHTML = '';
    if (templateIcon) {
      const icon = buildIconFromTemplate(templateIcon);
      icon.classList.remove('fa-plus');
      icon.classList.add('fa-eye');
      viewButton.appendChild(icon);
    } else {
      viewButton.textContent = 'عرض';
    }
    const recordId = extractRecordId(cell);
    const pageKey = window.location.pathname || 'finance';
    if (recordId) {
      viewButton.dataset.relatedKey = buildRecordKey(pageKey, recordId);
    }
    const badge = document.createElement('span');
    badge.className = BADGE_CLASS;
    badge.hidden = true;
    viewButton.appendChild(badge);
    viewButton.addEventListener('click', (event) => {
      event.stopPropagation();
      openDetailsListModal({ recordId, pageKey });
    });
    return viewButton;
  };

  const normalizeHeader = (value) => (value || '').replace(/\s+/g, ' ').trim().toLowerCase();

  const isActionsColumn = (cell) => {
    const row = cell.parentElement;
    if (!row) return false;
    const table = row.closest('table');
    if (!table) return false;
    const index = cell.cellIndex;
    if (index < 0) return false;

    const headerRow = (table.tHead && table.tHead.rows && table.tHead.rows[0])
      || table.querySelector('thead tr')
      || table.querySelector('tr');
    if (!headerRow) return false;

    const headerCells = Array.from(headerRow.children);
    const headerCell = headerCells[index];
    if (!headerCell) return false;

    const headerText = normalizeHeader(headerCell.textContent);
    return headerText.includes('اجراء') || headerText.includes('إجراء') || headerText.includes('actions');
  };

  const injectButtons = () => {
    const cells = Array.from(document.querySelectorAll('td'));
    cells.forEach((cell) => {
      if (cell.querySelector(`.${ADD_BUTTON_CLASS}`) && cell.querySelector(`.${VIEW_BUTTON_CLASS}`)) return;
      const buttons = Array.from(cell.querySelectorAll('button'));
      if (!buttons.length) return;

      if (!isActionsColumn(cell)) return;

      const container = findActionContainer(cell);
      const template = buttons.find((button) => !button.classList.contains(ADD_BUTTON_CLASS)) || buttons[0];
      if (!cell.querySelector(`.${VIEW_BUTTON_CLASS}`)) {
        const viewButton = buildViewButton(template, cell);
        container.appendChild(viewButton);
      }
      if (!cell.querySelector(`.${ADD_BUTTON_CLASS}`)) {
        const addButton = buildAddButton(template, cell);
        container.appendChild(addButton);
      }
    });
  };

  const scheduleInject = (() => {
    let scheduled = false;
    return () => {
      if (scheduled) return;
      scheduled = true;
      requestAnimationFrame(() => {
        scheduled = false;
        injectButtons();
      });
    };
  })();

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      ensureStyles();
      ensureDetailsModal();
      injectButtons();
    }, { once: true });
  } else {
    ensureStyles();
    ensureDetailsModal();
    injectButtons();
  }

  const observer = new MutationObserver(scheduleInject);
  observer.observe(document.body, { childList: true, subtree: true });
})();
