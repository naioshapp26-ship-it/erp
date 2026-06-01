const { Pool } = require('pg');

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:PddzJpAQYezqknsntSzmCUlQYuYJldcT@crossover.proxy.rlwy.net:44255/railway';
const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false }
});

const ENTITY_ID = process.env.SEED_ENTITY_ID || 'HQ001';
const BRANCH_ID = process.env.SEED_BRANCH_ID || 'BR001';
const INCUBATOR_ID = process.env.SEED_INCUBATOR_ID || 'INC01';

const vendors = [
  {
    code: 'VND-DEMO-001',
    nameAr: 'شركة الرواد للخدمات اللوجستية',
    nameEn: 'Pioneers Logistics',
    type: 'خدمات لوجستية',
    email: 'billing@pioneers.sa',
    phone: '+966-11-441-1200',
    mobile: '+966-55-100-2201',
    address: 'شارع العليا، الرياض',
    city: 'الرياض',
    country: 'المملكة العربية السعودية',
    taxNumber: '310789654700003',
    commercialRegistration: '1010667788',
    paymentTerms: 'صافي 30 يوم',
    paymentTermDays: 30
  },
  {
    code: 'VND-DEMO-002',
    nameAr: 'مركز التقنية الذكية',
    nameEn: 'Smart Tech Hub',
    type: 'تقنية معلومات',
    email: 'accounts@smarttech.sa',
    phone: '+966-12-771-6655',
    mobile: '+966-50-880-7744',
    address: 'طريق الملك، جدة',
    city: 'جدة',
    country: 'المملكة العربية السعودية',
    taxNumber: '310456987600003',
    commercialRegistration: '4030221100',
    paymentTerms: 'صافي 45 يوم',
    paymentTermDays: 45
  },
  {
    code: 'VND-DEMO-003',
    nameAr: 'مؤسسة النخبة للصيانة',
    nameEn: 'Elite Maintenance',
    type: 'صيانة وتشغيل',
    email: 'ops@elite.sa',
    phone: '+966-13-552-9000',
    mobile: '+966-55-992-0001',
    address: 'حي الشاطئ، الدمام',
    city: 'الدمام',
    country: 'المملكة العربية السعودية',
    taxNumber: '310998877600003',
    commercialRegistration: '2050128899',
    paymentTerms: 'صافي 30 يوم',
    paymentTermDays: 30
  },
  {
    code: 'VND-DEMO-004',
    nameAr: 'شركة البيان للتسويق',
    nameEn: 'Al Bayan Marketing',
    type: 'تسويق',
    email: 'finance@albayan.sa',
    phone: '+966-11-490-3322',
    mobile: '+966-55-667-2100',
    address: 'حي المروج، الرياض',
    city: 'الرياض',
    country: 'المملكة العربية السعودية',
    taxNumber: '310775566500003',
    commercialRegistration: '1010778899',
    paymentTerms: 'صافي 60 يوم',
    paymentTermDays: 60
  },
  {
    code: 'VND-DEMO-005',
    nameAr: 'مؤسسة الأفق للمستلزمات',
    nameEn: 'Horizon Supplies',
    type: 'مستلزمات مكتبية',
    email: 'orders@horizon.sa',
    phone: '+966-12-300-5544',
    mobile: '+966-54-880-3300',
    address: 'حي الفيصلية، جدة',
    city: 'جدة',
    country: 'المملكة العربية السعودية',
    taxNumber: '310223344500003',
    commercialRegistration: '4030187771',
    paymentTerms: 'صافي 15 يوم',
    paymentTermDays: 15
  },
  {
    code: 'VND-DEMO-006',
    nameAr: 'شركة الريادة للطاقة',
    nameEn: 'Leadership Energy',
    type: 'مرافق وطاقة',
    email: 'billing@energy.sa',
    phone: '+966-11-601-8899',
    mobile: '+966-50-930-2299',
    address: 'حي النزهة، الرياض',
    city: 'الرياض',
    country: 'المملكة العربية السعودية',
    taxNumber: '310667788900003',
    commercialRegistration: '1010554433',
    paymentTerms: 'صافي 30 يوم',
    paymentTermDays: 30
  },
  {
    code: 'VND-DEMO-007',
    nameAr: 'بيت السفر الراقي',
    nameEn: 'Premium Travel House',
    type: 'سفر وتنقل',
    email: 'sales@travelhouse.sa',
    phone: '+966-11-220-7788',
    mobile: '+966-55-990-1100',
    address: 'حي الياسمين، الرياض',
    city: 'الرياض',
    country: 'المملكة العربية السعودية',
    taxNumber: '310990011200003',
    commercialRegistration: '1010899988',
    paymentTerms: 'صافي 7 أيام',
    paymentTermDays: 7
  },
  {
    code: 'VND-DEMO-008',
    nameAr: 'شركة أمان للاتصالات',
    nameEn: 'Aman Telecom',
    type: 'اتصالات',
    email: 'accounts@aman.sa',
    phone: '+966-11-345-2211',
    mobile: '+966-53-880-7788',
    address: 'حي الورود، الرياض',
    city: 'الرياض',
    country: 'المملكة العربية السعودية',
    taxNumber: '310111223300003',
    commercialRegistration: '1010661122',
    paymentTerms: 'صافي 30 يوم',
    paymentTermDays: 30
  }
];

