const { Client } = require('pg');

const client = new Client({
    connectionString: 'postgresql://postgres:PddzJpAQYezqknsntSzmCUlQYuYJldcT@crossover.proxy.rlwy.net:44255/railway'
});

async function seedCollectionData() {
    try {
        await client.connect();
        console.log('✅ Connected to database\n');

        console.log('📊 Seeding Smart Collection System Data...\n');
        console.log('='.repeat(70));

        // 1. أنواع الفواتير
        console.log('\n1️⃣ Adding Invoice Types...');
        const invoiceTypes = [
            { name: 'FULL_PAYMENT', name_ar: 'دفع كامل', description: 'فاتورة تسدد بالكامل' },
            { name: 'PARTIAL_PAYMENT', name_ar: 'دفع جزئي', description: 'فاتورة تسدد بشكل جزئي' },
            { name: 'NO_PAYMENT', name_ar: 'بدون دفع', description: 'فاتورة بدون دفع' },
            { name: 'INSTALLMENT', name_ar: 'أقساط', description: 'فاتورة تسدد بالأقساط' },
            { name: 'CREDIT', name_ar: 'ائتمان', description: 'فاتورة بسياسة ائتمان' }
        ];

        for (const type of invoiceTypes) {
            await client.query(
                `INSERT INTO invoice_types (name, name_ar, description) 
                 VALUES ($1, $2, $3) 
                 ON CONFLICT (name) DO NOTHING`,
                [type.name, type.name_ar, type.description]
            );
        }
        console.log(`✅ Added ${invoiceTypes.length} invoice types`);

        // 2. حالات الفواتير
        console.log('\n2️⃣ Adding Invoice Statuses...');
        const statuses = [
            { name: 'DRAFT', name_ar: 'مسودة', color: 'gray' },
            { name: 'ISSUED', name_ar: 'مُصدرة', color: 'blue' },
            { name: 'PAID', name_ar: 'مدفوعة', color: 'green' },
            { name: 'PARTIAL_PAID', name_ar: 'مدفوعة جزئياً', color: 'yellow' },
            { name: 'OVERDUE', name_ar: 'متأخرة', color: 'red' },
            { name: 'CANCELLED', name_ar: 'ملغاة', color: 'gray' }
        ];

        for (const status of statuses) {
            await client.query(
                `INSERT INTO invoice_statuses (name, name_ar, color) 
                 VALUES ($1, $2, $3) 
                 ON CONFLICT (name) DO NOTHING`,
                [status.name, status.name_ar, status.color]
            );
        }
        console.log(`✅ Added ${statuses.length} invoice statuses`);

        // 3. نطاقات الأقساط
        console.log('\n3️⃣ Adding Installment Plans...');
        const plans = [
            { name: '3_MONTHS', name_ar: '3 أشهر', installments: 3, days: 30, down_payment: 0, interest: 0 },
            { name: '6_MONTHS', name_ar: '6 أشهر', installments: 6, days: 30, down_payment: 0, interest: 0 },
            { name: '12_MONTHS', name_ar: '12 شهر', installments: 12, days: 30, down_payment: 10, interest: 2 },
            { name: '24_MONTHS', name_ar: '24 شهر', installments: 24, days: 30, down_payment: 10, interest: 3 },
            { name: 'CUSTOM', name_ar: 'مخصص', installments: 0, days: 0, down_payment: 0, interest: 0 }
        ];

        for (const plan of plans) {
            await client.query(
                `INSERT INTO installment_plans 
                    (name, name_ar, number_of_installments, installment_duration_days, down_payment_percentage, interest_rate) 
                 VALUES ($1, $2, $3, $4, $5, $6) 
                 ON CONFLICT DO NOTHING`,
                [plan.name, plan.name_ar, plan.installments, plan.days, plan.down_payment, plan.interest]
            );
        }
        console.log(`✅ Added ${plans.length} installment plans`);

        // 4. القوانين الضريبية
        console.log('\n4️⃣ Adding Tax Rules...');
        const taxRules = [
            { country: 'SA', type: 'VAT', rate: 15, desc: 'ضريبة القيمة المضافة - السعودية' },
            { country: 'SA', type: 'ZAKAT', rate: 2.5, desc: 'الزكاة - السعودية' },
            { country: 'JO', type: 'VAT', rate: 16, desc: 'ضريبة القيمة المضافة - الأردن' },
            { country: 'IQ', type: 'VAT', rate: 10, desc: 'ضريبة القيمة المضافة - العراق' },
            { country: 'EG', type: 'VAT', rate: 14, desc: 'ضريبة القيمة المضافة - مصر' },
            { country: 'AE', type: 'VAT', rate: 5, desc: 'ضريبة القيمة المضافة - الإمارات' },
            { country: 'KW', type: 'VAT', rate: 0, desc: 'لا توجد ضريبة قيمة مضافة - الكويت' }
        ];

        for (const rule of taxRules) {
            await client.query(
                `INSERT INTO tax_rules (country_code, tax_type, tax_rate, description) 
                 VALUES ($1, $2, $3, $4) 
                 ON CONFLICT DO NOTHING`,
                [rule.country, rule.type, rule.rate, rule.desc]
            );
        }
        console.log(`✅ Added ${taxRules.length} tax rules`);

        // 5. قواعد التحصيل
        console.log('\n5️⃣ Adding Collection Rules...');
        const rules = [
            {
                name: 'FIRST_REMINDER',
                name_ar: 'التذكير الأول',
                type: 'AUTO_REMINDER',
                conditions: JSON.stringify({ days_overdue: 5 }),
                action: 'SEND_EMAIL'
            },
            {
                name: 'SECOND_REMINDER',
                name_ar: 'التذكير الثاني',
                type: 'AUTO_REMINDER',
                conditions: JSON.stringify({ days_overdue: 15 }),
                action: 'SEND_SMS_AND_EMAIL'
            },
            {
                name: 'FINAL_REMINDER',
                name_ar: 'التذكير النهائي',
                type: 'ESCALATION',
                conditions: JSON.stringify({ days_overdue: 30 }),
                action: 'ESCALATE_TO_MANAGER'
            },
            {
                name: 'LEGAL_ACTION',
                name_ar: 'إجراء قانوني',
                type: 'ESCALATION',
                conditions: JSON.stringify({ days_overdue: 60 }),
                action: 'LEGAL_PROCEDURE'
            },
            {
                name: 'EARLY_PAYMENT_DISCOUNT',
                name_ar: 'خصم الدفع المبكر',
                type: 'DISCOUNT',
                conditions: JSON.stringify({ days_before_due: 5 }),
                action: 'APPLY_DISCOUNT_5_PERCENT'
            }
        ];

        for (const rule of rules) {
            await client.query(
                `INSERT INTO collection_rules (name, name_ar, rule_type, conditions, action) 
                 VALUES ($1, $2, $3, $4, $5) 
                 ON CONFLICT DO NOTHING`,
                [rule.name, rule.name_ar, rule.type, rule.conditions, rule.action]
            );
        }
        console.log(`✅ Added ${rules.length} collection rules`);

        // 6. فاتورة اختبار (Full Payment)
        console.log('\n6️⃣ Adding Sample Invoices...');
        const invoiceType = await client.query(`SELECT id FROM invoice_types WHERE name = 'FULL_PAYMENT' LIMIT 1`);
        
        // تحقق من وجود فواتير موجودة بالفعل
        const existingInvoices = await client.query(`SELECT COUNT(*) as count FROM invoices_enhanced WHERE invoice_number LIKE 'INV-2026%'`);
        
        if (existingInvoices.rows[0].count > 0) {
            console.log(`✅ Sample invoices already exist (${existingInvoices.rows[0].count} invoices)`);
        } else {
            // الفاتورة الأولى: دفع كامل
            const fullPaymentInvoice = await client.query(
                `INSERT INTO invoices_enhanced 
                    (invoice_number, entity_id, customer_id, invoice_type_id, amount, tax_amount, total_amount, 
                     remaining_amount, status, currency, country_code, tax_type, tax_rate, due_date, issued_date, description)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
                 RETURNING id`,
                ['INV-2026-001', 'HQ001', 'CUST-001', invoiceType.rows[0].id, 10000, 1500, 11500, 
                 0, 'PAID', 'SAR', 'SA', 'VAT', 15, '2026-02-15', '2026-01-15', 'فاتورة دفع كامل للاختبار']
            );
            console.log('✅ Full Payment Invoice added (INV-2026-001)');

            // الفاتورة الثانية: دفع جزئي
            const partialType = await client.query(`SELECT id FROM invoice_types WHERE name = 'PARTIAL_PAYMENT' LIMIT 1`);
            
            const partialInvoice = await client.query(
                `INSERT INTO invoices_enhanced 
                    (invoice_number, entity_id, customer_id, invoice_type_id, amount, tax_amount, total_amount, 
                     remaining_amount, status, currency, country_code, tax_type, tax_rate, due_date, issued_date, description)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
                 RETURNING id`,
                ['INV-2026-002', 'HQ001', 'CUST-002', partialType.rows[0].id, 5000, 750, 5750, 
                 2875, 'PARTIAL_PAID', 'SAR', 'SA', 'VAT', 15, '2026-02-20', '2026-01-15', 'فاتورة دفع جزئي للاختبار']
            );
            console.log('✅ Partial Payment Invoice added (INV-2026-002)');

            // الفاتورة الثالثة: أقساط
            const installmentType = await client.query(`SELECT id FROM invoice_types WHERE name = 'INSTALLMENT' LIMIT 1`);
            const plan3Months = await client.query(`SELECT id FROM installment_plans WHERE name = '3_MONTHS' LIMIT 1`);
            
            const installmentInvoice = await client.query(
                `INSERT INTO invoices_enhanced 
                    (invoice_number, entity_id, customer_id, invoice_type_id, amount, tax_amount, total_amount, 
                     remaining_amount, status, currency, country_code, tax_type, tax_rate, due_date, issued_date, description)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
                 RETURNING id`,
                ['INV-2026-003', 'BR015', 'CUST-003', installmentType.rows[0].id, 30000, 4500, 34500, 
                 34500, 'ISSUED', 'SAR', 'SA', 'VAT', 15, '2026-04-15', '2026-01-15', 'فاتورة أقساط للاختبار']
            );
            
            // إضافة خطة الأقساط
            const nextDueDate = new Date('2026-02-15');
            await client.query(
                `INSERT INTO installment_invoices 
                    (invoice_id, plan_id, number_of_installments, installment_amount, next_due_date, status)
                 VALUES ($1, $2, $3, $4, $5, $6)`,
                [installmentInvoice.rows[0].id, plan3Months.rows[0].id, 3, 11500, nextDueDate, 'ACTIVE']
            );
            
            console.log('✅ Installment Invoice added (INV-2026-003) with 3-month plan');
        }

        // الملخص
        console.log('\n' + '='.repeat(70));
        console.log('📊 Collection System Summary:');
        console.log('='.repeat(70));
        
        const summary = await client.query(`
            SELECT 
                (SELECT COUNT(*) FROM invoice_types) as invoice_types,
                (SELECT COUNT(*) FROM invoice_statuses) as invoice_statuses,
                (SELECT COUNT(*) FROM installment_plans) as installment_plans,
                (SELECT COUNT(*) FROM tax_rules) as tax_rules,
                (SELECT COUNT(*) FROM collection_rules) as collection_rules,
                (SELECT COUNT(*) FROM invoices_enhanced) as invoices,
                (SELECT COUNT(*) FROM payments) as payments,
                (SELECT COUNT(*) FROM installment_invoices) as installment_invoices
        `);
        
        const stats = summary.rows[0];
        console.log(`✅ Invoice Types: ${stats.invoice_types}`);
        console.log(`✅ Invoice Statuses: ${stats.invoice_statuses}`);
        console.log(`✅ Installment Plans: ${stats.installment_plans}`);
        console.log(`✅ Tax Rules: ${stats.tax_rules}`);
        console.log(`✅ Collection Rules: ${stats.collection_rules}`);
        console.log(`✅ Invoices: ${stats.invoices}`);
        console.log(`✅ Payments: ${stats.payments}`);
        console.log(`✅ Installment Invoices: ${stats.installment_invoices}`);
        
        console.log('\n🎉 Smart Collection System initialized successfully!\n');

    } catch (error) {
        console.error('❌ Error:', error.message);
        throw error;
    } finally {
        await client.end();
    }
}

seedCollectionData();
