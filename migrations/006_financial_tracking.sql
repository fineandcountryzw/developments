-- ============================================================================
-- MIGRATION 006: Financial Tracking & Commission System
-- ============================================================================
-- Description: Add comprehensive financial tracking for sales, commissions,
--              and developer statements
-- Date: January 22, 2026
-- ============================================================================

BEGIN;

-- ============================================================================
-- PART 1: Contracts Table Enhancement
-- Add financial breakdown columns to existing contracts table
-- (This system uses contracts instead of sales for sold stands)
-- ============================================================================

-- Commission tracking
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS commission_type VARCHAR(20); -- 'percentage' or 'fixed'
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS commission_rate DECIMAL(5,2); -- e.g., 5.00 for 5%
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS commission_fixed_amount DECIMAL(10,2); -- e.g., 1000.00
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS commission_total DECIMAL(10,2); -- Total commission deducted
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS commission_agent_share DECIMAL(10,2); -- Agent portion
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS commission_company_share DECIMAL(10,2); -- F&C portion

-- Price breakdown columns
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS base_price DECIMAL(10,2); -- Stand base price
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS vat_amount DECIMAL(10,2); -- VAT calculated
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS aos_fee DECIMAL(10,2); -- Agreement of Sale fee
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS cession_fee DECIMAL(10,2); -- Cession fee
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS endowment_fee DECIMAL(10,2); -- Endowment fee
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS total_client_payment DECIMAL(10,2); -- What client pays
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS developer_net_amount DECIMAL(10,2); -- What developer receives

-- Fee toggles (from development config at time of sale)
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS vat_enabled BOOLEAN DEFAULT true;
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS vat_rate DECIMAL(5,2) DEFAULT 15.5;
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS aos_enabled BOOLEAN DEFAULT false;
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS cession_enabled BOOLEAN DEFAULT false;
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS endowment_enabled BOOLEAN DEFAULT false;

-- Add comments
COMMENT ON COLUMN contracts.commission_type IS 'Commission model: percentage (5%) or fixed ($1000)';
COMMENT ON COLUMN contracts.commission_agent_share IS 'Agent commission amount (2.5% or custom fixed)';
COMMENT ON COLUMN contracts.commission_company_share IS 'Company commission amount (2.5% or custom fixed)';
COMMENT ON COLUMN contracts.base_price IS 'Stand base price before any fees or commissions';
COMMENT ON COLUMN contracts.developer_net_amount IS 'Amount owed to developer (base - commission)';
COMMENT ON COLUMN contracts.total_client_payment IS 'Total amount client pays (base + all fees)';

-- ============================================================================
-- PART 2: Financial Summaries Table
-- Monthly/development financial aggregations
-- ============================================================================

