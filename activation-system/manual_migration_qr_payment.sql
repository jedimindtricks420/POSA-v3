-- CreateTable
CREATE TABLE "MerchantProductLink" (
  "id" SERIAL PRIMARY KEY,
  "merchantId" INTEGER NOT NULL,
  "productId" INTEGER NOT NULL,
  "token" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MerchantProductLink_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "MerchantProductLink_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "QrPaymentAttempt" (
  "id" SERIAL PRIMARY KEY,
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
  CONSTRAINT "QrPaymentAttempt_linkId_fkey" FOREIGN KEY ("linkId") REFERENCES "MerchantProductLink"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "QrPaymentAttempt_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateEnum
CREATE TYPE "QrPaymentStatus" AS ENUM ('PENDING', 'PROCESSING', 'PAID', 'EXPIRED', 'FAILED');

-- CreateIndex
CREATE UNIQUE INDEX "MerchantProductLink_token_key" ON "MerchantProductLink"("token");

-- CreateIndex
CREATE UNIQUE INDEX "MerchantProductLink_merchantId_productId_key" ON "MerchantProductLink"("merchantId", "productId");

-- CreateIndex
CREATE UNIQUE INDEX "QrPaymentAttempt_saleId_key" ON "QrPaymentAttempt"("saleId");
