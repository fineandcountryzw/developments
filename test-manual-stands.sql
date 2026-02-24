-- Manual Stand Creation Database Tests
-- Run these queries to verify the implementation

-- TEST 1: Check stands table structure
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'stands'
ORDER BY ordinal_position;

-- Expected columns:
-- id, stand_number, development_id, branch, price, price_per_sqm, 
-- size_sqm, status, reserved_by, created_at, updated_at

-- TEST 2: Check unique constraint exists
SELECT constraint_name, constraint_type
FROM information_schema.table_constraints
WHERE table_name = 'stands' AND constraint_type = 'UNIQUE';

-- Expected: stands_development_id_stand_number_key

-- TEST 3: Check branch index exists
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'stands' AND indexname LIKE '%branch%';

-- Expected: stands_branch_idx

-- TEST 4: Count existing stands
SELECT 
  COUNT(*) as total_stands,
  COUNT(DISTINCT development_id) as developments_with_stands,
  COUNT(DISTINCT branch) as branches
FROM stands;

-- TEST 5: Check stand distribution by status
SELECT 
  status,
  COUNT(*) as count,
  ROUND(AVG(price), 2) as avg_price,
  ROUND(AVG(size_sqm), 2) as avg_size
FROM stands
GROUP BY status
ORDER BY status;

-- TEST 6: Check sequential numbering (sample development)
-- Replace 'dev-xxx' with actual development ID
-- SELECT stand_number, status, price, size_sqm
-- FROM stands
-- WHERE development_id = 'dev-xxx'
-- ORDER BY stand_number ASC
-- LIMIT 10;

-- TEST 7: Test next available query logic
-- This is what the API does for nextAvailable=true
-- SELECT *
-- FROM stands
-- WHERE development_id = 'dev-xxx'
--   AND status = 'AVAILABLE'
-- ORDER BY stand_number ASC
-- LIMIT 1;

-- TEST 8: Check for duplicate stand numbers (should be 0)
SELECT 
  development_id,
  stand_number,
  COUNT(*) as duplicate_count
FROM stands
GROUP BY development_id, stand_number
HAVING COUNT(*) > 1;

-- Expected: 0 rows (no duplicates)

-- TEST 9: Verify stand number format (check for proper padding)
SELECT 
  stand_number,
  LENGTH(stand_number) as length,
  CASE 
    WHEN stand_number ~ '^[A-Z]+[0-9]{3}$' THEN 'PREFIX+3-DIGITS'
    WHEN stand_number ~ '^[0-9]{3}$' THEN '3-DIGITS-ONLY'
    ELSE 'INVALID-FORMAT'
  END as format_check
FROM stands
ORDER BY stand_number
LIMIT 20;

-- Expected: All should be either PREFIX+3-DIGITS or 3-DIGITS-ONLY

-- TEST 10: Performance check for next available query
EXPLAIN ANALYZE
SELECT *
FROM stands
WHERE development_id = (SELECT id FROM developments LIMIT 1)
  AND status = 'AVAILABLE'
ORDER BY stand_number ASC
LIMIT 1;

-- Should use index scan on stands_branch_idx
