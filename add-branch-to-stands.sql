-- Migration: Add branch column to stands table
-- This fixes the Inventory module showing no data

-- Step 1: Add branch column with default value
ALTER TABLE stands 
ADD COLUMN IF NOT EXISTS branch TEXT NOT NULL DEFAULT 'Harare';

-- Step 2: Create index for branch filtering (performance optimization)
CREATE INDEX IF NOT EXISTS stands_branch_idx ON stands(branch);

-- Step 3: Update existing stands to inherit branch from their development
UPDATE stands  
SET branch = developments.branch
FROM developments
WHERE stands.development_id = developments.id
  AND developments.branch IS NOT NULL;

-- Step 4: Verify the migration
SELECT 
  'Migration Complete' as status,
  COUNT(*) as total_stands,
  COUNT(DISTINCT branch) as branches_count
FROM stands;

SELECT branch, COUNT(*) as count
FROM stands
GROUP BY branch
ORDER BY branch;
