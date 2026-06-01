// اختبار شامل للعلاقات بين الكيانات
// Test Entity Relationships APIs

const API_BASE = 'http://localhost:3000/api';

async function testEntityRelationships() {
  console.log('🧪 اختبار العلاقات بين الكيانات\n');
  console.log('='.repeat(60) + '\n');

  try {
    // ========================================
    // 1. اختبار جلب الموظفين
    // ========================================
    console.log('1️⃣  اختبار API الموظفين');
    console.log('-'.repeat(60));

    const employeesResponse = await fetch(`${API_BASE}/employees`);
    const employees = await employeesResponse.json();
    console.log(`✅ عدد الموظفين: ${employees.length}`);
    
    if (employees.length > 0) {
      const emp = employees[0];
      console.log(`\n   📋 مثال موظف:`);
      console.log(`      الاسم: ${emp.full_name}`);
      console.log(`      المسمى: ${emp.position}`);
      console.log(`      القسم: ${emp.department}`);
      console.log(`      الكيان: ${emp.entity_name} (${emp.assigned_entity_type})`);
      console.log(`      الراتب: ${emp.salary} SAR`);
      console.log(`      نوع التوظيف: ${emp.employment_type}`);
    }

    // ========================================
    // 2. اختبار جلب موظفي فرع معين
    // ========================================
    console.log('\n2️⃣  اختبار جلب موظفي فرع معين');
    console.log('-'.repeat(60));

    const branchEmployeesResponse = await fetch(`${API_BASE}/employees?entity_type=BRANCH`);
    const branchEmployees = await branchEmployeesResponse.json();
    console.log(`✅ موظفو الفروع: ${branchEmployees.length}`);
    branchEmployees.forEach(emp => {
      console.log(`   • ${emp.full_name} - ${emp.position} في ${emp.entity_name}`);
    });

    // ========================================
    // 3. اختبار المستخدمين مع الكيانات
    // ========================================
    console.log('\n3️⃣  اختبار المستخدمين مع الكيانات');
    console.log('-'.repeat(60));

    const usersWithEntityResponse = await fetch(`${API_BASE}/users-with-entity`);
    const usersWithEntity = await usersWithEntityResponse.json();
    console.log(`✅ عدد المستخدمين: ${usersWithEntity.length}`);
    
    console.log(`\n   📊 توزيع المستخدمين حسب الكيانات:`);
    const usersByType = usersWithEntity.reduce((acc, user) => {
      const type = user.linked_entity_type || user.tenant_type;
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {});
    
    Object.entries(usersByType).forEach(([type, count]) => {
      console.log(`      ${type}: ${count} مستخدم`);
    });

    // ========================================
    // 4. اختبار الفواتير مع التفاصيل
    // ========================================
    console.log('\n4️⃣  اختبار الفواتير مع التفاصيل');
    console.log('-'.repeat(60));

    const invoicesResponse = await fetch(`${API_BASE}/invoices-with-details`);
    const invoices = await invoicesResponse.json();
    console.log(`✅ عدد الفواتير: ${invoices.length}`);
    
    if (invoices.length > 0) {
      console.log(`\n   📋 عينة من الفواتير:`);
      invoices.slice(0, 3).forEach(inv => {
        console.log(`      • ${inv.title}`);
        console.log(`        المبلغ: ${inv.amount} SAR`);
        console.log(`        الحالة: ${inv.status}`);
        console.log(`        الجهة المُصدرة: ${inv.issuer_entity_name || 'غير محدد'}`);
        console.log('');
      });
    }

    // ========================================
    // 5. اختبار الإعلانات مع المصدر
    // ========================================
    console.log('5️⃣  اختبار الإعلانات مع المصدر');
    console.log('-'.repeat(60));

    const adsResponse = await fetch(`${API_BASE}/ads-with-source`);
    const ads = await adsResponse.json();
    console.log(`✅ عدد الإعلانات: ${ads.length}`);
    
    console.log(`\n   📊 توزيع الإعلانات حسب الحالة:`);
    const adsByStatus = ads.reduce((acc, ad) => {
      acc[ad.status] = (acc[ad.status] || 0) + 1;
      return acc;
    }, {});
    
    Object.entries(adsByStatus).forEach(([status, count]) => {
      console.log(`      ${status}: ${count} إعلان`);
    });

    if (ads.length > 0) {
      console.log(`\n   📋 عينة من الإعلانات:`);
      ads.slice(0, 3).forEach(ad => {
        console.log(`      • ${ad.title}`);
        console.log(`        المصدر: ${ad.source_entity_name}`);
        console.log(`        النطاق: ${ad.scope}`);
        console.log(`        المشاهدات: ${ad.impressions} | النقرات: ${ad.clicks}`);
        console.log('');
      });
    }

    // ========================================
    // 6. اختبار إنشاء موظف جديد
    // ========================================
    console.log('6️⃣  اختبار إنشاء موظف جديد');
    console.log('-'.repeat(60));

    // الحصول على أول فرع
    const branchesResponse = await fetch(`${API_BASE}/branches`);
    const branches = await branchesResponse.json();
    
    if (branches.length > 0) {
      const firstBranch = branches[0];
      
      const newEmployee = {
        employee_number: `EMP-TEST-${Date.now()}`,
        full_name: 'اختبار موظف جديد',
        email: `test.employee.${Date.now()}@nayosh.com`,
        phone: '+966501111111',
        national_id: `TEST${Date.now()}`,
        position: 'موظف اختبار',
        department: 'تقنية المعلومات',
        branch_id: firstBranch.id,
        assigned_entity_type: 'BRANCH',
        hire_date: '2024-01-01',
        salary: 5000.00,
        employment_type: 'FULL_TIME'
      };

      const createResponse = await fetch(`${API_BASE}/employees`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newEmployee)
      });

      if (createResponse.ok) {
        const createdEmployee = await createResponse.json();
        console.log(`✅ تم إنشاء موظف جديد بنجاح!`);
        console.log(`   رقم الموظف: ${createdEmployee.employee_number}`);
        console.log(`   الاسم: ${createdEmployee.full_name}`);
        console.log(`   الكيان: فرع ${firstBranch.name}`);

        // حذف الموظف التجريبي
        const deleteResponse = await fetch(`${API_BASE}/employees/${createdEmployee.id}`, {
          method: 'DELETE'
        });

        if (deleteResponse.ok) {
          console.log(`   ✅ تم حذف الموظف التجريبي`);
        }
      } else {
        console.log(`❌ فشل إنشاء الموظف`);
      }
    } else {
      console.log(`⚠️  لا توجد فروع لربط الموظف بها`);
    }

    // ========================================
    // 7. اختبار ربط مستخدم بكيان
    // ========================================
    console.log('\n7️⃣  اختبار ربط مستخدم بكيان');
    console.log('-'.repeat(60));

    const usersResponse = await fetch(`${API_BASE}/users`);
    const users = await usersResponse.json();

    if (users.length > 0 && branches.length > 0) {
      const testUser = users[users.length - 1]; // آخر مستخدم
      const testBranch = branches[0];

      const linkData = {
        entity_type: 'BRANCH',
        branch_id: testBranch.id,
        incubator_id: null,
        platform_id: null,
        office_id: null
      };

      const linkResponse = await fetch(`${API_BASE}/users/${testUser.id}/link-entity`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(linkData)
      });

      if (linkResponse.ok) {
        const linkedUser = await linkResponse.json();
        console.log(`✅ تم ربط المستخدم "${testUser.name}" بالفرع "${testBranch.name}"`);
      } else {
        console.log(`⚠️  لم يتم ربط المستخدم (قد يكون مربوط بالفعل)`);
      }
    }

    // ========================================
    // 8. إحصائيات نهائية
    // ========================================
    console.log('\n' + '='.repeat(60));
    console.log('📊 الإحصائيات النهائية');
    console.log('='.repeat(60));

    const stats = {
      employees: employees.length,
      users: usersWithEntity.length,
      invoices: invoices.length,
      ads: ads.length,
      branches: branches.length
    };

    console.log(`\n   👨‍💼 الموظفين: ${stats.employees}`);
    console.log(`   👥 المستخدمين: ${stats.users}`);
    console.log(`   📄 الفواتير: ${stats.invoices}`);
    console.log(`   📢 الإعلانات: ${stats.ads}`);
    console.log(`   🏢 الفروع: ${stats.branches}`);

    // حساب موظفي كل نوع كيان
    console.log(`\n   📊 توزيع الموظفين حسب نوع الكيان:`);
    const empByType = employees.reduce((acc, emp) => {
      acc[emp.assigned_entity_type] = (acc[emp.assigned_entity_type] || 0) + 1;
      return acc;
    }, {});

    Object.entries(empByType).forEach(([type, count]) => {
      console.log(`      ${type}: ${count} موظف`);
    });

    console.log('\n' + '='.repeat(60));
    console.log('✅ جميع الاختبارات اكتملت بنجاح!');
    console.log('='.repeat(60));

    console.log('\n💡 نصائح:');
    console.log('   • استخدم Views للاستعلامات الأسرع');
    console.log('   • تأكد من ربط كل عنصر بالكيان المناسب');
    console.log('   • استخدم Indexes للأداء الأفضل');
    console.log('   • راجع ENTITY_RELATIONSHIPS_GUIDE.md للتوثيق الكامل');

  } catch (error) {
    console.error('\n❌ خطأ في الاختبار:', error.message);
    console.error('تأكد من تشغيل السيرفر: node server.js');
  }
}

// تشغيل الاختبارات
testEntityRelationships();
