-- Migration: Add geo_json_data JSONB column to developments table
-- This column stores the canonical GeoJSON FeatureCollection for the development

-- Only run if column doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'developments'
        AND column_name = 'geo_json_data'
    ) THEN
        ALTER TABLE developments ADD COLUMN geo_json_data JSONB;
        
        -- Create index for faster queries
        CREATE INDEX IF NOT EXISTS idx_developments_geojson ON developments USING GIN (geo_json_data);
        
        COMMENT ON COLUMN developments.geo_json_data IS 'Canonical GeoJSON FeatureCollection for development boundary and stands';
    END IF;
END $$;

-- Also add missing columns that may be referenced but not exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'developments'
        AND column_name = 'overview'
    ) THEN
        ALTER TABLE developments ADD COLUMN overview TEXT;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'developments'
        AND column_name = 'image_urls'
    ) THEN
        ALTER TABLE developments ADD COLUMN image_urls TEXT[];
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'developments'
        AND column_name = 'document_urls'
    ) THEN
        ALTER TABLE developments ADD COLUMN document_urls TEXT[];
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'developments'
        AND column_name = 'logo_url'
    ) THEN
        ALTER TABLE developments ADD COLUMN logo_url TEXT;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'developments'
        AND column_name = 'stand_sizes'
    ) THEN
        ALTER TABLE developments ADD COLUMN stand_sizes TEXT[];
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'developments'
        AND column_name = 'stand_types'
    ) THEN
        ALTER TABLE developments ADD COLUMN stand_types TEXT[];
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'developments'
        AND column_name = 'features'
    ) THEN
        ALTER TABLE developments ADD COLUMN features TEXT[];
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'developments'
        AND column_name = 'commission_model'
    ) THEN
        ALTER TABLE developments ADD COLUMN commission_model TEXT;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'developments'
        AND column_name = 'installment_periods'
    ) THEN
        ALTER TABLE developments ADD COLUMN installment_periods JSONB;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'developments'
        AND column_name = 'developer_name'
    ) THEN
        ALTER TABLE developments ADD COLUMN developer_name TEXT;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'developments'
        AND column_name = 'developer_email'
    ) THEN
        ALTER TABLE developments ADD COLUMN developer_email TEXT;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'developments'
        AND column_name = 'developer_phone'
    ) THEN
        ALTER TABLE developments ADD COLUMN developer_phone TEXT;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'developments'
        AND column_name = 'lawyer_name'
    ) THEN
        ALTER TABLE developments ADD COLUMN lawyer_name TEXT;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'developments'
        AND column_name = 'lawyer_email'
    ) THEN
        ALTER TABLE developments ADD COLUMN lawyer_email TEXT;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'developments'
        AND column_name = 'lawyer_phone'
    ) THEN
        ALTER TABLE developments ADD COLUMN lawyer_phone TEXT;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'developments'
        AND column_name = 'estate_progress'
    ) THEN
        ALTER TABLE developments ADD COLUMN estate_progress JSONB;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'developments'
        AND column_name = 'vat_enabled'
    ) THEN
        ALTER TABLE developments ADD COLUMN vat_enabled BOOLEAN DEFAULT true;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'developments'
        AND column_name = 'endowment_enabled'
    ) THEN
        ALTER TABLE developments ADD COLUMN endowment_enabled BOOLEAN DEFAULT false;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'developments'
        AND column_name = 'aos_enabled'
    ) THEN
        ALTER TABLE developments ADD COLUMN aos_enabled BOOLEAN DEFAULT false;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'developments'
        AND column_name = 'aos_fee'
    ) THEN
        ALTER TABLE developments ADD COLUMN aos_fee DECIMAL(12, 2) DEFAULT 0;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'developments'
        AND column_name = 'cessions_enabled'
    ) THEN
        ALTER TABLE developments ADD COLUMN cessions_enabled BOOLEAN DEFAULT false;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'developments'
        AND column_name = 'cession_fee'
    ) THEN
        ALTER TABLE developments ADD COLUMN cession_fee DECIMAL(12, 2) DEFAULT 0;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'developments'
        AND column_name = 'admin_fee_enabled'
    ) THEN
        ALTER TABLE developments ADD COLUMN admin_fee_enabled BOOLEAN DEFAULT false;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'developments'
        AND column_name = 'admin_fee'
    ) THEN
        ALTER TABLE developments ADD COLUMN admin_fee DECIMAL(12, 2) DEFAULT 0;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'developments'
        AND column_name = 'deposit_percentage'
    ) THEN
        ALTER TABLE developments ADD COLUMN deposit_percentage DECIMAL(5, 2) DEFAULT 10;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'developments'
        AND column_name = 'featured_tag'
    ) THEN
        ALTER TABLE developments ADD COLUMN featured_tag TEXT DEFAULT 'none';
    END IF;
END $$;

-- Also add branch column if missing
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'developments'
        AND column_name = 'branch'
    ) THEN
        ALTER TABLE developments ADD COLUMN branch TEXT DEFAULT 'Harare';
        
        CREATE INDEX IF NOT EXISTS idx_developments_branch ON developments(branch);
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'developments'
        AND column_name = 'last_updated_by_id'
    ) THEN
        ALTER TABLE developments ADD COLUMN last_updated_by_id TEXT;
    END IF;
END $$;
