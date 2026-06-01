const { Pool } = require('pg');

const pool = new Pool({
    connectionString: 'postgresql://postgres:PddzJpAQYezqknsntSzmCUlQYuYJldcT@crossover.proxy.rlwy.net:44255/railway',
    ssl: { rejectUnauthorized: false }
});

const newIncubators = [
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

async function replaceIncubators() {
    const client = await pool.connect();
    
    try {
        await client.query('BEGIN');
        
        console.log('🔄 جاري حذف الحاضنات القديمة...');
        
        // Get old incubators count
        const oldCountResult = await client.query('SELECT COUNT(*) FROM incubators');
        console.log(`   📊 عدد الحاضنات القديمة: ${oldCountResult.rows[0].count}`);
        
        // We need to only update incubators, not delete all entities
        // First, get existing entity IDs that reference incubators
        console.log('   🔄 تحديث الكيانات المرتبطة...');
        await client.query('UPDATE entities SET incubator_id = NULL WHERE incubator_id IS NOT NULL');
        
        // Delete platforms
        console.log('   🔄 حذف المنصات...');
        await client.query('DELETE FROM platforms');
        
        // Now we can delete old incubators
        const deleteResult = await client.query('DELETE FROM incubators');
        console.log(`   ✅ تم حذف ${deleteResult.rowCount} حاضنة`);
        
        console.log('\n🔄 جاري إضافة الحاضنات الجديدة...');
        
        // Get all branches
        const branchesResult = await client.query('SELECT id, name FROM branches ORDER BY id');
        const branches = branchesResult.rows;
        console.log(`   📊 عدد الفروع: ${branches.length}`);
        
        let insertedCount = 0;
        
        // Insert each incubator for each branch
        for (const incubatorName of newIncubators) {
            for (const branch of branches) {
                const code = `INC-${branch.id}-${String(insertedCount + 1).padStart(3, '0')}`;
                
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
                    branch.id,
                    incubatorName,
                    code,
                    `حاضنة ${incubatorName} - ${branch.name}`,
                    'MIXED',
                    100,
                    `${code.toLowerCase()}@nayosh.com`,
                    '+966 50 000 0000',
                    'مدير الحاضنة',
                    true
                ]);
                
                const incubatorId = incubatorResult.rows[0].id;
                
                // Create entity ID for this incubator
                const entityId = `INC-${String(insertedCount + 1).padStart(4, '0')}`;
                
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
                    branch.id,
                    incubatorId,
                    'Active',
                    0,
                    branch.name,
                    0,
                    'PRO',
                    'red'
                ]);
                
                insertedCount++;
            }
        }
        
        console.log(`   ✅ تم إضافة ${insertedCount} حاضنة`);
        
        await client.query('COMMIT');
        
        console.log('\n✅ تمت العملية بنجاح!');
        console.log(`   📊 عدد الحاضنات الجديدة: ${newIncubators.length}`);
        console.log(`   📊 عدد الفروع: ${branches.length}`);
        console.log(`   📊 إجمالي السجلات المضافة: ${insertedCount}`);
        
        // Verify
        const newCountResult = await client.query('SELECT COUNT(*) FROM incubators');
        console.log(`\n🔍 التحقق النهائي:`);
        console.log(`   📊 عدد الحاضنات في قاعدة البيانات: ${newCountResult.rows[0].count}`);
        
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ خطأ:', error.message);
        throw error;
    } finally {
        client.release();
        await pool.end();
    }
}

replaceIncubators()
    .then(() => {
        console.log('\n🎉 انتهت العملية بنجاح!');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n❌ فشلت العملية:', error);
        process.exit(1);
    });
