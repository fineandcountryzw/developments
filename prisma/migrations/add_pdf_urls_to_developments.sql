-- Migration: Add PDF URL fields to developments table
-- Date: 2026-01-28
-- Description: Add termsPdfUrl and refundPdfUrl columns for Terms & Conditions and Refund Policy PDFs

-- Add PDF URL fields to developments table
ALTER TABLE developments 
ADD COLUMN IF NOT EXISTS terms_pdf_url TEXT,
ADD COLUMN IF NOT EXISTS refund_pdf_url TEXT;

-- Add index on terms_pdf_url for faster lookups (optional)
CREATE INDEX IF NOT EXISTS idx_developments_terms_pdf_url ON developments(terms_pdf_url) WHERE terms_pdf_url IS NOT NULL;

-- Add index on refund_pdf_url for faster lookups (optional)
CREATE INDEX IF NOT EXISTS idx_developments_refund_pdf_url ON developments(refund_pdf_url) WHERE refund_pdf_url IS NOT NULL;

-- Verify columns were added
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'developments' AND column_name = 'terms_pdf_url'
    ) THEN
        RAISE EXCEPTION 'Column terms_pdf_url was not added successfully';
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'developments' AND column_name = 'refund_pdf_url'
    ) THEN
        RAISE EXCEPTION 'Column refund_pdf_url was not added successfully';
    END IF;
    
    RAISE NOTICE 'PDF URL fields added successfully to developments table';
END $$;
