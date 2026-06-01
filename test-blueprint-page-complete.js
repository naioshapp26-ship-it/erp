#!/usr/bin/env node
/**
 * 🧪 اختبار شامل لصفحة المخطط التنفيذي
 * يختبر جميع الوظائف والواجهات قبل النشر
 */

const BASE_URL = 'https://super-cmk2wuy9-production.up.railway.app';

async function testAPI(name, url) {
    try {
        const response = await fetch(url, {
            headers: {
                'x-entity-id': 'HQ001',
                'x-entity-type': 'HQ'
            }
        });
        const data = await response.json();
        
        if (response.ok && data.success !== false) {
            const count = data.customers?.length || data.invoices?.length || data.payments?.length || 
                          data.plans?.length || data.accounts?.length || data.entries?.length || 
                          data.rows?.length || data.forecasts?.length || data.budgets?.length || 0;
            console.log(`✅ ${name}: ${count} سجل`);
            return { success: true, count };
        } else {
            console.log(`❌ ${name}: ${data.error || 'خطأ غير معروف'}`);
            return { success: false };
        }
    } catch (error) {
        console.log(`❌ ${name}: ${error.message}`);
        return { success: false };
    }
}

async function runTests() {
    console.log('='.repeat(60));
    console.log('🧪 اختبار شامل لصفحة المخطط التنفيذي (الصفحة 35)');
    console.log('='.repeat(60));
    console.log('');

    console.log('📡 اختبار الواجهات الخلفية:');
    console.log('-'.repeat(60));

    const tests = [
        { name: 'العملاء', url: `${BASE_URL}/finance/customers` },
        { name: 'الفواتير', url: `${BASE_URL}/finance/invoices` },
        { name: 'المدفوعات', url: `${BASE_URL}/finance/payments` },
        { name: 'خطط السداد', url: `${BASE_URL}/finance/payment-plans?entity_id=HQ001` },
        { name: 'شجرة الحسابات', url: `${BASE_URL}/finance/accounts?entity_id=HQ001` },
        { name: 'القيود المحاسبية', url: `${BASE_URL}/finance/journal/entries?entity_id=HQ001` },
        { name: 'سطور القيود', url: `${BASE_URL}/finance/journal-lines?entity_id=HQ001` },
        { name: 'الميزانيات', url: `${BASE_URL}/finance/budgets?entity_id=HQ001` },
        { name: 'تقييمات المخاطر', url: `${BASE_URL}/finance/ai-risk-scores?entity_id=HQ001` },
        { name: 'التوقعات الذكية', url: `${BASE_URL}/finance/ai-forecasts?entity_id=HQ001` }
    ];

    const results = [];
    for (const test of tests) {
        const result = await testAPI(test.name, test.url);
        results.push(result);
    }

    console.log('');
    console.log('📋 اختبار محتوى الصفحة المحلية:');
    console.log('-'.repeat(60));

    const fs = require('fs');
    const html = fs.readFileSync('./finance/system-blueprint-execution.html', 'utf8');

    const pageChecks = [
        { name: 'زر إضافة عميل', check: html.includes('إضافة عميل') && html.includes('addCustomer()') },
        { name: 'زر إضافة فاتورة', check: html.includes('إضافة فاتورة') && html.includes('addInvoice()') },
        { name: 'زر إضافة مدفوعة', check: html.includes('إضافة مدفوعة') && html.includes('addPayment()') },
        { name: 'زر إضافة خطة', check: html.includes('إضافة خطة') && html.includes('addPlan()') },
        { name: 'وظيفة المعاينة', check: html.includes('viewRecord') },
        { name: 'وظيفة التعديل', check: html.includes('editRecord') },
        { name: 'وظيفة الحذف', check: html.includes('deleteRecord') },
        { name: 'عمود الإجراءات', check: html.includes('الإجراءات') },
        { name: 'أيقونات Font Awesome', check: html.includes('fa-eye') && html.includes('fa-edit') && html.includes('fa-trash') },
        { name: 'ربط entity_id', check: html.includes('getFinanceEntityId') && html.includes('HQ001') },
        { name: 'ربط API_HEADERS', check: html.includes('API_HEADERS') && html.includes('x-entity-id') }
    ];

    pageChecks.forEach(check => {
        if (check.check) {
            console.log(`✅ ${check.name}`);
        } else {
            console.log(`❌ ${check.name}`);
        }
    });

    console.log('');
    console.log('='.repeat(60));
    console.log('📊 ملخص النتائج:');
    console.log('='.repeat(60));

    const apiSuccess = results.filter(r => r.success).length;
    const apiTotal = results.length;
    const pageSuccess = pageChecks.filter(c => c.check).length;
    const pageTotal = pageChecks.length;

    console.log(`✅ الواجهات الخلفية: ${apiSuccess}/${apiTotal} (${((apiSuccess/apiTotal)*100).toFixed(0)}%)`);
    console.log(`✅ محتوى الصفحة: ${pageSuccess}/${pageTotal} (${((pageSuccess/pageTotal)*100).toFixed(0)}%)`);
    console.log('');

    const totalRecords = results.reduce((sum, r) => sum + (r.count || 0), 0);
    console.log(`📦 إجمالي البيانات المتاحة: ${totalRecords} سجل`);
    console.log('');

    if (apiSuccess === apiTotal && pageSuccess === pageTotal) {
        console.log('✅ جميع الاختبارات نجحت! الصفحة جاهزة للنشر.');
        console.log('');
        console.log('💡 للنشر، قم بتنفيذ:');
        console.log('   git add finance/system-blueprint-execution.html');
        console.log('   git commit -m "إضافة أزرار CRUD كاملة للصفحة 35"');
        console.log('   git push origin main');
        console.log('');
        process.exit(0);
    } else {
        console.log('⚠️  بعض الاختبارات فشلت. يرجى المراجعة.');
        process.exit(1);
    }
}

runTests().catch(console.error);