const expenses = [
  {
    number: 'EXP-DEMO-0001',
    date: '2026-01-05',
    category: 'سفر',
    type: 'تشغيلي',
    vendorCode: 'VND-DEMO-007',
    vendorName: 'بيت السفر الراقي',
    amount: 18500,
    tax: 2775,
    status: 'معتمد',
    invoice: 'فاتورة-0001',
    description: 'حجوزات طيران وفنادق لفريق المبيعات',
    notes: 'يشمل 6 أفراد',
    attachments: { file: 'ticket-summary.pdf' }
  },
  {
    number: 'EXP-DEMO-0002',
    date: '2026-01-08',
    category: 'مرافق',
    type: 'تشغيلي',
    vendorCode: 'VND-DEMO-006',
    vendorName: 'شركة الريادة للطاقة',
    amount: 32000,
    tax: 4800,
    status: 'معتمد',
    invoice: 'فاتورة-0002',
    description: 'فاتورة كهرباء وتشغيل شهر يناير',
    notes: 'المبنى الرئيسي',
    attachments: { file: 'utility-jan.pdf' }
  },
  {
    number: 'EXP-DEMO-0003',
    date: '2026-01-10',
    category: 'تقنية معلومات',
    type: 'تشغيلي',
    vendorCode: 'VND-DEMO-002',
    vendorName: 'مركز التقنية الذكية',
    amount: 54000,
    tax: 8100,
    status: 'معتمد',
    invoice: 'فاتورة-0003',
    description: 'تجديد تراخيص البرمجيات السحابية',
    notes: 'عقود سنوية',
    attachments: { file: 'licenses-2026.pdf' }
  },
  {
    number: 'EXP-DEMO-0004',
    date: '2026-01-12',
    category: 'تشغيل',
    type: 'تشغيلي',
    vendorCode: 'VND-DEMO-001',
    vendorName: 'شركة الرواد للخدمات اللوجستية',
    amount: 25000,
    tax: 3750,
    status: 'قيد المراجعة',
    invoice: 'فاتورة-0004',
    description: 'نقل وشحن مواد للفرع الغربي',
    notes: 'مع تأمين الشحنة',
    attachments: { file: 'shipment-jan.pdf' }
  },
  {
    number: 'EXP-DEMO-0005',
    date: '2026-01-15',
    category: 'صيانة',
    type: 'تشغيلي',
    vendorCode: 'VND-DEMO-003',
    vendorName: 'مؤسسة النخبة للصيانة',
    amount: 17800,
    tax: 2670,
    status: 'معتمد',
    invoice: 'فاتورة-0005',
    description: 'صيانة دورية لأنظمة التبريد',
    notes: 'يشمل قطع الغيار',
    attachments: { file: 'maintenance-q1.pdf' }
  },
  {
    number: 'EXP-DEMO-0006',
    date: '2026-01-18',
    category: 'تسويق',
    type: 'تشغيلي',
    vendorCode: 'VND-DEMO-004',
    vendorName: 'شركة البيان للتسويق',
    amount: 46000,
    tax: 6900,
    status: 'معتمد',
    invoice: 'فاتورة-0006',
    description: 'حملة رقمية لإطلاق منصة جديدة',
    notes: 'مدة الحملة 6 أسابيع',
    attachments: { file: 'campaign-plan.pdf' }
  },
  {
    number: 'EXP-DEMO-0007',
    date: '2026-01-21',
    category: 'مستلزمات',
    type: 'تشغيلي',
    vendorCode: 'VND-DEMO-005',
    vendorName: 'مؤسسة الأفق للمستلزمات',
    amount: 9800,
    tax: 1470,
    status: 'معتمد',
    invoice: 'فاتورة-0007',
    description: 'توريد مستلزمات مكتبية',
    notes: 'تجهيز مكاتب جديدة',
    attachments: { file: 'office-supplies.pdf' }
  },
  {
    number: 'EXP-DEMO-0008',
    date: '2026-01-24',
    category: 'اتصالات',
    type: 'تشغيلي',
    vendorCode: 'VND-DEMO-008',
    vendorName: 'شركة أمان للاتصالات',
    amount: 14200,
    tax: 2130,
    status: 'معتمد',
    invoice: 'فاتورة-0008',
    description: 'خدمات خطوط البيانات والصوت',
    notes: 'اشتراك شهري',
    attachments: { file: 'telecom-jan.pdf' }
  },
  {
    number: 'EXP-DEMO-0009',
    date: '2026-01-27',
    category: 'تشغيل',
    type: 'رأسمالي',
    vendorCode: 'VND-DEMO-002',
    vendorName: 'مركز التقنية الذكية',
    amount: 125000,
    tax: 18750,
    status: 'قيد المراجعة',
    invoice: 'فاتورة-0009',
    description: 'ترقية البنية التحتية للشبكات',
    notes: 'مرحلة أولى',
    attachments: { file: 'network-upgrade.pdf' }
  },
  {
    number: 'EXP-DEMO-0010',
    date: '2026-01-30',
    category: 'إيجار',
    type: 'تشغيلي',
    vendorCode: 'VND-DEMO-006',
    vendorName: 'شركة الريادة للطاقة',
    amount: 60000,
    tax: 9000,
    status: 'معتمد',
    invoice: 'فاتورة-0010',
    description: 'إيجار مستودع الخدمات اللوجستية',
    notes: 'للفترة من يناير إلى مارس',
    attachments: { file: 'warehouse-lease.pdf' }
  }
];

