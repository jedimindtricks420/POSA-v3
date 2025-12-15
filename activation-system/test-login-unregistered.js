import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:4000';
const UNREGISTERED_PHONE = '+998991234567'; // Номер, которого нет в базе

async function testLoginWithUnregisteredPhone() {
    console.log('=== Testing Login with Unregistered Phone ===\n');

    console.log('Attempting to login with:', UNREGISTERED_PHONE);

    const loginRes = await fetch(`${BASE_URL}/wallet`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: `phoneNumber=${encodeURIComponent(UNREGISTERED_PHONE)}`,
        redirect: 'manual',
    });

    const html = await loginRes.text();

    // Проверяем, есть ли сообщение об ошибке
    const hasError = html.includes('Аккаунт не найден');
    const hasRegistrationLink = html.includes('Регистрация') || html.includes('/client-register');

    console.log('\n📊 Test Results:');
    console.log('Status Code:', loginRes.status);
    console.log('Error message shown:', hasError ? '✅ Yes' : '❌ No');
    console.log('Registration link present:', hasRegistrationLink ? '✅ Yes' : '❌ No');

    if (hasError && hasRegistrationLink) {
        console.log('\n✅ SUCCESS: Login correctly rejects unregistered users');
    } else {
        console.log('\n❌ FAILED: Login behavior is incorrect');
        console.log('\nHTML snippet:');
        const errorSection = html.match(/class="rounded-2xl border border-red-200[^>]*>([^<]+)</);
        if (errorSection) {
            console.log('Error text:', errorSection[1]);
        }
    }
}

testLoginWithUnregisteredPhone().catch(console.error);
