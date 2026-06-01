const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://postgres:PddzJpAQYezqknsntSzmCUlQYuYJldcT@crossover.proxy.rlwy.net:44255/railway',
  ssl: { rejectUnauthorized: false }
});

// المنصات المطلوبة - 95 منصة فقط
const requiredPlatforms = [
  'مطعم الوجبات الجاهزة',
  'مطعم للوجبات السريعة',
  'كافيهات',
  'عربات بيع الطعام',
  'مطعم فاخر',
  'مخبز',
  'متجر كيك',
  'متجر حلويات',
  'توزيع الأطعمة',
  'موزّع مشروبات',
  'متجر بقالة',
  'متجر كتب',
  'متجر ملابس',
  'متجر مستحضرات التجميل',
  'متجر إلكترونيات',
  'متجر أثاث',
  'متجر معدات',
  'متجر ألعاب',
  'متجر مستلزمات زراعية',
  'قطع غيار المركبات',
  'متجر الحرف اليدوية',
  'محل دراجات',
  'متجر نظارات',
  'متجر معدات تقنية المعلومات والدعم',
  'الشحن والتوصيل',
  'خدمات التنظيف',
  'كهربائي',
  'العناية بالحدائق',
  'خدمات الصيانة',
  'خدمات صناعة الأحذية',
  'المسح والتخطيط',
  'نجّار',
  'أنظمة الطاقة الشمسية',
  'خدمات التكييف',
  'منسق أزهار',
  'تأجير دراجات',
  'الخدمات اللوجستية من طرف ثالث',
  'ورش عمل مدرسة لتعليم القيادة',
  'التعلم الإلكتروني',
  'منظمة طلابية',
  'المخيمات الصيفية',
  'ممارس صحي',
  'صيدلية',
  'عيادة بيطرية',
  'صالون تصفيف الشعر',
  'محل وشوم',
  'ممرات البولينج',
  'النادي الرياضي للتسلق',
  'مركز لياقة بدنية',
  'مدرب شخصي',
  'الفعاليات الرياضية',
  'نادي رياضي',
  'نادي الرياضات الجماعية',
  'قاعات الحفلات الموسيقية',
  'صالة عرض',
  'صالة افراح',
  'المكتبة',
  'متحف',
  'تصوير',
  'السينما',
  'نادي',
  'إدارة الفعاليات',
  'صالات الأفراح والمناسبات',
  'متعهد حفلات الزفاف',
  'غرف الألغاز',
  'الملاهي الليلية',
  'العقارات',
  'اتحاد مُلاّك العقارات',
  'البناء',
  'تأجير شقق مفروشة',
  'منزل عطلات',
  'فندق',
  'نزل للضيوف',
  'موقع التخييم',
  'خيام وبيوت جاهزة',
  'كرفنات',
  'جولات بصحبة مُرشد سياحي',
  'منتجع صحي',
  'هدايا الشركات',
  'تصنيع الأثاث حسب الطلب',
  'مُصنِّع معادن',
  'تصنيع الأقمشة والمنسوجات',
  'شركة هندسة معمارية',
  'بيئية',
  'استقطاب المواهب',
  'منشأة قانونية',
  'وكالة تسويقية',
  'شريك نايوش',
  'بائع وسيط للبرمجيات',
  'محاسبة',
  'تحصيل',
  'التدقيق والتوثيق',
  'منظمة غير ربحية',
  'تأجير لوحات إعلانية',
  'تجارة الوقود'
];

