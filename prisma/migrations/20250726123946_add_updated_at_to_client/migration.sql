/*
  Warnings:

  - Added the required column `updatedAt` to the `Client` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "VoucherActivation" DROP CONSTRAINT "VoucherActivation_activatedBy_fkey";

-- AlterTable
ALTER TABLE "Client" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "VoucherActivation" ADD COLUMN "clientId" INTEGER,
ALTER COLUMN "activatedBy" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "VoucherActivation" ADD CONSTRAINT "VoucherActivation_activatedBy_fkey" FOREIGN KEY ("activatedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoucherActivation" ADD CONSTRAINT "VoucherActivation_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;
