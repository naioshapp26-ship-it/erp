const { Pool } = require('pg');

const pool = new Pool({
    connectionString: 'postgresql://postgres:PddzJpAQYezqknsntSzmCUlQYuYJldcT@crossover.proxy.rlwy.net:44255/railway',
    ssl: { rejectUnauthorized: false }
});

async function checkEntityStructure() {
    const client = await pool.connect();
    
    try {
        console.log('🔍 فحص بنية جدول الكيانات...\n');
        
        // 1. فحص أعمدة الجدول
        console.log('1️⃣ أعمدة جدول entities:');
        const columnsResult = await client.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'entities'
            ORDER BY ordinal_position
        `);
        
        columnsResult.rows.forEach(col => {
            console.log(`   - ${col.column_name}: ${col.data_type}`);
        });
        
        // 2. البحث عن HQ001
        console.log('\n2️⃣ البحث عن المكتب الرئيسي (HQ001):');
        const hqResult = await client.query(`
            SELECT * FROM entities
            WHERE id = '1' OR name LIKE '%رئيس%'
            LIMIT 5
        `);
        
        if (hqResult.rows.length > 0) {
            console.log(`✅ تم العثور على ${hqResult.rows.length} كيان:`);
            hqResult.rows.forEach(entity => {
                console.log('\n-----------------------------------');
                console.log('ID:', entity.id);
                console.log('الاسم:', entity.name);
                console.log('الكود:', entity.code || 'لا يوجد');
                console.log('النوع:', entity.type);
                console.log('الحالة:', entity.status);
            });
        } else {
            console.log('❌ لم يتم العثور على المكتب الرئيسي');
        }
        
        // 3. عرض أول 5 كيانات
        console.log('\n3️⃣ أول 5 كيانات في الجدول:');
        const topResult = await client.query(`
            SELECT id, name, type, status
            FROM entities
            ORDER BY id
            LIMIT 5
        `);
        
        console.log('═══════════════════════════════════════');
        topResult.rows.forEach(entity => {
            console.log(`ID: ${entity.id} | ${entity.name} (${entity.type})`);
        });
        console.log('═══════════════════════════════════════');
        
        // 4. البحث في جدول users عن HQ001
        console.log('\n4️⃣ البحث في جدول users عن HQ001:');
        const userResult = await client.query(`
            SELECT id, name, entity_id, entity_name
            FROM users
            WHERE entity_id = 'HQ001'
        `);
        
        if (userResult.rows.length > 0) {
            const user = userResult.rows[0];
            console.log('✅ المستخدم موجود:');
            console.log(`   - ID: ${user.id}`);
            console.log(`   - الاسم: ${user.name}`);
            console.log(`   - entity_id: ${user.entity_id}`);
            console.log(`   - entity_name: ${user.entity_name}`);
        }
        
        console.log('\n✅ اكتمل الفحص!');
        
    } catch (error) {
        console.error('❌ خطأ:', error.message);
    } finally {
        client.release();
        await pool.end();
    }
}

checkEntityStructure().catch(console.error);
