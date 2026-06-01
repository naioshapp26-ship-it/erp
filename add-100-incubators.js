const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://postgres:PddzJpAQYezqknsntSzmCUlQYuYJldcT@crossover.proxy.rlwy.net:44255/railway'
});

// قائمة الحاضنات الـ 100
const incubators = [
  // حاضنات تقنية (1-20)
  { num: 1, name: 'حاضنة التكنولوجيا المتقدمة', code: 'ADV_TECH_INC_001', type: 'تقنية' },
  { num: 2, name: 'مركز ابتكار البرمجيات', code: 'SOFTWARE_INNOV_002', type: 'تقنية' },
  { num: 3, name: 'حاضنة الذكاء الاصطناعي', code: 'AI_INCUBATOR_003', type: 'تقنية' },
  { num: 4, name: 'مركز الحوسبة السحابية', code: 'CLOUD_CENTER_004', type: 'تقنية' },
  { num: 5, name: 'حاضنة الأمن السيبراني', code: 'CYBER_SEC_INC_005', type: 'تقنية' },
  { num: 6, name: 'مركز إنترنت الأشياء', code: 'IOT_CENTER_006', type: 'تقنية' },
  { num: 7, name: 'حاضنة البلوك تشين', code: 'BLOCKCHAIN_INC_007', type: 'تقنية' },
  { num: 8, name: 'مركز تطوير التطبيقات', code: 'APP_DEV_CTR_008', type: 'تقنية' },
  { num: 9, name: 'حاضنة الواقع الافتراضي', code: 'VR_INCUBATOR_009', type: 'تقنية' },
  { num: 10, name: 'مركز علوم البيانات', code: 'DATA_SCI_CTR_010', type: 'تقنية' },
  { num: 11, name: 'حاضنة الروبوتات', code: 'ROBOTICS_INC_011', type: 'تقنية' },
  { num: 12, name: 'مركز تطوير الألعاب', code: 'GAME_DEV_CTR_012', type: 'تقنية' },
  { num: 13, name: 'حاضنة التجارة الإلكترونية', code: 'ECOMMERCE_INC_013', type: 'تقنية' },
  { num: 14, name: 'مركز التحول الرقمي', code: 'DIGITAL_TRANS_014', type: 'تقنية' },
  { num: 15, name: 'حاضنة الحلول الذكية', code: 'SMART_SOL_INC_015', type: 'تقنية' },
  { num: 16, name: 'مركز الابتكار التقني', code: 'TECH_INNOV_016', type: 'تقنية' },
  { num: 17, name: 'حاضنة الأنظمة المدمجة', code: 'EMBEDDED_SYS_017', type: 'تقنية' },
  { num: 18, name: 'مركز تطوير الويب', code: 'WEB_DEV_CTR_018', type: 'تقنية' },
  { num: 19, name: 'حاضنة الحوسبة الكمية', code: 'QUANTUM_COMP_019', type: 'تقنية' },
  { num: 20, name: 'مركز الابتكار الرقمي', code: 'DIGITAL_INNOV_020', type: 'تقنية' },

  // حاضنات طبية وصحية (21-35)
  { num: 21, name: 'حاضنة التكنولوجيا الطبية', code: 'MEDTECH_INC_021', type: 'صحية' },
  { num: 22, name: 'مركز الابتكار الصحي', code: 'HEALTH_INNOV_022', type: 'صحية' },
  { num: 23, name: 'حاضنة الأجهزة الطبية', code: 'MED_DEVICE_023', type: 'صحية' },
  { num: 24, name: 'مركز الصحة الرقمية', code: 'DIGITAL_HEALTH_024', type: 'صحية' },
  { num: 25, name: 'حاضنة التشخيص المبكر', code: 'EARLY_DIAG_025', type: 'صحية' },
  { num: 26, name: 'مركز الطب الدقيق', code: 'PRECISION_MED_026', type: 'صحية' },
  { num: 27, name: 'حاضنة الأدوية الحيوية', code: 'BIOTECH_PHARMA_027', type: 'صحية' },
  { num: 28, name: 'مركز العلاج الجيني', code: 'GENE_THERAPY_028', type: 'صحية' },
  { num: 29, name: 'حاضنة الصحة العقلية', code: 'MENTAL_HEALTH_029', type: 'صحية' },
  { num: 30, name: 'مركز التأهيل الطبي', code: 'MED_REHAB_030', type: 'صحية' },
  { num: 31, name: 'حاضنة التغذية العلاجية', code: 'THERAPEUTIC_NUT_031', type: 'صحية' },
  { num: 32, name: 'مركز العناية الصحية', code: 'HEALTHCARE_032', type: 'صحية' },
  { num: 33, name: 'حاضنة الطب البديل', code: 'ALT_MED_INC_033', type: 'صحية' },
  { num: 34, name: 'مركز الرعاية المنزلية', code: 'HOME_CARE_034', type: 'صحية' },
  { num: 35, name: 'حاضنة الصحة الوقائية', code: 'PREV_HEALTH_035', type: 'صحية' },

  // حاضنات طاقة وبيئة (36-50)
  { num: 36, name: 'حاضنة الطاقة المتجددة', code: 'RENEWABLE_ENRG_036', type: 'طاقة' },
  { num: 37, name: 'مركز الطاقة الشمسية', code: 'SOLAR_ENERGY_037', type: 'طاقة' },
  { num: 38, name: 'حاضنة طاقة الرياح', code: 'WIND_ENERGY_038', type: 'طاقة' },
  { num: 39, name: 'مركز كفاءة الطاقة', code: 'ENERGY_EFF_039', type: 'طاقة' },
  { num: 40, name: 'حاضنة الطاقة الحيوية', code: 'BIO_ENERGY_040', type: 'طاقة' },
  { num: 41, name: 'مركز تدوير النفايات', code: 'WASTE_RECYCLING_041', type: 'بيئية' },
  { num: 42, name: 'حاضنة الحلول البيئية', code: 'ECO_SOLUTIONS_042', type: 'بيئية' },
  { num: 43, name: 'مركز المياه النظيفة', code: 'CLEAN_WATER_043', type: 'بيئية' },
  { num: 44, name: 'حاضنة الزراعة المستدامة', code: 'SUSTAINABLE_AGR_044', type: 'بيئية' },
  { num: 45, name: 'مركز الهواء النقي', code: 'CLEAN_AIR_045', type: 'بيئية' },
  { num: 46, name: 'حاضنة التصميم الأخضر', code: 'GREEN_DESIGN_046', type: 'بيئية' },
  { num: 47, name: 'مركز الاستدامة البيئية', code: 'ECO_SUSTAIN_047', type: 'بيئية' },
  { num: 48, name: 'حاضنة التنوع الحيوي', code: 'BIODIVERSITY_048', type: 'بيئية' },
  { num: 49, name: 'مركز حماية البيئة', code: 'ENV_PROTECT_049', type: 'بيئية' },
  { num: 50, name: 'حاضنة المدن الذكية', code: 'SMART_CITIES_050', type: 'بيئية' },

  // حاضنات صناعة وتصنيع (51-65)
  { num: 51, name: 'حاضنة التصنيع الذكي', code: 'SMART_MANUFACT_051', type: 'صناعية' },
  { num: 52, name: 'مركز الصناعة الرابعة', code: 'INDUSTRY_4_052', type: 'صناعية' },
  { num: 53, name: 'حاضنة الطباعة ثلاثية الأبعاد', code: '3D_PRINT_053', type: 'صناعية' },
  { num: 54, name: 'مركز التصنيع المضاف', code: 'ADDITIVE_MANUF_054', type: 'صناعية' },
  { num: 55, name: 'حاضنة المواد المتقدمة', code: 'ADV_MATERIALS_055', type: 'صناعية' },
  { num: 56, name: 'مركز الهندسة الدقيقة', code: 'PRECISION_ENG_056', type: 'صناعية' },
  { num: 57, name: 'حاضنة الميكاترونيكس', code: 'MECHATRONICS_057', type: 'صناعية' },
  { num: 58, name: 'مركز الأتمتة الصناعية', code: 'IND_AUTOMATION_058', type: 'صناعية' },
  { num: 59, name: 'حاضنة معالجة المعادن', code: 'METAL_PROCESS_059', type: 'صناعية' },
  { num: 60, name: 'مركز هندسة البوليمرات', code: 'POLYMER_ENG_060', type: 'صناعية' },
  { num: 61, name: 'حاضنة صناعة الإلكترونيات', code: 'ELECTRONICS_MFG_061', type: 'صناعية' },
  { num: 62, name: 'مركز التصنيع الحيوي', code: 'BIO_MANUFACTUR_062', type: 'صناعية' },
  { num: 63, name: 'حاضنة النانوتكنولوجي', code: 'NANOTECH_INC_063', type: 'صناعية' },
  { num: 64, name: 'مركز تطوير المنتجات', code: 'PRODUCT_DEV_064', type: 'صناعية' },
  { num: 65, name: 'حاضنة التصميم الصناعي', code: 'IND_DESIGN_065', type: 'صناعية' },

  // حاضنات تعليم وتدريب (66-75)
  { num: 66, name: 'حاضنة التعليم التقني', code: 'TECH_EDU_066', type: 'تعليمية' },
  { num: 67, name: 'مركز التدريب المهني', code: 'VOC_TRAINING_067', type: 'تعليمية' },
  { num: 68, name: 'حاضنة التطوير الإداري', code: 'MGMT_DEV_068', type: 'تعليمية' },
  { num: 69, name: 'مركز القيادة والريادة', code: 'LEADERSHIP_069', type: 'تعليمية' },
  { num: 70, name: 'حاضنة المهارات الرقمية', code: 'DIGITAL_SKILLS_070', type: 'تعليمية' },
  { num: 71, name: 'مركز ريادة الأعمال', code: 'ENTREPRENEURSHIP_071', type: 'تعليمية' },
  { num: 72, name: 'حاضنة الإبداع والابتكار', code: 'CREATIVITY_072', type: 'تعليمية' },
  { num: 73, name: 'مركز تطوير الأعمال', code: 'BUS_DEV_073', type: 'تعليمية' },
  { num: 74, name: 'حاضنة التسويق الرقمي', code: 'DIGITAL_MKTG_074', type: 'تعليمية' },
  { num: 75, name: 'مركز الابتكار الاجتماعي', code: 'SOCIAL_INNOV_075', type: 'تعليمية' },

  // حاضنات زراعة وغذاء (76-85)
  { num: 76, name: 'حاضنة التقنية الزراعية', code: 'AGRITECH_076', type: 'زراعية' },
  { num: 77, name: 'مركز الزراعة الذكية', code: 'SMART_FARMING_077', type: 'زراعية' },
  { num: 78, name: 'حاضنة الزراعة المائية', code: 'HYDROPONICS_078', type: 'زراعية' },
  { num: 79, name: 'مركز أمن الغذاء', code: 'FOOD_SECURITY_079', type: 'زراعية' },
  { num: 80, name: 'حاضنة تكنولوجيا الغذاء', code: 'FOODTECH_080', type: 'زراعية' },
  { num: 81, name: 'مركز الثروة الحيوانية', code: 'LIVESTOCK_081', type: 'زراعية' },
  { num: 82, name: 'حاضنة الثروة السمكية', code: 'AQUACULTURE_082', type: 'زراعية' },
  { num: 83, name: 'مركز الصناعات الغذائية', code: 'FOOD_IND_083', type: 'زراعية' },
  { num: 84, name: 'حاضنة الأغذية العضوية', code: 'ORGANIC_FOOD_084', type: 'زراعية' },
  { num: 85, name: 'مركز سلامة الغذاء', code: 'FOOD_SAFETY_085', type: 'زراعية' },

  // حاضنات خدمات مالية (86-92)
  { num: 86, name: 'حاضنة التكنولوجيا المالية', code: 'FINTECH_086', type: 'مالية' },
  { num: 87, name: 'مركز الشمول المالي', code: 'FIN_INCLUSION_087', type: 'مالية' },
  { num: 88, name: 'حاضنة التأمين التقني', code: 'INSURTECH_088', type: 'مالية' },
  { num: 89, name: 'مركز المدفوعات الرقمية', code: 'DIGITAL_PAYMENTS_089', type: 'مالية' },
  { num: 90, name: 'حاضنة الاستثمار الذكي', code: 'SMART_INVEST_090', type: 'مالية' },
  { num: 91, name: 'مركز إدارة الثروات', code: 'WEALTH_MGMT_091', type: 'مالية' },
  { num: 92, name: 'حاضنة التمويل البديل', code: 'ALT_FINANCE_092', type: 'مالية' },

  // حاضنات لوجستية ونقل (93-100)
  { num: 93, name: 'حاضنة اللوجستيات الذكية', code: 'SMART_LOGISTICS_093', type: 'لوجستية' },
  { num: 94, name: 'مركز سلسلة التوريد', code: 'SUPPLY_CHAIN_094', type: 'لوجستية' },
  { num: 95, name: 'حاضنة النقل الذكي', code: 'SMART_TRANSPORT_095', type: 'لوجستية' },
  { num: 96, name: 'مركز إدارة الأسطول', code: 'FLEET_MGMT_096', type: 'لوجستية' },
  { num: 97, name: 'حاضنة التوصيل السريع', code: 'FAST_DELIVERY_097', type: 'لوجستية' },
  { num: 98, name: 'مركز الشحن الدولي', code: 'INTL_SHIPPING_098', type: 'لوجستية' },
  { num: 99, name: 'حاضنة المخازن الذكية', code: 'SMART_WAREHOUSE_099', type: 'لوجستية' },
  { num: 100, name: 'مركز التتبع والتوزيع', code: 'TRACK_DISTRIB_100', type: 'لوجستية' }
];

