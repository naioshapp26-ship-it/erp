'use strict';

(function () {
  const FETCH_TIMEOUT_MS = 6000;

  function getSubdomain() {
    const match = String(location.pathname || '').match(/^\/t\/([a-z0-9][a-z0-9-]*)/i);
    return match ? match[1].toLowerCase() : '';
  }

  function scopedPath(targetPath) {
    if (typeof window.getTenantScopedPath === 'function') {
      return window.getTenantScopedPath(targetPath);
    }
    const sub = getSubdomain();
    const normalized = String(targetPath || '').startsWith('/') ? targetPath : `/${targetPath || ''}`;
    return sub ? `/t/${sub}${normalized}` : normalized;
  }

  function getToken() {
    const cookieMatch = document.cookie.match(/authToken=([^;]+)/);
    const cookieToken = cookieMatch ? decodeURIComponent(cookieMatch[1]) : '';
    return localStorage.getItem('authToken')
      || sessionStorage.getItem('authToken')
      || cookieToken
      || '';
  }

  function getStoredUser() {
    try {
      const raw = localStorage.getItem('user') || sessionStorage.getItem('user');
      return raw ? JSON.parse(raw) : null;
    } catch (_) {
      return null;
    }
  }

  function redirectToLogin() {
    window.location.replace(scopedPath('/?login=1'));
  }

  function clearSession() {
    localStorage.clear();
    sessionStorage.clear();
    document.cookie = 'authToken=; Max-Age=0; Path=/; SameSite=Lax';
    redirectToLogin();
  }

  async function fetchJson(url, options = {}) {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          'X-Tenant-Subdomain': getSubdomain(),
          ...(options.headers || {})
        }
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.json();
    } finally {
      window.clearTimeout(timer);
    }
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function applyBranding(identity) {
    if (!identity) return;
    const root = document.documentElement;
    const primary = identity.primary_color || '#0e139a';
    const secondary = identity.secondary_color || '#1a1a1a';
    root.style.setProperty('--tenant-primary', primary);
    root.style.setProperty('--tenant-secondary', secondary);
    root.style.setProperty('--brand-red', primary);
    if (identity.site_name) {
      document.title = `${identity.site_name} | لوحة التحكم`;
      const nameEl = document.getElementById('td-brand-name');
      const tagEl = document.getElementById('td-brand-tagline');
      if (nameEl) nameEl.textContent = identity.site_name;
      if (tagEl) tagEl.textContent = identity.site_tagline || 'منصة متعددة المستأجرين';
    }
    if (identity.logo_url) {
      const logo = document.getElementById('td-brand-logo');
      if (logo) {
        logo.src = String(identity.logo_url).includes('/api/tenant-public/logo')
          ? scopedPath('/api/tenant-public/logo')
          : identity.logo_url;
        logo.style.visibility = 'visible';
      }
    }
  }

  const MODULE_CATALOG = [
    { key: 'records-archive-home', path: '/archive', icon: '📦', title: 'نظام الأرشفة', desc: 'إدارة الوثائق والسجلات والأرشفة الإلكترونية' },
    { key: 'hr', path: '/hr', icon: '👥', title: 'الموارد البشرية', desc: 'إدارة الموظفين والحضور والإجازات' },
    { key: 'finance', path: '/finance', icon: '💰', title: 'النظام المالي', desc: 'المحاسبة والتقارير المالية' },
    { key: 'marketing-campaigns-studio', path: '/marketing-campaigns-studio', icon: '📣', title: 'استوديو التسويق', desc: 'إدارة الحملات التسويقية' },
    { key: 'events-studio-main', path: '/finance/events-studio-main.html', icon: '📅', title: 'استوديو الفعاليات', desc: 'تنظيم الفعاليات والأنشطة' },
    { key: 'tenant-branding', path: '/tenant-branding-settings.html', icon: '🎨', title: 'هوية النظام', desc: 'تخصيص الشعار والألوان واسم الشركة', adminOnly: true }
  ];

  function getAllowedModules(user) {
    const allowed = new Set(user?.allowed_pages || user?.allowedPages || ['dashboard']);
    const isAdmin = ['admin', 'tenant_admin'].includes(String(user?.role || '').toLowerCase());
    return MODULE_CATALOG.filter((item) => {
      if (item.adminOnly) return isAdmin;
      return allowed.has(item.key);
    });
  }

  function buildEntityFromUser(user) {
    return {
      id: user.entityId || user.entity_id || '',
      name: user.entityName || user.companyName || 'منصة المستأجر',
      plan: user.plan || 'BASIC',
      users_count: 1
    };
  }

  function renderDashboard(user, identity, entity, modules) {
    const siteName = identity?.site_name || entity?.name || user?.entityName || 'منصتك';
    const siteTagline = identity?.site_tagline || 'منصة متعددة المستأجرين';
    const logoUrl = document.getElementById('td-brand-logo')?.src || identity?.logo_url || '/public/naiosh-logo.png';
    const userName = user?.name || 'مدير النظام';
    const loginEmail = user?.email || '—';
    const planLabel = entity?.plan || 'BASIC';
    const usersCount = entity?.users_count || entity?.users || 1;
    const identityReady = identity?.setup_completed !== false && Boolean(identity?.logo_url && identity?.site_name);
    const brandingPath = scopedPath('/tenant-branding-settings.html');

    const moduleCards = modules.length
      ? modules.map((mod) => `
          <a class="tenant-workspace-module" href="${escapeHtml(scopedPath(mod.path))}">
            <div class="td-module-head">
              <span class="tenant-workspace-module-icon">${mod.icon}</span>
              <span class="td-arrow">←</span>
            </div>
            <h4>${escapeHtml(mod.title)}</h4>
            <p>${escapeHtml(mod.desc)}</p>
          </a>
        `).join('')
      : '<div class="td-empty"><p>📭</p><p><strong>لا توجد أنظمة مفعّلة بعد</strong></p></div>';

    return `
      <div class="tenant-workspace-dashboard">
        <section class="tenant-workspace-hero">
          <div class="td-hero-inner">
            <div class="td-hero-copy">
              <img src="${escapeHtml(logoUrl)}" alt="${escapeHtml(siteName)}" class="tenant-workspace-logo">
              <div>
                <div class="td-badges">
                  <span class="td-badge">النظام نشط</span>
                  <span class="td-badge td-badge-soft">${escapeHtml(siteTagline)}</span>
                </div>
                <p class="td-greeting">مرحباً، <strong>${escapeHtml(userName)}</strong></p>
                <h2>${escapeHtml(siteName)}</h2>
                <p class="td-lead">لوحة موحدة لإدارة أنظمتك، هوية شركتك، وصلاحيات المستخدمين.</p>
              </div>
            </div>
            <div class="td-hero-stats">
              <div class="tenant-workspace-stat"><p>الأنظمة</p><strong>${modules.length}</strong></div>
              <div class="tenant-workspace-stat"><p>الهوية</p><strong>${identityReady ? 'مكتملة' : 'تحتاج إعداد'}</strong></div>
              <div class="tenant-workspace-stat"><p>البريد</p><strong class="td-email">${escapeHtml(loginEmail)}</strong></div>
            </div>
          </div>
        </section>

        <div class="td-grid-4">
          <div class="tenant-workspace-kpi"><div class="tenant-workspace-kpi-icon">📊</div><p>الأنظمة المفعّلة</p><strong>${modules.length}</strong></div>
          <div class="tenant-workspace-kpi"><div class="tenant-workspace-kpi-icon">👤</div><p>المستخدمون</p><strong>${usersCount}</strong></div>
          <div class="tenant-workspace-kpi"><div class="tenant-workspace-kpi-icon">👑</div><p>خطة الاشتراك</p><strong>${escapeHtml(planLabel)}</strong></div>
          <div class="tenant-workspace-kpi"><div class="tenant-workspace-kpi-icon">🎨</div><p>حالة الهوية</p><strong>${identityReady ? 'مكتملة' : 'غير مكتملة'}</strong></div>
        </div>

        <div class="td-layout">
          <div class="td-panel">
            <h3>الأنظمة والخدمات</h3>
            <p class="sub">وصول سريع لكل ما تم تفعيله في منصتك</p>
            <div class="td-grid-2">${moduleCards}</div>
          </div>
          <div class="td-panel tenant-workspace-checklist">
            <h3>ابدأ بسرعة</h3>
            <p class="sub">خطوات بسيطة لتجهيز منصتك</p>
            <div class="td-check-item">
              <div><strong>${identityReady ? '✓ هوية النظام' : 'إكمال هوية النظام'}</strong><p>ارفع الشعار وحدد ألوان شركتك</p></div>
              ${identityReady ? '<span class="td-done">مكتمل</span>' : `<a class="td-btn td-btn-solid" href="${brandingPath}">فتح الإعدادات</a>`}
            </div>
            <div class="td-check-item">
              <div><strong>تحديث بريد الدخول</strong><p>${escapeHtml(loginEmail)}</p></div>
              <a class="td-btn td-btn-solid" href="${brandingPath}">تحديث</a>
            </div>
            ${modules[0] ? `<div class="td-check-item"><div><strong>بدء الاستخدام</strong><p>افتح ${escapeHtml(modules[0].title)}</p></div><a class="td-btn td-btn-solid" href="${escapeHtml(scopedPath(modules[0].path))}">فتح</a></div>` : ''}
          </div>
        </div>
      </div>
    `;
  }

  function showError(message) {
    const main = document.getElementById('td-main');
    if (!main) return;
    main.innerHTML = `
      <div class="td-error">
        <p style="font-size:2rem;margin:0">⚠️</p>
        <h2>${escapeHtml(message)}</h2>
        <p>جرّب تسجيل الدخول مرة أخرى أو تحديث الصفحة</p>
        <div class="td-error-actions">
          <button type="button" class="td-btn td-btn-solid" onclick="location.reload()">تحديث الصفحة</button>
          <button type="button" class="td-btn td-btn-ghost-dark" onclick="window.__tdLogout && window.__tdLogout()">تسجيل الدخول</button>
        </div>
      </div>`;
  }

  function paintDashboard(user, identity, entity, modules) {
    const main = document.getElementById('td-main');
    if (!main) return;
    main.innerHTML = renderDashboard(user, identity, entity, modules);
  }

  async function refreshInBackground(user, token, identity) {
    try {
      const verify = await fetchJson(scopedPath('/api/tenant-auth/verify'), {
        headers: { Authorization: `Bearer ${token}` }
      });
      const freshUser = verify?.data?.user || verify?.user;
      if (freshUser) {
        const serialized = JSON.stringify(freshUser);
        if (localStorage.getItem('authToken')) localStorage.setItem('user', serialized);
        if (sessionStorage.getItem('authToken')) sessionStorage.setItem('user', serialized);
        paintDashboard(freshUser, identity, buildEntityFromUser(freshUser), getAllowedModules(freshUser));
        user = freshUser;
      }
    } catch (error) {
      console.warn('[tenant-dashboard] verify skipped:', error.message);
    }

    try {
      const entityId = user.entityId || user.entity_id;
      if (!entityId) return;
      const fetched = await fetchJson(scopedPath(`/api/entities/${entityId}`), {
        headers: {
          Authorization: `Bearer ${token}`,
          'x-entity-type': user.tenantType || user.tenant_type || 'TENANT',
          'x-entity-id': entityId,
          'x-user-id': String(user.id || '')
        }
      });
      if (fetched) {
        paintDashboard(user, identity, fetched, getAllowedModules(user));
      }
    } catch (error) {
      console.warn('[tenant-dashboard] entity refresh skipped:', error.message);
    }
  }

  function boot() {
    try {
      const token = getToken();
      const cachedUser = getStoredUser();
      if (!token || !cachedUser) {
        redirectToLogin();
        return;
      }

      window.__tdLogout = clearSession;
      document.getElementById('td-logout-btn')?.addEventListener('click', clearSession);

      const identity = window.__TENANT_IDENTITY_BOOT__ || window.__TENANT_IDENTITY__ || {};
      applyBranding(identity);

      const modules = getAllowedModules(cachedUser);
      const entity = buildEntityFromUser(cachedUser);
      paintDashboard(cachedUser, identity, entity, modules);

      refreshInBackground(cachedUser, token, identity);
    } catch (error) {
      console.error('[tenant-dashboard] boot failed:', error);
      showError('تعذر تحميل لوحة التحكم');
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
