-- Migration: Add per-Development contract template support
-- This migration adds developmentId and isGlobal fields to contract_templates
-- and templateSnapshot to generated_contracts for versioning

-- Add development_id column to contract_templates
ALTER TABLE contract_templates 
ADD COLUMN IF NOT EXISTS development_id TEXT REFERENCES developments(id) ON DELETE SET NULL;

-- Add is_global column to contract_templates
ALTER TABLE contract_templates 
ADD COLUMN IF NOT EXISTS is_global BOOLEAN DEFAULT false;

-- Add template_snapshot column to generated_contracts for versioning
ALTER TABLE generated_contracts 
ADD COLUMN IF NOT EXISTS template_snapshot JSONB;

-- Mark existing templates as global (backward compatibility)
UPDATE contract_templates 
SET is_global = true 
WHERE development_id IS NULL;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_contract_templates_development_id ON contract_templates(development_id);
CREATE INDEX IF NOT EXISTS idx_contract_templates_is_global ON contract_templates(is_global);

-- Add comment explaining the fields
COMMENT ON COLUMN contract_templates.development_id IS 'Links template to a specific development. NULL = global template';
COMMENT ON COLUMN contract_templates.is_global IS 'True if this is a global template available to all developments';
COMMENT ON COLUMN generated_contracts.template_snapshot IS 'JSON snapshot of template at contract generation time for versioning';

-- Verify migration
SELECT 
  COUNT(*) as total_templates,
  COUNT(development_id) as development_specific,
  COUNT(*) FILTER (WHERE is_global = true) as global_templates
FROM contract_templates;
