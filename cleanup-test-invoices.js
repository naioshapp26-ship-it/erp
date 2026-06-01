const { Client } = require('pg');

const client = new Client({
    connectionString: 'postgresql://postgres:PddzJpAQYezqknsntSzmCUlQYuYJldcT@crossover.proxy.rlwy.net:44255/railway'
});

async function cleanupInvoices() {
    try {
        await client.connect();
        await client.query(`DELETE FROM invoices_enhanced WHERE invoice_number LIKE 'INV-2026%'`);
        console.log('✅ Cleaned up test invoices');
        await client.end();
    } catch (error) {
        console.error('Error:', error.message);
    }
}

cleanupInvoices();
