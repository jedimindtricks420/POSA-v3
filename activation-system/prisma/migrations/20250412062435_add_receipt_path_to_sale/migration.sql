/*
  Warnings:

  - The `status` column on the `Sale` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "SaleStatus" AS ENUM ('COMPLETED', 'CANCELLED', 'PENDING');

-- AlterTable
ALTER TABLE "Sale" ADD COLUMN     "receiptPath" TEXT,
DROP COLUMN "status",
ADD COLUMN     "status" "SaleStatus" NOT NULL DEFAULT 'COMPLETED';
