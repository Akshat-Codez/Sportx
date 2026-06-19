const http = require('http');

async function run() {
  try {
    // 1. Register
    const regRes = await fetch('http://localhost:4000/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: '9999999999', name: 'Test', password: 'Password1!' })
    });
    const regJson = await regRes.json();
    console.log('Register:', regJson);

    // Get OTP from server terminal output (we can bypass this by just logging in if we disable OTP, but OTP is generated randomly)
    // Wait, since OTP is printed to terminal, we can't easily read it.
    // Let's just create a test token or bypass OTP in the server temporarily, or just read `server.js` to see if there's a bypass.
    // There is no bypass. 
  } catch (e) {
    console.error(e);
  }
}
run();