// الحاضنات المطلوبة - 100 حاضنة فقط
const requiredIncubators = [
  'التعليم والتعلم',
  'التدريب والشهادات الإحترافية',
  'التسويق الرقمي',
  'نادي بيتا الرقمي',
  'الإعتمادات الدولية',
  'الإعتمادات المحلية',
  'الحياة الرقمية',
  'المنضمات والجمعيات المحلية',
  'المنضمات والجمعيات الدولية',
  'المدن الصناعية',
  'الشعر والأدب',
  'الغرف الصناعية',
  'العرف التجارية',
  'النقابات',
  'الإيتيكيت',
  'عالم الأعمال',
  'الرياضة واللياقة',
  'الطعام والشراب',
  'المطابخ السحابية',
  'المطابخ والولائم',
  'مطاعم متنقلة',
  'شقق مفروشة',
  'الفنادق',
  'المجمعات السنكية',
  'شليهات',
  'نوادي رياضية',
  'نوادي ليلية',
  'السياحة والترفيه',
  'المرافق',
  'المولات ومجمعات التسوق',
  'الكافيهات',
  'الترفيه',
  'التصميم الداخلي',
  'تصميم جرافيك',
  'الإنشاءات',
  'الديكورات',
  'مواد البناء',
  'مواد الديكو',
  'مقاولات عامة',
  'طاقة',
  'الصحة والجمال',
  'فريلانسر استشارات زتدريب',
  'المبادرات',
  'رعاية الحيوانات وتربيتها',
  'خدمة العملاء',
  'الموارد البشرية',
  'المالية والمحاسبة والضريبة',
  'التحصيل',
  'الرعاية الصحية',
  'صيدليات',
  'التغذية والجيم',
  'القانونية والإستشارات',
  'الإستشارات والبحوث',
  'الإستشارات النفسية',
  'الإستشارات الطبية والعيادات',
  'الصناعات والمدن الصناعية',
  'الجودة الشاملة والأيزو',
  'السلامة والصحة المهنية',
  'الأمن الصناعي والغذائي',
  'الحراسات الأمنية',
  'معارض السيارات',
  'معارض المعدات',
  'معارض الأدوات',
  'مستلزمات المنزل',
  'النقل',
  'التوصيل',
  'الخدمات اللوجستية',
  'الخضروات والفاكهة',
  'العطارة',
  'أثاث وأجهزة منزلية ومكتبية',
  'الحلويات والعصائر',
  'محامص ومكسرات',
  'الورد والزينة',
  'الملابس والأحذية',
  'الأعراس والحفلات',
  'مغاسل السيارات',
  'مكتانيكا وكهرباء سيارات',
  'كمبيوترات وصيانة',
  'تحف و إكسسوارات',
  'مجوهرات',
  'تصفيات',
  'كل شي مستعمل',
  'عيادات ومراكز طبية',
  'عيادات بيطرية',
  'اعلاف واغذية للحيوانات',
  'سجاد وموكيت',
  'سلاسل الإمداد',
  'محطات وقود وغسيل سيارات',
  'جامعات ومعاهد ومراكز',
  'تجهيزات كطابخ صناعية',
  'أجهزة وملابس رياضية',
  'معاصر زيتون',
  'موزعي مواد غذائية',
  'مطابع ومستلزماتها',
  'إكسسوارات ةزينة سيارات',
  'قرطاسية واوازم مدرسية',
  'مدارس خاصة',
  'جوالات وإكسسواراتها',
  'اتصالات',
  'خردوات وكل شي مستعمل'
];

