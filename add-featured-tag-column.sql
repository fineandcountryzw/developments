-- Migration: Add featured_tag column to developments table
-- Date: 2026-02-09
-- Description: Adds the featured_tag column to support development tagging (none, promo, hot)

-- Add the featured_tag column to the developments table
ALTER TABLE "developments" 
ADD COLUMN IF NOT EXISTS "featured_tag" TEXT NOT NULL DEFAULT 'none';

-- Add a check constraint to ensure only valid values are used
ALTER TABLE "developments" 
ADD CONSTRAINT "featured_tag_check" 
CHECK ("featured_tag" IN ('none', 'promo', 'hot'));

-- Create an index on featured_tag for faster queries
CREATE INDEX IF NOT EXISTS "developments_featured_tag_idx" ON "developments"("featured_tag");

-- Update existing records to have 'none' as the default value
UPDATE "developments" 
SET "featured_tag" = 'none' 
WHERE "featured_tag" IS NULL;

-- Add comment to document the column
COMMENT ON COLUMN "developments"."featured_tag" IS 'Featured tag for development highlighting: none, promo, or hot';