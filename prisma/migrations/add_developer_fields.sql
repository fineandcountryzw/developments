-- Add developer information fields to developments table
-- These fields are for internal reports only, not displayed publicly

ALTER TABLE developments ADD COLUMN IF NOT EXISTS developer_name VARCHAR(255);
ALTER TABLE developments ADD COLUMN IF NOT EXISTS developer_email VARCHAR(255);
ALTER TABLE developments ADD COLUMN IF NOT EXISTS developer_phone VARCHAR(50);

-- Add comment for documentation
COMMENT ON COLUMN developments.developer_name IS 'Developer company/person name - for internal reports only';
COMMENT ON COLUMN developments.developer_email IS 'Developer contact email - for internal reports only';
COMMENT ON COLUMN developments.developer_phone IS 'Developer contact phone - for internal reports only';
