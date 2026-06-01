const { Pool } = require('pg');
const fs = require('fs');

const pool = new Pool({
    connectionString: 'postgresql://postgres:PddzJpAQYezqknsntSzmCUlQYuYJldcT@crossover.proxy.rlwy.net:44255/railway',
    ssl: false
});

async function executeSQL() {
    const client = await pool.connect();
    
    try {
        console.log('\n🚀 تنفيذ البنية الأساسية...\n');
        
        const sql1 = fs.readFileSync('./implement-permissions-structure.sql', 'utf8');
        await client.query(sql1);
        console.log('✅ تم إنشاء البنية الأساسية بنجاح\n');
        
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        console.log('🚀 ملء مصفوفة الصلاحيات...\n');
        const sql2 = fs.readFileSync('./fill-permissions-matrix.sql', 'utf8');
        await client.query(sql2);
        console.log('✅ تم ملء مصفوفة الصلاحيات بنجاح\n');
        
    } catch (error) {
        console.error('❌ خطأ:', error.message);
        process.exit(1);
    } finally {
        client.release();
        await pool.end();
    }
}

executeSQL();
