// Check incubators and add offices
const { Client } = require('pg');

const connectionString = 'postgresql://postgres:PddzJpAQYezqknsntSzmCUlQYuYJldcT@crossover.proxy.rlwy.net:44255/railway';

async function checkAndAddAll() {
  const client = new Client({ connectionString });
  
  try {
    await client.connect();
    console.log('✅ تم الاتصال بقاعدة البيانات\n');

    // 1. فحص الحاضنات
    console.log('📋 فحص الحاضنات...');
    const incubators = await client.query('SELECT id, name, code FROM incubators ORDER BY id');
    console.log(`العدد: ${incubators.rows.length}`);
    
    if (incubators.rows.length === 0) {
      console.log('❌ لا توجد حاضنات في قاعدة البيانات');
      console.log('🔄 سأضيف الحاضنات الأساسية...\n');
      
      // إضافة الفروع أولاً
      const branchesCheck = await client.query('SELECT id FROM branches ORDER BY id LIMIT 3');
      
      if (branchesCheck.rows.length < 3) {
        console.log('⚠️  الفروع غير موجودة، سأضيفها...');
        
        // إضافة المقر الرئيسي
        await client.query(`
          INSERT INTO headquarters (name, code, description, country, contact_email)
          VALUES ('NAIOSH Global HQ', 'HQ-001', 'المقر الرئيسي العالمي لنيوش', 'International', 'hq@nayosh.com')
          ON CONFLICT (code) DO NOTHING
        `);
        
        // إضافة الفروع
        await client.query(`
          INSERT INTO branches (hq_id, name, code, country, city, contact_email)
          VALUES 
            (1, 'فرع المملكة العربية السعودية', 'BR-SA', 'Saudi Arabia', 'Riyadh', 'sa@nayosh.com'),
            (1, 'فرع جمهورية مصر العربية', 'BR-EG', 'Egypt', 'Cairo', 'eg@nayosh.com'),
            (1, 'فرع الإمارات العربية المتحدة', 'BR-AE', 'UAE', 'Dubai', 'ae@nayosh.com')
          ON CONFLICT (code) DO NOTHING
        `);
        console.log('✅ تم إضافة الفروع');
      }
      
      // إضافة الحاضنات
      const incubatorData = [
        {
          branch_id: 1,
          name: 'حاضنة الرياض للأعمال',
          code: 'INC-RYD-01',
          description: 'حاضنة متخصصة في دعم الشركات الناشئة في الرياض',
          capacity: 50,
          location: 'الرياض - حي العليا',
          contact_email: 'riyadh@nayosh.com',
          contact_phone: '+966 11 123 4567',
          manager_name: 'محمد السعيد'
        },
        {
          branch_id: 2,
          name: 'حاضنة القاهرة التقنية',
          code: 'INC-CAI-01',
          description: 'حاضنة متخصصة في التكنولوجيا والابتكار',
          capacity: 40,
          location: 'القاهرة - مدينة نصر',
          contact_email: 'cairo@nayosh.com',
          contact_phone: '+20 2 123 4567',
          manager_name: 'أحمد حسن'
        },
        {
          branch_id: 3,
          name: 'حاضنة دبي للابتكار',
          code: 'INC-DXB-01',
          description: 'حاضنة رائدة في مجال الابتكار وريادة الأعمال',
          capacity: 60,
          location: 'دبي - الخليج التجاري',
          contact_email: 'dubai@nayosh.com',
          contact_phone: '+971 4 123 4567',
          manager_name: 'عبدالله المهيري'
        }
      ];
      
      for (const inc of incubatorData) {
        await client.query(`
          INSERT INTO incubators (
            branch_id, name, code, description, capacity, 
            location, contact_email, contact_phone, manager_name, is_active
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true)
          ON CONFLICT (code) DO NOTHING
        `, [
          inc.branch_id, inc.name, inc.code, inc.description, inc.capacity,
          inc.location, inc.contact_email, inc.contact_phone, inc.manager_name
        ]);
        console.log(`✅ تم إضافة ${inc.name}`);
      }
      
      // إعادة تحميل الحاضنات
      const newIncubators = await client.query('SELECT id, name, code FROM incubators ORDER BY id');
      console.log(`\n✅ تم إضافة ${newIncubators.rows.length} حاضنة\n`);
      incubators.rows = newIncubators.rows;
    }
    
    incubators.rows.forEach(inc => {
      console.log(`  - ${inc.code}: ${inc.name} (ID: ${inc.id})`);
    });

    // 2. الآن إضافة المكاتب
    console.log('\n📋 إضافة المكاتب...');
    
    const officesData = [
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
    
    for (const office of officesData) {
      try {
        await client.query(`
          INSERT INTO offices (
            incubator_id, name, code, description, office_type,
            capacity, location, contact_email, contact_phone, manager_name, is_active
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, true)
          ON CONFLICT (incubator_id, code) DO NOTHING
        `, [
          office.incubator_id, office.name, office.code, office.description,
          office.office_type, office.capacity, office.location,
          office.contact_email, office.contact_phone, office.manager_name
        ]);
        console.log(`✅ تم إضافة ${office.code}: ${office.name}`);
      } catch (err) {
        console.error(`❌ خطأ في إضافة ${office.code}:`, err.message);
      }
    }

    // عرض النتيجة النهائية
    console.log('\n📊 النتيجة النهائية:');
    const finalOffices = await client.query('SELECT id, code, name, incubator_id FROM offices ORDER BY id');
    console.log(`\n✅ إجمالي المكاتب: ${finalOffices.rows.length}`);
    finalOffices.rows.forEach(office => {
      console.log(`  - ${office.code}: ${office.name} (Incubator: ${office.incubator_id}, ID: ${office.id})`);
    });

  } catch (error) {
    console.error('\n❌ خطأ:', error.message);
    console.error(error);
  } finally {
    await client.end();
    console.log('\n✅ تم إغلاق الاتصال بقاعدة البيانات');
  }
}

checkAndAddAll();
