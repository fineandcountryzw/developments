-- Find duplicate active templates per development and branch
WITH duplicates AS (
  SELECT 
    development_id,
    branch,
    ARRAY_AGG(id ORDER BY created_at DESC) as template_ids,
    COUNT(*) as count
  FROM 
    contract_templates 
  WHERE 
    is_active = true AND status = 'ACTIVE' AND development_id IS NOT NULL
  GROUP BY 
    development_id, branch
  HAVING 
    COUNT(*) > 1
),
templates_to_deactivate AS (
  SELECT 
    unnest(template_ids[2:]) as id
  FROM duplicates
)
UPDATE contract_templates
SET is_active = false, status = 'ARCHIVED'
WHERE id IN (SELECT id FROM templates_to_deactivate);

-- Verify the fix
SELECT 
  development_id,
  branch,
  COUNT(*) as active_template_count
FROM 
  contract_templates 
WHERE 
  is_active = true AND status = 'ACTIVE' AND development_id IS NOT NULL
GROUP BY 
  development_id, branch
HAVING 
  COUNT(*) > 1;
