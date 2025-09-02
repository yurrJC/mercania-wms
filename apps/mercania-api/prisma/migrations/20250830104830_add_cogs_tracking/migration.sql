-- AlterTable
ALTER TABLE "items" ADD COLUMN     "listedDate" TIMESTAMP(3),
ADD COLUMN     "soldDate" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "cog_records" (
    "id" SERIAL NOT NULL,
    "recordDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "totalAmount" DOUBLE PRECISION NOT NULL,
    "itemsUpdated" INTEGER NOT NULL,
    "averagePerItem" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cog_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cogs_records" (
    "id" SERIAL NOT NULL,
    "itemId" INTEGER NOT NULL,
    "costCents" INTEGER NOT NULL,
    "soldDate" TIMESTAMP(3) NOT NULL,
    "soldMonth" INTEGER NOT NULL,
    "soldYear" INTEGER NOT NULL,
    "financialYear" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cogs_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "cogs_records_soldDate_idx" ON "cogs_records"("soldDate");

-- CreateIndex
CREATE INDEX "cogs_records_soldYear_soldMonth_idx" ON "cogs_records"("soldYear", "soldMonth");

-- CreateIndex
CREATE INDEX "cogs_records_financialYear_idx" ON "cogs_records"("financialYear");

-- CreateIndex
CREATE INDEX "cogs_records_itemId_idx" ON "cogs_records"("itemId");

-- AddForeignKey
ALTER TABLE "cogs_records" ADD CONSTRAINT "cogs_records_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
