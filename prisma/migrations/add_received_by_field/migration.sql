-- Add received_by and manual_receipt_no fields to payments table
ALTER TABLE payments ADD COLUMN IF NOT EXISTS received_by varchar(255);
ALTER TABLE payments ADD COLUMN IF NOT EXISTS manual_receipt_no varchar(255);

-- Create index for filtering by receiver
CREATE INDEX IF NOT EXISTS idx_payments_received_by ON payments(received_by);
