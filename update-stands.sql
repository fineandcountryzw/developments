-- Update 3 stands to AVAILABLE status for the demo development
UPDATE stands 
SET status = 'AVAILABLE' 
WHERE development_id = 'dev-stlucia-demo' 
  AND status != 'AVAILABLE'
LIMIT 3;
