// Check existing offices in database and add missing ones
const { Client } = require('pg');

const connectionString = 'postgresql://postgres:PddzJpAQYezqknsntSzmCUlQYuYJldcT@crossover.proxy.rlwy.net:44255/railway';

// قائمة المكاتب من الكود
const officesFromCode = [
  {
    incubator_id: 1,
    name: 'مكتب الاستشارات المالية',
    code: 'OFF-FIN-01',
    description: 'مكتب متخصص في الاستشارات المالية والمحاسبية',
    office_type: 'Consulting',
    capacity: 15,
    location: 'الدور الثاني - مبنى الحاضنة',
    contact_email: 'finance@nayosh.com',
    contact_phone: '+966 11 234 5678',
    manager_name: 'سارة العتيبي'
  },
  {
    incubator_id: 1,
    name: 'مكتب التسويق الرقمي',
    code: 'OFF-MKT-01',
    description: 'مكتب متخصص في حلول التسويق الرقمي والإعلام',
    office_type: 'Co-working',
    capacity: 20,
    location: 'الدور الثالث - مبنى الحاضنة',
    contact_email: 'marketing@nayosh.com',
    contact_phone: '+966 11 345 6789',
    manager_name: 'خالد الشمري'
  },
  {
    incubator_id: 2,
    name: 'مكتب تطوير البرمجيات',
    code: 'OFF-DEV-01',
    description: 'مكتب متخصص في تطوير التطبيقات والبرمجيات',
    office_type: 'Private',
    capacity: 10,
    location: 'الطابق الرابع - مبنى التقنية',
    contact_email: 'dev@nayosh.com',
    contact_phone: '+20 2 234 5678',
    manager_name: 'أحمد علي'
  },
  {
    incubator_id: 3,
    name: 'مكتب ريادة الأعمال',
    code: 'OFF-ENT-01',
    description: 'مكتب لدعم رواد الأعمال والمشاريع الناشئة',
    office_type: 'Shared',
    capacity: 25,
    location: 'الطابق الخامس - مركز الابتكار',
    contact_email: 'entrepreneur@nayosh.com',
    contact_phone: '+971 4 234 5678',
    manager_name: 'فاطمة المري'
  }
];

async function checkAndAddOffices() {
  const client = new Client({ connectionString });
  
  try {
    await client.connect();
    console.log('✅ تم الاتصال بقاعدة البيانات');

    // فحص الجدول
    const tableCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'offices'
      )
    `);
    
    if (!tableCheck.rows[0].exists) {
      console.log('❌ جدول offices غير موجود');
      return;
    }
    
    console.log('✅ جدول offices موجود');

    // الحصول على المكاتب الموجودة
    const existingOffices = await client.query('SELECT id, code, name FROM offices ORDER BY id');
    console.log('\n📋 المكاتب الموجودة في قاعدة البيانات:');
    console.log('العدد:', existingOffices.rows.length);
    existingOffices.rows.forEach(office => {
      console.log(`  - ${office.code}: ${office.name} (ID: ${office.id})`);
    });

    const existingCodes = existingOffices.rows.map(o => o.code);
    
    // إضافة المكاتب المفقودة
    console.log('\n🔄 فحص وإضافة المكاتب المفقودة...');
    
    for (const office of officesFromCode) {
      if (existingCodes.includes(office.code)) {
        console.log(`  ⏭️  ${office.code} موجود بالفعل`);
      } else {
        try {
          // فحص الحاضنة أولاً
          const incubatorCheck = await client.query('SELECT id FROM incubators WHERE id = $1', [office.incubator_id]);
          
          if (incubatorCheck.rows.length === 0) {
            console.log(`  ⚠️  الحاضنة ${office.incubator_id} غير موجودة، تخطي ${office.code}`);
            continue;
          }
          
          await client.query(`
            INSERT INTO offices (
              incubator_id, name, code, description, office_type, 
              capacity, location, contact_email, contact_phone, manager_name, is_active
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, true)
          `, [
            office.incubator_id,
            office.name,
            office.code,
            office.description,
            office.office_type,
            office.capacity,
            office.location,
            office.contact_email,
            office.contact_phone,
            office.manager_name
          ]);
          
          console.log(`  ✅ تم إضافة ${office.code}: ${office.name}`);
        } catch (err) {
          console.error(`  ❌ خطأ في إضافة ${office.code}:`, err.message);
        }
      }
    }

    // عرض المكاتب النهائية
    const finalOffices = await client.query('SELECT id, code, name, incubator_id FROM offices ORDER BY id');
    console.log('\n✅ جميع المكاتب في قاعدة البيانات الآن:');
    console.log('العدد الإجمالي:', finalOffices.rows.length);
    finalOffices.rows.forEach(office => {
      console.log(`  - ${office.code}: ${office.name} (Incubator: ${office.incubator_id}, ID: ${office.id})`);
    });

  } catch (error) {
    console.error('❌ خطأ:', error.message);
    console.error(error);
  } finally {
    await client.end();
    console.log('\n✅ تم إغلاق الاتصال بقاعدة البيانات');
  }
}

checkAndAddOffices();
