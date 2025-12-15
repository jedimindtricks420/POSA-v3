// Test script for account deletion
import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:4000';
const TEST_PHONE = '+998003332222';
const TEST_OTP = '888888';

async function testAccountDeletion() {
    console.log('=== Starting Account Deletion Test ===\n');

    // Step 1: Login (send OTP)
    console.log('Step 1: Logging in with phone:', TEST_PHONE);
    const loginRes = await fetch(`${BASE_URL}/wallet`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `phoneNumber=${encodeURIComponent(TEST_PHONE)}`,
        redirect: 'manual',
    });

    const cookies = loginRes.headers.raw()['set-cookie'] || [];
    const sessionCookie = cookies.find(c => c.startsWith('connect.sid='));

    if (!sessionCookie) {
        console.error('❌ Failed to get session cookie');
        return;
    }

    console.log('✅ Session cookie obtained');

    // Step 2: Verify OTP
    console.log('\nStep 2: Verifying OTP:', TEST_OTP);
    const verifyRes = await fetch(`${BASE_URL}/client-verify`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Cookie': sessionCookie.split(';')[0],
        },
        body: `otp=${TEST_OTP}`,
        redirect: 'manual',
    });

    const verifyCookies = verifyRes.headers.raw()['set-cookie'] || [];
    const finalCookie = verifyCookies.find(c => c.startsWith('connect.sid=')) || sessionCookie;

    console.log('✅ OTP verified, logged in');

    // Step 3: Delete account
    console.log('\nStep 3: Deleting account...');
    const deleteRes = await fetch(`${BASE_URL}/client/delete-account`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Cookie': finalCookie.split(';')[0],
        },
    });

    const deleteResult = await deleteRes.json();

    if (deleteResult.ok) {
        console.log('✅ Account deletion successful!');
        console.log('Response:', deleteResult);
    } else {
        console.error('❌ Account deletion failed');
        console.error('Response:', deleteResult);
    }

    console.log('\n=== Test Complete ===');
}

testAccountDeletion().catch(console.error);
