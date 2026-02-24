-- ============================================================================
-- Seed Test Data for Financial Tracking System
-- ============================================================================
-- This script creates sample data to test the financial tracking APIs
-- Run this AFTER migrations/006_financial_tracking.sql
-- ============================================================================

BEGIN;

-- Get test IDs (replace these with actual IDs from your database)
-- You need:
-- 1. A development ID
-- 2. An agent user ID
-- 3. Some stand IDs from that development

-- Example queries to find IDs:
-- SELECT id, name FROM developments LIMIT 5;
-- SELECT id, name, email, role FROM users WHERE role = 'agent' LIMIT 5;
-- SELECT id, "standNumber", development_id FROM stands WHERE development_id = 'YOUR_DEV_ID' LIMIT 10;

-- ============================================================================
-- STEP 1: Insert test contracts (sales) with financial data
-- ============================================================================

-- Test Sale 1: 5% commission model
INSERT INTO contracts (
  id,
  "standId",
  "clientName",
  "clientEmail",
  "clientPhone",
  status,
  "paymentMethod",
  amount,
  -- Financial fields
  commission_type,
  commission_rate,
  commission_total,
  commission_agent_share,
  commission_company_share,
  base_price,
  vat_amount,
  aos_fee,
  cession_fee,
  endowment_fee,
  total_client_payment,
  developer_net_amount,
  vat_enabled,
  vat_rate,
  "createdAt",
  "updatedAt"
) VALUES (
  'test-sale-001',
  'YOUR_STAND_ID_1', -- Replace with actual stand ID
  'John Doe',
  'john@example.com',
  '+263771234567',
  'ACTIVE',
  'Bank Transfer',
  50000.00,
  -- Financial breakdown for $50,000 stand with 5% commission
  'percentage',
  5.00,
  2500.00, -- 5% of 50000
  1250.00, -- 2.5% agent share
  1250.00, -- 2.5% company share
  50000.00,
  7750.00, -- 15.5% VAT
  500.00, -- AOS fee
  300.00, -- Cession fee
  200.00, -- Endowment fee
  58750.00, -- Total client pays (50000 + 7750 + 500 + 300 + 200)
  47500.00, -- Developer gets (50000 - 2500 commission)
  true,
  15.5,
  NOW() - INTERVAL '15 days',
  NOW()
);

-- Test Sale 2: $1000 fixed commission model
INSERT INTO contracts (
  id,
  "standId",
  "clientName",
  "clientEmail",
  "clientPhone",
  status,
  "paymentMethod",
  amount,
  -- Financial fields
  commission_type,
  commission_fixed_amount,
  commission_total,
  commission_agent_share,
  commission_company_share,
  base_price,
  vat_amount,
  aos_fee,
  total_client_payment,
  developer_net_amount,
  vat_enabled,
  vat_rate,
  "createdAt",
  "updatedAt"
) VALUES (
  'test-sale-002',
  'YOUR_STAND_ID_2', -- Replace with actual stand ID
  'Jane Smith',
  'jane@example.com',
  '+263777654321',
  'ACTIVE',
  'Cash',
  30000.00,
  -- Financial breakdown for $30,000 stand with $1000 fixed commission
  'fixed',
  1000.00,
  1000.00,
  600.00, -- Agent gets $600
  400.00, -- Company gets $400
  30000.00,
  4650.00, -- 15.5% VAT
  500.00, -- AOS fee
  35150.00, -- Total client pays (30000 + 4650 + 500)
  29000.00, -- Developer gets (30000 - 1000 commission)
  true,
  15.5,
  NOW() - INTERVAL '10 days',
  NOW()
);

-- Test Sale 3: Another 5% commission
INSERT INTO contracts (
  id,
  "standId",
  "clientName",
  "clientEmail",
  "clientPhone",
  status,
  "paymentMethod",
  amount,
  commission_type,
  commission_rate,
  commission_total,
  commission_agent_share,
  commission_company_share,
  base_price,
  vat_amount,
  total_client_payment,
  developer_net_amount,
  vat_enabled,
  vat_rate,
  "createdAt",
  "updatedAt"
) VALUES (
  'test-sale-003',
  'YOUR_STAND_ID_3', -- Replace with actual stand ID
  'Bob Johnson',
  'bob@example.com',
  '+263773456789',
  'ACTIVE',
  'EcoCash',
  75000.00,
  'percentage',
  5.00,
  3750.00, -- 5% of 75000
  1875.00, -- 2.5% agent share
  1875.00, -- 2.5% company share
  75000.00,
  11625.00, -- 15.5% VAT
  86625.00,
  71250.00, -- Developer gets (75000 - 3750)
  true,
  15.5,
  NOW() - INTERVAL '5 days',
  NOW()
);

-- ============================================================================
-- STEP 2: Insert agent commission records
-- ============================================================================

