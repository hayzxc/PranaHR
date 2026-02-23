

const BASE_URL = 'http://localhost:5000/api';
let token = '';

async function login() {
  console.log('1. Testing Login...');
  try {
    const res = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@sobathr.com', password: 'admin123' }),
    });
    const data = await res.json();

    if (data.success && data.data.token) {
      token = data.data.token;
      console.log('   ✅ Login Successful');
      return true;
    } else {
      console.error('   ❌ Login Failed:', data);
      return false;
    }
  } catch (e) {
    console.error('   ❌ Login Error:', e.message);
    return false;
  }
}

async function checkEndpoint(name, url) {
  console.log(`${name}...`);
  try {
    const res = await fetch(`${BASE_URL}${url}`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    const data = await res.json();

    // Expect { success: true, data: ... }
    if (res.ok && data.success && data.data) {
      // For list endpoints, data.data should optionally be an array or object with data
      // Specifically we are looking for the 'data' property wrapping the content
      const isWrapped = data.data !== undefined;
      console.log(`   ✅ ${name}: OK (${res.status}) - Wrapped Correctly: ${isWrapped}`);
      if (Array.isArray(data.data)) {
        console.log(`      Item count: ${data.data.length}`);
      } else if (typeof data.data === 'object') {
        console.log(`      Object keys: ${Object.keys(data.data).join(', ')}`);
      }
    } else {
      console.error(`   ❌ ${name}: Failed`, data);
    }
  } catch (e) {
    console.error(`   ❌ ${name}: Error`, e.message);
  }
}

async function run() {
  if (await login()) {
    await checkEndpoint('2. Get Profile', '/auth/me');
    await checkEndpoint('3. Get Employees', '/employees');
    await checkEndpoint('4. Get Leaves', '/leaves');
    await checkEndpoint('5. Get Payroll', '/payroll');
    await checkEndpoint('6. Get Settings', '/settings');
    await checkEndpoint('7. Get Departments (Settings)', '/settings'); // Usually part of settings
  }
}

run();
