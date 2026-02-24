-- Migration: Add Wizard Stand Actions support
-- Adds sold tracking fields, discount fields, and StandActionLog table

-- Add new fields to stands table
ALTER TABLE "stands" ADD COLUMN IF NOT EXISTS "discount_amount" DECIMAL(12, 2);
ALTER TABLE "stands" ADD COLUMN IF NOT EXISTS "discounted_price" DECIMAL(12, 2);
ALTER TABLE "stands" ADD COLUMN IF NOT EXISTS "sold_at" TIMESTAMP;
ALTER TABLE "stands" ADD COLUMN IF NOT EXISTS "sold_reason" TEXT;
ALTER TABLE "stands" ADD COLUMN IF NOT EXISTS "sold_by" TEXT;

-- Add index on status for faster lookups
CREATE INDEX IF NOT EXISTS "stands_status_idx" ON "stands" ("status");

-- Add BLOCKED and CANCELLED to StandStatus enum if they don't exist
DO $$ BEGIN
  ALTER TYPE "StandStatus" ADD VALUE IF NOT EXISTS 'BLOCKED';
  ALTER TYPE "StandStatus" ADD VALUE IF NOT EXISTS 'CANCELLED';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Create stand_action_logs table
CREATE TABLE IF NOT EXISTS "stand_action_logs" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "stand_id" TEXT NOT NULL,
  "action_type" TEXT NOT NULL,
  "payload" JSONB,
  "reason" TEXT NOT NULL,
  "old_values" JSONB,
  "new_values" JSONB,
  "created_by" TEXT NOT NULL,
  "created_by_email" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "stand_action_logs_pkey" PRIMARY KEY ("id")
);

-- Add foreign key
ALTER TABLE "stand_action_logs" 
  ADD CONSTRAINT "stand_action_logs_stand_id_fkey" 
  FOREIGN KEY ("stand_id") REFERENCES "stands"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Add indexes
CREATE INDEX IF NOT EXISTS "stand_action_logs_stand_id_idx" ON "stand_action_logs" ("stand_id");
CREATE INDEX IF NOT EXISTS "stand_action_logs_action_type_idx" ON "stand_action_logs" ("action_type");
CREATE INDEX IF NOT EXISTS "stand_action_logs_created_at_idx" ON "stand_action_logs" ("created_at");
