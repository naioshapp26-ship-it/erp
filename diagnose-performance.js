#!/usr/bin/env node

/**
 * Performance Diagnostic Tool
 * Analyzes database performance and identifies bottlenecks
 */

const { Pool } = require('pg');

const pool = new Pool({
    connectionString: 'postgresql://postgres:PddzJpAQYezqknsntSzmCUlQYuYJldcT@crossover.proxy.rlwy.net:44255/railway',
    ssl: { rejectUnauthorized: false }
});

console.log('🔍 تشخيص أداء النظام');
console.log('='.repeat(60));
console.log('');

async function diagnose() {
    try {
        const results = {
            connection: false,
            tables: {},
            slowQueries: [],
            indexes: {},
            recommendations: []
        };

        // Test 1: Database Connection
        console.log('📡 اختبار الاتصال بقاعدة البيانات...');
        const start = Date.now();
        await pool.query('SELECT NOW()');
        const connectionTime = Date.now() - start;
        results.connection = true;
        console.log(`✅ الاتصال ناجح (${connectionTime}ms)`);
        
        if (connectionTime > 100) {
            results.recommendations.push(`⚠️ زمن الاتصال مرتفع: ${connectionTime}ms (يجب أن يكون < 100ms)`);
        }

        // Test 2: Count records in each table
        console.log('\n📊 إحصاء السجلات في الجداول...');
        const tables = ['entities', 'users', 'invoices', 'transactions', 'ledger', 'ads', 'branches', 'incubators', 'platforms', 'offices', 'employees'];
        
        for (const table of tables) {
            try {
                const countStart = Date.now();
                const countResult = await pool.query(`SELECT COUNT(*) FROM ${table}`);
                const countTime = Date.now() - countStart;
                const count = parseInt(countResult.rows[0].count);
                
                results.tables[table] = { count, queryTime: countTime };
                
                const icon = countTime > 100 ? '⚠️' : '✅';
                console.log(`${icon} ${table}: ${count.toLocaleString()} سجل (${countTime}ms)`);
                
                if (countTime > 100) {
                    results.recommendations.push(`⚠️ استعلام ${table} بطيء: ${countTime}ms`);
                }
                
                if (count > 10000) {
                    results.recommendations.push(`⚠️ جدول ${table} يحتوي على ${count.toLocaleString()} سجل - يُنصح بالـ pagination`);
                }
            } catch (err) {
                console.log(`❌ ${table}: خطأ - ${err.message}`);
            }
        }

        // Test 3: Test common queries performance
        console.log('\n⚡ اختبار أداء الاستعلامات الشائعة...');
        
        const queries = [
            { name: 'GET entities', sql: 'SELECT * FROM entities LIMIT 100' },
            { name: 'GET users', sql: 'SELECT * FROM users LIMIT 100' },
            { name: 'GET invoices', sql: 'SELECT * FROM invoices LIMIT 100' },
            { name: 'GET branches', sql: 'SELECT * FROM branches LIMIT 100' },
            { name: 'GET incubators', sql: 'SELECT * FROM incubators LIMIT 100' }
        ];

        for (const query of queries) {
            try {
                const queryStart = Date.now();
                const result = await pool.query(query.sql);
                const queryTime = Date.now() - queryStart;
                
                const icon = queryTime > 50 ? '⚠️' : '✅';
                console.log(`${icon} ${query.name}: ${result.rows.length} سجل (${queryTime}ms)`);
                
                if (queryTime > 50) {
                    results.slowQueries.push({ query: query.name, time: queryTime });
                    results.recommendations.push(`⚠️ استعلام بطيء: ${query.name} استغرق ${queryTime}ms`);
                }
            } catch (err) {
                console.log(`❌ ${query.name}: خطأ - ${err.message}`);
            }
        }

        // Test 4: Check for indexes
        console.log('\n🔍 فحص الفهارس (Indexes)...');
        const indexQuery = `
            SELECT 
                tablename,
                indexname,
                indexdef
            FROM pg_indexes
            WHERE schemaname = 'public'
            ORDER BY tablename, indexname;
        `;
        
        const indexResult = await pool.query(indexQuery);
        const indexesByTable = {};
        
        indexResult.rows.forEach(row => {
            if (!indexesByTable[row.tablename]) {
                indexesByTable[row.tablename] = [];
            }
            indexesByTable[row.tablename].push(row.indexname);
        });
        
        for (const table of tables) {
            const indexes = indexesByTable[table] || [];
            results.indexes[table] = indexes.length;
            
            const icon = indexes.length > 0 ? '✅' : '⚠️';
            console.log(`${icon} ${table}: ${indexes.length} فهرس`);
            
            if (indexes.length === 0 && results.tables[table]?.count > 1000) {
                results.recommendations.push(`⚠️ جدول ${table} يحتاج فهارس (${results.tables[table].count} سجل)`);
            }
        }

        // Test 5: Check database size
        console.log('\n💾 حجم قاعدة البيانات...');
        const sizeQuery = `
            SELECT 
                pg_size_pretty(pg_database_size(current_database())) as size
        `;
        const sizeResult = await pool.query(sizeQuery);
        console.log(`📦 الحجم الكلي: ${sizeResult.rows[0].size}`);

        // Test 6: Check active connections
        console.log('\n🔌 الاتصالات النشطة...');
        const connQuery = `
            SELECT COUNT(*) as active_connections
            FROM pg_stat_activity
            WHERE state = 'active';
        `;
        const connResult = await pool.query(connQuery);
        console.log(`🔗 عدد الاتصالات النشطة: ${connResult.rows[0].active_connections}`);

        // Summary
        console.log('\n' + '='.repeat(60));
        console.log('📋 ملخص التوصيات:');
        console.log('='.repeat(60));
        
        if (results.recommendations.length === 0) {
            console.log('✅ لا توجد مشاكل أداء واضحة في قاعدة البيانات');
        } else {
            results.recommendations.forEach((rec, i) => {
                console.log(`${i + 1}. ${rec}`);
            });
        }

        // Calculate total records
        const totalRecords = Object.values(results.tables).reduce((sum, t) => sum + t.count, 0);
        console.log(`\n📊 إجمالي السجلات: ${totalRecords.toLocaleString()}`);

        // Performance score
        const avgQueryTime = Object.values(results.tables).reduce((sum, t) => sum + t.queryTime, 0) / tables.length;
        console.log(`⚡ متوسط زمن الاستعلام: ${avgQueryTime.toFixed(2)}ms`);

        if (avgQueryTime < 20) {
            console.log('🎉 الأداء ممتاز!');
        } else if (avgQueryTime < 50) {
            console.log('✅ الأداء جيد');
        } else if (avgQueryTime < 100) {
            console.log('⚠️ الأداء متوسط - يحتاج تحسين');
        } else {
            console.log('❌ الأداء ضعيف - يحتاج تحسين عاجل');
        }

        // Specific issues
        console.log('\n🎯 المشاكل المحتملة:');
        
        if (totalRecords > 50000) {
            console.log('⚠️ عدد السجلات كبير جداً - يجب تطبيق pagination وvirtual scrolling');
        }
        
        if (connectionTime > 100) {
            console.log('⚠️ زمن الاتصال مرتفع - قد تكون المسافة الجغرافية بعيدة');
        }
        
        if (results.slowQueries.length > 0) {
            console.log(`⚠️ ${results.slowQueries.length} استعلام بطيء - تحتاج فهارس أو تحسين`);
        }

        // Frontend recommendations
        console.log('\n💡 توصيات للواجهة الأمامية:');
        console.log('1. تطبيق pagination للجداول الكبيرة (> 1000 سجل)');
        console.log('2. تحميل البيانات على دفعات (batch loading)');
        console.log('3. استخدام virtual scrolling للقوائم الطويلة');
        console.log('4. تقليل عدد الأعمدة المعروضة في الاستعلامات الأولية');
        console.log('5. استخدام lazy loading للصور والمحتوى الثقيل');

        await pool.end();
        console.log('\n✅ انتهى التشخيص');
        
    } catch (error) {
        console.error('❌ خطأ في التشخيص:', error.message);
        await pool.end();
        process.exit(1);
    }
}

diagnose();
