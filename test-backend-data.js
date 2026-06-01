const { Client } = require('pg');

const client = new Client({
    connectionString: 'postgresql://postgres:PddzJpAQYezqknsntSzmCUlQYuYJldcT@crossover.proxy.rlwy.net:44255/railway',
    ssl: { rejectUnauthorized: false }
});

async function testBackend() {
    try {
        await client.connect();
        console.log('✅ تم الاتصال بقاعدة البيانات\n');
        console.log('='.repeat(60));

        const tables = [
            { name: 'executive_kpis', arabicName: 'مؤشرات الأداء التنفيذي' },
            { name: 'executive_goals', arabicName: 'الأهداف التنفيذية' },
            { name: 'executive_operations', arabicName: 'العمليات التنفيذية' },
            { name: 'digital_marketing_campaigns', arabicName: 'التسويق الإلكتروني' },
            { name: 'community_marketing', arabicName: 'التسويق المجتمعي' },
            { name: 'event_marketing', arabicName: 'التسويق عبر الفعاليات' },
            { name: 'training_courses', arabicName: 'الدورات التدريبية' },
            { name: 'skills_registry', arabicName: 'المهارات' },
            { name: 'financial_policies', arabicName: 'السياسات المالية' },
            { name: 'financial_operating_manual', arabicName: 'دليل التشغيل المالي' },
            { name: 'financial_news', arabicName: 'الأخبار المالية' },
            { name: 'development_programs', arabicName: 'البرامج التطويرية' },
            { name: 'quality_standards', arabicName: 'معايير الجودة' },
            { name: 'quality_audits', arabicName: 'عمليات التدقيق' },
            { name: 'general_evaluations', arabicName: 'التقييمات' },
            { name: 'information_repository', arabicName: 'مستودع المعلومات' },
            { name: 'knowledge_base', arabicName: 'قاعدة المعرفة' }
        ];

        console.log('🧪 اختبار الجداول والبيانات:\n');

        let totalRecords = 0;
        let successCount = 0;

        for (const table of tables) {
            try {
                const result = await client.query(`SELECT COUNT(*) FROM ${table.name}`);
                const count = parseInt(result.rows[0].count);
                totalRecords += count;
                
                if (count > 0) {
                    console.log(`✅ ${table.arabicName}: ${count} سجل`);
                    
                    // جلب مثال
                    const sample = await client.query(`SELECT * FROM ${table.name} LIMIT 1`);
                    if (sample.rows.length > 0) {
                        const cols = Object.keys(sample.rows[0]).slice(0, 3);
                        console.log(`   مثال: ${cols.join(', ')}`);
                    }
                    successCount++;
                } else {
                    console.log(`⚠️  ${table.arabicName}: لا توجد بيانات`);
                }
            } catch (error) {
                console.log(`❌ ${table.arabicName}: خطأ - ${error.message}`);
            }
            console.log('');
        }

        console.log('='.repeat(60));
        console.log(`\n📊 ملخص:`);
        console.log(`   الجداول المكتملة: ${successCount}/${tables.length}`);
        console.log(`   إجمالي السجلات: ${totalRecords}`);
        console.log(`   النسبة: ${((successCount / tables.length) * 100).toFixed(1)}%`);

        if (successCount === tables.length) {
            console.log('\n🎉 جميع الجداول تحتوي على بيانات!');
        }

    } catch (error) {
        console.error('❌ خطأ:', error.message);
        throw error;
    } finally {
        await client.end();
    }
}

testBackend();
