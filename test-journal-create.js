/**
 * Test journal entry creation after deployment
 */

(async () => {
    console.log('⏳ انتظار 30 ثانية لنشر التحديثات على Railway...\n');
    await new Promise(resolve => setTimeout(resolve, 30000));

    console.log('🧪 اختبار إنشاء قيد محاسبي...\n');
    
    const res = await fetch('https://super-cmk2wuy9-production.up.railway.app/finance/journal/entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            entity_id: '1',
            entry_date: '2026-02-03',
            entry_type: 'GENERAL',
            description: 'قيد اختبار',
            reference_number: 'TEST001',
            fiscal_year: 2026,
            lines: [
                {
                    account_id: 1,
                    account_code: '1000',
                    description: 'اختبار المدين',
                    debit_amount: '1500',
                    credit_amount: '0'
                },
                {
                    account_id: 2,
                    account_code: '1120',
                    description: 'اختبار الدائن',
                    debit_amount: '0',
                    credit_amount: '1500'
                }
            ]
        })
    });

    const data = await res.json();
    console.log('📊 Status:', res.status);
    console.log('📋 Response:', JSON.stringify(data, null, 2));
    
    if (data.success) {
        console.log('\n✅ نجح إنشاء القيد!');
        console.log('رقم القيد:', data.entry?.entry_number);
    } else {
        console.log('\n❌ فشل إنشاء القيد:', data.error);
    }
})();
