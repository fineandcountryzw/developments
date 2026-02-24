-- Migration: Add admin fee fields to developments table
-- Date: 2026-01-28
-- Description: Add admin_fee_enabled and admin_fee for optional per-development admin fees

ALTER TABLE developments
ADD COLUMN IF NOT EXISTS admin_fee_enabled BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS admin_fee NUMERIC(10,2) DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_developments_admin_fee_enabled ON developments(admin_fee_enabled);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'developments' AND column_name = 'admin_fee_enabled'
    ) THEN
        RAISE EXCEPTION 'Column admin_fee_enabled was not added successfully';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'developments' AND column_name = 'admin_fee'
    ) THEN
        RAISE EXCEPTION 'Column admin_fee was not added successfully';
    END IF;

    RAISE NOTICE 'Admin fee fields added successfully to developments table';
END $$;

