const { Pool } = require('pg');

const pool = new Pool({
    connectionString: 'postgresql://postgres:PddzJpAQYezqknsntSzmCUlQYuYJldcT@crossover.proxy.rlwy.net:44255/railway',
    ssl: { rejectUnauthorized: false }
});

// 100 حاضنة فقط
const incubators = [
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
    'فريلانسر استشارات وتدريب',
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
    'تحف وإكسسوارات',
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
    'تجهيزات مطابخ صناعية',
    'أجهزة وملابس رياضية',
    'معاصر زيتون',
    'موزعي مواد غذائية',
    'مطابع ومستلزماتها',
    'إكسسوارات وزينة سيارات',
    'قرطاسية واوازم مدرسية',
    'مدارس خاصة',
    'جوالات وإكسسواراتها',
    'اتصالات',
    'خردوات وكل شي مستعمل'
];

// 95 منصة
const platforms = [
    'واتساب',
    'تيليجرام',
    'سيجنال',
    'فيسبوك',
    'انستجرام',
    'تويتر',
    'تيك توك',
    'سناب شات',
    'لينكد إن',
    'يوتيوب',
    'جوجل',
    'مايكروسوفت',
    'آبل',
    'أمازون',
    'علي بابا',
    'تينسنت',
    'بايدو',
    'سامسونج',
    'هواوي',
    'شاومي',
    'أوبو',
    'فيفو',
    'ريلمي',
    'ون بلس',
    'نوكيا',
    'موتورولا',
    'سوني',
    'إل جي',
    'باناسونيك',
    'توشيبا',
    'ديل',
    'إتش بي',
    'لينوفو',
    'إيسر',
    'أسوس',
    'أم إس آي',
    'ريزر',
    'إن فيديا',
    'إيه إم دي',
    'إنتل',
    'كوالكوم',
    'ميديا تيك',
    'آي بي إم',
    'أوراكل',
    'ساب',
    'سيلز فورس',
    'أدوبي',
    'أوتوديسك',
    'إس إيه إس',
    'سبلانك',
    'تابلو',
    'باور بي آي',
    'كليك',
    'داتا بريكس',
    'سنوفليك',
    'مونجو دي بي',
    'ريديس',
    'بوستجريس',
    'ماي إس كيو إل',
    'أوراكل دي بي',
    'إس كيو إل سيرفر',
    'كاساندرا',
    'كوش بيس',
    'نيو فور جيه',
    'إي دابليو إس',
    'أزور',
    'جوجل كلاود',
    'علي كلاود',
    'آي بي إم كلاود',
    'أوراكل كلاود',
    'ديجيتال أوشن',
    'ليونود',
    'فولكانو',
    'هيروكو',
    'فيرسيل',
    'نيتليفاي',
    'كلاود فلير',
    'فاستلي',
    'أكامي',
    'سي دي إن سيتسفنتي سفن',
    'ماكس سي دي إن',
    'ستاك باث',
    'كيستنت',
    'كلاودويز',
    'كينستا',
    'دبليو بي إنجين',
    'سايت جراوند',
    'بلوهوست',
    'هوست جيتور',
    'جودادي',
    'نيم شيب',
    'دوماين دوت كوم',
    'ون آند ون'
];

