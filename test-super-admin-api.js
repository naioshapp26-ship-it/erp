/**
 * اختبار شامل لـ Super Admin API
 */

const axios = require('axios');

const API_BASE = 'http://localhost:3000/api/admin';
const USER_ID = 1; // HQ001

async function testSuperAdminAPI() {
    console.log('🧪 بدء اختبار Super Admin API\n');
    console.log('=' .repeat(60) + '\n');

    try {
        // اختبار 1: جلب metadata
        console.log('1️⃣  اختبار: GET /api/admin/metadata');
        try {
            const metadataResponse = await axios.get(`${API_BASE}/metadata`, {
                headers: { 'x-user-id': USER_ID }
            });
            
            if (metadataResponse.data.success) {
                console.log('   ✅ نجح!');
                console.log(`   - عدد الأنظمة: ${metadataResponse.data.systems.length}`);
                console.log(`   - عدد مستويات الصلاحيات: ${metadataResponse.data.permission_levels.length}`);
                console.log(`   - المستويات الهرمية: ${metadataResponse.data.hierarchy_levels.join(', ')}`);
            } else {
                console.log('   ❌ فشل:', metadataResponse.data.message);
            }
        } catch (error) {
            console.log('   ❌ خطأ:', error.response?.data?.message || error.message);
        }
        console.log('');

        // اختبار 2: جلب جميع الأدوار
        console.log('2️⃣  اختبار: GET /api/admin/roles');
        try {
            const rolesResponse = await axios.get(`${API_BASE}/roles`, {
                headers: { 'x-user-id': USER_ID }
            });
            
            if (rolesResponse.data.success) {
                console.log('   ✅ نجح!');
                console.log(`   - إجمالي الأدوار: ${rolesResponse.data.total}`);
                
                // عرض أول 5 أدوار
                console.log('   - أمثلة على الأدوار:');
                rolesResponse.data.roles.slice(0, 5).forEach(role => {
                    console.log(`     • ${role.title_ar} (${role.code}) - المستوى ${role.hierarchy_level} - المستخدمين: ${role.users_count}`);
                });
            } else {
                console.log('   ❌ فشل:', rolesResponse.data.message);
            }
        } catch (error) {
            console.log('   ❌ خطأ:', error.response?.data?.message || error.message);
        }
        console.log('');

        // اختبار 3: جلب تفاصيل دور محدد
        console.log('3️⃣  اختبار: GET /api/admin/roles/SUPER_ADMIN');
        try {
            const roleDetailResponse = await axios.get(`${API_BASE}/roles/SUPER_ADMIN`, {
                headers: { 'x-user-id': USER_ID }
            });
            
            if (roleDetailResponse.data.success) {
                console.log('   ✅ نجح!');
                const role = roleDetailResponse.data.role;
                console.log(`   - الدور: ${role.title_ar} (${role.code})`);
                console.log(`   - المستوى: ${role.hierarchy_level}`);
                console.log(`   - حد الموافقة: ${role.max_approval_limit || 'غير محدود'}`);
                console.log(`   - عدد المستخدمين: ${roleDetailResponse.data.users.length}`);
            } else {
                console.log('   ❌ فشل:', roleDetailResponse.data.message);
            }
        } catch (error) {
            console.log('   ❌ خطأ:', error.response?.data?.message || error.message);
        }
        console.log('');

        console.log('=' .repeat(60));
        console.log('✅ اكتملت جميع الاختبارات!');

    } catch (error) {
        console.error('\n❌ خطأ عام في الاختبار:', error.message);
    }
}

// تشغيل الاختبارات
console.log('⚠️  تأكد من تشغيل السيرفر على المنفذ 3000 قبل بدء الاختبار\n');
console.log('لتشغيل السيرفر: npm start\n');

testSuperAdminAPI();