async function cleanAndLinkAll() {
  try {
    console.log('=== تنظيف وربط جميع المنصات والحاضنات ===\n');
    
    // 1. جلب جميع الفروع
    const branchesResult = await pool.query('SELECT id, name FROM entities WHERE type = \'BRANCH\' ORDER BY name');
    const branches = branchesResult.rows;
    console.log(`✓ عدد الفروع: ${branches.length}\n`);
    
    // 2. جلب المنصات الحالية
    const currentPlatformsResult = await pool.query('SELECT id, name FROM entities WHERE type = \'PLATFORM\' ORDER BY name');
    const currentPlatforms = currentPlatformsResult.rows;
    console.log(`المنصات الحالية: ${currentPlatforms.length}`);
    console.log(`المنصات المطلوبة: ${requiredPlatforms.length}`);
    
    // 3. حذف المنصات الزائدة
    const platformsToDelete = currentPlatforms.filter(p => !requiredPlatforms.includes(p.name));
    if (platformsToDelete.length > 0) {
      console.log(`\\n🗑️ حذف ${platformsToDelete.length} منصة زائدة...`);
      for (const platform of platformsToDelete) {
        await pool.query('DELETE FROM entities WHERE id = $1', [platform.id]);
        console.log(`  - حذف: ${platform.name}`);
      }
    }
    
    // 4. إضافة المنصات الناقصة
    const currentPlatformNames = currentPlatforms.map(p => p.name);
    const platformsToAdd = requiredPlatforms.filter(p => !currentPlatformNames.includes(p));
    if (platformsToAdd.length > 0) {
      console.log(`\\n➕ إضافة ${platformsToAdd.length} منصة ناقصة...`);
      let counter = 1;
      for (const platform of platformsToAdd) {
        const id = 'plat-' + counter++;
        await pool.query(
          `INSERT INTO entities (id, name, type, status) VALUES ($1, $2, 'PLATFORM', 'Active')`,
          [id, platform]
        );
        console.log(`  - إضافة: ${platform}`);
      }
    }
    
    // 5. جلب الحاضنات الحالية
    const currentIncubatorsResult = await pool.query('SELECT id, name FROM entities WHERE type = \'INCUBATOR\' ORDER BY name');
    const currentIncubators = currentIncubatorsResult.rows;
    console.log(`\\nالحاضنات الحالية: ${currentIncubators.length}`);
    console.log(`الحاضنات المطلوبة: ${requiredIncubators.length}`);
    
    // 6. حذف الحاضنات الزائدة
    const incubatorsToDelete = currentIncubators.filter(i => !requiredIncubators.includes(i.name));
    if (incubatorsToDelete.length > 0) {
      console.log(`\\n🗑️ حذف ${incubatorsToDelete.length} حاضنة زائدة...`);
      for (const incubator of incubatorsToDelete) {
        await pool.query('DELETE FROM entities WHERE id = $1', [incubator.id]);
        console.log(`  - حذف: ${incubator.name}`);
      }
    }
    
    // 7. إضافة الحاضنات الناقصة
    const currentIncubatorNames = currentIncubators.map(i => i.name);
    const incubatorsToAdd = requiredIncubators.filter(i => !currentIncubatorNames.includes(i));
    if (incubatorsToAdd.length > 0) {
      console.log(`\\n➕ إضافة ${incubatorsToAdd.length} حاضنة ناقصة...`);
      let counter = 1;
      for (const incubator of incubatorsToAdd) {
        const id = 'incub-' + counter++;
        await pool.query(
          `INSERT INTO entities (id, name, type, status) VALUES ($1, $2, 'INCUBATOR', 'Active')`,
          [id, incubator]
        );
        console.log(`  - إضافة: ${incubator}`);
      }
    }
    
    // 8. جلب المنصات والحاضنات المحدثة
    const finalPlatformsResult = await pool.query('SELECT id, name FROM entities WHERE type = \'PLATFORM\' ORDER BY name');
    const finalPlatforms = finalPlatformsResult.rows;
    
    const finalIncubatorsResult = await pool.query('SELECT id, name FROM entities WHERE type = \'INCUBATOR\' ORDER BY name');
    const finalIncubators = finalIncubatorsResult.rows;
    
    console.log(`\\n✅ المنصات النهائية: ${finalPlatforms.length}`);
    console.log(`✅ الحاضنات النهائية: ${finalIncubators.length}`);
    
    // 9. حذف الروابط الحالية
    console.log(`\\n🔗 حذف الروابط القديمة...`);
    await pool.query('DELETE FROM branch_platforms');
    await pool.query('DELETE FROM branch_incubators');
    console.log('✓ تم حذف الروابط القديمة');
    
    // 10. ربط جميع المنصات بجميع الفروع
    console.log(`\\n🔗 ربط ${finalPlatforms.length} منصة بـ ${branches.length} فرع...`);
    let platformLinksCount = 0;
    for (const platform of finalPlatforms) {
      for (const branch of branches) {
        await pool.query(
          'INSERT INTO branch_platforms (branch_id, platform_id) VALUES ($1, $2)',
          [branch.id, platform.id]
        );
        platformLinksCount++;
      }
    }
    console.log(`✓ تم ربط ${platformLinksCount} رابط للمنصات`);
    
    // 11. ربط جميع الحاضنات بجميع الفروع
    console.log(`\\n🔗 ربط ${finalIncubators.length} حاضنة بـ ${branches.length} فرع...`);
    let incubatorLinksCount = 0;
    for (const incubator of finalIncubators) {
      for (const branch of branches) {
        await pool.query(
          'INSERT INTO branch_incubators (branch_id, incubator_id) VALUES ($1, $2)',
          [branch.id, incubator.id]
        );
        incubatorLinksCount++;
      }
    }
    console.log(`✓ تم ربط ${incubatorLinksCount} رابط للحاضنات`);
    
    // 12. التحقق النهائي
    const platformCheckResult = await pool.query('SELECT COUNT(*) as count FROM branch_platforms');
    const incubatorCheckResult = await pool.query('SELECT COUNT(*) as count FROM branch_incubators');
    
    console.log(`\\n=== النتائج النهائية ===`);
    console.log(`✅ المنصات: ${finalPlatforms.length} (المطلوب: ${requiredPlatforms.length})`);
    console.log(`✅ الحاضنات: ${finalIncubators.length} (المطلوب: ${requiredIncubators.length})`);
    console.log(`✅ الفروع: ${branches.length}`);
    console.log(`✅ روابط المنصات: ${platformCheckResult.rows[0].count} (المتوقع: ${finalPlatforms.length * branches.length})`);
    console.log(`✅ روابط الحاضنات: ${incubatorCheckResult.rows[0].count} (المتوقع: ${finalIncubators.length * branches.length})`);
    
    if (finalPlatforms.length === requiredPlatforms.length &&
        finalIncubators.length === requiredIncubators.length &&
        platformCheckResult.rows[0].count == finalPlatforms.length * branches.length &&
        incubatorCheckResult.rows[0].count == finalIncubators.length * branches.length) {
      console.log(`\\n✅ اكتمل بنجاح! جميع المنصات والحاضنات مرتبطة بجميع الفروع`);
    } else {
      console.log(`\\n⚠️ هناك مشكلة في البيانات`);
    }
    
    await pool.end();
  } catch (err) {
    console.error('خطأ:', err);
    await pool.end();
  }
}

cleanAndLinkAll();
