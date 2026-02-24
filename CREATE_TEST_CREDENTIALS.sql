-- ============================================
-- TEST CREDENTIALS FOR ALL DASHBOARDS
-- Fine & Country Zimbabwe ERP
-- Created: January 18, 2026
-- ============================================

-- IMPORTANT: These are PLAIN TEXT passwords shown below.
-- In production, ensure passwords are securely hashed before inserting!
-- These credentials assume password hashing is done at application level.

-- ============================================
-- 1. ADMIN DASHBOARD - ADMIN USER
-- ============================================
-- Email: admin@fineandcountryerp.com
-- Password: AdminTest123!
-- Role: ADMIN
-- Access: Full access to all dashboards and settings
-- Branch: Harare (headquarters)

INSERT INTO users (
  id, 
  name, 
  email, 
  email_verified, 
  role, 
  branch, 
  is_active, 
  created_at, 
  updated_at
) VALUES (
  'admin-test-001',
  'Admin User',
  'admin@fineandcountryerp.com',
  NOW(),
  'ADMIN',
  'Harare',
  true,
  NOW(),
  NOW()
) ON CONFLICT (email) DO UPDATE SET updated_at = NOW();

-- ============================================
-- 2. AGENT DASHBOARD - AGENT USER
-- ============================================
-- Email: agent@fineandcountryerp.com
-- Password: AgentTest123!
-- Role: AGENT
-- Access: Agent Dashboard - properties, clients, deals, commissions
-- Branch: Harare

INSERT INTO users (
  id,
  name,
  email,
  email_verified,
  role,
  branch,
  is_active,
  created_at,
  updated_at
) VALUES (
  'agent-test-001',
  'John Agent',
  'agent@fineandcountryerp.com',
  NOW(),
  'AGENT',
  'Harare',
  true,
  NOW(),
  NOW()
) ON CONFLICT (email) DO UPDATE SET updated_at = NOW();

-- ============================================
-- 3. CLIENT DASHBOARD - CLIENT USER
-- ============================================
-- Email: client@fineandcountryerp.com
-- Password: ClientTest123!
-- Role: CLIENT
-- Access: Client Dashboard - reservations, payments, portfolio
-- Branch: Harare

INSERT INTO users (
  id,
  name,
  email,
  email_verified,
  role,
  branch,
  is_active,
  created_at,
  updated_at
) VALUES (
  'client-test-001',
  'Jane Client',
  'client@fineandcountryerp.com',
  NOW(),
  'CLIENT',
  'Harare',
  true,
  NOW(),
  NOW()
) ON CONFLICT (email) DO UPDATE SET updated_at = NOW();

-- ============================================
-- 4. MANAGER/BRANCH MANAGER DASHBOARD
-- ============================================
-- Email: manager@fineandcountryerp.com
-- Password: ManagerTest123!
-- Role: MANAGER
-- Access: Branch Management - agents, developments, commission oversight
-- Branch: Bulawayo

INSERT INTO users (
  id,
  name,
  email,
  email_verified,
  role,
  branch,
  is_active,
  created_at,
  updated_at
) VALUES (
  'manager-test-001',
  'Robert Manager',
  'manager@fineandcountryerp.com',
  NOW(),
  'MANAGER',
  'Bulawayo',
  true,
  NOW(),
  NOW()
) ON CONFLICT (email) DO UPDATE SET updated_at = NOW();

-- ============================================
-- 5. ACCOUNT/SUPPORT DASHBOARD
-- ============================================
-- Email: account@fineandcountryerp.com
-- Password: AccountTest123!
-- Role: ACCOUNT
-- Access: Account Management - user support, billing, account operations
-- Branch: Harare

INSERT INTO users (
  id,
  name,
  email,
  email_verified,
  role,
  branch,
  is_active,
  created_at,
  updated_at
) VALUES (
  'account-test-001',
  'Sarah Account',
  'account@fineandcountryerp.com',
  NOW(),
  'ACCOUNT',
  'Harare',
  true,
  NOW(),
  NOW()
) ON CONFLICT (email) DO UPDATE SET updated_at = NOW();

-- ============================================
-- ADDITIONAL TEST AGENTS (for multi-agent testing)
-- ============================================

INSERT INTO users (
  id,
  name,
  email,
  email_verified,
  role,
  branch,
  is_active,
  created_at,
  updated_at
) VALUES (
  'agent-test-002',
  'Peter Agent',
  'peter.agent@fineandcountryerp.com',
  NOW(),
  'AGENT',
  'Bulawayo',
  true,
  NOW(),
  NOW()
) ON CONFLICT (email) DO UPDATE SET updated_at = NOW();

INSERT INTO users (
  id,
  name,
  email,
  email_verified,
  role,
  branch,
  is_active,
  created_at,
  updated_at
) VALUES (
  'agent-test-003',
  'Sandra Agent',
  'sandra.agent@fineandcountryerp.com',
  NOW(),
  'AGENT',
  'Harare',
  true,
  NOW(),
  NOW()
) ON CONFLICT (email) DO UPDATE SET updated_at = NOW();

-- ============================================
-- ADDITIONAL TEST CLIENTS (for client portfolio testing)
-- ============================================

INSERT INTO users (
  id,
  name,
  email,
  email_verified,
  role,
  branch,
  is_active,
  created_at,
  updated_at
) VALUES (
  'client-test-002',
  'Michael Client',
  'michael.client@fineandcountryerp.com',
  NOW(),
  'CLIENT',
  'Bulawayo',
  true,
  NOW(),
  NOW()
) ON CONFLICT (email) DO UPDATE SET updated_at = NOW();

INSERT INTO users (
  id,
  name,
  email,
  email_verified,
  role,
  branch,
  is_active,
  created_at,
  updated_at
) VALUES (
  'client-test-003',
  'Victoria Client',
  'victoria.client@fineandcountryerp.com',
  NOW(),
  'CLIENT',
  'Harare',
  true,
  NOW(),
  NOW()
) ON CONFLICT (email) DO UPDATE SET updated_at = NOW();

-- ============================================
-- VERIFICATION QUERY
-- ============================================
-- Run this to verify test credentials were created:
-- SELECT id, name, email, role, branch, is_active FROM users 
-- WHERE email LIKE '%@fineandcountryerp.com' OR email LIKE '%test%'
-- ORDER BY role, email;
