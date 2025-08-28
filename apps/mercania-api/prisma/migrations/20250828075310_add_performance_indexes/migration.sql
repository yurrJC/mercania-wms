-- CreateEnum
CREATE TYPE "ItemStatus" AS ENUM ('INTAKE', 'STORED', 'LISTED', 'RESERVED', 'SOLD', 'RETURNED', 'DISCARDED');

-- CreateEnum
CREATE TYPE "ListingStatus" AS ENUM ('ACTIVE', 'SOLD', 'EXPIRED', 'REMOVED');

-- CreateTable
CREATE TABLE "isbn_master" (
    "id" SERIAL NOT NULL,
    "isbn" VARCHAR(13) NOT NULL,
    "title" VARCHAR(500) NOT NULL,
    "author" VARCHAR(200),
    "publisher" VARCHAR(200),
    "pubYear" INTEGER,
    "binding" VARCHAR(50),
    "imageUrl" TEXT,
    "categories" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "isbn_master_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "items" (
    "id" SERIAL NOT NULL,
    "isbn" VARCHAR(13),
    "conditionGrade" VARCHAR(10),
    "conditionNotes" TEXT,
    "costCents" INTEGER NOT NULL DEFAULT 0,
    "intakeDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "currentStatus" "ItemStatus" NOT NULL DEFAULT 'INTAKE',
    "currentLocation" VARCHAR(20),
    "lotNumber" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "item_status_history" (
    "id" SERIAL NOT NULL,
    "itemId" INTEGER NOT NULL,
    "fromStatus" "ItemStatus",
    "toStatus" "ItemStatus" NOT NULL,
    "channel" VARCHAR(50),
    "note" TEXT,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "item_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "listings" (
    "id" SERIAL NOT NULL,
    "itemId" INTEGER NOT NULL,
    "channel" VARCHAR(50) NOT NULL,
    "externalId" VARCHAR(100),
    "priceCents" INTEGER NOT NULL,
    "status" "ListingStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "listings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders" (
    "id" SERIAL NOT NULL,
    "channel" VARCHAR(50) NOT NULL,
    "buyer" VARCHAR(200),
    "totalCents" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_lines" (
    "id" SERIAL NOT NULL,
    "orderId" INTEGER NOT NULL,
    "itemId" INTEGER NOT NULL,
    "qty" INTEGER NOT NULL DEFAULT 1,
    "saleCents" INTEGER NOT NULL,

    CONSTRAINT "order_lines_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "isbn_master_isbn_key" ON "isbn_master"("isbn");

-- CreateIndex
CREATE INDEX "items_lotNumber_idx" ON "items"("lotNumber");

-- CreateIndex
CREATE INDEX "items_isbn_idx" ON "items"("isbn");

-- CreateIndex
CREATE INDEX "items_currentStatus_idx" ON "items"("currentStatus");

-- CreateIndex
CREATE INDEX "items_currentLocation_idx" ON "items"("currentLocation");

-- CreateIndex
CREATE INDEX "items_currentStatus_currentLocation_idx" ON "items"("currentStatus", "currentLocation");

-- CreateIndex
CREATE INDEX "items_createdAt_idx" ON "items"("createdAt");

-- AddForeignKey
ALTER TABLE "items" ADD CONSTRAINT "items_isbn_fkey" FOREIGN KEY ("isbn") REFERENCES "isbn_master"("isbn") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item_status_history" ADD CONSTRAINT "item_status_history_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listings" ADD CONSTRAINT "listings_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_lines" ADD CONSTRAINT "order_lines_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_lines" ADD CONSTRAINT "order_lines_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
