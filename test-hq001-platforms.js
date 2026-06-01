// Test the fixed endpoint
const testEndpoint = async () => {
  console.log('🧪 Testing /api/incubators/HQ001/platforms endpoint...\n');
  
  try {
    const response = await fetch('https://super-cmk2wuy9-production.up.railway.app/api/incubators/HQ001/platforms');
    
    console.log('Status:', response.status, response.statusText);
    
    if (response.ok) {
      const data = await response.json();
      console.log('\n✅ SUCCESS!');
      console.log(`Found ${data.length} platforms for HQ001:`);
      data.forEach(platform => {
        console.log(`  - ${platform.name} (${platform.code})`);
      });
    } else {
      const error = await response.text();
      console.log('\n❌ FAILED');
      console.log('Error:', error);
    }
  } catch (error) {
    console.log('\n❌ ERROR:', error.message);
  }
};

testEndpoint();
