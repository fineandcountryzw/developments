-- =========================================================================
-- PAYNOW & PROOF OF PAYMENT INTEGRATION SCHEMA
-- =========================================================================
-- Purpose: Add payment tracking columns to reservations table
-- Supports: Paynow API integration & Manual POP uploads
-- Timer Control: Pause/resume based on payment status
-- =========================================================================

-- Add payment tracking columns to reservations table
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'reserved';
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS payment_method VARCHAR(50);
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS payment_reference VARCHAR(255);
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS payment_amount DECIMAL(12,2);
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS payment_uploaded_at TIMESTAMPTZ;
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS payment_verified_at TIMESTAMPTZ;
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS pop_url TEXT;
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS timer_active BOOLEAN DEFAULT true;
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS aos_issued_at TIMESTAMPTZ;

-- Add index for fast status queries
CREATE INDEX IF NOT EXISTS idx_reservations_status ON reservations(status);
CREATE INDEX IF NOT EXISTS idx_reservations_payment_method ON reservations(payment_method);
CREATE INDEX IF NOT EXISTS idx_reservations_timer_active ON reservations(timer_active);

-- Add comments for documentation
COMMENT ON COLUMN reservations.status IS 'Current reservation status: reserved, Payment Pending, payment_verified, aos_issued, expired';
COMMENT ON COLUMN reservations.payment_method IS 'Payment method used: Paynow, bank_transfer, rtgs, cash';
COMMENT ON COLUMN reservations.payment_reference IS 'Paynow reference or transaction ID for tracking';
COMMENT ON COLUMN reservations.payment_amount IS 'Actual amount paid (may differ from quoted price)';
COMMENT ON COLUMN reservations.paid_at IS 'Timestamp when payment was confirmed (Paynow instant or admin verified)';
COMMENT ON COLUMN reservations.payment_uploaded_at IS 'Timestamp when client uploaded proof of payment (manual only)';
COMMENT ON COLUMN reservations.payment_verified_at IS 'Timestamp when admin verified manual payment';
COMMENT ON COLUMN reservations.pop_url IS 'Supabase Storage URL to uploaded receipt/proof document in payment-proofs bucket';
COMMENT ON COLUMN reservations.timer_active IS 'TRUE = 72h timer counting down, FALSE = timer stopped (payment submitted)';
COMMENT ON COLUMN reservations.aos_issued_at IS 'Timestamp when Agreement of Sale was issued to client';

-- =========================================================================
-- NOTIFICATIONS TABLE FOR ADMIN ALERTS
-- =========================================================================

CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(100) NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    data JSONB,
    read BOOLEAN DEFAULT false,
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Indexes for performance
    CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);

COMMENT ON TABLE notifications IS 'In-app notifications for admins (payment verification, expiring reservations, etc.)';
COMMENT ON COLUMN notifications.type IS 'Notification type: payment_verification_needed, paynow_payment_received, reservation_expiring';
COMMENT ON COLUMN notifications.data IS 'JSON payload with reservation_id, stand_number, amount, etc.';

