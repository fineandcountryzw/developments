-- 6. 72-hour Reservation Expiry Logic
-- Set expires_at default to 72 hours from created_at
ALTER TABLE public.reservations ALTER COLUMN expires_at SET DEFAULT (now() + interval '72 hours');
-- Fine & Country ERP: sales_transactions table update for Map-to-Portfolio Conversion Flow

-- 1. Add/Update sales_transactions table for commission and reservation logic
CREATE TABLE IF NOT EXISTS sales_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stand_id UUID NOT NULL,
    client_id UUID NOT NULL,
    agent_id UUID, -- nullable for Company Lead
    reservation_timestamp TIMESTAMP NOT NULL DEFAULT NOW(),
    commission_flag BOOLEAN NOT NULL DEFAULT FALSE,
    commission_rate NUMERIC NOT NULL DEFAULT 0,
    status VARCHAR(32) NOT NULL DEFAULT 'RESERVED',
    -- ...other relevant columns...
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 2. Commission-free logic for Company Lead
-- When agent_id IS NULL, set commission_flag = FALSE and commission_rate = 0
-- Example update after reservation:
-- UPDATE sales_transactions
-- SET commission_flag = FALSE, commission_rate = 0
-- WHERE agent_id IS NULL AND status = 'RESERVED';

-- 3. Terminology update: node → development
-- If you have a table previously named 'nodes', rename it:
-- ALTER TABLE nodes RENAME TO developments;
-- ALTER TABLE nodes_id_seq RENAME TO developments_id_seq;

-- If you have columns named 'node_id', rename them:
-- ALTER TABLE sales_transactions RENAME COLUMN node_id TO development_id;

-- 4. Ensure all references in your schema and code use 'development' instead of 'node'.

-- 5. Indexes for performance (optional)
CREATE INDEX IF NOT EXISTS idx_sales_transactions_stand_id ON sales_transactions(stand_id);
CREATE INDEX IF NOT EXISTS idx_sales_transactions_client_id ON sales_transactions(client_id);
CREATE INDEX IF NOT EXISTS idx_sales_transactions_agent_id ON sales_transactions(agent_id);
