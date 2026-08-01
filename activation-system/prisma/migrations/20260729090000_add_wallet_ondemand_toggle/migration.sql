-- AlterTable: переключатель "получение кода по запросу в PWA" + override инструкции, per-товар
ALTER TABLE "Product" ADD COLUMN "walletOnDemandEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Product" ADD COLUMN "redeemInstructions" TEXT;

-- AlterTable: дефолтная инструкция "как использовать код" на уровне вендора
ALTER TABLE "Vendor" ADD COLUMN "redeemInstructions" TEXT;
