const db = require('./db');

const seedRecords = [
  {
    title: 'تحديث سياسة العمل المرن للربع الثاني',
    doc_number: 'HR-ARCH-2026-101',
    doc_type: 'سياسات ولوائح',
    doc_category: 'إداري',
    department: 'إدارة الموارد البشرية',
    archive_date: '2026-02-18',
    confidentiality: 'داخلي',
    owner: 'نورة الحربي',
    notes: 'نسخة معتمدة تشمل نطاق التطبيق وآلية المراجعة.'
  },
  {
    title: 'محضر اعتماد خطة التدريب السنوية',
    doc_number: 'HR-ARCH-2026-102',
    doc_type: 'محاضر اجتماعات',
    doc_category: 'HR',
    department: 'إدارة التدريب',
    archive_date: '2026-02-20',
    confidentiality: 'داخلي',
    owner: 'خالد الزهراني',
    notes: 'تم اعتماد الخطة مع مؤشرات قياس أداء واضحة.'
  },
  {
    title: 'تقرير تدقيق امتثال الموارد البشرية',
    doc_number: 'HR-ARCH-2026-103',
    doc_type: 'تقارير وإحصاءات',
    doc_category: 'إداري',
    department: 'إدارة الامتثال',
    archive_date: '2026-02-22',
    confidentiality: 'سري',
    owner: 'منى الغامدي',
    notes: 'يشمل نتائج التدقيق ونقاط التحسين ذات الأولوية.'
  },
  {
    title: 'سجل مصروفات برامج التطوير',
    doc_number: 'HR-ARCH-2026-104',
    doc_type: 'سجلات مالية',
    doc_category: 'مالي',
    department: 'الشؤون المالية',
    archive_date: '2026-02-24',
    confidentiality: 'داخلي',
    owner: 'فهد العنزي',
    notes: 'مطابقة المصروفات مع أوامر الشراء والتقارير الداعمة.'
  },
  {
    title: 'ملف توثيق إجراءات إنهاء الخدمة',
    doc_number: 'HR-ARCH-2026-105',
    doc_type: 'خطابات رسمية',
    doc_category: 'سري',
    department: 'شؤون الموظفين',
    archive_date: '2026-02-26',
    confidentiality: 'سري للغاية',
    owner: 'سارة القحطاني',
    notes: 'يتضمن خطاب إنهاء الخدمة ومحاضر التسليم.'
  },
  {
    title: 'نموذج طلب إجازة استثنائية معتمد',
    doc_number: 'HR-ARCH-2026-106',
    doc_type: 'نماذج وطلبات',
    doc_category: 'HR',
    department: 'شؤون الموظفين',
    archive_date: '2026-02-28',
    confidentiality: 'عام',
    owner: 'علي الدوسري',
    notes: 'نموذج معتمد للاستخدام الداخلي بدءا من 2026-03-01.'
  },
  {
    title: 'سجل تحديثات بيانات الموظفين',
    doc_number: 'HR-ARCH-2026-107',
    doc_type: 'ملفات موظفين',
    doc_category: 'HR',
    department: 'إدارة الموارد البشرية',
    archive_date: '2026-03-01',
    confidentiality: 'سري',
    owner: 'ليلى عبدالله',
    notes: 'توثيق تحديثات البيانات خلال دورة المراجعة السنوية.'
  },
  {
    title: 'عقد شراكة تدريبية مع جهة خارجية',
    doc_number: 'HR-ARCH-2026-108',
    doc_type: 'عقود وقرارات',
    doc_category: 'إداري',
    department: 'إدارة التدريب',
    archive_date: '2026-03-02',
    confidentiality: 'داخلي',
    owner: 'أحمد الشمري',
    notes: 'عقد محدث يتضمن نطاق الخدمات وفترة التنفيذ.'
  }
];

const seedEArchive = async () => {
  const entityId = process.env.ENTITY_ID || 'HQ001';
  const entityType = process.env.ENTITY_TYPE || 'HQ';

  try {
    const existingResult = await db.query(
      `SELECT doc_number
       FROM hr_module_records
       WHERE module_key = 'e-archive' AND entity_id = $1`,
      [entityId]
    );
    const existing = new Set((existingResult.rows || []).map(row => row.doc_number));
    const toInsert = seedRecords.filter(record => !existing.has(record.doc_number));

    if (!toInsert.length) {
      console.log('No new e-archive records to insert.');
      return;
    }

    const maxOrderResult = await db.query(
      `SELECT COALESCE(MAX(display_order), 0) AS max_order
       FROM hr_module_records
       WHERE module_key = 'e-archive' AND entity_id = $1`,
      [entityId]
    );
    const baseOrder = Number(maxOrderResult.rows[0]?.max_order || 0);

    const columns = [
      'module_key',
      'title',
      'department',
      'owner',
      'status',
      'priority',
      'notes',
      'entity_id',
      'entity_type',
      'doc_number',
      'doc_type',
      'doc_category',
      'archive_date',
      'confidentiality',
      'display_order'
    ];

    const values = [];
    const placeholders = toInsert.map((record, index) => {
      const offset = index * columns.length;
      values.push(
        'e-archive',
        record.title,
        record.department,
        record.owner,
        'نشط',
        'متوسط',
        record.notes || null,
        entityId,
        entityType,
        record.doc_number,
        record.doc_type,
        record.doc_category,
        record.archive_date,
        record.confidentiality,
        baseOrder + index + 1
      );
      const rowPlaceholders = columns.map((_, i) => `$${offset + i + 1}`);
      return `(${rowPlaceholders.join(', ')})`;
    });

    await db.query(
      `INSERT INTO hr_module_records (${columns.join(', ')})
       VALUES ${placeholders.join(', ')}`,
      values
    );

    console.log(`Inserted ${toInsert.length} e-archive records for ${entityId}.`);
  } catch (error) {
    console.error('Failed to seed e-archive records:', error);
  } finally {
    await db.pool.end();
  }
};

seedEArchive();
