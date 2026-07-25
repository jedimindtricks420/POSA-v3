-- AlterTable: add Alifpay credentials and stats to Kassa
ALTER TABLE "Kassa" ADD COLUMN IF NOT EXISTS "alifTokenProduction" TEXT;
ALTER TABLE "Kassa" ADD COLUMN IF NOT EXISTS "alifTokenSandbox" TEXT;
ALTER TABLE "Kassa" ADD COLUMN IF NOT EXISTS "alifSecretKeyProduction" TEXT;
ALTER TABLE "Kassa" ADD COLUMN IF NOT EXISTS "alifSecretKeySandbox" TEXT;
ALTER TABLE "Kassa" ADD COLUMN IF NOT EXISTS "alifEnv" TEXT DEFAULT 'sandbox';
ALTER TABLE "Kassa" ADD COLUMN IF NOT EXISTS "totalReceivedAlif" DOUBLE PRECISION NOT NULL DEFAULT 0;
