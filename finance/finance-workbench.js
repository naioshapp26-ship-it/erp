/**
 * Shared helpers for NAIOSH finance operational workbenches.
 * Does not invent data — callers supply API payloads.
 */
(function (root) {
  'use strict';

  function headers(extra) {
    return Object.assign(
      { 'Content-Type': 'application/json' },
      root.getFinanceHeaders ? root.getFinanceHeaders() : {},
      extra || {}
    );
  }

  function entityId() {
    return root.getFinanceEntityId ? root.getFinanceEntityId() : '';
  }

  function money(n, currency) {
    const value = Number(n || 0);
    const formatted = value.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
    return currency ? `${formatted} ${currency}` : formatted;
  }

  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, (ch) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[ch]));
  }

  function badge(text, kind) {
    return `<span class="fw-badge ${kind || ''}">${esc(text)}</span>`;
  }

  function statusBadge(status) {
    const s = String(status || '').toUpperCase();
    if (['POSTED', 'APPROVED', 'PAID', 'ACTIVE', 'VALIDATED', 'OPERATIONAL', 'تشغيلية'].includes(s)) {
      return badge(status, 'ok');
    }
    if (['PARTIAL', 'QUEUED', 'READY', 'PENDING', 'DRAFT', 'FAILED', 'REJECTED', 'جزئية'].includes(s)) {
      return badge(status, 'warn');
    }
    if (['CANCELLED', 'ERROR', 'UNBALANCED'].includes(s)) return badge(status, 'bad');
    return badge(status || '—', 'muted');
  }

  async function api(method, url, body) {
    const res = await fetch(url, {
      method,
      headers: headers(),
      credentials: 'same-origin',
      body: body == null ? undefined : JSON.stringify(body)
    });
    let json = null;
    const raw = await res.text();
    try { json = raw ? JSON.parse(raw) : null; } catch { /* */ }
    return { ok: res.ok, status: res.status, json, raw };
  }

  function setAlert(el, text, kind) {
    if (!el) return;
    if (!text) {
      el.hidden = true;
      el.textContent = '';
      return;
    }
    el.hidden = false;
    el.className = 'fw-alert ' + (kind || 'info');
    el.textContent = text;
  }

  function paginate(rows, page, pageSize) {
    const total = rows.length;
    const pages = Math.max(1, Math.ceil(total / pageSize));
    const safePage = Math.min(Math.max(1, page), pages);
    const start = (safePage - 1) * pageSize;
    return {
      rows: rows.slice(start, start + pageSize),
      page: safePage,
      pages,
      total,
      from: total ? start + 1 : 0,
      to: Math.min(start + pageSize, total)
    };
  }

  function renderPager(el, state, onChange) {
    if (!el) return;
    el.innerHTML = `
      <span>عرض ${state.from}–${state.to} من ${state.total}</span>
      <span class="fw-actions">
        <button type="button" class="fw-btn fw-btn-mini" data-p="prev" ${state.page <= 1 ? 'disabled' : ''}>السابق</button>
        <span>صفحة ${state.page} / ${state.pages}</span>
        <button type="button" class="fw-btn fw-btn-mini" data-p="next" ${state.page >= state.pages ? 'disabled' : ''}>التالي</button>
      </span>`;
    el.querySelector('[data-p="prev"]')?.addEventListener('click', () => onChange(state.page - 1));
    el.querySelector('[data-p="next"]')?.addEventListener('click', () => onChange(state.page + 1));
  }

  function emptyState(message, actionHtml) {
    return `<div class="fw-empty"><i class="fas fa-inbox"></i>${esc(message || 'لا توجد سجلات')}${actionHtml || ''}</div>`;
  }

  function loadingState(message) {
    return `<div class="fw-loading"><i class="fas fa-spinner fa-spin"></i>${esc(message || 'جاري التحميل…')}</div>`;
  }

  function topNav(items, currentHref) {
    return `<nav class="fw-topnav" aria-label="روابط مالية">
      ${(items || []).map(([href, label]) => {
        const active = currentHref && (currentHref === href || location.pathname.endsWith(href));
        return `<a href="${href}" class="${active ? 'active' : ''}">${esc(label)}</a>`;
      }).join('')}
    </nav>`;
  }

  root.FinanceWorkbench = {
    headers,
    entityId,
    money,
    esc,
    badge,
    statusBadge,
    api,
    setAlert,
    paginate,
    renderPager,
    emptyState,
    loadingState,
    topNav
  };
})(typeof window !== 'undefined' ? window : globalThis);
