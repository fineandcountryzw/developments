-- Migration: Add features column to developments table
-- This adds a TEXT[] column to store amenities/features for developments
-- Run this in Neon SQL Editor: https://console.neon.tech

-- Add features column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'developments' 
        AND column_name = 'features'
    ) THEN
        ALTER TABLE developments 
        ADD COLUMN features TEXT[] DEFAULT '{}';
        
        RAISE NOTICE 'Column features added successfully';
    ELSE
        RAISE NOTICE 'Column features already exists';
    END IF;
END $$;

-- Create index for features array queries (optional but recommended)
CREATE INDEX IF NOT EXISTS idx_developments_features ON developments USING GIN (features);

-- Verify the column was added
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'developments' 
AND column_name = 'features';
