-- Check stands in database
SELECT COUNT(*) as total_stands FROM stands;

-- Check stands by branch
SELECT branch, COUNT(*) as count 
FROM stands 
GROUP BY branch;

-- Sample stands
SELECT id, stand_number, branch, development_id, status 
FROM stands 
LIMIT 5;
