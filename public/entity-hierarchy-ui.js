(function () {
  'use strict';

  const SUBSCRIPTION_FIELD_KEYS = ['branch', 'incubator', 'platform', 'customer', 'plan', 'status', 'renewal'];

  const SUBSCRIPTION_FIELD_LABELS = {
    branch: 'الفرع',
    incubator: 'الحاضنة',
    platform: 'المنصة',
    customer: 'العميل',
    plan: 'الخطة',
    status: 'الحالة',
    renewal: 'التجديد'
  };

  const SUBSCRIPTION_DISPLAY_COLUMNS = ['الفرع', 'الحاضنة', 'المنصة', 'العميل', 'الخطة', 'الحالة', 'التجديد'];

  const TYPE_LABELS = {
    HQ: 'المكتب الرئيسي',
    BRANCH: 'فرع',
    INCUBATOR: 'حاضنة',
    PLATFORM: 'منصة',
    OFFICE: 'مكتب'
  };

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function padSubscriptionRowRaw(row) {
    const values = Array.isArray(row) ? row.slice() : [];
    while (values.length < 7) values.push('—');
    return values.slice(0, 7);
  }

  function normalizeSubscriptionRow(row) {
    if (!Array.isArray(row)) return padSubscriptionRowRaw(row);
    if (row.length === 4) {
      return ['—', '—', '—', row[0], row[1], row[2], row[3]];
    }
    return padSubscriptionRowRaw(row);
  }

  function padSubscriptionRow(row) {
    return normalizeSubscriptionRow(row);
  }

  function buildEntityLookup(entities) {
    const lookup = { byId: {}, branches: [], incubators: [], platforms: [], offices: [] };
    if (!Array.isArray(entities)) return lookup;

    entities.forEach((entity) => {
      if (!entity) return;
      const id = String(entity.id || '').trim();
      if (id) lookup.byId[id] = entity;
      const type = String(entity.type || '').toUpperCase();
      if (type === 'BRANCH') lookup.branches.push(entity);
      if (type === 'INCUBATOR') lookup.incubators.push(entity);
      if (type === 'PLATFORM') lookup.platforms.push(entity);
      if (type === 'OFFICE') lookup.offices.push(entity);
    });

    return lookup;
  }

  function pickName(entity, fallback) {
    if (!entity) return fallback || '—';
    return entity.name || entity.company_name || entity.entity_name || fallback || '—';
  }

  function resolveHierarchy(item, lookup) {
    const entity = item || {};
    const type = String(entity.type || '').toUpperCase();
    const byId = lookup?.byId || {};

    let branch = entity.branch_name || '—';
    let incubator = entity.incubator_name || '—';
    let platform = entity.platform_name || '—';
    const customer = pickName(entity, '—');

    if (entity.branch_id != null && entity.branch_id !== '') {
      const branchEntity = byId[String(entity.branch_id)];
      if (branchEntity) branch = pickName(branchEntity, branch);
    }
    if (entity.incubator_id != null && entity.incubator_id !== '') {
      const incubatorEntity = byId[String(entity.incubator_id)];
      if (incubatorEntity) incubator = pickName(incubatorEntity, incubator);
    }
    if (entity.platform_id != null && entity.platform_id !== '') {
      const platformEntity = byId[String(entity.platform_id)];
      if (platformEntity) platform = pickName(platformEntity, platform);
    }

    if (type === 'HQ') {
      branch = pickName(entity, 'المكتب الرئيسي');
    } else if (type === 'BRANCH') {
      branch = pickName(entity, branch);
    } else if (type === 'INCUBATOR') {
      incubator = pickName(entity, incubator);
      if (branch === '—') branch = entity.location || '—';
    } else if (type === 'PLATFORM') {
      platform = pickName(entity, platform);
    } else if (type === 'OFFICE') {
      if (branch === '—') branch = entity.location || '—';
    }

    const plan = String(entity.plan || entity.subscription_plan || 'BASIC').toUpperCase();
    const statusRaw = String(entity.status || 'Active');
    const status = /active|نشط/i.test(statusRaw) ? 'نشط' : statusRaw;
    const renewal = String(entity.expiry_date || entity.updated_at || entity.created_at || '—').slice(0, 10) || '—';

    return [branch, incubator, platform, customer, plan, status, renewal];
  }

  function mapEntitiesToSubscriptionRows(list, lookup) {
    if (!Array.isArray(list) || !list.length) return null;
    const entityLookup = lookup || buildEntityLookup(list);
    return list.slice(0, 20).map((item) => resolveHierarchy(item, entityLookup));
  }

  function renderHierarchyBlock(branch, incubator, platform, customer, options) {
    const opts = options || {};
    const showCustomer = opts.showCustomer !== false;

    const fields = [
      { label: 'الفرع', value: branch },
      { label: 'الحاضنة', value: incubator },
      { label: 'المنصة', value: platform }
    ];

    if (showCustomer) {
      fields.push({ label: 'العميل', value: customer, highlight: true });
    }

    const labels = fields.map((field) => `
      <span class="entity-hierarchy-grid-label">${field.label}</span>
    `).join('');

    const values = fields.map((field) => `
      <span class="entity-hierarchy-grid-value${field.highlight ? ' entity-hierarchy-grid-value--primary' : ''}">${escapeHtml(field.value)}</span>
    `).join('');

    return `
      <div class="entity-hierarchy-grid" role="group" aria-label="بيانات الانتماء">
        <div class="entity-hierarchy-grid-labels">${labels}</div>
        <div class="entity-hierarchy-grid-values">${values}</div>
      </div>
    `;
  }

  function renderSubscriptionRowCells(values) {
    const padded = padSubscriptionRow(values);
    return padded.map((cell, index) => {
      const isCustomer = index === 3;
      const isStatus = index === 5;
      if (isStatus) {
        const active = /نشط|active/i.test(cell);
        return `<td class="px-4 py-3 text-sm align-middle">
          <span class="inline-flex px-2.5 py-1 rounded-full text-xs font-bold ${active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}">${escapeHtml(cell)}</span>
        </td>`;
      }
      if (isCustomer) {
        return `<td class="px-4 py-3 text-sm text-slate-800 align-middle font-bold">${escapeHtml(cell)}</td>`;
      }
      return `<td class="px-4 py-3 text-sm text-slate-700 align-middle whitespace-nowrap">${escapeHtml(cell)}</td>`;
    }).join('');
  }

  function renderSubscriptionDataCell(row) {
    const [branch, incubator, platform, customer] = padSubscriptionRow(row);
    return renderHierarchyBlock(branch, incubator, platform, customer);
  }

  function renderCustomerContextCell(row, customerIndex) {
    const values = padSubscriptionRow(row);
    const customer = values[customerIndex != null ? customerIndex : 3] || values[0] || '—';
    return renderHierarchyBlock(values[0], values[1], values[2], customer);
  }

  function renderHubTable(options) {
    const {
      route,
      config,
      rows,
      renderRowActions,
      dataAttr = 'hub'
    } = options;

    const body = rows.length
      ? rows.map((row, index) => {
        if (config.hierarchyLayout === 'subscription') {
          const values = padSubscriptionRow(row);
          return `
            <tr class="border-b border-slate-100 hover:bg-red-50/40 transition" data-${dataAttr}-row="${index}">
              ${renderSubscriptionRowCells(values)}
              <td class="px-4 py-3 align-middle">${renderRowActions(route, index)}</td>
            </tr>
          `;
        }

        if (config.hierarchyLayout === 'customer') {
          const customerIndex = Math.max(0, (config.columns || []).indexOf('العميل'));
          const hasHierarchyPrefix = row.length >= (config.columns || []).length + 3;
          const branch = hasHierarchyPrefix ? row[0] : '—';
          const incubator = hasHierarchyPrefix ? row[1] : '—';
          const platform = hasHierarchyPrefix ? row[2] : '—';
          const dataOffset = hasHierarchyPrefix ? 3 : 0;

          return `
            <tr class="border-b border-slate-100 hover:bg-red-50/40 transition" data-${dataAttr}-row="${index}">
              ${(config.columns || []).map((col, colIndex) => {
                const cell = row[dataOffset + colIndex] ?? '—';
                if (colIndex === customerIndex) {
                  return `<td class="px-4 py-3 align-top">${renderHierarchyBlock(branch, incubator, platform, cell)}</td>`;
                }
                return `<td class="px-4 py-3 text-sm text-slate-700 align-middle">${escapeHtml(cell)}</td>`;
              }).join('')}
              <td class="px-4 py-3 align-middle">${renderRowActions(route, index)}</td>
            </tr>
          `;
        }

        return `
          <tr class="border-b border-slate-100 hover:bg-red-50/40 transition" data-${dataAttr}-row="${index}">
            ${row.map((cell) => `<td class="px-4 py-3 text-sm text-slate-700">${escapeHtml(cell)}</td>`).join('')}
            <td class="px-4 py-3">${renderRowActions(route, index)}</td>
          </tr>
        `;
      }).join('')
      : `<tr><td colspan="${(config.columns || []).length + 1}" class="px-4 py-10 text-center text-slate-400 text-sm">لا توجد بيانات — استخدم زر الإضافة لإنشاء سجل جديد</td></tr>`;

    const columns = config.hierarchyLayout === 'subscription'
      ? SUBSCRIPTION_DISPLAY_COLUMNS
      : (config.columns || []);

    return `
      <div class="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden" data-${dataAttr}-table="${route}">
        <div class="px-5 py-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
          <h3 class="font-bold text-slate-800">سجل ${config.title}</h3>
          <div class="flex flex-wrap gap-2">
            <button type="button" data-${dataAttr}-action="refresh" data-route="${route}" class="px-3 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold">
              <i class="fas fa-rotate"></i> تحديث
            </button>
            <button type="button" data-${dataAttr}-action="add" data-route="${route}" class="px-3 py-2 rounded-lg bg-red-700 hover:bg-red-800 text-white text-xs font-bold">
              <i class="fas fa-plus"></i> إضافة
            </button>
            <button type="button" data-${dataAttr}-action="export" data-route="${route}" class="px-3 py-2 rounded-lg border border-red-200 text-red-700 hover:bg-red-50 text-xs font-bold">
              <i class="fas fa-download"></i> تصدير
            </button>
          </div>
        </div>
        <div class="overflow-x-auto">
          <table class="min-w-full text-right entity-hierarchy-table">
            <thead class="bg-slate-50 text-slate-500 text-xs uppercase">
              <tr>
                ${columns.map((col) => `<th class="px-4 py-3 font-bold whitespace-nowrap">${col}</th>`).join('')}
                <th class="px-4 py-3 font-bold text-left">الإجراءات</th>
              </tr>
            </thead>
            <tbody>${body}</tbody>
          </table>
        </div>
      </div>
    `;
  }

  function collectModalValues(config, form) {
    if (config.hierarchyLayout === 'subscription') {
      return SUBSCRIPTION_FIELD_KEYS.map((_, index) => {
        const input = form.querySelector(`[name="hub-field-${index}"]`);
        return (input?.value || '').trim() || '—';
      });
    }

    if (config.hierarchyLayout === 'customer') {
      const customerIndex = Math.max(0, (config.columns || []).indexOf('العميل'));
      const values = [
        (form.querySelector('[name="hub-field-branch"]')?.value || '').trim() || '—',
        (form.querySelector('[name="hub-field-incubator"]')?.value || '').trim() || '—',
        (form.querySelector('[name="hub-field-platform"]')?.value || '').trim() || '—'
      ];
      (config.columns || []).forEach((_, colIndex) => {
        const input = form.querySelector(`[name="hub-field-${colIndex}"]`);
        values.push((input?.value || '').trim() || '—');
      });
      return values;
    }

    return (config.columns || []).map((_, colIndex) => {
      const input = form.querySelector(`[name="hub-field-${colIndex}"]`);
      return (input?.value || '').trim() || '—';
    });
  }

  function buildModalFields(config, row, mode, escapeHtmlFn) {
    const esc = escapeHtmlFn || escapeHtml;
    const isView = mode === 'view';

    if (config.hierarchyLayout === 'subscription') {
      const values = padSubscriptionRow(row);
      const inputAttrs = isView
        ? 'readonly class="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-700 text-sm"'
        : 'class="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:border-red-500 focus:ring-2 focus:ring-red-100 outline-none text-sm"';

      const topFields = SUBSCRIPTION_FIELD_KEYS.slice(0, 4).map((key, index) => {
        const label = SUBSCRIPTION_FIELD_LABELS[key];
        const value = values[index] ?? '';
        return `
          <label class="entity-hierarchy-form-field">
            <span class="text-xs font-bold text-slate-500 mb-1 block">${esc(label)}</span>
            <input type="text" name="hub-field-${index}" value="${esc(value)}" ${inputAttrs} />
          </label>
        `;
      }).join('');

      const bottomFields = SUBSCRIPTION_FIELD_KEYS.slice(4).map((key, offset) => {
        const index = offset + 4;
        const label = SUBSCRIPTION_FIELD_LABELS[key];
        const value = values[index] ?? '';
        return `
          <label class="entity-hierarchy-form-field">
            <span class="text-xs font-bold text-slate-500 mb-1 block">${esc(label)}</span>
            <input type="text" name="hub-field-${index}" value="${esc(value)}" ${inputAttrs} />
          </label>
        `;
      }).join('');

      return `
        <div class="entity-hierarchy-form-grid entity-hierarchy-form-grid--top">${topFields}</div>
        <div class="entity-hierarchy-form-grid entity-hierarchy-form-grid--bottom">${bottomFields}</div>
      `;
    }

    if (config.hierarchyLayout === 'customer') {
      const hasHierarchyPrefix = Array.isArray(row) && row.length >= (config.columns || []).length + 3;
      const branch = hasHierarchyPrefix ? row[0] : '—';
      const incubator = hasHierarchyPrefix ? row[1] : '—';
      const platform = hasHierarchyPrefix ? row[2] : '—';
      const dataOffset = hasHierarchyPrefix ? 3 : 0;
      const hierarchyFields = [
        { name: 'hub-field-branch', label: 'الفرع', value: branch },
        { name: 'hub-field-incubator', label: 'الحاضنة', value: incubator },
        { name: 'hub-field-platform', label: 'المنصة', value: platform }
      ].map((field) => {
        const inputAttrs = isView
          ? 'readonly class="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-700 text-sm"'
          : 'class="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:border-red-500 focus:ring-2 focus:ring-red-100 outline-none text-sm"';
        return `
          <label class="entity-hierarchy-form-field">
            <span class="text-xs font-bold text-slate-500 mb-1 block">${esc(field.label)}</span>
            <input type="text" name="${field.name}" value="${esc(field.value)}" ${inputAttrs} />
          </label>
        `;
      }).join('');

      const columnFields = (config.columns || []).map((col, colIndex) => {
        const value = row ? (row[dataOffset + colIndex] ?? '') : '';
        const inputAttrs = isView
          ? 'readonly class="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-700 text-sm"'
          : 'class="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:border-red-500 focus:ring-2 focus:ring-red-100 outline-none text-sm"';
        return `
          <label class="entity-hierarchy-form-field">
            <span class="text-xs font-bold text-slate-500 mb-1 block">${esc(col)}</span>
            <input type="text" name="hub-field-${colIndex}" value="${esc(value)}" ${inputAttrs} />
          </label>
        `;
      }).join('');

      return `
        <div class="entity-hierarchy-form-grid entity-hierarchy-form-grid--top">${hierarchyFields}</div>
        <div class="entity-hierarchy-form-grid entity-hierarchy-form-grid--bottom">${columnFields}</div>
      `;
    }

    return (config.columns || []).map((col, colIndex) => {
      const value = row ? (row[colIndex] ?? '') : '';
      const inputAttrs = isView
        ? 'readonly class="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-700"'
        : 'class="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-red-500 focus:ring-2 focus:ring-red-100 outline-none"';
      return `
        <label class="block">
          <span class="text-sm font-bold text-slate-600 mb-1.5 block">${esc(col)}</span>
          <input type="text" name="hub-field-${colIndex}" value="${esc(value)}" ${inputAttrs} />
        </label>
      `;
    }).join('');
  }

  function getSubscriptionSeed() {
    return [
      ['المكتب الرئيسي', '—', '—', 'NAIOSH HQ', 'ENTERPRISE', 'نشط', '2026-12-01'],
      ['فرع الرياض', 'حاضنة الرياض التقنية', 'منصة الرياض', 'Barija', 'PRO', 'نشط', '2026-09-15'],
      ['فرع جدة', 'Safety Incubator', 'NAIOSH Cloud', 'Lite Co', 'BASIC', 'نشط', '2026-07-01'],
      ['فرع الدمام', '—', '—', 'Dammam Office', 'BASIC', 'نشط', '2026-06-08']
    ];
  }

  function exportSubscriptionCsv(rows) {
    const header = SUBSCRIPTION_FIELD_KEYS.map((key) => SUBSCRIPTION_FIELD_LABELS[key]);
    return [header.join(','), ...rows.map((row) => padSubscriptionRow(row).join(','))].join('\n');
  }

  window.EntityHierarchyUI = {
    SUBSCRIPTION_FIELD_KEYS,
    SUBSCRIPTION_FIELD_LABELS,
    SUBSCRIPTION_DISPLAY_COLUMNS,
    TYPE_LABELS,
    escapeHtml,
    padSubscriptionRow,
    buildEntityLookup,
    resolveHierarchy,
    mapEntitiesToSubscriptionRows,
    renderHierarchyBlock,
    renderSubscriptionRowCells,
    renderCustomerContextCell,
    renderHubTable,
    buildModalFields,
    collectModalValues,
    getSubscriptionSeed,
    exportSubscriptionCsv
  };
})();
