-- Add estate_progress column to developments table
-- This column stores JSON data for infrastructure progress milestones
-- Example: {"roads": "completed", "water": "in_progress", "sewer": "planned", "electricity": "completed", "compliance": "approved"}

ALTER TABLE developments ADD COLUMN IF NOT EXISTS estate_progress JSONB;

-- Add a comment for documentation
COMMENT ON COLUMN developments.estate_progress IS 'JSON object tracking infrastructure progress: roads, water, sewer, electricity, compliance status';
