-- AlterTable: add clickMerchantUserId and clickEnv to Kassa
ALTER TABLE "Kassa" ADD COLUMN IF NOT EXISTS "clickMerchantUserId" TEXT;
ALTER TABLE "Kassa" ADD COLUMN IF NOT EXISTS "clickEnv" TEXT DEFAULT 'production';
