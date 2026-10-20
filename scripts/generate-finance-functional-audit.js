'use strict';

const fs = require('fs');
const path = require('path');
const catalog = require('../finance/finance-leadership-360-catalog.js');

function analyzeFile(href) {
  if (!href) {
    return {
      opens: true,
      ui: 'coming_soon',
      api: 'none',
      storage: 'none',
      crud: false,
      create: false,
      update: false,
      del: false,
      simulated: false,
      file: null
    };
  }
  const rel = href.replace(/^\//, '');
  const full = path.join('/workspace', rel);
  if (!fs.existsSync(full)) {
    return {
      opens: false,
      ui: 'missing',
      api: 'none',
      storage: 'none',
      crud: false,
      create: false,
      update: false,
      del: false,
      simulated: false,
      file: rel
    };
  }
  const src = fs.readFileSync(full, 'utf8');
  const hasFetch = /fetch\s*\(/.test(src);
  const hasApi = /\/finance\/[a-z0-9\-]+/i.test(src);
  const hasPost = /method:\s*['"]POST['"]/i.test(src);
  const hasPut = /method:\s*['"]PUT['"]/i.test(src);
  const hasDelete = /method:\s*['"]DELETE['"]/i.test(src);
  const lsData = /localStorage\.(getItem|setItem)\s*\(\s*['"](?!authToken|user|nayosh)/.test(src);
  const simAction = /محاكاة/.test(src);
  const comingSoonPage =
    href.includes('leadership-coming-soon') ||
    (/leadership-coming-soon/.test(src) && /قيد التطوير/.test(src) && !hasPost);

  let ui = 'real';
  let storage = hasApi || hasFetch ? 'postgres' : 'none';
  let api = hasPost || hasPut || hasDelete ? 'crud' : hasFetch || hasApi ? 'read' : 'none';

  if (comingSoonPage) {
    ui = 'coming_soon';
    api = 'none';
    storage = 'none';
  }
  if (lsData && !hasPost) {
    ui = 'placeholder';
    storage = 'localStorage';
    api = 'none';
  }

  return {
    opens: true,
    ui,
    api,
    storage,
    crud: hasPost || hasPut || hasDelete,
    create: hasPost,
    update: hasPut,
    del: hasDelete,
    simulated: simAction,
    file: rel
  };
}

const overrides = {
  'sales.invoices-quotes': {
    note:
      'P1: إنشاء فاتورة + سداد/خطة عبر API مثبت باختبار HTTP→DB. قسم الميزانيات في نفس الصفحة ما زال عرضًا فقط.',
    functional: 'working',
    missing: 'إنشاء/تعديل ميزانية من نفس الصفحة (اختياري لاحقًا)'
  },
  'sales.collection': {
    note: 'P1: تخصيص إلزامي على الفاتورة عند إنشاء الدفعة (ADVANCE-B) — مثبت باختبار',
    functional: 'working'
  },
  'sales.offers-discounts': {
    functional: 'working',
    note: 'P2: حفظ Postgres عبر /finance/item-discounts — مثبت بالتحقق'
  },
  'sales.deposits': {
    functional: 'non_working',
    note: 'ما زال localStorage — عربون محاسبي غير مفعّل (ADVANCE-B)'
  },
  'purchases.purchase-orders': {
    functional: 'working',
    note: 'P2: /finance/purchase-orders.html + API'
  },
  'purchases.vendor-invoices': {
    functional: 'working',
    note: 'P2: فواتير موردين Postgres'
  },
  'purchases.purchase-requests': { functional: 'partial', note: 'عبر صفحة أوامر الشراء مؤقتًا' },
  'purchases.vendor-quotes': { functional: 'partial', note: 'عبر صفحة أوامر الشراء مؤقتًا' },
  'purchases.receiving': { functional: 'partial', note: 'متابعة حالة أمر الشراء فقط' }
};

const pages = [];
for (const sec of catalog.SECTIONS) {
  for (const p of sec.pages) {
    const href = p.href;
    const effectiveHref = href || '/finance/leadership-coming-soon.html';
    const a = analyzeFile(href || null);
    const isAppRoute = Boolean(href && !href.endsWith('.html'));
    if (!href) {
      a.opens = true;
      a.ui = 'coming_soon';
      a.api = 'none';
      a.storage = 'none';
      a.file = 'finance/leadership-coming-soon.html';
    } else if (isAppRoute) {
      // Express/app routes (HR/settings) — verified open via HTTP; not finance HTML files
      a.opens = true;
      a.ui = 'link';
      a.api = 'n/a';
      a.storage = 'n/a';
    }

    let functional;
    if (a.ui === 'coming_soon') functional = 'non_working';
    else if (a.ui === 'link') functional = 'working'; // cross-module navigation that opens
    else if (a.ui === 'missing') functional = 'non_working';
    else if (a.ui === 'placeholder' || a.storage === 'localStorage') functional = 'non_working';
    else if (a.simulated) functional = 'partial';
    else if (a.api === 'crud' && a.storage === 'postgres') functional = 'working';
    else if (a.api === 'read' || a.ui === 'shell') functional = 'partial';
    else if (a.api === 'none') functional = 'non_working';
    else functional = 'partial';

    const id = `${sec.id}.${p.id}`;
    const ov = overrides[id];
    if (ov && ov.functional) functional = ov.functional;

    let missing = null;
    if (ov && ov.missing) {
      missing = ov.missing;
    } else if (functional !== 'working') {
      if (a.ui === 'coming_soon') missing = 'بناء Backend+UI+DB كامل';
      else if (a.storage === 'localStorage') missing = 'API Postgres + إزالة حفظ localStorage للبيانات';
      else if (a.simulated) missing = 'إزالة المحاكاة وربط API حقيقي';
      else if (a.api === 'read') missing = 'عمليات كتابة CRUD من الواجهة';
      else missing = 'اختبار وظيفي من الواجهة إلى DB + إكمال فجوات CRUD/صلاحيات';
    }

    pages.push({
      section: sec.id,
      section_label: sec.label,
      id: p.id,
      label: p.label,
      href,
      effective_href: effectiveHref,
      catalog_status: p.status,
      opens: a.opens,
      ui_kind: a.ui,
      api: a.api,
      storage: a.storage,
      crud: a.crud,
      create: a.create,
      update: a.update,
      delete: a.del,
      simulated_actions: a.simulated,
      functional_class: functional,
      missing,
      note: (ov && ov.note) || p.note || null
    });
  }
}

const counts = {
  total: pages.length,
  working: pages.filter((p) => p.functional_class === 'working').length,
  partial: pages.filter((p) => p.functional_class === 'partial').length,
  non_working: pages.filter((p) => p.functional_class === 'non_working').length,
  opens: pages.filter((p) => p.opens).length,
  catalog_operational_but_not_working: pages.filter(
    (p) => p.catalog_status === 'operational' && p.functional_class !== 'working'
  ).length
};

const report = {
  generated_at: new Date().toISOString(),
  criteria:
    'functional truth: opens + real UI + postgres API CRUD + no simulation/localStorage-only; catalog status ignored as proof of working',
  counts,
  pages,
  working_ids: pages.filter((p) => p.functional_class === 'working').map((p) => `${p.section}.${p.id}`),
  partial_ids: pages.filter((p) => p.functional_class === 'partial').map((p) => `${p.section}.${p.id}`),
  remaining_non_working_ids: pages
    .filter((p) => p.functional_class === 'non_working')
    .map((p) => `${p.section}.${p.id}`),
  priority_plan: [
    {
      batch: 'P1 (هذا الـ Draft)',
      items: [
        'إنشاء فاتورة في invoices-budgets-master',
        'سداد حقيقي بتخصيص بدل محاكاة',
        'تخصيص إلزامي في receivables / payments / sales-mobile'
      ],
      effort: 'متوسط — ملفات UI موجودة وAPI جاهز؛ يلزم اختبار بوابة التحصيل'
    },
    {
      batch: 'P2',
      items: [
        'عروض أسعار مبيعات حقيقية (بنود/صلاحية/تحويل لفاتورة) بدل quick-offers الترويجية',
        'ميزانيات: إنشاء/تعديل من الواجهة',
        'قيود يومية: إكمال مسار الترحيل من UI'
      ],
      effort: 'متوسط–عالٍ — نماذج أوضح + صلاحيات كيان'
    },
    {
      batch: 'P3',
      items: ['المشتريات (طلبات/أوامر/فواتير موردين)', 'المخزون والتكاليف', 'دورة الشيكات ومراكز التكلفة'],
      effort: 'عالٍ — معظمها coming_soon بلا مسار تشغيلي كامل'
    },
    {
      batch: 'P4',
      items: ['localStorage: خصومات/عربون → Postgres', 'POS / فاتورة إلكترونية / ولاء'],
      effort: 'عالٍ — منتجات جديدة'
    }
  ]
};

fs.writeFileSync('/opt/cursor/artifacts/finance-functional-truth-audit.json', JSON.stringify(report, null, 2));

const md = [];
md.push('# جرد وظيفي — القيادة المالية 360 (حقيقة التشغيل لا تسميات الكتالوج)');
md.push('');
md.push(`تاريخ: ${report.generated_at}`);
md.push('');
md.push('## الأعداد');
md.push(`- إجمالي الصفحات: **${counts.total}**`);
md.push(`- عاملة فعليًا (CRUD Postgres بدون محاكاة): **${counts.working}**`);
md.push(`- جزئية: **${counts.partial}**`);
md.push(`- غير عاملة / وهمية / قيد التطوير: **${counts.non_working}**`);
md.push(`- تفتح (ملف أو coming-soon): **${counts.opens}**`);
md.push(
  `- مصنّفة «تشغيلية» في الكتالوج لكنها ليست working: **${counts.catalog_operational_but_not_working}**`
);
md.push('');
md.push('## معيار التصنيف');
md.push(report.criteria);
md.push('');
md.push('## خطة الأولوية');
for (const b of report.priority_plan) {
  md.push(`### ${b.batch}`);
  md.push(`الجهد التقني: ${b.effort}`);
  for (const it of b.items) md.push(`- ${it}`);
  md.push('');
}
md.push('## الصفحات العاملة');
for (const id of report.working_ids) md.push(`- \`${id}\``);
md.push('');
md.push('## الصفحات الجزئية');
for (const id of report.partial_ids) {
  const p = pages.find((x) => `${x.section}.${x.id}` === id);
  md.push(`- \`${id}\` — ${p ? p.missing || p.note || '' : ''}`);
}
md.push('');
md.push('## الصفحات غير العاملة / المتبقية');
for (const id of report.remaining_non_working_ids) {
  const p = pages.find((x) => `${x.section}.${x.id}` === id);
  md.push(`- \`${id}\` → ${p && p.href ? p.href : 'coming-soon'} — ${p ? p.missing : ''}`);
}
md.push('');

fs.writeFileSync('/opt/cursor/artifacts/finance-functional-truth-audit.md', md.join('\n'));
console.log(JSON.stringify(counts, null, 2));
console.log('wrote artifacts');
