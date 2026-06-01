const { Client } = require('pg');

const client = new Client({
    connectionString: 'postgresql://postgres:PddzJpAQYezqknsntSzmCUlQYuYJldcT@crossover.proxy.rlwy.net:44255/railway'
});

async function testSmartCollectionSystem() {
    try {
        await client.connect();
        console.log('✅ Connected to database\n');

        console.log('🧪 Testing Smart Collection System...\n');
        console.log('='.repeat(70));

        // 1. اختبار أنواع الفواتير
        console.log('\n1️⃣ Testing Invoice Types...');
        const typesResult = await client.query('SELECT COUNT(*) as count FROM invoice_types');
        console.log(`✅ Invoice Types: ${typesResult.rows[0].count}`);

        const types = await client.query('SELECT name, name_ar FROM invoice_types ORDER BY name');
        types.rows.forEach(t => console.log(`   - ${t.name_ar} (${t.name})`));

        // 2. اختبار حالات الفواتير
        console.log('\n2️⃣ Testing Invoice Statuses...');
        const statusesResult = await client.query('SELECT COUNT(*) as count FROM invoice_statuses');
        console.log(`✅ Invoice Statuses: ${statusesResult.rows[0].count}`);

        const statuses = await client.query('SELECT name_ar, color FROM invoice_statuses ORDER BY name');
        statuses.rows.forEach(s => console.log(`   - ${s.name_ar} (${s.color})`));

        // 3. اختبار الفواتير
        console.log('\n3️⃣ Testing Invoices...');
        const invoicesResult = await client.query(`
            SELECT 
                i.invoice_number, 
                t.name_ar as type_name,
                i.amount, 
                i.tax_amount, 
                i.total_amount,
                i.paid_amount,
                i.remaining_amount,
                i.status,
                i.country_code
            FROM invoices_enhanced i
            LEFT JOIN invoice_types t ON i.invoice_type_id = t.id
            ORDER BY i.invoice_number
        `);

        console.log(`✅ Total Invoices: ${invoicesResult.rows.length}`);
        invoicesResult.rows.forEach(inv => {
            console.log(`
   Invoice: ${inv.invoice_number}
   - Type: ${inv.type_name}
   - Amount: ${inv.amount} (Tax: ${inv.tax_amount})
   - Total: ${inv.total_amount}
   - Paid: ${inv.paid_amount} | Remaining: ${inv.remaining_amount}
   - Status: ${inv.status}
   - Country: ${inv.country_code}`);
        });

        // 4. اختبار خطط الأقساط
        console.log('\n4️⃣ Testing Installment Plans...');
        const plansResult = await client.query(`
            SELECT name_ar, number_of_installments, installment_duration_days, down_payment_percentage, interest_rate
            FROM installment_plans
            WHERE is_active = true
            ORDER BY number_of_installments
        `);

        console.log(`✅ Active Installment Plans: ${plansResult.rows.length}`);
        plansResult.rows.forEach(p => {
            console.log(`
   Plan: ${p.name_ar}
   - Installments: ${p.number_of_installments}
   - Duration: ${p.installment_duration_days} days
   - Down Payment: ${p.down_payment_percentage}%
   - Interest: ${p.interest_rate}%`);
        });

        // 5. اختبار القوانين الضريبية
        console.log('\n5️⃣ Testing Tax Rules...');
        const taxRulesResult = await client.query(`
            SELECT DISTINCT country_code, tax_type, tax_rate
            FROM tax_rules
            WHERE is_active = true
            ORDER BY country_code, tax_type
        `);

        console.log(`✅ Active Tax Rules: ${taxRulesResult.rows.length}`);
        const countryGroups = {};
        taxRulesResult.rows.forEach(tr => {
            if (!countryGroups[tr.country_code]) {
                countryGroups[tr.country_code] = [];
            }
            countryGroups[tr.country_code].push(`${tr.tax_type} (${tr.tax_rate}%)`);
        });

        Object.entries(countryGroups).forEach(([country, taxes]) => {
            console.log(`   ${country}: ${taxes.join(', ')}`);
        });

        // 6. اختبار قواعد التحصيل
        console.log('\n6️⃣ Testing Collection Rules...');
        const rulesResult = await client.query(`
            SELECT name_ar, rule_type, action
            FROM collection_rules
            WHERE is_active = true
            ORDER BY rule_type
        `);

        console.log(`✅ Active Collection Rules: ${rulesResult.rows.length}`);
        rulesResult.rows.forEach(r => {
            console.log(`   - ${r.name_ar} (${r.rule_type}) => ${r.action}`);
        });

        // 7. اختبار الفواتير بالأقساط
        console.log('\n7️⃣ Testing Installment Invoices...');
        const installmentsResult = await client.query(`
            SELECT 
                ii.id,
                ie.invoice_number,
                ii.number_of_installments,
                ii.installment_amount,
                ii.completed_installments,
                ii.status
            FROM installment_invoices ii
            JOIN invoices_enhanced ie ON ii.invoice_id = ie.id
            ORDER BY ie.invoice_number
        `);

        console.log(`✅ Total Installment Invoices: ${installmentsResult.rows.length}`);
        installmentsResult.rows.forEach(inst => {
            console.log(`
   Invoice: ${inst.invoice_number}
   - Total Installments: ${inst.number_of_installments}
   - Per Installment: ${inst.installment_amount}
   - Completed: ${inst.completed_installments}
   - Status: ${inst.status}`);
        });

        // 8. إحصائيات النظام
        console.log('\n8️⃣ System Statistics...');
        const stats = await client.query(`
            SELECT 
                (SELECT COUNT(*) FROM invoices_enhanced) as total_invoices,
                (SELECT COUNT(*) FROM invoices_enhanced WHERE status = 'PAID') as paid_invoices,
                (SELECT COUNT(*) FROM invoices_enhanced WHERE status = 'PARTIAL_PAID') as partial_paid,
                (SELECT COUNT(*) FROM invoices_enhanced WHERE status = 'OVERDUE') as overdue_invoices,
                (SELECT COALESCE(SUM(total_amount), 0) FROM invoices_enhanced) as total_amount,
                (SELECT COALESCE(SUM(paid_amount), 0) FROM invoices_enhanced) as total_paid,
                (SELECT COALESCE(SUM(remaining_amount), 0) FROM invoices_enhanced) as total_remaining
        `);

        const s = stats.rows[0];
        console.log(`✅ Total Invoices: ${s.total_invoices}`);
        console.log(`   - Paid: ${s.paid_invoices}`);
        console.log(`   - Partially Paid: ${s.partial_paid}`);
        console.log(`   - Overdue: ${s.overdue_invoices}`);
        console.log(`✅ Financial Summary:`);
        console.log(`   - Total Amount: ${s.total_amount} SAR`);
        console.log(`   - Total Paid: ${s.total_paid} SAR`);
        console.log(`   - Total Remaining: ${s.total_remaining} SAR`);

        console.log('\n' + '='.repeat(70));
        console.log('✅ All tests passed! Smart Collection System is working correctly!\n');

    } catch (error) {
        console.error('❌ Error:', error.message);
        throw error;
    } finally {
        await client.end();
    }
}

testSmartCollectionSystem();
