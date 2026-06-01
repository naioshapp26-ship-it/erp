const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://postgres:PddzJpAQYezqknsntSzmCUlQYuYJldcT@crossover.proxy.rlwy.net:44255/railway'
});

// قائمة المنصات الـ 95
const platforms = [
  // مطاعم وأغذية (1-11)
  { num: 1, name: 'مطعم الوجبات الجاهزة', code: 'REST_FAST_FOOD', category: 'RESTAURANTS' },
  { num: 2, name: 'مطعم للوجبات السريعة', code: 'REST_QUICK_SERVE', category: 'RESTAURANTS' },
  { num: 3, name: 'كافيهات', code: 'CAFE', category: 'RESTAURANTS' },
  { num: 4, name: 'عربات بيع الطعام', code: 'FOOD_CART', category: 'RESTAURANTS' },
  { num: 5, name: 'مطعم فاخر', code: 'REST_FINE_DINING', category: 'RESTAURANTS' },
  { num: 6, name: 'مخبز', code: 'BAKERY', category: 'RESTAURANTS' },
  { num: 7, name: 'متجر كيك', code: 'CAKE_SHOP', category: 'RESTAURANTS' },
  { num: 8, name: 'متجر حلويات', code: 'SWEETS_SHOP', category: 'RESTAURANTS' },
  { num: 9, name: 'توزيع الأطعمة', code: 'FOOD_DISTRIBUTION', category: 'RESTAURANTS' },
  { num: 10, name: 'موزّع مشروبات', code: 'BEVERAGE_DISTRIBUTOR', category: 'RESTAURANTS' },
  { num: 11, name: 'متجر بقالة', code: 'GROCERY_STORE', category: 'RESTAURANTS' },
  
  // متاجر (12-24)
  { num: 12, name: 'متجر كتب', code: 'BOOKSTORE', category: 'STORES' },
  { num: 13, name: 'متجر ملابس', code: 'CLOTHING_STORE', category: 'STORES' },
  { num: 14, name: 'متجر مستحضرات التجميل', code: 'COSMETICS_STORE', category: 'STORES' },
  { num: 15, name: 'متجر إلكترونيات', code: 'ELECTRONICS_STORE', category: 'STORES' },
  { num: 16, name: 'متجر أثاث', code: 'FURNITURE_STORE', category: 'STORES' },
  { num: 17, name: 'متجر معدات', code: 'EQUIPMENT_STORE', category: 'STORES' },
  { num: 18, name: 'متجر ألعاب', code: 'TOY_STORE', category: 'STORES' },
  { num: 19, name: 'متجر مستلزمات زراعية', code: 'AGRICULTURAL_STORE', category: 'STORES' },
  { num: 20, name: 'قطع غيار المركبات', code: 'AUTO_PARTS', category: 'STORES' },
  { num: 21, name: 'متجر الحرف اليدوية', code: 'CRAFT_STORE', category: 'STORES' },
  { num: 22, name: 'محل دراجات', code: 'BICYCLE_SHOP', category: 'STORES' },
  { num: 23, name: 'متجر نظارات', code: 'EYEWEAR_STORE', category: 'STORES' },
  { num: 24, name: 'متجر معدات تقنية المعلومات والدعم', code: 'IT_EQUIPMENT_STORE', category: 'STORES' },
  
  // خدمات (25-37)
  { num: 25, name: 'الشحن والتوصيل', code: 'SHIPPING_DELIVERY', category: 'SERVICES' },
  { num: 26, name: 'خدمات التنظيف', code: 'CLEANING_SERVICES', category: 'SERVICES' },
  { num: 27, name: 'كهربائي', code: 'ELECTRICIAN', category: 'SERVICES' },
  { num: 28, name: 'العناية بالحدائق', code: 'GARDENING', category: 'SERVICES' },
  { num: 29, name: 'خدمات الصيانة', code: 'MAINTENANCE', category: 'SERVICES' },
  { num: 30, name: 'خدمات صناعة الأحذية', code: 'SHOE_MAKING', category: 'SERVICES' },
  { num: 31, name: 'المسح والتخطيط', code: 'SURVEYING', category: 'SERVICES' },
  { num: 32, name: 'نجّار', code: 'CARPENTRY', category: 'SERVICES' },
  { num: 33, name: 'أنظمة الطاقة الشمسية', code: 'SOLAR_ENERGY', category: 'SERVICES' },
  { num: 34, name: 'خدمات التكييف', code: 'AC_SERVICES', category: 'SERVICES' },
  { num: 35, name: 'منسق أزهار', code: 'FLORIST', category: 'SERVICES' },
  { num: 36, name: 'تأجير دراجات', code: 'BIKE_RENTAL', category: 'SERVICES' },
  { num: 37, name: 'الخدمات اللوجستية من طرف ثالث', code: 'THIRD_PARTY_LOGISTICS', category: 'SERVICES' },
  
  // تعليم (38-41)
  { num: 38, name: 'ورش عمل مدرسة لتعليم القيادة', code: 'DRIVING_SCHOOL', category: 'EDUCATION' },
  { num: 39, name: 'التعلم الإلكتروني', code: 'E_LEARNING', category: 'EDUCATION' },
  { num: 40, name: 'منظمة طلابية', code: 'STUDENT_ORGANIZATION', category: 'EDUCATION' },
  { num: 41, name: 'المخيمات الصيفية', code: 'SUMMER_CAMPS', category: 'EDUCATION' },
  
  // صحة (42-46)
  { num: 42, name: 'ممارس صحي', code: 'HEALTH_PRACTITIONER', category: 'HEALTH' },
  { num: 43, name: 'صيدلية', code: 'PHARMACY', category: 'HEALTH' },
  { num: 44, name: 'عيادة بيطرية', code: 'VETERINARY_CLINIC', category: 'HEALTH' },
  { num: 45, name: 'صالون تصفيف الشعر', code: 'HAIR_SALON', category: 'HEALTH' },
  { num: 46, name: 'محل وشوم', code: 'TATTOO_SHOP', category: 'HEALTH' },
  
  // رياضة وترفيه (47-53)
  { num: 47, name: 'ممرات البولينج', code: 'BOWLING_ALLEY', category: 'SPORTS' },
  { num: 48, name: 'النادي الرياضي للتسلق', code: 'CLIMBING_GYM', category: 'SPORTS' },
  { num: 49, name: 'مركز لياقة بدنية', code: 'FITNESS_CENTER', category: 'SPORTS' },
  { num: 50, name: 'مدرب شخصي', code: 'PERSONAL_TRAINER', category: 'SPORTS' },
  { num: 51, name: 'الفعاليات الرياضية', code: 'SPORTS_EVENTS', category: 'SPORTS' },
  { num: 52, name: 'نادي رياضي', code: 'SPORTS_CLUB', category: 'SPORTS' },
  { num: 53, name: 'نادي الرياضات الجماعية', code: 'TEAM_SPORTS_CLUB', category: 'SPORTS' },
  
  // فعاليات وترفيه (54-66)
  { num: 54, name: 'قاعات الحفلات الموسيقية', code: 'CONCERT_HALL', category: 'EVENTS' },
  { num: 55, name: 'صالة عرض', code: 'EXHIBITION_HALL', category: 'EVENTS' },
  { num: 56, name: 'صالة افراح', code: 'WEDDING_HALL', category: 'EVENTS' },
  { num: 57, name: 'المكتبة', code: 'LIBRARY', category: 'EVENTS' },
  { num: 58, name: 'متحف', code: 'MUSEUM', category: 'EVENTS' },
  { num: 59, name: 'تصوير', code: 'PHOTOGRAPHY', category: 'EVENTS' },
  { num: 60, name: 'السينما', code: 'CINEMA', category: 'EVENTS' },
  { num: 61, name: 'نادي', code: 'NIGHTCLUB', category: 'EVENTS' },
  { num: 62, name: 'إدارة الفعاليات', code: 'EVENT_MANAGEMENT', category: 'EVENTS' },
  { num: 63, name: 'صالات الأفراح والمناسبات', code: 'EVENT_VENUES', category: 'EVENTS' },
  { num: 64, name: 'متعهد حفلات الزفاف', code: 'WEDDING_CATERING', category: 'EVENTS' },
  { num: 65, name: 'غرف الألغاز', code: 'ESCAPE_ROOM', category: 'EVENTS' },
  { num: 66, name: 'الملاهي الليلية', code: 'NIGHT_ENTERTAINMENT', category: 'EVENTS' },
  
  // عقارات وإسكان (67-76)
  { num: 67, name: 'العقارات', code: 'REAL_ESTATE', category: 'REAL_ESTATE' },
  { num: 68, name: 'اتحاد مُلاّك العقارات', code: 'PROPERTY_OWNERS_UNION', category: 'REAL_ESTATE' },
  { num: 69, name: 'البناء', code: 'CONSTRUCTION', category: 'REAL_ESTATE' },
  { num: 70, name: 'تأجير شقق مفروشة', code: 'FURNISHED_APARTMENTS', category: 'REAL_ESTATE' },
  { num: 71, name: 'منزل عطلات', code: 'VACATION_HOME', category: 'REAL_ESTATE' },
  { num: 72, name: 'فندق', code: 'HOTEL', category: 'REAL_ESTATE' },
  { num: 73, name: 'نزل للضيوف', code: 'GUEST_HOUSE', category: 'REAL_ESTATE' },
  { num: 74, name: 'موقع التخييم', code: 'CAMPING_SITE', category: 'REAL_ESTATE' },
  { num: 75, name: 'خيام وبيوت جاهزة', code: 'TENTS_PREFAB', category: 'REAL_ESTATE' },
  { num: 76, name: 'كرفنات', code: 'CARAVANS', category: 'REAL_ESTATE' },
  
  // سياحة (77-78)
  { num: 77, name: 'جولات بصحبة مُرشد سياحي', code: 'GUIDED_TOURS', category: 'TOURISM' },
  { num: 78, name: 'منتجع صحي', code: 'SPA_RESORT', category: 'TOURISM' },
  
  // تصنيع وصناعة (79-82)
  { num: 79, name: 'هدايا الشركات', code: 'CORPORATE_GIFTS', category: 'MANUFACTURING' },
  { num: 80, name: 'تصنيع الأثاث حسب الطلب', code: 'CUSTOM_FURNITURE', category: 'MANUFACTURING' },
  { num: 81, name: 'مُصنِّع معادن', code: 'METAL_MANUFACTURING', category: 'MANUFACTURING' },
  { num: 82, name: 'تصنيع الأقمشة والمنسوجات', code: 'TEXTILE_MANUFACTURING', category: 'MANUFACTURING' },
  
  // احترافية (83-92)
  { num: 83, name: 'شركة هندسة معمارية', code: 'ARCHITECTURE_FIRM', category: 'PROFESSIONAL' },
  { num: 84, name: 'بيئية', code: 'ENVIRONMENTAL', category: 'PROFESSIONAL' },
  { num: 85, name: 'استقطاب المواهب', code: 'TALENT_RECRUITMENT', category: 'PROFESSIONAL' },
  { num: 86, name: 'منشأة قانونية', code: 'LAW_FIRM', category: 'PROFESSIONAL' },
  { num: 87, name: 'وكالة تسويقية', code: 'MARKETING_AGENCY', category: 'PROFESSIONAL' },
  { num: 88, name: 'شريك نايوش', code: 'NAYOSH_PARTNER', category: 'PROFESSIONAL' },
  { num: 89, name: 'بائع وسيط للبرمجيات', code: 'SOFTWARE_RESELLER', category: 'PROFESSIONAL' },
  { num: 90, name: 'محاسبة', code: 'ACCOUNTING', category: 'PROFESSIONAL' },
  { num: 91, name: 'تحصيل', code: 'DEBT_COLLECTION', category: 'PROFESSIONAL' },
  { num: 92, name: 'التدقيق والتوثيق', code: 'AUDITING', category: 'PROFESSIONAL' },
  
  // منظمات (93)
  { num: 93, name: 'منظمة غير ربحية', code: 'NON_PROFIT', category: 'ORGANIZATIONS' },
  
  // أخرى (94-95)
  { num: 94, name: 'تأجير لوحات إعلانية', code: 'BILLBOARD_RENTAL', category: 'OTHER' },
  { num: 95, name: 'تجارة الوقود', code: 'FUEL_TRADE', category: 'OTHER' }
];

