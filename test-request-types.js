/**
 * اختبار نظام إدارة أنواع الطلبات
 * يختبر جميع APIs الخاصة بأنواع الطلبات
 */

const API_BASE_URL = 'http://localhost:3000/api';

async function testRequestTypesAPIs() {
    console.log('🧪 بدء اختبار نظام إدارة أنواع الطلبات...\n');

    try {
        // 1. اختبار جلب جميع أنواع الطلبات
        console.log('1️⃣ اختبار جلب جميع أنواع الطلبات...');
        const typesResponse = await fetch(`${API_BASE_URL}/request-types`);
        const types = await typesResponse.json();
        console.log(`✅ تم جلب ${types.length} نوع طلب بنجاح`);
        console.log(`   الأنواع: ${types.slice(0, 5).map(t => t.type_name_ar).join(', ')}...`);

        // 2. اختبار جلب الأنواع النشطة فقط
        console.log('\n2️⃣ اختبار جلب الأنواع النشطة فقط...');
        const activeResponse = await fetch(`${API_BASE_URL}/request-types?is_active=true`);
        const activeTypes = await activeResponse.json();
        console.log(`✅ تم جلب ${activeTypes.length} نوع نشط`);

        // 3. اختبار إضافة نوع طلب جديد
        console.log('\n3️⃣ اختبار إضافة نوع طلب جديد...');
        const newType = {
            type_code: `test_request_${Date.now()}`,
            type_name_ar: 'طلب اختبار',
            type_name_en: 'Test Request',
            description_ar: 'هذا طلب تجريبي للاختبار',
            icon: '🧪',
            color: '#e3f2fd',
            category: 'test',
            is_active: true,
            requires_approval: true,
            form_fields: {
                fields: [
                    {
                        name: 'test_field',
                        label: 'حقل اختبار',
                        type: 'text',
                        required: true
                    }
                ]
            },
            display_order: 999
        };

        const createResponse = await fetch(`${API_BASE_URL}/request-types`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newType)
        });

        if (createResponse.ok) {
            const created = await createResponse.json();
            console.log(`✅ تم إضافة نوع الطلب بنجاح - ID: ${created.requestType.id}`);
            
            // 4. اختبار جلب نوع طلب محدد
            console.log('\n4️⃣ اختبار جلب نوع طلب محدد...');
            const singleResponse = await fetch(`${API_BASE_URL}/request-types/${created.requestType.id}`);
            const singleType = await singleResponse.json();
            console.log(`✅ تم جلب نوع الطلب: ${singleType.type_name_ar}`);

            // 5. اختبار تعديل نوع الطلب
            console.log('\n5️⃣ اختبار تعديل نوع الطلب...');
            const updateData = {
                type_name_ar: 'طلب اختبار محدث',
                description_ar: 'تم تحديث الوصف',
                color: '#fff3e0'
            };

            const updateResponse = await fetch(`${API_BASE_URL}/request-types/${created.requestType.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updateData)
            });

            if (updateResponse.ok) {
                const updated = await updateResponse.json();
                console.log(`✅ تم تحديث نوع الطلب بنجاح`);
                console.log(`   الاسم الجديد: ${updated.requestType.type_name_ar}`);
            } else {
                console.log(`❌ فشل تحديث نوع الطلب`);
            }

            // 6. اختبار تبديل حالة النشاط
            console.log('\n6️⃣ اختبار تبديل حالة النشاط...');
            const toggleResponse = await fetch(`${API_BASE_URL}/request-types/${created.requestType.id}/toggle-active`, {
                method: 'PATCH'
            });

            if (toggleResponse.ok) {
                const toggled = await toggleResponse.json();
                console.log(`✅ تم تبديل حالة النشاط: ${toggled.requestType.is_active ? 'نشط' : 'غير نشط'}`);
            } else {
                console.log(`❌ فشل تبديل حالة النشاط`);
            }

            // 7. اختبار الحذف
            console.log('\n7️⃣ اختبار حذف نوع الطلب...');
            const deleteResponse = await fetch(`${API_BASE_URL}/request-types/${created.requestType.id}`, {
                method: 'DELETE'
            });

            if (deleteResponse.ok) {
                console.log(`✅ تم حذف نوع الطلب بنجاح`);
            } else {
                console.log(`❌ فشل حذف نوع الطلب`);
            }
        } else {
            const error = await createResponse.json();
            console.log(`❌ فشل إضافة نوع الطلب: ${error.error}`);
        }

        // 8. اختبار التصفية حسب الفئة
        console.log('\n8️⃣ اختبار التصفية حسب الفئة (hr)...');
        const hrResponse = await fetch(`${API_BASE_URL}/request-types?category=hr`);
        const hrTypes = await hrResponse.json();
        console.log(`✅ تم جلب ${hrTypes.length} نوع طلب من فئة الموارد البشرية`);

        console.log('\n✅ اكتملت جميع الاختبارات بنجاح!\n');

    } catch (error) {
        console.error('❌ خطأ في الاختبار:', error.message);
    }
}

// تشغيل الاختبار
testRequestTypesAPIs();
