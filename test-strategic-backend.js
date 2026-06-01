// اختبار صفحات الإدارة الاستراتيجية - الخلفية
const db = require('./db');

console.log('🧪 بدء اختبار الصفحات الاستراتيجية - الخلفية\n');

const strategicPages = [
    'executive-management',
    'employee-management', 
    'smart-systems',
    'subscription-management',
    'operations-management',
    'financial-approvals',
    'tenants',
    'collections-strategic',
    'marketing',
    'advertisers-center',
    'training-development',
    'quality-audit',
    'evaluation',
    'tasks-strategic',
    'information-center',
    'identity-settings',
    'system-log',
    'reports'
];

async function testBackend() {
    console.log('📊 اختبار اتصال قاعدة البيانات...\n');
    
    try {
        // Test executive KPIs
        const kpis = await db.query('SELECT * FROM executive_kpis LIMIT 1');
        console.log(`✅ executive_kpis: ${kpis.rows.length > 0 ? 'موجود' : 'فارغ'}`);
        
        // Test executive goals
        const goals = await db.query('SELECT * FROM executive_goals LIMIT 1');
        console.log(`✅ executive_goals: ${goals.rows.length > 0 ? 'موجود' : 'فارغ'}`);
        
        // Test executive operations
        const operations = await db.query('SELECT * FROM executive_operations LIMIT 1');
        console.log(`✅ executive_operations: ${operations.rows.length > 0 ? 'موجود' : 'فارغ'}`);
        
        // Test digital marketing
        const digital = await db.query('SELECT * FROM digital_marketing LIMIT 1');
        console.log(`✅ digital_marketing: ${digital.rows.length > 0 ? 'موجود' : 'فارغ'}`);
        
        // Test subscriptions
        const subscriptions = await db.query('SELECT * FROM subscription_tiers LIMIT 1');
        console.log(`✅ subscription_tiers: ${subscriptions.rows.length > 0 ? 'موجود' : 'فارغ'}`);
        
        // Test approval workflows
        const workflows = await db.query('SELECT * FROM approval_workflows LIMIT 1');
        console.log(`✅ approval_workflows: ${workflows.rows.length > 0 ? 'موجود' : 'فارغ'}`);
        
        // Test training programs
        const training = await db.query('SELECT * FROM training_programs LIMIT 1');
        console.log(`✅ training_programs: ${training.rows.length > 0 ? 'موجود' : 'فارغ'}`);
        
        // Test quality audits
        const audits = await db.query('SELECT * FROM quality_audits LIMIT 1');
        console.log(`✅ quality_audits: ${audits.rows.length > 0 ? 'موجود' : 'فارغ'}`);
        
        // Test evaluations
        const evaluations = await db.query('SELECT * FROM evaluations LIMIT 1');
        console.log(`✅ evaluations: ${evaluations.rows.length > 0 ? 'موجود' : 'فارغ'}`);
        
        // Test information resources
        const resources = await db.query('SELECT * FROM information_resources LIMIT 1');
        console.log(`✅ information_resources: ${resources.rows.length > 0 ? 'موجود' : 'فارغ'}`);
        
        console.log('\n✅ جميع الجداول موجودة في قاعدة البيانات!');
        
        db.end();
        process.exit(0);
    } catch (error) {
        console.error('❌ خطأ في الاختبار:', error.message);
        db.end();
        process.exit(1);
    }
}

testBackend();
