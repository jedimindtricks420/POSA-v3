/*
  Warnings:

  - You are about to drop the column `balance` on the `Vendor` table. All the data in the column will be lost.
  - You are about to drop the column `legalInfo` on the `Vendor` table. All the data in the column will be lost.
  - You are about to drop the column `status` on the `Vendor` table. All the data in the column will be lost.
  - You are about to drop the column `type` on the `Vendor` table. All the data in the column will be lost.
  - Added the required column `vendorId` to the `Product` table without a default value. This is not possible if the table is not empty.
  - Changed the type of `status` on the `Product` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Added the required column `category` to the `Vendor` table without a default value. This is not possible if the table is not empty.
  - Added the required column `productType` to the `Vendor` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "Vendor_name_key";

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "vendorId" INTEGER NOT NULL,
DROP COLUMN "status",
ADD COLUMN     "status" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Vendor" DROP COLUMN "balance",
DROP COLUMN "legalInfo",
DROP COLUMN "status",
DROP COLUMN "type",
ADD COLUMN     "category" TEXT NOT NULL,
ADD COLUMN     "description" TEXT,
ADD COLUMN     "productType" TEXT NOT NULL;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Voucher" ADD CONSTRAINT "Voucher_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
