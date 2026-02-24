-- Manual Migration: Add Stand-Payment Foreign Key Relation
-- Run this SQL directly on your Neon PostgreSQL database
-- Created: 2026-01-21

-- Step 1: Clean up any orphaned payment records with invalid standId
-- (standId that doesn't exist in stands table)
UPDATE payments 
SET stand_id = NULL 
WHERE stand_id IS NOT NULL 
  AND stand_id NOT IN (SELECT id FROM stands);

-- Step 2: Add foreign key constraint from payments.stand_id to stands.id
ALTER TABLE payments
ADD CONSTRAINT payments_stand_id_fkey 
FOREIGN KEY (stand_id) 
REFERENCES stands(id) 
ON DELETE SET NULL;

-- Step 3: Create index on stand_id for better query performance
CREATE INDEX IF NOT EXISTS idx_payments_stand_id ON payments(stand_id);

-- Verification: Check the constraint was added
SELECT 
  tc.constraint_name, 
  tc.table_name, 
  kcu.column_name, 
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name 
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY' 
  AND tc.table_name = 'payments'
  AND kcu.column_name = 'stand_id';
