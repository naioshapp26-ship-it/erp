'use strict';

(function () {
  const FETCH_TIMEOUT_MS = 8000;

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
      return JSON.parse(localStorage.getItem('user') || sessionStorage.getItem('user') || 'null');
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
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
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
        logo.src = identity.logo_url.includes('/api/tenant-public/logo')
          ? scopedPath('/api/tenant-public/logo')
          : identity.logo_url;
      }
    }
  }

  const MODULE_CATALOG = [
    { key: 'records-archive-home', path: '/archive', icon: 'fa-box-archive', title: 'نظام الأرشفة', desc: 'إدارة الوثائق والسجلات والأرشفة الإلكترونية' },
    { key: 'hr', path: '/hr', icon: 'fa-users', title: 'الموارد البشرية', desc: 'إدارة الموظفين والحضور والإجازات' },
    { key: 'finance', path: '/finance', icon: 'fa-coins', title: 'النظام المالي', desc: 'المحاسبة والتقارير المالية' },
    { key: 'marketing-campaigns-studio', path: '/marketing-campaigns-studio', icon: 'fa-bullhorn', title: 'استوديو التسويق', desc: 'إدارة الحملات التسويقية' },
    { key: 'events-studio-main', path: '/finance/events-studio-main.html', icon: 'fa-calendar-star', title: 'استوديو الفعاليات', desc: 'تنظيم الفعاليات والأنشطة' },
    { key: 'tenant-branding', path: '/tenant-branding-settings.html', icon: 'fa-palette', title: 'هوية النظام', desc: 'تخصيص الشعار والألوان واسم الشركة', adminOnly: true }
  ];

  function getAllowedModules(user) {
    const allowed = new Set(user?.allowed_pages || user?.allowedPages || ['dashboard']);
    const isAdmin = ['admin', 'tenant_admin'].includes(String(user?.role || '').toLowerCase());
    return MODULE_CATALOG.filter((item) => {
      if (item.adminOnly) return isAdmin;
      return allowed.has(item.key);
    });
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
            <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:0.75rem">
              <span class="tenant-workspace-module-icon"><i class="fas ${mod.icon}"></i></span>
              <i class="fas fa-arrow-left" style="color:#cbd5e1;margin-top:0.2rem"></i>
            </div>
            <h4 style="margin:0.6rem 0 0.25rem;font-weight:900;color:#0f172a">${escapeHtml(mod.title)}</h4>
            <p style="margin:0;color:#64748b;font-size:0.85rem;line-height:1.6">${escapeHtml(mod.desc)}</p>
          </a>
        `).join('')
      : `<div class="td-empty"><i class="fas fa-box-open" style="font-size:2rem;margin-bottom:0.5rem"></i><p style="margin:0;font-weight:700">لا توجد أنظمة مفعّلة بعد</p></div>`;

    return `
      <div class="tenant-workspace-dashboard" style="display:flex;flex-direction:column;gap:1.5rem">
        <section class="tenant-workspace-hero">
          <div style="position:relative;z-index:1;display:flex;flex-wrap:wrap;gap:1.25rem;justify-content:space-between;align-items:center">
            <div style="display:flex;gap:1rem;align-items:flex-start">
              <img src="${escapeHtml(logoUrl)}" alt="${escapeHtml(siteName)}" class="tenant-workspace-logo">
              <div>
                <div style="display:flex;flex-wrap:wrap;gap:0.4rem;margin-bottom:0.5rem">
                  <span style="padding:0.2rem 0.7rem;border-radius:999px;background:rgba(255,255,255,0.15);font-size:0.7rem;font-weight:700">النظام نشط</span>
                  <span style="padding:0.2rem 0.7rem;border-radius:999px;background:rgba(255,255,255,0.1);font-size:0.7rem;font-weight:700">${escapeHtml(siteTagline)}</span>
                </div>
                <p style="margin:0 0 0.25rem;opacity:0.8;font-size:0.85rem">مرحباً، <strong>${escapeHtml(userName)}</strong></p>
                <h2 style="margin:0;font-size:clamp(1.5rem,4vw,2.2rem);font-weight:900">${escapeHtml(siteName)}</h2>
                <p style="margin:0.5rem 0 0;opacity:0.75;font-size:0.85rem;max-width:36rem">لوحة موحدة لإدارة أنظمتك، هوية شركتك، وصلاحيات المستخدمين.</p>
              </div>
            </div>
            <div style="display:flex;flex-wrap:wrap;gap:0.75rem">
              <div class="tenant-workspace-stat"><p style="margin:0 0 0.25rem;font-size:0.65rem;opacity:0.7;font-weight:800">الأنظمة</p><p style="margin:0;font-size:1.5rem;font-weight:900">${modules.length}</p></div>
              <div class="tenant-workspace-stat"><p style="margin:0 0 0.25rem;font-size:0.65rem;opacity:0.7;font-weight:800">الهوية</p><p style="margin:0;font-size:1rem;font-weight:900">${identityReady ? 'مكتملة' : 'تحتاج إعداد'}</p></div>
              <div class="tenant-workspace-stat"><p style="margin:0 0 0.25rem;font-size:0.65rem;opacity:0.7;font-weight:800">البريد</p><p style="margin:0;font-size:0.8rem;font-weight:700;word-break:break-all">${escapeHtml(loginEmail)}</p></div>
            </div>
          </div>
        </section>

        <div class="td-grid-4">
          <div class="tenant-workspace-kpi"><div class="tenant-workspace-kpi-icon" style="background:#f1f5f9;color:#334155"><i class="fas fa-layer-group"></i></div><p style="margin:0.5rem 0 0;color:#64748b;font-size:0.75rem">الأنظمة المفعّلة</p><p style="margin:0;font-size:1.5rem;font-weight:900">${modules.length}</p></div>
          <div class="tenant-workspace-kpi"><div class="tenant-workspace-kpi-icon" style="background:#f1f5f9;color:#334155"><i class="fas fa-users"></i></div><p style="margin:0.5rem 0 0;color:#64748b;font-size:0.75rem">المستخدمون</p><p style="margin:0;font-size:1.5rem;font-weight:900">${usersCount}</p></div>
          <div class="tenant-workspace-kpi"><div class="tenant-workspace-kpi-icon" style="background:#f1f5f9;color:#334155"><i class="fas fa-crown"></i></div><p style="margin:0.5rem 0 0;color:#64748b;font-size:0.75rem">خطة الاشتراك</p><p style="margin:0;font-size:1.2rem;font-weight:900">${escapeHtml(planLabel)}</p></div>
          <div class="tenant-workspace-kpi"><div class="tenant-workspace-kpi-icon" style="background:#f1f5f9;color:#334155"><i class="fas fa-palette"></i></div><p style="margin:0.5rem 0 0;color:#64748b;font-size:0.75rem">حالة الهوية</p><p style="margin:0;font-size:1.1rem;font-weight:900">${identityReady ? 'مكتملة' : 'غير مكتملة'}</p></div>
        </div>

        <div class="td-grid-2" style="grid-template-columns:minmax(0,2fr) minmax(0,1fr)">
          <div class="td-panel">
            <h3>الأنظمة والخدمات</h3>
            <p class="sub">وصول سريع لكل ما تم تفعيله في منصتك</p>
            <div class="td-grid-2">${moduleCards}</div>
          </div>
          <div class="td-panel tenant-workspace-checklist">
            <h3>ابدأ بسرعة</h3>
            <p class="sub">خطوات بسيطة لتجهيز منصتك</p>
            <div class="td-check-item">
              <div><strong>${identityReady ? '✓ هوية النظام' : 'إكمال هوية النظام'}</strong><p style="margin:0.25rem 0 0;font-size:0.75rem;color:#64748b">ارفع الشعار وحدد ألوان شركتك</p></div>
              ${identityReady ? '<span style="color:#059669;font-size:0.75rem;font-weight:700">مكتمل</span>' : `<a class="td-btn td-btn-primary" style="background:var(--tenant-primary);color:#fff" href="${brandingPath}">فتح الإعدادات</a>`}
            </div>
            <div class="td-check-item">
              <div><strong>تحديث بريد الدخول</strong><p style="margin:0.25rem 0 0;font-size:0.75rem;color:#64748b">${escapeHtml(loginEmail)}</p></div>
              <a class="td-btn td-btn-primary" style="background:var(--tenant-primary);color:#fff" href="${brandingPath}">تحديث</a>
            </div>
            ${modules[0] ? `<div class="td-check-item"><div><strong>بدء الاستخدام</strong><p style="margin:0.25rem 0 0;font-size:0.75rem;color:#64748b">افتح ${escapeHtml(modules[0].title)}</p></div><a class="td-btn td-btn-primary" style="background:var(--tenant-primary);color:#fff" href="${escapeHtml(scopedPath(modules[0].path))}">فتح</a></div>` : ''}
          </div>
        </div>
      </div>
    `;
  }

  function showLoader(message) {
    const main = document.getElementById('td-main');
    if (!main) return;
    main.innerHTML = `<div class="td-loader"><div class="td-spinner"></div><p style="margin:0;font-weight:700">${escapeHtml(message)}</p></div>`;
  }

  function showError(message) {
    const main = document.getElementById('td-main');
    if (!main) return;
    main.innerHTML = `
      <div class="td-error">
        <i class="fas fa-exclamation-triangle" style="font-size:2rem;color:#dc2626;margin-bottom:0.75rem"></i>
        <h2 style="margin:0 0 0.5rem">${escapeHtml(message)}</h2>
        <p style="margin:0 0 1rem;color:#64748b;font-size:0.9rem">جرّب تسجيل الدخول مرة أخرى أو تحديث الصفحة</p>
        <button type="button" class="td-btn td-btn-primary" onclick="location.reload()">تحديث الصفحة</button>
        <button type="button" class="td-btn td-btn-ghost" style="margin-inline-start:0.5rem;background:#e2e8f0;color:#334155" onclick="window.__tdLogout && window.__tdLogout()">تسجيل الدخول</button>
      </div>`;
  }

  async function boot() {
    const token = getToken();
    const cachedUser = getStoredUser();
    if (!token || !cachedUser) {
      redirectToLogin();
      return;
    }

    window.__tdLogout = clearSession;
    document.getElementById('td-logout-btn')?.addEventListener('click', clearSession);

    const identity = window.__TENANT_IDENTITY_BOOT__ || window.__TENANT_IDENTITY__ || null;
    applyBranding(identity);
    showLoader('جاري تحميل لوحة التحكم...');

    let user = cachedUser;
    try {
      const verify = await fetchJson(scopedPath('/api/tenant-auth/verify'), {
        headers: { Authorization: `Bearer ${token}` }
      });
      user = verify?.data?.user || verify?.user || cachedUser;
      const serialized = JSON.stringify(user);
      if (localStorage.getItem('authToken')) localStorage.setItem('user', serialized);
      if (sessionStorage.getItem('authToken')) sessionStorage.setItem('user', serialized);
    } catch (error) {
      console.warn('[tenant-dashboard] verify skipped:', error.message);
    }

    let entity = {
      id: user.entityId || user.entity_id,
      name: user.entityName || user.companyName || 'منصة المستأجر',
      plan: 'BASIC',
      users_count: 1
    };

    try {
      const entityId = user.entityId || user.entity_id;
      if (entityId) {
        const fetched = await fetchJson(scopedPath(`/api/entities/${entityId}`), {
          headers: {
            Authorization: `Bearer ${token}`,
            'x-entity-type': user.tenantType || user.tenant_type || 'TENANT',
            'x-entity-id': entityId,
            'x-user-id': String(user.id || '')
          }
        });
        if (fetched) entity = fetched;
      }
    } catch (error) {
      console.warn('[tenant-dashboard] entity fetch skipped:', error.message);
    }

    const modules = getAllowedModules(user);
    const main = document.getElementById('td-main');
    if (main) {
      main.innerHTML = renderDashboard(user, identity, entity, modules);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
