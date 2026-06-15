-- CreateTable
CREATE TABLE "ShopExpenses" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cashbox" INTEGER NOT NULL,
    "terminalTurnover" INTEGER NOT NULL,
    "morningCash" INTEGER NOT NULL,
    "expenses" INTEGER NOT NULL,
    "salary" INTEGER NOT NULL,
    "sellerId" TEXT NOT NULL,
    "reportDate" DATETIME NOT NULL,
    "shopId" TEXT NOT NULL,
    CONSTRAINT "ShopExpenses_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "Seller" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ShopExpenses_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Shop" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "Seller" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "telegramId" BIGINT NOT NULL,
    "username" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "ShopExpenses_sellerId_reportDate_idx" ON "ShopExpenses"("sellerId", "reportDate");

-- CreateIndex
CREATE INDEX "ShopExpenses_shopId_reportDate_idx" ON "ShopExpenses"("shopId", "reportDate");

-- CreateIndex
CREATE UNIQUE INDEX "Seller_telegramId_key" ON "Seller"("telegramId");
