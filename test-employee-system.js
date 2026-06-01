/**
 * اختبار سريع لنظام إدارة الموظفين
 * يختبر جميع APIs ووظائف النظام الأساسية
 */

const API_BASE_URL = 'http://localhost:3000/api';

async function testEmployeeAPIs() {
    console.log('🧪 بدء اختبار نظام إدارة الموظفين...\n');

    try {
        // 1. اختبار جلب جميع الموظفين
        console.log('1️⃣ اختبار جلب الموظفين...');
        const employees = await fetch(`${API_BASE_URL}/employees`);
        const employeesData = await employees.json();
        console.log(`✅ تم جلب ${employeesData.length} موظف بنجاح`);
        
        // 2. اختبار إضافة موظف جديد
        console.log('\n2️⃣ اختبار إضافة موظف جديد...');
        const newEmployee = {
            employee_number: `EMP-${Date.now()}`,
            full_name: 'أحمد محمد الاختبار',
            email: 'ahmed.test@nayosh.com',
            phone: '+966501234567',
            position: 'مطور برمجيات',
            department: 'تقنية المعلومات',
            employment_type: 'FULL_TIME',
            assigned_entity_type: 'HQ',
            assigned_hq: false, // Set explicitly to false
            address: '123 شارع الملك فهد، الرياض'
        };

        const createResponse = await fetch(`${API_BASE_URL}/employees`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newEmployee)
        });

        if (createResponse.ok) {
            const createdEmployee = await createResponse.json();
            console.log(`✅ تم إضافة الموظف بنجاح - ID: ${createdEmployee.id}`);
            
            // 3. اختبار جلب موظف محدد
            console.log('\n3️⃣ اختبار جلب موظف محدد...');
            const getEmployee = await fetch(`${API_BASE_URL}/employees/${createdEmployee.id}`);
            const employeeData = await getEmployee.json();
            console.log(`✅ تم جلب بيانات الموظف: ${employeeData.full_name}`);
            
            // 4. اختبار تعديل الموظف
            console.log('\n4️⃣ اختبار تعديل الموظف...');
            const updatedData = {
                ...employeeData,
                position: 'كبير المطورين',
                salary: 10000.00
            };
            
            const updateResponse = await fetch(`${API_BASE_URL}/employees/${createdEmployee.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updatedData)
            });
            
            if (updateResponse.ok) {
                console.log('✅ تم تعديل بيانات الموظف بنجاح');
            } else {
                console.log('❌ فشل في تعديل الموظف');
            }
            
            // 5. اختبار حذف الموظف
            console.log('\n5️⃣ اختبار حذف الموظف...');
            const deleteResponse = await fetch(`${API_BASE_URL}/employees/${createdEmployee.id}`, {
                method: 'DELETE'
            });
            
            if (deleteResponse.ok) {
                console.log('✅ تم حذف الموظف بنجاح');
            } else {
                console.log('❌ فشل في حذف الموظف');
            }
            
        } else {
            const error = await createResponse.text();
            console.log('❌ فشل في إضافة الموظف:', error);
        }

        // 6. اختبار جلب الكيانات لتعيين الموظفين
        console.log('\n6️⃣ اختبار جلب الكيانات...');
        
        const entities = ['branches', 'incubators', 'platforms', 'offices'];
        for (const entity of entities) {
            try {
                const response = await fetch(`${API_BASE_URL}/${entity}`);
                if (response.ok) {
                    const data = await response.json();
                    console.log(`✅ ${entity}: ${data.length} عنصر`);
                } else {
                    console.log(`⚠️ ${entity}: غير متاح`);
                }
            } catch (error) {
                console.log(`❌ خطأ في جلب ${entity}:`, error.message);
            }
        }

        console.log('\n🎉 اكتمل اختبار نظام إدارة الموظفين بنجاح!');
        
    } catch (error) {
        console.error('❌ خطأ في الاختبار:', error);
    }
}

// تشغيل الاختبار
testEmployeeAPIs();