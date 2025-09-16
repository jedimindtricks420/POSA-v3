/*
  Warnings:

  - Added the required column `balanceAfter` to the `MerchantPayment` table without a default value. This is not possible if the table is not empty.
  - Added the required column `balanceBefore` to the `MerchantPayment` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "MerchantPayment" ADD COLUMN     "balanceAfter" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "balanceBefore" DOUBLE PRECISION NOT NULL;