async function upsertVendor(vendor) {
  const result = await pool.query(
    `INSERT INTO finance_vendors (
      vendor_code, vendor_name_ar, vendor_name_en, vendor_type, email, phone, mobile,
      address, city, country, tax_number, commercial_registration, payment_terms, payment_term_days,
      entity_type, entity_id, is_active, created_by
    ) VALUES (
      $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,true,'تجهيز'
    )
    ON CONFLICT (vendor_code) DO UPDATE SET
      vendor_name_ar = EXCLUDED.vendor_name_ar,
      vendor_name_en = EXCLUDED.vendor_name_en,
      vendor_type = EXCLUDED.vendor_type,
      email = EXCLUDED.email,
      phone = EXCLUDED.phone,
      mobile = EXCLUDED.mobile,
      address = EXCLUDED.address,
      city = EXCLUDED.city,
      country = EXCLUDED.country,
      tax_number = EXCLUDED.tax_number,
      commercial_registration = EXCLUDED.commercial_registration,
      payment_terms = EXCLUDED.payment_terms,
      payment_term_days = EXCLUDED.payment_term_days,
      entity_type = EXCLUDED.entity_type,
      entity_id = EXCLUDED.entity_id,
      is_active = EXCLUDED.is_active,
      updated_at = NOW()
    RETURNING vendor_id, vendor_name_ar`,
    [
      vendor.code,
      vendor.nameAr,
      vendor.nameEn,
      vendor.type,
      vendor.email,
      vendor.phone,
      vendor.mobile,
      vendor.address,
      vendor.city,
      vendor.country,
      vendor.taxNumber,
      vendor.commercialRegistration,
      vendor.paymentTerms,
      vendor.paymentTermDays,
      'HQ',
      ENTITY_ID
    ]
  );
  return result.rows[0];
}

async function seedExpenses() {
  try {
    console.log('🚀 تجهيز بيانات المصروفات والموردين...');
    await pool.query('BEGIN');

    const vendorMap = new Map();
    for (const v of vendors) {
      const row = await upsertVendor(v);
      vendorMap.set(v.code, row);
    }

    const expenseNumbers = expenses.map(e => e.number);
    await pool.query('DELETE FROM finance_expenses WHERE expense_number = ANY($1)', [expenseNumbers]);

    for (const exp of expenses) {
      const vendorRow = vendorMap.get(exp.vendorCode);
      const total = exp.amount + exp.tax;
      await pool.query(
        `INSERT INTO finance_expenses (
          expense_number, expense_date, expense_category, expense_type, vendor_id, vendor_name,
          amount, tax_amount, total_amount, status, entity_type, entity_id, branch_id, incubator_id,
          platform_id, invoice_number, receipt_file, attachments, description, notes, created_by
        ) VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21
        )`,
        [
          exp.number,
          exp.date,
          exp.category,
          exp.type,
          vendorRow.vendor_id,
          exp.vendorName,
          exp.amount,
          exp.tax,
          total,
          exp.status,
          'HQ',
          ENTITY_ID,
          BRANCH_ID,
          INCUBATOR_ID,
          null,
          exp.invoice,
          exp.attachments?.file || null,
          JSON.stringify(exp.attachments || {}),
          exp.description,
          exp.notes,
          'تجهيز'
        ]
      );
    }

    await pool.query('COMMIT');
    console.log('✅ تم تجهيز البيانات بنجاح.');
  } catch (error) {
    await pool.query('ROLLBACK');
    console.error('❌ خطأ في تجهيز البيانات:', error.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

seedExpenses();
