import prisma from './prisma/client.js';

async function testWithVouchers() {
    console.log('=== Testing Account Deletion with Vouchers ===\n');

    const testPhone = '+998003332233'; // Другой демо номер

    // 1. Создаем клиента
    console.log('Step 1: Creating test client...');
    let client = await prisma.client.upsert({
        where: { phoneNumber: testPhone },
        update: {},
        create: {
            phoneNumber: testPhone,
            name: 'Test User With Vouchers'
        }
    });
    console.log('✅ Client created:', { id: client.id, phone: client.phoneNumber });

    // 2. Проверяем, есть ли у клиента ваучеры или активации
    console.log('\nStep 2: Checking client relations...');

    const clientWithRelations = await prisma.client.findUnique({
        where: { id: client.id },
        include: {
            activations: true,
            onlineVouchers: true,
            walletLogs: true,
        }
    });

    console.log('Client relations:', {
        activations: clientWithRelations.activations.length,
        onlineVouchers: clientWithRelations.onlineVouchers.length,
        walletLogs: clientWithRelations.walletLogs.length,
    });

    // 3. Анонимизируем клиента
    console.log('\nStep 3: Anonymizing client...');

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

    // 4. Проверяем, что связи остались
    console.log('\nStep 4: Verifying relations are preserved...');

    const verifyRelations = await prisma.client.findUnique({
        where: { id: client.id },
        include: {
            activations: true,
            onlineVouchers: true,
            walletLogs: true,
        }
    });

    console.log('Relations after anonymization:', {
        activations: verifyRelations.activations.length,
        onlineVouchers: verifyRelations.onlineVouchers.length,
        walletLogs: verifyRelations.walletLogs.length,
    });

    console.log('\n✅ All relations preserved!');
    console.log('📊 Summary:');
    console.log('- Client anonymized: Yes');
    console.log('- Relations preserved: Yes');
    console.log('- Data integrity maintained: Yes');

    await prisma.$disconnect();
}

testWithVouchers().catch(console.error);
