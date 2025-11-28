-- CreateEnum
CREATE TYPE "VendorProductType" AS ENUM ('ROKKY', 'MANUAL', 'VOUCHER');

-- Update existing data to match new enum values
UPDATE "Vendor"
SET "productType" = CASE
    WHEN "productType" = 'Rokky' THEN 'ROKKY'
    WHEN "productType" = 'Manual' THEN 'MANUAL'
    WHEN "productType" IN ('Ваучеры', 'Voucher', 'API') THEN 'VOUCHER'
    WHEN "productType" = 'Telegram' THEN 'MANUAL'
    ELSE 'MANUAL'
END;

-- AlterTable
ALTER TABLE "Vendor" 
ALTER COLUMN "productType" TYPE "VendorProductType" 
USING "productType"::"VendorProductType";