-- =========================================================================
-- SUPABASE STORAGE BUCKET FOR PAYMENT PROOFS
-- =========================================================================
-- Note: This must be created in Supabase Dashboard or via SQL:
-- 
-- INSERT INTO storage.buckets (id, name, public)
-- VALUES ('payment-proofs', 'payment-proofs', false);
--
-- Bucket Policy (Private - Admin Only):
-- - Clients can upload to their own folder: payment-proofs/{user_id}/*
-- - Admins can read all: payment-proofs/**
-- =========================================================================

-- Storage policy for client uploads
CREATE POLICY "Clients can upload proof of payment"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'payment-proofs' AND
    (storage.foldername(name))[1] = auth.uid()::text
);

-- Storage policy for client reads (own files only)
CREATE POLICY "Clients can view their own proofs"
ON storage.objects FOR SELECT
TO authenticated
USING (
    bucket_id = 'payment-proofs' AND
    (storage.foldername(name))[1] = auth.uid()::text
);

-- Storage policy for admin reads (all files)
CREATE POLICY "Admins can view all proofs"
ON storage.objects FOR SELECT
TO authenticated
USING (
    bucket_id = 'payment-proofs' AND
    EXISTS (
        SELECT 1 FROM users
        WHERE users.id = auth.uid()
        AND users.role = 'admin'
    )
);

-- =========================================================================
-- PAYMENT STATUS HELPER FUNCTIONS
-- =========================================================================

-- Function to check if reservation timer should be active
CREATE OR REPLACE FUNCTION is_timer_active(reservation_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    timer_status BOOLEAN;
BEGIN
    SELECT timer_active INTO timer_status
    FROM reservations
    WHERE id = reservation_id;
    
    RETURN COALESCE(timer_status, false);
END;
$$ LANGUAGE plpgsql;

-- Function to pause timer and update status
CREATE OR REPLACE FUNCTION pause_reservation_timer(reservation_id UUID, new_status VARCHAR)
RETURNS VOID AS $$
BEGIN
    UPDATE reservations
    SET 
        timer_active = false,
        status = new_status,
        payment_uploaded_at = NOW()
    WHERE id = reservation_id;
    
    -- Log the action
    INSERT INTO activity_logs (user_id, action, entity_type, entity_id, details)
    SELECT 
        reserved_by,
        'timer_stopped',
        'reservation',
        reservation_id,
        jsonb_build_object('status', new_status, 'timestamp', NOW(), 'forensic_stop', true)
    FROM reservations
    WHERE id = reservation_id;
END;
$$ LANGUAGE plpgsql;

-- Function to resume timer
CREATE OR REPLACE FUNCTION resume_reservation_timer(reservation_id UUID)
RETURNS VOID AS $$
BEGIN
    UPDATE reservations
    SET timer_active = true
    WHERE id = reservation_id;
END;
$$ LANGUAGE plpgsql;

-- =========================================================================
-- FORENSIC AUDIT TRAIL
-- =========================================================================

-- Trigger to log all payment-related changes
CREATE OR REPLACE FUNCTION log_payment_changes()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.paid_at IS DISTINCT FROM OLD.paid_at THEN
        INSERT INTO activity_logs (user_id, action, entity_type, entity_id, details)
        VALUES (
            NEW.reserved_by,
            'payment_confirmed',
            'reservation',
            NEW.id,
            jsonb_build_object(
                'payment_method', NEW.payment_method,
                'amount', NEW.payment_amount,
                'reference', NEW.payment_reference,
                'timestamp', NEW.paid_at
            )
        );
    END IF;
    
    IF NEW.payment_verified_at IS DISTINCT FROM OLD.payment_verified_at THEN
        INSERT INTO activity_logs (user_id, action, entity_type, entity_id, details)
        VALUES (
            NEW.reserved_by,
            'payment_verified',
            'reservation',
            NEW.id,
            jsonb_build_object(
                'verified_at', NEW.payment_verified_at,
                'proof_url', NEW.payment_proof_url
            )
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER payment_audit_trigger
AFTER UPDATE ON reservations
FOR EACH ROW
EXECUTE FUNCTION log_payment_changes();

-- =========================================================================
-- SAMPLE DATA FOR TESTING
-- =========================================================================

-- Example: Reserved stand with active timer
-- INSERT INTO reservations (stand_id, reserved_by, expires_at, status, timer_paused)
-- VALUES (
--     'stand-uuid-here',
--     'user-uuid-here',
--     NOW() + INTERVAL '72 hours',
--     'reserved',
--     false
-- );

-- Example: Stand with POP uploaded (timer paused)
-- INSERT INTO reservations (
--     stand_id, 
--     reserved_by, 
--     expires_at, 
--     status, 
--     payment_method,
--     payment_uploaded_at,
--     payment_proof_url,
--     timer_paused
-- )
-- VALUES (
--     'stand-uuid-here',
--     'user-uuid-here',
--     NOW() + INTERVAL '72 hours',
--     'payment_uploaded',
--     'bank_transfer',
--     NOW(),
--     'payment-proofs/user-id/stand_123_POP.pdf',
--     true
-- );

-- =========================================================================
-- DEPLOYMENT CHECKLIST
-- =========================================================================
-- ✅ Run this migration script
-- ✅ Create 'payment-proofs' storage bucket in Supabase Dashboard
-- ✅ Enable RLS on storage.objects
-- ✅ Update .env with Paynow credentials:
--    - VITE_PAYNOW_INTEGRATION_ID
--    - VITE_PAYNOW_INTEGRATION_KEY
-- ✅ Test Paynow in sandbox mode before production
-- ✅ Configure admin notification emails in Supabase Edge Functions
-- =========================================================================