async function addIncubators() {
  const client = await pool.connect();
  
  try {
    console.log('🚀 بدء إضافة الحاضنات إلى قاعدة البيانات...\n');
    console.log('='.repeat(60));
    
    // الحصول على أول فرع
    const branches = await client.query('SELECT id, name FROM branches ORDER BY id LIMIT 1');
    
    if (branches.rowCount === 0) {
      console.log('❌ لا توجد فروع في قاعدة البيانات');
      return;
    }
    
    const branchId = branches.rows[0].id;
    const branchName = branches.rows[0].name;
    console.log(`✅ استخدام الفرع: ${branchName} (ID: ${branchId})\n`);
    
    let successCount = 0;
    let failCount = 0;
    const typeCount = {};
    
    // إضافة كل حاضنة
    for (const incubator of incubators) {
      try {
        await client.query(`
          INSERT INTO incubators (
            branch_id,
            name,
            code,
            description,
            program_type,
            capacity,
            is_active
          ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        `, [
          branchId,
          incubator.name,
          incubator.code,
          `${incubator.name} - ${incubator.type}`,
          incubator.type,
          100,
          true
        ]);
        
        successCount++;
        
        // عد الحاضنات حسب النوع
        if (!typeCount[incubator.type]) {
          typeCount[incubator.type] = 0;
        }
        typeCount[incubator.type]++;
        
        console.log(`✅ ${incubator.num}. ${incubator.name} - ${incubator.type}`);
        
      } catch (error) {
        failCount++;
        console.log(`❌ ${incubator.num}. ${incubator.name} - فشل: ${error.message}`);
      }
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('📊 ملخص الإضافة');
    console.log('='.repeat(60));
    console.log(`✅ نجح: ${successCount} حاضنة`);
    console.log(`❌ فشل: ${failCount} حاضنة`);
    console.log(`📈 الإجمالي: ${incubators.length} حاضنة`);
    
    console.log('\n📊 توزيع الحاضنات حسب النوع:');
    console.log('-'.repeat(60));
    Object.keys(typeCount).sort().forEach(type => {
      console.log(`  ${type}: ${typeCount[type]} حاضنة`);
    });
    
    // التحقق من إجمالي الحاضنات
    const totalIncubators = await client.query('SELECT COUNT(*) FROM incubators');
    console.log('\n' + '='.repeat(60));
    console.log(`📊 إجمالي الحاضنات في قاعدة البيانات: ${totalIncubators.rows[0].count}`);
    console.log('='.repeat(60));
    
  } catch (error) {
    console.error('\n❌ خطأ في إضافة الحاضنات:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// تشغيل الإضافة
addIncubators()
  .then(() => {
    console.log('\n🎉 اكتمل إضافة الحاضنات بنجاح!');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ فشل في إضافة الحاضنات:', error);
    process.exit(1);
  });
