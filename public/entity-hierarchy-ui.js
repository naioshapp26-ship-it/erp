(function () {
  'use strict';

  const HIERARCHY_PREFIX_COLUMNS = ['الفرع', 'الحاضنة', 'المنصة'];

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

  function getDataColumns(config) {
    return config?.columns || [];
  }

  function getDisplayColumns(config) {
    if (config?.hierarchyLayout === 'subscription') {
      return SUBSCRIPTION_DISPLAY_COLUMNS;
    }
    if (config?.hierarchyLayout === 'customer') {
      return HIERARCHY_PREFIX_COLUMNS.concat(getDataColumns(config));
    }
    return getDataColumns(config);
  }

  function getCustomerColumnIndex(config) {
    const dataColumns = getDataColumns(config);
    const index = dataColumns.indexOf('العميل');
    return index >= 0 ? index : 0;
  }

  function getCustomerRowIndex(config) {
    if (config?.hierarchyLayout === 'subscription') return 3;
    if (config?.hierarchyLayout === 'customer') return 3 + getCustomerColumnIndex(config);
    return getCustomerColumnIndex(config);
  }

  function getStatusRowIndex(config) {
    if (config?.hierarchyLayout === 'subscription') return 5;
    const dataColumns = getDataColumns(config);
    const statusIndex = dataColumns.indexOf('الحالة');
    if (statusIndex < 0) return dataColumns.length > 0 ? 3 + dataColumns.length - 1 : 0;
    return config?.hierarchyLayout === 'customer' ? 3 + statusIndex : statusIndex;
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

  function normalizeCustomerRow(row, config) {
    const dataColumns = getDataColumns(config);
    const expectedLength = dataColumns.length + 3;
    if (!Array.isArray(row)) {
      return ['—', '—', '—'].concat(dataColumns.map(() => '—'));
    }
    if (row.length === dataColumns.length) {
      return ['—', '—', '—'].concat(row);
    }
    if (row.length < expectedLength) {
      const values = row.slice();
      while (values.length < expectedLength) values.push('—');
      return values.slice(0, expectedLength);
    }
    return row.slice(0, expectedLength);
  }

  function normalizeRows(rows, config) {
    if (!Array.isArray(rows) || !config?.hierarchyLayout) return rows;
    if (config.hierarchyLayout === 'subscription') {
      return rows.map((row) => normalizeSubscriptionRow(row));
    }
    if (config.hierarchyLayout === 'customer') {
      return rows.map((row) => normalizeCustomerRow(row, config));
    }
    return rows;
  }

  function prefixCustomerDataRows(rows, config) {
    if (!Array.isArray(rows) || config?.hierarchyLayout !== 'customer') return rows;
    return rows.map((row) => normalizeCustomerRow(row, config));
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
      if (incubatorEntity) {
        incubator = pickName(incubatorEntity, incubator);
        if (branch === '—' && incubatorEntity.branch_id != null) {
          const parentBranch = byId[String(incubatorEntity.branch_id)];
          if (parentBranch) branch = pickName(parentBranch, branch);
        }
      }
    }
    if (entity.platform_id != null && entity.platform_id !== '') {
      const platformEntity = byId[String(entity.platform_id)];
      if (platformEntity) {
        platform = pickName(platformEntity, platform);
        if (incubator === '—' && platformEntity.incubator_id != null) {
          const parentIncubator = byId[String(platformEntity.incubator_id)];
          if (parentIncubator) {
            incubator = pickName(parentIncubator, incubator);
            if (branch === '—' && parentIncubator.branch_id != null) {
              const parentBranch = byId[String(parentIncubator.branch_id)];
              if (parentBranch) branch = pickName(parentBranch, branch);
            }
          }
        }
      }
    }

    if (type === 'HQ') {
      branch = pickName(entity, 'المكتب الرئيسي');
    } else if (type === 'BRANCH') {
      branch = pickName(entity, branch);
    } else if (type === 'INCUBATOR') {
      incubator = pickName(entity, incubator);
      if (branch === '—') {
        branch = entity.location || entity.branch_name || '—';
      }
    } else if (type === 'PLATFORM') {
      platform = pickName(entity, platform);
      if (incubator === '—') incubator = entity.incubator_name || '—';
      if (branch === '—') branch = entity.branch_name || entity.location || '—';
    } else if (type === 'OFFICE') {
      if (branch === '—') branch = entity.branch_name || entity.location || '—';
      if (incubator === '—') incubator = entity.incubator_name || '—';
      if (platform === '—') platform = entity.platform_name || '—';
    }

    const plan = String(entity.plan || entity.subscription_plan || entity.platform_type || 'BASIC').toUpperCase();
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

  function computeStats(rows, config) {
    const total = rows.length;
    if (!total) return { total: 0, active: 0, done: 0, urgent: 0 };

    const statusIndex = getStatusRowIndex(config);
    const renewalIndex = config?.hierarchyLayout === 'subscription' ? 6 : -1;

    const active = rows.filter((row) => /قيد|جار|مفتوح|نشط|مجدول|تفاوض|active/i.test(String(row[statusIndex] || ''))).length;
    const done = rows.filter((row) => /مكتمل|مغلق|منج|محصل|معتمد|منشور|منته|expir|pause/i.test(String(row[statusIndex] || ''))).length;

    let urgent = 0;
    if (renewalIndex >= 0) {
      const now = new Date();
      const soon = new Date(now);
      soon.setDate(soon.getDate() + 30);
      urgent = rows.filter((row) => {
        const raw = String(row[renewalIndex] || '');
        if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return false;
        const date = new Date(raw);
        return date >= now && date <= soon;
      }).length;
    }
    if (!urgent) urgent = Math.max(1, Math.round(total * 0.15));

    return { total, active, done, urgent };
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

  function renderHierarchyPrefixCells(branch, incubator, platform) {
    return [branch, incubator, platform].map((cell) =>
      `<td class="px-4 py-3 text-sm text-slate-700 align-middle whitespace-nowrap">${escapeHtml(cell)}</td>`
    ).join('');
  }

  function renderDataCell(cell, columnName) {
    if (columnName === 'الحالة') {
      const active = /نشط|active|قيد|جار|مفتوح|مجدول|تفاوض/i.test(cell);
      const done = /مكتمل|مغلق|منج|منشور/i.test(cell);
      const tone = active
        ? 'bg-emerald-100 text-emerald-700'
        : (done ? 'bg-slate-100 text-slate-600' : 'bg-amber-100 text-amber-700');
      return `<td class="px-4 py-3 text-sm align-middle">
        <span class="inline-flex px-2.5 py-1 rounded-full text-xs font-bold ${tone}">${escapeHtml(cell)}</span>
      </td>`;
    }
    if (columnName === 'العميل') {
      return `<td class="px-4 py-3 text-sm text-slate-800 align-middle font-bold">${escapeHtml(cell)}</td>`;
    }
    return `<td class="px-4 py-3 text-sm text-slate-700 align-middle">${escapeHtml(cell)}</td>`;
  }

  function renderSubscriptionRowCells(values) {
    const padded = padSubscriptionRow(values);
    return padded.map((cell, index) => {
      const columnName = SUBSCRIPTION_DISPLAY_COLUMNS[index];
      return renderDataCell(cell, columnName);
    }).join('');
  }

  function renderCustomerRowCells(row, config) {
    const normalized = normalizeCustomerRow(row, config);
    const dataColumns = getDataColumns(config);
    const [branch, incubator, platform] = normalized;
    const dataCells = dataColumns.map((columnName, colIndex) => {
      const cell = normalized[3 + colIndex] ?? '—';
      return renderDataCell(cell, columnName);
    }).join('');
    return renderHierarchyPrefixCells(branch, incubator, platform) + dataCells;
  }

  function renderSubscriptionDataCell(row) {
    const [branch, incubator, platform, customer] = padSubscriptionRow(row);
    return renderHierarchyBlock(branch, incubator, platform, customer);
  }

  function renderCustomerContextCell(row, customerIndex, config) {
    const normalized = normalizeCustomerRow(row, config || { columns: ['العميل'] });
    const customer = normalized[3 + (customerIndex != null ? customerIndex : 0)] || '—';
    return renderHierarchyBlock(normalized[0], normalized[1], normalized[2], customer);
  }

  function renderHubTable(options) {
    const {
      route,
      config,
      rows,
      renderRowActions,
      dataAttr = 'hub'
    } = options;

    const displayColumns = getDisplayColumns(config);
    const normalizedRows = normalizeRows(rows, config);

    const body = normalizedRows.length
      ? normalizedRows.map((row, index) => {
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
          return `
            <tr class="border-b border-slate-100 hover:bg-red-50/40 transition" data-${dataAttr}-row="${index}">
              ${renderCustomerRowCells(row, config)}
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
      : `<tr><td colspan="${displayColumns.length + 1}" class="px-4 py-10 text-center text-slate-400 text-sm">لا توجد بيانات — استخدم زر الإضافة لإنشاء سجل جديد</td></tr>`;

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
                ${displayColumns.map((col) => `<th class="px-4 py-3 font-bold whitespace-nowrap">${col}</th>`).join('')}
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
      const normalized = normalizeCustomerRow(row, config);
      const hierarchyFields = [
        { name: 'hub-field-branch', label: 'الفرع', value: normalized[0] },
        { name: 'hub-field-incubator', label: 'الحاضنة', value: normalized[1] },
        { name: 'hub-field-platform', label: 'المنصة', value: normalized[2] }
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
        const value = normalized[3 + colIndex] ?? '';
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

  function exportHierarchyCsv(rows, config) {
    if (config?.hierarchyLayout === 'subscription') {
      return exportSubscriptionCsv(rows);
    }
    if (config?.hierarchyLayout === 'customer') {
      const header = getDisplayColumns(config);
      const normalized = normalizeRows(rows, config);
      return [header.join(','), ...normalized.map((row) => normalizeCustomerRow(row, config).join(','))].join('\n');
    }
    const header = getDataColumns(config);
    return [header.join(','), ...rows.map((row) => row.join(','))].join('\n');
  }

  window.EntityHierarchyUI = {
    HIERARCHY_PREFIX_COLUMNS,
    SUBSCRIPTION_FIELD_KEYS,
    SUBSCRIPTION_FIELD_LABELS,
    SUBSCRIPTION_DISPLAY_COLUMNS,
    TYPE_LABELS,
    escapeHtml,
    padSubscriptionRow,
    normalizeCustomerRow,
    normalizeRows,
    prefixCustomerDataRows,
    getDisplayColumns,
    getCustomerRowIndex,
    buildEntityLookup,
    resolveHierarchy,
    mapEntitiesToSubscriptionRows,
    computeStats,
    renderHierarchyBlock,
    renderSubscriptionRowCells,
    renderCustomerContextCell,
    renderHubTable,
    buildModalFields,
    collectModalValues,
    getSubscriptionSeed,
    exportSubscriptionCsv,
    exportHierarchyCsv
  };
})();
