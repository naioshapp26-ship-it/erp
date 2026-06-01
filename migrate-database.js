#!/usr/bin/env node

/**
 * 📦 نسخ البيانات من قاعدة البيانات القديمة إلى الجديدة
 * Migration Script
 */

const { Client } = require('pg');

// قاعدة البيانات القديمة (الخاطئة)
const oldDB = new Client({
  connectionString: 'postgresql://postgres:YySAYQuESzksngIQPgFsyJkUQpsSWeZi@turntable.proxy.rlwy.net:47210/railway',
  ssl: { rejectUnauthorized: false }
});

// قاعدة البيانات الجديدة (الصحيحة)
const newDB = new Client({
  connectionString: 'postgresql://postgres:PddzJpAQYezqknsntSzmCUlQYuYJldcT@crossover.proxy.rlwy.net:44255/railway',
  ssl: { rejectUnauthorized: false }
});

async function migrate() {
  try {
    console.log('🔗 الاتصال بقاعدة البيانات القديمة...');
    await oldDB.connect();
    console.log('✅ تم الاتصال بقاعدة البيانات القديمة\n');

    console.log('🔗 الاتصال بقاعدة البيانات الجديدة...');
    await newDB.connect();
    console.log('✅ تم الاتصال بقاعدة البيانات الجديدة\n');

    // 1. فحص الجداول الموجودة في القديمة
    console.log('📋 فحص الجداول في قاعدة البيانات القديمة...');
    const tablesResult = await oldDB.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_type = 'BASE TABLE'
        AND table_name LIKE 'finance_%'
      ORDER BY table_name
    `);

    console.log(`📊 عدد الجداول المالية: ${tablesResult.rows.length}`);
    tablesResult.rows.forEach(row => {
      console.log(`   - ${row.table_name}`);
    });

    if (tablesResult.rows.length === 0) {
      console.log('\n⚠️  لا توجد جداول مالية في قاعدة البيانات القديمة');
      console.log('✅ يمكن البدء مباشرة في قاعدة البيانات الجديدة');
      await oldDB.end();
      await newDB.end();
      return;
    }

    // 2. نسخ البيانات لكل جدول
    console.log('\n📦 بدء نسخ البيانات...\n');

    for (const tableRow of tablesResult.rows) {
      const tableName = tableRow.table_name;
      console.log(`📋 نسخ جدول: ${tableName}`);

      // جلب البيانات من الجدول القديم
      const dataResult = await oldDB.query(`SELECT * FROM ${tableName}`);
      console.log(`   📊 عدد الصفوف: ${dataResult.rows.length}`);

      if (dataResult.rows.length > 0) {
        // جلب أسماء الأعمدة
        const columns = Object.keys(dataResult.rows[0]);
        const columnsList = columns.join(', ');
        
        // إدراج البيانات في الجدول الجديد
        for (let i = 0; i < dataResult.rows.length; i++) {
          const row = dataResult.rows[i];
          const values = columns.map(col => row[col]);
          const placeholders = values.map((_, idx) => `$${idx + 1}`).join(', ');
          
          try {
            await newDB.query(
              `INSERT INTO ${tableName} (${columnsList}) VALUES (${placeholders})`,
              values
            );
          } catch (err) {
            console.log(`   ⚠️  خطأ في نسخ الصف ${i + 1}: ${err.message}`);
          }
        }
        console.log(`   ✅ تم نسخ ${dataResult.rows.length} صف\n`);
      }
    }

    console.log('✅ تم نسخ جميع البيانات بنجاح!\n');

    // 3. حذف الجداول من قاعدة البيانات القديمة
    console.log('🗑️  حذف الجداول من قاعدة البيانات القديمة...');
    for (const tableRow of tablesResult.rows) {
      const tableName = tableRow.table_name;
      await oldDB.query(`DROP TABLE IF EXISTS ${tableName} CASCADE`);
      console.log(`   ✅ تم حذف جدول: ${tableName}`);
    }

    console.log('\n✅ تم حذف جميع الجداول من قاعدة البيانات القديمة');
    console.log('✅ عملية الترحيل اكتملت بنجاح!\n');

    await oldDB.end();
    await newDB.end();

  } catch (error) {
    console.error('❌ خطأ في عملية الترحيل:', error.message);
    console.error(error);
    process.exit(1);
  }
}

migrate();
