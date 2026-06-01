// Test Entity Creation APIs
// Run with: node test-entity-creation.js

const API_BASE = 'http://localhost:3000/api';

async function testEntityCreation() {
  console.log('🧪 Testing Entity Creation APIs...\n');

  // Test 1: Create a new branch
  console.log('1️⃣ Testing Branch Creation...');
  try {
    const branchData = {
      hq_id: 1,
      name: 'فرع جدة للاختبار',
      code: 'BR-JED-TEST',
      description: 'فرع اختباري في مدينة جدة',
      country: 'المملكة العربية السعودية',
      city: 'جدة',
      address: '123 شارع الأمير فيصل',
      contact_email: 'jeddah.test@nayosh.com',
      contact_phone: '+966 12 123 4567',
      manager_name: 'محمد الجهني'
    };

    const branchResponse = await fetch(`${API_BASE}/branches`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(branchData)
    });

    if (branchResponse.ok) {
      const branch = await branchResponse.json();
      console.log('   ✅ Branch created successfully!');
      console.log(`   📍 ID: ${branch.id}, Name: ${branch.name}, Code: ${branch.code}\n`);

      // Test 2: Create an incubator for this branch
      console.log('2️⃣ Testing Incubator Creation...');
      const incubatorData = {
        branch_id: branch.id,
        name: 'حاضنة جدة للاختبار',
        code: 'INC-JED-TEST',
        description: 'حاضنة اختبارية',
        program_type: 'TECHNOLOGY',
        capacity: 30,
        contact_email: 'incubator.test@nayosh.com',
        contact_phone: '+966 12 234 5678',
        manager_name: 'فاطمة السعيد',
        start_date: '2024-01-01',
        end_date: '2025-12-31'
      };

      const incubatorResponse = await fetch(`${API_BASE}/incubators`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(incubatorData)
      });

      if (incubatorResponse.ok) {
        const incubator = await incubatorResponse.json();
        console.log('   ✅ Incubator created successfully!');
        console.log(`   📍 ID: ${incubator.id}, Name: ${incubator.name}, Code: ${incubator.code}\n`);

        // Test 3: Create a platform for this incubator
        console.log('3️⃣ Testing Platform Creation...');
        const platformData = {
          incubator_id: incubator.id,
          name: 'منصة التجارة الاختبارية',
          code: 'PLT-TEST',
          description: 'منصة اختبارية',
          platform_type: 'ECOMMERCE',
          pricing_model: 'SUBSCRIPTION',
          base_price: 99.99,
          currency: 'SAR'
        };

        const platformResponse = await fetch(`${API_BASE}/platforms`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(platformData)
        });

        if (platformResponse.ok) {
          const platform = await platformResponse.json();
          console.log('   ✅ Platform created successfully!');
          console.log(`   📍 ID: ${platform.id}, Name: ${platform.name}, Code: ${platform.code}\n`);

          // Test 4: Create an office
          console.log('4️⃣ Testing Office Creation...');
          const officeData = {
            incubator_id: incubator.id,
            name: 'مكتب الاختبار',
            code: 'OFF-TEST',
            description: 'مكتب اختباري',
            office_type: 'ADMINISTRATIVE',
            location: 'الدور الأول',
            address: '456 شارع التحلية',
            capacity: 15,
            contact_email: 'office.test@nayosh.com',
            contact_phone: '+966 12 345 6789',
            manager_name: 'عمر الأحمد'
          };

          const officeResponse = await fetch(`${API_BASE}/offices`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(officeData)
          });

          if (officeResponse.ok) {
            const office = await officeResponse.json();
            console.log('   ✅ Office created successfully!');
            console.log(`   📍 ID: ${office.id}, Name: ${office.name}, Code: ${office.code}\n`);

            // Test 5: Link office to platform
            console.log('5️⃣ Testing Office-Platform Link Creation...');
            const linkResponse = await fetch(`${API_BASE}/offices/${office.id}/platforms/${platform.id}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' }
            });

            if (linkResponse.ok) {
              const link = await linkResponse.json();
              console.log('   ✅ Link created successfully!');
              console.log(`   📍 Office ${office.name} ⟷ Platform ${platform.name}\n`);
            } else {
              console.log('   ❌ Failed to create link');
            }
          } else {
            console.log('   ❌ Failed to create office');
          }
        } else {
          console.log('   ❌ Failed to create platform');
        }
      } else {
        console.log('   ❌ Failed to create incubator');
      }
    } else {
      console.log('   ❌ Failed to create branch');
    }
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }

  console.log('\n✨ Test completed!');
  console.log('📊 Check http://localhost:3000 → الهيكل الهرمي to see the new entities');
}

// Run test
testEntityCreation();
