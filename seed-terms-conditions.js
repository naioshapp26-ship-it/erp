const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://postgres:PddzJpAQYezqknsntSzmCUlQYuYJldcT@crossover.proxy.rlwy.net:44255/railway',
  ssl: { rejectUnauthorized: false }
});

const sections = [
  {
    title: 'حماية البيانات والخصوصية',
    description: 'نحافظ على سرية بيانات العملاء والالتزام بسياسات الخصوصية.',
    order: 1,
    rules: [
      'يلتزم العميل بتقديم بيانات صحيحة ومحدثة عند التسجيل.',
      'لا يتم مشاركة بيانات العميل مع أطراف خارجية دون موافقة صريحة.',
      'يجب الإبلاغ عن أي اختراق أو استخدام غير مصرح به فوراً.'
    ]
  },
  {
    title: 'الاستخدام المقبول للنظام',
    description: 'يجب استخدام النظام للأغراض المصرح بها فقط.',
    order: 2,
    rules: [
      'يُحظر إساءة الاستخدام أو محاولة الوصول غير المصرح به.',
      'يُمنع إدخال محتوى مخالف للأنظمة أو يسبب ضرراً للمنصة.',
      'يتم تعليق الوصول في حال اكتشاف أنشطة احتيالية.'
    ]
  },
  {
    title: 'السياسات المالية والدفع',
    description: 'تنظم هذه البنود أساليب الدفع والاستحقاقات.',
    order: 3,
    rules: [
      'تُسدد المستحقات وفق الجداول الزمنية المعتمدة.',
      'يحق للنظام إيقاف الخدمات عند التأخر في السداد.',
      'أي رسوم إضافية يتم توضيحها قبل التنفيذ.'
    ]
  },
  {
    title: 'الاسترجاع والاستبدال',
    description: 'تحدد الشروط العامة للاسترجاع والاستبدال.',
    order: 4,
    rules: [
      'تُقبل طلبات الاسترجاع خلال 14 يوماً من تاريخ المعاملة.',
      'لا تشمل سياسة الاسترجاع الخدمات الرقمية بعد التسليم.',
      'يتم رد المبالغ وفق آلية الدفع الأصلية.'
    ]
  },
  {
    title: 'حل النزاعات والدعم',
    description: 'قنوات الدعم الرسمية وآليات معالجة الشكاوى.',
    order: 5,
    rules: [
      'تُعالج الشكاوى خلال 5 أيام عمل من تاريخ التقديم.',
      'يتم التواصل عبر القنوات الرسمية المعتمدة فقط.',
      'في حال النزاع، يتم الرجوع لسجلات النظام المعتمدة.'
    ]
  }
];

async function seedTerms() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const insertedSections = [];
    for (const section of sections) {
      const sectionResult = await client.query(
        `INSERT INTO terms_sections (title, description, is_active, display_order)
         VALUES ($1, $2, true, $3)
         RETURNING id`,
        [section.title, section.description, section.order]
      );

      const sectionId = sectionResult.rows[0].id;
      insertedSections.push(sectionId);

      let ruleOrder = 1;
      for (const ruleText of section.rules) {
        await client.query(
          `INSERT INTO terms_rules (section_id, rule_text, is_active, display_order)
           VALUES ($1, $2, true, $3)`,
          [sectionId, ruleText, ruleOrder]
        );
        ruleOrder += 1;
      }
    }

    await client.query('COMMIT');
    console.log(`✅ Seeded ${insertedSections.length} terms sections with rules.`);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Failed to seed terms and conditions:', error);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

seedTerms();
