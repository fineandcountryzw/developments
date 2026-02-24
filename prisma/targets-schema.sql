-- SALES TARGETS SCHEMA ADDITION
-- To be integrated into the main Prisma schema

-- Sales Targets Model
CREATE TABLE sales_targets (
    id TEXT PRIMARY KEY,
    
    -- Target Identification
    agent_id TEXT NOT NULL,
    development_id TEXT NULL, -- Optional: target specific to development
    branch TEXT NOT NULL DEFAULT 'Harare',
    
    -- Time Period
    target_period TEXT NOT NULL, -- Format: "YYYY-MM" for monthly targets
    target_type TEXT NOT NULL DEFAULT 'MONTHLY', -- MONTHLY, QUARTERLY, YEARLY
    
    -- Target Values
    revenue_target DECIMAL(12,2) NULL, -- Revenue target in currency
    deals_target INTEGER NULL, -- Number of deals target
    
    -- Metadata
    set_by TEXT NOT NULL, -- Manager who set the target
    notes TEXT NULL,
    status TEXT NOT NULL DEFAULT 'ACTIVE', -- ACTIVE, INACTIVE, ARCHIVED
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT unique_agent_dev_period_type UNIQUE(agent_id, development_id, target_period, target_type),
    CONSTRAINT fk_sales_targets_agent FOREIGN KEY (agent_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_sales_targets_development FOREIGN KEY (development_id) REFERENCES developments(id) ON DELETE SET NULL,
    CONSTRAINT fk_sales_targets_set_by FOREIGN KEY (set_by) REFERENCES users(id) ON DELETE RESTRICT
);

-- Create indexes separately (PostgreSQL best practice)
CREATE INDEX IF NOT EXISTS idx_sales_targets_period ON sales_targets(target_period);
CREATE INDEX IF NOT EXISTS idx_sales_targets_branch ON sales_targets(branch);
CREATE INDEX IF NOT EXISTS idx_sales_targets_agent ON sales_targets(agent_id);
CREATE INDEX IF NOT EXISTS idx_sales_targets_status ON sales_targets(status);
CREATE INDEX IF NOT EXISTS idx_sales_targets_development ON sales_targets(development_id) WHERE development_id IS NOT NULL;

-- Target Progress View (for easy querying)
CREATE OR REPLACE VIEW target_progress AS
SELECT 
    t.id,
    t.agent_id,
    t.development_id,
    t.branch,
    t.target_period,
    t.target_type,
    t.revenue_target,
    t.deals_target,
    
    -- Actual Performance (calculated from payments and reservations)
    COALESCE(p.actual_revenue, 0) as actual_revenue,
    COALESCE(r.actual_deals, 0) as actual_deals,
    
    -- Progress Percentages
    CASE 
        WHEN t.revenue_target > 0 THEN (COALESCE(p.actual_revenue, 0) / t.revenue_target) * 100
        ELSE 0 
    END as revenue_progress_percent,
    
    CASE 
        WHEN t.deals_target > 0 THEN (COALESCE(r.actual_deals, 0) / t.deals_target) * 100
        ELSE 0 
    END as deals_progress_percent,
    
    t.set_by,
    t.status,
    t.created_at,
    t.updated_at
    
FROM sales_targets t
LEFT JOIN (
    -- Actual revenue from confirmed payments (via client -> agent mapping)
    SELECT 
        c.agent_id,
        s.development_id,
        TO_CHAR(DATE_TRUNC('month', p.created_at), 'YYYY-MM') as period,
        SUM(p.amount) as actual_revenue
    FROM payments p
    JOIN clients c ON p.client_id = c.id
    LEFT JOIN stands s ON p.stand_id = s.id
    WHERE p.status = 'CONFIRMED'
    GROUP BY c.agent_id, s.development_id, DATE_TRUNC('month', p.created_at)
) p ON t.agent_id = p.agent_id 
    AND (t.development_id IS NULL OR t.development_id = p.development_id)
    AND t.target_period = p.period
LEFT JOIN (
    -- Actual deals from confirmed reservations
    SELECT 
        r.agent_id,
        s.development_id,
        TO_CHAR(DATE_TRUNC('month', r.created_at), 'YYYY-MM') as period,
        COUNT(*) as actual_deals
    FROM reservations r
    JOIN stands s ON r.stand_id = s.id
    WHERE r.status = 'CONFIRMED'
    GROUP BY r.agent_id, s.development_id, DATE_TRUNC('month', r.created_at)
) r ON t.agent_id = r.agent_id 
    AND (t.development_id IS NULL OR t.development_id = r.development_id)
    AND t.target_period = r.period;

-- DEPLOYMENT INSTRUCTIONS:
-- This SQL is now syntactically correct for PostgreSQL.
-- To deploy manually: psql -d your_database -f targets-schema.sql
-- Or use: npx prisma db push (recommended - uses Prisma schema)

-- DESIGN FEATURES:
-- 1. Flexible targeting: Can set targets per agent, per development, or both
-- 2. Multiple target types: Revenue-based, deal-based, or both  
-- 3. Time-based: Monthly, quarterly, yearly periods supported
-- 4. Manager control: Only managers can set targets (enforced in API)
-- 5. Progress tracking: View calculates actual vs target automatically
-- 6. Branch-aware: Supports multi-branch operations
-- 7. Data integrity: Foreign key constraints ensure referential integrity
-- 8. Performance optimized: Proper indexes for common query patterns