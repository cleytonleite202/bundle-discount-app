-- CreateTable
CREATE TABLE "BundleConfig" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "shop" TEXT NOT NULL,
    "discountNodeId" TEXT,
    "collectionIds" TEXT NOT NULL DEFAULT '[]',
    "discountPercentage" REAL NOT NULL DEFAULT 20,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "BundleConfig_shop_key" ON "BundleConfig"("shop");
