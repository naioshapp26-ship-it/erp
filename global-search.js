(() => {
  const MIN_QUERY = 2;
  const MAX_RESULTS = 8;
  const state = {
    index: [],
    ready: false,
    activeIndex: -1,
    lastQuery: ''
  };

  const normalize = (value) => {
    return (value || '')
      .toString()
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim();
  };

  const dedupeIndex = (items) => {
    const map = new Map();
    items.forEach(item => {
      if (!item || !item.path || !item.title) return;
      if (!item.path.startsWith('/')) return;
      if (!map.has(item.path)) {
        map.set(item.path, {
          path: item.path,
          title: item.title,
          keywords: item.keywords || `${item.title} ${item.path}`
        });
      }
    });
    return Array.from(map.values());
  };

  const collectAnchors = () => {
    const anchors = Array.from(document.querySelectorAll('a[href^="/"]'));
    return anchors.map(anchor => {
      const path = anchor.getAttribute('href');
      const title = (anchor.getAttribute('aria-label') || anchor.getAttribute('title') || anchor.textContent || '').trim();
      if (!path || !title) return null;
      return { path, title, keywords: `${title} ${path}` };
    }).filter(Boolean);
  };

  const loadIndex = async () => {
    let list = [];
    if (Array.isArray(window.NAIOSH_SEARCH_INDEX)) {
      list = window.NAIOSH_SEARCH_INDEX;
    } else {
      try {
        const resp = await fetch('/api/search-index');
        if (resp.ok) {
          list = await resp.json();
        }
      } catch (error) {
        list = [];
      }
    }
    list = dedupeIndex(list.concat(collectAnchors()));
    state.index = list;
    state.ready = true;
  };

  const scoreItem = (item, query) => {
    const title = normalize(item.title);
    const keywords = normalize(item.keywords);
    let score = 0;
    if (title.startsWith(query)) score += 3;
    if (title.includes(query)) score += 2;
    if (keywords.includes(query)) score += 1;
    return score;
  };

  const searchIndex = (query) => {
    const clean = normalize(query);
    if (clean.length < MIN_QUERY) return [];
    const results = state.index
      .map(item => ({ item, score: scoreItem(item, clean) }))
      .filter(row => row.score > 0)
      .sort((a, b) => b.score - a.score || a.item.title.localeCompare(b.item.title))
      .slice(0, MAX_RESULTS)
      .map(row => row.item);
    return results;
  };

  const createSearchBar = (target) => {
    const wrapper = document.createElement('div');
    wrapper.className = 'global-search-wrapper';
    wrapper.innerHTML = `
      <input type="search" class="global-search-input" placeholder="ابحث عن صفحة او قسم او نظام فرعي..." aria-label="بحث سريع">
      <div class="global-search-results hidden" role="listbox"></div>
    `;

    target.appendChild(wrapper);
    const input = wrapper.querySelector('input');
    const resultsEl = wrapper.querySelector('.global-search-results');

    const renderResults = (items) => {
      resultsEl.innerHTML = '';
      if (!items.length) {
        resultsEl.classList.add('hidden');
        return;
      }
      items.forEach((item, index) => {
        const row = document.createElement('div');
        row.className = 'global-search-item';
        row.dataset.index = String(index);
        row.innerHTML = `
          <div class="global-search-title">${item.title}</div>
          <div class="global-search-path">${item.path}</div>
        `;
        row.addEventListener('click', () => {
          window.location.href = item.path;
        });
        resultsEl.appendChild(row);
      });
      state.activeIndex = -1;
      resultsEl.classList.remove('hidden');
    };

    const updateActiveItem = () => {
      const items = Array.from(resultsEl.querySelectorAll('.global-search-item'));
      items.forEach(item => item.classList.remove('active'));
      if (state.activeIndex >= 0 && items[state.activeIndex]) {
        items[state.activeIndex].classList.add('active');
      }
    };

    const handleInput = () => {
      const query = input.value;
      state.lastQuery = query;
      const items = searchIndex(query);
      renderResults(items);
    };

    input.addEventListener('input', handleInput);
    input.addEventListener('focus', handleInput);
    input.addEventListener('keydown', (event) => {
      const items = Array.from(resultsEl.querySelectorAll('.global-search-item'));
      if (!items.length) return;
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        state.activeIndex = (state.activeIndex + 1) % items.length;
        updateActiveItem();
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        state.activeIndex = (state.activeIndex - 1 + items.length) % items.length;
        updateActiveItem();
      }
      if (event.key === 'Enter' && state.activeIndex >= 0 && items[state.activeIndex]) {
        event.preventDefault();
        items[state.activeIndex].click();
      }
      if (event.key === 'Escape') {
        resultsEl.classList.add('hidden');
      }
    });

    document.addEventListener('click', (event) => {
      if (!wrapper.contains(event.target)) {
        resultsEl.classList.add('hidden');
      }
    });
  };

  function getPageScope() {
    return document.querySelector('[data-page-scope]') ||
      document.querySelector('main') ||
      document.querySelector('.container') ||
      document.body;
  }

  const setupGlobalSearchBar = () => {
    if (document.querySelector('.global-search-wrapper')) {
      document.dispatchEvent(new CustomEvent('global-search:ready'));
      return;
    }
    const slot = document.getElementById('global-search-slot');
    if (slot) {
      createSearchBar(slot);
      document.dispatchEvent(new CustomEvent('global-search:ready'));
      return;
    }
    const scope = getPageScope();
    if (!scope) return;
    const fixed = document.createElement('div');
    fixed.className = 'global-search-fixed';
    scope.prepend(fixed);
    createSearchBar(fixed);
    document.dispatchEvent(new CustomEvent('global-search:ready'));
  };

  const ensurePageSearch = (scope) => {
    if (!scope || scope.querySelector('.page-search-bar')) return;
    const bar = document.createElement('div');
    bar.className = 'page-search-bar';
    bar.innerHTML = `
      <input type="search" placeholder="بحث داخل الصفحة..." aria-label="بحث داخل الصفحة">
      <button type="button" class="page-search-clear">مسح</button>
    `;
    scope.prepend(bar);
    const input = bar.querySelector('input');
    const clearBtn = bar.querySelector('button');

    const applyFilter = () => {
      const query = normalize(input.value);
      applyPageFilter(scope, query);
    };

    input.addEventListener('input', applyFilter);
    clearBtn.addEventListener('click', () => {
      input.value = '';
      applyFilter();
    });
  };

  const parseCellValue = (value) => {
    const text = normalize(value);
    const numeric = text.replace(/[^0-9.-]/g, '');
    if (numeric && text.match(/^[0-9\s,.-]+$/)) {
      const parsed = parseFloat(numeric.replace(/,/g, ''));
      if (!Number.isNaN(parsed)) return { type: 'number', value: parsed };
    }
    if (text.match(/^\d{4}-\d{2}-\d{2}$/)) {
      const dateValue = new Date(text).getTime();
      if (!Number.isNaN(dateValue)) return { type: 'date', value: dateValue };
    }
    return { type: 'text', value: text };
  };

  const sortTable = (table, columnIndex, direction) => {
    const tbody = table.tBodies[0];
    if (!tbody) return;
    const rows = Array.from(tbody.querySelectorAll('tr'));
    rows.sort((rowA, rowB) => {
      const cellA = rowA.children[columnIndex];
      const cellB = rowB.children[columnIndex];
      const valueA = parseCellValue(cellA ? cellA.textContent : '');
      const valueB = parseCellValue(cellB ? cellB.textContent : '');
      if (valueA.type !== valueB.type) {
        return valueA.value.toString().localeCompare(valueB.value.toString());
      }
      if (valueA.value < valueB.value) return direction === 'asc' ? -1 : 1;
      if (valueA.value > valueB.value) return direction === 'asc' ? 1 : -1;
      return 0;
    });
    rows.forEach(row => tbody.appendChild(row));
  };

  const applyTableFilter = (table) => {
    const tbody = table.tBodies[0];
    if (!tbody) return;
    const globalQuery = normalize(table.dataset.globalQuery || '');
    const localQuery = normalize(table.dataset.localQuery || '');
    const tokens = [globalQuery, localQuery].filter(Boolean);
    const rows = Array.from(tbody.querySelectorAll('tr'));
    rows.forEach(row => {
      const text = normalize(row.textContent);
      const matches = tokens.every(token => text.includes(token));
      row.style.display = matches ? '' : 'none';
    });
  };

  const ensureTableTools = (scope) => {
    const tables = Array.from(scope.querySelectorAll('table'));
    tables.forEach(table => {
      if (table.dataset.searchReady === 'true') return;
      table.dataset.searchReady = 'true';
      table.classList.add('table-sortable');

      const toolbar = document.createElement('div');
      toolbar.className = 'table-toolbar';
      toolbar.innerHTML = `
        <input type="search" placeholder="فلترة الجدول..." aria-label="فلترة الجدول">
      `;

      const host = table.closest('.table-scroll, .overflow-x-auto') || table;
      host.parentElement.insertBefore(toolbar, host);

      const input = toolbar.querySelector('input');
      input.addEventListener('input', () => {
        table.dataset.localQuery = input.value || '';
        applyTableFilter(table);
      });

      const headers = Array.from(table.querySelectorAll('thead th'));
      headers.forEach((th, index) => {
        const indicator = document.createElement('span');
        indicator.className = 'table-sort-indicator';
        indicator.textContent = '';
        th.prepend(indicator);
        th.addEventListener('click', () => {
          const current = th.dataset.sortDir === 'asc' ? 'desc' : 'asc';
          headers.forEach(header => {
            header.dataset.sortDir = '';
            const icon = header.querySelector('.table-sort-indicator');
            if (icon) icon.textContent = '';
          });
          th.dataset.sortDir = current;
          indicator.textContent = current === 'asc' ? '▲' : '▼';
          sortTable(table, index, current);
        });
      });
    });
  };

  const applyCollectionFilter = (scope, query) => {
    const containers = Array.from(scope.querySelectorAll('.card-list, .grid, ul, ol'));
    containers.forEach(container => {
      const children = Array.from(container.children);
      if (children.length < 3) return;
      children.forEach(child => {
        const text = normalize(child.textContent);
        child.style.display = !query || text.includes(query) ? '' : 'none';
      });
    });
  };

  const applyPageFilter = (scope, query) => {
    const tables = Array.from(scope.querySelectorAll('table'));
    tables.forEach(table => {
      table.dataset.globalQuery = query;
      applyTableFilter(table);
    });
    applyCollectionFilter(scope, query);
  };

  const initPageTools = () => {
    const scope = getPageScope();
    ensurePageSearch(scope);
    ensureTableTools(scope);
  };

  document.addEventListener('DOMContentLoaded', async () => {
    await loadIndex();
    setupGlobalSearchBar();
    initPageTools();
  });

  document.addEventListener('page:rendered', () => {
    initPageTools();
  });
})();
