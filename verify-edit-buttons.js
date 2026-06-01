const fs = require('fs');
const path = require('path');

console.log('🔍 التحقق من وجود أزرار تعديل الموافقات في الكود...\n');

const scriptPath = path.join(__dirname, 'script.js');
const serverPath = path.join(__dirname, 'server.js');

const scriptContent = fs.readFileSync(scriptPath, 'utf8');
const serverContent = fs.readFileSync(serverPath, 'utf8');

const tests = [
    {
        name: '1️⃣ زر التعديل في قسم "المعلقة عليك"',
        file: 'script.js',
        content: scriptContent,
        search: 'onclick="app.editApproval(',
        context: 'fas fa-edit ml-2"></i>تعديل'
    },
    {
        name: '2️⃣ زر التعديل في قسم "طلباتي"',
        file: 'script.js',
        content: scriptContent,
        search: 'تعديل الموافقة',
        context: 'onclick="app.editApproval'
    },
    {
        name: '3️⃣ عمود الإجراءات في جدول "جميع الموافقات"',
        file: 'script.js',
        content: scriptContent,
        search: '<th class="p-3">الإجراءات</th>',
        context: null
    },
    {
        name: '4️⃣ دالة editApproval',
        file: 'script.js',
        content: scriptContent,
        search: 'const editApproval = async (approvalId) =>',
        context: null
    },
    {
        name: '5️⃣ دالة saveApprovalEdit',
        file: 'script.js',
        content: scriptContent,
        search: 'const saveApprovalEdit = async (approvalId) =>',
        context: null
    },
    {
        name: '6️⃣ تصدير editApproval في app',
        file: 'script.js',
        content: scriptContent,
        search: 'editApproval, saveApprovalEdit',
        context: 'handleApprovalDecision'
    },
    {
        name: '7️⃣ API Endpoint - PUT /api/approvals/:id',
        file: 'server.js',
        content: serverContent,
        search: "app.put('/api/approvals/:id'",
        context: null
    },
    {
        name: '8️⃣ تحديث قاعدة البيانات في API',
        file: 'server.js',
        content: serverContent,
        search: 'UPDATE approval_workflows',
        context: 'item_title'
    }
];

let passed = 0;
let failed = 0;

tests.forEach((test, index) => {
    const found = test.content.includes(test.search);
    const contextMatch = test.context ? test.content.includes(test.context) : true;
    
    if (found && contextMatch) {
        console.log(`✅ ${test.name}`);
        console.log(`   📁 الملف: ${test.file}`);
        console.log(`   🔎 النص: "${test.search.substring(0, 50)}..."`);
        
        // Find line number
        const lines = test.content.split('\n');
        const lineNumber = lines.findIndex(line => line.includes(test.search)) + 1;
        if (lineNumber > 0) {
            console.log(`   📍 السطر: ${lineNumber}`);
        }
        console.log('');
        passed++;
    } else {
        console.log(`❌ ${test.name}`);
        console.log(`   📁 الملف: ${test.file}`);
        console.log(`   ⚠️ لم يتم العثور على: "${test.search}"`);
        console.log('');
        failed++;
    }
});

console.log('═'.repeat(60));
console.log(`📊 نتيجة الاختبار: ${passed}/${tests.length} نجح`);
console.log('═'.repeat(60));

if (failed === 0) {
    console.log('\n✅ ممتاز! جميع الأزرار والدوال موجودة في الكود! 🎉\n');
    console.log('📋 الأزرار موجودة في 3 مواضع:');
    console.log('   1. قسم "المعلقة عليك" - بجانب أزرار الموافقة/الرفض');
    console.log('   2. قسم "طلباتي" - للطلبات النشطة');
    console.log('   3. جدول "جميع الموافقات" - في عمود الإجراءات');
    console.log('\n🔧 الوظائف:');
    console.log('   • editApproval() - تفتح نافذة التعديل');
    console.log('   • saveApprovalEdit() - تحفظ التعديلات');
    console.log('   • PUT /api/approvals/:id - API endpoint');
    console.log('\n🌐 للاختبار: افتح test-edit-approval-buttons.html في المتصفح');
} else {
    console.log(`\n⚠️ تحذير: ${failed} اختبار(ات) فشلت\n`);
    process.exit(1);
}
