-- ================================================
-- PAYMENT MODULE REDESIGN MIGRATION
-- ================================================
-- Date: January 14, 2026
-- Purpose: Redesign payments module with new requirements

-- 1. Add payment_type column (required)
ALTER TABLE payments 
ADD COLUMN IF NOT EXISTS payment_type TEXT;

-- Set default value for existing records
UPDATE payments 
SET payment_type = 'Installment' 
WHERE payment_type IS NULL;

-- Make it NOT NULL after backfilling
ALTER TABLE payments 
ALTER COLUMN payment_type SET NOT NULL;

-- 2. Rename received_by to received_by_name (free text)
ALTER TABLE payments 
RENAME COLUMN received_by TO received_by_name;

-- Clear old hardcoded values (Dadirai/Kudzi)
UPDATE payments 
SET received_by_name = NULL 
WHERE received_by_name IN ('Dadirai', 'Kudzi');

-- 3. Make manual_receipt_no required
UPDATE payments 
SET manual_receipt_no = CONCAT('LEGACY-', id) 
WHERE manual_receipt_no IS NULL;

ALTER TABLE payments 
ALTER COLUMN manual_receipt_no SET NOT NULL;

-- 4. Update method column to only allow Cash/Bank
-- Update existing values
UPDATE payments 
SET method = 'Cash' 
WHERE method IN ('CASH', 'Cash Handover');

UPDATE payments 
SET method = 'Bank' 
WHERE method IN ('BANK_TRANSFER', 'Nostro (USD)', 'RTGS', 'Paynow');

-- 5. Make clientId nullable (can be 'STAND-ONLY')
ALTER TABLE payments 
ALTER COLUMN client_id DROP NOT NULL;

-- 6. Add index on payment_type
CREATE INDEX IF NOT EXISTS idx_payments_payment_type ON payments(payment_type);

-- 7. Add check constraint for payment_type
ALTER TABLE payments 
ADD CONSTRAINT chk_payment_type 
CHECK (payment_type IN ('Deposit', 'Installment', 'Agreement of Sale Fee', 'Endowment Fees', 'VAT Fees'));

-- 8. Add check constraint for method
ALTER TABLE payments 
ADD CONSTRAINT chk_payment_method 
CHECK (method IN ('Cash', 'Bank'));

-- 9. Add check constraint for Cash payments must have received_by_name
ALTER TABLE payments 
ADD CONSTRAINT chk_cash_receiver 
CHECK (
  (method = 'Cash' AND received_by_name IS NOT NULL AND received_by_name <> '') 
  OR method <> 'Cash'
);

-- ================================================
-- VERIFICATION QUERIES
-- ================================================

-- Check payment types distribution
SELECT payment_type, COUNT(*) as count 
FROM payments 
GROUP BY payment_type 
ORDER BY count DESC;

-- Check payment methods distribution
SELECT method, COUNT(*) as count 
FROM payments 
GROUP BY method 
ORDER BY count DESC;

-- Check for records without client (stand-only payments)
SELECT COUNT(*) as stand_only_payments 
FROM payments 
WHERE client_id = 'STAND-ONLY';

-- Check cash payments have receiver names
SELECT COUNT(*) as cash_without_receiver 
FROM payments 
WHERE method = 'Cash' AND (received_by_name IS NULL OR received_by_name = '');

-- Check all payments have receipt numbers
SELECT COUNT(*) as without_receipt 
FROM payments 
WHERE manual_receipt_no IS NULL OR manual_receipt_no = '';

-- ================================================
-- ROLLBACK SCRIPT (if needed)
-- ================================================
-- DROP CONSTRAINT chk_cash_receiver;
-- DROP CONSTRAINT chk_payment_method;
-- DROP CONSTRAINT chk_payment_type;
-- ALTER TABLE payments DROP COLUMN payment_type;
-- ALTER TABLE payments RENAME COLUMN received_by_name TO received_by;
-- ALTER TABLE payments ALTER COLUMN manual_receipt_no DROP NOT NULL;
-- ALTER TABLE payments ALTER COLUMN client_id SET NOT NULL;
