(function () {
  'use strict';

  const LINK_SELECTORS = [
    '#archive-cards a[href^="/"]',
    '#hr-cards a[href^="/"]',
    '#finance-cards a[href^="/"]',
    'a.hero-cta-secondary[href^="/"]',
    'nav.floating-actions a[href^="/"]'
  ];

  function normalizePath(href) {
    try {
      const url = new URL(href, window.location.origin);
      let pathname = url.pathname || '/';
      if (pathname.length > 1) {
        pathname = pathname.replace(/\/+$/, '');
      }
      return pathname || '/';
    } catch (_) {
      return href;
    }
  }

  function getAuthHeaders() {
    const headers = { 'Content-Type': 'application/json' };
    const token = localStorage.getItem('authToken') || sessionStorage.getItem('authToken');
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
    return headers;
  }

  function collectLinks() {
    const links = [];
    const seen = new Set();
    LINK_SELECTORS.forEach((selector) => {
      document.querySelectorAll(selector).forEach((element) => {
        const href = element.getAttribute('href');
        if (!href || href.startsWith('#') || href.startsWith('javascript:') || seen.has(element)) {
          return;
        }
        seen.add(element);
        links.push({ element, path: normalizePath(href) });
      });
    });
    return links;
  }

  function hideLink(element) {
    element.style.display = 'none';
    element.setAttribute('aria-hidden', 'true');
    element.setAttribute('data-hub-hidden', 'true');
    element.tabIndex = -1;
  }

  function showEmptyState(containerId, message) {
    const container = document.getElementById(containerId);
    if (!container || container.querySelector('[data-hub-empty="true"]')) {
      return;
    }
    const visibleLinks = container.querySelectorAll('a[href^="/"]:not([data-hub-hidden="true"])');
    if (visibleLinks.length > 0) {
      return;
    }
    const note = document.createElement('div');
    note.dataset.hubEmpty = 'true';
    note.className = 'rounded-xl border border-dashed border-slate-300 bg-white px-4 py-6 text-center text-sm font-bold text-slate-500';
    note.textContent = message;
    container.appendChild(note);
  }

  function applyAllowedPaths(allowedPaths) {
    const allowedSet = new Set((allowedPaths || []).map(normalizePath));
    const links = collectLinks();
    links.forEach(({ element, path }) => {
      if (!allowedSet.has(path)) {
        hideLink(element);
      }
    });

    showEmptyState('archive-cards', 'لا توجد وحدات أرشفة متاحة ضمن صلاحيات حسابك.');
    showEmptyState('hr-cards', 'لا توجد وحدات موارد بشرية متاحة ضمن صلاحيات حسابك.');
    showEmptyState('finance-cards', 'لا توجد وحدات مالية متاحة ضمن صلاحيات حسابك.');
  }

  async function filterHubPages() {
    const links = collectLinks();
    if (!links.length) {
      return;
    }

    const paths = [...new Set(links.map((link) => link.path))];
    try {
      const response = await fetch('/api/tenant-auth/filter-paths', {
        method: 'POST',
        headers: getAuthHeaders(),
        credentials: 'include',
        body: JSON.stringify({ paths })
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        return;
      }
      if (data.bypass) {
        return;
      }
      applyAllowedPaths(data.allowed || []);
    } catch (error) {
      console.warn('Hub permission filter skipped:', error.message);
    }
  }

  document.addEventListener('DOMContentLoaded', filterHubPages);
})();