async function addPlatforms() {
  const client = await pool.connect();
  
  try {
    console.log('🚀 بدء إضافة المنصات إلى قاعدة البيانات...\n');
    console.log('='.repeat(60));
    
    // الحصول على أول حاضنة
    const incubators = await client.query('SELECT id FROM incubators ORDER BY id LIMIT 1');
    
    if (incubators.rowCount === 0) {
      console.log('❌ لا توجد حاضنات في قاعدة البيانات');
      return;
    }
    
    const incubatorId = incubators.rows[0].id;
    console.log(`✅ استخدام الحاضنة ID: ${incubatorId}\n`);
    
    let successCount = 0;
    let failCount = 0;
    const categoryCount = {};
    
    // إضافة كل منصة
    for (const platform of platforms) {
      try {
        await client.query(`
          INSERT INTO platforms (
            incubator_id,
            name,
            code,
            platform_type,
            pricing_model,
            description,
            base_price,
            currency
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `, [
          incubatorId,
          platform.name,
          platform.code,
          platform.category,
          'SUBSCRIPTION',
          `منصة ${platform.name} - ${platform.category}`,
          0,
          'SAR'
        ]);
        
        successCount++;
        
        // عد المنصات حسب الفئة
        if (!categoryCount[platform.category]) {
          categoryCount[platform.category] = 0;
        }
        categoryCount[platform.category]++;
        
        console.log(`✅ ${platform.num}. ${platform.name} - ${platform.category}`);
        
      } catch (error) {
        failCount++;
        console.log(`❌ ${platform.num}. ${platform.name} - فشل: ${error.message}`);
      }
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('📊 ملخص الإضافة');
    console.log('='.repeat(60));
    console.log(`✅ نجح: ${successCount} منصة`);
    console.log(`❌ فشل: ${failCount} منصة`);
    console.log(`📈 الإجمالي: ${platforms.length} منصة`);
    
    console.log('\n📊 توزيع المنصات حسب الفئة:');
    console.log('-'.repeat(60));
    Object.keys(categoryCount).sort().forEach(category => {
      console.log(`  ${category}: ${categoryCount[category]} منصة`);
    });
    
    // التحقق من إجمالي المنصات
    const totalPlatforms = await client.query('SELECT COUNT(*) FROM platforms');
    console.log('\n' + '='.repeat(60));
    console.log(`📊 إجمالي المنصات في قاعدة البيانات: ${totalPlatforms.rows[0].count}`);
    console.log('='.repeat(60));
    
  } catch (error) {
    console.error('\n❌ خطأ في إضافة المنصات:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// تشغيل الإضافة
addPlatforms()
  .then(() => {
    console.log('\n🎉 اكتمل إضافة المنصات بنجاح!');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ فشل في إضافة المنصات:', error);
    process.exit(1);
  });
