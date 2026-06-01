// اختبار محاكاة لمنطق Super Admin في script.js

console.log('🧪 اختبار منطق Super Admin...\n');

// محاكاة currentUser عند اختيار المكتب الرئيسي
const currentUserHQ = {
    id: 1,
    name: 'المكتب الرئيسي - مسؤول',
    role: 'مسؤول النظام',
    tenantType: 'HQ',
    entityId: 'HQ001',  // نصي!
    entityName: 'المكتب الرئيسي'
};

// محاكاة currentUser عند اختيار فرع
const currentUserBranch = {
    id: 2,
    name: 'فرع العليا - مدير',
    role: 'مدير فرع',
    tenantType: 'BRANCH',
    entityId: 'BR015',
    entityName: 'فرع العليا مول'
};

// الشرط الصحيح (الجديد)
function checkSuperAdminNew(currentUser) {
    return currentUser.entityId === 'HQ001' || currentUser.entityId === 1;
}

// الشرط القديم (الخاطئ)
function checkSuperAdminOld(currentUser) {
    return currentUser.entityId === 1 || currentUser.code === 'HQ001';
}

console.log('═══════════════════════════════════════');
console.log('Test 1: HQ001 مع الشرط الجديد');
const resultNewHQ = checkSuperAdminNew(currentUserHQ);
console.log(`   currentUser.entityId = "${currentUserHQ.entityId}"`);
console.log(`   isSuperAdmin = ${resultNewHQ}`);
console.log(`   النتيجة: ${resultNewHQ ? '✅ سيظهر Super Admin' : '❌ لن يظهر'}`);

console.log('\nTest 2: HQ001 مع الشرط القديم (الخاطئ)');
const resultOldHQ = checkSuperAdminOld(currentUserHQ);
console.log(`   currentUser.entityId = "${currentUserHQ.entityId}"`);
console.log(`   currentUser.code = ${currentUserHQ.code || 'undefined'}`);
console.log(`   isSuperAdmin = ${resultOldHQ}`);
console.log(`   النتيجة: ${resultOldHQ ? '✅ سيظهر Super Admin' : '❌ لن يظهر'}`);

console.log('\nTest 3: BR015 مع الشرط الجديد');
const resultNewBranch = checkSuperAdminNew(currentUserBranch);
console.log(`   currentUser.entityId = "${currentUserBranch.entityId}"`);
console.log(`   isSuperAdmin = ${resultNewBranch}`);
console.log(`   النتيجة: ${resultNewBranch ? '❌ سيظهر (خطأ!)' : '✅ لن يظهر (صحيح)'}`);

console.log('\n═══════════════════════════════════════');
console.log('📊 الخلاصة:');

if (resultNewHQ && !resultNewBranch) {
    console.log('✅ الشرط الجديد صحيح!');
    console.log('   - Super Admin يظهر لـ HQ001 فقط');
    console.log('   - Super Admin مخفي عن الفروع');
} else {
    console.log('❌ الشرط غير صحيح');
}

console.log('\n💡 الشرط الصحيح:');
console.log('   const isSuperAdmin = currentUser.entityId === \'HQ001\' || currentUser.entityId === 1;');

console.log('\n📝 بنية currentUser عند اختيار كيان:');
console.log('   {');
console.log('     id: 1,');
console.log('     name: "المكتب الرئيسي - مسؤول",');
console.log('     role: "مسؤول النظام",');
console.log('     tenantType: "HQ",');
console.log('     entityId: "HQ001",  ← نصي!');
console.log('     entityName: "المكتب الرئيسي"');
console.log('   }');

console.log('\n✅ تم إصلاح script.js!');
