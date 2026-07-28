-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'vendor_user';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "note" TEXT,
ADD COLUMN     "vendorId" INTEGER;

-- CreateTable
CREATE TABLE "VoucherActivation" (
    "id" SERIAL NOT NULL,
    "voucherId" INTEGER NOT NULL,
    "activatedBy" INTEGER NOT NULL,
    "vendorId" INTEGER NOT NULL,
    "activatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VoucherActivation_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoucherActivation" ADD CONSTRAINT "VoucherActivation_voucherId_fkey" FOREIGN KEY ("voucherId") REFERENCES "Voucher"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoucherActivation" ADD CONSTRAINT "VoucherActivation_activatedBy_fkey" FOREIGN KEY ("activatedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoucherActivation" ADD CONSTRAINT "VoucherActivation_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
