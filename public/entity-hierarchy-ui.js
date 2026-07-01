(function () {
  'use strict';

  const CUSTOMER_IDENTITY_COLUMNS = ['رقم العميل', 'اسم العميل', 'الإيميل', 'رقم الجوال'];
  const HIERARCHY_ENTITY_COLUMNS = ['الفرع', 'الحاضنة', 'المنصة', 'المكتب'];
  const CUSTOMER_PREFIX_COLUMNS = CUSTOMER_IDENTITY_COLUMNS.concat(HIERARCHY_ENTITY_COLUMNS);
  const CUSTOMER_PREFIX_LENGTH = CUSTOMER_PREFIX_COLUMNS.length;
  const HIERARCHY_PREFIX_COLUMNS = HIERARCHY_ENTITY_COLUMNS;

  const CUSTOMER_SERVICE_MODULE_COLUMNS = [
    'نوع الخدمة', 'منفذ الخدمة', 'تاريخ الخدمة', 'الأولوية', 'الموضوع', 'الحالة', 'تاريخ الانتهاء'
  ];
  const CUSTOMER_SERVICE_DISPLAY_COLUMNS = CUSTOMER_PREFIX_COLUMNS.concat(CUSTOMER_SERVICE_MODULE_COLUMNS);

  const CUSTOMER_PREFIX_FIELD_NAMES = [
    'hub-field-customer-id',
    'hub-field-customer-name',
    'hub-field-email',
    'hub-field-mobile',
    'hub-field-branch',
    'hub-field-incubator',
    'hub-field-platform',
    'hub-field-office'
  ];

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
    if (config?.customerProfile === 'customer-service') {
      return CUSTOMER_SERVICE_DISPLAY_COLUMNS.slice();
    }
    if (config?.hierarchyLayout === 'customer') {
      return CUSTOMER_PREFIX_COLUMNS.concat(getDataColumns(config));
    }
    return getDataColumns(config);
  }

  function isCustomerServiceConfig(config) {
    return config?.customerProfile === 'customer-service';
  }

  function getHubTableTitle(config) {
    if (isCustomerServiceConfig(config)) return 'سجل خدمة العملاء';
    return `سجل ${config?.title || ''}`;
  }

  function getHubModalWidthClass(config) {
    if (config?.hierarchyLayout === 'customer' || isCustomerServiceConfig(config)) {
      return 'max-w-5xl';
    }
    return 'max-w-lg';
  }

  function isCustomerRowComplete(row, config) {
    const normalized = normalizeCustomerRow(row, config);
    return normalized[0] !== '—'
      && normalized[1] !== '—'
      && normalized[2] !== '—'
      && normalized[4] !== '—';
  }

  function resolveHubRowsFromApi(mapped, config, fallbackRows) {
    if (!Array.isArray(mapped) || !mapped.length) return fallbackRows;
    const normalized = normalizeRows(mapped, config);
    const completeRows = normalized.filter((row) => isCustomerRowComplete(row, config));
    return completeRows.length ? completeRows : fallbackRows;
  }

  function resolveStoredCustomerRows(stored, config, seedRows) {
    const seed = normalizeRows(seedRows, config);
    if (!Array.isArray(stored) || !stored.length) return seed;
    const resolved = resolveHubRowsFromApi(stored, config, seed);
    return normalizeRows(resolved, config);
  }

  function renderHubRowActions(dataAttr, route, index, options = {}) {
    const prefix = dataAttr;
    const recordId = options.recordId ?? '';
    const onClick = (action) => {
      if (!options.actionHandler) return '';
      return ` onclick="${options.actionHandler}(this,'${action}',event);return false;"`;
    };
    const addButton = options.hideAdd ? '' : `
        <button type="button" data-${prefix}-action="add" data-route="${route}" data-index="${index}" data-record-id="${recordId}"${onClick('add')}
          class="px-2.5 py-1.5 rounded-lg bg-cyan-50 hover:bg-cyan-100 text-cyan-700 text-xs font-bold" title="إضافة">
          <i class="fas fa-plus"></i>
        </button>`;
    return `
      <div class="flex flex-wrap items-center justify-end gap-1.5">
        ${addButton}
        <button type="button" data-${prefix}-action="view" data-route="${route}" data-index="${index}" data-record-id="${recordId}"${onClick('view')}
          class="px-2.5 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold" title="عرض">
          <i class="fas fa-eye"></i>
        </button>
        <button type="button" data-${prefix}-action="edit" data-route="${route}" data-index="${index}" data-record-id="${recordId}"${onClick('edit')}
          class="px-2.5 py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-700 text-xs font-bold" title="تعديل">
          <i class="fas fa-pen"></i>
        </button>
        <button type="button" data-${prefix}-action="delete" data-route="${route}" data-index="${index}" data-record-id="${recordId}"${onClick('delete')}
          class="px-2.5 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold" title="حذف">
          <i class="fas fa-trash"></i>
        </button>
      </div>
    `;
  }

  function getCustomerColumnIndex() {
    return 1;
  }

  function getCustomerRowIndex(config) {
    if (config?.hierarchyLayout === 'subscription') return 3;
    if (config?.hierarchyLayout === 'customer') return 1;
    return 0;
  }

  function getStatusRowIndex(config) {
    if (config?.hierarchyLayout === 'subscription') return 5;
    const dataColumns = getDataColumns(config);
    const statusIndex = dataColumns.indexOf('الحالة');
    if (statusIndex < 0) {
      return config?.hierarchyLayout === 'customer'
        ? CUSTOMER_PREFIX_LENGTH + Math.max(0, dataColumns.length - 1)
        : Math.max(0, dataColumns.length - 1);
    }
    return config?.hierarchyLayout === 'customer'
      ? CUSTOMER_PREFIX_LENGTH + statusIndex
      : statusIndex;
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

  function emptyCustomerRow(config) {
    return CUSTOMER_PREFIX_COLUMNS.map(() => '—').concat(getDataColumns(config).map(() => '—'));
  }

  function migrateLegacyCustomerRow(row, config) {
    const dataColumns = getDataColumns(config);
    const targetLen = CUSTOMER_PREFIX_LENGTH + dataColumns.length;

    if (!Array.isArray(row)) return emptyCustomerRow(config);
    if (row.length >= targetLen) return row.slice(0, targetLen);

    if (row.length >= 4 && row.length <= 7) {
      const branch = row[0] ?? '—';
      const incubator = row[1] ?? '—';
      const platform = row[2] ?? '—';
      const legacyData = row.slice(3);
      let clientNum = '—';
      let clientName = '—';

      if (legacyData.length >= 1) {
        const clientVal = String(legacyData[0] ?? '—');
        if (/عميل\s*\d+/i.test(clientVal)) {
          clientNum = clientVal.match(/\d+/)?.[0] || clientVal;
          clientName = clientVal;
        } else if (clientVal !== '—') {
          clientName = clientVal;
        }
      }

      if (legacyData.length === 4 && dataColumns.length === 7) {
        return [
          clientNum, clientName, '—', '—', branch, incubator, platform, '—',
          '—', '—', '—', legacyData[2], legacyData[1], legacyData[3], '—'
        ];
      }

      if (legacyData.length === 4 && dataColumns.length === 3) {
        return [
          clientNum, clientName, '—', '—', branch, incubator, platform, '—',
          legacyData[1], legacyData[2], legacyData[3]
        ];
      }

      if (legacyData.length === 3 && dataColumns.length === 3) {
        return [
          clientNum, clientName, '—', '—', branch, incubator, platform, '—',
          ...legacyData
        ];
      }

      const padded = [clientNum, clientName, '—', '—', branch, incubator, platform, '—'].concat(legacyData);
      while (padded.length < targetLen) padded.push('—');
      return padded.slice(0, targetLen);
    }

    if (row.length === 4 && dataColumns.length === 2) {
      return ['—', row[0], row[1], '—', '—', '—', '—', '—', row[2], row[3]];
    }

    if (row.length === 4 && dataColumns.length === 3 && dataColumns[0] !== 'القسم') {
      return ['—', row[0], '—', '—', '—', '—', '—', '—', row[1], row[2], row[3]];
    }

    if (row.length === 4 && dataColumns.length === 3 && dataColumns[0] === 'الفئة') {
      return ['—', row[0], '—', '—', '—', '—', '—', '—', row[1], row[2], row[3]];
    }

    if (row.length === dataColumns.length) {
      return ['—', '—', '—', '—', '—', '—', '—', '—'].concat(row);
    }

    const values = row.slice();
    while (values.length < targetLen) values.push('—');
    return values.slice(0, targetLen);
  }

  function normalizeCustomerRow(row, config) {
    return migrateLegacyCustomerRow(row, config);
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

  function validateCustomerRow(values) {
    if (!Array.isArray(values)) return false;
    for (let i = 0; i < CUSTOMER_PREFIX_LENGTH; i++) {
      if (!values[i] || values[i] === '—') return false;
    }
    return true;
  }

  function mapCustomerServiceApiRow(item) {
    const source = item || {};
    return [
      source.customer_id || source.client_number || source.id || '—',
      source.customer_name || source.employee_name || '—',
      source.email || source.customer_email || '—',
      source.phone || source.mobile || source.customer_phone || '—',
      source.branch_name || '—',
      source.incubator_name || '—',
      source.platform_name || '—',
      source.office_name || source.office || '—',
      source.service_type || source.request_type || '—',
      source.assigned_to || source.handler || source.employee_name || '—',
      (source.service_date || source.created_at || '').toString().slice(0, 10) || '—',
      source.priority || '—',
      source.request_title || source.title || source.subject || '—',
      source.status || '—',
      (source.end_date || source.due_date || source.closed_at || '').toString().slice(0, 10) || '—'
    ];
  }

  function mapUserRecordApiRow(item) {
    const source = item || {};
    return [
      source.user_id || source.id || source.customer_id || source.member_id || '—',
      source.name || source.full_name || source.username || source.member_name || '—',
      source.email || source.customer_email || '—',
      source.phone || source.mobile || source.customer_phone || '—',
      source.branch_name || '—',
      source.incubator_name || '—',
      source.platform_name || '—',
      source.office_name || source.department || '—',
      source.role || source.job_title || source.category || source.member_type || '—',
      source.is_active === false ? 'موقوف' : (source.status || 'نشط')
    ];
  }

  function mapMemberRecordApiRow(item) {
    const source = item || {};
    return [
      source.member_id || source.id || source.customer_id || '—',
      source.name || source.member_name || source.customer_name || '—',
      source.email || '—',
      source.phone || source.mobile || '—',
      source.branch_name || '—',
      source.incubator_name || '—',
      source.platform_name || '—',
      source.office_name || '—',
      source.category || source.member_type || '—',
      source.status || 'نشط',
      (source.joined_at || source.created_at || '').toString().slice(0, 10) || '—'
    ];
  }

  function mapHrRecordApiRow(item) {
    const source = item || {};
    return [
      source.user_id || source.id || source.employee_id || '—',
      source.name || source.full_name || source.username || '—',
      source.email || '—',
      source.phone || source.mobile || '—',
      source.branch_name || '—',
      source.incubator_name || '—',
      source.platform_name || '—',
      source.office_name || source.department || '—',
      source.department || source.team || '—',
      source.role || source.job_title || '—',
      source.is_active === false ? 'موقوف' : (source.status || 'نشط')
    ];
  }

  function mapCustomerSalesApiRow(item) {
    const source = item || {};
    return [
      source.customer_id || source.client_id || '—',
      source.customer_name || source.client_name || source.title || '—',
      source.email || source.customer_email || '—',
      source.phone || source.mobile || '—',
      source.branch_name || '—',
      source.incubator_name || '—',
      source.platform_name || '—',
      source.office_name || '—',
      source.total_amount || source.amount || source.total || '—',
      source.status || '—',
      (source.created_at || source.issue_date || '').toString().slice(0, 10) || '—'
    ];
  }

  function getCustomerServiceSeed() {
    return [
      ['1042', 'شركة المدار الذكية', 'client1042@naiosh.com', '+966501042000', 'فرع الرياض', 'حاضنة الرياض التقنية', 'منصة الرياض', 'مكتب الرياض', 'تفعيل حساب', 'فريق الدعم', '2026-06-08', 'عالية', 'تأخر تفعيل الحساب', 'قيد المعالجة', '2026-06-15'],
      ['2201', 'مؤسسة الحلول', 'info@hulool.sa', '+966502201111', 'فرع جدة', 'Safety Incubator', 'NAIOSH Cloud', 'مكتب جدة', 'فوترة', 'أ. نورة', '2026-06-07', 'متوسطة', 'استفسار فاتورة', 'تم الرد', '2026-06-10'],
      ['3310', 'مجموعة الريادة', 'contact@reyada.sa', '+966503310222', 'فرع الدمام', '—', '—', 'مكتب الدمام', 'تدريب', 'فريق التدريب', '2026-06-05', 'منخفضة', 'طلب تدريب', 'مغلقة', '2026-06-06']
    ];
  }

  function getCustomerSalesSeed() {
    return [
      ['2041', 'شركة المدار', 'sales@madar.sa', '+966502041000', 'فرع الرياض', 'حاضنة الرياض', 'منصة الرياض', 'مكتب المبيعات', '45,000 ر.س', 'تفاوض', '2026-06-08'],
      ['2055', 'مؤسسة الحلول', 'deals@hulool.sa', '+966502055111', 'فرع جدة', 'Safety Incubator', 'NAIOSH Cloud', 'مكتب جدة', '18,500 ر.س', 'عرض مرسل', '2026-06-07'],
      ['2099', 'مجموعة الريادة', 'hq@reyada.sa', '+966502099222', 'المكتب الرئيسي', '—', '—', 'المكتب الرئيسي', '92,000 ر.س', 'مغلقة', '2026-06-05']
    ];
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
    const priorityIndex = config?.hierarchyLayout === 'customer'
      ? CUSTOMER_PREFIX_LENGTH + (getDataColumns(config).indexOf('الأولوية'))
      : -1;

    const active = rows.filter((row) => /قيد|جار|مفتوح|نشط|مجدول|تفاوض|active/i.test(String(row[statusIndex] || ''))).length;
    const done = rows.filter((row) => /مكتمل|مغلق|منج|محصل|معتمد|منشور|منته|تم الرد|expir|pause/i.test(String(row[statusIndex] || ''))).length;

    let urgent = 0;
    if (priorityIndex >= 0) {
      urgent = rows.filter((row) => /عال|عاجل|urgent|high/i.test(String(row[priorityIndex] || ''))).length;
    }
    if (!urgent && renewalIndex >= 0) {
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
      { label: 'المنصة', value: platform },
      { label: 'المكتب', value: opts.office || '—' }
    ];

    if (showCustomer) {
      fields.unshift(
        { label: 'رقم العميل', value: opts.customerId || '—' },
        { label: 'اسم العميل', value: customer, highlight: true }
      );
    }

    const labels = fields.map((field) => `
      <span class="entity-hierarchy-grid-label">${field.label}</span>
    `).join('');

    const values = fields.map((field) => `
      <span class="entity-hierarchy-grid-value${field.highlight ? ' entity-hierarchy-grid-value--primary' : ''}">${escapeHtml(field.value)}</span>
    `).join('');

    return `
      <div class="entity-hierarchy-grid" role="group" aria-label="بيانات العميل والانتماء">
        <div class="entity-hierarchy-grid-labels">${labels}</div>
        <div class="entity-hierarchy-grid-values">${values}</div>
      </div>
    `;
  }

  function renderCustomerPrefixCells(normalized) {
    return normalized.slice(0, CUSTOMER_PREFIX_LENGTH).map((cell, index) => {
      const columnName = CUSTOMER_PREFIX_COLUMNS[index];
      return renderDataCell(cell, columnName);
    }).join('');
  }

  function renderDataCell(cell, columnName) {
    if (columnName === 'الحالة') {
      const active = /نشط|active|قيد|جار|مفتوح|مجدول|تفاوض/i.test(cell);
      const done = /مكتمل|مغلق|منج|منشور|تم الرد/i.test(cell);
      const tone = active
        ? 'bg-emerald-100 text-emerald-700'
        : (done ? 'bg-slate-100 text-slate-600' : 'bg-amber-100 text-amber-700');
      return `<td class="px-4 py-3 text-sm align-middle">
        <span class="inline-flex px-2.5 py-1 rounded-full text-xs font-bold ${tone}">${escapeHtml(cell)}</span>
      </td>`;
    }
    if (columnName === 'الأولوية') {
      const high = /عال|عاجل|urgent|high/i.test(cell);
      const low = /منخفض|low/i.test(cell);
      const tone = high
        ? 'bg-rose-100 text-rose-700'
        : (low ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700');
      return `<td class="px-4 py-3 text-sm align-middle">
        <span class="inline-flex px-2.5 py-1 rounded-full text-xs font-bold ${tone}">${escapeHtml(cell)}</span>
      </td>`;
    }
    if (columnName === 'رقم العميل' || columnName === 'اسم العميل' || columnName === 'العميل') {
      return `<td class="px-4 py-3 text-sm text-slate-800 align-middle font-bold whitespace-nowrap">${escapeHtml(cell)}</td>`;
    }
    return `<td class="px-4 py-3 text-sm text-slate-700 align-middle whitespace-nowrap">${escapeHtml(cell)}</td>`;
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
    const dataCells = dataColumns.map((columnName, colIndex) => {
      const cell = normalized[CUSTOMER_PREFIX_LENGTH + colIndex] ?? '—';
      return renderDataCell(cell, columnName);
    }).join('');
    return renderCustomerPrefixCells(normalized) + dataCells;
  }

  function renderSubscriptionDataCell(row) {
    const [branch, incubator, platform, customer] = padSubscriptionRow(row);
    return renderHierarchyBlock(branch, incubator, platform, customer);
  }

  function renderCustomerContextCell(row, customerIndex, config) {
    const normalized = normalizeCustomerRow(row, config || { columns: [] });
    const customer = normalized[1] || '—';
    return renderHierarchyBlock(normalized[4], normalized[5], normalized[6], customer, {
      customerId: normalized[0],
      office: normalized[7]
    });
  }

  function renderHubTable(options) {
    const {
      route,
      config,
      rows,
      renderRowActions,
      dataAttr = 'hub',
      actionHandler = ''
    } = options;

    const toolbarClick = (action) => {
      if (!actionHandler) return '';
      return ` onclick="${actionHandler}(this,'${action}',event);return false;"`;
    };

    const displayColumns = getDisplayColumns(config);
    const normalizedRows = normalizeRows(rows, config);
    const tableClass = isCustomerServiceConfig(config)
      ? 'min-w-full text-right entity-hierarchy-table entity-hierarchy-table--customer-service'
      : 'min-w-full text-right entity-hierarchy-table';
    const tableTitle = getHubTableTitle(config);

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
          <h3 class="font-bold text-slate-800">${tableTitle}</h3>
          <div class="flex flex-wrap gap-2">
            <button type="button" data-${dataAttr}-action="refresh" data-route="${route}"${toolbarClick('refresh')} class="px-3 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold">
              <i class="fas fa-rotate"></i> تحديث
            </button>
            <button type="button" data-${dataAttr}-action="add" data-route="${route}"${toolbarClick('add')} class="px-3 py-2 rounded-lg bg-red-700 hover:bg-red-800 text-white text-xs font-bold">
              <i class="fas fa-plus"></i> إضافة
            </button>
            <button type="button" data-${dataAttr}-action="export" data-route="${route}"${toolbarClick('export')} class="px-3 py-2 rounded-lg border border-red-200 text-red-700 hover:bg-red-50 text-xs font-bold">
              <i class="fas fa-download"></i> تصدير
            </button>
          </div>
        </div>
        <div class="overflow-x-auto">
          <table class="${tableClass}">
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
      const values = CUSTOMER_PREFIX_FIELD_NAMES.map((name) =>
        (form.querySelector(`[name="${name}"]`)?.value || '').trim() || '—'
      );
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
    const inputAttrs = isView
      ? 'readonly class="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-700 text-sm"'
      : 'class="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:border-red-500 focus:ring-2 focus:ring-red-100 outline-none text-sm"';

    if (config.hierarchyLayout === 'subscription') {
      const values = padSubscriptionRow(row);

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
      const identityFields = CUSTOMER_IDENTITY_COLUMNS.map((label, index) => `
        <label class="entity-hierarchy-form-field">
          <span class="text-xs font-bold text-slate-500 mb-1 block">${esc(label)}</span>
          <input type="text" name="${CUSTOMER_PREFIX_FIELD_NAMES[index]}" value="${esc(normalized[index] ?? '')}" ${inputAttrs} required />
        </label>
      `).join('');

      const hierarchyFields = HIERARCHY_ENTITY_COLUMNS.map((label, offset) => {
        const index = CUSTOMER_IDENTITY_COLUMNS.length + offset;
        return `
          <label class="entity-hierarchy-form-field">
            <span class="text-xs font-bold text-slate-500 mb-1 block">${esc(label)}</span>
            <input type="text" name="${CUSTOMER_PREFIX_FIELD_NAMES[index]}" value="${esc(normalized[index] ?? '')}" ${inputAttrs} required />
          </label>
        `;
      }).join('');

      const columnFields = (config.columns || []).map((col, colIndex) => {
        const value = normalized[CUSTOMER_PREFIX_LENGTH + colIndex] ?? '';
        return `
          <label class="entity-hierarchy-form-field">
            <span class="text-xs font-bold text-slate-500 mb-1 block">${esc(col)}</span>
            <input type="text" name="hub-field-${colIndex}" value="${esc(value)}" ${inputAttrs} />
          </label>
        `;
      }).join('');

      return `
        <div class="entity-hierarchy-form-section">
          <p class="text-xs font-extrabold text-red-700 mb-2">بيانات العميل</p>
          <div class="entity-hierarchy-form-grid entity-hierarchy-form-grid--top">${identityFields}</div>
        </div>
        <div class="entity-hierarchy-form-section mt-4">
          <p class="text-xs font-extrabold text-red-700 mb-2">الانتماء المؤسسي</p>
          <div class="entity-hierarchy-form-grid entity-hierarchy-form-grid--top">${hierarchyFields}</div>
        </div>
        <div class="entity-hierarchy-form-section mt-4">
          <p class="text-xs font-extrabold text-red-700 mb-2">بيانات السجل</p>
          <div class="entity-hierarchy-form-grid entity-hierarchy-form-grid--bottom">${columnFields}</div>
        </div>
      `;
    }

    return (config.columns || []).map((col, colIndex) => {
      const value = row ? (row[colIndex] ?? '') : '';
      const plainAttrs = isView
        ? 'readonly class="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-700"'
        : 'class="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-red-500 focus:ring-2 focus:ring-red-100 outline-none"';
      return `
        <label class="block">
          <span class="text-sm font-bold text-slate-600 mb-1.5 block">${esc(col)}</span>
          <input type="text" name="hub-field-${colIndex}" value="${esc(value)}" ${plainAttrs} />
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
    CUSTOMER_IDENTITY_COLUMNS,
    HIERARCHY_ENTITY_COLUMNS,
    CUSTOMER_PREFIX_COLUMNS,
    CUSTOMER_PREFIX_LENGTH,
    CUSTOMER_SERVICE_MODULE_COLUMNS,
    CUSTOMER_SERVICE_DISPLAY_COLUMNS,
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
    validateCustomerRow,
    mapCustomerServiceApiRow,
    mapCustomerSalesApiRow,
    mapUserRecordApiRow,
    mapMemberRecordApiRow,
    mapHrRecordApiRow,
    getCustomerServiceSeed,
    getCustomerSalesSeed,
    isCustomerServiceConfig,
    getHubTableTitle,
    getHubModalWidthClass,
    isCustomerRowComplete,
    resolveHubRowsFromApi,
    resolveStoredCustomerRows,
    renderHubRowActions,
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
