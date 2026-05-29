/*
  Warnings:

  - You are about to drop the column `orderId` on the `Transaction` table. All the data in the column will be lost.
  - Added the required column `makerOrderId` to the `Transaction` table without a default value. This is not possible if the table is not empty.
  - Added the required column `takerOrderId` to the `Transaction` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Transaction" DROP CONSTRAINT "Transaction_orderId_fkey";

-- AlterTable
ALTER TABLE "Transaction" DROP COLUMN "orderId",
ADD COLUMN     "makerOrderId" TEXT NOT NULL,
ADD COLUMN     "takerOrderId" TEXT NOT NULL;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_makerOrderId_fkey" FOREIGN KEY ("makerOrderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_takerOrderId_fkey" FOREIGN KEY ("takerOrderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
