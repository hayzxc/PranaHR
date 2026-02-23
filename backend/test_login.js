async function testLogin() {
  console.log('Testing login...');
  try {
    const response = await fetch('http://localhost:5000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'admin@sobathr.com',
        password: 'admin123',
      }),
    });

    const data = await response.json();

    console.log('Status:', response.status);
    if (response.ok) {
      console.log('Login successful!');
      console.log('Token received:', !!data.data?.token);
    } else {
      console.error('Login failed!');
      console.error('Data:', JSON.stringify(data, null, 2));
    }
  } catch (error) {
    console.error('Error:', error.message);
  }
}

testLogin();
