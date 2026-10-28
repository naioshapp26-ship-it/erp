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
    margin_mm: { label_ar: 'هامش الصفحة بالمليمتر', hint_ar: 'المسافة حول محتوى الصفحة المطبوعة.', group_ar: 'العرض والطباعة', widget: 'number', min: 0, max: 40 },
    page_title: { label_ar: 'عنوان الصفحة', hint_ar: 'يظهر كعنوان رئيسي في الصفحة الأصلية فور الحفظ وإعادة التحميل.', group_ar: 'الهوية والعرض', widget: 'text' },
    page_subtitle: { label_ar: 'وصف الصفحة', hint_ar: 'الجملة التعريفية تحت العنوان في الصفحة الأصلية.', group_ar: 'الهوية والعرض', widget: 'text' },
    custom_section_title: { label_ar: 'عنوان قسم إضافي', hint_ar: 'قسم يظهر في أعلى الصفحة عند تعبئة النص.', group_ar: 'أقسام إضافية', widget: 'text' },
    custom_section_text: { label_ar: 'نص القسم الإضافي', hint_ar: 'محتوى القسم الإضافي على الصفحة الأصلية. فارغ = إخفاء القسم.', group_ar: 'أقسام إضافية', widget: 'text' },
    print_footer: { label_ar: 'تذييل الطباعة', hint_ar: 'يظهر أسفل الصفحة عند الطباعة/PDF.', group_ar: 'العرض والطباعة', widget: 'text' },
    require_reason: { label_ar: 'إلزامية سبب الإضافي', hint_ar: 'يمنع حفظ طلب الإضافي دون سبب.', group_ar: 'القواعد', widget: 'boolean' },
    allow_overlap: { label_ar: 'السماح بتداخل الأوقات', hint_ar: 'عند الإيقاف يُرفض أي تداخل لنفس الموظف واليوم.', group_ar: 'القواعد', widget: 'boolean' },
    default_day_type: { label_ar: 'نوع اليوم الافتراضي', hint_ar: 'NORMAL أو WEEKEND أو HOLIDAY.', group_ar: 'القواعد', widget: 'choice', options: [{ value: 'NORMAL', label_ar: 'عادي' }, { value: 'WEEKEND', label_ar: 'عطلة أسبوعية' }, { value: 'HOLIDAY', label_ar: 'إجازة رسمية' }] },
    show_department: { label_ar: 'إظهار عمود القسم', hint_ar: 'في جدول ساعات الإضافي.', group_ar: 'الأعمدة', widget: 'boolean' },
    show_day_type: { label_ar: 'إظهار عمود نوع اليوم', hint_ar: 'في جدول ساعات الإضافي.', group_ar: 'الأعمدة', widget: 'boolean' },
    show_rate_column: { label_ar: 'إظهار سعر الساعة', hint_ar: 'في معاينة السجل.', group_ar: 'الأعمدة', widget: 'boolean' },
    show_reason_column: { label_ar: 'إظهار عمود السبب في الجدول', hint_ar: 'يعرض مقتطف السبب في القائمة.', group_ar: 'الأعمدة', widget: 'boolean' },
    show_btn_policy: { label_ar: 'إظهار زر سياسة الاحتساب', hint_ar: 'في شريط إجراءات صفحة الإضافي.', group_ar: 'الأزرار', widget: 'boolean' },
    show_btn_excel: { label_ar: 'إظهار زر Excel', hint_ar: 'في شريط الإجراءات.', group_ar: 'الأزرار', widget: 'boolean' },
    show_btn_csv: { label_ar: 'إظهار زر CSV', hint_ar: 'في شريط الإجراءات.', group_ar: 'الأزرار', widget: 'boolean' },
    show_btn_print: { label_ar: 'إظهار زر الطباعة', hint_ar: 'في شريط الإجراءات.', group_ar: 'الأزرار', widget: 'boolean' },
    show_btn_expand: { label_ar: 'إظهار أزرار توسيع/طي', hint_ar: 'في شجرة الحسابات.', group_ar: 'الأزرار', widget: 'boolean' },
    show_btn_add_employee: { label_ar: 'إظهار زر إضافة موظف', hint_ar: 'في كشوف الرواتب.', group_ar: 'الأزرار', widget: 'boolean' },
    export_excel: { label_ar: 'السماح بتصدير Excel', hint_ar: 'عند الإيقاف يُرفض التصدير من الواجهة والـAPI.', group_ar: 'التصدير', widget: 'boolean' },
    export_csv: { label_ar: 'السماح بتصدير CSV', hint_ar: 'عند الإيقاف يُرفض التصدير.', group_ar: 'التصدير', widget: 'boolean' },
    export_pdf: { label_ar: 'السماح بتصدير PDF', hint_ar: 'عند الإيقاف يُخفى زر PDF.', group_ar: 'التصدير', widget: 'boolean' },
    tax_pct: { label_ar: 'نسبة الضريبة على الإجمالي', hint_ar: 'قابلة للضبط حسب الدولة. لا تُفترض من نموذج Excel وحده.', group_ar: 'قواعد الرواتب حسب الدولة', widget: 'number', min: 0, max: 100 },
    insurance_pct: { label_ar: 'نسبة التأمينات', hint_ar: 'من الأساس المحدد (غالبًا الأساسي). السعودية/الأردن قابلان للضبط.', group_ar: 'قواعد الرواتب حسب الدولة', widget: 'number', min: 0, max: 100 },
    payroll_country: { label_ar: 'دولة قواعد الرواتب', hint_ar: 'SA أو JO أو CUSTOM — يضبط الافتراضات دون افتراض امتثال قانوني.', group_ar: 'قواعد الرواتب حسب الدولة', widget: 'choice', options: [{ value: 'SA', label_ar: 'السعودية' }, { value: 'JO', label_ar: 'الأردن' }, { value: 'CUSTOM', label_ar: 'مخصص' }] },
    insurance_sign: { label_ar: 'إشارة التأمينات في المسير', hint_ar: 'negative يطابق نموذج مليكة (قيمة سالبة في العمود).', group_ar: 'قواعد الرواتب حسب الدولة', widget: 'choice', options: [{ value: 'negative', label_ar: 'سالب (كما في Excel)' }, { value: 'positive', label_ar: 'موجب' }] },
    insurance_base: { label_ar: 'أساس احتساب التأمينات', hint_ar: 'base_salary أو gross_amount.', group_ar: 'قواعد الرواتب حسب الدولة', widget: 'choice', options: [{ value: 'base_salary', label_ar: 'الراتب الأساسي' }, { value: 'gross_amount', label_ar: 'إجمالي الراتب' }] },
    bank_file_format: { label_ar: 'صيغة الملف البنكي', hint_ar: 'قابلة للضبط — لا يُفترض الامتثال من النموذج وحده.', group_ar: 'الملف البنكي', widget: 'choice', options: [{ value: 'NONE', label_ar: 'بدون' }, { value: 'SA_WPS', label_ar: 'سعودي WPS/مدد' }, { value: 'JO_BANK', label_ar: 'أردني بنكي' }] },
    bank_file_note: { label_ar: 'ملاحظة الملف البنكي', hint_ar: 'تظهر في الإعدادات والتنبيهات.', group_ar: 'الملف البنكي', widget: 'text' },
    default_allowances: { label_ar: 'بدل مواصلات افتراضي', hint_ar: 'يُستخدم عند غياب بدل المواصلات على بطاقة الموظف.', group_ar: 'قواعد الرواتب', widget: 'number', min: 0 },
    ot_fold_into: { label_ar: 'طي الإضافي المعتمد', hint_ar: 'other_allowances يضيف للإجمالي دون كسر ترتيب أعمدة مليكة.', group_ar: 'قواعد الرواتب', widget: 'choice', options: [{ value: 'other_allowances', label_ar: 'ضمن بدلات أخرى' }, { value: 'detail_only', label_ar: 'تفصيل فقط دون طي' }] },
    run_type_label: { label_ar: 'نوع المسير', hint_ar: 'مثل: المسير العام.', group_ar: 'الترويسة', widget: 'text' },
    payroll_title_template: { label_ar: 'قالب عنوان المسير', hint_ar: 'استخدم {date} و {run_type}.', group_ar: 'الترويسة', widget: 'text' },
    excluded_title_template: { label_ar: 'قالب عنوان المستبعدين', hint_ar: 'استخدم {date} و {run_type}.', group_ar: 'الترويسة', widget: 'text' },
    print_orientation: { label_ar: 'اتجاه الطباعة', hint_ar: 'أفقي موصى به لـ 13 عمودًا.', group_ar: 'العرض والطباعة', widget: 'choice', options: [{ value: 'landscape', label_ar: 'أفقي' }, { value: 'portrait', label_ar: 'عمودي' }] },
    print_header: { label_ar: 'ترويسة الطباعة', hint_ar: 'نص إضافي أعلى المسير المطبوع.', group_ar: 'العرض والطباعة', widget: 'text' },
    expense_account_code: { label_ar: 'رمز حساب مصروف الرواتب', hint_ar: 'يُستخدم في القيد المحاسبي عند الترحيل.', group_ar: 'الربط المحاسبي', widget: 'text' },
    payable_account_code: { label_ar: 'رمز حساب الرواتب المستحقة', hint_ar: 'يُستخدم في القيد المحاسبي عند الترحيل.', group_ar: 'الربط المحاسبي', widget: 'text' },
    deductions_account_code: { label_ar: 'رمز حساب الاستقطاعات', hint_ar: 'اختياري. فارغ = يُضاف للاستحقاق.', group_ar: 'الربط المحاسبي', widget: 'text' },
    require_approval_before_post: { label_ar: 'الاعتماد قبل الترحيل', hint_ar: 'يمنع الترحيل المحاسبي من المسودة.', group_ar: 'الاعتماد', widget: 'boolean' },
    bank_transfer_enabled: { label_ar: 'تفعيل مسار التحويل البنكي', hint_ar: 'عرض فقط حتى اعتماد صرف صريح لاحقًا.', group_ar: 'الصرف', widget: 'boolean' },
    show_btn_import: { label_ar: 'إظهار زر استيراد نموذج مليكة', hint_ar: 'في شريط إجراءات كشوف الرواتب.', group_ar: 'الأزرار', widget: 'boolean' },
    show_col_employee_code: { label_ar: 'عمود الرقم الوظيفي', hint_ar: 'ترتيب مليكة #1.', group_ar: 'أعمدة نموذج مليكة', widget: 'boolean' },
    show_col_name: { label_ar: 'عمود اسم الموظف', hint_ar: 'ترتيب مليكة #2.', group_ar: 'أعمدة نموذج مليكة', widget: 'boolean' },
    show_col_department: { label_ar: 'عمود الادارة/القسم', hint_ar: 'ترتيب مليكة #3.', group_ar: 'أعمدة نموذج مليكة', widget: 'boolean' },
    show_col_nationality: { label_ar: 'عمود الجنسية', hint_ar: 'ترتيب مليكة #4.', group_ar: 'أعمدة نموذج مليكة', widget: 'boolean' },
    show_col_base: { label_ar: 'عمود الراتب الأساسي', hint_ar: 'ترتيب مليكة #5.', group_ar: 'أعمدة نموذج مليكة', widget: 'boolean' },
    show_col_housing: { label_ar: 'عمود بدل سكن', hint_ar: 'ترتيب مليكة #6.', group_ar: 'أعمدة نموذج مليكة', widget: 'boolean' },
    show_col_nature: { label_ar: 'عمود بدل طبيعة عمل', hint_ar: 'ترتيب مليكة #7.', group_ar: 'أعمدة نموذج مليكة', widget: 'boolean' },
    show_col_transport: { label_ar: 'عمود بدل مواصلات', hint_ar: 'ترتيب مليكة #8.', group_ar: 'أعمدة نموذج مليكة', widget: 'boolean' },
    show_col_other: { label_ar: 'عمود بدلات اخرى', hint_ar: 'ترتيب مليكة #9.', group_ar: 'أعمدة نموذج مليكة', widget: 'boolean' },
    show_col_gross: { label_ar: 'عمود إجمالي الراتب', hint_ar: 'ترتيب مليكة #10.', group_ar: 'أعمدة نموذج مليكة', widget: 'boolean' },
    show_col_insurance: { label_ar: 'عمود التأمينات الاجتماعية', hint_ar: 'ترتيب مليكة #11.', group_ar: 'أعمدة نموذج مليكة', widget: 'boolean' },
    show_col_advance: { label_ar: 'عمود استقطاع سلفة', hint_ar: 'ترتيب مليكة #12.', group_ar: 'أعمدة نموذج مليكة', widget: 'boolean' },
    show_col_net: { label_ar: 'عمود صافي المبلغ', hint_ar: 'ترتيب مليكة #13.', group_ar: 'أعمدة نموذج مليكة', widget: 'boolean' },
    show_col_allowances: { label_ar: 'إظهار بدلات مجمّعة (قديم)', hint_ar: 'عرض موسع اختياري — لا يغيّر ترتيب مليكة.', group_ar: 'عرض موسع', widget: 'boolean' },
    show_col_incentives: { label_ar: 'إظهار الحوافز (موسّع)', hint_ar: 'تفصيل إضافي خارج الأعمدة الـ13.', group_ar: 'عرض موسع', widget: 'boolean' },
    show_col_overtime: { label_ar: 'إظهار الإضافي (موسّع)', hint_ar: 'تفصيل ساعات إضافية دون كسر النموذج.', group_ar: 'عرض موسع', widget: 'boolean' },
    show_col_deductions: { label_ar: 'إظهار ملخص استقطاعات', hint_ar: 'عرض مساعد بجانب النموذج.', group_ar: 'عرض موسع', widget: 'boolean' },
    show_english_name: { label_ar: 'إظهار الاسم الإنجليزي', hint_ar: 'بجانب الاسم العربي في الشجرة.', group_ar: 'الأعمدة', widget: 'boolean' },
    show_balances: { label_ar: 'إظهار الأرصدة', hint_ar: 'أرصدة محسوبة من القيود.', group_ar: 'الأعمدة', widget: 'boolean' },
    show_inactive: { label_ar: 'إظهار الحسابات المعطّلة افتراضيًا', hint_ar: 'عند التحميل الأول للشجرة.', group_ar: 'الأعمدة', widget: 'boolean' },
    expand_levels: { label_ar: 'مستويات التوسيع الافتراضية', hint_ar: 'كم مستوى يُفتح عند فتح الشجرة.', group_ar: 'العرض', widget: 'number', min: 1, max: 8 },
    require_approval_for_edit: { label_ar: 'اعتماد لتعديل الحسابات الحساسة', hint_ar: 'يتطلب صلاحية اعتماد دليل الحسابات.', group_ar: 'الاعتماد', widget: 'boolean' }
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
