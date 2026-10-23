(function () {
  const FORMS = {
    'cost-centers': [['record_number', 'الرمز'], ['title', 'اسم مركز التكلفة', true], ['notes', 'ملاحظات', false, 'textarea']],
    checks: [['record_number', 'رقم الشيك'], ['party_name', 'الطرف', true], ['amount', 'المبلغ', true, 'number'], ['title', 'البنك'], ['notes', 'ملاحظات', false, 'textarea']],
    deposits: [['party_name', 'العميل / الدافع', true], ['customer_id', 'رقم العميل', false, 'number'], ['amount', 'المبلغ', true, 'number'], ['notes', 'ملاحظات', false, 'textarea']],
    'price-lists': [['title', 'اسم القائمة', true], ['lines', 'البنود: sku,كمية,سعر في كل سطر', false, 'textarea'], ['notes', 'ملاحظات', false, 'textarea']],
    'asset-moves': [['asset_id', 'رقم الأصل', true, 'number'], ['move_type', 'نوع الحركة TRANSFER أو DISPOSAL أو SALE', true], ['to_location', 'موقع الوصول'], ['amount', 'قيمة البيع أو الاستبعاد', false, 'number'], ['notes', 'سبب الحركة', true, 'textarea']],
    'purchase-requests': [['title', 'وصف الطلب', true], ['party_name', 'المورد المقترح'], ['amount', 'الإجمالي', false, 'number'], ['lines', 'البنود: وصف,كمية,تكلفة', false, 'textarea'], ['notes', 'ملاحظات', false, 'textarea']],
    projects: [['title', 'اسم المشروع', true], ['amount', 'الميزانية', false, 'number'], ['notes', 'النطاق', false, 'textarea']],
    tasks: [['title', 'المهمة', true], ['project_id', 'رقم المشروع', false, 'number'], ['party_name', 'المسؤول'], ['notes', 'التفاصيل', false, 'textarea']],
    'project-costs': [['project_id', 'رقم المشروع', true, 'number'], ['title', 'البيان', true], ['amount', 'المبلغ', true, 'number'], ['reference_type', 'EXPENSE أو REVENUE أو COST'], ['notes', 'مرجع', false, 'textarea']],
    loyalty: [['party_name', 'العميل', true], ['customer_id', 'رقم العميل', false, 'number'], ['amount', 'النقاط', true, 'number'], ['notes', 'سبب الحركة', true, 'textarea']],
    subscriptions: [['title', 'اسم الاشتراك', true], ['party_name', 'العميل', true], ['customer_id', 'رقم العميل', false, 'number'], ['amount', 'قيمة الدورة', true, 'number'], ['notes', 'الدورة والتجديد', false, 'textarea']],
    insurance: [['title', 'وثيقة التأمين', true], ['party_name', 'المؤمن له', true], ['amount', 'قيمة التغطية', true, 'number'], ['notes', 'الشركة والانتهاء', false, 'textarea']],
    'sales-targets': [['title', 'الهدف', true], ['amount', 'المبلغ المستهدف', true, 'number'], ['period_start', 'من تاريخ', true, 'date'], ['period_end', 'إلى تاريخ', true, 'date'], ['notes', 'الفريق', false, 'textarea']],
    commissions: [['title', 'وصف العمولة', true], ['party_name', 'المستحق', true], ['amount', 'قيمة العمولة', true, 'number'], ['percent', 'النسبة', false, 'number'], ['notes', 'أساس الاحتساب', false, 'textarea']],
    'auto-rules': [['title', 'اسم القاعدة', true], ['debit_account_id', 'رقم الحساب المدين', true, 'number'], ['credit_account_id', 'رقم الحساب الدائن', true, 'number'], ['notes', 'متى تُستخدم', false, 'textarea']],
    'pos-tickets': [['party_name', 'العميل'], ['amount', 'الإجمالي', true, 'number'], ['lines', 'البنود: وصف,كمية,سعر', false, 'textarea'], ['notes', 'طريقة القبض', false, 'textarea']],
    'e-invoice-queue': [['invoice_id', 'رقم الفاتورة المحلية', true, 'number'], ['title', 'مرجع داخلي'], ['notes', 'ملاحظة', false, 'textarea']],
    'gov-integrations': [['title', 'اسم الخدمة', true], ['notes', 'الجهة. الاتصال الحكومي غير مفعّل', false, 'textarea']],
    'work-orders': [['title', 'أمر الشغل', true], ['party_name', 'العميل أو الأصل'], ['amount', 'التكلفة التقديرية', false, 'number'], ['notes', 'الوصف', false, 'textarea']],
    workflows: [['title', 'اسم دورة العمل', true], ['steps', 'الخطوات، كل سطر خطوة', false, 'textarea'], ['notes', 'حد الصلاحية', false, 'textarea']],
    bookings: [['title', 'الحجز', true], ['party_name', 'العميل', true], ['period_start', 'البداية', true, 'date'], ['period_end', 'النهاية', false, 'date'], ['amount', 'القيمة', false, 'number']],
    rentals: [['title', 'الوحدة', true], ['party_name', 'المستأجر', true], ['amount', 'الإيجار', true, 'number'], ['notes', 'المدة', false, 'textarea']],
    leases: [['title', 'عقد الإيجار', true], ['party_name', 'الطرف', true], ['amount', 'قيمة العقد', true, 'number'], ['period_start', 'البداية', false, 'date'], ['period_end', 'النهاية', false, 'date']],
    'time-entries': [['title', 'العمل', true], ['project_id', 'رقم المشروع', false, 'number'], ['party_name', 'الموظف'], ['amount', 'الساعات', true, 'number'], ['notes', 'التاريخ', false, 'textarea']],
    bom: [['title', 'منتج التصنيع', true], ['lines', 'المكونات: sku,كمية', false, 'textarea'], ['notes', 'ملاحظات', false, 'textarea']]
  };

  const META = {
    'cost-centers': ['مراكز التكلفة', 'سجل مراكز التكلفة مع إضافة وتعديل وحذف.', 'fa-sitemap'],
    checks: ['دورة الشيكات', 'الشيك المحفوظ لا يُمسح. الحذف هنا يلغي الشيك بسبب.', 'fa-money-check'],
    deposits: ['العربون والدفعات', 'العربون يُحفظ، ويُطبَّق على فاتورة، ويُعكس عند الإلغاء.', 'fa-hand-holding-dollar'],
    'price-lists': ['قوائم الأسعار', 'قائمة أسعار وبنودها، مع حقول إضافية عند الحاجة.', 'fa-tags'],
    'asset-moves': ['حركة الأصول', 'نقل أو استبعاد أو بيع أصل. الإلغاء يعيد آخر حالة.', 'fa-building'],
    'purchase-requests': ['طلبات الشراء', 'طلب شراء قابل للتعديل والتحويل إلى أمر شراء.', 'fa-file-invoice'],
    projects: ['المشاريع', 'مشاريع بميزانية، مع تعديل وحذف للمسودة.', 'fa-diagram-project'],
    tasks: ['المهام', 'مهام مربوطة برقم مشروع.', 'fa-list-check'],
    'project-costs': ['تكاليف المشاريع', 'ربط مبلغ مصروف أو إيراد أو تكلفة بمشروع.', 'fa-coins'],
    loyalty: ['نقاط الولاء', 'حركة نقاط، والرصيد أسفل الجدول مجموع غير الملغى.', 'fa-star'],
    subscriptions: ['الاشتراكات', 'اشتراكات وعضويات العملاء.', 'fa-id-card'],
    insurance: ['التأمينات', 'وثائق التأمين وقيمة التغطية.', 'fa-shield-halved'],
    'sales-targets': ['أهداف المبيعات', 'الهدف يُقارن بمجموع فواتير الفترة.', 'fa-bullseye'],
    commissions: ['العمولات', 'عمولة مستحقة مع نسبتها وأساسها.', 'fa-percent'],
    'auto-rules': ['قواعد القيود', 'قاعدة بحسابين، والتنفيذ ينشئ قيدًا متوازنًا.', 'fa-robot'],
    'pos-tickets': ['نقاط البيع', 'تذاكر بيع محفوظة. لا بوابة دفع خارجية.', 'fa-cash-register'],
    'e-invoice-queue': ['فاتورة إلكترونية', 'طابور محلي. الإرسال الحكومي غير موصول.', 'fa-file-code'],
    'gov-integrations': ['التكاملات الحكومية', 'سجل الجهات. لا يمكن تعليم الخدمة متصلة.', 'fa-landmark'],
    'work-orders': ['أوامر الشغل', 'أوامر شغل مع تعديل وحذف.', 'fa-screwdriver-wrench'],
    workflows: ['دورات العمل', 'قوالب خطوات. صندوق الموافقات غير مربوط تلقائيًا.', 'fa-diagram-next'],
    bookings: ['الحجوزات', 'حجوزات بتاريخ وقيمة.', 'fa-calendar-check'],
    rentals: ['الإيجارات', 'وحدات الإيجار والمستأجر.', 'fa-key'],
    leases: ['عقود الإيجار', 'عقود بقيمة وفترة.', 'fa-file-contract'],
    'time-entries': ['تتبع الوقت', 'ساعات عمل على مشروع.', 'fa-clock'],
    bom: ['التصنيع', 'قائمة مكونات منتج.', 'fa-industry']
  };

  const NAV = [
    ['/finance', 'اللوحة'],
    ['/finance/cost-centers.html', 'مراكز التكلفة'],
    ['/finance/checks.html', 'الشيكات'],
    ['/finance/deposits.html', 'العربون'],
    ['/finance/price-lists.html', 'الأسعار'],
    ['/finance/asset-moves.html', 'الأصول'],
    ['/finance/purchase-requests.html', 'طلبات الشراء'],
    ['/finance/projects.html', 'المشاريع'],
    ['/finance/tasks.html', 'المهام'],
    ['/finance/loyalty.html', 'الولاء'],
    ['/finance/subscriptions.html', 'الاشتراكات'],
    ['/finance/sales-targets.html', 'الأهداف'],
    ['/finance/commissions.html', 'العمولات'],
    ['/finance/work-orders.html', 'أوامر الشغل'],
    ['/finance/pos.html', 'نقاط البيع'],
    ['/finance/manufacturing.html', 'التصنيع'],
    ['/finance/report-exports.html', 'التصدير']
  ];

  const STATUS = {
    OPEN: 'مفتوح', ACTIVE: 'نشط', DRAFT: 'مسودة', RECEIVED: 'مستلم', POSTED: 'مرحّل',
    APPLIED: 'مطبّق', CANCELLED: 'ملغى', CONVERTED: 'محوّل', CONFIRMED: 'مؤكد',
    DISCONNECTED: 'غير متصل', LOCAL_ONLY: 'محلي', PAID: 'مدفوع', PARTIAL: 'جزئي'
  };
  const PAYLOAD_KEYS = ['move_type', 'to_location', 'period_start', 'period_end', 'percent', 'debit_account_id', 'credit_account_id'];
  const TOP_KEYS = ['record_number', 'title', 'party_name', 'amount', 'notes', 'customer_id', 'asset_id', 'project_id', 'invoice_id', 'reference_type'];

  function headers() {
    return { 'Content-Type': 'application/json', ...(window.getFinanceHeaders ? window.getFinanceHeaders() : {}) };
  }
  function entity() {
    return window.getFinanceEntityId ? window.getFinanceEntityId() : '';
  }
  function qs() {
    const id = entity();
    return id ? `?entity_id=${encodeURIComponent(id)}` : '';
  }
  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  }
  function isCurrent(href) {
    const path = String(location.pathname || '').replace(/\/+$/, '') || '/';
    if (href === '/finance') return path === '/finance' || path === '/finance/index.html';
    return path === href;
  }
  function navHtml() {
    return NAV.map(([href, label]) => `<a href="${href}" class="${isCurrent(href) ? 'active' : ''}">${label}</a>`).join('');
  }

  function boot() {
    const kind = document.body.dataset.kind;
    const app = document.getElementById('app');
    if (!app) return;
    if (kind === 'report-exports') {
      document.title = 'تصدير التقارير — نايوش';
      app.innerHTML = `
        <div class="ops-wrap">
          <header class="ops-hero">
            <div>
              <a class="ops-kicker" href="/finance"><i class="fas fa-arrow-right"></i> القيادة المالية 360</a>
              <h1><i class="fas fa-file-export"></i> تصدير التقارير</h1>
              <p>تنزيل CSV من جداول Postgres الحالية. الملف يبقى بالعناوين إن لم توجد صفوف.</p>
            </div>
          </header>
          <nav class="ops-nav">${navHtml()}</nav>
          <div class="export-grid">
            <button class="export-card" type="button" data-name="invoices"><i class="fas fa-file-invoice"></i><strong>الفواتير</strong><span>تنزيل CSV</span></button>
            <button class="export-card" type="button" data-name="customers"><i class="fas fa-users"></i><strong>العملاء</strong><span>تنزيل CSV</span></button>
            <button class="export-card" type="button" data-name="expenses"><i class="fas fa-receipt"></i><strong>المصروفات</strong><span>تنزيل CSV</span></button>
          </div>
        </div>`;
      app.querySelectorAll('[data-name]').forEach((btn) => {
        btn.onclick = () => {
          const id = entity();
          const q = id ? `?entity_id=${encodeURIComponent(id)}` : '';
          window.location = `/finance/ops/export/${btn.dataset.name}${q}`;
        };
      });
      return;
    }
    const fields = FORMS[kind] || [];
    const meta = META[kind] || [document.title, '', 'fa-folder'];
    document.title = meta[0] + ' — نايوش';
    app.innerHTML = `
      <div class="ops-wrap">
        <header class="ops-hero">
          <div>
            <a class="ops-kicker" href="/finance"><i class="fas fa-arrow-right"></i> القيادة المالية 360</a>
            <h1><i class="fas ${meta[2]}"></i> ${esc(meta[0])}</h1>
            <p>${esc(meta[1])}</p>
          </div>
        </header>
        <nav class="ops-nav">${navHtml()}</nav>
        <section class="ops-stats">
          <div class="ops-stat"><span>إجمالي السجلات</span><strong id="stat-count" class="num">0</strong></div>
          <div class="ops-stat"><span>سجلات مفتوحة</span><strong id="stat-open" class="num">0</strong></div>
          <div class="ops-stat"><span>ملغاة</span><strong id="stat-cancel" class="num">0</strong></div>
          <div class="ops-stat"><span>مجموع القيم</span><strong id="stat-sum" class="num">0</strong></div>
        </section>
        <div class="ops-toolbar">
          <button class="btn btn-add" id="add" type="button"><i class="fas fa-plus"></i> إضافة</button>
          <input id="q" placeholder="بحث بالرقم أو البيان أو الطرف أو الحالة">
          <button class="btn btn-ghost" id="refresh" type="button"><i class="fas fa-rotate"></i> تحديث</button>
        </div>
        <div id="alert"></div>
        <div id="extra"></div>
        <div class="ops-card">
          <div class="empty-state" id="empty" hidden><i class="fas fa-folder-open"></i>لا سجلات بعد. اضغط إضافة لإنشاء أول سجل.</div>
          <div style="overflow-x:auto">
            <table>
              <thead><tr><th>الرقم</th><th>البيان</th><th>الطرف</th><th>القيمة</th><th>الحالة</th><th>إجراءات</th></tr></thead>
              <tbody id="rows"></tbody>
            </table>
          </div>
        </div>
      </div>
      <div class="ops-modal" id="modal" hidden>
        <form class="ops-sheet" id="form">
          <h2 id="modal-title">إضافة</h2>
          <div class="ops-grid" id="fields"></div>
          <div class="extra-box">
            <strong>معلومات إضافية</strong>
            <div id="extras"></div>
            <button class="btn btn-ghost" id="add-extra" type="button" style="margin-top:8px"><i class="fas fa-plus"></i> إضافة معلومة</button>
          </div>
          <div class="sheet-actions">
            <button class="btn btn-ghost" id="close" type="button">إغلاق</button>
            <button class="btn btn-add" type="submit"><i class="fas fa-save"></i> حفظ</button>
          </div>
        </form>
      </div>`;

    document.getElementById('fields').innerHTML = fields.map(([name, label, required, type]) => {
      const wide = type === 'textarea' ? ' wide' : '';
      const control = type === 'textarea'
        ? `<textarea name="${name}" rows="3"></textarea>`
        : `<input name="${name}" type="${type || 'text'}">`;
      return `<label class="${wide.trim()}">${label}${required ? ' *' : ''}${control}</label>`;
    }).join('');

    let records = [];
    let editing = null;

    function alertMsg(text, ok) {
      document.getElementById('alert').innerHTML = `<div class="ops-alert ${ok ? 'ok' : 'err'}">${esc(text)}</div>`;
    }
    function statusLabel(status) {
      return STATUS[String(status || '').toUpperCase()] || status || '-';
    }
    function badge(status) {
      const key = String(status || '').toUpperCase();
      const cls = key === 'CANCELLED' ? 'cancel' : 'open';
      return `<span class="badge ${cls}">${esc(statusLabel(key))}</span>`;
    }
    function addExtraRow(label, value) {
      const row = document.createElement('div');
      row.className = 'extra-row';
      row.innerHTML = `<input class="ex-label" placeholder="اسم المعلومة" value="${esc(label || '')}"><input class="ex-value" placeholder="القيمة" value="${esc(value || '')}"><button type="button" class="btn btn-del">حذف</button>`;
      row.querySelector('button').onclick = () => row.remove();
      document.getElementById('extras').appendChild(row);
    }
    function collectExtras() {
      return [...document.querySelectorAll('#extras .extra-row')].map((row) => ({
        label: row.querySelector('.ex-label').value.trim(),
        value: row.querySelector('.ex-value').value.trim()
      })).filter((item) => item.label);
    }
    function fillForm(record) {
      const form = document.getElementById('form');
      form.reset();
      document.getElementById('extras').innerHTML = '';
      const payload = (record && record.payload) || {};
      fields.forEach(([name, , , type]) => {
        const input = form.elements[name];
        if (!input) return;
        if (name === 'lines') input.value = (payload.lines || []).map((line) => [line.sku, line.qty, line.price].filter((part) => part != null && part !== '').join(',')).join('\n');
        else if (name === 'steps') input.value = (payload.steps || []).join('\n');
        else if (PAYLOAD_KEYS.includes(name)) input.value = payload[name] != null ? payload[name] : '';
        else if (record) input.value = record[name] != null ? record[name] : '';
        if (type === 'number' && input.value === 'null') input.value = '';
      });
      (payload.extra || []).forEach((item) => addExtraRow(item.label, item.value));
    }
    function openModal(record) {
      editing = record;
      document.getElementById('modal-title').textContent = record ? 'تعديل السجل' : 'إضافة سجل';
      fillForm(record);
      document.getElementById('modal').hidden = false;
    }
    function closeModal() {
      document.getElementById('modal').hidden = true;
      editing = null;
    }
    function bodyFromForm() {
      const form = document.getElementById('form');
      const body = { entity_id: entity() || undefined, payload: { extra: collectExtras() } };
      fields.forEach(([name, , , type]) => {
        const value = String(form.elements[name].value || '').trim();
        if (name === 'lines') {
          body.payload.lines = value.split('\n').map((line) => line.trim()).filter(Boolean).map((line) => {
            const [sku, qty, price] = line.split(',').map((part) => part.trim());
            return { sku, qty, price };
          });
        } else if (name === 'steps') {
          body.payload.steps = value.split('\n').map((line) => line.trim()).filter(Boolean);
        } else if (PAYLOAD_KEYS.includes(name)) {
          if (value) body.payload[name] = type === 'number' ? Number(value) : value;
        } else if (value) {
          body[name] = type === 'number' ? Number(value) : value;
        }
      });
      return body;
    }
    function render() {
      const q = document.getElementById('q').value.trim().toLowerCase();
      const list = records.filter((row) => !q || [row.record_number, row.title, row.party_name, row.status, row.notes].join(' ').toLowerCase().includes(q));
      const open = records.filter((row) => !['CANCELLED', 'CONVERTED'].includes(String(row.status).toUpperCase())).length;
      const cancelled = records.filter((row) => String(row.status).toUpperCase() === 'CANCELLED').length;
      const sum = records.reduce((total, row) => total + Number(row.amount || 0), 0);
      document.getElementById('stat-count').textContent = records.length;
      document.getElementById('stat-open').textContent = open;
      document.getElementById('stat-cancel').textContent = cancelled;
      document.getElementById('stat-sum').textContent = sum.toLocaleString('en-US');
      document.getElementById('empty').hidden = list.length > 0;
      document.getElementById('rows').innerHTML = list.map((row) => {
        const extra = [];
        if (kind === 'purchase-requests' && !['CONVERTED', 'CANCELLED'].includes(String(row.status).toUpperCase())) extra.push(`<button class="btn btn-mini" data-convert="${row.record_id}">تحويل لأمر</button>`);
        if (kind === 'deposits' && String(row.status).toUpperCase() === 'OPEN') extra.push(`<button class="btn btn-mini" data-apply="${row.record_id}">تطبيق على فاتورة</button>`);
        if (kind === 'auto-rules' && String(row.status).toUpperCase() === 'ACTIVE') extra.push(`<button class="btn btn-mini" data-run="${row.record_id}">تنفيذ</button>`);
        const actual = row.actual_amount != null ? `<div class="num">فعلي ${Number(row.actual_amount).toLocaleString('en-US')}</div>` : '';
        const extras = ((row.payload && row.payload.extra) || []).filter((item) => item && item.label);
        const extraLine = extras.length ? `<div class="extra-preview">${extras.map((item) => `${esc(item.label)}: ${esc(item.value || '')}`).join(' · ')}</div>` : '';
        return `<tr>
          <td class="num">${esc(row.record_number)}</td>
          <td>${esc(row.title || '-')}${extraLine}</td>
          <td>${esc(row.party_name || '-')}</td>
          <td class="num">${Number(row.amount || 0).toLocaleString('en-US')}</td>
          <td>${badge(row.status)}${actual}</td>
          <td class="actions">
            <button class="btn btn-edit" data-edit="${row.record_id}"><i class="fas fa-pen"></i> تعديل</button>
            <button class="btn btn-del" data-del="${row.record_id}"><i class="fas fa-trash"></i> حذف</button>
            ${extra.join('')}
          </td>
        </tr>`;
      }).join('');
      document.querySelectorAll('[data-edit]').forEach((btn) => {
        btn.onclick = () => openModal(records.find((row) => String(row.record_id) === btn.dataset.edit));
      });
      document.querySelectorAll('[data-del]').forEach((btn) => { btn.onclick = () => remove(btn.dataset.del); });
      document.querySelectorAll('[data-convert]').forEach((btn) => { btn.onclick = () => convert(btn.dataset.convert); });
      document.querySelectorAll('[data-apply]').forEach((btn) => { btn.onclick = () => apply(btn.dataset.apply); });
      document.querySelectorAll('[data-run]').forEach((btn) => { btn.onclick = () => runRule(btn.dataset.run); });
    }
    async function load() {
      const res = await fetch(`/finance/ops/${kind}${qs()}`, { headers: headers() });
      const data = await res.json();
      if (!res.ok) { alertMsg(data.error || 'تعذر تحميل السجلات', false); return; }
      records = data.records || [];
      render();
      if (kind === 'loyalty') {
        const bal = await fetch(`/finance/ops/loyalty/balances${qs()}`, { headers: headers() }).then((r) => r.json());
        const box = document.getElementById('extra');
        box.innerHTML = `<div class="ops-card" style="padding:14px;margin-bottom:12px"><strong>أرصدة النقاط</strong><div>${(bal.balances || []).map((item) => `<div>${esc(item.party_name || item.customer_id || '-')} — <span class="num">${item.points}</span></div>`).join('') || 'لا أرصدة بعد'}</div></div>`;
      }
    }
    async function remove(id) {
      if (!confirm('حذف هذا السجل؟ السجل المرحّل يُلغى بسبب بدل المسح النهائي.')) return;
      const res = await fetch(`/finance/ops/${kind}/${id}${qs()}`, { method: 'DELETE', headers: headers() });
      const data = await res.json();
      if (res.ok) { alertMsg('تم الحذف', true); return load(); }
      if (res.status === 409) {
        const reason = prompt(data.error + '\nسبب الإلغاء:');
        if (!reason) return;
        const cancel = await fetch(`/finance/ops/${kind}/${id}/cancel${qs()}`, {
          method: 'POST', headers: headers(), body: JSON.stringify({ reason, entity_id: entity() || undefined })
        });
        const body = await cancel.json();
        if (!cancel.ok) { alertMsg(body.error || 'تعذر الإلغاء', false); return; }
        alertMsg('تم إلغاء السجل وعكس أثره', true);
        return load();
      }
      alertMsg(data.error || 'تعذر الحذف', false);
    }
    async function convert(id) {
      const vendor_name = prompt('اسم المورد لتحويل الطلب إلى أمر شراء');
      if (!vendor_name) return;
      const res = await fetch(`/finance/ops/purchase-requests/${id}/convert${qs()}`, {
        method: 'POST', headers: headers(), body: JSON.stringify({ vendor_name, entity_id: entity() || undefined })
      });
      const data = await res.json();
      if (!res.ok) { alertMsg(data.error || 'تعذر التحويل', false); return; }
      alertMsg('تم إنشاء أمر الشراء ' + data.order.po_number, true);
      load();
    }
    async function apply(id) {
      const invoice_id = prompt('رقم الفاتورة لتطبيق العربون');
      if (!invoice_id) return;
      const res = await fetch(`/finance/ops/deposits/${id}/apply${qs()}`, {
        method: 'POST', headers: headers(), body: JSON.stringify({ invoice_id: Number(invoice_id), entity_id: entity() || undefined })
      });
      const data = await res.json();
      if (!res.ok) { alertMsg(data.error || 'تعذر التطبيق', false); return; }
      alertMsg(data.message || 'تم التطبيق', true);
      load();
    }
    async function runRule(id) {
      const amount = prompt('مبلغ القيد');
      if (!amount) return;
      const res = await fetch(`/finance/ops/auto-rules/${id}/run${qs()}`, {
        method: 'POST', headers: headers(), body: JSON.stringify({ amount: Number(amount), entity_id: entity() || undefined })
      });
      const data = await res.json();
      if (!res.ok) { alertMsg(data.error || 'تعذر التنفيذ', false); return; }
      alertMsg('تم إنشاء القيد ' + data.entry_number, true);
      load();
    }

    document.getElementById('add').onclick = () => openModal(null);
    document.getElementById('close').onclick = closeModal;
    document.getElementById('add-extra').onclick = () => addExtraRow();
    document.getElementById('refresh').onclick = load;
    document.getElementById('q').oninput = render;
    document.getElementById('modal').addEventListener('click', (event) => {
      if (event.target.id === 'modal') closeModal();
    });
    document.getElementById('form').onsubmit = async (event) => {
      event.preventDefault();
      const body = bodyFromForm();
      const url = editing ? `/finance/ops/${kind}/${editing.record_id}${qs()}` : `/finance/ops/${kind}${qs()}`;
      const res = await fetch(url, { method: editing ? 'PUT' : 'POST', headers: headers(), body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) { alertMsg(data.error || 'تعذر الحفظ', false); return; }
      const wasEdit = !!editing;
      closeModal();
      alertMsg(wasEdit ? 'تم تعديل السجل' : 'تم حفظ السجل', true);
      load();
    };
    load();
  }

  if (window.whenFinanceContextReady) window.whenFinanceContextReady(boot);
  else boot();
})();
