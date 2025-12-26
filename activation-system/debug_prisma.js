
import prisma from './prisma/client.js';

async function check() {
    console.log('Prisma keys:', Object.keys(prisma));
    console.log('qrPaymentAttempt exists?', !!prisma.qrPaymentAttempt);
    await prisma.$disconnect();
}

check().catch(console.error);
