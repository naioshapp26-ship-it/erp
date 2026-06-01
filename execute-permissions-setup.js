const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// بيانات الاتصال بقاعدة البيانات
const pool = new Pool({
    connectionString: 'postgresql://postgres:PddzJpAQYezqknsntSzmCUlQYuYJldcT@crossover.proxy.rlwy.net:44255/railway',
    ssl: false
});

async function executeSqlFile(filename) {
    const client = await pool.connect();
    
    try {
        console.log(`\n${'='.repeat(80)}`);
        console.log(`🚀 تنفيذ ملف: ${filename}`);
        console.log('='.repeat(80) + '\n');

        // قراءة محتوى الملف
        const filePath = path.join(__dirname, filename);
        const sql = fs.readFileSync(filePath, 'utf8');
        
        // تنفيذ SQL
        console.log('⏳ جاري تنفيذ الأوامر...\n');
        const result = await client.query(sql);
        
        console.log('✅ تم تنفيذ الملف بنجاح!');
        
        // عرض النتائج إذا وجدت
        if (result.rows && result.rows.length > 0) {
            console.log('\n📊 النتائج:');
            console.table(result.rows);
        }
        
    } catch (error) {
        console.error('❌ خطأ في تنفيذ الملف:', error.message);
        console.error('\n📝 التفاصيل الكاملة:');
        console.error(error.stack);
        throw error;
    } finally {
        client.release();
    }
}

async function main() {
    try {
        // تنفيذ الملف الأول
        await executeSqlFile('implement-full-permissions-matrix.sql');
        
        console.log('\n⏳ انتظار 2 ثانية قبل المتابعة...\n');
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // تنفيذ الملف الثاني
        await executeSqlFile('fill-permissions-matrix.sql');
        
        console.log('\n' + '='.repeat(80));
        console.log('🎉 تم تنفيذ جميع السكريبتات بنجاح!');
        console.log('='.repeat(80) + '\n');
        
    } catch (error) {
        console.error('\n❌ فشل التنفيذ:', error.message);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

main();
