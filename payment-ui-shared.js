/* Shared helpers for payment admin / credit top-up pages */
window.PaymentUI = {
  getToken() {
    const m = document.cookie.match(/authToken=([^;]+)/);
    const platform = m ? decodeURIComponent(m[1]) : localStorage.getItem('authToken') || '';
    const tenant = localStorage.getItem('tenant_session') || '';
    return tenant || platform;
  },

  getBaseUrl() {
    return window.location.origin;
  },

  showAlert(id, msg, type = 'ok') {
    const el = document.getElementById(id || 'alert');
    if (!el) return;
    el.textContent = msg;
    el.className = `pay-alert show ${type}`;
  },

  hideAlert(id) {
    const el = document.getElementById(id || 'alert');
    if (el) el.classList.remove('show');
  },

  async api(path, opts = {}) {
    const r = await fetch(path, {
      ...opts,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.getToken()}`,
        ...(opts.headers || {}),
      },
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data.message || 'خطأ في الطلب');
    return data;
  },

  toggleSecret(inputId, btn) {
    const input = document.getElementById(inputId);
    if (!input) return;
    const hidden = input.type === 'password';
    input.type = hidden ? 'text' : 'password';
    if (btn) {
      const icon = btn.querySelector('i');
      if (icon) icon.className = hidden ? 'fa fa-eye-slash' : 'fa fa-eye';
    }
  },

  async copyText(text, onDone) {
    try {
      await navigator.clipboard.writeText(text);
      if (onDone) onDone('تم النسخ');
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      if (onDone) onDone('تم النسخ');
    }
  },

  formatMoney(amount, currency = 'SAR') {
    const n = Number(amount) || 0;
    return `${n.toLocaleString('ar-EG')} ${currency}`;
  },

  statusBadge(configured, enabled) {
    if (configured) return '<span class="pay-badge connected"><i class="fa fa-check-circle"></i> متصل</span>';
    if (enabled) return '<span class="pay-badge disconnected"><i class="fa fa-exclamation-circle"></i> غير مكتمل</span>';
    return '<span class="pay-badge disconnected"><i class="fa fa-circle"></i> غير مفعّل</span>';
  },

  initTabs(tabSelector, panelPrefix) {
    document.querySelectorAll(tabSelector).forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll(tabSelector).forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        document.querySelectorAll('.pay-panel').forEach((p) => p.classList.remove('active'));
        const panel = document.getElementById(`${panelPrefix}${btn.dataset.tab}`);
        if (panel) panel.classList.add('active');
      });
    });
  },

  renderWebhookBox(label, path) {
    const full = `${this.getBaseUrl()}${path}`;
    const id = `wh-${path.replace(/\W/g, '-')}`;
    return `
      <div class="pay-webhook-box">
        <label>${label}</label>
        <div class="pay-webhook-row">
          <code id="${id}">${full}</code>
          <button type="button" class="pay-btn pay-btn-secondary" style="padding:.45rem .75rem"
            onclick="PaymentUI.copyText(document.getElementById('${id}').textContent, (m) => PaymentUI.showAlert('alert', m, 'ok'))">
            <i class="fa fa-copy"></i>
          </button>
        </div>
      </div>`;
  },

  secretField(id, label, placeholder, hasSaved) {
    const hint = hasSaved ? '<div class="pay-saved-hint"><i class="fa fa-lock"></i> محفوظ — اتركه فارغاً للإبقاء على القيمة الحالية</div>' : '';
    return `
      <div class="pay-field">
        <label for="${id}">${label}</label>
        <div class="pay-input-wrap">
          <input id="${id}" type="password" placeholder="${placeholder}" autocomplete="off">
          <button type="button" class="pay-toggle-secret" onclick="PaymentUI.toggleSecret('${id}', this)">
            <i class="fa fa-eye"></i>
          </button>
        </div>
        ${hint}
      </div>`;
  },
};
