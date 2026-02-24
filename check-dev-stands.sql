-- Check developments and their stands
SELECT 
  d.id,
  d.name,
  d.branch,
  d.location,
  d.total_stands as planned_stands,
  COUNT(s.id) as actual_stands
FROM developments d
LEFT JOIN stands s ON s.development_id = d.id
GROUP BY d.id, d.name, d.branch, d.location, d.total_stands
ORDER BY d.name;

-- Total count
SELECT 
  (SELECT COUNT(*) FROM developments) as total_developments,
  (SELECT COUNT(*) FROM stands) as total_stands;
