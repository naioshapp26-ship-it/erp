const { Pool } = require('pg');

const pool = new Pool({
    connectionString: 'postgresql://postgres:PddzJpAQYezqknsntSzmCUlQYuYJldcT@crossover.proxy.rlwy.net:44255/railway',
    ssl: { rejectUnauthorized: false }
});

async function addCustomerInfoToInvoices() {
    const client = await pool.connect();
    
    try {
        await client.query('BEGIN');
        
        console.log('🔄 إضافة معلومات العميل إلى جدول الفواتير...\n');
        
        // Check if beneficiary_id column exists
        const checkCol = await client.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'invoices' AND column_name = 'beneficiary_id'
        `);
        
        if (checkCol.rowCount === 0) {
            console.log('➕ إضافة عمود beneficiary_id...');
            await client.query(`
                ALTER TABLE invoices 
                ADD COLUMN beneficiary_id INTEGER REFERENCES beneficiaries(id)
            `);
            console.log('   ✅ تم إضافة العمود');
        } else {
            console.log('   ℹ️  العمود beneficiary_id موجود بالفعل');
        }
        
        // Add customer_name column for quick access (denormalized for performance)
        const checkName = await client.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'invoices' AND column_name = 'customer_name'
        `);
        
        if (checkName.rowCount === 0) {
            console.log('➕ إضافة عمود customer_name...');
            await client.query(`
                ALTER TABLE invoices 
                ADD COLUMN customer_name VARCHAR(255),
                ADD COLUMN customer_phone VARCHAR(20),
                ADD COLUMN customer_number VARCHAR(50)
            `);
            console.log('   ✅ تم إضافة الأعمدة');
        } else {
            console.log('   ℹ️  أعمدة معلومات العميل موجودة بالفعل');
        }
        
        await client.query('COMMIT');
        
        console.log('\n✅ تمت العملية بنجاح!');
        console.log('📊 الأعمدة المضافة:');
        console.log('   - beneficiary_id: معرف المستفيد/العميل');
        console.log('   - customer_name: اسم العميل');
        console.log('   - customer_phone: رقم هاتف العميل');
        console.log('   - customer_number: رقم العميل');
        
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('\n❌ خطأ:', error.message);
        throw error;
    } finally {
        client.release();
        await pool.end();
    }
}

addCustomerInfoToInvoices()
    .then(() => {
        console.log('\n🎉 اكتملت العملية!');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n❌ فشلت العملية:', error);
        process.exit(1);
    });
