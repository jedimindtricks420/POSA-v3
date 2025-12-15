import prisma from './prisma/client.js';
import { normalizePhone } from './utils/phone.js';

async function testAccountDeletion() {
    console.log('=== Testing Account Deletion Logic ===\n');

    const testPhone = '+998003332222';

    // 1. Проверяем существование клиента
    console.log('Step 1: Checking if client exists...');
    let client = await prisma.client.findUnique({
        where: { phoneNumber: testPhone }
    });

    if (!client) {
        console.log('Client not found, creating...');
        client = await prisma.client.create({
            data: {
                phoneNumber: testPhone,
                name: 'Test User For Deletion'
            }
        });
    }

    console.log('✅ Client found:', { id: client.id, phone: client.phoneNumber, name: client.name });

    // 2. Симулируем удаление (анонимизацию)
    console.log('\nStep 2: Anonymizing client data...');

    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(2, 8);
    const anonymizedPhone = `deleted_${timestamp}_${randomId}`;

    const updated = await prisma.client.update({
        where: { id: client.id },
        data: {
            phoneNumber: anonymizedPhone,
            name: null,
        },
    });

    console.log('✅ Client anonymized:', { id: updated.id, phone: updated.phoneNumber, name: updated.name });

    // 3. Создаем запись в AuditLog
    console.log('\nStep 3: Creating audit log entry...');

    const auditLog = await prisma.auditLog.create({
        data: {
            actorUserId: null,
            role: 'client',
            action: 'CLIENT_ACCOUNT_DELETED',
            entityType: 'Client',
            details: {
                clientId: client.id,
                originalPhone: testPhone,
                anonymizedPhone,
                timestamp: new Date().toISOString(),
            },
            ip: '127.0.0.1',
        },
    });

    console.log('✅ Audit log created:', { id: auditLog.id, action: auditLog.action });

    // 4. Проверяем результат
    console.log('\nStep 4: Verifying anonymization...');

    const verifyClient = await prisma.client.findUnique({
        where: { id: client.id }
    });

    console.log('Final client state:', {
        id: verifyClient.id,
        phoneNumber: verifyClient.phoneNumber,
        name: verifyClient.name,
        isAnonymized: verifyClient.phoneNumber.startsWith('deleted_'),
        nameIsNull: verifyClient.name === null,
    });

    // 5. Проверяем, что старый номер больше не работает
    console.log('\nStep 5: Checking if old phone number is inaccessible...');

    const oldPhoneCheck = await prisma.client.findUnique({
        where: { phoneNumber: testPhone }
    });

    if (oldPhoneCheck) {
        console.log('❌ ERROR: Old phone number still accessible!');
    } else {
        console.log('✅ Old phone number is no longer accessible');
    }

    console.log('\n=== Test Complete ===');
    console.log('\n📊 Summary:');
    console.log('- Original phone:', testPhone);
    console.log('- Anonymized phone:', anonymizedPhone);
    console.log('- Name cleared:', verifyClient.name === null ? 'Yes' : 'No');
    console.log('- Audit log created:', 'Yes');
    console.log('- Old phone inaccessible:', oldPhoneCheck ? 'No (ERROR)' : 'Yes');

    await prisma.$disconnect();
}

testAccountDeletion().catch(console.error);
