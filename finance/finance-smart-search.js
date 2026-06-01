(function () {
    function ensureGlobalBackAssets() {
        const cssHref = '/public/global-back.css';
        const scriptSrc = '/public/global-back.js';
        if (!document.querySelector(`link[rel="stylesheet"][href="${cssHref}"]`)) {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = cssHref;
            document.head.appendChild(link);
        }
        if (!document.querySelector(`script[src="${scriptSrc}"]`)) {
            const script = document.createElement('script');
            script.src = scriptSrc;
            script.defer = true;
            document.head.appendChild(script);
        }
    }

    const SEARCH_ITEMS = [
        {
            title: 'المالية - الصفحة الرئيسية',
            url: '/finance/index.html',
            category: 'صفحات النظام المالي',
            keywords: ['الرئيسية', 'لوحة التحكم', 'dashboard', 'finance home', 'القائمة الرئيسية']
        },
        {
            title: 'شروط الدفع',
            url: '/finance/payment-terms.html',
            category: 'صفحات النظام المالي',
            keywords: ['شروط الدفع', 'استحقاق', 'غرامات', 'payment terms']
        },
        {
            title: 'الشروط والأحكام',
            url: '/finance/terms-and-conditions.html',
            category: 'صفحات النظام المالي',
            keywords: ['الشروط', 'الأحكام', 'terms', 'conditions']
        },
        {
            title: 'العروض السريعة',
            url: '/finance/quick-offers.html',
            category: 'صفحات النظام المالي',
            keywords: ['عروض', 'سريعة', 'offers', 'flash']
        },
        {
            title: 'ضرائب متعددة',
            url: '/finance/multiple-taxes.html',
            category: 'صفحات النظام المالي',
            keywords: ['ضرائب', 'شرائح', 'taxes', 'multiple']
        },
        {
            title: 'خصومات على العناصر والفواتير',
            url: '/finance/item-invoice-discounts.html',
            category: 'صفحات النظام المالي',
            keywords: ['خصومات', 'عناصر', 'فواتير', 'discounts']
        },
        {
            title: 'خيارات وتفاصيل الشحن',
            url: '/finance/shipping-options-details.html',
            category: 'صفحات النظام المالي',
            keywords: ['شحن', 'خيارات', 'تفاصيل', 'shipping']
        },
        {
            title: 'العربون والدفعات المتقدمة',
            url: '/finance/deposits-advance-payments.html',
            category: 'صفحات النظام المالي',
            keywords: ['عربون', 'دفعات مقدمة', 'advance payments', 'deposit']
        },
        {
            title: 'تسويات المبيعات',
            url: '/finance/sales-settlements.html',
            category: 'صفحات النظام المالي',
            keywords: ['تسويات', 'مبيعات', 'settlements']
        },
        {
            title: 'سياسة الاسترجاع',
            url: '/finance/return-policy.html',
            category: 'صفحات النظام المالي',
            keywords: ['استرجاع', 'إرجاع', 'return policy']
        },
        {
            title: 'إدارة الاستبدال',
            url: '/finance/exchange-management.html',
            category: 'صفحات النظام المالي',
            keywords: ['استبدال', 'إدارة', 'exchange management']
        },
        {
            title: 'سياسة الاستبدال',
            url: '/finance/exchange-policy.html',
            category: 'صفحات النظام المالي',
            keywords: ['سياسة الاستبدال', 'exchange policy']
        },
        {
            title: 'استبدال جزئي / كلي',
            url: '/finance/partial-full-exchange.html',
            category: 'صفحات النظام المالي',
            keywords: ['جزئي', 'كلي', 'partial exchange', 'full exchange']
        },
        {
            title: 'زيادة مبلغ على القيمة',
            url: '/finance/value-increase-adjustment.html',
            category: 'صفحات النظام المالي',
            keywords: ['زيادة', 'فرق القيمة', 'زيادة مبلغ', 'value increase']
        },
        {
            title: 'أجور شحن',
            url: '/finance/shipping-fees.html',
            category: 'صفحات النظام المالي',
            keywords: ['أجور شحن', 'رسوم الشحن', 'shipping fees']
        },
        {
            title: 'دفتر اليومية والأستاذ',
            url: '/finance/journal.html',
            category: 'صفحات النظام المالي',
            keywords: ['قيود', 'دفتر اليومية', 'الأستاذ العام', 'journal', 'general ledger']
        },
        {
            title: 'تفاصيل القيود',
            url: '/finance/journal-lines.html',
            category: 'صفحات النظام المالي',
            keywords: ['سطور القيود', 'تفاصيل القيود', 'journal lines']
        },
        {
            title: 'الميزانية العمومية',
            url: '/finance/balance-sheet.html',
            category: 'صفحات النظام المالي',
            keywords: ['قائمة المركز المالي', 'assets', 'liabilities', 'equity', 'balance sheet']
        },
        {
            title: 'قائمة الدخل',
            url: '/finance/income-statement.html',
            category: 'صفحات النظام المالي',
            keywords: ['income statement', 'الارباح والخسائر', 'الربح']
        },
        {
            title: 'دليل الحسابات',
            url: '/finance/chart-of-accounts.html',
            category: 'صفحات النظام المالي',
            keywords: ['شجرة الحسابات', 'accounts', 'chart of accounts']
        },
        {
            title: 'تصميم شجرة الحسابات والواجهات',
            url: '/finance/chart-accounts-ui-design.html',
            category: 'القوائم داخل النظام المالي',
            keywords: ['تصميم', 'حسابات', 'واجهات', 'ui']
        },
        {
            title: 'أرصدة الحسابات',
            url: '/finance/account-balances.html',
            category: 'صفحات النظام المالي',
            keywords: ['الرصيد', 'account balances']
        },
        {
            title: 'المدفوعات',
            url: '/finance/payments.html',
            category: 'صفحات النظام المالي',
            keywords: ['payments', 'تحصيل', 'سداد', 'إيصال']
        },
        {
            title: 'خطط السداد والتوزيعات',
            url: '/finance/payment-plans.html',
            category: 'صفحات النظام المالي',
            keywords: ['payment plans', 'خطط السداد', 'توزيعات']
        },
        {
            title: 'أقساط خطط السداد',
            url: '/finance/plan-installments.html',
            category: 'صفحات النظام المالي',
            keywords: ['installments', 'أقساط', 'جدولة']
        },
        {
            title: 'الفواتير والتحصيل والميزانيات',
            url: '/finance/invoices-budgets-master.html',
            category: 'القوائم داخل النظام المالي',
            keywords: ['فواتير', 'تحصيل', 'invoice', 'billing']
        },
        {
            title: 'العملاء',
            url: '/finance/customers.html',
            category: 'صفحات النظام المالي',
            keywords: ['customers', 'عملاء', 'حسابات العملاء']
        },
        {
            title: 'المصروفات والموردون',
            url: '/finance/expenses.html',
            category: 'صفحات النظام المالي',
            keywords: ['expenses', 'vendors', 'مصروفات', 'موردين']
        },
        {
            title: 'حسابات البنوك',
            url: '/finance/bank-accounts.html',
            category: 'صفحات النظام المالي',
            keywords: ['bank accounts', 'بنوك', 'حسابات بنكية']
        },
        {
            title: 'الذمم والتحصيل',
            url: '/finance/receivables-collections.html',
            category: 'صفحات النظام المالي',
            keywords: ['receivables', 'collections', 'ذمم', 'تحصيل']
        },
        {
            title: 'أعمار الذمم المدينة',
            url: '/finance/ar-aging.html',
            category: 'صفحات النظام المالي',
            keywords: ['aging', 'ذمم مدينة', 'تصنيف أعمار']
        },
        {
            title: 'ملخص التدفقات',
            url: '/finance/cashflow-summary.html',
            category: 'صفحات النظام المالي',
            keywords: ['cashflow summary', 'تدفقات نقدية', 'ملخص']
        },
        {
            title: 'معاملات التدفق',
            url: '/finance/cashflow-transactions.html',
            category: 'صفحات النظام المالي',
            keywords: ['cashflow transactions', 'تدفقات', 'معاملات']
        },
        {
            title: 'التقرير الشامل للتدفقات',
            url: '/finance/cashflow-comprehensive.html',
            category: 'صفحات النظام المالي',
            keywords: ['cashflow comprehensive', 'تقرير شامل', 'تدفقات شاملة']
        },
        {
            title: 'التدفقات والميزانيات',
            url: '/finance/cashflow-budgets-engine.html',
            category: 'صفحات النظام المالي',
            keywords: ['cashflow budgets', 'تدفقات وميزانيات']
        },
        {
            title: 'التدفقات والمخاطر والتقارير',
            url: '/finance/cashflow-risk-reports.html',
            category: 'صفحات النظام المالي',
            keywords: ['risk reports', 'مخاطر', 'تقارير التدفقات']
        },
        {
            title: 'التنبؤات الذكية',
            url: '/finance/ai-forecasts.html',
            category: 'صفحات النظام المالي',
            keywords: ['ai', 'forecasts', 'توقعات', 'ذكاء اصطناعي']
        },
        {
            title: 'تقييم المخاطر الذكي',
            url: '/finance/ai-risk-scores.html',
            category: 'صفحات النظام المالي',
            keywords: ['ai risk', 'مخاطر', 'تصنيف المخاطر']
        },
        {
            title: 'نماذج المخاطر وخطط الدفع والحوكمة',
            url: '/finance/ai-risk-payment-framework.html',
            category: 'القوائم داخل النظام المالي',
            keywords: ['risk model', 'حوكمة', 'خطط الدفع', 'framework']
        },
        {
            title: 'الميزانيات والانحرافات',
            url: '/finance/budgets.html',
            category: 'صفحات النظام المالي',
            keywords: ['budgets', 'انحرافات', 'موازنة']
        },
        {
            title: 'الأصول الثابتة والإهلاك',
            url: '/finance/fixed-assets.html',
            category: 'صفحات النظام المالي',
            keywords: ['fixed assets', 'depreciation', 'أصول ثابتة', 'إهلاك']
        },
        {
            title: 'الدورة المحاسبية',
            url: '/finance/accounting-cycle.html',
            category: 'صفحات النظام المالي',
            keywords: ['accounting cycle', 'دورة محاسبية']
        },
        {
            title: 'أثر النظام المحاسبي والدورة',
            url: '/finance/accounting-cycle-impact.html',
            category: 'صفحات النظام المالي',
            keywords: ['impact', 'أثر', 'دورة محاسبية']
        },
        {
            title: 'النظام المحاسبي الشمولي',
            url: '/finance/unified-accounting-overview.html',
            category: 'صفحات النظام المالي',
            keywords: ['unified accounting', 'overview', 'نظرة شمولية']
        },
        {
            title: 'تقارير الوضع المالي',
            url: '/finance/financial-reports-ai-journal.html',
            category: 'صفحات النظام المالي',
            keywords: ['financial reports', 'تقارير مالية', 'journal ai']
        },
        {
            title: 'التقارير الاستراتيجية والذكاء المالي',
            url: '/finance/strategic-financial-reports.html',
            category: 'صفحات النظام المالي',
            keywords: ['strategic reports', 'ذكاء مالي', 'تقارير استراتيجية']
        },
        {
            title: 'السياسات المالية الأساسية',
            url: '/finance/financial-policies-framework.html',
            category: 'القوائم داخل النظام المالي',
            keywords: ['policies', 'سياسات', 'حوكمة']
        },
        {
            title: 'إجراءات التشغيل المالي',
            url: '/finance/operations-sop-finance.html',
            category: 'القوائم داخل النظام المالي',
            keywords: ['SOP', 'إجراءات', 'تشغيل مالي']
        },
        {
            title: 'الموافقات والصلاحيات والحوكمة',
            url: '/finance/approvals-roles-governance.html',
            category: 'القوائم داخل النظام المالي',
            keywords: ['approvals', 'roles', 'governance', 'صلاحيات']
        },
        {
            title: 'الحوكمة المالية والصلاحيات',
            url: '/finance/financial-governance-executive.html',
            category: 'صفحات النظام المالي',
            keywords: ['financial governance', 'حوكمة مالية', 'صلاحيات']
        },
        {
            title: 'المخطط التنفيذي للنظام',
            url: '/finance/system-blueprint-execution.html',
            category: 'القوائم داخل النظام المالي',
            keywords: ['blueprint', 'تنفيذ', 'خريطة النظام']
        },
        {
            title: 'النظام الإداري والموارد البشرية',
            url: '/finance/admin-erp-hr.html',
            category: 'القوائم داخل النظام المالي',
            keywords: ['erp', 'hr', 'الموارد البشرية']
        },
        {
            title: 'الصفحة الرئيسية للموارد البشرية',
            url: '/hr',
            category: 'القوائم داخل النظام المالي',
            keywords: ['hr', 'home', 'landing', 'الموارد البشرية']
        },
        {
            title: 'الموظفون المقبولون',
            url: '/finance/accepted-employees.html',
            category: 'القوائم داخل النظام المالي',
            keywords: ['hr', 'الموظفين المقبولين', 'accepted employees']
        },
        {
            title: 'بوابة العمليات والطلبات',
            url: '/finance/hr-portal-workflows.html',
            category: 'القوائم داخل النظام المالي',
            keywords: ['portal', 'requests', 'عمليات', 'طلبات']
        },
        {
            title: 'منظومة المبيعات والحسابات',
            url: '/finance/sales-accounts-operations-mobile.html',
            category: 'القوائم داخل النظام المالي',
            keywords: ['sales', 'operations', 'حسابات', 'مبيعات']
        },
        {
            title: 'التوقيع الإلكتروني',
            url: '/finance/electronic-signature.html',
            category: 'القوائم داخل النظام المالي',
            keywords: ['signature', 'توقيع', 'الكتروني']
        },
        {
            title: 'وكالات فرنشايز',
            url: '/finance/franchise-agencies.html',
            category: 'القوائم داخل النظام المالي',
            keywords: ['franchise', 'وكالات', 'فرنشايز']
        },
        {
            title: 'العقود',
            url: '/finance/contracts.html',
            category: 'القوائم داخل النظام المالي',
            keywords: ['contracts', 'عقود']
        },
        {
            title: 'موظفو الرواتب',
            url: '/finance/payroll-employees.html',
            category: 'صفحات النظام المالي',
            keywords: ['payroll employees', 'موظفين', 'رواتب']
        },
        {
            title: 'مكونات الرواتب',
            url: '/finance/payroll-components.html',
            category: 'صفحات النظام المالي',
            keywords: ['payroll components', 'بدلات', 'استقطاعات']
        },
        {
            title: 'ربط مكونات الرواتب',
            url: '/finance/payroll-assignments.html',
            category: 'صفحات النظام المالي',
            keywords: ['assignments', 'ربط', 'مكونات الرواتب']
        },
        {
            title: 'دورات الرواتب',
            url: '/finance/payroll-runs.html',
            category: 'صفحات النظام المالي',
            keywords: ['payroll runs', 'دورات']
        },
        {
            title: 'كشوف الرواتب',
            url: '/finance/payroll-payslips.html',
            category: 'صفحات النظام المالي',
            keywords: ['payslips', 'كشوف']
        },
        {
            title: 'تقارير الرواتب',
            url: '/finance/payroll-reports.html',
            category: 'صفحات النظام المالي',
            keywords: ['payroll reports', 'تقارير الرواتب']
        },
        {
            title: 'دفعات البنوك للرواتب',
            url: '/finance/payroll-bank-batches.html',
            category: 'صفحات النظام المالي',
            keywords: ['bank batches', 'دفعات بنكية', 'رواتب']
        },
        {
            title: 'ساعات العمل الإضافي',
            url: '/finance/payroll-overtime.html',
            category: 'صفحات النظام المالي',
            keywords: ['overtime', 'ساعات إضافية']
        },
        {
            title: 'التسويات المالية للرواتب',
            url: '/finance/payroll-settlements.html',
            category: 'صفحات النظام المالي',
            keywords: ['settlements', 'تسويات', 'رواتب']
        },
        {
            title: 'تدفقات نقدية شاملة',
            url: '/finance/cashflow-comprehensive.html',
            category: 'أسماء الخدمات',
            keywords: ['خدمة', 'تدفقات شاملة', 'cashflow service']
        },
        {
            title: 'إضافة معاملة مالية',
            url: '/finance/index.html',
            category: 'أسماء الخدمات',
            keywords: ['إضافة', 'معاملة', 'transaction', 'create entry']
        },
        {
            title: 'إضافة قيد محاسبي',
            url: '/finance/journal.html',
            category: 'أسماء الخدمات',
            keywords: ['إضافة قيد', 'قيد محاسبي', 'journal entry']
        },
        {
            title: 'إضافة مدفوعة',
            url: '/finance/payments.html',
            category: 'أسماء الخدمات',
            keywords: ['إضافة مدفوعة', 'payment', 'تحصيل']
        },
        {
            title: 'إنشاء فاتورة',
            url: '/finance/invoices-budgets-master.html',
            category: 'أسماء الخدمات',
            keywords: ['فاتورة', 'invoice', 'billing']
        },
        {
            title: 'إضافة عميل',
            url: '/finance/customers.html',
            category: 'أسماء الخدمات',
            keywords: ['عميل', 'customers', 'create customer']
        },
        {
            title: 'إضافة مصروف',
            url: '/finance/expenses.html',
            category: 'أسماء الخدمات',
            keywords: ['expense', 'مصروف', 'مورد']
        }
    ];

    function normalizeText(value) {
        return value
            .toString()
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[أإآ]/g, 'ا')
            .replace(/ة/g, 'ه')
            .replace(/ى/g, 'ي')
            .replace(/ؤ/g, 'و')
            .replace(/ئ/g, 'ي')
            .replace(/ـ/g, '')
            .replace(/[^\w\u0600-\u06FF\s]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }

    function scoreMatch(query, target) {
        if (!query || !target) return 0;
        if (target.includes(query)) {
            const lengthBonus = Math.min(20, (query.length / Math.max(target.length, 1)) * 20);
            const startBonus = target.startsWith(query) ? 25 : 0;
            return 120 + lengthBonus + startBonus;
        }

        let score = 50;
        let lastIndex = -1;
        for (let i = 0; i < query.length; i += 1) {
            const nextIndex = target.indexOf(query[i], lastIndex + 1);
            if (nextIndex === -1) return 0;
            score -= Math.max(0, nextIndex - lastIndex - 1);
            lastIndex = nextIndex;
        }
        score += query.length * 4;
        return score;
    }

    function getBestScore(query, item) {
        const normalizedQuery = normalizeText(query);
        const normalizedTitle = normalizeText(item.title);
        const normalizedCategory = normalizeText(item.category || '');
        let best = scoreMatch(normalizedQuery, normalizedTitle);
        best = Math.max(best, scoreMatch(normalizedQuery, normalizedCategory) - 10);

        if (Array.isArray(item.keywords)) {
            item.keywords.forEach((keyword) => {
                const normalizedKeyword = normalizeText(keyword);
                const keywordScore = scoreMatch(normalizedQuery, normalizedKeyword);
                if (keywordScore > best) best = keywordScore;
            });
        }

        return best;
    }

    function buildSearchUI() {
        if (document.querySelector('[data-finance-smart-search]')) {
            return null;
        }

        const wrapper = document.createElement('div');
        wrapper.dataset.financeSmartSearch = 'true';
        wrapper.className = 'finance-smart-search mb-6';
        wrapper.innerHTML = `
            <div class="relative">
                <label class="block text-sm font-bold text-slate-700 mb-2">بحث ذكي داخل النظام المالي</label>
                <div class="finance-smart-search-row">
                    <div class="finance-smart-search-input relative">
                        <input id="financeSmartSearchInput" type="text" placeholder="ابحث عن صفحة أو خدمة..." class="w-full border border-slate-300 rounded-xl px-4 py-3 pr-12 focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none text-slate-800" autocomplete="off" />
                        <span class="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400"><i class="fas fa-magnifying-glass"></i></span>
                    </div>
                </div>
                <div id="financeSmartSearchResults" class="hidden absolute z-50 w-full mt-2 bg-white rounded-xl border border-slate-200 shadow-xl overflow-hidden">
                    <ul class="max-h-80 overflow-y-auto" id="financeSmartSearchList"></ul>
                </div>
            </div>
        `;

        return wrapper;
    }

    function insertSearchUI() {
        const container = document.querySelector('.container') || document.body;
        const wrapper = buildSearchUI();
        if (!wrapper) return;

        container.insertBefore(wrapper, container.firstChild);
        document.dispatchEvent(new CustomEvent('finance-search:ready'));
    }

    function renderResults(items, query) {
        const resultsWrapper = document.getElementById('financeSmartSearchResults');
        const list = document.getElementById('financeSmartSearchList');
        if (!resultsWrapper || !list) return;

        list.innerHTML = '';
        if (!query || query.trim().length < 2) {
            resultsWrapper.classList.add('hidden');
            return;
        }

        if (!items.length) {
            list.innerHTML = '<li class="px-4 py-3 text-sm text-slate-500">لا توجد نتائج مطابقة.</li>';
            resultsWrapper.classList.remove('hidden');
            return;
        }

        const fragment = document.createDocumentFragment();
        items.forEach((item) => {
            const li = document.createElement('li');
            li.innerHTML = `
                <a href="${item.url}" class="flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition">
                    <div>
                        <div class="text-sm font-bold text-slate-800">${item.title}</div>
                        <div class="text-xs text-slate-500">${item.category}</div>
                    </div>
                    <i class="fas fa-arrow-left text-slate-300"></i>
                </a>
            `;
            fragment.appendChild(li);
        });

        list.appendChild(fragment);
        resultsWrapper.classList.remove('hidden');
    }

    function setupSearch() {
        const input = document.getElementById('financeSmartSearchInput');
        const resultsWrapper = document.getElementById('financeSmartSearchResults');
        if (!input || !resultsWrapper) return;

        input.addEventListener('input', (event) => {
            const query = event.target.value || '';
            if (query.trim().length < 2) {
                renderResults([], query);
                return;
            }

            const scored = SEARCH_ITEMS.map((item) => ({
                item,
                score: getBestScore(query, item)
            }))
                .filter((entry) => entry.score > 60)
                .sort((a, b) => b.score - a.score)
                .slice(0, 10)
                .map((entry) => entry.item);

            renderResults(scored, query);
        });

        input.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') {
                const first = resultsWrapper.querySelector('a');
                if (first) {
                    event.preventDefault();
                    window.location.href = first.getAttribute('href');
                }
            } else if (event.key === 'Escape') {
                resultsWrapper.classList.add('hidden');
            }
        });

        document.addEventListener('click', (event) => {
            const target = event.target;
            if (!target.closest('[data-finance-smart-search]')) {
                resultsWrapper.classList.add('hidden');
            }
        });
    }

    function addSearchStyles() {
        if (document.getElementById('financeSmartSearchStyles')) return;
        const style = document.createElement('style');
        style.id = 'financeSmartSearchStyles';
        style.textContent = `
            .finance-smart-search input { background-color: #ffffff; }
            .finance-smart-search-row {
                display: flex;
                align-items: center;
                gap: 12px;
                justify-content: flex-start;
                width: 100%;
                flex-wrap: wrap;
            }
            .finance-smart-search-input {
                flex: 1 1 360px;
                max-width: 520px;
                width: min(520px, 100%);
            }
            .finance-smart-search ul::-webkit-scrollbar { width: 6px; }
            .finance-smart-search ul::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 999px; }
        `;
        document.head.appendChild(style);
    }

    function addHelpStyles() {
        if (document.getElementById('financeHelpGuideStyles')) return;
        const style = document.createElement('style');
        style.id = 'financeHelpGuideStyles';
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
                cursor: pointer;
                z-index: 9999;
                transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
            }
            .finance-help-button .finance-help-icon {
                display: none;
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
            .finance-help-overlay {
                position: fixed;
                inset: 0;
                background: rgba(15, 23, 42, 0.5);
                opacity: 0;
                pointer-events: none;
                z-index: 9998;
                transition: opacity 0.2s ease;
            }
            .finance-help-panel {
                position: fixed;
                top: 0;
                right: 0;
                height: 100vh;
                width: min(520px, 92vw);
                background: #ffffff;
                box-shadow: -12px 0 30px rgba(15, 23, 42, 0.2);
                transform: translateX(100%);
                transition: transform 0.25s ease;
                z-index: 9999;
                display: flex;
                flex-direction: column;
            }
            .finance-help-header {
                padding: 20px 24px;
                border-bottom: 1px solid #e2e8f0;
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 12px;
            }
            .finance-help-title {
                font-size: 20px;
                font-weight: 800;
                color: #0f172a;
            }
            .finance-help-close {
                background: transparent;
                border: none;
                font-size: 20px;
                cursor: pointer;
                color: #475569;
            }
            .finance-help-body {
                padding: 20px 24px 28px;
                overflow-y: auto;
                color: #0f172a;
                line-height: 1.7;
            }
            .finance-help-section {
                margin-bottom: 18px;
                padding: 16px 16px 12px;
                border-radius: 16px;
                background: #f8fafc;
                border: 1px solid #e2e8f0;
            }
            .finance-help-section h3 {
                font-size: 16px;
                margin: 0 0 8px;
                color: #ef4444;
            }
            .finance-help-section ul {
                margin: 0;
                padding-inline-start: 18px;
            }
            .finance-help-section li {
                margin-bottom: 6px;
                font-size: 14px;
                color: #1f2937;
            }
            .finance-help-open .finance-help-overlay {
                opacity: 1;
                pointer-events: auto;
            }
            .finance-help-open .finance-help-panel {
                transform: translateX(0);
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
    }

    function getPageTitle() {
        const titleEl = document.querySelector('h1');
        const subtitleEl = document.querySelector('h1 + p') || document.querySelector('.container p');
        const title = titleEl ? titleEl.textContent.trim() : document.title || 'هذه الصفحة';
        const subtitle = subtitleEl ? subtitleEl.textContent.trim() : '';
        return { title, subtitle };
    }

    function normalizeLabel(label) {
        return normalizeText(label || '');
    }

    function describeButton(label) {
        const normalized = normalizeLabel(label);
        if (!normalized) return 'تنفيذ الإجراء الموضح على الزر.';
        if (normalized.includes('اضاف') || normalized.includes('add')) return 'إضافة سجل جديد في الصفحة.';
        if (normalized.includes('تحديث') || normalized.includes('refresh')) return 'تحديث البيانات المعروضة.';
        if (normalized.includes('تنزيل') || normalized.includes('تصدير') || normalized.includes('export') || normalized.includes('csv') || normalized.includes('json') || normalized.includes('pdf')) return 'تصدير البيانات بصيغة مناسبة.';
        if (normalized.includes('طباع') || normalized.includes('print')) return 'طباعة التقرير أو القائمة الحالية.';
        if (normalized.includes('بحث') || normalized.includes('search')) return 'تنفيذ عملية البحث أو التصفية.';
        if (normalized.includes('حفظ') || normalized.includes('save')) return 'حفظ التغييرات أو السجل.';
        if (normalized.includes('اغلاق') || normalized.includes('close')) return 'إغلاق النافذة أو النموذج.';
        if (normalized.includes('اعتماد') || normalized.includes('approve')) return 'اعتماد الطلب أو السجل.';
        if (normalized.includes('ترحيل') || normalized.includes('post')) return 'ترحيل القيود أو المعاملات.';
        if (normalized.includes('تسويه') || normalized.includes('settlement')) return 'إتمام تسوية المبالغ أو الفروقات.';
        return 'تنفيذ الإجراء الموضح على الزر.';
    }

    function collectButtons() {
        const buttons = Array.from(document.querySelectorAll('button'));
        const labels = [];
        buttons.forEach((button) => {
            const label = (button.textContent || '').replace(/\s+/g, ' ').trim();
            if (!label || label.length > 40) return;
            if (!labels.includes(label)) labels.push(label);
        });
        return labels.slice(0, 4).map((label) => `${label}: ${describeButton(label)}`);
    }

    function collectFields() {
        const labels = [];
        const labelElements = Array.from(document.querySelectorAll('label'));
        labelElements.forEach((labelEl) => {
            const label = (labelEl.textContent || '').replace(/\s+/g, ' ').trim();
            if (!label || label.length > 40) return;
            if (!labels.includes(label)) labels.push(label);
        });

        if (labels.length < 2) {
            const inputs = Array.from(document.querySelectorAll('input[placeholder], textarea[placeholder], select'));
            inputs.forEach((input) => {
                const placeholder = (input.getAttribute('placeholder') || '').replace(/\s+/g, ' ').trim();
                const label = placeholder || input.getAttribute('aria-label') || '';
                if (!label || label.length > 40) return;
                if (!labels.includes(label)) labels.push(label);
            });
        }

        return labels.slice(0, 4).map((label) => `${label}: لتحديد البيانات أو تصفية النتائج المرتبطة بالحقل.`);
    }

    function buildTips() {
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
            tips.push('يمكنك استخدام البحث الذكي أعلى الصفحة للوصول السريع للأقسام.');
        }
        tips.push('عند تعديل البيانات، تأكد من الحفظ أو التحديث قبل مغادرة الصفحة.');
        return tips.slice(0, 3);
    }

    function buildHelpContent() {
        const { title, subtitle } = getPageTitle();
        const purpose = subtitle
            ? `تُستخدم هذه الصفحة لـ ${title}. ${subtitle}`
            : `تُستخدم هذه الصفحة لـ ${title}.`;

        const buttons = collectButtons();
        const fields = collectFields();
        const tips = buildTips();

        return {
            title: title.replace(/^\s+|\s+$/g, ''),
            purpose,
            buttons: buttons.length ? buttons : ['لا توجد أزرار تشغيل ظاهرة في هذه الصفحة.'],
            fields: fields.length ? fields : ['لا توجد حقول إدخال أو فلاتر بارزة في هذه الصفحة.'],
            tips
        };
    }

    function buildHelpSection(title, items) {
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
    }

    function initHelpGuide() {
        addHelpStyles();
        if (window.financeHelpV2 || document.getElementById('finance-help-root')) return;
        if (document.querySelector('[data-finance-help-guide]')) return;

        const helpData = buildHelpContent();
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'finance-help-button';
        button.dataset.financeHelpGuide = 'true';
        button.setAttribute('aria-label', 'دليل استخدام الصفحة');
        button.innerHTML = '<span class="finance-help-label">دليل الصفحة</span>';

        const overlay = document.createElement('div');
        overlay.className = 'finance-help-overlay';

        const panel = document.createElement('div');
        panel.className = 'finance-help-panel';

        const header = document.createElement('div');
        header.className = 'finance-help-header';
        const title = document.createElement('div');
        title.className = 'finance-help-title';
        title.textContent = `دليل استخدام: ${helpData.title}`;
        const close = document.createElement('button');
        close.className = 'finance-help-close';
        close.type = 'button';
        close.setAttribute('aria-label', 'إغلاق الدليل');
        close.innerHTML = '&times;';
        header.appendChild(title);
        header.appendChild(close);

        const body = document.createElement('div');
        body.className = 'finance-help-body';
        body.appendChild(buildHelpSection('ما وظيفة الصفحة؟', [helpData.purpose]));
        body.appendChild(buildHelpSection('شرح أهم الأزرار', helpData.buttons));
        body.appendChild(buildHelpSection('شرح الحقول الرئيسية', helpData.fields));
        body.appendChild(buildHelpSection('ملاحظات ونصائح', helpData.tips));

        panel.appendChild(header);
        panel.appendChild(body);

        function openHelp() {
            document.body.classList.add('finance-help-open');
        }

        function closeHelp() {
            document.body.classList.remove('finance-help-open');
        }

        button.addEventListener('click', openHelp);
        close.addEventListener('click', closeHelp);
        overlay.addEventListener('click', closeHelp);
        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape') closeHelp();
        });

        document.body.appendChild(button);
        document.body.appendChild(overlay);
        document.body.appendChild(panel);
    }

    function setupFinancePwa() {
        const manifestUrl = '/finance/manifest.webmanifest?v=20260209';
        const icon192 = '/finance/pwa/icon-192.png?v=20260209';
        const icon512 = '/finance/pwa/icon-512.png?v=20260209';
        const appleTouchIcon = '/finance/pwa/apple-touch-icon-180.png?v=20260209';
        const installSelector = '[data-finance-pwa-install], [data-pwa-install], #finance-pwa-install';
        let deferredPrompt = null;

        const ensureLink = (selector, attributes) => {
            if (document.querySelector(selector)) return;
            const link = document.createElement('link');
            Object.entries(attributes).forEach(([key, value]) => link.setAttribute(key, value));
            document.head.appendChild(link);
        };

        ensureLink('link[rel="manifest"]', { rel: 'manifest', href: manifestUrl });
        ensureLink('link[rel="icon"][sizes="192x192"]', { rel: 'icon', type: 'image/png', sizes: '192x192', href: icon192 });
        ensureLink('link[rel="icon"][sizes="512x512"]', { rel: 'icon', type: 'image/png', sizes: '512x512', href: icon512 });
        ensureLink('link[rel="apple-touch-icon"]', { rel: 'apple-touch-icon', sizes: '180x180', href: appleTouchIcon });

        const isPwaInstalled = () =>
            window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;

        const getInstallInstructions = () => {
            const ua = navigator.userAgent || '';
            const isIOS = /iPad|iPhone|iPod/i.test(ua) && !window.MSStream;
            const isAndroid = /Android/i.test(ua);
            const isEdge = /Edg/i.test(ua);
            const isChrome = /Chrome/i.test(ua) && !isEdge;
            const isSafari = /Safari/i.test(ua) && !isChrome && !isEdge;

            if (isIOS && isSafari) {
                return 'على iPhone أو iPad: افتح زر المشاركة ثم اختر "إضافة إلى الشاشة الرئيسية".';
            }
            if (isAndroid && isChrome) {
                return 'على Android في Chrome: افتح قائمة المتصفح ثم اختر "تثبيت التطبيق".';
            }
            if (isEdge) {
                return 'على Edge: افتح قائمة المتصفح ثم اختر "تثبيت هذا الموقع كتطبيق".';
            }
            if (isChrome) {
                return 'على Chrome: افتح قائمة المتصفح ثم اختر "تثبيت التطبيق".';
            }
            return 'افتح قائمة المتصفح وابحث عن خيار تثبيت التطبيق أو إضافة إلى الشاشة الرئيسية.';
        };

        const startFinancePwaInstall = async () => {
            if (isPwaInstalled()) return;
            if (deferredPrompt) {
                deferredPrompt.prompt();
                await deferredPrompt.userChoice;
                deferredPrompt = null;
                return;
            }
            alert(getInstallInstructions());
        };

        if (!window.startPwaInstall) {
            window.startPwaInstall = startFinancePwaInstall;
        }
        window.financeStartPwaInstall = startFinancePwaInstall;

        window.addEventListener('beforeinstallprompt', (event) => {
            event.preventDefault();
            deferredPrompt = event;
        });

        document.addEventListener('click', (event) => {
            const target = event.target.closest(installSelector);
            if (!target) return;
            event.preventDefault();
            startFinancePwaInstall();
        });

        if ('serviceWorker' in navigator) {
            window.addEventListener('load', async () => {
                try {
                    const registration = await navigator.serviceWorker.register('/finance/sw.js', { scope: '/finance/' });

                    const requestSkipWaiting = () => {
                        if (registration.waiting) {
                            registration.waiting.postMessage({ type: 'SKIP_WAITING' });
                        }
                    };

                    if (registration.waiting) {
                        requestSkipWaiting();
                    }

                    registration.addEventListener('updatefound', () => {
                        const newWorker = registration.installing;
                        if (!newWorker) return;
                        newWorker.addEventListener('statechange', () => {
                            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                                requestSkipWaiting();
                            }
                        });
                    });

                    let refreshing = false;
                    navigator.serviceWorker.addEventListener('controllerchange', () => {
                        if (refreshing) return;
                        refreshing = true;
                        window.location.reload();
                    });
                } catch (error) {
                    console.warn('Finance SW registration failed', error);
                }
            });
        }
    }

    // ── Date-range validation ─────────────────────────────────────────────────
    // Automatically pairs start/end date inputs by naming convention and
    // validates that the end date is never earlier than the start date.
    function initDateRangeValidation() {
        const ERROR_CLASS = 'finance-date-range-error';
        const ERROR_STYLE_ID = 'financeDateRangeErrorStyle';

        if (!document.getElementById(ERROR_STYLE_ID)) {
            const style = document.createElement('style');
            style.id = ERROR_STYLE_ID;
            style.textContent = `
                .${ERROR_CLASS} {
                    display: block;
                    color: #dc2626;
                    font-size: 0.75rem;
                    margin-top: 4px;
                    font-weight: 500;
                }
                input.date-range-invalid {
                    border-color: #dc2626 !important;
                    outline-color: #dc2626 !important;
                }
            `;
            document.head.appendChild(style);
        }

        function getOrCreateError(input) {
            let err = input.parentElement.querySelector('.' + ERROR_CLASS);
            if (!err) {
                err = document.createElement('span');
                err.className = ERROR_CLASS;
                input.parentElement.appendChild(err);
            }
            return err;
        }

        function clearError(input) {
            const err = input.parentElement.querySelector('.' + ERROR_CLASS);
            if (err) err.textContent = '';
            input.classList.remove('date-range-invalid');
            input.setCustomValidity('');
        }

        function showError(input, msg) {
            const err = getOrCreateError(input);
            err.textContent = msg;
            input.classList.add('date-range-invalid');
            input.setCustomValidity(msg);
        }

        function validatePair(startEl, endEl) {
            if (!startEl.value || !endEl.value) {
                clearError(endEl);
                clearError(startEl);
                return true;
            }
            if (endEl.value < startEl.value) {
                showError(endEl, 'تاريخ النهاية لا يمكن أن يكون قبل تاريخ البداية');
                clearError(startEl);
                return false;
            }
            clearError(endEl);
            clearError(startEl);
            return true;
        }

        // Heuristic: match start-like IDs with end-like IDs within the same form
        const startRe = /start|from|begin|date_from|date_start/i;
        const endRe   = /end|to|finish|date_to|date_end/i;

        // Use a WeakSet to avoid duplicating submit listeners on the same form
        const formsWithValidator = new WeakSet();
        // Map each form to all its date-range pairs so the submit handler validates all of them
        const formPairs = new WeakMap();

        const allDateInputs = Array.from(document.querySelectorAll('input[type="date"]'));
        const startInputs = allDateInputs.filter(el => startRe.test(el.id) || startRe.test(el.name || ''));

        startInputs.forEach(startEl => {
            // Only pair inputs that share the same <form> element; skip if no form found
            const form = startEl.closest('form');
            if (!form) return;

            const endEl = Array.from(form.querySelectorAll('input[type="date"]')).find(
                el => el !== startEl && (endRe.test(el.id) || endRe.test(el.name || ''))
            );
            if (!endEl) return;

            startEl.addEventListener('change', () => {
                endEl.min = startEl.value;
                validatePair(startEl, endEl);
            });
            endEl.addEventListener('change', () => validatePair(startEl, endEl));

            // Collect all pairs per form so the submit listener validates all of them
            if (!formPairs.has(form)) {
                formPairs.set(form, []);
            }
            formPairs.get(form).push([startEl, endEl]);

            if (!formsWithValidator.has(form)) {
                formsWithValidator.add(form);
                form.addEventListener('submit', (e) => {
                    const pairs = formPairs.get(form) || [];
                    let firstInvalidEnd = null;
                    pairs.forEach(([s, en]) => {
                        if (!validatePair(s, en) && !firstInvalidEnd) {
                            firstInvalidEnd = en;
                        }
                    });
                    if (firstInvalidEnd) {
                        e.preventDefault();
                        e.stopImmediatePropagation();
                        firstInvalidEnd.focus();
                    }
                }, true);
            }
        });
    }
    // ─────────────────────────────────────────────────────────────────────────

    function init() {
        insertSearchUI();
        addSearchStyles();
        setupSearch();
        initHelpGuide();
        setupFinancePwa();
        initDateRangeValidation();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
