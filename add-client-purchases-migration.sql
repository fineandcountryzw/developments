-- Migration: Add Client Purchases Module
-- Run this against your database when it's available:
--   npx prisma db push
-- OR execute this SQL directly:

-- Create PurchaseStatus enum
DO $$ BEGIN
  CREATE TYPE "PurchaseStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'CANCELLED', 'SUSPENDED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create client_purchases table
CREATE TABLE IF NOT EXISTS "client_purchases" (
  "id" TEXT NOT NULL,
  "client_id" TEXT NOT NULL,
  "development_id" TEXT NOT NULL,
  "stand_id" TEXT NOT NULL,
  "purchase_price" DECIMAL(12,2) NOT NULL,
  "deposit_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "period_months" INTEGER NOT NULL DEFAULT 12,
  "monthly_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "start_date" TIMESTAMP(3) NOT NULL,
  "status" "PurchaseStatus" NOT NULL DEFAULT 'ACTIVE',
  "notes" TEXT,
  "branch" TEXT NOT NULL DEFAULT 'Harare',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "client_purchases_pkey" PRIMARY KEY ("id")
);

-- Create purchase_payments table
CREATE TABLE IF NOT EXISTS "purchase_payments" (
  "id" TEXT NOT NULL,
  "client_purchase_id" TEXT NOT NULL,
  "amount" DECIMAL(12,2) NOT NULL,
  "payment_date" TIMESTAMP(3) NOT NULL,
  "method" TEXT NOT NULL DEFAULT 'CASH',
  "reference" TEXT,
  "description" TEXT,
  "receipt_no" TEXT,
  "status" TEXT NOT NULL DEFAULT 'CONFIRMED',
  "created_by" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "purchase_payments_pkey" PRIMARY KEY ("id")
);

-- Add unique constraint on receipt_no
ALTER TABLE "purchase_payments" ADD CONSTRAINT "purchase_payments_receipt_no_key" UNIQUE ("receipt_no");

-- Add foreign keys
ALTER TABLE "client_purchases" ADD CONSTRAINT "client_purchases_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "client_purchases" ADD CONSTRAINT "client_purchases_development_id_fkey" FOREIGN KEY ("development_id") REFERENCES "developments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "client_purchases" ADD CONSTRAINT "client_purchases_stand_id_fkey" FOREIGN KEY ("stand_id") REFERENCES "stands"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "purchase_payments" ADD CONSTRAINT "purchase_payments_client_purchase_id_fkey" FOREIGN KEY ("client_purchase_id") REFERENCES "client_purchases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Add indexes
CREATE INDEX IF NOT EXISTS "client_purchases_client_id_idx" ON "client_purchases"("client_id");
CREATE INDEX IF NOT EXISTS "client_purchases_development_id_idx" ON "client_purchases"("development_id");
CREATE INDEX IF NOT EXISTS "client_purchases_stand_id_idx" ON "client_purchases"("stand_id");
CREATE INDEX IF NOT EXISTS "client_purchases_status_idx" ON "client_purchases"("status");
CREATE INDEX IF NOT EXISTS "client_purchases_branch_idx" ON "client_purchases"("branch");
CREATE INDEX IF NOT EXISTS "purchase_payments_client_purchase_id_idx" ON "purchase_payments"("client_purchase_id");
CREATE INDEX IF NOT EXISTS "purchase_payments_payment_date_idx" ON "purchase_payments"("payment_date");
CREATE INDEX IF NOT EXISTS "purchase_payments_status_idx" ON "purchase_payments"("status");