CREATE TABLE IF NOT EXISTS financial_summaries (
  id VARCHAR(50) PRIMARY KEY,
  development_id VARCHAR(50) NOT NULL,
  month_year VARCHAR(7) NOT NULL, -- Format: 'YYYY-MM'
  
  -- Sales metrics
  total_sales_count INTEGER DEFAULT 0,
  total_sales_value DECIMAL(12,2) DEFAULT 0, -- Total client payments
  
  -- Developer finances
  developer_gross DECIMAL(12,2) DEFAULT 0, -- Sum of base prices
  developer_commission_deducted DECIMAL(12,2) DEFAULT 0, -- Total commission
  developer_net DECIMAL(12,2) DEFAULT 0, -- Gross - commission
  developer_paid_amount DECIMAL(12,2) DEFAULT 0, -- Payments made to developer
  developer_outstanding DECIMAL(12,2) DEFAULT 0, -- Still owed
  
  -- Commission breakdown
  total_commission DECIMAL(12,2) DEFAULT 0,
  agent_commission_total DECIMAL(12,2) DEFAULT 0,
  company_commission_total DECIMAL(12,2) DEFAULT 0,
  
  -- Fee components (informational)
  vat_collected DECIMAL(12,2) DEFAULT 0,
  aos_fees_collected DECIMAL(12,2) DEFAULT 0,
  cession_fees_collected DECIMAL(12,2) DEFAULT 0,
  endowment_fees_collected DECIMAL(12,2) DEFAULT 0,
  total_fees_collected DECIMAL(12,2) DEFAULT 0,
  
  -- Metadata
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  -- Foreign key
  CONSTRAINT fk_financial_summaries_development 
    FOREIGN KEY (development_id) 
    REFERENCES developments(id) 
    ON DELETE CASCADE,
  
  -- Unique constraint: one summary per development per month
  CONSTRAINT unique_development_month 
    UNIQUE (development_id, month_year)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_financial_summaries_dev 
  ON financial_summaries(development_id);
  
CREATE INDEX IF NOT EXISTS idx_financial_summaries_month 
  ON financial_summaries(month_year);
  
CREATE INDEX IF NOT EXISTS idx_financial_summaries_dev_month 
  ON financial_summaries(development_id, month_year);

-- Comments
COMMENT ON TABLE financial_summaries IS 'Monthly financial summaries per development';
COMMENT ON COLUMN financial_summaries.developer_net IS 'Amount owed to developer (after commission)';
COMMENT ON COLUMN financial_summaries.total_fees_collected IS 'VAT + AOS + Cession + Endowment fees';

-- ============================================================================
-- PART 3: Agent Commissions Table
-- Individual agent commission tracking
-- ============================================================================

CREATE TABLE IF NOT EXISTS agent_commissions (
  id VARCHAR(50) PRIMARY KEY,
  agent_id VARCHAR(50) NOT NULL,
  sale_id VARCHAR(50) NOT NULL,
  development_id VARCHAR(50) NOT NULL,
  stand_number VARCHAR(20),
  client_name VARCHAR(255),
  
  -- Commission details
  commission_type VARCHAR(20) NOT NULL, -- 'percentage' or 'fixed'
  base_price DECIMAL(10,2) NOT NULL,
  commission_rate DECIMAL(5,2), -- e.g., 2.5 for agent's 2.5%
  commission_amount DECIMAL(10,2) NOT NULL, -- Agent's share
  
  -- Payment status
  status VARCHAR(20) DEFAULT 'PENDING', -- PENDING, PAID, DISPUTED, CANCELLED
  paid_date TIMESTAMP,
  payment_reference VARCHAR(100),
  payment_method VARCHAR(50), -- 'Bank Transfer', 'Cash', 'EcoCash', etc.
  notes TEXT,
  
  -- Timestamps
  sale_date TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  -- Foreign keys
  CONSTRAINT fk_agent_commissions_agent 
    FOREIGN KEY (agent_id) 
    REFERENCES users(id) 
    ON DELETE CASCADE,
    
  CONSTRAINT fk_agent_commissions_contract 
    FOREIGN KEY (sale_id) 
    REFERENCES contracts(id) 
    ON DELETE CASCADE,
    
  CONSTRAINT fk_agent_commissions_development 
    FOREIGN KEY (development_id) 
    REFERENCES developments(id) 
    ON DELETE CASCADE
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_agent_commissions_agent 
  ON agent_commissions(agent_id);
  
CREATE INDEX IF NOT EXISTS idx_agent_commissions_status 
  ON agent_commissions(status);
  
CREATE INDEX IF NOT EXISTS idx_agent_commissions_sale 
  ON agent_commissions(sale_id);
  
CREATE INDEX IF NOT EXISTS idx_agent_commissions_dev 
  ON agent_commissions(development_id);
  
CREATE INDEX IF NOT EXISTS idx_agent_commissions_agent_status 
  ON agent_commissions(agent_id, status);

-- Comments
COMMENT ON TABLE agent_commissions IS 'Individual agent commission tracking and payment status';
COMMENT ON COLUMN agent_commissions.commission_amount IS 'Agent share (2.5% or custom fixed amount)';
COMMENT ON COLUMN agent_commissions.status IS 'Payment status: PENDING, PAID, DISPUTED, CANCELLED';

-- ============================================================================
-- PART 4: Developer Payments Table
-- Track payments made to developers
-- ============================================================================

CREATE TABLE IF NOT EXISTS developer_payments (
  id VARCHAR(50) PRIMARY KEY,
  development_id VARCHAR(50) NOT NULL,
  developer_email VARCHAR(255), -- Developer contact from development record
  
  -- Payment details
  amount DECIMAL(12,2) NOT NULL,
  payment_date TIMESTAMP NOT NULL,
  payment_method VARCHAR(50), -- 'Bank Transfer', 'RTGS', etc.
  reference_number VARCHAR(100),
  
  -- Period covered
  period_start DATE,
  period_end DATE,
  month_year VARCHAR(7), -- 'YYYY-MM'
  
  -- Related sales
  sale_ids TEXT[], -- Array of sale IDs included in this payment
  
  -- Metadata
  notes TEXT,
  processed_by VARCHAR(50), -- User ID who processed payment
  created_at TIMESTAMP DEFAULT NOW(),
  
  -- Foreign key
  CONSTRAINT fk_developer_payments_development 
    FOREIGN KEY (development_id) 
    REFERENCES developments(id) 
    ON DELETE CASCADE
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_developer_payments_dev 
  ON developer_payments(development_id);
  
CREATE INDEX IF NOT EXISTS idx_developer_payments_month 
  ON developer_payments(month_year);

-- Comments
COMMENT ON TABLE developer_payments IS 'Payments made to developers';
COMMENT ON COLUMN developer_payments.amount IS 'Payment amount (sum of developer_net_amount from sales)';

-- ============================================================================
-- PART 5: Update Existing Data (Backfill)
-- ============================================================================

-- Set default values for existing contracts where financial columns are null
UPDATE contracts 
SET 
  commission_type = 'percentage',
  commission_rate = 5.0,
  vat_enabled = true,
  vat_rate = 15.5,
  aos_enabled = false,
  cession_enabled = false,
  endowment_enabled = false
WHERE commission_type IS NULL;

-- Add comment for contracts table
COMMENT ON TABLE contracts IS 'Contract records with comprehensive financial breakdown';

-- ============================================================================
-- PART 6: Triggers for Automatic Updates
-- ============================================================================

-- Function to update financial_summaries when a contract is created/updated
CREATE OR REPLACE FUNCTION update_financial_summaries()
RETURNS TRIGGER AS $$
DECLARE
  summary_id VARCHAR(50);
  summary_month VARCHAR(7);
  dev_id VARCHAR(50);
BEGIN
  -- Get development_id from stand table via standId
  SELECT s.development_id INTO dev_id
  FROM stands s
  WHERE s.id = NEW."standId"
  LIMIT 1;
  
  -- Skip if no development found
  IF dev_id IS NULL THEN
    RETURN NEW;
  END IF;
  
  -- Extract month_year from contract created date
  summary_month := TO_CHAR(NEW."createdAt", 'YYYY-MM');
  summary_id := dev_id || '-' || summary_month;
  
  -- Insert or update financial summary
  INSERT INTO financial_summaries (
    id, development_id, month_year,
    total_sales_count, total_sales_value,
    developer_gross, developer_commission_deducted, developer_net,
    total_commission, agent_commission_total, company_commission_total,
    vat_collected, aos_fees_collected, cession_fees_collected, 
    endowment_fees_collected, total_fees_collected,
    developer_outstanding
  )
  SELECT 
    summary_id,
    dev_id,
    summary_month,
    COUNT(*),
    COALESCE(SUM(c.total_client_payment), 0),
    COALESCE(SUM(c.base_price), 0),
    COALESCE(SUM(c.commission_total), 0),
    COALESCE(SUM(c.developer_net_amount), 0),
    COALESCE(SUM(c.commission_total), 0),
    COALESCE(SUM(c.commission_agent_share), 0),
    COALESCE(SUM(c.commission_company_share), 0),
    COALESCE(SUM(c.vat_amount), 0),
    COALESCE(SUM(c.aos_fee), 0),
    COALESCE(SUM(c.cession_fee), 0),
    COALESCE(SUM(c.endowment_fee), 0),
    COALESCE(SUM(c.vat_amount + COALESCE(c.aos_fee, 0) + COALESCE(c.cession_fee, 0) + COALESCE(c.endowment_fee, 0)), 0),
    COALESCE(SUM(c.developer_net_amount), 0) - COALESCE(
      (SELECT COALESCE(SUM(amount), 0) 
       FROM developer_payments 
       WHERE development_id = dev_id 
       AND month_year = summary_month), 0
    )
  FROM contracts c
  JOIN stands s ON s.id = c."standId"
  WHERE s.development_id = dev_id
    AND TO_CHAR(c."createdAt", 'YYYY-MM') = summary_month
  ON CONFLICT (development_id, month_year) 
  DO UPDATE SET
    total_sales_count = EXCLUDED.total_sales_count,
    total_sales_value = EXCLUDED.total_sales_value,
    developer_gross = EXCLUDED.developer_gross,
    developer_commission_deducted = EXCLUDED.developer_commission_deducted,
    developer_net = EXCLUDED.developer_net,
    total_commission = EXCLUDED.total_commission,
    agent_commission_total = EXCLUDED.agent_commission_total,
    company_commission_total = EXCLUDED.company_commission_total,
    vat_collected = EXCLUDED.vat_collected,
    aos_fees_collected = EXCLUDED.aos_fees_collected,
    cession_fees_collected = EXCLUDED.cession_fees_collected,
    endowment_fees_collected = EXCLUDED.endowment_fees_collected,
    total_fees_collected = EXCLUDED.total_fees_collected,
    developer_outstanding = EXCLUDED.developer_outstanding,
    updated_at = NOW();
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on contracts table
DROP TRIGGER IF EXISTS trg_update_financial_summaries ON contracts;
CREATE TRIGGER trg_update_financial_summaries
  AFTER INSERT OR UPDATE ON contracts
  FOR EACH ROW
  EXECUTE FUNCTION update_financial_summaries();

COMMENT ON FUNCTION update_financial_summaries IS 'Auto-update financial summaries when contracts are created/updated';

-- ============================================================================
-- PART 7: Verification Queries
-- ============================================================================

-- Verify tables exist
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'financial_summaries') THEN
    RAISE NOTICE '✅ financial_summaries table created';
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'agent_commissions') THEN
    RAISE NOTICE '✅ agent_commissions table created';
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'developer_payments') THEN
    RAISE NOTICE '✅ developer_payments table created';
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'contracts' AND column_name = 'commission_type') THEN
    RAISE NOTICE '✅ contracts table enhanced with financial columns';
  END IF;
