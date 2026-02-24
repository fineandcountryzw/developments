-- Migration: Add offline sales module with payment support
-- Supports import of past sales with multiple payment records

-- 1. Add hasGeoJsonMap column to Development
ALTER TABLE "Development" ADD COLUMN "hasGeoJsonMap" BOOLEAN DEFAULT false;

-- 2. Create ImportBatch table for tracking CSV imports
CREATE TABLE "ImportBatch" (
    "id" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "totalRecords" INTEGER NOT NULL,
    "successfulRecords" INTEGER NOT NULL,
    "failedRecords" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "importedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ImportBatch_pkey" PRIMARY KEY ("id")
);

-- 3. Create OfflineSale table for tracking historical sales
CREATE TABLE "OfflineSale" (
    "id" TEXT NOT NULL,
    "standId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "importBatchId" TEXT,
    "saleDate" TIMESTAMP(3) NOT NULL,
    "salePrice" DECIMAL(12,2) NOT NULL,
    "depositAmount" DECIMAL(12,2) NOT NULL,
    "paymentMethod" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OfflineSale_pkey" PRIMARY KEY ("id")
);

-- 4. Create OfflinePayment table for payment records
CREATE TABLE "OfflinePayment" (
    "id" TEXT NOT NULL,
    "offlineSaleId" TEXT NOT NULL,
    "paymentDate" TIMESTAMP(3) NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "paymentMethod" TEXT NOT NULL,
    "reference" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OfflinePayment_pkey" PRIMARY KEY ("id")
);

-- 5. Update GeneratedContract table - remove DocuSeal fields, add offline fields
ALTER TABLE "GeneratedContract" DROP COLUMN IF EXISTS "docusignEnvelopeId";
ALTER TABLE "GeneratedContract" DROP COLUMN IF EXISTS "docusignStatus";
ALTER TABLE "GeneratedContract" DROP COLUMN IF EXISTS "signerEmail";
ALTER TABLE "GeneratedContract" DROP COLUMN IF EXISTS "sentAt";
ALTER TABLE "GeneratedContract" DROP COLUMN IF EXISTS "signedAt";

ALTER TABLE "GeneratedContract" ADD COLUMN "isOffline" BOOLEAN DEFAULT false;
ALTER TABLE "GeneratedContract" ADD COLUMN "offlineSaleId" TEXT;
ALTER TABLE "GeneratedContract" ADD COLUMN "contractDate" TIMESTAMP(3);
ALTER TABLE "GeneratedContract" ADD COLUMN "notes" TEXT;

-- 6. Add foreign key constraints
ALTER TABLE "OfflineSale" ADD CONSTRAINT "OfflineSale_standId_fkey" FOREIGN KEY ("standId") REFERENCES "Stand"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OfflineSale" ADD CONSTRAINT "OfflineSale_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OfflineSale" ADD CONSTRAINT "OfflineSale_importBatchId_fkey" FOREIGN KEY ("importBatchId") REFERENCES "ImportBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "OfflinePayment" ADD CONSTRAINT "OfflinePayment_offlineSaleId_fkey" FOREIGN KEY ("offlineSaleId") REFERENCES "OfflineSale"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "GeneratedContract" ADD CONSTRAINT "GeneratedContract_offlineSaleId_fkey" FOREIGN KEY ("offlineSaleId") REFERENCES "OfflineSale"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 7. Create indexes for performance
CREATE INDEX "ImportBatch_importedById_idx" ON "ImportBatch"("importedById");
CREATE INDEX "OfflineSale_standId_idx" ON "OfflineSale"("standId");
CREATE INDEX "OfflineSale_clientId_idx" ON "OfflineSale"("clientId");
CREATE INDEX "OfflineSale_importBatchId_idx" ON "OfflineSale"("importBatchId");
CREATE INDEX "OfflineSale_saleDate_idx" ON "OfflineSale"("saleDate");
CREATE INDEX "OfflinePayment_offlineSaleId_idx" ON "OfflinePayment"("offlineSaleId");
CREATE INDEX "OfflinePayment_paymentDate_idx" ON "OfflinePayment"("paymentDate");
CREATE INDEX "GeneratedContract_offlineSaleId_idx" ON "GeneratedContract"("offlineSaleId");
CREATE INDEX "Development_hasGeoJsonMap_idx" ON "Development"("hasGeoJsonMap");
