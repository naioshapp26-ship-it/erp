(function (global) {
  'use strict';

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function overlay(build) {
    const modal = document.createElement('div');
    modal.className = 'record-modal';
    const sheet = document.createElement('div');
    sheet.className = 'sheet';
    modal.appendChild(sheet);
    document.body.appendChild(modal);
    function close(result) {
      modal.remove();
      build.done(result);
    }
    build.render(sheet, close);
    modal.addEventListener('click', (event) => {
      if (event.target === modal) close(null);
    });
  }

  function confirm(message) {
    if (global.ErpDialog && typeof global.ErpDialog.confirm === 'function') {
      return global.ErpDialog.confirm({ title: 'تأكيد', message: String(message || '') });
    }
    return new Promise((resolve) => {
      overlay({
        done: resolve,
        render(sheet, close) {
          sheet.innerHTML = `<p>${escapeHtml(message)}</p><div class="row"><button type="button" data-no>تراجع</button><button type="button" data-yes class="danger">تأكيد</button></div>`;
          sheet.querySelector('[data-no]').onclick = () => close(false);
          sheet.querySelector('[data-yes]').onclick = () => close(true);
        }
      });
    });
  }

  function show(title, html) {
    return new Promise((resolve) => {
      overlay({
        done: resolve,
        render(sheet, close) {
          sheet.innerHTML = `<h3>${escapeHtml(title)}</h3><div>${html}</div><div class="row"><button type="button" data-close>إغلاق</button></div>`;
          sheet.querySelector('[data-close]').onclick = () => close(true);
        }
      });
    });
  }

  function form(title, fields) {
    return new Promise((resolve) => {
      overlay({
        done: resolve,
        render(sheet, close) {
          const inputs = fields.map((field) => `<label>${escapeHtml(field.label)}<input name="${escapeHtml(field.name)}" value="${escapeHtml(field.value == null ? '' : field.value)}" ${field.type === 'number' ? 'type="number" step="any"' : ''}></label>`).join('');
          sheet.innerHTML = `<h3>${escapeHtml(title)}</h3>${inputs}<div class="row"><button type="button" data-no>إلغاء</button><button type="button" data-yes>حفظ</button></div>`;
          sheet.querySelector('[data-no]').onclick = () => close(null);
          sheet.querySelector('[data-yes]').onclick = () => {
            const data = {};
            fields.forEach((field) => {
              data[field.name] = sheet.querySelector(`[name="${field.name}"]`).value;
            });
            close(data);
          };
        }
      });
    });
  }

  function exportRows(filename, headers, rows) {
    const csv = [headers.map((header) => header.label).join(',')]
      .concat(rows.map((row) => headers.map((header) => `"${String(row[header.key] == null ? '' : row[header.key]).replace(/"/g, '""')}"`).join(',')))
      .join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  function bind(options) {
    const selected = new Set();
    let lastRows = [];
    let sortKey = '';
    let sortDir = 1;
    let busy = false;
    const bar = document.createElement('div');
    bar.className = 'record-bar';
    bar.hidden = true;
    options.table.parentNode.insertBefore(bar, options.table);
    const head = options.table.querySelector('thead tr');
    if (head && !head.querySelector('[data-check-all]')) {
      const check = document.createElement('th');
      check.innerHTML = '<input type="checkbox" data-check-all aria-label="تحديد الظاهر">';
      head.insertBefore(check, head.firstChild);
      const actions = document.createElement('th');
      actions.textContent = 'الإجراءات';
      head.appendChild(actions);
    }
    head.addEventListener('click', (event) => {
      const cell = event.target.closest('th[data-sort]');
      if (!cell) return;
      const key = cell.getAttribute('data-sort');
      sortDir = sortKey === key ? -sortDir : 1;
      sortKey = key;
      paint(lastRows);
    });

    function currentRows() {
      const rows = lastRows.slice();
      if (!sortKey || !options.sortValue) return rows;
      rows.sort((a, b) => {
        const left = options.sortValue(a, sortKey);
        const right = options.sortValue(b, sortKey);
        if (left === right) return 0;
        return left > right ? sortDir : -sortDir;
      });
      return rows;
    }

    function updateBar() {
      const count = selected.size;
      bar.hidden = count === 0;
      const buttons = (options.bulk || []).map((action) => `<button type="button" data-bulk="${escapeHtml(action.id)}" class="${action.danger ? 'danger' : ''}">${escapeHtml(action.label)}</button>`).join('');
      bar.innerHTML = `<strong>${count.toLocaleString('en-US')} محدد</strong>${buttons}<button type="button" data-bulk="export">تصدير المحدد</button><button type="button" data-bulk="print">طباعة</button><button type="button" data-clear>إلغاء التحديد</button>`;
    }

    function paint(rows) {
      lastRows = rows.slice();
      const visible = currentRows();
      const known = new Set(visible.map((row) => String(options.getId(row))));
      Array.from(selected).forEach((id) => { if (!known.has(id)) selected.delete(id); });
      options.table.hidden = !visible.length;
      if (options.emptyEl) options.emptyEl.hidden = !!visible.length;
      options.table.querySelector('tbody').innerHTML = visible.map((row) => {
        const id = String(options.getId(row));
        const actions = (options.actions(row) || []).map((action) => {
          if (action.disabled) return `<span class="why">${escapeHtml(action.reason || 'غير متاح')}</span>`;
          return `<button type="button" data-action="${escapeHtml(action.id)}" data-id="${escapeHtml(id)}">${escapeHtml(action.label)}</button>`;
        }).join('');
        return `<tr><td><input type="checkbox" data-id="${escapeHtml(id)}" ${selected.has(id) ? 'checked' : ''} aria-label="تحديد"></td>${options.cells(row)}<td class="record-actions">${actions}</td></tr>`;
      }).join('');
      const master = head.querySelector('[data-check-all]');
      master.checked = visible.length > 0 && visible.every((row) => selected.has(String(options.getId(row))));
      updateBar();
    }

    options.table.addEventListener('change', (event) => {
      if (event.target.matches('[data-check-all]')) {
        currentRows().forEach((row) => {
          const id = String(options.getId(row));
          if (event.target.checked) selected.add(id);
          else selected.delete(id);
        });
        paint(lastRows);
        return;
      }
      if (event.target.matches('input[type="checkbox"][data-id]')) {
        const id = event.target.getAttribute('data-id');
        if (event.target.checked) selected.add(id);
        else selected.delete(id);
        updateBar();
      }
    });

    async function guard(work) {
      if (busy) return;
      busy = true;
      try { await work(); } finally { busy = false; }
    }

    options.table.addEventListener('click', (event) => {
      const button = event.target.closest('[data-action]');
      if (!button) return;
      const id = button.getAttribute('data-id');
      const row = lastRows.find((item) => String(options.getId(item)) === id);
      if (!row) return;
      guard(() => options.onAction(button.getAttribute('data-action'), row));
    });

    bar.addEventListener('click', (event) => {
      const clear = event.target.closest('[data-clear]');
      if (clear) {
        selected.clear();
        paint(lastRows);
        return;
      }
      const button = event.target.closest('[data-bulk]');
      if (!button) return;
      const action = button.getAttribute('data-bulk');
      const ids = Array.from(selected);
      const rows = lastRows.filter((row) => selected.has(String(options.getId(row))));
      if (action === 'export') {
        if (options.exportHeaders) exportRows(options.exportName || 'records.csv', options.exportHeaders, rows);
        return;
      }
      if (action === 'print') {
        window.print();
        return;
      }
      guard(() => options.onBulk(action, ids, rows));
    });

    return {
      paint,
      selectIds(ids) {
        ids.forEach((id) => selected.add(String(id)));
        paint(lastRows);
      },
      selected() { return Array.from(selected); }
    };
  }

  global.NaioshRecordActions = { confirm, show, form, exportRows, bind, escapeHtml };
})(window);
