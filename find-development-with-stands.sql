SELECT d.id, d.name, COUNT(s.id) as stand_count 
FROM developments d 
LEFT JOIN stands s ON d.id = s.development_id 
GROUP BY d.id, d.name 
HAVING COUNT(s.id) > 0 
LIMIT 1;