async function fixDatabase() {
    const client = await pool.connect();
    
    try {
        await client.query('BEGIN');
        
        console.log('🔄 جاري حذف الحاضنات المكررة (2,700)...');
        
        // Update entities first
        await client.query('UPDATE entities SET incubator_id = NULL WHERE incubator_id IS NOT NULL');
        
        // Delete all incubators
        const deleteInc = await client.query('DELETE FROM incubators');
        console.log(`   ✅ تم حذف ${deleteInc.rowCount} حاضنة مكررة`);
        
        console.log('\n🔄 جاري إضافة 100 حاضنة فقط...');
        
        let insertedInc = 0;
        
        // Insert each incubator ONCE (not per branch)
        for (const incubatorName of incubators) {
            const code = `INC-${String(insertedInc + 1).padStart(4, '0')}`;
            
            const incubatorResult = await client.query(`
                INSERT INTO incubators (
                    branch_id, 
                    name, 
                    code, 
                    description, 
                    program_type, 
                    capacity, 
                    contact_email, 
                    contact_phone, 
                    manager_name,
                    is_active
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                RETURNING id
            `, [
                1, // Default to branch 1
                incubatorName,
                code,
                `حاضنة ${incubatorName}`,
                'MIXED',
                100,
                `${code.toLowerCase()}@nayosh.com`,
                '+966 50 000 0000',
                'مدير الحاضنة',
                true
            ]);
            
            const incubatorId = incubatorResult.rows[0].id;
            const entityId = `INC-${String(insertedInc + 1).padStart(4, '0')}`;
            
            // Insert corresponding entity
            await client.query(`
                INSERT INTO entities (
                    id,
                    name,
                    type,
                    tenant_type,
                    tenant_id,
                    hq_id,
                    branch_id,
                    incubator_id,
                    status,
                    balance,
                    location,
                    users_count,
                    plan,
                    theme
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
            `, [
                entityId,
                incubatorName,
                'INCUBATOR',
                'INCUBATOR',
                incubatorId,
                1, // HQ ID
                1, // Branch ID
                incubatorId,
                'Active',
                0,
                'الرياض',
                0,
                'PRO',
                'red'
            ]);
            
            insertedInc++;
        }
        
        console.log(`   ✅ تم إضافة ${insertedInc} حاضنة`);
        
        console.log('\n🔄 جاري استرجاع المنصات (95 منصة)...');
        
        let insertedPlat = 0;
        
        // Get first incubator ID to link platforms
        const firstInc = await client.query('SELECT id FROM incubators LIMIT 1');
        const defaultIncubatorId = firstInc.rows[0].id;
        
        // Insert platforms
        for (const platformName of platforms) {
            const code = `PLT-${String(insertedPlat + 1).padStart(4, '0')}`;
            
            const platformResult = await client.query(`
                INSERT INTO platforms (
                    incubator_id,
                    name,
                    code,
                    description,
                    platform_type,
                    pricing_model,
                    base_price,
                    currency,
                    is_active
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                RETURNING id
            `, [
                defaultIncubatorId,
                platformName,
                code,
                `منصة ${platformName}`,
                'SOCIAL_MEDIA',
                'SUBSCRIPTION',
                0,
                'SAR',
                true
            ]);
            
            const platformId = platformResult.rows[0].id;
            const entityId = `PLT-${String(insertedPlat + 1).padStart(4, '0')}`;
            
            // Insert corresponding entity
            await client.query(`
                INSERT INTO entities (
                    id,
                    name,
                    type,
                    tenant_type,
                    tenant_id,
                    hq_id,
                    branch_id,
                    platform_id,
                    status,
                    balance,
                    location,
                    users_count,
                    plan,
                    theme
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
            `, [
                entityId,
                platformName,
                'PLATFORM',
                'PLATFORM',
                platformId,
                1, // HQ ID
                1, // Branch ID
                platformId,
                'Active',
                0,
                'الرياض',
                0,
                'PRO',
                'red'
            ]);
            
            insertedPlat++;
        }
        
        console.log(`   ✅ تم إضافة ${insertedPlat} منصة`);
        
        await client.query('COMMIT');
        
        console.log('\n✅ تمت العملية بنجاح!');
        console.log(`   📊 عدد الحاضنات: ${insertedInc}`);
        console.log(`   📊 عدد المنصات: ${insertedPlat}`);
        
        // Final verification
        const incCount = await client.query('SELECT COUNT(*) FROM incubators');
        const platCount = await client.query('SELECT COUNT(*) FROM platforms');
        const entCount = await client.query('SELECT tenant_type, COUNT(*) FROM entities GROUP BY tenant_type ORDER BY tenant_type');
        
        console.log(`\n🔍 التحقق النهائي:`);
        console.log(`   📊 الحاضنات في الجدول: ${incCount.rows[0].count}`);
        console.log(`   📊 المنصات في الجدول: ${platCount.rows[0].count}`);
        console.log(`   📊 الكيانات حسب النوع:`);
        entCount.rows.forEach(row => {
            console.log(`      - ${row.tenant_type || 'NULL'}: ${row.count}`);
        });
        
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ خطأ:', error.message);
        throw error;
    } finally {
        client.release();
        await pool.end();
    }
}

fixDatabase()
    .then(() => {
        console.log('\n🎉 انتهت العملية بنجاح!');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n❌ فشلت العملية:', error);
        process.exit(1);
    });
