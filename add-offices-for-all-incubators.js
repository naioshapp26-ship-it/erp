// Add offices for all existing incubators
const { Client } = require('pg');

const connectionString = 'postgresql://postgres:PddzJpAQYezqknsntSzmCUlQYuYJldcT@crossover.proxy.rlwy.net:44255/railway';

// قائمة المكاتب النمطية التي ستُضاف لكل حاضنة
const officeTemplates = [
  {
    code_suffix: 'FIN',
    name: 'مكتب الاستشارات المالية',
    description: 'مكتب متخصص في الاستشارات المالية والمحاسبية',
    office_type: 'Consulting',
    capacity: 15,
    location: 'الدور الثاني',
    contact_email: 'finance@nayosh.com',
    manager_name: 'مدير المالية'
  },
  {
    code_suffix: 'MKT',
    name: 'مكتب التسويق الرقمي',
    description: 'مكتب متخصص في حلول التسويق الرقمي والإعلام',
    office_type: 'Co-working',
    capacity: 20,
    location: 'الدور الثالث',
    contact_email: 'marketing@nayosh.com',
    manager_name: 'مدير التسويق'
  },
  {
    code_suffix: 'DEV',
    name: 'مكتب تطوير البرمجيات',
    description: 'مكتب متخصص في تطوير التطبيقات والبرمجيات',
    office_type: 'Private',
    capacity: 10,
    location: 'الطابق الرابع',
    contact_email: 'dev@nayosh.com',
    manager_name: 'مدير التطوير'
  },
  {
    code_suffix: 'ENT',
    name: 'مكتب ريادة الأعمال',
    description: 'مكتب لدعم رواد الأعمال والمشاريع الناشئة',
    office_type: 'Shared',
    capacity: 25,
    location: 'الطابق الخامس',
    contact_email: 'entrepreneur@nayosh.com',
    manager_name: 'مدير الريادة'
  }
];

async function addOfficesForAllIncubators() {
  const client = new Client({ connectionString });
  
  try {
    await client.connect();
    console.log('✅ تم الاتصال بقاعدة البيانات\n');

    // الحصول على جميع الحاضنات
    console.log('📋 جلب جميع الحاضنات...');
    const incubators = await client.query('SELECT id, code, name FROM incubators ORDER BY id LIMIT 10');
    console.log(`وجدت ${incubators.rows.length} حاضنة (سأعرض أول 10)\n`);
    
    if (incubators.rows.length === 0) {
      console.log('❌ لا توجد حاضنات في قاعدة البيانات');
      return;
    }

    // عرض بعض الحاضنات
    console.log('أمثلة على الحاضنات:');
    incubators.rows.forEach((inc, i) => {
      if (i < 5) {
        console.log(`  ${i+1}. ID: ${inc.id}, Code: ${inc.code}, Name: ${inc.name}`);
      }
    });
    console.log();

    // إضافة مكتب لكل حاضنة
    console.log('🔄 إضافة المكاتب للحاضنات...\n');
    
    let addedCount = 0;
    let skippedCount = 0;
    
    for (const incubator of incubators.rows) {
      for (const template of officeTemplates) {
        try {
          const officeCode = `OFF-${incubator.id}-${template.code_suffix}`;
          const officeName = `${template.name} - ${incubator.name.substring(0, 30)}`;
          
          await client.query(`
            INSERT INTO offices (
              incubator_id, name, code, description, office_type,
              capacity, location, contact_email, contact_phone, manager_name, is_active
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, true)
            ON CONFLICT (incubator_id, code) DO NOTHING
          `, [
            incubator.id,
            officeName,
            officeCode,
            template.description,
            template.office_type,
            template.capacity,
            template.location,
            template.contact_email,
            '',  // contact_phone
            template.manager_name
          ]);
          
          addedCount++;
          if (addedCount <= 10) {
            console.log(`✅ ${officeCode}: ${officeName}`);
          }
        } catch (err) {
          skippedCount++;
          if (skippedCount <= 5) {
            console.error(`❌ خطأ في إضافة مكتب للحاضنة ${incubator.id}:`, err.message);
          }
        }
      }
    }

    console.log(`\n📊 الإحصائيات:`);
    console.log(`  - تمت إضافة: ${addedCount} مكتب`);
    console.log(`  - تم تجاهله: ${skippedCount} مكتب\n`);

    // عرض النتيجة النهائية
    const finalOffices = await client.query('SELECT id, code, name, incubator_id FROM offices ORDER BY id LIMIT 20');
    console.log(`✅ إجمالي المكاتب في قاعدة البيانات: ${finalOffices.rows.length}+`);
    console.log('\nأمثلة على المكاتب المضافة:');
    finalOffices.rows.forEach((office, i) => {
      if (i < 10) {
        console.log(`  ${i+1}. ${office.code}: ${office.name.substring(0, 50)}...`);
      }
    });

  } catch (error) {
    console.error('\n❌ خطأ:', error.message);
    console.error(error);
  } finally {
    await client.end();
    console.log('\n✅ تم إغلاق الاتصال بقاعدة البيانات');
  }
}

addOfficesForAllIncubators();
