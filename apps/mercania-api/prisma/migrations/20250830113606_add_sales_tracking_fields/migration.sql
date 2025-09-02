-- AlterTable
ALTER TABLE "items" ADD COLUMN     "priceCents" INTEGER,
ADD COLUMN     "soldMonth" INTEGER,
ADD COLUMN     "soldYear" INTEGER;

-- CreateIndex
CREATE INDEX "items_soldDate_idx" ON "items"("soldDate");

-- CreateIndex
CREATE INDEX "items_soldYear_soldMonth_idx" ON "items"("soldYear", "soldMonth");
