/*
  Warnings:

  - Added the required column `vendorDebt` to the `VoucherTransaction` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "VoucherTransaction" ADD COLUMN     "vendorDebt" DOUBLE PRECISION NOT NULL;
