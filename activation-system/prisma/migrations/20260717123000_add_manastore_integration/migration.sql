-- AlterEnum
ALTER TYPE "VendorProductType" ADD VALUE 'MANASTORE';

-- AlterTable
ALTER TABLE "Product" ADD COLUMN "manastoreVariantId" INTEGER;

-- CreateTable
CREATE TABLE "ManaStoreOrder" (
    "id" SERIAL NOT NULL,
    "voucherId" INTEGER NOT NULL,
    "environment" TEXT NOT NULL,
    "manaOrderId" TEXT NOT NULL,
    "manaOrderNumber" TEXT,
    "variantId" INTEGER NOT NULL,
    "fulfillmentStatus" TEXT,
    "paymentStatus" TEXT,
    "status" TEXT NOT NULL,
    "key" TEXT,
    "codes" TEXT,
    "rawContent" TEXT,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ManaStoreOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ManaStoreApiLog" (
    "id" SERIAL NOT NULL,
    "method" TEXT NOT NULL,
    "environment" TEXT NOT NULL,
    "variantId" TEXT,
    "referenceId" TEXT,
    "requestData" TEXT,
    "responseData" TEXT,
    "statusCode" INTEGER,
    "success" BOOLEAN NOT NULL,
    "errorMessage" TEXT,
    "duration" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ManaStoreApiLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ManaStoreSku" (
    "id" SERIAL NOT NULL,
    "variantId" INTEGER NOT NULL,
    "productId" INTEGER,
    "sku" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT,
    "costPrice" DOUBLE PRECISION,
    "retailPrice" DOUBLE PRECISION,
    "faceValue" DOUBLE PRECISION,
    "currency" TEXT,
    "meta" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ManaStoreSku_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ManaStoreOrder_voucherId_key" ON "ManaStoreOrder"("voucherId");

-- CreateIndex
CREATE UNIQUE INDEX "ManaStoreSku_variantId_key" ON "ManaStoreSku"("variantId");

-- AddForeignKey
ALTER TABLE "ManaStoreOrder" ADD CONSTRAINT "ManaStoreOrder_voucherId_fkey" FOREIGN KEY ("voucherId") REFERENCES "Voucher"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
