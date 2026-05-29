/*
  Warnings:

  - Added the required column `filled` to the `Order` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "filled" BIGINT NOT NULL;