-- Commission 1 (for sale 1)
INSERT INTO agent_commissions (
  id,
  agent_id,
  sale_id,
  development_id,
  stand_number,
  client_name,
  commission_type,
  base_price,
  commission_rate,
  commission_amount,
  status,
  sale_date,
  created_at
) VALUES (
  'test-comm-001',
  'YOUR_AGENT_ID', -- Replace with actual agent user ID
  'test-sale-001',
  'YOUR_DEVELOPMENT_ID', -- Replace with actual development ID
  'A-101',
  'John Doe',
  'percentage',
  50000.00,
  2.5,
  1250.00,
  'PENDING',
  NOW() - INTERVAL '15 days',
  NOW()
);

-- Commission 2 (for sale 2)
INSERT INTO agent_commissions (
  id,
  agent_id,
  sale_id,
  development_id,
  stand_number,
  client_name,
  commission_type,
  base_price,
  commission_amount,
  status,
  sale_date,
  created_at
) VALUES (
  'test-comm-002',
  'YOUR_AGENT_ID',
  'test-sale-002',
  'YOUR_DEVELOPMENT_ID',
  'A-102',
  'Jane Smith',
  'fixed',
  30000.00,
  600.00,
  'PENDING',
  NOW() - INTERVAL '10 days',
  NOW()
);

-- Commission 3 (for sale 3) - Already paid
INSERT INTO agent_commissions (
  id,
  agent_id,
  sale_id,
  development_id,
  stand_number,
  client_name,
  commission_type,
  base_price,
  commission_rate,
  commission_amount,
  status,
  paid_date,
  payment_reference,
  payment_method,
  sale_date,
  created_at
) VALUES (
  'test-comm-003',
  'YOUR_AGENT_ID',
  'test-sale-003',
  'YOUR_DEVELOPMENT_ID',
  'A-103',
  'Bob Johnson',
  'percentage',
  75000.00,
  2.5,
  1875.00,
  'PAID',
  NOW() - INTERVAL '2 days',
  'PAY-2026-001',
  'Bank Transfer',
  NOW() - INTERVAL '5 days',
  NOW()
);

-- ============================================================================
-- STEP 3: Trigger will auto-create financial_summaries
-- ============================================================================
-- The trigger update_financial_summaries() will automatically populate
-- the financial_summaries table based on the contracts inserted above

-- ============================================================================
-- STEP 4: Insert a test developer payment
-- ============================================================================

INSERT INTO developer_payments (
  id,
  development_id,
  developer_email,
  amount,
  payment_date,
  payment_method,
  reference_number,
  month_year,
  notes,
  created_at
) VALUES (
  'test-payment-001',
  'YOUR_DEVELOPMENT_ID',
  'developer@example.com', -- Should match development's developer_email
  50000.00,
  NOW() - INTERVAL '3 days',
  'Bank Transfer',
  'WIRE-2026-001',
  TO_CHAR(NOW(), 'YYYY-MM'),
  'Test payment - partial settlement',
  NOW()
);

-- ============================================================================
-- STEP 5: Verification Queries
-- ============================================================================

-- Check contracts
SELECT 
  id,
  "standId",
  "clientName",
  commission_type,
  base_price,
  commission_total,
  developer_net_amount,
  status
FROM contracts
WHERE id LIKE 'test-sale-%'
ORDER BY "createdAt" DESC;

-- Check agent commissions
SELECT 
  id,
  agent_id,
  stand_number,
  commission_amount,
  status,
  sale_date
FROM agent_commissions
WHERE id LIKE 'test-comm-%'
ORDER BY sale_date DESC;

-- Check financial summaries (should be auto-created by trigger)
SELECT 
  id,
  development_id,
  month_year,
  total_sales_count,
  developer_gross,
  total_commission,
  developer_net,
  developer_paid_amount,
  developer_outstanding
FROM financial_summaries
WHERE development_id = 'YOUR_DEVELOPMENT_ID'
ORDER BY month_year DESC;

-- Check developer payments
SELECT 
  id,
  development_id,
  amount,
  payment_date,
  reference_number
FROM developer_payments
WHERE id LIKE 'test-payment-%'
ORDER BY payment_date DESC;

COMMIT;

-- ============================================================================
-- CLEANUP (Run this to remove test data when done)
-- ============================================================================
/*
BEGIN;

DELETE FROM developer_payments WHERE id LIKE 'test-payment-%';
DELETE FROM agent_commissions WHERE id LIKE 'test-comm-%';
DELETE FROM contracts WHERE id LIKE 'test-sale-%';
-- financial_summaries will be updated automatically by trigger

COMMIT;
*/

-- ============================================================================
-- INSTRUCTIONS
-- ============================================================================
/*
1. Replace placeholders:
   - YOUR_STAND_ID_1, YOUR_STAND_ID_2, YOUR_STAND_ID_3 (from stands table)
   - YOUR_AGENT_ID (from users table where role = 'agent')
   - YOUR_DEVELOPMENT_ID (from developments table)
   - developer@example.com (from developments.developer_email)

2. Run this script:
   psql $DATABASE_URL -f scripts/seed-test-financial-data.sql

3. Run the API test script:
   node scripts/test-financial-apis.js

4. Update TEST_DATA in test-financial-apis.js with the IDs you used

5. View results in your application or via API calls
*/
