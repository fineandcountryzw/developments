-- Offline Payment Migration Script
-- Run this SQL to add the OfflinePayment table to your database

-- Create OfflinePayment table
CREATE TABLE IF NOT EXISTS "offline_payments" (
    "id" TEXT NOT NULL,
    "offline_sale_id" TEXT NOT NULL,
    "payment_date" TIMESTAMP(3) NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "payment_method" TEXT NOT NULL,
    "reference" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "offline_payments_pkey" PRIMARY KEY ("id")
);

-- Add foreign key constraint
ALTER TABLE "offline_payments" ADD CONSTRAINT "offline_payments_offline_sale_id_fkey" 
    FOREIGN KEY ("offline_sale_id") REFERENCES "offline_sales"("id") 
    ON DELETE CASCADE ON UPDATE CASCADE;

-- Create indexes
CREATE INDEX IF NOT EXISTS "offline_payments_offline_sale_id_idx" ON "offline_payments"("offline_sale_id");
CREATE INDEX IF NOT EXISTS "offline_payments_payment_date_idx" ON "offline_payments"("payment_date");

-- Add hasGeoJsonMap column to Development (if not exists)
ALTER TABLE "Development" ADD COLUMN IF NOT EXISTS "hasGeoJsonMap" BOOLEAN DEFAULT false;
CREATE INDEX IF NOT EXISTS "development_has_geo_json_map_idx" ON "Development"("hasGeoJsonMap");

-- Update OfflineSale to include payments relation (optional - handled by ORM)
-- The relation is defined in Prisma schema
