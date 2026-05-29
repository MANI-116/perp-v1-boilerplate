-- CreateEnum
CREATE TYPE "OrderType" AS ENUM ('MARKET', 'LIMIT');

-- CreateEnum
CREATE TYPE "OrderSide" AS ENUM ('SHORT', 'LONG');

-- CreateTable
CREATE TABLE "User" (
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL,
    "qty" BIGINT NOT NULL,
    "price" BIGINT NOT NULL,
    "marketId" TEXT NOT NULL,
    "type" "OrderType" NOT NULL,
    "side" "OrderType" NOT NULL,
    "slippage" BIGINT,
    "userId" TEXT NOT NULL,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transaction" (
    "id" TEXT NOT NULL,
    "qty" BIGINT NOT NULL,
    "price" BIGINT NOT NULL,
    "takerId" TEXT NOT NULL,
    "makerId" TEXT NOT NULL,
    "takerFee" BIGINT NOT NULL,
    "makerFee" BIGINT NOT NULL,
    "orderId" TEXT NOT NULL,

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Market" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "slug" TEXT NOT NULL DEFAULT 'no url',
    "scale" BIGINT NOT NULL,
    "markPrice" BIGINT NOT NULL,
    "takerRate" BIGINT NOT NULL,
    "makerRate" BIGINT NOT NULL,
    "mmr" BIGINT NOT NULL,

    CONSTRAINT "Market_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Market_name_key" ON "Market"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Market_symbol_key" ON "Market"("symbol");

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_makerId_fkey" FOREIGN KEY ("makerId") REFERENCES "User"("userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_takerId_fkey" FOREIGN KEY ("takerId") REFERENCES "User"("userId") ON DELETE RESTRICT ON UPDATE CASCADE;
