(function () {
  'use strict';

  const escapeHtml = (value) => String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

  const renderStats = (stats) => (stats || []).map((stat) => (
    `<article class="premium-stat"><strong>${escapeHtml(stat.value)}</strong><span>${escapeHtml(stat.label)}</span></article>`
  )).join('');

  const renderCards = (cards) => (cards || []).map((card) => (
    `<article class="premium-card" data-tags="${escapeHtml((card.tags || []).join(','))}">
      <span class="premium-card-icon"><i class="fas ${escapeHtml(card.icon)}" aria-hidden="true"></i></span>
      <h3>${escapeHtml(card.title)}</h3>
      <p>${escapeHtml(card.desc)}</p>
      ${card.tags?.length ? `<div class="premium-card-meta">${card.tags.map((tag) => `<span class="premium-tag">${escapeHtml(tag)}</span>`).join('')}</div>` : ''}
      <a class="premium-card-btn" href="${escapeHtml(card.href)}">${escapeHtml(card.cta || 'عرض التفاصيل')}</a>
    </article>`
  )).join('');

  const renderTable = (table) => {
    if (!table) return '';
    const head = table.columns.map((col) => `<th>${escapeHtml(col)}</th>`).join('');
    const rows = table.rows.map((row) => {
      const cells = row.map((cell, index) => {
        if (typeof cell === 'object' && cell?.type === 'status') {
          return `<td><span class="premium-status ${escapeHtml(cell.value)}">${escapeHtml(cell.label)}</span></td>`;
        }
        if (index === row.length - 1 && table.actionHref) {
          return `<td><a class="premium-card-btn ghost" href="${escapeHtml(table.actionHref)}">${escapeHtml(String(cell))}</a></td>`;
        }
        return `<td>${escapeHtml(String(cell))}</td>`;
      }).join('');
      return `<tr data-search="${escapeHtml(row.join(' '))}">${cells}</tr>`;
    }).join('');
    return `
      <div class="premium-toolbar">
        <input class="premium-search" type="search" placeholder="ابحث في البيانات..." aria-label="بحث" data-table-search />
        ${(table.filters || []).map((filter, index) => (
          `<button type="button" class="premium-filter-btn${index === 0 ? ' is-active' : ''}" data-filter="${escapeHtml(filter)}">${escapeHtml(filter)}</button>`
        )).join('')}
      </div>
      <div class="premium-table-wrap">
        <table class="premium-table">
          <thead><tr>${head}</tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
  };

  const renderTimeline = (items) => (items || []).map((item) => (
    `<article class="premium-timeline-item">
      <div class="premium-timeline-date">${escapeHtml(item.date)}</div>
      <div>
        <h4>${escapeHtml(item.title)}</h4>
        <p>${escapeHtml(item.desc)}</p>
      </div>
    </article>`
  )).join('');

  const renderFaq = (items) => (items || []).map((item, index) => (
    `<article class="premium-faq-item" data-faq="${index}">
      <button type="button" class="premium-faq-q" aria-expanded="false">
        <span>${escapeHtml(item.q)}</span>
        <i class="fas fa-chevron-down" aria-hidden="true"></i>
      </button>
      <div class="premium-faq-a">${escapeHtml(item.a)}</div>
    </article>`
  )).join('');

  window.renderPremiumSector = function renderPremiumSector(config) {
    const root = document.getElementById('premium-sector-root');
    if (!root || !config) return;

    const tabsHtml = (config.tabs || []).map((tab, index) => (
      `<button type="button" class="premium-tab${index === 0 ? ' is-active' : ''}" data-tab="${escapeHtml(tab.id)}">${escapeHtml(tab.label)}</button>`
    )).join('');

    const panelsHtml = (config.tabs || []).map((tab, index) => (
      `<section class="premium-panel${index === 0 ? ' is-active' : ''}" data-panel="${escapeHtml(tab.id)}">
        ${tab.title ? `<h2 class="premium-section-title">${escapeHtml(tab.title)}</h2>` : ''}
        ${tab.desc ? `<p class="premium-section-desc">${escapeHtml(tab.desc)}</p>` : ''}
        ${tab.cards ? `<div class="premium-cards">${renderCards(tab.cards)}</div>` : ''}
        ${tab.table ? renderTable(tab.table) : ''}
        ${tab.timeline ? `<div class="premium-timeline">${renderTimeline(tab.timeline)}</div>` : ''}
        ${tab.faq ? `<div class="premium-faq">${renderFaq(tab.faq)}</div>` : ''}
      </section>`
    )).join('');

    root.innerHTML = `
      <section class="premium-sector">
        <header class="premium-hero">
          <div class="premium-hero-inner">
            <div>
              <div class="premium-hero-badge"><i class="fas ${escapeHtml(config.icon)}" aria-hidden="true"></i> ${escapeHtml(config.badge || 'إمبراطورية نايوش')}</div>
              <h1>${escapeHtml(config.title)}</h1>
              <p>${escapeHtml(config.subtitle)}</p>
            </div>
            <div class="premium-hero-icon" aria-hidden="true"><i class="fas ${escapeHtml(config.icon)}"></i></div>
          </div>
        </header>
        <div class="premium-stats" aria-label="إحصائيات">${renderStats(config.stats)}</div>
        <nav class="premium-tabs" aria-label="أقسام الصفحة">${tabsHtml}</nav>
        ${panelsHtml}
        <section class="premium-cta-strip">
          <div>
            <h3>${escapeHtml(config.cta?.title || 'ابدأ الآن')}</h3>
            <p>${escapeHtml(config.cta?.desc || 'انضم إلى منظومة نايوش واستفد من الخدمات المتكاملة.')}</p>
          </div>
          <div class="premium-cta-actions">
            ${(config.cta?.actions || []).map((action) => (
              `<a class="${escapeHtml(action.tone || 'primary')}" href="${escapeHtml(action.href)}">${escapeHtml(action.label)}</a>`
            )).join('')}
          </div>
        </section>
      </section>
    `;

    initTabs(root);
    initFaq(root);
    initTableTools(root);
  };

  function initTabs(root) {
    const tabs = root.querySelectorAll('.premium-tab');
    const panels = root.querySelectorAll('.premium-panel');
    tabs.forEach((tab) => {
      tab.addEventListener('click', () => {
        const id = tab.getAttribute('data-tab');
        tabs.forEach((item) => item.classList.toggle('is-active', item === tab));
        panels.forEach((panel) => panel.classList.toggle('is-active', panel.getAttribute('data-panel') === id));
      });
    });
  }

  function initFaq(root) {
    root.querySelectorAll('.premium-faq-q').forEach((button) => {
      button.addEventListener('click', () => {
        const item = button.closest('.premium-faq-item');
        const isOpen = item.classList.contains('is-open');
        root.querySelectorAll('.premium-faq-item').forEach((faq) => faq.classList.remove('is-open'));
        if (!isOpen) item.classList.add('is-open');
        button.setAttribute('aria-expanded', String(!isOpen));
      });
    });
  }

  function initTableTools(root) {
    root.querySelectorAll('[data-table-search]').forEach((input) => {
      const table = input.closest('.premium-panel')?.querySelector('.premium-table tbody');
      if (!table) return;
      input.addEventListener('input', () => {
        const query = input.value.trim().toLowerCase();
        table.querySelectorAll('tr').forEach((row) => {
          const haystack = (row.getAttribute('data-search') || '').toLowerCase();
          row.style.display = !query || haystack.includes(query) ? '' : 'none';
        });
      });
    });

    root.querySelectorAll('.premium-filter-btn').forEach((button) => {
      button.addEventListener('click', () => {
        const panel = button.closest('.premium-panel');
        panel.querySelectorAll('.premium-filter-btn').forEach((item) => item.classList.remove('is-active'));
        button.classList.add('is-active');
        const filter = button.getAttribute('data-filter');
        panel.querySelectorAll('.premium-card').forEach((card) => {
          if (filter === 'الكل') {
            card.style.display = '';
            return;
          }
          const tags = (card.getAttribute('data-tags') || '').split(',');
          card.style.display = tags.includes(filter) ? '' : 'none';
        });
        const tbody = panel.querySelector('.premium-table tbody');
        if (tbody) {
          tbody.querySelectorAll('tr').forEach((row) => {
            if (filter === 'الكل') {
              row.style.display = '';
              return;
            }
            const haystack = (row.getAttribute('data-search') || '');
            row.style.display = haystack.includes(filter) ? '' : 'none';
          });
        }
      });
    });
  }

  document.getElementById('to-top')?.addEventListener('click', () => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' });
  });
})();
