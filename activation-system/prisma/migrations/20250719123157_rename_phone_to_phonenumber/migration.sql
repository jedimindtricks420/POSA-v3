/*
  Warnings:

  - You are about to drop the column `phone` on the `Client` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[phoneNumber]` on the table `Client` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `phoneNumber` to the `Client` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "Client_phone_key";

-- AlterTable
ALTER TABLE "Client" DROP COLUMN "phone",
ADD COLUMN     "phoneNumber" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Client_phoneNumber_key" ON "Client"("phoneNumber");
