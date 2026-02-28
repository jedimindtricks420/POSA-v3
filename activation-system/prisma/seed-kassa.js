/**
 * Seed скрипт: создаёт «Кассу 1» из текущих .env credentials
 * и привязывает к ней всех существующих вендоров
 *
 * Запуск: node prisma/seed-kassa.js
 */

import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

dotenv.config();
const prisma = new PrismaClient();

async function seedKassa() {
    console.log('=== Создание Кассы 1 из .env credentials ===\n');

    // Проверяем, не создана ли уже
    const existing = await prisma.kassa.findFirst({ where: { id: 1 } });
    if (existing) {
        console.log('Касса 1 уже существует:', existing.name);
        console.log('Пропускаем создание.\n');
        return;
    }

    // Читаем credentials из .env
    const kassa = await prisma.kassa.create({
        data: {
            name: 'Касса 1 (POSA)',
            legalName: 'Основной платёжный аккаунт',
            isActive: true,

            // Click
            clickMerchantId: process.env.CLICK_MERCHANT_ID || null,
            clickServiceId: process.env.CLICK_SERVICE_ID || null,
            clickSecretKey: process.env.CLICK_SECRET_KEY || null,

            // Payme
            paymeMerchantId: process.env.PAYME_MERCHANT_ID || null,
            paymeKey: process.env.PAYME_KEY || null,
            paymeTestKey: process.env.PAYME_TEST_KEY || null,
        },
    });

    console.log(`✅ Касса создана: id=${kassa.id}, name="${kassa.name}"`);

    // Привязать всех вендоров
    const result = await prisma.vendor.updateMany({
        where: { kassaId: null },
        data: { kassaId: kassa.id },
    });

    console.log(`✅ Привязано вендоров: ${result.count}`);

    // Привязать все существующие транзакции и попытки оплаты
    const txResult = await prisma.voucherTransaction.updateMany({
        where: { kassaId: null },
        data: { kassaId: kassa.id },
    });

    console.log(`✅ Привязано транзакций: ${txResult.count}`);

    const attemptResult = await prisma.qrPaymentAttempt.updateMany({
        where: { kassaId: null },
        data: { kassaId: kassa.id },
    });

    console.log(`✅ Привязано попыток оплаты: ${attemptResult.count}`);

    // Подсчёт итогов для кассы
    const totals = await prisma.voucherTransaction.aggregate({
        where: { kassaId: kassa.id },
        _sum: { price: true, kassaDebt: true },
    });

    await prisma.kassa.update({
        where: { id: kassa.id },
        data: {
            totalReceived: Number(totals._sum?.price || 0),
            balance: Number(totals._sum?.kassaDebt || 0),
        },
    });

    console.log(`\n✅ Баланс кассы обновлён:`);
    console.log(`   totalReceived: ${totals._sum?.price || 0}`);
    console.log(`   balance (kassaDebt): ${totals._sum?.kassaDebt || 0}`);

    console.log('\n=== Новые callback URLs для Click/Payme ===');
    console.log(`Click Prepare:  https://wallet.namo.uz/api/payments/click/${kassa.id}/prepare`);
    console.log(`Click Complete: https://wallet.namo.uz/api/payments/click/${kassa.id}/complete`);
    console.log(`Payme:          https://wallet.namo.uz/api/payments/payme/${kassa.id}`);
    console.log('\n⚠️  Обновите эти URL в кабинетах Click и Payme!');
}

seedKassa()
    .then(() => {
        console.log('\nDone.');
        process.exit(0);
    })
    .catch((err) => {
        console.error('Seed error:', err);
        process.exit(1);
    });
