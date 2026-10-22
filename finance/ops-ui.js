(function () {
  const FORMS = {
    'cost-centers': [
      ['record_number', 'الرمز'],
      ['title', 'اسم مركز التكلفة', true],
      ['notes', 'ملاحظات']
    ],
    checks: [
      ['record_number', 'رقم الشيك'],
      ['party_name', 'الطرف', true],
      ['amount', 'المبلغ', true, 'number'],
      ['title', 'البنك'],
      ['notes', 'ملاحظات']
    ],
    deposits: [
      ['party_name', 'العميل / الدافع', true],
      ['customer_id', 'رقم العميل', false, 'number'],
      ['amount', 'المبلغ', true, 'number'],
      ['notes', 'ملاحظات']
    ],
    'price-lists': [
      ['title', 'اسم القائمة', true],
      ['lines', 'البنود sku,qty,price في كل سطر', false, 'textarea']
    ],
    'asset-moves': [
      ['asset_id', 'رقم الأصل', true, 'number'],
      ['move_type', 'TRANSFER أو DISPOSAL أو SALE', true],
      ['to_location', 'موقع الوصول للنقل'],
      ['amount', 'قيمة البيع أو الاستبعاد', false, 'number'],
      ['notes', 'سبب الحركة', true]
    ],
    'purchase-requests': [
      ['title', 'وصف الطلب', true],
      ['party_name', 'المورد المقترح'],
      ['amount', 'الإجمالي', false, 'number'],
      ['lines', 'البنود وصف,كمية,تكلفة', false, 'textarea'],
      ['notes', 'ملاحظات']
    ],
    projects: [
      ['title', 'اسم المشروع', true],
      ['amount', 'الميزانية', false, 'number'],
      ['notes', 'النطاق']
    ],
    tasks: [
      ['title', 'المهمة', true],
      ['project_id', 'رقم المشروع', false, 'number'],
      ['party_name', 'المسؤول'],
      ['notes', 'التفاصيل']
    ],
    'project-costs': [
      ['project_id', 'رقم المشروع', true, 'number'],
      ['title', 'البيان', true],
      ['amount', 'المبلغ', true, 'number'],
      ['reference_type', 'EXPENSE أو REVENUE أو COST'],
      ['notes', 'مرجع']
    ],
    loyalty: [
      ['party_name', 'العميل', true],
      ['customer_id', 'رقم العميل', false, 'number'],
      ['amount', 'النقاط (+ أو -)', true, 'number'],
      ['notes', 'سبب الحركة', true]
    ],
    subscriptions: [
      ['title', 'اسم الاشتراك', true],
      ['party_name', 'العميل', true],
      ['customer_id', 'رقم العميل', false, 'number'],
      ['amount', 'قيمة الدورة', true, 'number'],
      ['notes', 'الدورة والتجديد']
    ],
    insurance: [
      ['title', 'وثيقة التأمين', true],
      ['party_name', 'المؤمن له', true],
      ['amount', 'قيمة التغطية', true, 'number'],
      ['notes', 'الشركة والانتهاء']
    ],
    'sales-targets': [
      ['title', 'الهدف', true],
      ['amount', 'المبلغ المستهدف', true, 'number'],
      ['period_start', 'من تاريخ', true, 'date'],
      ['period_end', 'إلى تاريخ', true, 'date'],
      ['notes', 'الفريق']
    ],
    commissions: [
      ['title', 'وصف العمولة', true],
      ['party_name', 'المستحق', true],
      ['amount', 'قيمة العمولة', true, 'number'],
      ['percent', 'النسبة', false, 'number'],
      ['notes', 'أساس الاحتساب']
    ],
    'auto-rules': [
      ['title', 'اسم القاعدة', true],
      ['debit_account_id', 'حساب مدين', true, 'number'],
      ['credit_account_id', 'حساب دائن', true, 'number'],
      ['notes', 'متى تُستخدم']
    ],
    'pos-tickets': [
      ['party_name', 'العميل'],
      ['amount', 'الإجمالي', true, 'number'],
      ['lines', 'البنود وصف,كمية,سعر', false, 'textarea'],
      ['notes', 'طريقة القبض المحلية']
    ],
    'e-invoice-queue': [
      ['invoice_id', 'رقم الفاتورة المحلية', true, 'number'],
      ['title', 'مرجع داخلي'],
      ['notes', 'ملاحظة']
    ],
    'gov-integrations': [
      ['title', 'اسم الخدمة', true],
      ['notes', 'الجهة. الحالة تبقى غير متصلة حتى يوجد موصل']
    ],
    'work-orders': [
      ['title', 'أمر الشغل', true],
      ['party_name', 'العميل أو الأصل'],
      ['amount', 'التكلفة التقديرية', false, 'number'],
      ['notes', 'الوصف']
    ],
    workflows: [
      ['title', 'اسم دورة العمل', true],
      ['steps', 'الخطوات كل سطر خطوة', false, 'textarea'],
      ['notes', 'حد الصلاحية']
    ],
    bookings: [
      ['title', 'الحجز', true],
      ['party_name', 'العميل', true],
      ['period_start', 'البداية', true, 'date'],
      ['period_end', 'النهاية', false, 'date'],
      ['amount', 'القيمة', false, 'number']
    ],
    rentals: [
      ['title', 'الوحدة', true],
      ['party_name', 'المستأجر', true],
      ['amount', 'الإيجار', true, 'number'],
      ['notes', 'المدة']
    ],
    leases: [
      ['title', 'عقد الإيجار', true],
      ['party_name', 'الطرف', true],
      ['amount', 'قيمة العقد', true, 'number'],
      ['period_start', 'البداية', false, 'date'],
      ['period_end', 'النهاية', false, 'date']
    ],
    'time-entries': [
      ['title', 'العمل', true],
      ['project_id', 'رقم المشروع', false, 'number'],
      ['party_name', 'الموظف'],
      ['amount', 'الساعات', true, 'number'],
      ['notes', 'التاريخ']
    ],
    bom: [
      ['title', 'منتج التصنيع', true],
      ['lines', 'المكونات sku,كمية', false, 'textarea'],
      ['notes', 'ملاحظات']
    ]
  };

  const NAV = [
    ['/finance/', 'اللوحة'],
    ['/finance/cost-centers.html', 'مراكز التكلفة'],
    ['/finance/checks.html', 'الشيكات'],
    ['/finance/deposits.html', 'العربون'],
    ['/finance/price-lists.html', 'الأسعار'],
    ['/finance/purchase-requests.html', 'طلبات الشراء'],
    ['/finance/projects.html', 'المشاريع']
  ];

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

  function parseLines(text) {
    return String(text || '').split('\n').map((line) => line.trim()).filter(Boolean).map((line) => {
      const [a, b, c] = line.split(',').map((part) => part.trim());
      return { sku: a, qty: b, price: c };
    });
  }

  function boot() {
    const kind = document.body.dataset.kind;
    const fields = FORMS[kind] || [];
    const form = document.getElementById('form');
    form.innerHTML = fields.map(([name, label, required, type]) => {
      const input = type === 'textarea'
        ? `<textarea name="${name}" rows="3" class="mt-1 w-full border rounded-lg px-3 py-2"></textarea>`
        : `<input name="${name}" type="${type || 'text'}" class="mt-1 w-full border rounded-lg px-3 py-2">`;
      return `<label class="text-sm block">${label}${required ? ' *' : ''}${input}</label>`;
    }).join('') + `<div class="flex gap-2"><button class="bg-slate-900 text-white px-4 py-2 rounded-lg font-bold">حفظ</button><button type="button" id="reset" class="border px-4 py-2 rounded-lg font-bold">جديد</button></div>`;
    document.getElementById('nav').innerHTML = NAV.map(([href, label]) => `<a class="px-3 py-1 rounded-full border font-bold" href="${href}">${label}</a>`).join('');
    let editing = null;
    document.getElementById('reset').onclick = () => { editing = null; form.reset(); };

    function alertMsg(text, ok) {
      const el = document.getElementById('alert');
      el.className = `mb-4 rounded-xl border px-4 py-3 font-bold ${ok ? 'bg-emerald-50 text-emerald-800' : 'bg-rose-50 text-rose-800'}`;
      el.textContent = text;
    }

    async function load() {
      const q = document.getElementById('q').value.trim();
      const extra = q ? `${qs() ? '&' : '?'}q=${encodeURIComponent(q)}` : '';
      const res = await fetch(`/finance/ops/${kind}${qs()}${extra}`, { headers: headers() });
      const data = await res.json();
      if (!res.ok) { alertMsg(data.error || 'فشل التحميل', false); return; }
      const rows = data.records || [];
      document.getElementById('count').textContent = rows.length;
      document.getElementById('empty').classList.toggle('hidden', rows.length > 0);
      document.getElementById('rows').innerHTML = rows.map((row) => `
        <tr class="border-t">
          <td class="p-2 number-en font-bold">${row.record_number}</td>
          <td class="p-2">${row.title || row.party_name || '-'}</td>
          <td class="p-2 number-en">${row.amount}</td>
          <td class="p-2">${row.status}${row.actual_amount != null ? ` / فعلي ${row.actual_amount}` : ''}</td>
          <td class="p-2 whitespace-nowrap">
            <button class="text-sky-700 font-bold" data-edit="${row.record_id}">تعديل ملاحظات</button>
            <button class="text-rose-700 font-bold" data-cancel="${row.record_id}">إلغاء</button>
          </td>
        </tr>`).join('');
      document.querySelectorAll('[data-cancel]').forEach((btn) => {
        btn.onclick = async () => {
          const reason = prompt('سبب الإلغاء');
          if (!reason) return;
          const out = await fetch(`/finance/ops/${kind}/${btn.dataset.cancel}/cancel${qs()}`, {
            method: 'POST', headers: headers(), body: JSON.stringify({ reason, entity_id: entity() || undefined })
          });
          const body = await out.json();
          if (!out.ok) { alertMsg(body.error || 'فشل الإلغاء', false); return; }
          alertMsg('تم الإلغاء', true);
          load();
        };
      });
      document.querySelectorAll('[data-edit]').forEach((btn) => {
        btn.onclick = async () => {
          const notes = prompt('الملاحظات الجديدة');
          if (notes == null) return;
          const out = await fetch(`/finance/ops/${kind}/${btn.dataset.edit}${qs()}`, {
            method: 'PUT', headers: headers(), body: JSON.stringify({ notes, entity_id: entity() || undefined })
          });
          const body = await out.json();
          if (!out.ok) { alertMsg(body.error || 'فشل التعديل', false); return; }
          alertMsg('تم حفظ الملاحظات', true);
          load();
        };
      });
      if (kind === 'loyalty') {
        const bal = await fetch(`/finance/ops/loyalty/balances${qs()}`, { headers: headers() }).then((r) => r.json());
        const box = document.getElementById('extra');
        box.classList.remove('hidden');
        box.innerHTML = `<h2 class="font-extrabold mb-2">أرصدة النقاط</h2>` + ((bal.balances || []).map((b) => `<div>${b.party_name || b.customer_id || '-'} — <span class="number-en">${b.points}</span></div>`).join('') || 'لا أرصدة');
      }
    }

    form.onsubmit = async (event) => {
      event.preventDefault();
      const body = { entity_id: entity() || undefined, payload: {} };
      fields.forEach(([name, , , type]) => {
        const value = form.elements[name].value.trim();
        if (!value) return;
        if (name === 'lines') body.payload.lines = parseLines(value);
        else if (name === 'steps') body.payload.steps = value.split('\n').map((s) => s.trim()).filter(Boolean);
        else if (['move_type', 'to_location', 'period_start', 'period_end', 'percent', 'debit_account_id', 'credit_account_id'].includes(name)) body.payload[name] = type === 'number' ? Number(value) : value;
        else if (type === 'number') body[name] = Number(value);
        else body[name] = value;
      });
      const res = await fetch(`/finance/ops/${kind}${qs()}`, { method: 'POST', headers: headers(), body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) { alertMsg(data.error || 'فشل الحفظ', false); return; }
      alertMsg('تم الحفظ في قاعدة البيانات', true);
      form.reset();
      editing = data.record;
      load();
    };

    const convert = document.getElementById('convert');
    if (convert) {
      convert.onclick = async () => {
        const id = prompt('رقم السجل record_id');
        const vendor_name = prompt('اسم المورد');
        if (!id || !vendor_name) return;
        const res = await fetch(`/finance/ops/purchase-requests/${id}/convert${qs()}`, {
          method: 'POST', headers: headers(), body: JSON.stringify({ vendor_name, entity_id: entity() || undefined })
        });
        const data = await res.json();
        if (!res.ok) { alertMsg(data.error || 'فشل التحويل', false); return; }
        alertMsg(`تم إنشاء أمر الشراء ${data.order.po_number}`, true);
        load();
      };
    }
    const apply = document.getElementById('apply');
    if (apply) {
      apply.onclick = async () => {
        const id = prompt('رقم العربون record_id');
        const invoice_id = prompt('رقم الفاتورة invoice_id');
        if (!id || !invoice_id) return;
        const res = await fetch(`/finance/ops/deposits/${id}/apply${qs()}`, {
          method: 'POST', headers: headers(), body: JSON.stringify({ invoice_id: Number(invoice_id), entity_id: entity() || undefined })
        });
        const data = await res.json();
        if (!res.ok) { alertMsg(data.error || 'فشل التطبيق', false); return; }
        alertMsg(data.message, true);
        load();
      };
    }
    const run = document.getElementById('run');
    if (run) {
      run.onclick = async () => {
        const id = prompt('رقم القاعدة record_id');
        const amount = prompt('المبلغ');
        if (!id || !amount) return;
        const res = await fetch(`/finance/ops/auto-rules/${id}/run${qs()}`, {
          method: 'POST', headers: headers(), body: JSON.stringify({ amount: Number(amount), entity_id: entity() || undefined })
        });
        const data = await res.json();
        if (!res.ok) { alertMsg(data.error || 'فشل التنفيذ', false); return; }
        alertMsg(`قيد ${data.entry_number}`, true);
        load();
      };
    }
    document.getElementById('q').oninput = load;
    load();
  }

  if (window.whenFinanceContextReady) window.whenFinanceContextReady(boot);
  else boot();
})();
