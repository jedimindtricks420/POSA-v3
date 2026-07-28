-- AlterTable: add paymeEnv to Kassa
ALTER TABLE "Kassa" ADD COLUMN IF NOT EXISTS "paymeEnv" TEXT DEFAULT 'test';
