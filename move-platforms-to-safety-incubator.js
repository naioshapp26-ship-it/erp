/**
 * Script: Move All 7 Platforms to Safety Incubator
 * تحديث جميع المنصات (7 منصات) لربطها بحاضنة السلامة والصحة المهنية
 * 
 * تم نقل:
 * - منصة التدريب المهني (من حاضنة الرياض للأعمال إلى حاضنة السلامة)
 * - منصة التجارة الإلكترونية (من حاضنة الرياض للأعمال إلى حاضنة السلامة)
 * - منصة الذكاء الاصطناعي (من حاضنة القاهرة للتقنية إلى حاضنة السلامة)
 * - منصة الابتكار الاجتماعي (من حاضنة دبي للابتكار إلى حاضنة السلامة)
 * 
 * والـ 3 منصات الأخرى كانت بالفعل تحت حاضنة السلامة:
 * - منصة التدريب الأساسي في السلامة
 * - منصة مكافحة الحرائق والإطفاء
 * - منصة الإسعافات الأولية
 */

const db = require('./db');

async function moveAllPlatformsToSafetyIncubator() {
    console.log('🚀 نقل جميع 7 منصات إلى حاضنة السلامة والصحة المهنية\n');
    
    try {
        const SAFETY_INCUBATOR_ID = 6;
        
        // الحصول على جميع المنصات
        const platformsRes = await db.query(`
            SELECT id, name, incubator_id 
            FROM platforms 
            WHERE is_active = true
        `);
        
        console.log(`📋 تم العثور على ${platformsRes.rows.length} منصات\n`);
        
        // نقل المنصات التي ليست تحت حاضنة السلامة
        let movedCount = 0;
        
        for (const platform of platformsRes.rows) {
            if (platform.incubator_id !== SAFETY_INCUBATOR_ID) {
                console.log(`🔄 نقل: "${platform.name}" من حاضنة #${platform.incubator_id} → حاضنة #${SAFETY_INCUBATOR_ID}`);
                
                await db.query(`
                    UPDATE platforms
                    SET incubator_id = $1, updated_at = CURRENT_TIMESTAMP
                    WHERE id = $2
                `, [SAFETY_INCUBATOR_ID, platform.id]);
                
                console.log(`   ✅ تم النقل بنجاح`);
                movedCount++;
            } else {
                console.log(`✅ "${platform.name}" موجودة بالفعل في حاضنة السلامة`);
            }
        }
        
        console.log(`\n📊 النتيجة: تم نقل ${movedCount} منصة`);
        console.log(`✅ جميع الـ 7 منصات تابعة الآن لحاضنة السلامة والصحة المهنية!\n`);
        
    } catch (error) {
        console.error('❌ خطأ:', error.message);
    } finally {
        process.exit(0);
    }
}

// تشغيل الـ script إذا تم استدعاؤه مباشرة
if (require.main === module) {
    moveAllPlatformsToSafetyIncubator();
}

module.exports = { moveAllPlatformsToSafetyIncubator };
