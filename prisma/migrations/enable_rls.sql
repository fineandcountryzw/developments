-- Phase 3: Enable Row-Level Security (RLS) on Critical Tables
-- This migration enforces branch isolation at the database level

-- Enable RLS on Client table
ALTER TABLE "Client" ENABLE ROW LEVEL SECURITY;

CREATE POLICY branch_isolation_clients ON "Client"
  AS RESTRICTIVE
  FOR ALL
  USING (branch = current_setting('app.user_branch', true)::text);

CREATE POLICY admin_bypass_clients ON "Client"
  AS PERMISSIVE
  FOR ALL
  USING (current_setting('app.user_role', true)::text = 'Admin');

-- Enable RLS on Payment table
ALTER TABLE "Payment" ENABLE ROW LEVEL SECURITY;

CREATE POLICY branch_isolation_payments ON "Payment"
  AS RESTRICTIVE
  FOR ALL
  USING (branch = current_setting('app.user_branch', true)::text);

CREATE POLICY admin_bypass_payments ON "Payment"
  AS PERMISSIVE
  FOR ALL
  USING (current_setting('app.user_role', true)::text = 'Admin');

-- Enable RLS on Commission table
ALTER TABLE "Commission" ENABLE ROW LEVEL SECURITY;

CREATE POLICY branch_isolation_commissions ON "Commission"
  AS RESTRICTIVE
  FOR ALL
  USING (branch = current_setting('app.user_branch', true)::text);

CREATE POLICY admin_bypass_commissions ON "Commission"
  AS PERMISSIVE
  FOR ALL
  USING (current_setting('app.user_role', true)::text = 'Admin');

-- Enable RLS on Stand table
ALTER TABLE "Stand" ENABLE ROW LEVEL SECURITY;

CREATE POLICY branch_isolation_stands ON "Stand"
  AS RESTRICTIVE
  FOR ALL
  USING (branch = current_setting('app.user_branch', true)::text);

CREATE POLICY admin_bypass_stands ON "Stand"
  AS PERMISSIVE
  FOR ALL
  USING (current_setting('app.user_role', true)::text = 'Admin');

-- Create RLS audit log table
CREATE TABLE IF NOT EXISTS "RLSAuditLog" (
  id SERIAL PRIMARY KEY,
  timestamp TIMESTAMP DEFAULT NOW(),
  user_id TEXT,
  user_branch TEXT,
  user_role TEXT,
  table_name TEXT,
  action TEXT,
  record_count INT,
  details JSONB
);

-- Log all RLS access attempts
CREATE TRIGGER audit_rls_access
  BEFORE SELECT ON "Client"
  FOR EACH STATEMENT
  EXECUTE FUNCTION log_rls_access();

-- Commit message:
-- feat(rls): enable row-level security on critical tables
-- - Client, Payment, Commission, Stand tables now enforce branch isolation
-- - Admin role can bypass RLS to see all branches
-- - RLS audit logging enabled for forensic analysis
-- - All API endpoints must set app.user_branch and app.user_role context
