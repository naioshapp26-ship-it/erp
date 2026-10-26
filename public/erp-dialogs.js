/**
 * NAIOSH ERP — unified dialogs (Form Modal / Confirm / Prompt / Toast).
 * Replaces native window.alert / confirm / prompt for operational UI.
 */
(function (root) {
  'use strict';

  const STYLE_HREF = '/public/erp-dialogs.css';
  let styleReady = false;
  let toastHost = null;
  let openCount = 0;
  let lastFocus = null;

  function ensureStyle() {
    if (styleReady || typeof document === 'undefined') return;
    if (!document.querySelector(`link[href^="${STYLE_HREF}"]`)) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = STYLE_HREF + '?v=20261026dlg';
      document.head.appendChild(link);
    }
    styleReady = true;
  }

  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, (ch) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[ch]));
  }

  function ensureToastHost() {
    if (toastHost && document.body.contains(toastHost)) return toastHost;
    toastHost = document.createElement('div');
    toastHost.className = 'erp-dlg-toast-host';
    toastHost.setAttribute('aria-live', 'polite');
    document.body.appendChild(toastHost);
    return toastHost;
  }

  function toast(message, kind, ms) {
    ensureStyle();
    if (!message) return;
    const host = ensureToastHost();
    const el = document.createElement('div');
    el.className = 'erp-dlg-toast ' + (kind || 'info');
    el.textContent = String(message);
    host.appendChild(el);
    const ttl = Number.isFinite(ms) ? ms : (kind === 'err' ? 6500 : 4200);
    setTimeout(() => {
      el.style.opacity = '0';
      el.style.transition = 'opacity .25s';
      setTimeout(() => el.remove(), 280);
    }, ttl);
  }

  function trapFocus(root, event) {
    if (event.key !== 'Tab') return;
    const focusable = root.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
    const list = Array.from(focusable).filter((n) => !n.disabled && n.offsetParent !== null);
    if (!list.length) return;
    const first = list[0];
    const last = list[list.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function openOverlay(options) {
    ensureStyle();
    return new Promise((resolve) => {
      lastFocus = document.activeElement;
      openCount += 1;
      const root = document.createElement('div');
      root.className = 'erp-dlg-root';
      root.setAttribute('role', 'dialog');
      root.setAttribute('aria-modal', 'true');
      root.setAttribute('aria-label', options.title || 'حوار النظام');

      const sheet = document.createElement('div');
      sheet.className = 'erp-dlg-sheet' + (options.wide ? ' erp-dlg-wide' : '');
      root.appendChild(sheet);
      document.body.appendChild(root);

      let settled = false;
      let busy = false;

      function finish(result) {
        if (settled) return;
        settled = true;
        openCount = Math.max(0, openCount - 1);
        root.removeEventListener('keydown', onKey);
        root.remove();
        if (lastFocus && typeof lastFocus.focus === 'function') {
          try { lastFocus.focus(); } catch (_) { /* */ }
        }
        resolve(result);
      }

      function setBusy(on) {
        busy = !!on;
        root.querySelectorAll('[data-erp-action]').forEach((btn) => {
          btn.disabled = busy;
        });
        const load = root.querySelector('[data-erp-loading]');
        if (load) load.hidden = !busy;
      }

      function onKey(event) {
        if (event.key === 'Escape' && !busy && options.dismissible !== false) {
          event.preventDefault();
          finish(options.cancelValue !== undefined ? options.cancelValue : null);
          return;
        }
        trapFocus(root, event);
      }

      root.addEventListener('keydown', onKey);
      root.addEventListener('click', (event) => {
        if (event.target === root && !busy && options.dismissible !== false) {
          finish(options.cancelValue !== undefined ? options.cancelValue : null);
        }
      });

      options.render(sheet, {
        finish,
        setBusy,
        esc,
        root
      });

      const focusEl = sheet.querySelector('[data-erp-focus], textarea, input, select, button.erp-dlg-btn-primary, button');
      setTimeout(() => focusEl && focusEl.focus(), 30);
    });
  }

  function alert(message, opts) {
    const o = opts || {};
    return openOverlay({
      title: o.title || 'تنبيه',
      dismissible: o.dismissible !== false,
      cancelValue: true,
      render(sheet, api) {
        sheet.innerHTML = `
          <h2>${api.esc(o.title || 'تنبيه')}</h2>
          <p class="erp-dlg-desc">${api.esc(message || '')}</p>
          <div class="erp-dlg-actions">
            <button type="button" class="erp-dlg-btn erp-dlg-btn-primary" data-erp-action data-ok>حسنًا</button>
          </div>`;
        sheet.querySelector('[data-ok]').onclick = () => api.finish(true);
      }
    });
  }

  function confirm(message, opts) {
    const o = typeof message === 'object' && message ? message : (opts || {});
    const text = typeof message === 'string' ? message : (o.message || o.text || '');
    const destructive = !!(o.destructive || o.danger);
    return openOverlay({
      title: o.title || (destructive ? 'تأكيد إجراء حساس' : 'تأكيد'),
      dismissible: o.dismissible !== false,
      cancelValue: false,
      render(sheet, api) {
        sheet.innerHTML = `
          <h2>${api.esc(o.title || (destructive ? 'تأكيد إجراء حساس' : 'تأكيد'))}</h2>
          <p class="erp-dlg-desc">${api.esc(o.description || text)}</p>
          ${destructive ? `<div class="erp-dlg-dangerbox">${api.esc(o.warning || 'هذا الإجراء قد لا يمكن التراجع عنه بسهولة.')}</div>` : ''}
          <div class="erp-dlg-actions">
            <button type="button" class="erp-dlg-btn ${destructive ? 'erp-dlg-btn-danger' : 'erp-dlg-btn-primary'}" data-erp-action data-yes>${api.esc(o.confirmLabel || 'تأكيد')}</button>
            <button type="button" class="erp-dlg-btn" data-erp-action data-no>${api.esc(o.cancelLabel || 'إلغاء')}</button>
            <span class="erp-dlg-loading" data-erp-loading hidden><i class="fas fa-spinner fa-spin"></i> جاري التنفيذ…</span>
          </div>`;
        sheet.querySelector('[data-no]').onclick = () => api.finish(false);
        sheet.querySelector('[data-yes]').onclick = async () => {
          if (typeof o.onConfirm === 'function') {
            api.setBusy(true);
            try {
              await o.onConfirm();
              api.finish(true);
            } catch (err) {
              api.setBusy(false);
              const errEl = document.createElement('div');
              errEl.className = 'erp-dlg-dangerbox';
              errEl.textContent = err && err.message ? err.message : 'فشل التنفيذ';
              sheet.querySelector('.erp-dlg-actions').before(errEl);
            }
            return;
          }
          api.finish(true);
        };
      }
    });
  }

  function prompt(message, defaultValue, opts) {
    const o = typeof message === 'object' && message ? message : (opts || {});
    const label = typeof message === 'string' ? message : (o.message || o.label || 'القيمة');
    const initial = defaultValue != null ? defaultValue : (o.defaultValue || '');
    return openOverlay({
      title: o.title || 'إدخال مطلوب',
      dismissible: o.dismissible !== false,
      cancelValue: null,
      render(sheet, api) {
        sheet.innerHTML = `
          <h2>${api.esc(o.title || 'إدخال مطلوب')}</h2>
          <p class="erp-dlg-desc">${api.esc(o.description || '')}</p>
          <div class="erp-dlg-fields">
            <label>${api.esc(label)}
              ${o.multiline
                ? `<textarea data-erp-focus data-val rows="4">${api.esc(initial)}</textarea>`
                : `<input data-erp-focus data-val type="${api.esc(o.inputType || 'text')}" value="${api.esc(initial)}" ${o.required ? 'required' : ''}>`}
              <span class="erp-dlg-error" data-err></span>
            </label>
          </div>
          <div class="erp-dlg-actions">
            <button type="button" class="erp-dlg-btn erp-dlg-btn-primary" data-erp-action data-ok>${api.esc(o.confirmLabel || 'تأكيد')}</button>
            <button type="button" class="erp-dlg-btn" data-erp-action data-no>${api.esc(o.cancelLabel || 'إلغاء')}</button>
          </div>`;
        const input = sheet.querySelector('[data-val]');
        const err = sheet.querySelector('[data-err]');
        const submit = () => {
          const value = String(input.value || '').trim();
          if ((o.required !== false) && !value) {
            err.textContent = o.requiredMessage || 'هذا الحقل إلزامي';
            input.focus();
            return;
          }
          if (typeof o.validate === 'function') {
            const msg = o.validate(value);
            if (msg) {
              err.textContent = String(msg);
              input.focus();
              return;
            }
          }
          api.finish(value);
        };
        sheet.querySelector('[data-no]').onclick = () => api.finish(null);
        sheet.querySelector('[data-ok]').onclick = submit;
        input.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' && !o.multiline) {
            e.preventDefault();
            submit();
          }
        });
      }
    });
  }

  function form(options) {
    const o = options || {};
    const fields = Array.isArray(o.fields) ? o.fields : [];
    return openOverlay({
      title: o.title || 'نموذج',
      wide: !!o.wide,
      dismissible: o.dismissible !== false,
      cancelValue: null,
      render(sheet, api) {
        const fieldsHtml = fields.map((f) => {
          const name = f.name;
          const val = f.value == null ? '' : f.value;
          const type = f.type || 'text';
          let control = '';
          if (type === 'textarea') {
            control = `<textarea name="${api.esc(name)}" rows="${f.rows || 3}" ${f.required ? 'required' : ''} ${f.focus ? 'data-erp-focus' : ''}>${api.esc(val)}</textarea>`;
          } else if (type === 'select') {
            control = `<select name="${api.esc(name)}" ${f.required ? 'required' : ''} ${f.focus ? 'data-erp-focus' : ''}>${
              (f.options || []).map((opt) => {
                const v = typeof opt === 'object' ? opt.value : opt;
                const l = typeof opt === 'object' ? opt.label : opt;
                return `<option value="${api.esc(v)}" ${String(v) === String(val) ? 'selected' : ''}>${api.esc(l)}</option>`;
              }).join('')
            }</select>`;
          } else {
            control = `<input name="${api.esc(name)}" type="${api.esc(type)}" value="${api.esc(val)}" ${f.required ? 'required' : ''} ${f.focus ? 'data-erp-focus' : ''} ${f.min != null ? `min="${api.esc(f.min)}"` : ''} ${f.step != null ? `step="${api.esc(f.step)}"` : ''} ${f.placeholder ? `placeholder="${api.esc(f.placeholder)}"` : ''}>`;
          }
          return `<label>${api.esc(f.label || name)}${control}<span class="erp-dlg-error" data-err-for="${api.esc(name)}"></span></label>`;
        }).join('');

        sheet.innerHTML = `
          <h2>${api.esc(o.title || 'نموذج')}</h2>
          ${o.description ? `<p class="erp-dlg-desc">${api.esc(o.description)}</p>` : ''}
          ${o.metaHtml || ''}
          ${o.warning ? `<div class="erp-dlg-warnbox">${api.esc(o.warning)}</div>` : ''}
          <form class="erp-dlg-fields" data-erp-form>${fieldsHtml}
            <div class="erp-dlg-error" data-form-err></div>
          </form>
          <div class="erp-dlg-actions">
            <button type="button" class="erp-dlg-btn ${o.danger ? 'erp-dlg-btn-danger' : 'erp-dlg-btn-primary'}" data-erp-action data-ok>${api.esc(o.confirmLabel || 'حفظ')}</button>
            <button type="button" class="erp-dlg-btn" data-erp-action data-no>${api.esc(o.cancelLabel || 'إلغاء')}</button>
            <span class="erp-dlg-loading" data-erp-loading hidden><i class="fas fa-spinner fa-spin"></i> جاري التنفيذ…</span>
          </div>`;

        const formEl = sheet.querySelector('[data-erp-form]');
        const formErr = sheet.querySelector('[data-form-err]');

        function readValues() {
          const data = {};
          fields.forEach((f) => {
            const el = formEl.querySelector(`[name="${f.name}"]`);
            data[f.name] = el ? el.value : '';
          });
          return data;
        }

        async function submit() {
          formErr.textContent = '';
          formEl.querySelectorAll('[data-err-for]').forEach((n) => { n.textContent = ''; });
          const data = readValues();
          for (const f of fields) {
            const raw = String(data[f.name] == null ? '' : data[f.name]).trim();
            if (f.required && !raw) {
              const err = formEl.querySelector(`[data-err-for="${f.name}"]`);
              if (err) err.textContent = 'مطلوب';
              formEl.querySelector(`[name="${f.name}"]`)?.focus();
              return;
            }
          }
          if (typeof o.validate === 'function') {
            const msg = o.validate(data);
            if (msg) {
              formErr.textContent = String(msg);
              return;
            }
          }
          if (typeof o.onSubmit === 'function') {
            api.setBusy(true);
            try {
              const result = await o.onSubmit(data);
              api.finish(result === undefined ? data : result);
            } catch (err) {
              api.setBusy(false);
              formErr.textContent = err && err.message ? err.message : 'فشل الحفظ';
            }
            return;
          }
          api.finish(data);
        }

        sheet.querySelector('[data-no]').onclick = () => api.finish(null);
        sheet.querySelector('[data-ok]').onclick = () => submit();
        formEl.addEventListener('submit', (e) => { e.preventDefault(); submit(); });
      }
    });
  }

  /**
   * Accounting reversal modal — specialized workbench dialog.
   * options.entry: { entry_id, entry_number, source_label, entry_date, debit_total, credit_total, status, reference_number }
   * options.submit(reason, reverseDate) => Promise
   */
  function reverseJournal(options) {
    const o = options || {};
    const entry = o.entry || {};
    return form({
      title: 'عكس القيد المحاسبي',
      wide: true,
      danger: true,
      confirmLabel: 'تأكيد العكس',
      cancelLabel: 'إلغاء',
      description: 'سيتم إنشاء قيد عكسي متوازن مع الإبقاء على القيد الأصلي وسجل التدقيق. لا يُحذف الأصل.',
      warning: 'العملية تنشئ أثرًا محاسبيًا عكسيًا دائمًا. السبب إلزامي، ولا يُسمح بتكرار العكس.',
      metaHtml: `<div class="erp-dlg-meta">
        <div><span>رقم القيد الأصلي</span><strong>${esc(entry.entry_number || entry.entry_id || '—')}</strong></div>
        <div><span>المصدر</span><strong>${esc(entry.source_label || entry.reference_type || '—')}</strong></div>
        <div><span>تاريخ القيد</span><strong>${esc(String(entry.entry_date || '').slice(0, 10) || '—')}</strong></div>
        <div><span>الحالة</span><strong>${esc(entry.status_label || entry.status || '—')}</strong></div>
        <div><span>مدين</span><strong>${esc(entry.debit_display != null ? entry.debit_display : entry.debit_total)}</strong></div>
        <div><span>دائن</span><strong>${esc(entry.credit_display != null ? entry.credit_display : entry.credit_total)}</strong></div>
        <div class="wide"><span>المرجع</span><strong>${esc(entry.display_reference || entry.reference_number || entry.reference_id || '—')}</strong></div>
      </div>`,
      fields: [
        { name: 'reason', label: 'سبب العكس المحاسبي *', type: 'textarea', required: true, focus: true, rows: 3, value: '' },
        { name: 'reverse_date', label: 'تاريخ العكس', type: 'date', value: o.reverseDate || new Date().toISOString().slice(0, 10) }
      ],
      validate(data) {
        if (!String(data.reason || '').trim()) return 'سبب العكس إلزامي';
        return null;
      },
      async onSubmit(data) {
        if (typeof o.submit !== 'function') return data;
        return o.submit(String(data.reason).trim(), data.reverse_date);
      }
    });
  }

  function installNativeShims() {
    if (root.__erpDialogsShimmed) return;
    root.__erpDialogsShimmed = true;

    root.__erpNativeAlert = root.alert ? root.alert.bind(root) : null;
    root.__erpNativeConfirm = root.confirm ? root.confirm.bind(root) : null;
    root.__erpNativePrompt = root.prompt ? root.prompt.bind(root) : null;

    // alert → in-app toast (never native "says" dialog).
    root.alert = function erpAlert(message) {
      toast(String(message == null ? '' : message), 'info');
    };

    /**
     * After call-site migration, confirm/prompt return Promises and must be awaited.
     * Enable with: window.__ERP_DIALOG_ASYNC_SHIM = true (set by injector after migration).
     */
    if (root.__ERP_DIALOG_ASYNC_SHIM) {
      root.confirm = function erpConfirmAsync(message) {
        return confirm(String(message == null ? '' : message));
      };
      root.prompt = function erpPromptAsync(message, defaultValue) {
        return prompt(String(message == null ? '' : message), defaultValue == null ? '' : defaultValue, {
          title: 'إدخال مطلوب',
          required: true,
          multiline: String(message || '').length > 60
        });
      };
    }
  }

  const Api = {
    alert,
    confirm,
    prompt,
    form,
    toast,
    reverseJournal,
    installNativeShims,
    esc
  };

  root.ErpDialog = Api;
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        ensureStyle();
        installNativeShims();
      });
    } else {
      ensureStyle();
      installNativeShims();
    }
  }
})(typeof window !== 'undefined' ? window : globalThis);
