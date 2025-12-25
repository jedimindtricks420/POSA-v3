-- CreateEnum
CREATE TYPE "QrPaymentStatus" AS ENUM ('PENDING', 'PROCESSING', 'PAID', 'EXPIRED', 'FAILED');

-- CreateTable
CREATE TABLE "MerchantProductLink" (
    "id" SERIAL NOT NULL,
    "merchantId" INTEGER NOT NULL,
    "productId" INTEGER NOT NULL,
    "token" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MerchantProductLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QrPaymentAttempt" (
    "id" SERIAL NOT NULL,
    "linkId" INTEGER NOT NULL,
    "phoneNumber" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "paymentMethod" TEXT,
    "status" "QrPaymentStatus" NOT NULL DEFAULT 'PENDING',
    "externalPaymentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "paidAt" TIMESTAMP(3),
    "saleId" INTEGER,
    "voucherValue" TEXT,
    "receiptPath" TEXT,

    CONSTRAINT "QrPaymentAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MerchantProductLink_token_key" ON "MerchantProductLink"("token");

-- CreateIndex
CREATE UNIQUE INDEX "MerchantProductLink_merchantId_productId_key" ON "MerchantProductLink"("merchantId", "productId");

-- CreateIndex
CREATE UNIQUE INDEX "QrPaymentAttempt_saleId_key" ON "QrPaymentAttempt"("saleId");

-- AddForeignKey
ALTER TABLE "MerchantProductLink" ADD CONSTRAINT "MerchantProductLink_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MerchantProductLink" ADD CONSTRAINT "MerchantProductLink_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QrPaymentAttempt" ADD CONSTRAINT "QrPaymentAttempt_linkId_fkey" FOREIGN KEY ("linkId") REFERENCES "MerchantProductLink"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QrPaymentAttempt" ADD CONSTRAINT "QrPaymentAttempt_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE SET NULL ON UPDATE CASCADE;
