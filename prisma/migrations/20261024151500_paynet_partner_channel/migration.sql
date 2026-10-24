-- AlterTable
ALTER TABLE "Kassa" ADD COLUMN     "totalReceivedPaynet" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "kassaId" INTEGER;

-- ВНИМАНИЕ: prisma migrate diff предлагал здесь удаление таблицы "session".
-- Это таблица express-session (connect-pg-simple): создаётся приложением и
-- намеренно отсутствует в schema.prisma. Удалять нельзя — разлогинит всех.

-- CreateTable
CREATE TABLE "PartnerService" (
    "id" SERIAL NOT NULL,
    "partner" TEXT NOT NULL,
    "serviceId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "kassaId" INTEGER,
    "login" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "merchantId" INTEGER NOT NULL,

    CONSTRAINT "PartnerService_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartnerServiceItem" (
    "id" SERIAL NOT NULL,
    "partnerServiceId" INTEGER NOT NULL,
    "productId" INTEGER NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "priceOverride" DOUBLE PRECISION,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "PartnerServiceItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartnerTransaction" (
    "id" SERIAL NOT NULL,
    "partner" TEXT NOT NULL,
    "externalTxnId" BIGINT NOT NULL,
    "partnerServiceId" INTEGER NOT NULL,
    "code" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "amount" BIGINT NOT NULL,
    "state" INTEGER NOT NULL DEFAULT 1,
    "saleId" INTEGER,
    "voucherValue" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cancelledAt" TIMESTAMP(3),

    CONSTRAINT "PartnerTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PartnerService_login_key" ON "PartnerService"("login");

-- CreateIndex
CREATE UNIQUE INDEX "PartnerService_partner_serviceId_key" ON "PartnerService"("partner", "serviceId");

-- CreateIndex
CREATE UNIQUE INDEX "PartnerServiceItem_partnerServiceId_code_key" ON "PartnerServiceItem"("partnerServiceId", "code");

-- CreateIndex
CREATE INDEX "PartnerTransaction_createdAt_idx" ON "PartnerTransaction"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PartnerTransaction_partner_externalTxnId_key" ON "PartnerTransaction"("partner", "externalTxnId");

-- CreateIndex
CREATE UNIQUE INDEX "QrPaymentAttempt_externalPaymentId_key" ON "QrPaymentAttempt"("externalPaymentId");

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_kassaId_fkey" FOREIGN KEY ("kassaId") REFERENCES "Kassa"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerService" ADD CONSTRAINT "PartnerService_kassaId_fkey" FOREIGN KEY ("kassaId") REFERENCES "Kassa"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerService" ADD CONSTRAINT "PartnerService_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerServiceItem" ADD CONSTRAINT "PartnerServiceItem_partnerServiceId_fkey" FOREIGN KEY ("partnerServiceId") REFERENCES "PartnerService"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerServiceItem" ADD CONSTRAINT "PartnerServiceItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerTransaction" ADD CONSTRAINT "PartnerTransaction_partnerServiceId_fkey" FOREIGN KEY ("partnerServiceId") REFERENCES "PartnerService"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

