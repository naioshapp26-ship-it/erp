'use strict';

/**
 * Arabic labels for finance settings. Storage keys stay in code.
 * Browser and Node share this file.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.NAIOSH_FIELD_LABELS = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const CURRENCIES = [
    { code: 'EGP', name_ar: 'جنيه مصري', countries: ['مصر'] },
    { code: 'SAR', name_ar: 'ريال سعودي', countries: ['السعودية'] },
    { code: 'AED', name_ar: 'درهم إماراتي', countries: ['الإمارات'] },
    { code: 'IQD', name_ar: 'دينار عراقي', countries: ['العراق'] },
    { code: 'KWD', name_ar: 'دينار كويتي', countries: ['الكويت'] },
    { code: 'JOD', name_ar: 'دينار أردني', countries: ['الأردن'] },
    { code: 'QAR', name_ar: 'ريال قطري', countries: ['قطر'] },
    { code: 'BHD', name_ar: 'دينار بحريني', countries: ['البحرين'] },
    { code: 'OMR', name_ar: 'ريال عماني', countries: ['عُمان'] },
    { code: 'LYD', name_ar: 'دينار ليبي', countries: ['ليبيا'] },
    { code: 'TND', name_ar: 'دينار تونسي', countries: ['تونس'] },
    { code: 'DZD', name_ar: 'دينار جزائري', countries: ['الجزائر'] },
    { code: 'MAD', name_ar: 'درهم مغربي', countries: ['المغرب'] },
    { code: 'SDG', name_ar: 'جنيه سوداني', countries: ['السودان'] },
    { code: 'YER', name_ar: 'ريال يمني', countries: ['اليمن'] },
    { code: 'USD', name_ar: 'دولار أمريكي', countries: ['الولايات المتحدة'] },
    { code: 'EUR', name_ar: 'يورو', countries: ['الاتحاد الأوروبي', 'ألمانيا', 'فرنسا'] },
    { code: 'GBP', name_ar: 'جنيه إسترليني', countries: ['المملكة المتحدة'] },
    { code: 'CHF', name_ar: 'فرنك سويسري', countries: ['سويسرا'] },
    { code: 'TRY', name_ar: 'ليرة تركية', countries: ['تركيا'] },
    { code: 'CNY', name_ar: 'يوان صيني', countries: ['الصين'] },
    { code: 'JPY', name_ar: 'ين ياباني', countries: ['اليابان'] },
    { code: 'INR', name_ar: 'روبية هندية', countries: ['الهند'] },
    { code: 'CAD', name_ar: 'دولار كندي', countries: ['كندا'] },
    { code: 'AUD', name_ar: 'دولار أسترالي', countries: ['أستراليا'] }
  ];

  const FIELDS = {
    number_prefix: { label_ar: 'بادئة ترقيم المستند', hint_ar: 'حروف تسبق الرقم المتسلسل، مثل INV.', group_ar: 'الترقيم', widget: 'text' },
    due_days: { label_ar: 'مدة استحقاق الفاتورة بالأيام', hint_ar: 'تُحسب من تاريخ الفاتورة عندما لا يُدخل تاريخ استحقاق.', group_ar: 'الاستحقاق والضريبة', widget: 'number', min: 0 },
    validity_days: { label_ar: 'مدة صلاحية العرض بالأيام', hint_ar: 'عدد الأيام التي يبقى فيها عرض السعر ساريًا.', group_ar: 'الاستحقاق والضريبة', widget: 'number', min: 0 },
    default_tax_pct: { label_ar: 'نسبة الضريبة الافتراضية', hint_ar: 'تُستخدم عندما لا يحدد سطر الفاتورة نسبة مختلفة.', group_ar: 'الاستحقاق والضريبة', widget: 'number', min: 0, max: 100 },
    require_customer: { label_ar: 'إلزامية تحديد العميل', hint_ar: 'يمنع حفظ الفاتورة أو العرض دون عميل.', group_ar: 'الأطراف والسداد', widget: 'boolean' },
    require_vendor: { label_ar: 'إلزامية تحديد المورد', hint_ar: 'يمنع حفظ المستند دون مورد.', group_ar: 'الأطراف والسداد', widget: 'boolean' },
    require_po_link: { label_ar: 'إلزامية الربط بأمر شراء', hint_ar: 'يُحفظ الإعداد. ربط فاتورة المشتريات بالأمر ما زال مراجعة يدوية.', group_ar: 'الأطراف والسداد', widget: 'boolean' },
    require_account: { label_ar: 'إلزامية تحديد الحساب', hint_ar: 'السند يحتاج حسابًا من الدليل.', group_ar: 'الأطراف والسداد', widget: 'boolean' },
    require_description: { label_ar: 'إلزامية الوصف', hint_ar: 'لا يُحفظ القيد أو السند دون بيان.', group_ar: 'القيود', widget: 'boolean' },
    require_balanced: { label_ar: 'إلزامية توازن القيد', hint_ar: 'مجموع المدين يجب أن يساوي مجموع الدائن.', group_ar: 'القيود', widget: 'boolean' },
    require_original_invoice: { label_ar: 'إلزامية الفاتورة الأصلية', hint_ar: 'الإشعار يجب أن يشير إلى فاتورة قائمة.', group_ar: 'الأطراف والسداد', widget: 'boolean' },
    require_tax_number: { label_ar: 'إلزامية الرقم الضريبي', hint_ar: 'يُطبَّق عند إنشاء العميل أو المورد.', group_ar: 'الأطراف والسداد', widget: 'boolean' },
    require_phone: { label_ar: 'إلزامية رقم الهاتف', hint_ar: 'يُطبَّق عند إنشاء العميل أو المورد.', group_ar: 'الأطراف والسداد', widget: 'boolean' },
    require_email: { label_ar: 'إلزامية البريد الإلكتروني', hint_ar: 'يُطبَّق عند إنشاء العميل.', group_ar: 'الأطراف والسداد', widget: 'boolean' },
    require_sku: { label_ar: 'إلزامية رمز الصنف', hint_ar: 'سجل الأصناف التشغيلي يطلب الرمز بالفعل.', group_ar: 'المخزون', widget: 'boolean' },
    allow_partial_payment_default: { label_ar: 'السماح بالسداد الجزئي', hint_ar: 'القيمة الافتراضية للفواتير الجديدة.', group_ar: 'الأطراف والسداد', widget: 'boolean' },
    allow_installments_default: { label_ar: 'السماح بالتقسيط', hint_ar: 'القيمة الافتراضية للفواتير الجديدة.', group_ar: 'الأطراف والسداد', widget: 'boolean' },
    allow_future_dates: { label_ar: 'السماح بتاريخ قيد لاحق', hint_ar: 'يُحفظ الإعداد. إنشاء القيد الحالي لا يمنعه بعد.', group_ar: 'القيود', widget: 'boolean' },
    allow_negative_stock: { label_ar: 'السماح بالرصيد السالب', hint_ar: 'سياسة المخزون الحالية تمنع الرصيد السالب حتى لو فُعّل هذا الخيار.', group_ar: 'المخزون', widget: 'boolean' },
    track_inventory: { label_ar: 'تتبع المخزون افتراضيًا', hint_ar: 'يُحفظ الإعداد. حركة المخزون تُحدد من نوع الصنف عند إنشائه.', group_ar: 'المخزون', widget: 'boolean' },
    approval_required: { label_ar: 'إلزامية الاعتماد قبل الاستلام', hint_ar: 'استلام المخزون لا يزيد الرصيد إلا لأمر معتمد.', group_ar: 'الاعتماد', widget: 'boolean' },
    auto_convert_to_invoice: { label_ar: 'تحويل العرض إلى فاتورة تلقائيًا', hint_ar: 'يُحفظ الإعداد. التحويل التلقائي غير مفعّل بعد.', group_ar: 'الاعتماد', widget: 'boolean' },
    auto_journal: { label_ar: 'إنشاء قيد تلقائي', hint_ar: 'يُحفظ الإعداد. ترحيل الإشعار ما زال حسب مسار الفاتورة الحالي.', group_ar: 'القيود', widget: 'boolean' },
    footer_text: { label_ar: 'النص أسفل المستند', hint_ar: 'يظهر في الطباعة عند ربط القالب. يُحفظ مع الإعداد.', group_ar: 'العرض والطباعة', widget: 'text' },
    default_currency: { label_ar: 'العملة الافتراضية', hint_ar: 'اختر الاسم العربي. الرمز الدولي يُحفظ في قاعدة البيانات. الاختيار لا يحوّل المبالغ.', group_ar: 'العملة', widget: 'currency' },
    default_payment_terms_days: { label_ar: 'مهلة السداد الافتراضية بالأيام', hint_ar: 'تُقترح للعميل أو المورد الجديد.', group_ar: 'الاستحقاق والضريبة', widget: 'number', min: 0 },
    default_credit_limit: { label_ar: 'الحد الائتماني الافتراضي', hint_ar: 'بالعملة الافتراضية للكيان. صفر يعني دون حد مقترح.', group_ar: 'الأطراف والسداد', widget: 'number', min: 0 },
    paper_size: { label_ar: 'مقاس الورق', hint_ar: 'مقاس صفحة الطباعة.', group_ar: 'العرض والطباعة', widget: 'choice', options: [{ value: 'A4', label_ar: 'A4' }, { value: 'A5', label_ar: 'A5' }, { value: 'Letter', label_ar: 'Letter' }] },
    show_logo: { label_ar: 'إظهار الشعار', hint_ar: 'عند الطباعة إذا كان للشركة شعار محفوظ.', group_ar: 'العرض والطباعة', widget: 'boolean' },
    show_company_name: { label_ar: 'إظهار اسم الشركة', hint_ar: 'في ترويسة المستند المطبوع.', group_ar: 'العرض والطباعة', widget: 'boolean' },
    show_tax_number: { label_ar: 'إظهار الرقم الضريبي', hint_ar: 'في ترويسة المستند المطبوع.', group_ar: 'العرض والطباعة', widget: 'boolean' },
    margin_mm: { label_ar: 'هامش الصفحة بالمليمتر', hint_ar: 'المسافة حول محتوى الصفحة المطبوعة.', group_ar: 'العرض والطباعة', widget: 'number', min: 0, max: 40 }
  };

  function currencyByCode(code) {
    const normalized = String(code || '').trim().toUpperCase();
    return CURRENCIES.find((row) => row.code === normalized) || null;
  }

  function currencyLabel(row) {
    const place = row.countries.length === 1 ? row.countries[0] + ' — ' : '';
    return place + row.name_ar + ' (' + row.code + ')';
  }

  function fieldMeta(name, sample) {
    const known = FIELDS[name];
    if (known) {
      return {
        label_ar: known.label_ar,
        hint_ar: known.hint_ar,
        group_ar: known.group_ar,
        widget: known.widget,
        min: known.min,
        max: known.max,
        options: known.widget === 'currency'
          ? CURRENCIES.map((row) => ({ value: row.code, label_ar: currencyLabel(row), search: (row.countries.join(' ') + ' ' + row.name_ar + ' ' + row.code).toLowerCase() }))
          : (known.options || null)
      };
    }
    const type = typeof sample === 'boolean' ? 'boolean' : typeof sample === 'number' ? 'number' : 'string';
    return {
      label_ar: 'إعداد محفوظ',
      hint_ar: 'هذا الحقل بلا تسمية عربية بعد.',
      group_ar: 'إعدادات أخرى',
      widget: type === 'boolean' ? 'boolean' : type === 'number' ? 'number' : 'text',
      min: null,
      max: null,
      options: null
    };
  }

  function validateField(name, value, sample) {
    const meta = fieldMeta(name, sample);
    if (meta.widget === 'boolean') {
      if (typeof value !== 'boolean') return 'قيمة «' + meta.label_ar + '» يجب أن تكون نعم أو لا.';
      return null;
    }
    if (meta.widget === 'number') {
      const n = Number(value);
      if (!Number.isFinite(n)) return 'أدخل رقمًا في «' + meta.label_ar + '».';
      if (meta.min != null && n < meta.min) return '«' + meta.label_ar + '» أقل من المسموح.';
      if (meta.max != null && n > meta.max) return '«' + meta.label_ar + '» أعلى من المسموح.';
      return null;
    }
    if (meta.widget === 'currency') {
      if (!currencyByCode(value)) return 'اختر العملة من القائمة. كتابة الرمز وحدها غير كافية إذا لم تكن ضمن العملات المعتمدة.';
      return null;
    }
    if (meta.widget === 'choice') {
      const ok = (meta.options || []).some((option) => option.value === value);
      if (!ok) return 'اختر قيمة معتمدة في «' + meta.label_ar + '».';
      return null;
    }
    if (value != null && typeof value !== 'string') return 'نص «' + meta.label_ar + '» غير صالح.';
    return null;
  }

  return { CURRENCIES, FIELDS, currencyByCode, currencyLabel, fieldMeta, validateField };
});
