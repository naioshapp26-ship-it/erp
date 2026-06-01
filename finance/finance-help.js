(() => {
  window.financeHelpV2 = true;
  const bookIcon = '<span class="finance-help-label">دليل</span>';

  const addHelpButtonStyles = () => {
    if (document.getElementById('financeHelpButtonStyles')) return;
    const style = document.createElement('style');
    style.id = 'financeHelpButtonStyles';
    style.textContent = `
      .finance-help-button {
        position: fixed;
        top: 64px;
        left: 20px;
        padding: 6px 10px;
        min-width: 92px;
        border-radius: 12px;
        border: 2px solid #dc2626 !important;
        background: #ffffff !important;
        color: #b91c1c !important;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        font-weight: 800;
        font-size: 11px;
        letter-spacing: 0.2px;
        text-align: center;
        box-shadow: 0 10px 24px rgba(15, 23, 42, 0.12);
        z-index: 9999;
        cursor: pointer;
        transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
      }
      .finance-help-button .finance-help-label {
        color: #b91c1c !important;
        font-weight: 800;
        font-size: 11px;
        letter-spacing: 0.2px;
      }
      .finance-help-button:hover {
        transform: translateY(-2px);
        box-shadow: 0 14px 28px rgba(15, 23, 42, 0.18);
        border-color: #b91c1c !important;
      }
      @media (max-width: 640px) {
        .finance-help-button {
          top: 60px;
          left: 12px;
          min-width: 86px;
          padding: 5px 9px;
          font-size: 10px;
        }
      }
    `;
    document.head.appendChild(style);
  };

  const ensureBookIcon = () => {
    document.querySelectorAll('.finance-help-button').forEach((button) => {
      if (button.querySelector('svg')) return;
      button.innerHTML = bookIcon;
    });
  };
  const init = () => {
    const existing = document.getElementById('finance-help-root');
    if (existing) return;

    addHelpButtonStyles();

    const root = document.createElement('div');
    root.id = 'finance-help-root';
    root.className = 'finance-help-root';

    root.innerHTML = `
      <button id="finance-help-button" class="finance-help-button" type="button" aria-label="دليل">
        ${bookIcon}
      </button>
      <div id="finance-help-overlay" class="finance-help-overlay" aria-hidden="true"></div>
      <aside id="finance-help-panel" class="finance-help-panel" role="dialog" aria-modal="true" aria-hidden="true">
        <div class="finance-help-header">
          <div>
            <div id="finance-help-title" class="finance-help-title"></div>
            <div id="finance-help-subtitle" class="finance-help-subtitle"></div>
          </div>
          <button id="finance-help-close" class="finance-help-close" type="button" aria-label="إغلاق الدليل">×</button>
        </div>
        <div id="finance-help-body" class="finance-help-body"></div>
      </aside>
    `;

    document.body.appendChild(root);

    const button = document.getElementById('finance-help-button');
    const panel = document.getElementById('finance-help-panel');
    const titleEl = document.getElementById('finance-help-title');
    const subtitleEl = document.getElementById('finance-help-subtitle');
    const bodyEl = document.getElementById('finance-help-body');
    const closeButton = document.getElementById('finance-help-close');
    const overlay = document.getElementById('finance-help-overlay');

  const titleOverrides = [
    { test: (path) => path === '/finance' || path === '/finance/' || path === '/finance/index.html', title: 'دليل المالية' },
    { test: (path) => path.startsWith('/finance/payments'), title: 'دليل المدفوعات' },
    { test: (path) => path.startsWith('/finance/refunds') || path.includes('return-policy') || path.includes('return-'), title: 'دليل الاسترجاع' },
    { test: (path) => path.startsWith('/finance/revenue') || path.includes('income-statement'), title: 'دليل الإيرادات' },
    { test: (path) => path.startsWith('/finance/invoices') || path.includes('invoice'), title: 'دليل الفواتير' }
  ];

  const cleanTitle = (value) => {
    if (!value) return 'الصفحة الحالية';
    const trimmed = value.split('|')[0].split('-')[0].trim();
    return trimmed.replace(/[^A-Za-z0-9\u0600-\u06FF\s()]/g, '').trim() || 'الصفحة الحالية';
  };

  const resolveTitle = () => {
    const path = window.location.pathname || '';
    const override = titleOverrides.find((item) => item.test(path));
    if (override) return override.title;
    return `دليل ${cleanTitle(document.title)}`;
  };

  const normalizeText = (value) => (value || '').toString().replace(/\s+/g, ' ').trim();

  const getPageTitle = () => {
    const titleNode = document.querySelector('h1');
    const subtitleNode = document.querySelector('h1 + p') || document.querySelector('.container p');
    const title = normalizeText(titleNode ? titleNode.textContent : document.title);
    const subtitle = normalizeText(subtitleNode ? subtitleNode.textContent : '');
    return {
      title: title || 'هذه الصفحة',
      subtitle
    };
  };

  const describeButton = (label) => {
    const normalized = normalizeText(label).toLowerCase();
    if (!normalized) return 'تنفيذ الإجراء الموضح على الزر.';
    if (normalized.includes('اضاف') || normalized.includes('add')) return 'إضافة سجل جديد في الصفحة.';
    if (normalized.includes('تحديث') || normalized.includes('refresh')) return 'تحديث البيانات المعروضة.';
    if (normalized.includes('تنزيل') || normalized.includes('تصدير') || normalized.includes('export')) return 'تصدير البيانات بصيغة مناسبة.';
    if (normalized.includes('طباع') || normalized.includes('print')) return 'طباعة التقرير أو القائمة الحالية.';
    if (normalized.includes('بحث') || normalized.includes('search')) return 'تنفيذ عملية البحث أو التصفية.';
    if (normalized.includes('حفظ') || normalized.includes('save')) return 'حفظ التغييرات أو السجل.';
    if (normalized.includes('اغلاق') || normalized.includes('close')) return 'إغلاق النافذة أو النموذج.';
    if (normalized.includes('اعتماد') || normalized.includes('approve')) return 'اعتماد الطلب أو السجل.';
    if (normalized.includes('ترحيل') || normalized.includes('post')) return 'ترحيل القيود أو المعاملات.';
    if (normalized.includes('تسويه') || normalized.includes('settlement')) return 'إتمام تسوية المبالغ أو الفروقات.';
    return 'تنفيذ الإجراء الموضح على الزر.';
  };

  const collectButtons = () => {
    const labels = [];
    document.querySelectorAll('button').forEach((btn) => {
      const label = normalizeText(btn.textContent);
      if (!label || label.length > 40) return;
      if (!labels.includes(label)) labels.push(label);
    });
    return labels.slice(0, 4).map((label) => `${label}: ${describeButton(label)}`);
  };

  const collectFields = () => {
    const labels = [];
    document.querySelectorAll('label').forEach((labelEl) => {
      const label = normalizeText(labelEl.textContent);
      if (!label || label.length > 40) return;
      if (!labels.includes(label)) labels.push(label);
    });

    if (labels.length < 2) {
      document.querySelectorAll('input[placeholder], textarea[placeholder], select').forEach((input) => {
        const placeholder = normalizeText(input.getAttribute('placeholder'));
        const label = placeholder || normalizeText(input.getAttribute('aria-label'));
        if (!label || label.length > 40) return;
        if (!labels.includes(label)) labels.push(label);
      });
    }

    return labels.slice(0, 4).map((label) => `${label}: لتحديد البيانات أو تصفية النتائج المرتبطة بالحقل.`);
  };

  const buildTips = () => {
    const tips = [];
    if (document.querySelector('table')) {
      tips.push('استخدم الفلاتر قبل التصدير لتقليل النتائج وتحسين الدقة.');
    }
    if (document.querySelector('.stat-card')) {
      tips.push('راجع بطاقات الملخص أعلى الصفحة لمقارنة المؤشرات بسرعة.');
    }
    if (document.querySelector('canvas')) {
      tips.push('تابع الرسوم البيانية لاكتشاف الاتجاهات أو القيم غير الطبيعية.');
    }
    if (!tips.length) {
      tips.push('يمكنك استخدام البحث أعلى الصفحة للوصول السريع للأقسام.');
    }
    tips.push('عند تعديل البيانات، تأكد من الحفظ أو التحديث قبل مغادرة الصفحة.');
    return tips.slice(0, 3);
  };

  const buildHelpSection = (title, items) => {
    const section = document.createElement('div');
    section.className = 'finance-help-section';
    const header = document.createElement('h3');
    header.textContent = title;
    section.appendChild(header);
    const list = document.createElement('ul');
    items.forEach((item) => {
      const li = document.createElement('li');
      li.textContent = item;
      list.appendChild(li);
    });
    section.appendChild(list);
    return section;
  };

  const updateGuide = () => {
    const resolvedTitle = resolveTitle();
    const { title, subtitle } = getPageTitle();
    const label = resolvedTitle || `دليل استخدام: ${title}`;
    const subtitleText = subtitle || 'شرح موجز يساعدك على فهم الصفحة وخطوات الاستخدام.';

    titleEl.textContent = label;
    subtitleEl.textContent = subtitleText;
    button.setAttribute('aria-label', label);

    bodyEl.innerHTML = '';
    const purpose = subtitle
      ? `تُستخدم هذه الصفحة لـ ${title}. ${subtitle}`
      : `تُستخدم هذه الصفحة لـ ${title}.`;

    bodyEl.appendChild(buildHelpSection('الهدف من الصفحة', [purpose]));
    bodyEl.appendChild(buildHelpSection('أهم الإجراءات', collectButtons().length ? collectButtons() : ['لا توجد أزرار تشغيل ظاهرة في هذه الصفحة.']));
    bodyEl.appendChild(buildHelpSection('الحقول والفلاتر', collectFields().length ? collectFields() : ['لا توجد حقول إدخال أو فلاتر بارزة في هذه الصفحة.']));
    bodyEl.appendChild(buildHelpSection('نصائح سريعة', buildTips()));
  };

  const setOpen = (isOpen) => {
    document.body.classList.toggle('finance-help-open', isOpen);
    panel.setAttribute('aria-hidden', String(!isOpen));
    overlay.setAttribute('aria-hidden', String(!isOpen));
  };

  button.addEventListener('click', () => {
    updateGuide();
    setOpen(true);
  });

  closeButton.addEventListener('click', () => setOpen(false));
  overlay.addEventListener('click', () => setOpen(false));
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') setOpen(false);
  });

    ensureBookIcon();
    updateGuide();
  };

  if (document.body) {
    init();
    ensureBookIcon();
    return;
  }

  document.addEventListener('DOMContentLoaded', () => {
    init();
    ensureBookIcon();
  }, { once: true });
})();
