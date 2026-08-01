-- AlterTable: дефолт "комиссия платформы с вендора" снижен с 80% до 20% —
-- 20% ближе к реальным ставкам новых вендоров, не меняет уже существующие записи
ALTER TABLE "Vendor" ALTER COLUMN "defaultCommissionPercent" SET DEFAULT 20;
