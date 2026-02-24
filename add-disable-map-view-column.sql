-- Migration script to add disable_map_view column to developments table
-- This enables per-development toggle to disable map and activate stands table view

ALTER TABLE developments ADD COLUMN IF NOT EXISTS disable_map_view BOOLEAN DEFAULT FALSE;

-- Update existing records: if has_geo_json_map is FALSE, set disable_map_view to TRUE
UPDATE developments
SET disable_map_view = TRUE
WHERE has_geo_json_map = FALSE AND disable_map_view = FALSE;

-- Verify the column was added correctly
SELECT column_name, data_type, column_default, is_nullable
FROM information_schema.columns
WHERE table_name = 'developments' AND column_name = 'disable_map_view';
