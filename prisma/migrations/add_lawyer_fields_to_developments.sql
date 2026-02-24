-- Migration: Add lawyer fields to developments table
-- Date: 2026-01-28
-- Description: Add lawyer_name, lawyer_email, lawyer_phone columns for DocuSeal signing workflows

-- Add lawyer fields to developments table
ALTER TABLE developments 
ADD COLUMN IF NOT EXISTS lawyer_name TEXT,
ADD COLUMN IF NOT EXISTS lawyer_email TEXT,
ADD COLUMN IF NOT EXISTS lawyer_phone TEXT;

-- Add index on lawyer_email for faster lookups (optional but recommended)
CREATE INDEX IF NOT EXISTS idx_developments_lawyer_email ON developments(lawyer_email);

-- Verify columns were added
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'developments' AND column_name = 'lawyer_name'
    ) THEN
        RAISE EXCEPTION 'Column lawyer_name was not added successfully';
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'developments' AND column_name = 'lawyer_email'
    ) THEN
        RAISE EXCEPTION 'Column lawyer_email was not added successfully';
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'developments' AND column_name = 'lawyer_phone'
    ) THEN
        RAISE EXCEPTION 'Column lawyer_phone was not added successfully';
    END IF;
    
    RAISE NOTICE 'All lawyer fields added successfully to developments table';
END $$;
