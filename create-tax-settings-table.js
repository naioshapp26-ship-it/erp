#!/usr/bin/env node

// Setup script for tax_settings table
const db = require('./db');

const setupTaxSettings = async () => {
    try {
        console.log('🔄 جاري إعداد جدول إدارة الضرائب...\n');

        // Read and execute the SQL file
        const fs = require('fs');
        const sql = fs.readFileSync('./create-tax-settings-table.sql', 'utf8');
        
        // Execute the SQL
        await db.query(sql);
        
        console.log('✅ تم إنشاء جدول tax_settings بنجاح\n');

        // Verify the table and data
        const result = await db.query(`
            SELECT 
                COUNT(*) as total_count,
                SUM(CASE WHEN branch_id IS NULL THEN 1 ELSE 0 END) as global_taxes,
                SUM(CASE WHEN is_active THEN 1 ELSE 0 END) as active_count
            FROM tax_settings
        `);

        const stats = result.rows[0];
        console.log('📊 إحصائيات الضرائب:');
        console.log(`   • الإجمالي: ${stats.total_count}`);
        console.log(`   • الضرائب العامة (كل الفروع): ${stats.global_taxes}`);
        console.log(`   • الضرائب المفعلة: ${stats.active_count}\n`);

        // Get details of all taxes
        const taxesResult = await db.query(`
            SELECT 
                id,
                tax_code,
                tax_name_ar,
                tax_type,
                default_rate,
                branch_id,
                branch_name_ar,
                branch_specific_rate,
                is_active
            FROM tax_settings
            ORDER BY branch_id DESC NULLS FIRST, id
        `);

        console.log('📋 قائمة الضرائب المضافة:');
        taxesResult.rows.forEach((tax, index) => {
            const rate = tax.branch_specific_rate || tax.default_rate;
            const branch = tax.branch_name_ar || 'عام (كل الفروع)';
            const status = tax.is_active ? '✅ مفعل' : '❌ معطل';
            console.log(`   ${index + 1}. [${tax.tax_code}] ${tax.tax_name_ar} (${tax.tax_type})`);
            console.log(`      - المعدل: ${rate}% | الفرع: ${branch} | ${status}`);
        });

        console.log('\n🎉 تم تهيئة نظام إدارة الضرائب بنجاح!');
        console.log('✨ النظام جاهز للاستخدام\n');

        process.exit(0);
    } catch (error) {
        console.error('❌ خطأ في إعداد جدول الضرائب:', error.message);
        process.exit(1);
    }
};

setupTaxSettings();
