-- Migration: Add discount fields to stands and price snapshot fields to reservations
-- Date: 2026-01-28
-- Description: Support percentage-based discounts on stands by series/range

-- Add discount fields to stands table
ALTER TABLE stands 
ADD COLUMN IF NOT EXISTS discount_percent DECIMAL(5,2),
ADD COLUMN IF NOT EXISTS discount_active BOOLEAN DEFAULT true;

-- Add price snapshot fields to reservations table
ALTER TABLE reservations
ADD COLUMN IF NOT EXISTS base_price_at_reservation DECIMAL(12,2),
ADD COLUMN IF NOT EXISTS discount_percent_at_reservation DECIMAL(5,2),
ADD COLUMN IF NOT EXISTS final_price_at_reservation DECIMAL(12,2);

-- Add index on discount_percent for faster filtering
CREATE INDEX IF NOT EXISTS idx_stands_discount_percent ON stands(discount_percent) WHERE discount_percent IS NOT NULL;

-- Add index on discount_active for filtering discounted stands
CREATE INDEX IF NOT EXISTS idx_stands_discount_active ON stands(discount_active) WHERE discount_active = true;

-- Verify columns were added
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'stands' AND column_name = 'discount_percent'
    ) THEN
        RAISE EXCEPTION 'Column discount_percent was not added successfully';
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'stands' AND column_name = 'discount_active'
    ) THEN
        RAISE EXCEPTION 'Column discount_active was not added successfully';
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'reservations' AND column_name = 'final_price_at_reservation'
    ) THEN
        RAISE EXCEPTION 'Column final_price_at_reservation was not added successfully';
    END IF;
    
    RAISE NOTICE 'All discount and price snapshot fields added successfully';
END $$;
