(() => {
  const escapeHtml = (value = '') => String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

  const typeLabels = {
    HQ: 'المقر الرئيسي',
    BRANCH: 'فرع',
    INCUBATOR: 'حاضنة',
    PLATFORM: 'منصة',
    OFFICE: 'مكتب'
  };

  const statusLabels = {
    Active: 'نشط',
    Inactive: 'غير نشط',
    Pending: 'قيد المراجعة'
  };

  window.EntityPage = {
    escapeHtml,
    typeLabels,
    statusLabels,

    async fetchJson(url) {
      const response = await fetch(url, { headers: { Accept: 'application/json' } });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      return response.json();
    },

    setupToolbar({ searchInput, typeFilter, resetButton, cards, statusEl, getSearchText, getTypeValue }) {
      const applyFilters = () => {
        const query = (searchInput?.value || '').trim().toLowerCase();
        const type = typeFilter?.value || 'all';
        let visible = 0;
        cards.forEach((card) => {
          const searchText = (getSearchText(card) || '').toLowerCase();
          const cardType = getTypeValue(card) || '';
          const matchesSearch = !query || searchText.includes(query);
          const matchesType = type === 'all' || cardType === type;
          const show = matchesSearch && matchesType;
          card.style.display = show ? '' : 'none';
          if (show) visible += 1;
        });
        if (statusEl) {
          statusEl.textContent = `تم عرض ${visible} عنصر`;
        }
      };

      searchInput?.addEventListener('input', applyFilters);
      typeFilter?.addEventListener('change', applyFilters);
      resetButton?.addEventListener('click', () => {
        if (searchInput) searchInput.value = '';
        if (typeFilter) typeFilter.value = 'all';
        applyFilters();
      });

      return applyFilters;
    },

    setupToTop() {
      document.getElementById('to-top')?.addEventListener('click', () => {
        const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        window.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' });
      });
    },

    renderEntityCards(grid, items, options = {}) {
      if (!grid) return [];
      const {
        badgeKey = 'type',
        titleKey = 'name',
        descKey = 'description',
        iconClass = 'fa-building',
        metaBuilder
      } = options;

      if (!items.length) {
        grid.innerHTML = '<div class="entity-empty"><i class="fas fa-inbox"></i> لا توجد بيانات متاحة حالياً</div>';
        return [];
      }

      grid.innerHTML = items.map((item) => {
        const badge = typeLabels[item[badgeKey]] || item[badgeKey] || 'عنصر';
        const title = item[titleKey] || 'بدون اسم';
        const desc = item[descKey] || item.location || 'لا يوجد وصف';
        const status = statusLabels[item.status] || item.status || '';
        const meta = typeof metaBuilder === 'function'
          ? metaBuilder(item)
          : `
            ${item.location ? `<span><i class="fas fa-location-dot"></i> ${escapeHtml(item.location)}</span>` : ''}
            ${status ? `<span><i class="fas fa-circle-check"></i> ${escapeHtml(status)}</span>` : ''}
            ${item.users_count != null ? `<span><i class="fas fa-users"></i> ${escapeHtml(String(item.users_count))} مستخدم</span>` : ''}
          `;

        return `
          <article class="entity-card" data-search="${escapeHtml(`${title} ${desc} ${item.location || ''} ${badge}`)}" data-type="${escapeHtml(item[badgeKey] || 'all')}">
            <div class="entity-card-top">
              <span class="entity-badge">${escapeHtml(badge)}</span>
              <span class="entity-icon" aria-hidden="true"><i class="fas ${escapeHtml(iconClass)}"></i></span>
            </div>
            <div class="entity-content">
              <h3 class="entity-title">${escapeHtml(title)}</h3>
              <p class="entity-desc">${escapeHtml(desc)}</p>
              <p class="entity-meta">${meta}</p>
            </div>
          </article>
        `;
      }).join('');

      return Array.from(grid.querySelectorAll('.entity-card'));
    }
  };
})();
