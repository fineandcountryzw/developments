-- Phase 3: Row-Level Security (RLS) Implementation
-- Enable RLS on all tables for branch-based isolation
-- Run with: psql -d your_database -f rls-setup.sql

-- ============================================
-- ENABLE RLS ON CORE TABLES
-- ============================================

-- Users table
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;

CREATE POLICY users_branch_isolation ON "users"
  FOR ALL
  USING (
    -- Admin can see all
    CURRENT_SETTING('app.user_role') = 'ADMIN'
    OR
    -- Users can see their own record
    id = CURRENT_SETTING('app.user_id')::text
    OR
    -- Users in same branch can see each other
    branch = CURRENT_SETTING('app.branch')::text
  );

-- Clients table
ALTER TABLE "clients" ENABLE ROW LEVEL SECURITY;

CREATE POLICY clients_branch_isolation ON "clients"
  FOR ALL
  USING (branch = CURRENT_SETTING('app.branch')::text);

-- Payments table
ALTER TABLE "payments" ENABLE ROW LEVEL SECURITY;

CREATE POLICY payments_branch_isolation ON "payments"
  FOR ALL
  USING (branch = CURRENT_SETTING('app.branch')::text);

-- Developments table
ALTER TABLE "developments" ENABLE ROW LEVEL SECURITY;

CREATE POLICY developments_branch_isolation ON "developments"
  FOR ALL
  USING (branch = CURRENT_SETTING('app.branch')::text);

-- Stands table
ALTER TABLE "stands" ENABLE ROW LEVEL SECURITY;

CREATE POLICY stands_branch_isolation ON "stands"
  FOR ALL
  USING (branch = CURRENT_SETTING('app.branch')::text);

-- Contracts table
ALTER TABLE "contracts" ENABLE ROW LEVEL SECURITY;

CREATE POLICY contracts_branch_isolation ON "contracts"
  FOR ALL
  USING (branch = CURRENT_SETTING('app.branch')::text);

-- Commission table
ALTER TABLE "commissions" ENABLE ROW LEVEL SECURITY;

CREATE POLICY commissions_branch_isolation ON "commissions"
  FOR ALL
  USING (branch = CURRENT_SETTING('app.branch')::text);

-- Commission Payouts table
ALTER TABLE "commission_payouts" ENABLE ROW LEVEL SECURITY;

CREATE POLICY payouts_branch_isolation ON "commission_payouts"
  FOR ALL
  USING (branch = CURRENT_SETTING('app.branch')::text);

-- Pipeline Stages table
ALTER TABLE "pipeline_stages" ENABLE ROW LEVEL SECURITY;

CREATE POLICY pipeline_branch_isolation ON "pipeline_stages"
  FOR ALL
  USING (branch = CURRENT_SETTING('app.branch')::text);

-- Audit Logs table
ALTER TABLE "audit_logs" ENABLE ROW LEVEL SECURITY;

CREATE POLICY audit_logs_branch_isolation ON "audit_logs"
  FOR ALL
  USING (branch = CURRENT_SETTING('app.branch')::text);

-- Access Control table
ALTER TABLE "access_controls" ENABLE ROW LEVEL SECURITY;

CREATE POLICY access_control_branch_isolation ON "access_controls"
  FOR ALL
  USING (branch = CURRENT_SETTING('app.branch')::text);

-- ============================================
-- OPTIONAL: ADVANCED POLICIES
-- ============================================

-- Agent-specific policy: Agents can only see their own clients
CREATE POLICY agents_own_clients ON "clients"
  FOR SELECT
  USING (
    CURRENT_SETTING('app.user_role') = 'ADMIN'
    OR
    assigned_agent_id = CURRENT_SETTING('app.user_id')::text
  );

-- Admin override: Bypass all RLS
CREATE POLICY admin_bypass ON "audit_logs"
  FOR ALL
  USING (CURRENT_SETTING('app.user_role') = 'ADMIN');

-- ============================================
-- AUDIT TRIGGER
-- Automatically log all changes to audit_logs table
-- ============================================

CREATE OR REPLACE FUNCTION audit_trigger_func()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO audit_logs (
    user_id,
    table_name,
    record_id,
    action,
    branch,
    old_values,
    new_values,
    created_at
  ) VALUES (
    CURRENT_SETTING('app.user_id')::text,
    TG_TABLE_NAME,
    COALESCE(NEW.id, OLD.id)::text,
    TG_OP,
    CURRENT_SETTING('app.branch')::text,
    CASE WHEN TG_OP = 'DELETE' THEN row_to_json(OLD) ELSE NULL END,
    CASE WHEN TG_OP != 'DELETE' THEN row_to_json(NEW) ELSE NULL END,
    NOW()
  );
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Attach triggers to critical tables
-- Uncomment to enable audit logging

-- CREATE TRIGGER audit_clients AFTER INSERT OR UPDATE OR DELETE ON "clients"
--   FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

-- CREATE TRIGGER audit_payments AFTER INSERT OR UPDATE OR DELETE ON "payments"
--   FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

-- CREATE TRIGGER audit_contracts AFTER INSERT OR UPDATE OR DELETE ON "contracts"
--   FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

-- ============================================
-- VERIFY RLS STATUS
-- ============================================

-- Query to check RLS is enabled:
-- SELECT schemaname, tablename, rowsecurity FROM pg_tables
-- WHERE schemaname = 'public' AND rowsecurity = true;

-- Query to check policies:
-- SELECT schemaname, tablename, policyname, permissive, roles, qual
-- FROM pg_policies WHERE schemaname = 'public';
