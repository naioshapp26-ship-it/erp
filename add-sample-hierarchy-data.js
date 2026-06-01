// Add sample hierarchy data for testing
const db = require('./db');

async function addSampleData() {
  try {
    console.log('🔄 إضافة بيانات تجريبية للهيكل الهرمي...');

    // إضافة منصات ومكاتب إضافية لحاضنة الرياض (branch_id = 1)
    
    // منصة إضافية للحاضنة 1
    const platform1 = await db.query(`
      INSERT INTO platforms (incubator_id, name, code, description, platform_type, pricing_model, base_price, currency, is_active)
      VALUES (1, 'منصة التجارة الإلكترونية', 'PLT-ECOM-01', 'منصة متكاملة للتجارة الإلكترونية والدفع الإلكتروني', 'E-Commerce', 'Subscription', 999.00, 'SAR', true)
      RETURNING id
    `);
    console.log('✅ تم إضافة منصة التجارة الإلكترونية');

    // إنشاء entity_id للمنصة
    const platformEntityId = 'PLT0' + (platform1.rows[0].id + 10);
    await db.query(`
      INSERT INTO entities (id, name, type, status, balance, users_count, plan, theme)
      VALUES ($1, 'منصة التجارة الإلكترونية', 'PLATFORM', 'Active', 0, 0, 'PRO', 'BLUE')
      ON CONFLICT (id) DO NOTHING
    `, [platformEntityId]);
    
    await db.query('UPDATE platforms SET entity_id = $1 WHERE id = $2', [platformEntityId, platform1.rows[0].id]);

    // مكتب إضافي للحاضنة 1
    const office1 = await db.query(`
      INSERT INTO offices (incubator_id, name, code, description, office_type, capacity, location, contact_email, contact_phone, manager_name, is_active)
      VALUES (1, 'مكتب الاستشارات المالية', 'OFF-FIN-01', 'مكتب متخصص في الاستشارات المالية والمحاسبية', 'Consulting', 15, 'الدور الثاني - مبنى الحاضنة', 'finance@nayosh.com', '+966 11 234 5678', 'سارة العتيبي', true)
      RETURNING id
    `);
    console.log('✅ تم إضافة مكتب الاستشارات المالية');

    // مكتب آخر للحاضنة 1
    const office2 = await db.query(`
      INSERT INTO offices (incubator_id, name, code, description, office_type, capacity, location, contact_email, contact_phone, manager_name, is_active)
      VALUES (1, 'مكتب التسويق الرقمي', 'OFF-MKT-01', 'مكتب متخصص في حلول التسويق الرقمي والإعلام', 'Co-working', 20, 'الدور الثالث - مبنى الحاضنة', 'marketing@nayosh.com', '+966 11 345 6789', 'خالد الشمري', true)
      RETURNING id
    `);
    console.log('✅ تم إضافة مكتب التسويق الرقمي');

    // إضافة بيانات للحاضنة 2 (القاهرة)
    const platform2 = await db.query(`
      INSERT INTO platforms (incubator_id, name, code, description, platform_type, pricing_model, base_price, currency, is_active)
      VALUES (2, 'منصة الذكاء الاصطناعي', 'PLT-AI-01', 'منصة متخصصة في حلول الذكاء الاصطناعي والتعلم الآلي', 'AI/ML', 'Enterprise', 2500.00, 'EGP', true)
      RETURNING id
    `);
    console.log('✅ تم إضافة منصة الذكاء الاصطناعي');

    const platformEntityId2 = 'PLT0' + (platform2.rows[0].id + 10);
    await db.query(`
      INSERT INTO entities (id, name, type, status, balance, users_count, plan, theme)
      VALUES ($1, 'منصة الذكاء الاصطناعي', 'PLATFORM', 'Active', 0, 0, 'ENTERPRISE', 'PURPLE')
      ON CONFLICT (id) DO NOTHING
    `, [platformEntityId2]);
    
    await db.query('UPDATE platforms SET entity_id = $1 WHERE id = $2', [platformEntityId2, platform2.rows[0].id]);

    const office3 = await db.query(`
      INSERT INTO offices (incubator_id, name, code, description, office_type, capacity, location, contact_email, contact_phone, manager_name, is_active)
      VALUES (2, 'مكتب تطوير البرمجيات', 'OFF-DEV-01', 'مكتب متخصص في تطوير التطبيقات والبرمجيات', 'Private', 10, 'الطابق الرابع - مبنى التقنية', 'dev@nayosh.com', '+20 2 234 5678', 'أحمد علي', true)
      RETURNING id
    `);
    console.log('✅ تم إضافة مكتب تطوير البرمجيات');

    // إضافة بيانات للحاضنة 3 (دبي)
    const platform3 = await db.query(`
      INSERT INTO platforms (incubator_id, name, code, description, platform_type, pricing_model, base_price, currency, is_active)
      VALUES (3, 'منصة الابتكار الاجتماعي', 'PLT-SOC-01', 'منصة لدعم المشاريع الاجتماعية والمبتكرة', 'Social', 'Free', 0.00, 'AED', true)
      RETURNING id
    `);
    console.log('✅ تم إضافة منصة الابتكار الاجتماعي');

    const platformEntityId3 = 'PLT0' + (platform3.rows[0].id + 10);
    await db.query(`
      INSERT INTO entities (id, name, type, status, balance, users_count, plan, theme)
      VALUES ($1, 'منصة الابتكار الاجتماعي', 'PLATFORM', 'Active', 0, 0, 'BASIC', 'EMERALD')
      ON CONFLICT (id) DO NOTHING
    `, [platformEntityId3]);
    
    await db.query('UPDATE platforms SET entity_id = $1 WHERE id = $2', [platformEntityId3, platform3.rows[0].id]);

    const office4 = await db.query(`
      INSERT INTO offices (incubator_id, name, code, description, office_type, capacity, location, contact_email, contact_phone, manager_name, is_active)
      VALUES (3, 'مكتب ريادة الأعمال', 'OFF-ENT-01', 'مكتب لدعم رواد الأعمال والمشاريع الناشئة', 'Shared', 25, 'الطابق الخامس - مركز الابتكار', 'entrepreneur@nayosh.com', '+971 4 234 5678', 'فاطمة المري', true)
      RETURNING id
    `);
    console.log('✅ تم إضافة مكتب ريادة الأعمال');

    // ربط بعض المكاتب بالمنصات
    await db.query(`
      INSERT INTO office_platforms (office_id, platform_id, is_active)
      VALUES ($1, $2, true)
      ON CONFLICT DO NOTHING
    `, [office1.rows[0].id, platform1.rows[0].id]);
    console.log('✅ تم ربط مكتب الاستشارات المالية بمنصة التجارة الإلكترونية');

    await db.query(`
      INSERT INTO office_platforms (office_id, platform_id, is_active)
      VALUES ($1, $2, true)
      ON CONFLICT DO NOTHING
    `, [office3.rows[0].id, platform2.rows[0].id]);
    console.log('✅ تم ربط مكتب تطوير البرمجيات بمنصة الذكاء الاصطناعي');

    console.log('\n✅ تم إضافة جميع البيانات التجريبية بنجاح!');
    console.log('\nملخص البيانات المضافة:');
    console.log('- 3 منصات جديدة');
    console.log('- 4 مكاتب جديدة');
    console.log('- 2 ربط بين مكاتب ومنصات');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ خطأ في إضافة البيانات:', error);
    process.exit(1);
  }
}

addSampleData();