END $$;

COMMIT;

-- ============================================================================
-- ROLLBACK SCRIPT (if needed)
-- ============================================================================
-- DROP TRIGGER IF EXISTS trg_update_financial_summaries ON contracts;
-- DROP FUNCTION IF EXISTS update_financial_summaries;
-- DROP TABLE IF EXISTS developer_payments CASCADE;
-- DROP TABLE IF EXISTS agent_commissions CASCADE;
-- DROP TABLE IF EXISTS financial_summaries CASCADE;
-- ALTER TABLE contracts DROP COLUMN IF EXISTS commission_type;
-- ALTER TABLE contracts DROP COLUMN IF EXISTS commission_rate;
-- ALTER TABLE contracts DROP COLUMN IF EXISTS commission_fixed_amount;
-- ALTER TABLE contracts DROP COLUMN IF EXISTS commission_total;
-- ALTER TABLE contracts DROP COLUMN IF EXISTS commission_agent_share;
-- ALTER TABLE contracts DROP COLUMN IF EXISTS commission_company_share;
-- ALTER TABLE contracts DROP COLUMN IF EXISTS base_price;
-- ALTER TABLE contracts DROP COLUMN IF EXISTS vat_amount;
-- ALTER TABLE contracts DROP COLUMN IF EXISTS aos_fee;
-- ALTER TABLE contracts DROP COLUMN IF EXISTS cession_fee;
-- ALTER TABLE contracts DROP COLUMN IF EXISTS endowment_fee;
-- ALTER TABLE contracts DROP COLUMN IF EXISTS total_client_payment;
-- ALTER TABLE contracts DROP COLUMN IF EXISTS developer_net_amount;
-- ALTER TABLE contracts DROP COLUMN IF EXISTS vat_enabled;
-- ALTER TABLE contracts DROP COLUMN IF EXISTS vat_rate;
-- ALTER TABLE contracts DROP COLUMN IF EXISTS aos_enabled;
-- ALTER TABLE contracts DROP COLUMN IF EXISTS cession_enabled;
-- ALTER TABLE contracts DROP COLUMN IF EXISTS endowment_enabled;
